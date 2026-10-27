/**
 * Household checks — `node scripts/household_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/lib/household.js` is the whole of the household identity in TASK_07: it owns the localStorage
 * key that *is* the credential (there is no login), the `x-household-id` header every scoped request
 * depends on, and both halves of the join flow. Measured, not assumed: `git grep -lE
 * "['\"][^'\"]*household\.js['\"]"` across `main` and all 30 remote heads, in `scripts/*` only,
 * returns nothing — the module had no suite. (The string `household` appears in nine scripts, but
 * only as a table name or a comment; none of them imports this file.)
 *
 * WHAT IT ASSERTS, AND WHY EACH THING MATTERS
 *   - `generateLocalJoinCode` — the alphabet is the unambiguous one (no I/L/O/0/1), the code is 8
 *     characters, and it is drawn from `crypto.getRandomValues` when available. A code a human cannot
 *     read back over the phone is the failure this prevents.
 *   - `setHousehold`/`getHouseholdId`/`clearHousehold` — the stored key names and the header side
 *     effect. `getHouseholdId` re-attaching the header is what makes a page reload keep working;
 *     `clearHousehold` detaching it is what stops a stale id leaking onto the next household's
 *     requests. Both are asserted by call, not by return value.
 *   - `ensureHousehold` — the four paths that matter: an id already on the device (no request), a
 *     successful `create_household` (remote), an errored/throwing one (falls back to local *without*
 *     throwing), and no Supabase client at all (local). `remote` is what the UI shows the user, so
 *     getting it backwards tells a household it is shared when it is not.
 *   - `joinWithCode` — `empty` and `unsupported` are decided *before* any request; the code is
 *     trimmed and upper-cased before it is looked up; both the string and the array shape of
 *     `resolve_join_code` are accepted; a missing row is `not_found`; a transport error is `error`
 *     and never a throw. The local case returning `unsupported` (rather than pretending to join) is
 *     the file's own documented decision and is pinned here.
 *
 * HOW THE MODULE IS LOADED, AND WHY IT IS NOT A CHEAT
 * `household.js` imports `./supabase`, which reads `import.meta.env` — a Vite-injected global. Bare
 * Node throws on it. So this process redirects that ONE specifier, via a resolve hook, to a small
 * in-memory stand-in whose `supabase` export is a live binding the test points at a recording fake,
 * and whose `setHouseholdHeader` records every call. Everything else about the module under test is
 * the real file, resolved from this script's own location — the assertions below run the real
 * `ensureHousehold`, not a copy of its logic. `window.localStorage` is stood in for by a Map-backed
 * recorder, which is also how the header/key side effects are observed.
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * This is a node-level logic check. It renders nothing, exercises no React context, calls no real
 * Supabase and touches no database — the same scope note as every other script in this directory.
 * No assertion here says anything about whether Postgres accepts `create_household`; that is
 * `scripts/task07_check.mjs` and the migration checks.
 *
 * NEGATIVE CONTROL (run it before trusting a clean result): copy `src` and `scripts` to a scratch
 * directory, break one thing in the copy's `src/lib/household.js`, and re-run this file from there.
 * Four controls measured on 2026-10-13, each mutating *logic* rather than a comment, each going red at
 * the group it targets and leaving the rest of the file running (58 ok / 0 FAIL / exit 0 clean):
 *   - the alphabet with the ambiguous characters restored (`...23456789` -> `...0123456789ILO`)
 *                                                    -> 56 ok /  2 FAIL  (the alphabet group)
 *   - `remote: !getJoinCodeIsLocal()` -> `remote: true`
 *                                                    -> 57 ok /  1 FAIL  (the existing-id branch)
 *   - `if (!supabase) return { ok: false, reason: 'unsupported' };` -> `if (false) …`
 *                                                    -> 57 ok /  1 FAIL  (the unsupported-join guard)
 *   - `(code ?? '').trim().toUpperCase()` -> `(code ?? '')`
 *                                                    -> 55 ok /  3 FAIL  (normalisation + lookup)
 * A restored copy is green again.
 *
 * Plain script, non-zero exit on failure — same shape as scripts/task07_check.mjs.
 */
import { registerHooks } from 'node:module';

