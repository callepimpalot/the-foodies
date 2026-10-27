/**
 * HouseholdContext checks — `node scripts/household_context_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/context/HouseholdContext.jsx` is the most logic-dense module in the app that no
 * `scripts/*_check.mjs` named — measured 2026-10-18 13:2x UTC over all 53 heads (193
 * `(ref, scripts/*_check.mjs)` blobs), it read **0 raw / 0 code** hits: not named even in a script's
 * prose. It is not dead code: `HouseholdProvider` is mounted at the root, so its initialiser, its
 * mount effect, its `join` and its `forget` run in the real app.
 *
 * It is also the module where a wrong answer is expensive and silent. TASK_07 makes the household
 * id in localStorage *the credential* — the id is sent as `x-household-id` and the database uses it
 * to decide whose plan you may read. So the three things this file does that nothing asserted:
 *
 *   - it derives its opening state from two storage keys and a third boolean, and gets `remote`
 *     wrong if it misreads them (`remote: false` means "your wife cannot see this plan yet");
 *   - it shares ONE in-flight `ensureHousehold()` attempt across every simultaneous caller at
 *     module scope — the comment says why (two concurrent calls create two households and the loser
 *     becomes invisible), and nothing proved the sharing works;
 *   - and it guards every post-await `setState` behind a `mounted` ref, so a provider unmounted
 *     before its promise settles must not write state.
 *
 * WHAT IS PINNED
 *  - The cold start with nothing stored: `status: 'creating'`, `ready: false`, `remote: false`,
 *    `id: null`, `joinCode: ''` — and the effect is registered, not run.
 *  - The cold start with a stored id: `status: 'idle'` immediately, `remote` derived from the
 *    `is_local` key (a device-local household must NOT claim to be remote), `ready: false` until the
 *    ensure resolves.
 *  - The mount effect adopting the ensure result: id, joinCode, remote, `ready: true`, `status: 'idle'`.
 *  - The module-scope in-flight sharing: two providers mounted before the promise settles call
 *    `ensureHousehold` exactly **once**, and both adopt the same result.
 *  - The `mounted` ref: a provider unmounted before its ensure settles writes no state at all.
 *  - `join()`: the synchronous `'joining'` status, the code passed through raw to the library, and on
 *    success the trimmed + upper-cased code, `remote: true`, `ready: true`, `error: null`; on failure
 *    `status: 'idle'` with the library's `reason` on `error` and the previous identity untouched.
 *  - `forget()`: it clears the stored household, resets to `'creating'`, and starts a fresh ensure.
 *  - `useHousehold()`'s guard: no provider (undefined or null) must **throw** a message naming the
 *    provider; with one it hands back that provider's own object **by identity**.
 *  - The published value's shape: exactly the six state keys plus `join` and `forget`.
 *
 * HOW IT RUNS A PROVIDER WITH NO REACT AND NO DOM
 * `react` is answered with a stub. `createElement` builds plain `{ type, props }` objects;
 * `createContext()` hands back a unique `Provider` marker so the returned element is recognisable;
 * `useContext` returns the fixture the test sets. `useState` and `useRef` share **one per-instance
 * slot array** so a ref persists across re-renders (the app's first hook is `useState`, its second
 * `useRef`, so a fixed-index ref stub would hand back a fresh object every render and the `mounted`
 * guard would never be observable). `useEffect` is **recorded, not run** — this harness replays the
 * recorded effects deliberately, in registration order, and collects the cleanups, which is what
 * keeps the assertions from racing a floating promise.
 * `../lib/household` is **stubbed**, not loaded: the real one imports `src/lib/supabase`, which
 * builds a client at import time. The stub records every call and hands back a deferred this script
 * resolves by hand — that is what makes the in-flight sharing and the unmount race deterministic.
 * JSX is transformed by `esbuild`, already present as a Vite dependency; nothing is installed. The
 * module does not `import React` (the app relies on the automatic JSX runtime), so `React` resolves
 * as a **global** in the `vm` sandbox, which esbuild's `jsx: 'transform'` output requires.
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * No layout, no CSS, no event dispatch, no React scheduling, and no real network: this asserts the
 * element object the provider returns, the value it publishes, the calls it makes into
 * `src/lib/household`, and the effects it registers. `vitest`, `jest`, `jsdom`,
 * `@testing-library/react` and `react-test-renderer` are all absent from `node_modules`; installing
 * one is a human decision.
 *
 * NEGATIVE CONTROLS (each in its own fresh scratch layout; the unmutated copy of the SAME layout is
 * green first at **77 ok / 0 FAIL / exit 0**, and each mutator asserts its anchor matches exactly
 * once so no control can silently become a no-op). Measured 2026-10-18 13:3x UTC, one run per control:
 *   - delete the `if (!mounted.current) return;` line in the `.then` → **73 ok / 4 FAIL, exit 1**
 *     (a provider unmounted mid-flight writes state into a dead component).
 *   - `remote: id ? !getJoinCodeIsLocal() : false` → `remote: false` in the initialiser →
 *     **76 ok / 1 FAIL, exit 1** (a shared household reports itself as device-local).
 *   - `String(code ?? '').trim().toUpperCase()` → `String(code ?? '')` in `join` →
 *     **75 ok / 2 FAIL, exit 1** (a typed code is stored with its padding and its case).
 *
 * Plain script, non-zero exit on failure — same shape as `scripts/archetype_context_check.mjs`.
 */
