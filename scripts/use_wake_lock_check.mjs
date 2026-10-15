/**
 * useWakeLock checks — `node scripts/use_wake_lock_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/hooks/useWakeLock.js` is what keeps a phone screen alive while someone is cooking from it — the
 * one hook whose failure mode is invisible in a desk browser (the screen just sleeps mid-recipe) and
 * whose header states four promises that nothing asserted: feature-detect and no-op when unsupported,
 * hold the lock for the component's lifetime, re-acquire on `visibilitychange` because the browser
 * releases the lock on hide and never restores it, and swallow `request()` rejections (hidden document,
 * OS low-power mode) instead of throwing. It also carries the two cleanup branches that are easy to get
 * wrong and impossible to see: the unmount-while-in-flight release, and the listener removal.
 *
 * Measured, not assumed: the string `useWakeLock` appears **0** times across every
 * `ref × scripts/*_check.mjs` row gathered from all 41 remote refs (`main` + the 40 PR heads) — 41 refs,
 * 146 check-script files, 0 hits. Its nearest neighbours are `src/lib/unitPreference.js` (named by
 * `date_unit_helpers_check.mjs`) and the other hooks (`useRecipes`, `useSyncedDocument`, `useDishCuration`,
 * `useWeekPlanChat`); this hook was named by nothing.
 *
 * WHAT IT PINS (each one a live behaviour, not a hypothetical)
 *   1. **Unsupported is silent.** With no `wakeLock` on `navigator` — or no `navigator` at all — the hook
 *      reports `isSupported: false`, requests nothing, registers no listener, and its effect returns no
 *      cleanup.
 *   2. **The request is for `'screen'`, exactly once, on mount**, and only after the effect runs (not
 *      during render).
 *   3. **A held lock is reflected in state and has a `release` listener attached** to the sentinel the
 *      browser handed back.
 *   4. **The browser's own release is observed**: a `release` event flips `isActive` to false and clears
 *      the ref, which is what makes (5) possible.
 *   5. **`visibilitychange` re-acquires — but only when the document is visible AND no lock is held.**
 *      That pair of conditions is the whole point of the hook; either one alone is a bug (a re-request
 *      storm, or a lock that never comes back after a tab switch).
 *   6. **A rejected `request()` is caught, never thrown**, and leaves the hook able to try again on the
 *      next `visibilitychange`.
 *   7. **Unmount removes the listener, releases the sentinel and clears `isActive`** — no leaked
 *      listener, no lock held past the component.
 *   8. **Unmount while the request is still in flight releases the late sentinel immediately** and never
 *      reports `isActive: true`.
 *
 * HOW IT RUNS A HOOK WITH NO REACT AND NO DOM
 * The hook imports only `useEffect`/`useRef`/`useState` from `react`. `registerHooks` answers `react`
 * with a three-slot dispatcher (`mount()` below keeps a persistent `useState` slot array, persistent
 * `useRef` cells, and records effects instead of running them), and resolves the app's extensionless
 * relative imports the way Vite does. Because effects are recorded, the harness replays them explicitly
 * — which is how the unmount and in-flight cases can be driven by hand with no floating promises.
 * `navigator` and `document` are fakes installed per test; `document` keeps its listener registrations
 * so `visibilitychange` can be fired for real, and `navigator.wakeLock.request` is driven by a `mode`
 * switch (`resolve` / `reject` / `defer`). The hook under test is the real file on disk.
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * No React reconciler: effect re-run-on-deps-change is not modelled (the `[isSupported]` dep array is
 * ignored; effects are replayed deliberately), and no real browser, so the OS-level behaviour of the
 * Wake Lock API itself is out of reach. `setIsActive` after unmount is not treated as a warning — the
 * harness has no React to warn.
 *
 * NEGATIVE CONTROLS (each run in its own fresh scratch layout; the unmutated copy of the same layout is
 * 56 ok / 0 FAIL / exit 0. Measured, one run per control:
 *   mkdir ctl && cp -r src scripts ctl/   # edit ctl/src/hooks/useWakeLock.js, run THIS script from ctl
 *   - drop `&& !sentinelRef.current` from `handleVisibilityChange` → 55 ok / 1 FAIL, exit 1 ("a visible
 *     document with a lock held does NOT re-request": a re-request storm on every visibilitychange).
 *   - drop the `if (cancelled) { sentinel.release…(); return; }` guard → 53 ok / 3 FAIL, exit 1 (a lock
 *     held past unmount).
 *   - make the `catch` rethrow instead of `setIsActive(false)` → 52 ok / 4 FAIL, exit 1 (the rejection
 *     escapes to the process).
 *   - drop `document.removeEventListener('visibilitychange', …)` from the cleanup → 54 ok / 2 FAIL,
 *     exit 1 (a leaked listener that still re-acquires after unmount).
 *   - drop `sentinelRef.current = null;` from `handleRelease` → 52 ok / 4 FAIL, exit 1 (the lock comes
 *     back as unrecoverable: nothing re-acquires after a browser release).
 *   - replace `'wakeLock' in navigator` with `true` → 51 ok / 5 FAIL, exit 1 (an unsupported navigator is
 *     claimed supported, and a listener is registered on a hook that can never hold a lock).
 *
 * Plain script, non-zero exit on failure — same shape as `scripts/use_synced_document_check.mjs`.
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

const HOOK_PATH = join(HERE, '..', 'src', 'hooks', 'useWakeLock.js');
readFileSync(HOOK_PATH, 'utf8'); // fail loudly here if the module moved
const mod = await import(HOOK_PATH);
const { useWakeLock } = mod;

// ---------------------------------------------------------------------------
// a rejection that nobody handled is a failure of this suite, not of the harness

const unhandled = [];
process.on('unhandledRejection', (reason) => { unhandled.push(String(reason)); });

// ---------------------------------------------------------------------------
// fakes

/** The sentinel the browser hands back. Keeps its listeners so `release` can be fired for real. */
function makeSentinel() {
    const listeners = {};
    return {
        released: 0,
        addEventListener(type, handler) {
            listeners[type] = [...(listeners[type] ?? []), handler];
        },
        removeEventListener(type, handler) {
            listeners[type] = (listeners[type] ?? []).filter((h) => h !== handler);
        },
        release() {
            this.released += 1;
            return Promise.resolve();
        },
        emit(type) {
            for (const handler of listeners[type] ?? []) handler();
        },
        listenerCount: (type) => (listeners[type] ?? []).length,
    };
}

