/**
 * BottomNav checks — `node scripts/bottom_nav_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/components/BottomNav.jsx` is the smallest of the twelve modules no suite named
 * (measured 2026-10-17 10:11 UTC: 67 modules under `src/` + `netlify/` on `main`, 55 named by at
 * least one script, 12 named by none). It is also the app's only always-mounted navigation: every
 * screen is reached through it, and `DESIGN_SYSTEM.md` pins it at exactly six items.
 *
 * `scripts/view_context_check.mjs` (PR #55) established that a context *consumer* is reachable with
 * no DOM and no reconciler — a `useContext` is a hook the harness can supply, and supplying it is
 * exactly what a provider does. This file applies that to a component rather than a provider:
 * `BottomNav` calls `useView()` and nothing else, so it is a pure function of the context value and
 * can be called directly.
 *
 * WHAT IS PINNED, AND WHY IT IS WORTH PINNING
 *  - The six items, in order, with their labels: Home, Capture, Plan, Recipes, Shop, Pantry. A
 *    reordered or dropped item is a navigation the user cannot reach, and nothing else asserts it.
 *  - The six ids are `VIEWS` constants, and `COOK_MODE` / `HOUSEHOLD` are deliberately NOT in the
 *    nav — `constants.js` says so in a comment and `DESIGN_SYSTEM.md` pins six items, but no script
 *    has ever held either claim.
 *  - `active` marks the current view and *only* the current view: exactly one button carries it, and
 *    it moves when `currentView` moves. An inverted comparison (`!==` for `===`) highlights
 *    everything except where you are, which reads as a plausible UI rather than a bug.
 *  - The icon weights: `strokeWidth` 2.25 on the active item, 1.75 on the rest, `size` 18 everywhere.
 *  - Pressing item N calls `setCurrentView` with item N's own id — once, with the right id. A
 *    hardcoded id sends every tap to the same screen.
 *  - Every button carries a `key` equal to its id, and the keys are unique — React reconciles a
 *    keyless list by index, so a reorder then moves the wrong button's DOM node.
 *
 * HOW IT RUNS A CONTEXT CONSUMER WITH NO REACT AND NO DOM
 * `react` is answered with a stub: `createElement` builds plain `{ type, props }` objects (JSX is
 * transformed by `esbuild`, already present as a Vite dependency — nothing is installed),
 * `createContext()` hands back a unique `Provider` marker, and `useContext` returns whatever fixture
 * the test set. `lucide-react` is answered with a stub of six named markers so the icons can be
 * asserted by identity. `registerHooks` resolves the app's extensionless relative imports
 * (`../context/ViewContext`, `../utils/constants`).
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * This asserts the element objects `BottomNav` returns and the calls its handlers make — not a
 * rendered screen. No CSS, no layout, no real event dispatch, no focus handling: `BottomNav` calls
 * no effect, so nothing here races. `vitest`, `jest`, `jsdom`, `@testing-library/react` and
 * `react-test-renderer` are all absent from `node_modules`; installing one is a human decision.
 *
 * NEGATIVE CONTROLS (each in its own fresh scratch layout, the unmutated copy of the SAME layout
 * green at **34 ok / 0 FAIL / exit 0** first, and each mutator asserting its anchor matches exactly
 * once so no control can silently become a no-op). Measured, one run per control:
 *   - `currentView === item.id` → `currentView !== item.id` → **21 ok / 13 FAIL, exit 1** (the active
 *     flag marks every item except the current one, and the icon weights invert with it).
 *   - drop the Pantry entry from `navItems` → **21 ok / 10 FAIL, exit 1** (five items, wrong order,
 *     and Pantry is unreachable).
 *   - `onClick={() => setCurrentView(item.id)}` → `onClick={() => setCurrentView(VIEWS.DASHBOARD)}`
 *     → **31 ok / 3 FAIL, exit 1** (every tap goes to the dashboard).
 *
 * Plain script, non-zero exit on failure — same shape as `scripts/view_context_check.mjs`.
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

/** Every context this module graph creates, in creation order — `ViewContext` is `[0]`. */
const createdContexts = [];
/** The fixture `useContext` hands back. `undefined` means "no provider". */
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
    // React pulls `key` and `ref` OUT of props and onto the element; model that, so a keyed list
    // reads the same way here as it does in a real renderer.
    const { key, ref, ...rest } = props ?? {};
    const next = { ...rest };
    if (children.length === 1) next.children = children[0];
    else if (children.length > 1) next.children = children;
    const element = { type, props: next };
    if (key !== undefined) element.key = key;
    if (ref !== undefined) element.ref = ref;
    return element;
}