import { createRequire, registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

// This module imports `../lib/household`, which is stubbed below — but the loader stays identical to
// the sibling suites so a future relative import cannot break the run in a confusing way.
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('.') && !/\.[cm]?jsx?$/.test(specifier)) {
            return nextResolve(`${specifier}.js`, context);
        }
        return nextResolve(specifier, context);
    },
});

const here = fileURLToPath(import.meta.url);
const require = createRequire(here);

let transformSync;
try {
    ({ transformSync } = require('esbuild'));
} catch (err) {
    console.log('  FAIL esbuild is not resolvable from scripts/ — this suite cannot read a .jsx file without it');
    console.log(`       ${err.message}`);
    process.exit(1);
}

/* ------------------------------------------------------------------ the fakes */

const logged = [];

/** The stub of `src/lib/household`. Records every call; `ensureHousehold`/`joinWithCode` hand back a
    deferred this script settles by hand, so the races are deterministic rather than timing-dependent. */
const calls = { ensure: [], join: [], clear: 0 };
const pending = { ensure: [], join: [] };

/** What the stub reports as this device's stored household. Set per section. */
const fixture = { id: null, joinCode: '', joinCodeIsLocal: false };

function makeDeferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

const householdStub = {
    getHouseholdId: () => fixture.id,
    getJoinCode: () => fixture.joinCode,
    getJoinCodeIsLocal: () => fixture.joinCodeIsLocal,
    clearHousehold: () => { calls.clear += 1; },
    ensureHousehold: (...args) => {
        calls.ensure.push(args);
        const d = makeDeferred();
        pending.ensure.push(d);
        return d.promise;
    },
    joinWithCode: (code) => {
        calls.join.push(code);
        const d = makeDeferred();
        pending.join.push(d);
        return d.promise;
    },
};

const STUBS = new Map([['../lib/household', householdStub]]);

/* ------------------------------------------------------------------ the react stub */

const FRAGMENT = Symbol('Fragment');

/** The instance currently being rendered — hooks read their state off it. */
let current = null;
let cursor = 0;

function useState(init) {
    const inst = current;
    const i = cursor++;
    if (inst.slots.length <= i) inst.slots[i] = typeof init === 'function' ? init() : init;
    return [inst.slots[i], (v) => {
        inst.slots[i] = typeof v === 'function' ? v(inst.slots[i]) : v;
        render(inst);
    }];
}

/** Shares the slot array with `useState`, so the ref object persists across re-renders the way
    React's does — a fresh `{ current: init }` per render would make the `mounted` guard unobservable. */
function useRef(init) {
    const inst = current;
    const i = cursor++;
    if (inst.slots.length <= i) inst.slots[i] = { current: init };
    return inst.slots[i];
}

function useEffect(fn) {
    current.effects.push(fn);
}

/** Every context this module graph creates, in creation order — `HouseholdContext` is `[0]`. */
const createdContexts = [];
/** The fixture `useContext` hands back. `undefined` models "no provider". */
let contextValue;

function createContext(defaultValue) {
    const ctx = { Provider: Symbol('Context.Provider'), defaultValue };
    createdContexts.push(ctx);
    return ctx;
}

function useContext(ctx) {
    return contextValue === undefined ? ctx.defaultValue : contextValue;
}

