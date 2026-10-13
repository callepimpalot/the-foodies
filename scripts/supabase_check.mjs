/**
 * Supabase client checks — `node scripts/supabase_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/lib/supabase.js` is the module every Supabase-touching feature in the app goes through, and it
 * is the one module in `src/lib/` that had no suite at all. Measured, not assumed: at the time of
 * writing, `git grep -l -- "src/lib/supabase"` across `origin/main` and all 32 remote heads, restricted
 * to `scripts/*.mjs`, returns NO file — every other module in `src/lib/` that has a suite names its own
 * specifier. The string `supabase` does appear in `scripts/migration_reapply_check.mjs`,
 * `scripts/recipe_deletion_check.mjs` and `scripts/task07_check.mjs`, but only as a table name, a
 * filename or prose. `scripts/household_check.mjs` deliberately *stubs this file out* (it redirects the
 * `./supabase` specifier), which is exactly why household.js's suite cannot be the thing that covers it.
 *
 * What it owns, and why each part matters:
 *   * the CONFIGURATION GATE. `supabase` is `null` unless the URL is http(s) *and* the anon key is
 *     present and is not the placeholder. Every caller treats `null` as "run without a backend", so a
 *     gate that opened on a placeholder key would make the app talk to Supabase with the literal
 *     string `YOUR_SUPABASE_ANON_KEY` and fail per-request instead of falling back — the exact failure
 *     the file's own `console.warn` exists to make visible.
 *   * the CATCH in `isValidUrl`. It is not dead code: `url.startsWith` throws on a non-string, and env
 *     values are not guaranteed to be strings. A number or an object must resolve to "not configured",
 *     not to a TypeError escaping module evaluation (which would take the whole app down at import).
 *   * the CLIENT VALUES. `createClient` must be handed the URL and the key the right way round; a swap
 *     is silent here and produces confusing auth failures much later.
 *   * `setHouseholdHeader` — the whole of TASK_07's interim security model on the client side. The
 *     household id it attaches is the credential (`x-household-id`); without it every plan query
 *     returns nothing, deliberately. The file documents two claims about *how* it does that, and both
 *     are asserted here against the installed `@supabase/supabase-js` (2.95.3): that
 *     `supabase.rest.headers` is a WHATWG `Headers` instance, and that `from()` copies it per query so
 *     a later request carries the id. A major-version bump that breaks either would present as "the plan
 *     stopped saving", not as a header bug — so this is where that gets caught instead.
 *
 * HOW THE MODULE IS LOADED, AND WHY IT IS NOT A CHEAT
 * The file reads `import.meta.env` — a Vite-injected global that does not exist in bare Node (reading
 * it throws on `undefined`). This process therefore registers ONE load hook that rewrites the literal
 * `import.meta.env` in *this file's own source* to a global this script controls, then imports the real
 * module from this script's own location. Nothing else is transformed: the assertions below run the
 * real `isValidUrl`, the real gate, the real `createClient` call and the real `setHouseholdHeader`.
 * The real `@supabase/supabase-js` from the repo's `node_modules` is used — no client is stubbed, and
 * no network request is made (no request is ever sent from a check script).
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * This is a node-level contract check. It sends nothing, reaches no database, and says nothing about
 * whether Postgres accepts a request — that is `scripts/task07_check.mjs` and the migration checks. It
 * does not prove the anon key is absent from the deployed bundle (`scripts/env_boundary_check.mjs`
 * does). It does not exercise `create_household`/RLS (TASK_07's probe did that through the anon key).
 * The gate cases use the module's own wiring with injected env values; they do not simulate Vite's
 * `import.meta.env` substitution itself beyond the one literal rewrite described above.
 *
 * NEGATIVE CONTROL (run it before trusting a clean result — each must turn the suite red).
 * Six controls were measured on 2026-10-13 against a green baseline of **51 ok / 0 FAIL / exit 0**,
 * each on a fresh `cp -r src scripts` copy of this branch, each mutating logic rather than a comment:
 *   1. open the gate on the placeholder key  (`&& supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY'` dropped)
 *        -> 48 ok /  3 FAIL, exit 1
 *   2. drop the http(s) scheme test  (`(url.startsWith('https://') || …)` -> `true`)
 *        -> 4 ok / 0 FAIL, **exit 1** — the run aborts at the `postgres://` case, because `createClient`
 *           itself throws `Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.` and the throw
 *           escapes module evaluation. Red, but abruptly: this is exactly the failure the gate exists
 *           to prevent, and it is worth knowing that supabase-js validates the URL too, so the gate's
 *           scheme test is not what stops a bad URL — turning a hard import-time crash into a silent
 *           `null` is.
 *   3. never clear the header  (`headers.delete('x-household-id')` neutralised)
 *        -> 47 ok /  4 FAIL, exit 1
 *   4. clear-on-falsy becomes clear-on-null-only  (`if (id) {` -> `if (id !== null && id !== undefined) {`)
 *        -> 49 ok /  2 FAIL, exit 1
 *   5. keep the warning quiet when unconfigured  (`console.warn(…)` -> `void 0`)
 *        -> 41 ok / 10 FAIL, exit 1
 *   6. swap url and key at the `createClient` call
 *        -> 0 ok / 0 FAIL, exit 1 (same abrupt `Invalid supabaseUrl` throw; the gate is satisfied by
 *           the key string, which is not a URL)
 * One mutation did NOT go red, and it is recorded here because a control that proves nothing is worse
 * than no control: replacing `String(id)` with a bare `id` is **behaviourally identical**, because
 * `Headers.set` coerces its value to a string per the WHATWG spec (51 ok / 0 FAIL, exit 0). So the
 * numeric-id assertion below pins the *observable* contract (the header reads back as `4242`), not the
 * presence of `String()` — the coercion in the source is redundant with the platform's.
 * A restored copy is green again (the positive control).
 *
 * Plain script, non-zero exit on failure — same shape as scripts/task07_check.mjs and
 * scripts/image_utils_check.mjs.
 */
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TARGET = fileURLToPath(new URL('../src/lib/supabase.js', import.meta.url));
const ENV_GLOBAL = 'globalThis.__SUPABASE_CHECK_ENV__';