const ReactStub = {
    createElement,
    Fragment: FRAGMENT,
    useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
    useContext,
    createContext,
    useEffect: () => {},
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useRef: (v) => ({ current: v }),
    createPortal: (el) => el,
};

/* ------------------------------------------------------------------ the lucide stub */

/** One unique marker per icon, so an icon can be asserted by identity rather than by name. */
const ICON_NAMES = ['Home', 'Map', 'Utensils', 'ShoppingBag', 'ScanLine', 'Package'];
const LucideStub = {};
for (const name of ICON_NAMES) {
    const marker = function IconStub() {};
    marker.iconName = name;
    LucideStub[name] = marker;
}

const logged = [];

/* ------------------------------------------------------------------ jsx loader */

/** Resolve a module specifier the way Vite does: extensionless relatives get `.jsx`/`.js`. */
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

function loadJsx(relativePathOrUrl) {
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
        if (spec === 'lucide-react') return LucideStub;
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
        // esbuild's `jsx: 'transform'` emits `React.createElement(...)`, so the name has to resolve
        // as a global here; a module that DOES import React binds it over this anyway.
        React: ReactStub,
        console: {
            error: (...args) => logged.push(['error', ...args]),
            warn: (...args) => logged.push(['warn', ...args]),
            log: () => {},
            info: () => {},
        },
        setTimeout: () => 0,
        clearTimeout: () => {},
        localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        document: { documentElement: { style: { setProperty: () => {} } } },
        window: {},
    };
    moduleCache.set(key, mod.exports);
    vm.runInNewContext(code, sandbox, { filename: key });
    moduleCache.set(key, mod.exports);
    return mod.exports;
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

const { BottomNav } = loadJsx('../src/components/BottomNav.jsx');
const { VIEWS } = require(join(dirname(here), '..', 'src', 'utils', 'constants.js'));

/* ------------------------------------------------------------------ fixtures */

/** A context value shaped like the one `ViewProvider` publishes, recording every navigation. */
function fixtureFor(currentView) {
    const calls = [];
    return {
        calls,
        value: {
            currentView,
            setCurrentView: (view, data = null) => calls.push([view, data]),
            viewData: null,
            VIEWS,
        },
    };
}

/** The context value is the ONLY input, so a "mount" is just a call with the fixture in place. */
function render(currentView) {
    const fixture = fixtureFor(currentView);
    contextValue = fixture.value;
    const tree = BottomNav();
    return { fixture, tree };
}

const classesOf = (el) => String(el.props.className).split(/\s+/).filter(Boolean);
const childrenOf = (el) => (Array.isArray(el.props.children) ? el.props.children : [el.props.children]);
const labelOf = (button) => childrenOf(button)[1];
const iconOf = (button) => childrenOf(childrenOf(button)[0])[0];
const ids = (tree) => childrenOf(tree).map((b) => b.key);
const labels = (tree) => childrenOf(tree).map(labelOf);

const EXPECTED_IDS = [VIEWS.DASHBOARD, VIEWS.CAPTURE, VIEWS.PLAN, VIEWS.RECIPES, VIEWS.SHOP, VIEWS.PANTRY];
const EXPECTED_LABELS = ['Home', 'Capture', 'Plan', 'Recipes', 'Shop', 'Pantry'];
const EXPECTED_ICONS = ['Home', 'ScanLine', 'Map', 'Utensils', 'ShoppingBag', 'Package'];

/* ------------------------------------------------------------------ the nav's shape */

console.log('\nBottomNav — the shape of the bar');

const home = render(VIEWS.DASHBOARD);
const buttons = childrenOf(home.tree);