function createElement(type, props, ...children) {
    const next = { ...(props ?? {}) };
    if (children.length === 1) next.children = children[0];
    else if (children.length > 1) next.children = children;
    return { type, props: next };
}

const ReactStub = {
    createElement,
    Fragment: FRAGMENT,
    useState,
    useRef,
    useContext,
    createContext,
    useEffect,
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    createPortal: (el) => el,
};

/* ------------------------------------------------------------------ jsx loader */

function resolveSpecifier(baseRequire, spec) {
    for (const candidate of [`${spec}.jsx`, `${spec}.js`, spec, `${spec}/index.jsx`, `${spec}/index.js`]) {
        try {
            return baseRequire.resolve(candidate);
        } catch {
            /* try the next extension */
        }
    }
    return null;
}

const moduleCache = new Map();

function loadJsx(relativePathOrUrl) {
    const abs = relativePathOrUrl instanceof URL
        ? relativePathOrUrl
        : new URL(relativePathOrUrl, import.meta.url);
    const key = fileURLToPath(abs);
    if (moduleCache.has(key)) return moduleCache.get(key);
    const source = readFileSync(abs, 'utf8');
    const { code } = transformSync(source, {
        loader: 'jsx',
        jsx: 'transform',
        format: 'cjs',
        target: 'node20',
    });
    const baseRequire = createRequire(abs);
    const moduleRequire = (spec) => {
        if (spec === 'react') return ReactStub;
        if (STUBS.has(spec)) return STUBS.get(spec);
        if (typeof spec === 'string' && spec.startsWith('.')) {
            const resolved = resolveSpecifier(baseRequire, spec);
            if (!resolved) throw new Error(`Cannot resolve '${spec}' from ${key}`);
            if (resolved.endsWith('.jsx')) return loadJsx(pathToFileURL(resolved));
            return baseRequire(resolved);
        }
        return baseRequire(spec);
    };
    const mod = { exports: {} };
    const sandbox = {
        require: moduleRequire,
        module: mod,
        exports: mod.exports,
        React: ReactStub,
        console: {
            error: (...args) => logged.push(['error', ...args]),
            warn: (...args) => logged.push(['warn', ...args]),
            log: () => {},
            info: () => {},
        },
        setTimeout: () => 0,
        clearTimeout: () => {},
    };
    vm.runInNewContext(code, sandbox, { filename: key });
    moduleCache.set(key, mod.exports);
    return mod.exports;
}

/* ------------------------------------------------------------------ mounting */

function render(inst) {
    current = inst;
    cursor = 0;
    inst.effects = [];
    inst.tree = inst.Component(inst.props);
    current = null;
}

/** Mount a component into its own hook state. A state update re-renders *that instance only*, which
    is React's model and is what keeps two providers mounted at once from stealing each other's
    re-renders. */
function mount(Component, props) {
    const inst = { Component, props, tree: null, effects: [], slots: [] };
    render(inst);
    return inst;
}

/** Replay one mount's recorded effects in registration order; returns the cleanups. */
function runEffects(inst) {
    const cleanups = [];
    for (const fn of inst.effects) {
        const cleanup = fn();
        if (typeof cleanup === 'function') cleanups.push(cleanup);
    }
    return cleanups;
}

/** Let every already-settled promise chain (`.then` → `.finally`) drain. */
const flush = async (n = 8) => { for (let i = 0; i < n; i += 1) await Promise.resolve(); };

/* ------------------------------------------------------------------ assertion helpers */

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

/* ------------------------------------------------------------------ load */

const mod = loadJsx('../src/context/HouseholdContext.jsx');
const { HouseholdProvider, useHousehold } = mod;
const HouseholdContext = createdContexts[0];

/* ------------------------------------------------------------ cold start, nothing stored */

console.log('\nHouseholdProvider — a cold start with nothing stored');

fixture.id = null;
fixture.joinCode = '';
fixture.joinCodeIsLocal = false;

const a = mount(HouseholdProvider, { children: 'KID' });
const av = () => a.tree.props.value;

