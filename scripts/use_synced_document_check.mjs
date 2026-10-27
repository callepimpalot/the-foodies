/**
 * useSyncedDocument checks — `node scripts/use_synced_document_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/hooks/useSyncedDocument.js` is TASK_07's storage contract in one file. PlanContext,
 * ShopContext and InventoryContext each delegate their whole persistence story to it: the synchronous
 * first paint from cache, the "local edit wins" reconciliation, the debounced write, the offline
 * parking-and-retry, and the one-shot legacy migration that must never lose the plan already on the
 * device. Its header states four numbered promises and its comments name two failure modes that cost a
 * whole debugging session to find (the StrictMode mount/cleanup re-arm, and "Supabase unreachable is
 * not an error state"). Nothing asserted any of it.
 *
 * Measured, not assumed: the string `useSyncedDocument` appears **0** times across every
 * `ref × scripts/*_check.mjs` row gathered from all 41 remote refs (`main` + the 39 PR heads + the
 * `origin/HEAD` symref) — 41 refs, 144 check-script files, 0 hits — so this is not "a suite that names
 * it and tests something else", it is no suite at all. The nearest neighbours, `documentCache.js` and
 * `planRows.js`, are named by `task07_check.mjs`; this hook is the layer above them and was named by
 * nothing.
 *
 * WHAT IT PINS (each one a live behaviour, not a hypothetical)
 *   1. **Seed precedence is cache → parked pending → fallback, decided synchronously during render.**
 *      A corrupt cache is the same as an empty one and must fall through, not throw.
 *   2. **The cache is written on every edit, before the network is touched.** That is what makes the
 *      Shop tab work in a supermarket basement.
 *   3. **Writes are debounced, then sent whole**, with the caller's opaque `removed` tokens accumulated
 *      and de-duplicated across edits and cleared only after a save that succeeded.
 *   4. **A failed save is parked under `<key>__pending`, not lost**, and the parked document — not the
 *      in-memory copy — is what the next retry sends.
 *   5. **Last-write-wins in the direction the header states:** a remote document replaces the cache only
 *      when this session has not edited anything; once `dirty`, the local edit wins and is pushed.
 *   6. **An unreachable remote is not an error state.** It reports `'offline'` and keeps the cache.
 *   7. **The mount effect re-arms on mount, not only disarms on unmount.** Under React 19 StrictMode
 *      (mount → cleanup → mount) a cleanup-only version leaves the guard false for the life of the page,
 *      and every later save sticks on `'syncing'`.
 *   8. **The legacy migration backs up before it does anything, never deletes the old keys, and is
 *      marked done only after a save is confirmed** — so a paused project cannot lose the plan.
 *
 * HOW IT RUNS A HOOK WITH NO REACT AND NO DOM
 * The hook imports only `useState`/`useEffect`/`useRef`/`useCallback` from `react` plus
 * `../lib/documentCache`. `registerHooks` answers `react` with a four-slot dispatcher (`mount()` below
 * keeps a persistent `useState` slot array, `useRef` cells and a `useCallback` pass-through) and resolves
 * the app's extensionless relative imports the way Vite does. Effects are **recorded, not run**: the
 * harness replays them explicitly, in registration order, so no assertion races a floating promise and
 * the StrictMode sequence can be driven by hand. `window`/`document` are fake objects installed per
 * test, and their listener registrations are kept so `'online'` and `'pagehide'` can be fired for real.
 * The hook under test is the real file on disk.
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * No React reconciler and no real browser: effect re-run-on-deps-change is not modelled (effects are
 * replayed deliberately), and `window.localStorage` is a Map-backed fake, so quota-exceeded behaviour is
 * only exercised through `documentCache`'s own try/catch. The real `setTimeout` is used, so the debounce
 * assertions wait on wall-clock time rather than a fake clock.
 *
 * NEGATIVE CONTROLS (all five run and red in the same scratch layout; the unmutated copy of that same
 * layout is 82 ok / 0 FAIL / exit 0):
 *   cp -r src scripts <scratch>/ctl   # edit <scratch>/ctl/src/hooks/useSyncedDocument.js, run THIS script
 *                                     # from <scratch>/ctl
 *   - swap the seed order so the parked document is read before the cache → 81 ok / 1 FAIL ("the cache
 *     wins over a parked document": got `{"from":"pending"}`, expected `{"from":"cache"}`).
 *   - drop `removedRef.current = [];` from the success path → 81 ok / 1 FAIL ("the removed list is
 *     cleared after a successful save": the three tokens come back).
 *   - replace `!dirtyRef.current` with `true` in the reconcile effect → 80 ok / 2 FAIL (a local edit is
 *     silently discarded and the remote document is pushed instead).
 *   - drop `mountedRef.current = true;` from the mount effect → 81 ok / 1 FAIL ("a save after a
 *     StrictMode remount still settles": status sticks on `"syncing"`).
 *   - drop `parkPending(...)` from the save failure path → 80 ok / 2 FAIL (nothing is parked).
 *
 * The other three scripts this branch carries are unchanged and still green: migration_reapply_check
 * 35, recipe_deletion_check 37, task07_check 24.
 *
 * Plain script, non-zero exit on failure — same shape as `scripts/task07_check.mjs`.
 */
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ---------------------------------------------------------------------------
// module interception