// A live-binding stand-in for `./supabase`. `supabase` is exported as `let` so the module under test
// sees every reassignment the test makes through `setClient`; `setHouseholdHeader` records calls.
const SUPABASE_STUB_URL = 'data:text/javascript,' + encodeURIComponent([
    'export let supabase = null;',
    'export const headerCalls = [];',
    'export function setClient(client) { supabase = client; }',
    'export function setHouseholdHeader(id) { headerCalls.push(id ?? null); return true; }',
].join('\n'));

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === './supabase' || specifier === './supabase.js') {
            return { url: SUPABASE_STUB_URL, shortCircuit: true };
        }
        // The app's own imports are extensionless; Vite resolves them, bare Node does not.
        if (specifier.startsWith('.') && !/\.[cm]?js$/.test(specifier)) {
            return nextResolve(`${specifier}.js`, context);
        }
        return nextResolve(specifier, context);
    },
});

// ── a recording stand-in for window.localStorage ────────────────────────────────────────────────
// Map-backed, so the stored value and the removal are both observable, and the key names are
// asserted rather than assumed.
const store = new Map();
const storageLog = [];
globalThis.window = {
    localStorage: {
        getItem(key) { storageLog.push(['get', key]); return store.has(key) ? store.get(key) : null; },
        setItem(key, value) { storageLog.push(['set', key, value]); store.set(key, String(value)); },
        removeItem(key) { storageLog.push(['remove', key]); store.delete(key); },
    },
};

const { generateLocalJoinCode, getHouseholdId, getJoinCode, getJoinCodeIsLocal, setHousehold,
    clearHousehold, ensureHousehold, joinWithCode } = await import('../src/lib/household.js');
const { setClient, headerCalls } = await import(SUPABASE_STUB_URL);

let failures = 0;
function check(name, actual, expected) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
        console.log(`  ok   ${name}`);
    } else {
        failures += 1;
        console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
    }
}

/** Await a call and report whether it threw, plus the message and value. */
async function caught(fn) {
    try {
        const value = await fn();
        return { threw: false, message: null, value };
    } catch (err) {
        return { threw: true, message: err?.message ?? String(err), value: null };
    }
}

const ID_KEY = 'meal_buddy_household_id';
const CODE_KEY = 'meal_buddy_household_code';
const LOCAL_KEY = 'meal_buddy_household_code_is_local';

function reset() {
    store.clear();
    storageLog.length = 0;
    headerCalls.length = 0;
}

// ── a recording stand-in for the Supabase client (rpc only — household.js uses nothing else) ────
let rpcCalls = [];
let rpcReply = { data: null, error: null };
let rpcReject = null;

function resetRpc() {
    rpcCalls = [];
    rpcReply = { data: null, error: null };
    rpcReject = null;
}

const fakeClient = {
    rpc(fn, args) {
        rpcCalls.push([fn, args]);
        if (rpcReject) return Promise.reject(rpcReject);
        return Promise.resolve({ data: rpcReply.data, error: rpcReply.error });
    },
};

// `ensureHousehold`/`joinWithCode` log a warning when they fall back; keep the output readable and
// record that they did, so "it warned" is assertable rather than invisible.
const warnings = [];
const realWarn = console.warn;
console.warn = (...args) => { warnings.push(args.map(String).join(' ')); };

// ── generateLocalJoinCode ───────────────────────────────────────────────────────────────────────
console.log('\ngenerateLocalJoinCode — an 8-character code a human can read back');

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const code = generateLocalJoinCode();
check('the code is 8 characters', code.length, 8);
check('every character is in the unambiguous alphabet',
    [...code].every((c) => ALPHABET.includes(c)), true);
check('the ambiguous characters are excluded (no I, L, O, 0, 1)',
    /[ILO01]/.test(code), false);
check('the alphabet itself has 31 symbols, not 36',
    ALPHABET.length, 31);

