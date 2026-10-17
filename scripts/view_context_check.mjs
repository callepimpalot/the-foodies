/**
 * ViewContext checks — `node scripts/view_context_check.mjs`
 *
 * WHY THIS EXISTS
 * `scripts/stateful_components_check.mjs` (PR #54) measured that a `.jsx` module calling `useState`
 * but consuming no context IS reachable with no DOM and no reconciler — the harness supplies the
 * hook itself. Its header, and `PICKUP.md` §6 after it, then draw the line one step further out:
 * the 14 remaining uncovered modules "need a context provider, not just a state dispatcher — their
 * assertions would depend on the provider's identity".
 *
 * That is the same over-broad claim #53 made and #54 disproved. A `useContext` is a hook the
 * harness can supply too, and supplying it is exactly what a provider does: React's own test story
 * for a context consumer is "render it under a provider carrying this value", and this harness can
 * put that value in place directly. What the assertion depends on is the **fixture you chose**, not
 * on some identity the provider owns.
 *
 * `src/context/ViewContext.jsx` is the smallest of the 14 and the one everything else routes
 * through: every `useView()` in the app reads this module's value, and `App.jsx` mounts
 * `ViewProvider` once at the root. This file pins it.
 *
 * WHAT IS PINNED, AND WHY IT IS WORTH PINNING
 *  - The default view. `ViewProvider` must open on `VIEWS.DASHBOARD` with `viewData` null — a
 *    provider that opened on `null` renders no view at all on a cold start, and nothing else in the
 *    repo asserts this.
 *  - `setCurrentView(view)` clears the stale payload. The signature is `(view, data = null)`, so
 *    navigating without a payload must NOT leave the previous screen's `viewData` in place; a
 *    dropped `setViewData(data)` leaves `RecipeView` opening onto the last recipe it was handed.
 *  - `setCurrentView(view, data)` sets both, and the two are set together — the value object carries
 *    no torn state between them.
 *  - The context value's shape: exactly `currentView`, `setCurrentView`, `viewData`, `VIEWS`.
 *  - `useView()`'s guard: with no provider it must **throw**, and with a provider it must hand back
 *    the provider's own object by identity (not a copy). A consumer silently receiving `undefined`
 *    is a crash three frames later with no useful message.
 *
 * HOW IT RUNS A CONTEXT PROVIDER WITH NO REACT AND NO DOM
 * `react` is answered with a stub: `createElement` builds plain `{ type, props }` objects (JSX is
 * transformed to `React.createElement` calls by `esbuild`, already present as a Vite dependency —
 * nothing is installed), `useState` keeps a persistent slot array and re-renders synchronously into
 * the same mount object, `createContext()` hands back a unique `Provider` marker so the element the
 * provider returns can be recognised, and `useContext` returns whatever fixture the test has set.
 * `registerHooks` resolves the app's extensionless relative import (`../utils/constants`).
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * This asserts the element object `ViewProvider` returns and the value it publishes — not a rendered
 * screen. No CSS, no layout, no event dispatch, no effect ordering: `ViewProvider` calls no effect,
 * so nothing here races. `vitest`, `jest`, `jsdom`, `@testing-library/react` and
 * `react-test-renderer` are all absent from `node_modules`; installing one is a human decision.
 *
 * NEGATIVE CONTROLS (each in its own fresh scratch layout, the unmutated copy of the SAME layout
 * green at **29 ok / 0 FAIL / exit 0** first, and each mutator asserting its anchor matches exactly
 * once so no control can silently become a no-op). Measured, one run per control:
 *   - default view `useState(VIEWS.DASHBOARD)` → `useState(null)` → **26 ok / 3 FAIL, exit 1** (a
 *     cold start renders no view, and a second mount starts clean only by accident).
 *   - drop `setViewData(data);` from `setCurrentView` → **26 ok / 3 FAIL, exit 1** (a screen's
 *     payload survives the next navigation).
 *   - drop the `if (!context) throw` guard in `useView` → **24 ok / 5 FAIL, exit 1** (a consumer
 *     with no provider gets `undefined` instead of an error naming the missing provider).
 *
 * Plain script, non-zero exit on failure — same shape as `scripts/stateful_components_check.mjs`.
 */
