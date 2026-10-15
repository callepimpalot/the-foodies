/**
 * useUnitPreference checks — `node scripts/use_unit_preference_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/hooks/useUnitPreference.js` is the React wrapper behind the metric/imperial toggle in
 * `CaptureView` — the switch that decides which units every AI-produced ingredient list comes back in.
 * It is three lines, and each of those lines is a promise nothing asserted: that the persisted
 * preference is read **once at mount** (a lazy `useState` initializer, not an eager call on every
 * render), that the value put into state is the **normalised, persisted** one rather than the argument
 * the caller passed, and that a storage layer which refuses to read or write (private mode, quota,
 * a browser with no `localStorage` at all) degrades to metric **without throwing** — the toggle is
 * rendered on the capture screen, so a throw here is a blank screen while someone is trying to save a
 * recipe.
 *
 * Measured, not assumed: the string `useUnitPreference` appears **0** times across every
 * `ref × scripts/*_check.mjs` row gathered from all 42 remote refs (`main` + the 41 PR heads) — 42 refs,
 * 149 check-script files, 0 hits. The `src/lib/unitPreference.js` module it wraps *is* named (by
 * `date_unit_helpers_check.mjs`, `dish_curation_check.mjs`, `pantry_items_check.mjs`,
 * `recipe_extraction_check.mjs`, `week_plan_chat_check.mjs`, `gemini_client_check.mjs`), but a lowercase
 * `unitPreference` is not a substring of the camel-cased `useUnitPreference`, so those hits are the lib,
 * not this hook. This hook was named by nothing.
 *
 * WHAT IT PINS (each one a live behaviour, not a hypothetical)
 *   1. **The mount read is lazy and happens once.** `useState(getUnitSystem)` reads storage at mount —
 *      and *only* at mount: a later re-render (triggered by the toggle itself) must not re-read.
 *   2. **The stored value is normalised on read.** `'imperial'` → `'imperial'`; anything else
 *      (`'metric'`, an empty store, `'furlongs'`, a non-string) → `'metric'`. The toggle's two buttons
 *      compare against exactly those two strings.
 *   3. **`setUnitSystem` persists under `meal_buddy_unit_system` and reflects the *normalised* value**
 *      — `setUnitSystem('furlongs')` leaves the hook on `'metric'`, not on `'furlongs'`. That is the
 *      difference between `setUnitSystemState(persistUnitSystem(value))` and `setUnitSystemState(value)`,
 *      and it is invisible until something passes a value the storage layer rejects.
 *   4. **Storage failures degrade, they do not throw.** A throwing `getItem` still mounts on `'metric'`;
 *      a throwing `setItem` still flips the in-memory value (the toggle works for this session even
 *      when it cannot persist), and nothing escapes.
 *   5. **No `localStorage` global at all** is the same story — mount and toggle both work.
 *   6. **The surface is exactly `{ unitSystem, setUnitSystem }`**, and `setUnitSystem` is a void handler
 *      (it is passed straight to `onClick`), returning `undefined`.
 *
 * HOW IT RUNS A HOOK WITH NO REACT AND NO DOM
 * The hook imports only `useState` from `react` (no effects, no refs). `registerHooks` answers `react`
 * with a one-slot dispatcher that keeps a persistent state array and re-renders synchronously on every
 * set, so the hook's own closures observe their updates, and resolves the app's extensionless relative
 * imports the way Vite does. `localStorage` is a fake installed per test with counters and `mode`
 * switches (`ok` / `getThrows` / `setThrows` / `absent`) — the counters are what make promise (1)
 * testable rather than merely plausible. The hook under test is the real file on disk.
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * No React reconciler: `useState` bail-out semantics are approximated by an `Object.is` guard, and
 * concurrent/strict-mode double-render is not modelled. No real browser, so the browser's own
 * `localStorage` behaviour (origin partitioning, cross-tab `storage` events) is out of reach — the
 * suite pins what the *app* promises about storage, not what the browser promises about it.
 *
 * NEGATIVE CONTROLS (each run in its own fresh scratch layout; the unmutated copy of the same layout is
 * 36 ok / 0 FAIL / exit 0. Measured, one run per control:
 *   mkdir ctl && cp -r src scripts ctl/   # edit one file under ctl/, run THIS script from ctl
 *   - `setUnitSystemState(persistUnitSystem(value))` → `setUnitSystemState(value)` → 25 ok / 11 FAIL,
 *     exit 1 (the raw argument reaches state and `persistUnitSystem` is never called at all: `'furlongs'`
 *     and `null` are held as-is, the toggle's two comparisons are both false, and nothing is persisted).
 *   - `useState(getUnitSystem)` → `useState('metric')` → 30 ok / 6 FAIL, exit 1 (the persisted
 *     preference is ignored: a stored `'imperial'` mounts on `'metric'`, and storage is never read).
 *   - `useState(getUnitSystem)` → `useState(getUnitSystem())` → 35 ok / 1 FAIL, exit 1 (the read is
 *     eager, so every re-render re-reads storage — the "a toggle does not re-read storage" assertion).
 *   - `STORAGE_KEY` in `src/lib/unitPreference.js` → `'unit_system'` → 29 ok / 7 FAIL, exit 1 (the hook
 *     silently stops finding the preference it wrote under the old key).
 *
 * Plain script, non-zero exit on failure — same shape as `scripts/use_wake_lock_check.mjs`.
 */
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ---------------------------------------------------------------------------
// module interception

