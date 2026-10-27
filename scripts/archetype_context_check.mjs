/**
 * ArchetypeContext checks — `node scripts/archetype_context_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/context/ArchetypeContext.jsx` is the smallest module in the app that no `scripts/*_check.mjs`
 * names, and it is not dead code: `ArchetypeProvider` is mounted once at the root in `src/main.jsx`,
 * so its initialiser and its effect run on **every** cold start of the real app. Nothing asserted
 * any of it — not the table it publishes, not the stored-value round trip, not the corrupt-value
 * fallback, not the CSS variable it writes, not the guard on its consumer hook.
 *
 * That makes it a stateful, persisted, error-handling module with a live side effect, and it is the
 * kind of logic that rots silently: a JSON shape change in the stored value does not throw, it just
 * quietly re-themes the app.
 *
 * WHAT IS PINNED, AND WHY IT IS WORTH PINNING
 *  - The archetype table: four entries, keyed by their own `id`, each with a non-empty label and
 *    description and a `glow` that is a **design-system token** (`var(--glow-…)`), never a literal
 *    colour. `DESIGN_SYSTEM.md` forbids hardcoded colours; this is the one place a literal would
 *    slip in unnoticed, because a glow is written straight into a CSS custom property.
 *  - The cold start: with nothing stored the provider opens on `TRAINING` — not `undefined`, which
 *    would write `--active-glow: undefined` and leave the whole UI unstyled.
 *  - The stored round trip: a stored archetype is restored **by value**, so the app reopens with the
 *    theme the user last chose.
 *  - The corrupt-value fallback: unparseable JSON must fall back to `TRAINING` **and say so** on
 *    `console.error`. Silently swallowing a corrupt preference is how a broken store ships.
 *  - The effect: it publishes `activeArchetype.glow` into `--active-glow` on `documentElement` and
 *    writes the current archetype back to `localStorage` — both, on every change, together.
 *  - The published value's shape: exactly `activeArchetype`, `setActiveArchetype`, `archetypes`.
 *  - `useArchetype()`'s guard: with no provider it must **throw** a message naming the provider; with
 *    one it must hand back that provider's own object by identity. A consumer receiving `undefined`
 *    instead is a crash three frames later with no useful message.
 *
 * HOW IT RUNS A PROVIDER WITH A PERSISTED INITIALISER AND A DOM EFFECT, NO REACT AND NO DOM
 * `react` is answered with a stub: `createElement` builds plain `{ type, props }` objects, `useState`
 * keeps a persistent slot array and re-renders synchronously into the same mount, `createContext()`
 * hands back a unique `Provider` marker so the element the provider returns can be recognised, and
 * `useContext` returns whatever fixture the test has set. `useEffect` is **recorded, not run** — a
 * React effect fires after paint, so this harness replays each recorded effect deliberately, in
 * registration order, and collects the cleanups; that is what keeps the assertions from racing.
 * `localStorage` and `document` are fakes in the `vm` sandbox: an ephemeral object and a single
 * `documentElement.style` that records `setProperty` calls. JSX is transformed by `esbuild`, already
 * present as a Vite dependency — nothing is installed. The module does not `import React` (the app
 * relies on the automatic JSX runtime), so `React` resolves as a **global** in the sandbox, which
 * esbuild's `jsx: 'transform'` output requires.
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * No layout, no CSS cascade, no event dispatch, no React scheduling: this asserts the element object
 * the provider returns, the value it publishes, and the effects it registers. `vitest`, `jest`,
 * `jsdom`, `@testing-library/react` and `react-test-renderer` are all absent from `node_modules`;
 * installing one is a human decision.
 *
 * NEGATIVE CONTROLS (each in its own fresh scratch layout, the unmutated copy of the SAME layout
 * green at 44 ok / 0 FAIL / exit 0 first, each mutator asserting its anchor matches exactly once so
 * no control can silently become a no-op). Measured, one run per control:
 *   - the corrupt-value fallback `return ARCHETYPES.TRAINING;` → `return null;` in the catch block →
 *     **43 ok / 1 FAIL, exit 1** (a corrupt preference silently yields no archetype at all).
 *   - drop `localStorage.setItem('meal_buddy_archetype', …)` from the effect → **40 ok / 4 FAIL,
 *     exit 1** (the choice is never persisted, so every reload resets the theme).
 *   - drop the `if (!context) throw` guard in `useArchetype` → **40 ok / 4 FAIL, exit 1** (a consumer
 *     with no provider gets `undefined` instead of an error naming the missing provider).
 *   - flip the cold-start default to `ARCHETYPES.FAMILY` → **38 ok / 6 FAIL, exit 1** (the whole
 *     default path — state, CSS variable, store — moves with it).
 *
 * Plain script, non-zero exit on failure — same shape as `scripts/view_context_check.mjs`.
 */
import { createRequire, registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

// Harmless here (this module imports nothing relative), but it keeps the loader identical to the
// sibling suites so a future relative import cannot break the run in a confusing way.
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

/** localStorage with a real backing store — seeded per assertion group. */
const store = new Map();
const localStorageFake = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
    clear: () => { store.clear(); },
};