/** Install a fake `document` whose listener registrations can be fired and counted. */
function installDocument() {
    const listeners = {};
    const doc = {
        visibilityState: 'visible',
        addEventListener(type, handler) {
            listeners[type] = [...(listeners[type] ?? []), handler];
        },
        removeEventListener(type, handler) {
            listeners[type] = (listeners[type] ?? []).filter((h) => h !== handler);
        },
        fire(type) {
            for (const handler of listeners[type] ?? []) handler();
        },
        listenerCount: (type) => (listeners[type] ?? []).length,
    };
    globalThis.document = doc;
    return doc;
}

/**
 * Install a fake `navigator`. `present: false` removes the global entirely (Node 21+ ships a real
 * `navigator` object, so "unsupported" has to be distinguished from "absent"). `mode` drives
 * `request()`: `resolve` hands back a fresh sentinel, `reject` refuses, `defer` leaves the promise
 * unsettled until the test settles it by hand.
 */
function installNavigator({ present = true, supported = true, mode = 'resolve' } = {}) {
    const state = { calls: [], sentinels: [], deferred: [], mode };

    if (!present) {
        delete globalThis.navigator;
        return state;
    }

    const nav = {};
    if (supported) {
        nav.wakeLock = {
            request(type) {
                state.calls.push(type);
                if (state.mode === 'reject') return Promise.reject(new Error('NotAllowedError'));
                if (state.mode === 'defer') {
                    return new Promise((resolve, reject) => { state.deferred.push({ resolve, reject }); });
                }
                const sentinel = makeSentinel();
                state.sentinels.push(sentinel);
                return Promise.resolve(sentinel);
            },
        };
    }
    // Node ships `navigator` as a getter-only global, so it has to be redefined, not assigned.
    Object.defineProperty(globalThis, 'navigator', {
        value: nav, configurable: true, writable: true, enumerable: true,
    });
    return state;
}

const flush = async () => { for (let i = 0; i < 6; i += 1) await new Promise((r) => setImmediate(r)); };