const REACT_STUB = `
export function useState(init) { return globalThis.__mbUseState(init); }
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

const HOOK_PATH = join(HERE, '..', 'src', 'hooks', 'useUnitPreference.js');
readFileSync(HOOK_PATH, 'utf8'); // fail loudly here if the module moved
const mod = await import(HOOK_PATH);
const { useUnitPreference } = mod;

// The key the preference is persisted under. Pinned as a literal on purpose: the toggle writes it in one
// module and reads it in another, so a rename in either one has to break this suite.
const STORAGE_KEY = 'meal_buddy_unit_system';

// ---------------------------------------------------------------------------
// fakes

/**
 * Install a fake `localStorage`. `mode` drives it: `ok` (a working store), `getThrows`, `setThrows`,
 * `absent` (no global at all). The counters are what let the suite assert *how often* storage is read,
 * which is the only way to tell a lazy initializer from an eager one.
 */
function installStorage({ mode = 'ok', seed = {} } = {}) {
    const state = { store: { ...seed }, gets: 0, sets: 0, keysSet: [] };

    if (mode === 'absent') {
        try {
            delete globalThis.localStorage;
        } catch {
            // some runtimes make the global non-configurable; fall through to the defineProperty below
        }
        if (typeof globalThis.localStorage !== 'undefined') {
            Object.defineProperty(globalThis, 'localStorage', {
                value: undefined, configurable: true, writable: true,
            });
        }
        return state;
    }

    const ls = {
        getItem(key) {
            state.gets += 1;
            if (mode === 'getThrows') throw new Error('SecurityError');
            return Object.prototype.hasOwnProperty.call(state.store, key) ? state.store[key] : null;
        },
        setItem(key, value) {
            state.sets += 1;
            if (mode === 'setThrows') throw new Error('QuotaExceededError');
            state.keysSet.push(key);
            state.store[key] = String(value);
        },
        removeItem(key) { delete state.store[key]; },
        clear() { state.store = {}; },
    };
    Object.defineProperty(globalThis, 'localStorage', {
        value: ls, configurable: true, writable: true, enumerable: true,
    });
    return state;
}

/**
 * Minimal hook host: a persistent slot array for `useState`, re-rendering synchronously on every set so
 * the hook's own closures observe their updates. There are no effects and no refs in this hook, so none
 * are modelled.
 */
function mount(hookFn) {
    const states = [];
    let out;
    let cursor = 0;

    const stateHook = (init) => {
        const idx = cursor++;
        // React calls a function initializer on the FIRST render only — this is the behaviour under test.
        if (idx >= states.length) states[idx] = typeof init === 'function' ? init() : init;
        const set = (value) => {
            const next = typeof value === 'function' ? value(states[idx]) : value;
            if (Object.is(next, states[idx])) return;
            states[idx] = next;
            render();
        };
        return [states[idx], set];
    };

    const render = () => {
        cursor = 0;
        globalThis.__mbUseState = stateHook;
        out = hookFn();
    };

    render();

    return { get result() { return out; } };
}

/** Mount the hook against a fresh fake storage layer. */
function setup(opts = {}) {
    const storage = installStorage(opts);
    const h = mount(() => useUnitPreference());
    return { storage, h };
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
check('the only export is useUnitPreference', Object.keys(mod).sort(), ['useUnitPreference']);
check('useUnitPreference is a function', typeof useUnitPreference, 'function');

// ---------------------------------------------------------------------------
console.log('\nthe mount read');
{
    const s = setup({ seed: { [STORAGE_KEY]: 'imperial' } });
    check('a stored imperial preference is read back', s.h.result.unitSystem, 'imperial');
    check('the mount read touched storage exactly once', s.storage.gets, 1);
}
{
    const s = setup({ seed: { [STORAGE_KEY]: 'metric' } });
    check('a stored metric preference is read back', s.h.result.unitSystem, 'metric');
}
{
    const s = setup({});
    check('an empty store mounts on metric', s.h.result.unitSystem, 'metric');
    check('the read still happened on an empty store', s.storage.gets, 1);
}
{
    const s = setup({ seed: { [STORAGE_KEY]: 'furlongs' } });
    check('a stored junk value is normalised to metric on read', s.h.result.unitSystem, 'metric');
}
{
    const s = setup({ seed: { [STORAGE_KEY]: 'IMPERIAL' } });
    check('the stored value is compared exactly, not case-insensitively', s.h.result.unitSystem, 'metric');
}

// ---------------------------------------------------------------------------
console.log('\nthe read is lazy and mount-only');
{
    const s = setup({ seed: { [STORAGE_KEY]: 'metric' } });
    check('the surface is unitSystem + setUnitSystem', Object.keys(s.h.result).sort(), ['setUnitSystem', 'unitSystem']);
    s.h.result.setUnitSystem('imperial');
    check('a toggle does not re-read storage', s.storage.gets, 1);
    check('a toggle writes storage once', s.storage.sets, 1);
}
{
    const s = setup({ seed: { [STORAGE_KEY]: 'metric' } });
    // Someone changes the preference in another tab: this hook holds its mount-time value until remount.
    s.storage.store[STORAGE_KEY] = 'imperial';
    s.h.result.setUnitSystem('metric');
    check('an external write does not leak into a live hook', s.h.result.unitSystem, 'metric');
    const again = setup({ seed: { [STORAGE_KEY]: 'imperial' } });
    check('a fresh mount does pick the external value up', again.h.result.unitSystem, 'imperial');
}

// ---------------------------------------------------------------------------
console.log('\nsetUnitSystem persists and reflects the normalised value');
{
    const s = setup({});
    s.h.result.setUnitSystem('imperial');
    check('the state flips to imperial', s.h.result.unitSystem, 'imperial');
    check('it is persisted under the app key', s.storage.store[STORAGE_KEY], 'imperial');
    check('no other key is written', s.storage.keysSet, [STORAGE_KEY]);
}
{
    const s = setup({ seed: { [STORAGE_KEY]: 'imperial' } });
    s.h.result.setUnitSystem('metric');
    check('the state flips back to metric', s.h.result.unitSystem, 'metric');
    check('metric is persisted too', s.storage.store[STORAGE_KEY], 'metric');
}
{
    const s = setup({ seed: { [STORAGE_KEY]: 'imperial' } });
    s.h.result.setUnitSystem('furlongs');
    check('a junk argument is normalised before it reaches state', s.h.result.unitSystem, 'metric');
    check('a junk argument is normalised before it reaches storage', s.storage.store[STORAGE_KEY], 'metric');
}
{
    const s = setup({});
    s.h.result.setUnitSystem(undefined);
    check('undefined normalises to metric', s.h.result.unitSystem, 'metric');
    s.h.result.setUnitSystem(null);
    check('null normalises to metric', s.h.result.unitSystem, 'metric');
    s.h.result.setUnitSystem({ imperial: true });
    check('a non-string normalises to metric', s.h.result.unitSystem, 'metric');
}
{
    const s = setup({});
    const returned = s.h.result.setUnitSystem('imperial');
    check('setUnitSystem is a void handler (it is passed to onClick)', returned, undefined);
}

// ---------------------------------------------------------------------------
console.log('\nstorage that refuses to read');
{
    const s = setup({ mode: 'getThrows' });
    check('a throwing getItem still mounts on metric', s.h.result.unitSystem, 'metric');
    check('the read was attempted', s.storage.gets, 1);
    s.h.result.setUnitSystem('imperial');
    check('the toggle still works when reads throw', s.h.result.unitSystem, 'imperial');
    check('the write still lands when reads throw', s.storage.store[STORAGE_KEY], 'imperial');
}

// ---------------------------------------------------------------------------
console.log('\nstorage that refuses to write');
{
    const s = setup({ mode: 'setThrows' });
    s.h.result.setUnitSystem('imperial');
    check('the toggle flips in memory when the write is refused', s.h.result.unitSystem, 'imperial');
    check('nothing was persisted', s.storage.store[STORAGE_KEY], undefined);
    check('the write was attempted exactly once', s.storage.sets, 1);
    s.h.result.setUnitSystem('metric');
    check('the toggle keeps working for the session', s.h.result.unitSystem, 'metric');
}

// ---------------------------------------------------------------------------
console.log('\nno localStorage at all');
{
    const s = setup({ mode: 'absent' });
    check('the global really is absent for this case', typeof globalThis.localStorage, 'undefined');
    check('mounting without localStorage still reports metric', s.h.result.unitSystem, 'metric');
    s.h.result.setUnitSystem('imperial');
    check('the toggle still works with no localStorage', s.h.result.unitSystem, 'imperial');
}

// ---------------------------------------------------------------------------
if (failures > 0) {
    console.log(`\n${failures} FAIL`);
    process.exit(1);
}
console.log('\nall checks passed');