const cssProps = {};
const documentFake = {
    documentElement: {
        style: {
            setProperty(name, value) { cssProps[name] = value; },
            getPropertyValue(name) { return cssProps[name]; },
        },
    },
};

const logged = [];

/* ------------------------------------------------------------------ the react stub */

const FRAGMENT = Symbol('Fragment');

let slots = [];
let cursor = 0;
let rerender = () => {};
let effects = [];

function useState(init) {
    const i = cursor++;
    if (slots.length <= i) slots[i] = typeof init === 'function' ? init() : init;
    return [slots[i], (v) => {
        slots[i] = typeof v === 'function' ? v(slots[i]) : v;
        rerender();
    }];
}

function useEffect(fn) {
    effects.push(fn);
}

/** Every context this module graph creates, in creation order — `ArchetypeContext` is `[0]`. */
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
    useContext,
    createContext,
    useEffect,
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useRef: (v) => ({ current: v }),
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

function loadJsx(relativePathOrUrl, globals = null) {
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
        localStorage: localStorageFake,
        document: documentFake,
        console: {
            error: (...args) => logged.push(['error', ...args]),
            warn: (...args) => logged.push(['warn', ...args]),
            log: () => {},
            info: () => {},
        },
        setTimeout: () => 0,
        clearTimeout: () => {},
        ...(globals ?? {}),
    };
    moduleCache.set(key, mod.exports);
    vm.runInNewContext(code, sandbox, { filename: key });
    moduleCache.set(key, mod.exports);
    return mod.exports;
}

/** Mount a component with a fresh slot array. State updates re-render into `.tree` and re-record
    effects, the way React discards the previous render's effects before running the new ones. */
function mount(Component, props) {
    slots = [];
    cursor = 0;
    effects = [];
    const self = { props, tree: null, effects: [] };
    rerender = () => {
        cursor = 0;
        effects = [];
        self.tree = Component(props);
        self.effects = effects.slice();
    };
    rerender();
    return self;
}

/** Replay one mount's recorded effects in registration order; returns the cleanups. */
function runEffects(instance) {
    const cleanups = [];
    for (const fn of instance.effects) {
        const cleanup = fn();
        if (typeof cleanup === 'function') cleanups.push(cleanup);
    }
    return cleanups;
}

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

const mod = loadJsx('../src/context/ArchetypeContext.jsx');
const { ARCHETYPES, ArchetypeProvider, useArchetype } = mod;
const ArchetypeContext = createdContexts[0];
const KEY = 'meal_buddy_archetype';

/* ------------------------------------------------------------ the table */

console.log('\nARCHETYPES — the table the provider publishes');

const ids = Object.keys(ARCHETYPES);
check('it carries four archetypes', ids.length, 4);
check('keyed in a stable, display order', ids, ['TRAINING', 'FAMILY', 'STUDENT', 'MINIMALIST']);
check('each entry is keyed by its own id', ids.map((k) => ARCHETYPES[k].id), ids);
check('every entry has a non-empty label', ids.every((k) => typeof ARCHETYPES[k].label === 'string' && ARCHETYPES[k].label.length > 0), true);
check('every entry has a non-empty description', ids.every((k) => typeof ARCHETYPES[k].description === 'string' && ARCHETYPES[k].description.length > 0), true);
check('every glow is a design-system token, never a literal colour',
    ids.map((k) => /^var\(--glow-[a-z]+\)$/.test(ARCHETYPES[k].glow)), [true, true, true, true]);
check('every entry names an accent', ids.every((k) => typeof ARCHETYPES[k].accent === 'string' && ARCHETYPES[k].accent.length > 0), true);

/* ------------------------------------------------------------ cold start */

console.log('\nArchetypeProvider — a cold start with nothing stored');

store.clear();
Object.keys(cssProps).forEach((k) => delete cssProps[k]);
logged.length = 0;

const first = mount(ArchetypeProvider, { children: 'CHILD' });
const value = () => first.tree.props.value;

check('it renders the ArchetypeContext.Provider element', first.tree.type === ArchetypeContext.Provider, true);
check('it renders its children', first.tree.props.children, 'CHILD');
check('a cold start lands on TRAINING', value().activeArchetype, ARCHETYPES.TRAINING);
check('...by value, not by id alone', value().activeArchetype.glow, 'var(--glow-training)');
check('the published value carries exactly three keys',
    Object.keys(value()).sort(), ['activeArchetype', 'archetypes', 'setActiveArchetype']);
check('setActiveArchetype is a function', typeof value().setActiveArchetype, 'function');
check('archetypes is the table as a list', value().archetypes.map((a) => a.id), ids);

console.log('\nArchetypeProvider — nothing stored means nothing is read or written yet');

check('the initialiser did not fabricate a stored value', store.has(KEY), false);
check('...and the effect has not run (it is registered, not executed)', first.effects.length, 1);
check('...so no CSS variable has been written', Object.keys(cssProps).length, 0);