check('it renders the HouseholdContext.Provider element', a.tree.type === HouseholdContext.Provider, true);
check('it renders its children', a.tree.props.children, 'KID');
check('with no stored id it opens on status "creating"', av().status, 'creating');
check('...not ready', av().ready, false);
check('...device-local, because nothing says otherwise', av().remote, false);
check('...with no id', av().id, null);
check('...and no join code', av().joinCode, '');
check('...and no error', av().error, null);
check('the published value is the six state keys plus join and forget',
    Object.keys(av()).sort(), ['error', 'forget', 'id', 'join', 'joinCode', 'ready', 'remote', 'status']);
check('join is a function', typeof av().join, 'function');
check('forget is a function', typeof av().forget, 'function');
check('the mount effect is registered, not executed', a.effects.length, 1);
check('...so the library has not been called yet', calls.ensure.length, 0);

console.log('\nHouseholdProvider — the mount effect ensures a household and adopts the result');

const aCleanups = runEffects(a);
check('running the effect calls ensureHousehold exactly once', calls.ensure.length, 1);
check('...with no name argument', calls.ensure[0].length, 0);
check('...and registers one cleanup', aCleanups.length, 1);

pending.ensure[0].resolve({ id: 'h-1', joinCode: 'ABCD2345', remote: true });
await flush();

check('the resolved id is adopted', av().id, 'h-1');
check('...its join code', av().joinCode, 'ABCD2345');
check('...its remoteness', av().remote, true);
check('...and the provider is now ready', av().ready, true);
check('...back to idle', av().status, 'idle');
check('...with no error', av().error, null);

/* ------------------------------------------------------------ cold start, a stored id */

console.log('\nHouseholdProvider — a stored id opens idle, and its remoteness comes from the store');

fixture.id = 'h-stored';
fixture.joinCode = 'LOCAL999';
fixture.joinCodeIsLocal = true;

const b = mount(HouseholdProvider, { children: null });
check('a stored id is read at mount', b.tree.props.value.id, 'h-stored');
check('...with its stored join code', b.tree.props.value.joinCode, 'LOCAL999');
check('...and it is not ready until the ensure settles', b.tree.props.value.ready, false);
check('...but its status is already idle, not creating', b.tree.props.value.status, 'idle');
check('a device-local join code means remote: false', b.tree.props.value.remote, false);

fixture.joinCodeIsLocal = false;
const b2 = mount(HouseholdProvider, { children: null });
check('a shared join code means remote: true', b2.tree.props.value.remote, true);
check('...on the same stored id', b2.tree.props.value.id, 'h-stored');

/* ------------------------------------------------------------ the module-scope in-flight share */

console.log('\nHouseholdProvider — two simultaneous providers share ONE ensure attempt');

fixture.id = null;
fixture.joinCode = '';
fixture.joinCodeIsLocal = false;
calls.ensure.length = 0;
const beforeShared = pending.ensure.length;

const m1 = mount(HouseholdProvider, { children: null });
const c1 = runEffects(m1);
const m2 = mount(HouseholdProvider, { children: null });
const c2 = runEffects(m2);

check('two mounts, but ensureHousehold was called once', calls.ensure.length, 1);
check('...one deferred is outstanding', pending.ensure.length - beforeShared, 1);
check('...and each mount registered its own cleanup', [c1.length, c2.length], [1, 1]);

pending.ensure[pending.ensure.length - 1].resolve({ id: 'h-shared', joinCode: 'SHARE123', remote: true });
await flush();

check('the first provider adopted the shared result', m1.tree.props.value.id, 'h-shared');
check('...and is ready', m1.tree.props.value.ready, true);
check('the second provider adopted the same result', m2.tree.props.value.id, 'h-shared');
check('...from the same one call', calls.ensure.length, 1);
check('...without stealing the first one\'s re-render', m1.tree.props.value.joinCode, 'SHARE123');

/* ------------------------------------------------------------ the mounted ref */

console.log('\nHouseholdProvider — a provider unmounted mid-flight writes no state');

fixture.id = null;
fixture.joinCode = '';
fixture.joinCodeIsLocal = false;
const beforeRace = pending.ensure.length;

const racer = mount(HouseholdProvider, { children: null });
const racerCleanups = runEffects(racer);
check('the race provider started its ensure', pending.ensure.length - beforeRace, 1);

racerCleanups[0]();
pending.ensure[pending.ensure.length - 1].resolve({ id: 'h-too-late', joinCode: 'LATE1234', remote: true });
await flush();

check('the unmounted provider kept its opening state', racer.tree.props.value.id, null);
check('...its status', racer.tree.props.value.status, 'creating');
check('...and never became ready', racer.tree.props.value.ready, false);
check('...so the late result was dropped, not written', racer.tree.props.value.joinCode, '');