import { createRequire, registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

// The app's own `.js` modules import each other extensionlessly (Vite resolves that at build time;
// bare Node does not).
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

/* ------------------------------------------------------------------ the react stub */

const FRAGMENT = Symbol('Fragment');

let slots = [];
let cursor = 0;
let rerender = () => {};

function useState(init) {
    const i = cursor++;
    if (slots.length <= i) slots[i] = typeof init === 'function' ? init() : init;
    return [slots[i], (v) => {
        slots[i] = typeof v === 'function' ? v(slots[i]) : v;
        rerender();
    }];
}

/** Every context this module graph creates, in creation order — `ViewContext` is `[0]`. */
const createdContexts = [];
/** The fixture `useContext` hands back. Set per assertion group; `undefined` means "no provider". */
let contextValue;

function createContext(defaultValue) {
    const ctx = { Provider: Symbol('Context.Provider'), defaultValue };
    createdContexts.push(ctx);
    return ctx;
}

function useContext(ctx) {
    // A real `useContext` returns the nearest provider's value, or the context default when there is
    // none. The fixture stands in for "the nearest provider's value"; `undefined` models no provider.
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
    useEffect: () => {},
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useRef: (v) => ({ current: v }),
    createPortal: (el) => el,
};

const logged = [];

/* ------------------------------------------------------------------ jsx loader */

/** Resolve a module specifier the way Vite does: extensionless relatives get `.jsx`/`.js`.
    `.jsx` is tried first because `registerHooks` rewrites a bare relative specifier to `<spec>.js`. */
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

/** Loaded modules, keyed by absolute path — so an import chain shares one module identity. */
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
        jsx: 'transform',   // React.createElement — the module's own `import React` provides the binding
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
        // `ViewContext.jsx` does not `import React` — it relies on the app's automatic JSX runtime.
        // esbuild's `jsx: 'transform'` emits `React.createElement(...)`, so the name has to resolve
        // as a global here; every module that DOES import React binds it over this anyway.
        React: ReactStub,
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

/** Call a component with a fresh state slot array; state updates re-render into `.tree`. */
function mount(Component, props) {
    slots = [];
    cursor = 0;
    const self = { props, tree: null };
    rerender = () => { cursor = 0; self.tree = Component(props); };
    rerender();
    return self;
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

const { ViewProvider, useView } = loadJsx('../src/context/ViewContext.jsx');
const { VIEWS } = require(join(dirname(here), '..', 'src', 'utils', 'constants.js'));
const ViewContext = createdContexts[0];

/* ------------------------------------------------------------ the provider's published value */

console.log('\nViewProvider — what it publishes on a cold start');

const provider = mount(ViewProvider, { children: 'CHILD' });
const value = () => provider.tree.props.value;

check('it renders the ViewContext.Provider element', provider.tree.type === ViewContext.Provider, true);
check('the context was created by this module', createdContexts.length, 1);
check('a cold start lands on the dashboard', value().currentView, VIEWS.DASHBOARD);
check('...which is the string the router compares against', value().currentView, 'DASHBOARD');
check('no screen payload is carried on a cold start', value().viewData, null);
check('the provider publishes the VIEWS constants themselves', value().VIEWS === VIEWS, true);
check('...so a consumer can compare against the same object the provider used', value().VIEWS.DASHBOARD, 'DASHBOARD');
check('the published value carries exactly four keys',
    Object.keys(value()).sort(), ['VIEWS', 'currentView', 'setCurrentView', 'viewData']);
check('the provider renders its children', provider.tree.props.children, 'CHILD');
check('setCurrentView is a function', typeof value().setCurrentView, 'function');

console.log('\nViewProvider — setCurrentView(view) navigates and clears the payload');

value().setCurrentView(VIEWS.PLAN);
check('the view moves to the one asked for', value().currentView, 'PLAN');
check('...and the previous payload is gone', value().viewData, null);

value().setCurrentView(VIEWS.SHOP, { recipeId: 'r1' });
check('a view asked for with a payload carries it', value().viewData, { recipeId: 'r1' });
check('...and the view moved with it', value().currentView, 'SHOP');

value().setCurrentView(VIEWS.PANTRY);
check('navigating again without a payload does not inherit the old one', value().viewData, null);
check('...and the view is the new one', value().currentView, 'PANTRY');
check('the last view wins (no queue of pending navigations)', value().currentView, 'PANTRY');

value().setCurrentView(VIEWS.HOUSEHOLD, { tab: 'members' });
check('a TASK_07 view routes through the same setter', value().currentView, 'HOUSEHOLD');
check('...with its payload intact', value().viewData, { tab: 'members' });

console.log('\nViewProvider — two providers do not share state');

const second = mount(ViewProvider, { children: null });
check('a second mount starts clean', second.tree.props.value.currentView, VIEWS.DASHBOARD);
check('...and does not see the first one\'s payload', second.tree.props.value.viewData, null);
check('...while the first mount is untouched',
    [provider.tree.props.value.currentView, provider.tree.props.value.viewData],
    ['HOUSEHOLD', { tab: 'members' }]);

/* ------------------------------------------------------------ useView's guard */

console.log('\nuseView — the provider guard');

const fixture = { currentView: VIEWS.RECIPES, setCurrentView: () => {}, viewData: { id: 7 }, VIEWS };
contextValue = fixture;
check('with a provider it returns the provider\'s value', useView() === fixture, true);
check('...by identity, not a copy', useView().viewData === fixture.viewData, true);

contextValue = undefined;
let thrown = null;
try {
    useView();
} catch (err) {
    thrown = err;
}
check('with no provider it throws', thrown !== null, true);
// `instanceof Error` is FALSE here on purpose: the module runs inside a `vm` context with its own
// realm, so its `Error` is a different constructor object than this script's. Assert the shape.
check('...an Error', thrown !== null && thrown.name === 'Error', true);
check('...carrying a message', thrown !== null && typeof thrown.message === 'string', true);
check('...that names the missing provider', thrown && thrown.message,
    'useView must be used within a ViewProvider');

contextValue = null;
let thrownNull = null;
try {
    useView();
} catch (err) {
    thrownNull = err;
}
check('a null context is refused too (not just undefined)', thrownNull !== null, true);

/* ------------------------------------------------------------------ summary */

console.log(`\n${failures === 0 ? 'ALL OK' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