const REACT_STUB = `
export function useState(init) { return globalThis.__mbUseState(init); }
export function useEffect(cb) { globalThis.__mbEffectSink.push(cb); }
export function useRef(init) { return globalThis.__mbUseRef(init); }
export function useCallback(fn) { return globalThis.__mbUseCallback(fn); }
`;

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === 'react') return { url: 'mb:react', format: 'module', shortCircuit: true };
        // The app's own imports are extensionless, which Vite resolves at build time and bare Node does
        // not — resolve them for this process only.
        if (specifier.startsWith('.') && !/\.[cm]?js$/.test(specifier)) {
            return nextResolve(`${specifier}.js`, context);
        }
        return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
        if (url === 'mb:react') return { format: 'module', source: REACT_STUB, shortCircuit: true };
        return nextLoad(url, context);
    },
});

const HERE = dirname(fileURLToPath(import.meta.url));

const HOOK_PATH = join(HERE, '..', 'src', 'hooks', 'useSyncedDocument.js');
readFileSync(HOOK_PATH, 'utf8'); // fail loudly here if the module moved
const mod = await import(HOOK_PATH);
const { useSyncedDocument } = mod;

// ---------------------------------------------------------------------------
// fixtures and fakes

const CACHE_KEY = 'meal_buddy_test_doc';
const PENDING_KEY = `${CACHE_KEY}__pending`;
const FLAG_KEY = `${CACHE_KEY}__migrated_v1`;
const HOUSEHOLD = 'hh-test-1';
const FALLBACK = { plan: {}, confirmed: false };

/** Map-backed localStorage. `raw` lets a test plant bytes that are not JSON. */
function fakeStorage(seed = {}) {
    const map = new Map(Object.entries(seed));
    return {
        map,
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => { map.set(k, String(v)); },
        removeItem: (k) => { map.delete(k); },
        has: (k) => map.has(k),
        keys: () => [...map.keys()],
    };
}

/** Install fake `window`/`document`, and keep every listener so they can be fired by hand. */
function installEnv(storage) {
    const listeners = { window: {}, document: {} };
    const record = (scope) => ({
        addEventListener: (type, handler) => {
            listeners[scope][type] = [...(listeners[scope][type] ?? []), handler];
        },
        removeEventListener: (type, handler) => {
            listeners[scope][type] = (listeners[scope][type] ?? []).filter((h) => h !== handler);
        },
    });

    globalThis.window = { localStorage: storage, ...record('window') };
    globalThis.document = { visibilityState: 'visible', ...record('document') };

    return {
        fire(scope, type) {
            for (const handler of listeners[scope][type] ?? []) handler();
        },
        listenerCount: (scope, type) => (listeners[scope][type] ?? []).length,
        uninstall() {
            delete globalThis.window;
            delete globalThis.document;
        },
    };
}