// With crypto.getRandomValues stubbed to a known byte stream the code must be reproducible — this is
// what proves the randomness actually comes from crypto rather than from Math.random.
const realGetRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
let stubBytes = null;
globalThis.crypto.getRandomValues = (arr) => {
    if (stubBytes) { for (let i = 0; i < arr.length; i += 1) arr[i] = stubBytes[i % stubBytes.length]; return arr; }
    return realGetRandomValues(arr);
};
// Non-zero bytes only: the module writes `bytes[i] || Math.random() * 256`, so a 0 byte deliberately
// (and measurably) falls through to Math.random. That quirk is pinned by its own check below rather
// than left to make this one flaky.
stubBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
const deterministic = generateLocalJoinCode();
check('a fixed non-zero byte stream yields a fixed code (the source is crypto)',
    deterministic, [...stubBytes].map((b) => ALPHABET[b % ALPHABET.length]).join(''));

// The `||` fallback, measured: an all-zero byte stream must still produce a well-formed code (it does
// not throw, and it does not emit a code made of the first alphabet symbol 8 times).
stubBytes = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
const zeroStream = generateLocalJoinCode();
check('an all-zero byte stream still yields 8 valid characters', [zeroStream.length, [...zeroStream].every((c) => ALPHABET.includes(c))], [8, true]);
stubBytes = null;

const many = new Set();
for (let i = 0; i < 500; i += 1) many.add(generateLocalJoinCode());
check('500 codes are all distinct', many.size, 500);

// ── setHousehold / getHouseholdId / getJoinCode / clearHousehold ────────────────────────────────
console.log('\nsetHousehold / getHouseholdId / clearHousehold — the key that IS the credential');

reset();
setHousehold('hh-1');
check('the id is stored under the documented key', store.get(ID_KEY), 'hh-1');
check('setting a household attaches the header', headerCalls, ['hh-1']);
check('a household set without a code reads back an empty code', getJoinCode(), '');
check('...and is not marked local when it was not told to be', getJoinCodeIsLocal(), false);

reset();
setHousehold('hh-2', { joinCode: 'ABCD2345', joinCodeIsLocal: true });
check('the join code is stored under the documented key', store.get(CODE_KEY), 'ABCD2345');
check('the local flag is stored as the string "true"', store.get(LOCAL_KEY), 'true');
check('getJoinCode returns it', getJoinCode(), 'ABCD2345');
check('getJoinCodeIsLocal is true', getJoinCodeIsLocal(), true);

reset();
store.set(ID_KEY, 'hh-3');
store.set(LOCAL_KEY, 'false');
check('getHouseholdId returns the stored id', getHouseholdId(), 'hh-3');
check('...and re-attaches the header on read (a reload keeps working)', headerCalls, ['hh-3']);

reset();
check('getHouseholdId with nothing stored returns null', getHouseholdId(), null);
check('...and attaches no header', headerCalls, []);

reset();
store.set(ID_KEY, 'hh-4');
store.set(CODE_KEY, 'X');
store.set(LOCAL_KEY, 'true');
clearHousehold();
check('clearHousehold removes the id', store.has(ID_KEY), false);
check('clearHousehold removes the join code', store.has(CODE_KEY), false);
check('clearHousehold removes the local flag', store.has(LOCAL_KEY), false);
check('clearHousehold detaches the header', headerCalls, [null]);

// ── ensureHousehold ─────────────────────────────────────────────────────────────────────────────
console.log('\nensureHousehold — existing / remote / failed / no-client');

reset(); resetRpc(); warnings.length = 0;
store.set(ID_KEY, 'hh-existing');
store.set(CODE_KEY, 'CODE1234');
store.set(LOCAL_KEY, 'false');
setClient(fakeClient);
let out = await caught(() => ensureHousehold('Kitchen'));
check('an existing household is returned without any request', rpcCalls, []);
check('...with its stored code', out.value.joinCode, 'CODE1234');
check('...and remote true when the code is a real row', out.value.remote, true);

reset(); resetRpc();
store.set(ID_KEY, 'hh-local');
store.set(CODE_KEY, 'LOCAL234');
store.set(LOCAL_KEY, 'true');
out = await caught(() => ensureHousehold());
check('an existing device-local household reports remote false', out.value.remote, false);

reset(); resetRpc();
setClient(fakeClient);
rpcReply = { data: [{ id: 'remote-1', join_code: 'REMOTE23' }], error: null };
out = await caught(() => ensureHousehold('Casa Jensen'));
check('create_household is called with the name as p_name', rpcCalls, [['create_household', { p_name: 'Casa Jensen' }]]);
check('a created household is remote', out.value.remote, true);
check('...and its id and code come from the row', [out.value.id, out.value.joinCode], ['remote-1', 'REMOTE23']);
check('...and it is persisted to localStorage', store.get(ID_KEY), 'remote-1');
check('...and it is NOT marked local', store.get(LOCAL_KEY), 'false');