/* ------------------------------------------------------------ join */

console.log('\nHouseholdProvider — join() adopts a code, normalising what it stores');

fixture.id = 'h-before-join';
fixture.joinCode = 'BEFORE12';
fixture.joinCodeIsLocal = true;
calls.join.length = 0;

const j = mount(HouseholdProvider, { children: null });
const jv = () => j.tree.props.value;
runEffects(j);
pending.ensure[pending.ensure.length - 1].resolve({ id: 'h-before-join', joinCode: 'BEFORE12', remote: false });
await flush();

const joinPromise = jv().join('  abcd2345  ');
check('join moves to status "joining" synchronously', jv().status, 'joining');
check('...and clears any previous error', jv().error, null);
check('the code is handed to the library as typed', calls.join[0], '  abcd2345  ');

pending.join[0].resolve({ ok: true, id: 'h-joined' });
await flush();
await joinPromise;

check('a successful join adopts the returned id', jv().id, 'h-joined');
check('...and stores the code trimmed and upper-cased', jv().joinCode, 'ABCD2345');
check('...and is now shared', jv().remote, true);
check('...and ready', jv().ready, true);
check('...back to idle', jv().status, 'idle');
check('...with no error', jv().error, null);

console.log('\nHouseholdProvider — a failed join surfaces the reason and keeps the identity');

const failedJoin = jv().join('nope');
pending.join[1].resolve({ ok: false, reason: 'not_found' });
await flush();
await failedJoin;

check('a failed join reports the library\'s reason', jv().error, 'not_found');
check('...returns to idle rather than sticking on "joining"', jv().status, 'idle');
check('...and does not change the household id', jv().id, 'h-joined');
check('...nor its join code', jv().joinCode, 'ABCD2345');
check('...nor its remoteness', jv().remote, true);
check('...and stays ready', jv().ready, true);

/* ------------------------------------------------------------ forget */

console.log('\nHouseholdProvider — forget() clears this device and starts over');

calls.clear = 0;
calls.ensure.length = 0;
const beforeForget = pending.ensure.length;

jv().forget();

check('forget clears the stored household', calls.clear, 1);
check('...resets the id', jv().id, null);
check('...the join code', jv().joinCode, '');
check('...the remoteness', jv().remote, false);
check('...readiness', jv().ready, false);
check('...the status', jv().status, 'creating');
check('...and any error', jv().error, null);
check('...then starts a fresh ensure', pending.ensure.length - beforeForget, 1);
check('...by calling the library directly', calls.ensure.length, 1);

pending.ensure[pending.ensure.length - 1].resolve({ id: 'h-reborn', joinCode: 'REBORN12', remote: false });
await flush();

check('the fresh household is adopted', jv().id, 'h-reborn');
check('...with its code', jv().joinCode, 'REBORN12');
check('...and ready', jv().ready, true);
check('...back to idle', jv().status, 'idle');

/* ------------------------------------------------------------ useHousehold */

console.log('\nuseHousehold — the provider guard');

const fixtureValue = { id: 'h-fixture', join: () => {}, forget: () => {} };
contextValue = fixtureValue;
check('with a provider it returns the provider\'s value', useHousehold() === fixtureValue, true);
check('...by identity, not a copy', useHousehold().id, 'h-fixture');

contextValue = undefined;
let thrown = null;
try {
    useHousehold();
} catch (err) {
    thrown = err;
}
check('with no provider it throws', thrown !== null, true);
// `instanceof Error` is FALSE here on purpose: the module runs inside a `vm` context with its own
// realm, so its `Error` is a different constructor object than this script's. Assert the shape.
check('...an Error', thrown !== null && thrown.name === 'Error', true);
check('...whose message names the missing provider', thrown && thrown.message,
    'useHousehold must be used within a HouseholdProvider');

contextValue = null;
let thrownNull = null;
try {
    useHousehold();
} catch (err) {
    thrownNull = err;
}
check('a null context is refused too (not just undefined)', thrownNull !== null, true);
check('...with the same message', thrownNull && thrownNull.message,
    'useHousehold must be used within a HouseholdProvider');

/* ------------------------------------------------------------------ summary */

console.log(`\n${failures === 0 ? 'ALL OK' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