const flush = async () => { for (let i = 0; i < 6; i += 1) await new Promise((r) => setImmediate(r)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Minimal hook host: a persistent slot array for `useState`, persistent cells for `useRef`, and a
 * `useCallback` pass-through. Re-renders synchronously on every state set so the hook's own closures
 * observe their updates. Effects are recorded per render and replayed deliberately.
 */
function mount(hookFn) {
    const states = [];
    const refs = [];
    let out;
    let cursor = 0;
    let effects = [];

    const stateHook = (init) => {
        const idx = cursor++;
        if (idx >= states.length) states[idx] = typeof init === 'function' ? init() : init;
        const set = (value) => {
            const next = typeof value === 'function' ? value(states[idx]) : value;
            if (Object.is(next, states[idx])) return;
            states[idx] = next;
            render();
        };
        return [states[idx], set];
    };
    const refHook = (init) => {
        const idx = cursor++;
        if (idx >= refs.length) refs[idx] = { current: init };
        return refs[idx];
    };
    const cbHook = (fn) => { cursor++; return fn; };

    // Re-bound on every render so a second mount() in this process cannot steal the globals from the
    // first, and the first mount's own re-renders keep using its own slots.
    const render = () => {
        cursor = 0;
        globalThis.__mbUseState = stateHook;
        globalThis.__mbUseRef = refHook;
        globalThis.__mbUseCallback = cbHook;
        globalThis.__mbEffectSink = [];
        out = hookFn();
        effects = globalThis.__mbEffectSink.slice();
    };

    render();

    return {
        get result() { return out; },
        get states() { return states; },
        effectCount: () => effects.length,
        /** Run every effect registered by the latest render, in order. */
        async runEffects() {
            for (const effect of effects.slice()) effect();
            await flush();
        },
        /** Run one effect and hand back its cleanup (the hook's effects all return one). */
        async runEffect(i) {
            const cleanup = effects[i]();
            await flush();
            return cleanup;
        },
    };
}

// ---------------------------------------------------------------------------
// a mount helper that records what the hook sent

/**
 * Mount the hook with a recording `saveRemote`/`loadRemote`.
 * `opts.remote` is either a function (called) or a value (returned); throwing it reaches the
 * unreachable path. `opts.failSaves` makes every save reject.
 */
function setup({ seed = {}, options = {}, remote = null, failSaves = false, failLoads = false, noWindow = false } = {}) {
    const storage = fakeStorage(seed);
    const env = noWindow ? { fire() {}, listenerCount: () => 0, uninstall() {} } : installEnv(storage);

    const saves = [];
    const loads = [];
    let failing = failSaves;

    const api = {
        storage,
        env,
        saves,
        loads,
        setFailing(value) { failing = value; },
        saveRemote: async (doc, opts) => {
            saves.push({ doc, opts });
            if (failing) throw new Error('Failed to fetch');
        },
        loadRemote: async () => {
            loads.push(true);
            if (failLoads) throw new Error('Failed to fetch');
            return typeof remote === 'function' ? remote() : remote;
        },
    };

    const h = mount(() => useSyncedDocument({
        cacheKey: CACHE_KEY,
        householdId: HOUSEHOLD,
        loadRemote: api.loadRemote,
        saveRemote: api.saveRemote,
        fallback: { ...FALLBACK },
        debounceMs: 5,
        ...options,
    }));

    return { ...api, h };
}

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

// ---------------------------------------------------------------------------
console.log('\nmodule surface');
check('the only export is useSyncedDocument', Object.keys(mod).sort(), ['useSyncedDocument']);
check('useSyncedDocument is a function', typeof useSyncedDocument, 'function');

// ---------------------------------------------------------------------------
console.log('\nthe synchronous seed — cache, then parked document, then fallback');
{
    const s = setup({ seed: { [CACHE_KEY]: JSON.stringify({ from: 'cache' }), [PENDING_KEY]: JSON.stringify({ at: 'x', value: { from: 'pending' } }) } });
    check('the cache wins over a parked document', s.h.result.value, { from: 'cache' });
    check('status starts idle — no loading flash', s.h.result.status, 'idle');
    check('rowsRef starts as an empty array', s.h.result.rowsRef.current, []);
    check('the exposed surface is the four members the contexts use',
        Object.keys(s.h.result).sort(), ['replace', 'rowsRef', 'status', 'update', 'value']);
    check('the cache is not rewritten on mount', s.storage.getItem(CACHE_KEY), JSON.stringify({ from: 'cache' }));
}
{
    const s = setup({ seed: { [PENDING_KEY]: JSON.stringify({ at: 'x', value: { from: 'pending' } }) } });
    check('a parked document is used when there is no cache', s.h.result.value, { from: 'pending' });
}
{
    const s = setup({});
    check('the fallback is used when there is neither', s.h.result.value, FALLBACK);
    check('the fallback is not written to the cache', s.storage.has(CACHE_KEY), false);
}
{
    const s = setup({ seed: { [CACHE_KEY]: '{not json', [PENDING_KEY]: JSON.stringify({ at: 'x', value: { from: 'pending' } }) } });
    check('a corrupt cache is the same as an empty one, not a throw', s.h.result.value, { from: 'pending' });
}
{
    const s = setup({ seed: { [CACHE_KEY]: 'null' } });
    check('a cache holding JSON null falls through to the fallback', s.h.result.value, FALLBACK);
}
{
    const s = setup({ seed: { other_key: JSON.stringify({ from: 'other' }) } });
    check('another cache key is not mistaken for this document', s.h.result.value, FALLBACK);
}
{
    const s = setup({ noWindow: true });
    check('with no window at all the fallback is served and nothing throws', s.h.result.value, FALLBACK);
}

// ---------------------------------------------------------------------------
console.log('\nedits: the cache is written first, the network second');
{
    const s = setup({});
    await s.h.runEffects();

    check('the mount registers five effects', s.h.effectCount(), 5);
    check('reconciling with no remote document leaves the fallback in place', s.h.result.value, FALLBACK);
    check('an empty remote is not an error', s.h.result.status, 'idle');

    s.h.result.update({ plan: { '2026-10-15': { recipeId: 'r1' } } });
    check('the cache is written synchronously, before any network call', JSON.parse(s.storage.getItem(CACHE_KEY)), { plan: { '2026-10-15': { recipeId: 'r1' } } });
    check('the in-memory value is updated immediately', s.h.result.value, { plan: { '2026-10-15': { recipeId: 'r1' } } });
    check('nothing is sent before the debounce elapses', s.saves.length, 0);

    await sleep(30);
    check('exactly one save fires after the debounce', s.saves.length, 1);
    check('the save carries the whole document', s.saves[0].doc, { plan: { '2026-10-15': { recipeId: 'r1' } } });
    check('the save carries the known rows and the removed list', s.saves[0].opts, { rows: [], removed: [] });
    check('status settles back to idle', s.h.result.status, 'idle');

    s.h.result.update((prev) => ({ ...prev, confirmed: true }));
    check('a function updater is applied to the previous value', s.h.result.value, { plan: { '2026-10-15': { recipeId: 'r1' } }, confirmed: true });
    await sleep(30);
    check('the second edit is saved too', s.saves.length, 2);
}

// ---------------------------------------------------------------------------
console.log('\nremoved tokens accumulate, de-duplicate, and clear only on success');
{
    const s = setup({});
    await s.h.runEffects();

    s.h.result.update({ n: 1 }, { removed: ['date:2026-10-01', 'date:2026-10-02'] });
    s.h.result.update({ n: 2 }, { removed: ['date:2026-10-02', 'date:2026-10-03'] });
    s.h.result.update({ n: 3 }, { removed: [] });
    await sleep(30);

    check('one save, not three — the debounce coalesces', s.saves.length, 1);
    check('tokens from every edit are accumulated and de-duplicated',
        s.saves[0].opts.removed, ['date:2026-10-01', 'date:2026-10-02', 'date:2026-10-03']);

    s.h.result.update({ n: 4 });
    await sleep(30);
    check('the removed list is cleared after a successful save', s.saves[1].opts.removed, []);
    check('and the next save still fires', s.saves.length, 2);
}

// ---------------------------------------------------------------------------
console.log('\nreconciliation — the remote document is applied only when nothing local is pending');
{
    const s = setup({ remote: { rows: [{ id: 'row-1' }], value: { from: 'remote' } } });
    await s.h.runEffects();

    check('the remote document replaces the cache', s.h.result.value, { from: 'remote' });
    check('the remote document is written through to the cache', JSON.parse(s.storage.getItem(CACHE_KEY)), { from: 'remote' });
    check('the remote rows are remembered for the next save', s.h.result.rowsRef.current, [{ id: 'row-1' }]);
    check('status is idle once reconciled', s.h.result.status, 'idle');

    s.h.result.update({ from: 'local' });
    await sleep(30);
    check('the rows the last load saw are handed to the save', s.saves[0].opts.rows, [{ id: 'row-1' }]);
}
{
    const s = setup({ seed: { [CACHE_KEY]: JSON.stringify({ from: 'cache' }) }, remote: { value: { from: 'remote' } } });
    s.h.result.update({ from: 'local' });
    await s.h.runEffects();

    check('a local edit made before the remote arrived is not overwritten', s.h.result.value, { from: 'local' });
    await sleep(30);
    check('and it is pushed instead', s.saves.length, 1);
    check('the pushed document is the local one', s.saves[0].doc, { from: 'local' });
}

// ---------------------------------------------------------------------------
console.log('\nan unreachable remote is not an error state');
{
    const s = setup({ seed: { [CACHE_KEY]: JSON.stringify({ from: 'cache' }) }, failLoads: true });
    await s.h.runEffects();

    check('the cache is kept', s.h.result.value, { from: 'cache' });
    check('the status says offline, not error', s.h.result.status, 'offline');
    check('the cache on disk is untouched', JSON.parse(s.storage.getItem(CACHE_KEY)), { from: 'cache' });
}

// ---------------------------------------------------------------------------
console.log('\na failed save is parked, and the parked copy is what the retry sends');
{
    const s = setup({ failSaves: true });
    await s.h.runEffects();

    s.h.result.update({ plan: { '2026-10-15': 'r1' } });
    await sleep(30);

    check('the save was attempted', s.saves.length, 1);
    check('status reports offline', s.h.result.status, 'offline');
    check('the document is parked under <key>__pending', JSON.parse(s.storage.getItem(PENDING_KEY))?.value, { plan: { '2026-10-15': 'r1' } });
    check('the parked copy carries a timestamp', typeof JSON.parse(s.storage.getItem(PENDING_KEY))?.at, 'string');
    check('the cache still holds the edit', JSON.parse(s.storage.getItem(CACHE_KEY)), { plan: { '2026-10-15': 'r1' } });

    s.setFailing(false);
    s.env.fire('window', 'online');
    await sleep(30);

    check('coming back online retries the save', s.saves.length, 2);
    check('the retry sends the current document', s.saves[1].doc, { plan: { '2026-10-15': 'r1' } });
    check('the parked copy is cleared once the save lands', s.storage.has(PENDING_KEY), false);
    check('status returns to idle', s.h.result.status, 'idle');
}
{
    // Not dirty, but something from a previous session is still parked: coming online must adopt it.
    const s = setup({ seed: { [PENDING_KEY]: JSON.stringify({ at: 'x', value: { from: 'parked' } }) } });
    await s.h.runEffects();

    s.env.fire('window', 'online');
    await sleep(30);

    check('a parked document from a previous session is pushed on reconnect', s.saves.length, 1);
    check('and it is the parked one', s.saves[0].doc, { from: 'parked' });
}
{
    // A queued save must not be lost by closing the tab.
    const s = setup({});
    await s.h.runEffects();

    check('pagehide is listened for', s.env.listenerCount('window', 'pagehide'), 1);
    s.h.result.update({ n: 9 });
    s.env.fire('window', 'pagehide');
    check('a dirty document is parked when the page goes away', JSON.parse(s.storage.getItem(PENDING_KEY))?.value, { n: 9 });
    await sleep(30);
}
{
    // Not dirty: closing the tab must not park anything.
    const s = setup({});
    await s.h.runEffects();
    s.env.fire('window', 'pagehide');
    check('an untouched document is not parked', s.storage.has(PENDING_KEY), false);
}

// ---------------------------------------------------------------------------
console.log('\nreplace() — adopting a document that came from somewhere else');
{
    const s = setup({});
    await s.h.runEffects();

    s.h.result.replace({ from: 'legacy' });
    check('the value is adopted', s.h.result.value, { from: 'legacy' });
    check('and written to the cache', JSON.parse(s.storage.getItem(CACHE_KEY)), { from: 'legacy' });
    await sleep(30);
    check('a dirty replace is pushed', s.saves.length, 1);
}
{
    const s = setup({});
    await s.h.runEffects();

    s.h.result.replace({ from: 'remote' }, { dirty: false });
    check('a clean replace is adopted', s.h.result.value, { from: 'remote' });
    await sleep(30);
    check('a clean replace is not pushed', s.saves.length, 0);
}

// ---------------------------------------------------------------------------
console.log('\nno household — local only, and nothing is sent');
{
    const s = setup({ options: { householdId: null } });
    await s.h.runEffects();

    check('the remote is not loaded without a household', s.loads.length, 0);
    check('status stays idle', s.h.result.status, 'idle');

    s.h.result.update({ n: 1 });
    await sleep(30);
    check('the edit is still cached', JSON.parse(s.storage.getItem(CACHE_KEY)), { n: 1 });
    check('but nothing is sent', s.saves.length, 0);
}

// ---------------------------------------------------------------------------
console.log('\nReact 19 StrictMode — the mount effect must re-arm, not only disarm');
{
    const s = setup({});
    const cleanup = await s.h.runEffect(0);      // mount
    check('the mount effect returns a cleanup', typeof cleanup, 'function');
    cleanup();                                    // StrictMode unmount
    await s.h.runEffect(0);                       // StrictMode remount

    s.h.result.update({ n: 1 });
    await sleep(30);

    check('a save after a StrictMode remount still settles', s.h.result.status, 'idle');
    check('and the save really happened', s.saves.length, 1);
}

// ---------------------------------------------------------------------------
console.log('\nthe one-shot legacy migration');
{
    const legacyPlan = JSON.stringify({ '2026-10-01': { recipeId: 'old' } });
    const legacyConfirmed = JSON.stringify(true);
    const s = setup({
        seed: { meal_buddy_plan: legacyPlan, meal_buddy_confirmed: legacyConfirmed },
        options: {
            legacyKeys: ['meal_buddy_plan', 'meal_buddy_confirmed'],
            fromLegacy: (legacy) => ({ plan: legacy?.meal_buddy_plan ?? {}, confirmed: legacy?.meal_buddy_confirmed === true }),
        },
    });
    await s.h.runEffects();
    await sleep(30);

    check('the legacy data is backed up before anything else', JSON.parse(s.storage.getItem('meal_buddy_plan__backup_v1')), { '2026-10-01': { recipeId: 'old' } });
    check('the migrated document is committed', s.h.result.value, { plan: { '2026-10-01': { recipeId: 'old' } }, confirmed: true });
    check('it is written to the cache', JSON.parse(s.storage.getItem(CACHE_KEY)), { plan: { '2026-10-01': { recipeId: 'old' } }, confirmed: true });
    check('it is pushed to the remote', s.saves.length, 1);
    check('the push carries the migrated document', s.saves[0].doc, { plan: { '2026-10-01': { recipeId: 'old' } }, confirmed: true });
    check('the migration is marked done only after the save landed', typeof JSON.parse(s.storage.getItem(FLAG_KEY))?.at, 'string');
    check('the legacy keys are deliberately NOT deleted', [s.storage.has('meal_buddy_plan'), s.storage.has('meal_buddy_confirmed')], [true, true]);
    check('the legacy keys are not rewritten either', s.storage.getItem('meal_buddy_plan'), legacyPlan);
}
{
    // A paused project: the save fails, so the migration must not be marked done.
    const s = setup({
        seed: { meal_buddy_plan: JSON.stringify({ '2026-10-01': 'old' }) },
        failSaves: true,
        options: {
            legacyKeys: ['meal_buddy_plan'],
            fromLegacy: (legacy) => ({ plan: legacy?.meal_buddy_plan ?? {} }),
        },
    });
    await s.h.runEffects();
    await sleep(30);

    check('a failed migration save is parked', JSON.parse(s.storage.getItem(PENDING_KEY))?.value, { plan: { '2026-10-01': 'old' } });
    check('and is not marked as done', s.storage.has(FLAG_KEY), false);
    check('the legacy key survives for the next attempt', s.storage.has('meal_buddy_plan'), true);
}
{
    // Already migrated: the flag stops a second run from overwriting live data with a stale copy.
    const s = setup({
        seed: { [FLAG_KEY]: JSON.stringify({ at: 'earlier' }), meal_buddy_plan: JSON.stringify({ stale: true }) },
        options: {
            legacyKeys: ['meal_buddy_plan'],
            fromLegacy: (legacy) => ({ plan: legacy?.meal_buddy_plan ?? {} }),
        },
    });
    await s.h.runEffects();
    await sleep(30);

    check('a second run does not re-migrate', s.saves.length, 0);
    check('and does not overwrite the cache with the stale copy', s.storage.has(CACHE_KEY), false);
}
{
    // No legacy data at all: the flag is still written, so the migration never runs again.
    const s = setup({
        options: {
            legacyKeys: ['meal_buddy_plan'],
            fromLegacy: (legacy) => (legacy?.meal_buddy_plan ? { plan: legacy.meal_buddy_plan } : null),
        },
    });
    await s.h.runEffects();
    await sleep(30);

    check('nothing is pushed when there is nothing to migrate', s.saves.length, 0);
    check('but the migration is marked done', typeof JSON.parse(s.storage.getItem(FLAG_KEY))?.at, 'string');
}

// ---------------------------------------------------------------------------
console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