console.log('\nArchetypeProvider — the effect publishes the glow and persists the choice');

const cleanups = runEffects(first);
const persisted = store.get(KEY);
check('the effect wrote the glow to --active-glow', cssProps['--active-glow'], 'var(--glow-training)');
check('...only that one property', Object.keys(cssProps), ['--active-glow']);
check('...and persisted the archetype', persisted, JSON.stringify(ARCHETYPES.TRAINING));
check('...as JSON the initialiser can read back', persisted ? JSON.parse(persisted).id : null, 'TRAINING');
check('the effect registers no cleanup (it has no subscription to unwind)', cleanups.length, 0);

/* ------------------------------------------------------------ restoring a stored value */

console.log('\nArchetypeProvider — a stored archetype is restored');

store.clear();
store.set(KEY, JSON.stringify(ARCHETYPES.STUDENT));

const restored = mount(ArchetypeProvider, { children: null });
check('the stored archetype wins over the default', restored.tree.props.value.activeArchetype.id, 'STUDENT');
check('...restored by value', restored.tree.props.value.activeArchetype, ARCHETYPES.STUDENT);
check('a second mount restores from the store, not from the first mount\'s state',
    restored.tree.props.value.activeArchetype.id, 'STUDENT');
check('...and the earlier mount is untouched by it',
    first.tree.props.value.activeArchetype, ARCHETYPES.TRAINING);

/* ------------------------------------------------------------ corruption */

console.log('\nArchetypeProvider — a corrupt stored value falls back and says so');

store.clear();
store.set(KEY, '{this is not json');
logged.length = 0;

const corrupt = mount(ArchetypeProvider, { children: null });
check('unparseable JSON falls back to TRAINING', corrupt.tree.props.value.activeArchetype, ARCHETYPES.TRAINING);
check('...and does not throw out of the initialiser', corrupt.tree !== null, true);
check('...and reports the failure on console.error', logged.filter((l) => l[0] === 'error').length, 1);
check('...naming what it failed to parse',
    logged.some((l) => l[0] === 'error' && String(l[1]).startsWith('Failed to parse archetype')), true);

console.log('\nArchetypeProvider — a stored value that is valid JSON but not an archetype');

store.clear();
store.set(KEY, '42');
const odd = mount(ArchetypeProvider, { children: null });
check('a valid-but-wrong-shape value is passed through as stored', odd.tree.props.value.activeArchetype, 42);
check('...which is the recorded consequence of a bare JSON.parse, not a validation step',
    odd.tree.props.value.activeArchetype !== ARCHETYPES.TRAINING, true);

/* ------------------------------------------------------------ switching */

console.log('\nArchetypeProvider — switching archetype moves the state, the variable and the store');

store.clear();
Object.keys(cssProps).forEach((k) => delete cssProps[k]);
const live = mount(ArchetypeProvider, { children: null });
runEffects(live);

live.tree.props.value.setActiveArchetype(ARCHETYPES.FAMILY);
check('the active archetype moves', live.tree.props.value.activeArchetype.id, 'FAMILY');
check('...and the re-render re-registered exactly one effect', live.effects.length, 1);

runEffects(live);
const liveStored = store.get(KEY);
check('the CSS variable follows the new archetype', cssProps['--active-glow'], 'var(--glow-family)');
check('...and the store follows it too', liveStored ? JSON.parse(liveStored).id : null, 'FAMILY');
check('...so a reload would restore FAMILY', (() => {
    const again = mount(ArchetypeProvider, { children: null });
    return again.tree.props.value.activeArchetype.id;
})(), 'FAMILY');

/* ------------------------------------------------------------ useArchetype */

console.log('\nuseArchetype — the provider guard');

const fixture = { activeArchetype: ARCHETYPES.MINIMALIST, setActiveArchetype: () => {}, archetypes: Object.values(ARCHETYPES) };
contextValue = fixture;
check('with a provider it returns the provider\'s value', useArchetype() === fixture, true);
check('...by identity, not a copy', useArchetype().activeArchetype === fixture.activeArchetype, true);
check('...carrying every table entry', useArchetype().archetypes.length, 4);

contextValue = undefined;
let thrown = null;
try {
    useArchetype();
} catch (err) {
    thrown = err;
}
check('with no provider it throws', thrown !== null, true);
// `instanceof Error` is FALSE here on purpose: the module runs inside a `vm` context with its own
// realm, so its `Error` is a different constructor object than this script's. Assert the shape.
check('...an Error', thrown !== null && thrown.name === 'Error', true);
check('...whose message names the missing provider', thrown && thrown.message,
    'useArchetype must be used within an ArchetypeProvider');

contextValue = null;
let thrownNull = null;
try {
    useArchetype();
} catch (err) {
    thrownNull = err;
}
check('a null context is refused too (not just undefined)', thrownNull !== null, true);

/* ------------------------------------------------------------------ summary */

console.log(`\n${failures === 0 ? 'ALL OK' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