check('it renders a <nav> element', home.tree.type, 'nav');
check('...with the nav-bar class the stylesheet hooks', home.tree.props.className, 'nav-bar');
check('DESIGN_SYSTEM.md pins the bar at six items, and it carries six', buttons.length, 6);
check('every child is a <button>', buttons.every((b) => b.type === 'button'), true);
check('the ids, in order', ids(home.tree), EXPECTED_IDS);
check('the labels, in order', labels(home.tree), EXPECTED_LABELS);
check('...and the labels are exactly the six the design names', labels(home.tree), EXPECTED_LABELS);
check('COOK_MODE is not a nav destination', ids(home.tree).includes(VIEWS.COOK_MODE), false);
check('HOUSEHOLD is not a nav destination either (constants.js: reached from the Home header)',
    ids(home.tree).includes(VIEWS.HOUSEHOLD), false);
check('every button carries a key', buttons.every((b) => b.key !== undefined), true);
check('...and the keys are unique', new Set(ids(home.tree)).size, 6);
check('each key is that button\'s own id, not its index', ids(home.tree), EXPECTED_IDS);

console.log('\nBottomNav — the icons');

check('each item renders its own lucide icon, in order',
    buttons.map((b) => iconOf(b).type.iconName), EXPECTED_ICONS);
check('the icons are the stub\'s components by identity (not a re-created wrapper)',
    buttons.every((b, i) => iconOf(b).type === LucideStub[EXPECTED_ICONS[i]]), true);
check('the icon sits inside the nav-item-dot span',
    childrenOf(buttons[0])[0].props.className, 'nav-item-dot');
check('every icon is 18px', buttons.map((b) => iconOf(b).props.size), [18, 18, 18, 18, 18, 18]);
check('the active icon is heavier: strokeWidth 2.25 on the current view',
    iconOf(buttons[0]).props.strokeWidth, 2.25);
check('...and 1.75 on the five that are not',
    buttons.slice(1).map((b) => iconOf(b).props.strokeWidth), [1.75, 1.75, 1.75, 1.75, 1.75]);

/* ------------------------------------------------------------------ the active marker */

console.log('\nBottomNav — active marks the current view and nothing else');

const activeIndex = (tree) => childrenOf(tree).findIndex((b) => classesOf(b).includes('active'));

check('exactly one item is active', childrenOf(home.tree).filter((b) => classesOf(b).includes('active')).length, 1);
check('...and it is the current view', activeIndex(home.tree), 0);
check('the inactive items carry no active class', classesOf(buttons[3]), ['nav-item']);
check('the active item carries both classes', classesOf(buttons[0]), ['nav-item', 'active']);

const shop = render(VIEWS.SHOP);
check('move the current view to SHOP and the marker follows', activeIndex(shop.tree), 4);
check('...on the Shop button, not the one that used to be active', classesOf(childrenOf(shop.tree)[4]).includes('active'), true);
check('...and the dashboard button lost it', classesOf(childrenOf(shop.tree)[0]).includes('active'), false);
check('the SHOP button\'s icon got the heavier weight', iconOf(childrenOf(shop.tree)[4]).props.strokeWidth, 2.25);
check('...and the dashboard icon dropped back', iconOf(childrenOf(shop.tree)[0]).props.strokeWidth, 1.75);

const cook = render(VIEWS.COOK_MODE);
check('a view the bar does not carry marks nothing active', activeIndex(cook.tree), -1);
check('...and every item keeps the light weight',
    childrenOf(cook.tree).map((b) => iconOf(b).props.strokeWidth), [1.75, 1.75, 1.75, 1.75, 1.75, 1.75]);

/* ------------------------------------------------------------------ dispatch */

console.log('\nBottomNav — pressing an item navigates to that item');

const nav = render(VIEWS.DASHBOARD);
const navButtons = childrenOf(nav.tree);

navButtons[3].props.onClick();
check('pressing Recipes asks for RECIPES', nav.fixture.calls, [[VIEWS.RECIPES, null]]);
check('...exactly once', nav.fixture.calls.length, 1);

nav.fixture.calls.length = 0;
navButtons[5].props.onClick();
check('pressing Pantry asks for PANTRY, not for the dashboard',
    nav.fixture.calls, [[VIEWS.PANTRY, null]]);

nav.fixture.calls.length = 0;
for (const b of navButtons) b.props.onClick();
check('pressing every item in order asks for every id in order',
    nav.fixture.calls.map((c) => c[0]), EXPECTED_IDS);
check('no press carries a payload (the bar navigates, it does not hand over data)',
    nav.fixture.calls.every((c) => c[1] === null), true);

/* ------------------------------------------------------------------ summary */

console.log(`\n${failures === 0 ? 'ALL OK' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