reset(); resetRpc();
rpcReply = { data: { id: 'remote-2', join_code: 'OBJCODE2' }, error: null };
out = await caught(() => ensureHousehold(null));
check('a single-object reply (not an array) is accepted too', out.value.id, 'remote-2');
check('...and p_name is null when no name is given', rpcCalls[0][1], { p_name: null });

reset(); resetRpc();
rpcReply = { data: null, error: { message: 'nope' } };
out = await caught(() => ensureHousehold());
check('an errored create_household does not throw', out.threw, false);
check('...and falls back to a device-local household', out.value.remote, false);
check('...with an id that is persisted', store.get(ID_KEY), out.value.id);
check('...marked local in storage', store.get(LOCAL_KEY), 'true');
check('...and it warned', warnings.some((w) => /going local/.test(w)), true);

reset(); resetRpc();
rpcReject = new Error('network down');
out = await caught(() => ensureHousehold());
check('a throwing create_household does not throw either', out.threw, false);
check('...and still yields a usable local household', out.value.remote, false);
check('...with an 8-character local code', out.value.joinCode.length, 8);

reset(); resetRpc();
setClient(null);
out = await caught(() => ensureHousehold());
check('with no Supabase client no request is made', rpcCalls, []);
check('...and the household is device-local', out.value.remote, false);
check('...with the header still attached for local-only use', headerCalls.includes(out.value.id), true);

// ── joinWithCode ────────────────────────────────────────────────────────────────────────────────
console.log('\njoinWithCode — the two pre-request refusals, then the lookup');

reset(); resetRpc();
setClient(fakeClient);
let joined = await caught(() => joinWithCode('   '));
check('a blank code is refused as empty', joined.value, { ok: false, reason: 'empty' });
check('...before any request is made', rpcCalls, []);
joined = await caught(() => joinWithCode(null));
check('a null code is refused as empty', joined.value, { ok: false, reason: 'empty' });

reset(); resetRpc();
setClient(null);
joined = await caught(() => joinWithCode('ABCD2345'));
check('with no Supabase client joining is unsupported, not silently local', joined.value, { ok: false, reason: 'unsupported' });
check('...and nothing was requested', rpcCalls, []);

reset(); resetRpc();
setClient(fakeClient);
rpcReply = { data: 'hh-joined', error: null };
joined = await caught(() => joinWithCode(' abcd2345 '));
check('the code is trimmed and upper-cased before lookup', rpcCalls, [['resolve_join_code', { p_code: 'ABCD2345' }]]);
check('a string reply is accepted', joined.value, { ok: true, id: 'hh-joined' });
check('...and the joined household is persisted as remote', [store.get(ID_KEY), store.get(LOCAL_KEY)], ['hh-joined', 'false']);

reset(); resetRpc();
rpcReply = { data: [{ resolve_join_code: 'hh-array' }], error: null };
joined = await caught(() => joinWithCode('ZZZZ9999'));
check('an array reply is accepted too', joined.value, { ok: true, id: 'hh-array' });

reset(); resetRpc();
rpcReply = { data: null, error: null };
joined = await caught(() => joinWithCode('NOPE1234'));
check('an unknown code is not_found', joined.value, { ok: false, reason: 'not_found' });
check('...and nothing was stored', store.has(ID_KEY), false);

reset(); resetRpc();
rpcReply = { data: null, error: { message: 'bad' } };
joined = await caught(() => joinWithCode('ERRR1234'));
check('a resolve error is reported, not thrown', [joined.threw, joined.value.reason], [false, 'error']);

reset(); resetRpc();
rpcReject = new Error('offline');
joined = await caught(() => joinWithCode('THRW1234'));
check('a transport throw is reported as error, not thrown', [joined.threw, joined.value.reason], [false, 'error']);

console.warn = realWarn;

// ───────────────────────────────────────────────────────────────────────────────────────────────
console.log('');
if (failures) {
    console.log(`${failures} FAILED`);
    process.exit(1);
}
console.log('all checks passed');