registerHooks({
    resolve(specifier, context, nextResolve) {
        // The app's own imports are extensionless; Vite resolves them, bare Node does not.
        if (specifier.startsWith('.') && !/\.[cm]?js$/.test(specifier)) {
            return nextResolve(`${specifier}.js`, context);
        }
        return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
        const bare = url.startsWith('file:') ? fileURLToPath(url.split('?')[0]) : url;
        if (bare === TARGET) {
            const src = readFileSync(TARGET, 'utf8').replaceAll('import.meta.env', ENV_GLOBAL);
            return { format: 'module', source: src, shortCircuit: true };
        }
        return nextLoad(url, context);
    },
});

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

// ── console.warn is the gate's only outward signal; record it per case ──────────────────────────
const warns = [];
const realWarn = console.warn;
console.warn = (...args) => warns.push(args.map((a) => String(a)).join(' '));

// A fresh module instance per case, so a case cannot pass on the previous case's state. The query
// string is what makes Node evaluate the module again rather than return the cached one.
let caseNo = 0;
async function loadWith(env) {
    globalThis[ENV_GLOBAL.slice('globalThis.'.length)] = env;
    warns.length = 0;
    caseNo += 1;
    return import(new URL(`../src/lib/supabase.js?case=${caseNo}`, import.meta.url).href);
}

const OK_ENV = { VITE_SUPABASE_URL: 'https://hqquetkybgwydrsntptv.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon-key-not-the-placeholder' };