/**
 * Minimal hook host: a persistent slot array for `useState`, persistent cells for `useRef`. Re-renders
 * synchronously on every state set so the hook's own closures observe their updates. Effects are
 * recorded per render and replayed deliberately.
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

    const render = () => {
        cursor = 0;
        globalThis.__mbUseState = stateHook;
        globalThis.__mbUseRef = refHook;
        globalThis.__mbEffectSink = [];
        out = hookFn();
        effects = globalThis.__mbEffectSink.slice();
    };

    render();

    return {
        get result() { return out; },
        get refs() { return refs; },
        /** The hook's only ref cell — index-independent, so a hook that adds a hook above it still works. */
        get ref() { return refs.find(Boolean); },
        effectCount: () => effects.length,
        /** Run every effect registered by the latest render, in order. */
        async runEffects() {
            for (const effect of effects.slice()) effect();
            await flush();
        },
        /** Run one effect and hand back its cleanup (the hook's only effect returns one). */
        async runEffect(i) {
            const cleanup = effects[i]();
            await flush();
            return cleanup;
        },
    };
}

/** Mount the hook against fresh fakes. */
function setup(opts = {}) {
    const doc = installDocument();
    const nav = installNavigator(opts);
    const h = mount(() => useWakeLock());
    return { doc, nav, h };
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
check('the only export is useWakeLock', Object.keys(mod).sort(), ['useWakeLock']);
check('useWakeLock is a function', typeof useWakeLock, 'function');

// ---------------------------------------------------------------------------
console.log('\nunsupported navigators no-op silently');
{
    const s = setup({ supported: false });
    check('isSupported is false when navigator has no wakeLock', s.h.result.isSupported, false);
    check('isActive starts false', s.h.result.isActive, false);
    check('the hook registers exactly one effect', s.h.effectCount(), 1);
    const cleanup = await s.h.runEffect(0);
    check('no wake lock is requested', s.nav.calls, []);
    check('no visibilitychange listener is registered', s.doc.listenerCount('visibilitychange'), 0);
    check('the effect returns no cleanup', cleanup, undefined);
}
{
    const s = setup({ present: false });
    check('with no navigator at all isSupported is false', s.h.result.isSupported, false);
    const cleanup = await s.h.runEffect(0);
    check('with no navigator at all nothing is requested', s.nav.calls, []);
    check('with no navigator at all no listener is registered', s.doc.listenerCount('visibilitychange'), 0);
    check('with no navigator at all the effect returns no cleanup', cleanup, undefined);
}

// ---------------------------------------------------------------------------
console.log('\nthe mount path');
{
    const s = setup({});
    check('isSupported is true when navigator.wakeLock exists', s.h.result.isSupported, true);
    check('nothing is requested before the effect runs', s.nav.calls, []);
    check('the surface is isActive + isSupported', Object.keys(s.h.result).sort(), ['isActive', 'isSupported']);
    check('the effect is the only one', s.h.effectCount(), 1);
}
{
    const s = setup({});
    await s.h.runEffects();
    check("the request is for the 'screen' lock", s.nav.calls, ['screen']);
    check('exactly one request is made on mount', s.nav.calls.length, 1);
    check('a held lock reports isActive true', s.h.result.isActive, true);
    check('the sentinel is kept in a ref', s.h.ref.current === s.nav.sentinels[0], true);
    check("a 'release' listener is attached to the sentinel", s.nav.sentinels[0].listenerCount('release'), 1);
    check('a visibilitychange listener is registered', s.doc.listenerCount('visibilitychange'), 1);
}

// ---------------------------------------------------------------------------
console.log('\nthe browser releases the lock — the hook notices');
{
    const s = setup({});
    await s.h.runEffects();
    s.nav.sentinels[0].emit('release');
    await flush();
    check('a release event clears isActive', s.h.result.isActive, false);
    check('a release event clears the ref', s.h.ref.current, null);
}

// ---------------------------------------------------------------------------
console.log('\nvisibilitychange re-acquires — and only when it should');
{
    const s = setup({});
    await s.h.runEffects();
    s.doc.visibilityState = 'visible';
    s.doc.fire('visibilitychange');
    await flush();
    check('a visible document with a lock held does NOT re-request', s.nav.calls.length, 1);
    check('isActive stays true', s.h.result.isActive, true);
}
{
    const s = setup({});
    await s.h.runEffects();
    s.nav.sentinels[0].emit('release');
    await flush();
    s.doc.visibilityState = 'visible';
    s.doc.fire('visibilitychange');
    await flush();
    check('a visible document with no lock re-requests', s.nav.calls.length, 2);
    check('the re-acquired lock reports isActive true', s.h.result.isActive, true);
    check('the new sentinel is the one now held', s.h.ref.current === s.nav.sentinels[1], true);
}
{
    const s = setup({});
    await s.h.runEffects();
    s.nav.sentinels[0].emit('release');
    await flush();
    s.doc.visibilityState = 'hidden';
    s.doc.fire('visibilitychange');
    await flush();
    check('a hidden document does NOT re-request', s.nav.calls.length, 1);
    check('isActive stays false while hidden', s.h.result.isActive, false);
}

// ---------------------------------------------------------------------------
console.log('\na rejected request is swallowed, not thrown');
{
    const s = setup({ mode: 'reject' });
    await s.h.runEffects();
    check('the request was still attempted', s.nav.calls, ['screen']);
    check('a rejected request leaves isActive false', s.h.result.isActive, false);
    check('a rejected request leaves the ref empty', s.h.ref.current, null);
    check('no rejection escaped to the process', unhandled, []);
    check('a visibilitychange listener is still registered after a rejection', s.doc.listenerCount('visibilitychange'), 1);
}
{
    const s = setup({ mode: 'reject' });
    await s.h.runEffects();
    s.nav.mode = 'resolve';
    s.doc.visibilityState = 'visible';
    s.doc.fire('visibilitychange');
    await flush();
    check('a later visibilitychange retries after a rejection', s.nav.calls.length, 2);
    check('the retry can succeed and report isActive true', s.h.result.isActive, true);
}

// ---------------------------------------------------------------------------
console.log('\nunmount');
{
    const s = setup({});
    const cleanup = await s.h.runEffect(0);
    check('a lock is held before unmount', s.h.result.isActive, true);
    cleanup();
    await flush();
    check('unmount removes the visibilitychange listener', s.doc.listenerCount('visibilitychange'), 0);
    check('unmount releases the sentinel', s.nav.sentinels[0].released, 1);
    check("unmount detaches the sentinel's release listener", s.nav.sentinels[0].listenerCount('release'), 0);
    check('unmount clears isActive', s.h.result.isActive, false);
    check('unmount clears the ref', s.h.ref.current, null);
}
{
    const s = setup({ supported: false });
    const cleanup = await s.h.runEffect(0);
    check('an unsupported hook hands back no cleanup to call', cleanup, undefined);
    check('an unsupported hook leaves no listener behind', s.doc.listenerCount('visibilitychange'), 0);
}
{
    const s = setup({});
    const cleanup = await s.h.runEffect(0);
    cleanup();
    await flush();
    s.doc.visibilityState = 'visible';
    s.doc.fire('visibilitychange');
    await flush();
    check('after unmount a visibilitychange does not re-request', s.nav.calls.length, 1);
    check('after unmount isActive stays false', s.h.result.isActive, false);
}
{
    const s = setup({ mode: 'defer' });
    const cleanup = await s.h.runEffect(0);
    check('an in-flight request leaves isActive false', s.h.result.isActive, false);
    cleanup();
    await flush();
    const late = makeSentinel();
    s.nav.deferred[0].resolve(late);
    await flush();
    check('a sentinel that arrives after unmount is released immediately', late.released, 1);
    check('a sentinel that arrives after unmount is never reported as active', s.h.result.isActive, false);
    check('a sentinel that arrives after unmount is not kept in the ref', s.h.ref.current, null);
    check('no rejection escaped to the process', unhandled, []);
}
{
    const s = setup({ mode: 'defer' });
    const cleanup = await s.h.runEffect(0);
    cleanup();
    await flush();
    s.nav.deferred[0].reject(new Error('NotAllowedError'));
    await flush();
    check('a rejection that lands after unmount does not escape', unhandled, []);
    check('a rejection that lands after unmount leaves isActive false', s.h.result.isActive, false);
}

// ---------------------------------------------------------------------------
console.log('\nno unhandled rejections for the whole run');
check('every rejection in this suite was handled', unhandled, []);

// ---------------------------------------------------------------------------
if (failures > 0) {
    console.log(`\n${failures} FAIL`);
    process.exit(1);
}
console.log('\nall checks passed');