// ── 1. the configuration gate ──────────────────────────────────────────────────────────────────
// Each case asserts BOTH halves of the contract: whether a client was built, and whether the
// warning fired. A gate that stayed silent while returning null would be just as broken.
console.log('\nconfiguration gate');
const GATE_CASES = [
    ['a https url + a real key builds a client', OK_ENV, false, 0],
    ['an http url (local supabase) builds a client', { VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'k' }, false, 0],
    ['a non-http(s) scheme does not', { VITE_SUPABASE_URL: 'postgres://db', VITE_SUPABASE_ANON_KEY: 'k' }, true, 1],
    ['a missing url does not', { VITE_SUPABASE_ANON_KEY: 'k' }, true, 1],
    ['an undefined url does not', { VITE_SUPABASE_URL: undefined, VITE_SUPABASE_ANON_KEY: 'k' }, true, 1],
    ['a url without a scheme does not', { VITE_SUPABASE_URL: 'hqquetkybgwydrsntptv.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' }, true, 1],
    ['the literal placeholder key does not', { VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY' }, true, 1],
    ['an empty key does not', { VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: '' }, true, 1],
    ['a missing key does not', { VITE_SUPABASE_URL: 'https://x.supabase.co' }, true, 1],
    // the catch branch in isValidUrl: `.startsWith` throws on a non-string
    ['a numeric url does not throw out of module evaluation', { VITE_SUPABASE_URL: 12345, VITE_SUPABASE_ANON_KEY: 'k' }, true, 1],
    ['an object url does not throw out of module evaluation', { VITE_SUPABASE_URL: {}, VITE_SUPABASE_ANON_KEY: 'k' }, true, 1],
];
for (const [name, env, expectNull, expectWarns] of GATE_CASES) {
    const mod = await loadWith(env);
    check(`gate: ${name} (null=${expectNull})`, mod.supabase === null, expectNull);
    check(`gate: ${name} (warns=${expectWarns})`, warns.length, expectWarns);
}

// the warning text is the only clue a developer gets; it is asserted verbatim
{
    await loadWith({ VITE_SUPABASE_ANON_KEY: 'k' });
    check('gate: the warning names the cause', warns[0], 'Supabase is not configured. Check your .env file.');
}

// ── 2. the client the gate builds ──────────────────────────────────────────────────────────────
console.log('\nclient');
const configured = await loadWith(OK_ENV);
check('client: is not null when configured', configured.supabase !== null, true);
check('client: got the URL it was given (not the key)', configured.supabase.supabaseUrl, OK_ENV.VITE_SUPABASE_URL);
check('client: got the key it was given (not the URL)', configured.supabase.supabaseKey, OK_ENV.VITE_SUPABASE_ANON_KEY);
check('client: rest.headers is a WHATWG Headers instance', configured.supabase.rest.headers instanceof Headers, true);
check('client: exposes the surface callers use (from/auth/storage)', {
    from: typeof configured.supabase.from,
    auth: typeof configured.supabase.auth?.getSession,
    storage: typeof configured.supabase.storage?.from,
}, { from: 'function', auth: 'function', storage: 'function' });

// ── 3. setHouseholdHeader ──────────────────────────────────────────────────────────────────────
console.log('\nsetHouseholdHeader');
const h = configured.supabase.rest.headers;
check('header: a fresh client carries no household id', h.get('x-household-id'), null);
check('header: attaching an id returns true', configured.setHouseholdHeader('hh-abc-123'), true);
check('header: the id is on the client', h.get('x-household-id'), 'hh-abc-123');
check('header: attaching a number is coerced to a string', configured.setHouseholdHeader(4242), true);
check('header: the coerced id is on the client', h.get('x-household-id'), '4242');
check('header: re-attaching replaces rather than appends', configured.setHouseholdHeader('hh-second'), true);
check('header: only the latest id survives', h.get('x-household-id'), 'hh-second');
// the documented claim: from() copies the headers per query
const queryWithHeader = configured.supabase.from('meal_plans').select('id');
check('query: a query built while an id is set carries it', queryWithHeader.headers.get('x-household-id'), 'hh-second');
check('header: clearing with null returns true', configured.setHouseholdHeader(null), true);
check('header: the id is gone from the client', h.get('x-household-id'), null);
check('query: a query built after clearing carries nothing', configured.supabase.from('meal_plans').select('id').headers.get('x-household-id'), null);
check('header: clearing with undefined returns true', configured.setHouseholdHeader(undefined), true);
check('header: clearing with an empty string returns true', configured.setHouseholdHeader(''), true);
check('header: an empty string is a clear, not an attach', h.get('x-household-id'), null);
check('header: the clear path leaves no key behind at all', [...h.keys()].some((k) => k.toLowerCase() === 'x-household-id'), false);

// unconfigured: the function must still be callable and must say it could not attach
const unconfigured = await loadWith({ VITE_SUPABASE_ANON_KEY: 'k' });
check('header: returns false when there is no client', unconfigured.setHouseholdHeader('hh-abc-123'), false);
check('header: still returns false for a clear when there is no client', unconfigured.setHouseholdHeader(null), false);

// ── 4. source-level properties the runtime cases cannot see ─────────────────────────────────────
// Comment-stripped, so a mention in prose cannot satisfy these (the class of vacuity this repo has
// hit twice: an assertion satisfied by the file's own documentation).
console.log('\nsource');
const raw = readFileSync(TARGET, 'utf8');
const code = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
check('source: reads Vite\'s import.meta.env', /import\.meta\.env/.test(code), true);
check('source: does not read process.env (client env boundary)', /process\.env/.test(code), false);
check('source: builds exactly one client', (code.match(/createClient\(/g) ?? []).length, 1);
check('source: the placeholder string is the one the gate compares', code.includes("'YOUR_SUPABASE_ANON_KEY'"), true);
check('source: exports the client', /export\s+const\s+supabase\s*=/.test(code), true);
check('source: exports setHouseholdHeader as the header setter', /export\s+function\s+setHouseholdHeader\s*\(/.test(code), true);

console.warn = realWarn;
console.log(`\n${failures === 0 ? 'ok' : 'FAIL'}: ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
