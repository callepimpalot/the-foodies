/**
 * Recipe-selector checks — `node scripts/recipe_selector_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/components/RecipeSelector.jsx` is the picker both consumers of a planned day open — the
 * day card's "Add meal" path (`DayActionSheet`) and the week planner's chat (`WeekPlanChat`). It
 * is the only place in the app where the user hunts a recipe out of the whole library, and it is
 * the smallest module that no check script named: measured 2026-10-18 09:22 UTC across all 51
 * heads (185 `(ref, scripts/*_check.mjs)` blobs), it scores **zero** word-bounded hits in every
 * suite, raw and comment-stripped alike — the one negative probe that stays at 0/0 alongside
 * `Inventory`.
 *
 * WHAT IS PINNED, AND WHY IT IS WORTH PINNING
 *  - The filter is a **case-insensitive substring search over the title OR over any archetype**.
 *    Both halves of the `||` matter and both are `?.`-guarded: the row shape in `final_recipes.json`
 *    carries `archetypes` on some rows and not others, and a search that stops matching archetypes
 *    ("pasta" finding the Italian dishes) is the feature quietly disappearing. A search that only
 *    matched a prefix, or that became case-sensitive, still renders a plausible-looking list.
 *  - The list is **filtered, never reordered** — the library's own order is what the user sees.
 *  - The selection payload is **the recipe object itself**, not its id: `DayActionSheet` does
 *    `setDayRecipe(date, recipe)` while `WeekPlanChat` does `onSetLibraryRecipe(recipe.id)`, so a
 *    component that handed over an id would half-work — one consumer fine, one writing `undefined`
 *    into the plan. That asymmetry is exactly why it is asserted.
 *  - `image_url || image` — both shapes are live in this app (Supabase rows carry `image_url`, the
 *    offline fixture carries `image`), and `RecipeCard`/`DayCard` use the same precedence.
 *  - The time line renders **only when the recipe has a time**, and the archetype chips render
 *    **only when it has archetypes** — with both guards removed the row still renders, so a missing
 *    guard reads as a cosmetic quirk rather than a broken list.
 *  - `Sheet` chrome: the title names the slot the picker was opened for, and the surface is the
 *    kraft-paper `ticket` one (an app-chrome `board` panel here would be a design-system slip).
 *
 * HOW IT RUNS A STATEFUL COMPONENT WITH NO REACT AND NO DOM
 * Same technique as `scripts/stateful_components_check.mjs` (PR #54): `react` is answered with a
 * stub whose `createElement` builds plain `{ type, props }` objects, whose `useState` keeps a
 * persistent slot array and re-renders synchronously into the same mount object. `esbuild` (already
 * present as a Vite dependency — nothing is installed) transforms the `.jsx`; `Sheet` and `Chip`
 * are loaded **for real** and recognised by identity, since the component only ever *builds* those
 * elements and never calls them; `lucide-react` is required normally.
 *
 * `useRecipes()` is the one import that must NOT be loaded for real: it reaches `src/lib/supabase`
 * and builds a network client at import time. It is answered from a stub whose returned `recipes`
 * array is read live on every render, so each section can swap the library and re-mount.
 *
 * NEGATIVE CONTROLS (each in its own fresh scratch layout, the unmutated copy of the SAME layout
 * green at 54 ok / 0 FAIL / exit 0 first, each mutator asserting its anchor matches exactly once,
 * measured 2026-10-18 09:24 UTC):
 *   - title match, case dropped (`r?.title?.includes(search)`) → **50 ok / 4 FAIL, exit 1**
 *   - archetype branch stubbed out (`.some(…)` → `false`) → **41 ok / 10 FAIL, exit 1**
 *   - image precedence broken (`image_url || image` → `image_url`) → **53 ok / 1 FAIL, exit 1**
 *   - time guard dropped (`recipe.time &&` → `true &&`) → **52 ok / 2 FAIL, exit 1**
 *   - selection payload narrowed (`onSelect(recipe)` → `onSelect(recipe.id)`) → **51 ok / 3 FAIL, exit 1**
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * This asserts the element object the component returns, not a rendered screen: no CSS, no layout,
 * no real event dispatch — `onMouseEnter` is asserted by the call it would make, not by a hover.
 * There is no empty-state branch to assert, because the component has none: a search that matches
 * nothing renders an empty grid with the search box still there. And an empty search does **not**
 * list the whole library: a row that has neither a title nor an archetype list is filtered out by
 * the predicate itself (`r?.title?.includes('')` short-circuits to `undefined`), which is asserted
 * below as measured behaviour rather than reported as a crash. `vitest`, `jest`, `jsdom`,
 * `@testing-library/react` and `react-test-renderer` are all absent from `node_modules`; installing
 * one is a human decision.
 *
 * Plain script, non-zero exit on failure — same shape as `scripts/stateful_components_check.mjs`.
 */
import { createRequire, registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

// The app's own `.js` modules import each other extensionlessly (Vite resolves that at build time;
// bare Node does not), and a `.jsx` component's import chain reaches them.
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
    useEffect: () => {},
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

/**
 * Load a `.jsx` module. `stubs` maps a specifier **as written in the source** (e.g.
 * `'../hooks/useRecipes'`) to a function returning that module's exports — called at require time
 * so a stub can read live state.
 */
function loadJsx(relativePathOrUrl, stubs = {}) {
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
        if (Object.prototype.hasOwnProperty.call(stubs, spec)) return stubs[spec]();
        if (typeof spec === 'string' && spec.startsWith('.')) {
            const resolved = resolveSpecifier(baseRequire, spec);
            if (!resolved) throw new Error(`Cannot resolve '${spec}' from ${key}`);
            if (resolved.endsWith('.jsx')) return loadJsx(pathToFileURL(resolved), stubs);
            return baseRequire(resolved);
        }
        return baseRequire(spec);
    };
    const mod = { exports: {} };
    const sandbox = {
        require: moduleRequire,
        module: mod,
        exports: mod.exports,
        console: { error: () => {}, warn: () => {}, log: () => {}, info: () => {} },
        setTimeout: () => 0,
        clearTimeout: () => {},
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

/* ------------------------------------------------------------------ the library fixture, and the stub that serves it */

/** The library the stubbed `useRecipes()` hands back, swapped per section. */
let LIBRARY = [];

const { RecipeSelector } = loadJsx('../src/components/RecipeSelector.jsx', {
    '../hooks/useRecipes': () => ({ useRecipes: () => ({ recipes: LIBRARY }) }),
});
const { Sheet } = loadJsx('../src/components/ui/Sheet.jsx');
const { Chip } = loadJsx('../src/components/ui/Chip.jsx');
const { Clock } = require('lucide-react');

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

function spy() {
    const calls = [];
    const fn = (...args) => { calls.push(args); };
    fn.calls = calls;
    return fn;
}

function kids(el) {
    if (!el || typeof el !== 'object' || !el.props) return [];
    const c = el.props.children;
    if (c === undefined) return [];
    return (Array.isArray(c) ? c : [c]).flat();
}

function findAll(el, pred, acc = []) {
    if (!el || typeof el !== 'object' || !el.props) return acc;
    if (pred(el)) acc.push(el);
    for (const child of kids(el)) findAll(child, pred, acc);
    return acc;
}

function textOf(node) {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(textOf).join('');
    if (node && typeof node === 'object' && node.props) return textOf(node.props.children);
    return '';
}

const byType = (type) => (el) => el.type === type;
const named = (name) => (el) => typeof el.type === 'function' && el.type.name === name;
const classHas = (fragment) => (el) => typeof el.props.className === 'string'
    && el.props.className.includes(fragment);

/* ------------------------------------------------------------------ the fixture library */

const LIB = [
    { id: 'r1', title: 'Chili con Carne', image_url: 'chili.png', time: '45m', archetypes: ['Mexican', 'Comfort'] },
    { id: 'r2', title: 'Pasta Pesto', image: 'pesto.png', archetypes: ['Italian'] },
    { id: 'r3', title: 'Pizza Margherita', image_url: 'pizza.png', time: '30m', archetypes: [] },
    { id: 'r4', title: 'Overnight Oats' },
    { id: 'r5', archetypes: ['Breakfast'] },
];

/* ------------------------------------------------------------------ the sheet chrome */

console.log('\nRecipeSelector — the sheet it opens in');

LIBRARY = LIB;
const selectSpy = spy();
const closeSpy = spy();
const SEL = { onSelect: selectSpy, onClose: closeSpy, slot: 'Friday', date: '2026-10-23' };
let sel = mount(RecipeSelector, SEL);

check('it opens the real Sheet component', sel.tree.type === Sheet, true);
check('the title names the slot it was opened for', sel.tree.props.title, 'Select for Friday');
check('...and it follows the slot it is given', mount(RecipeSelector, { ...SEL, slot: 'Monday' }).tree.props.title,
    'Select for Monday');
check('it uses the kraft-paper ticket surface', sel.tree.props.surface, 'ticket');
check('closing goes straight through to the caller', sel.tree.props.onClose === closeSpy, true);

// Re-mount: `mount()` re-points the re-render target at the newest mount, so the slot check above
// must not be the last mount in the section (a stale instance would swallow every later update).
sel = mount(RecipeSelector, SEL);

const searchBox = () => findAll(sel.tree, byType('input'))[0];
const rowEls = () => findAll(sel.tree, classHas('list-row'));
const titleOfRow = (row) => findAll(row, classHas('t-body'))[0];
const imgOfRow = (row) => findAll(row, byType('img'))[0];
const chipsOfRow = (row) => findAll(row, named('Chip'));
const timeDivOf = (row) => findAll(row, classHas('t-mono'))[0];

console.log('\nRecipeSelector — the search box');

check('there is one search box', findAll(sel.tree, byType('input')).length, 1);
check('it says what it searches', searchBox().props.placeholder, 'Search recipes or archetypes...');
check('it starts empty', searchBox().props.value, '');
check('it is the app\'s input primitive class', searchBox().props.className, 'input');
check('typing goes into state and re-renders', (() => {
    searchBox().props.onChange({ target: { value: 'pasta' } });
    return searchBox().props.value;
})(), 'pasta');

/* ------------------------------------------------------------------ the filter */

console.log('\nRecipeSelector — the case-insensitive substring filter');

const titlesShown = () => rowEls().map((r) => textOf(titleOfRow(r)));
const type = (value) => { searchBox().props.onChange({ target: { value } }); };

sel = mount(RecipeSelector, SEL);
check('an empty search lists the whole library', titlesShown(),
    ['Chili con Carne', 'Pasta Pesto', 'Pizza Margherita', 'Overnight Oats', '']);
check('...in the library\'s own order, filtered never sorted', rowEls().map((r) => r.props.key),
    ['r1', 'r2', 'r3', 'r4', 'r5']);

type('pasta');
check('a search narrows to the matching titles', titlesShown(), ['Pasta Pesto']);
type('esto');
check('the match is a substring anywhere in the title, not a prefix', titlesShown(), ['Pasta Pesto']);
type('PASTA');
check('...and it is case-insensitive against the title', titlesShown(), ['Pasta Pesto']);
type('pAsTa');
check('...in both directions at once', titlesShown(), ['Pasta Pesto']);

type('italian');
check('a search matching only an archetype keeps that recipe', titlesShown(), ['Pasta Pesto']);
type('Italian');
check('...case-insensitively', titlesShown(), ['Pasta Pesto']);
type('MEXI');
check('...and an archetype on a recipe whose title does not match', titlesShown(), ['Chili con Carne']);
type('breakfast');
check('a recipe with an archetype but no title is still findable', titlesShown(), ['']);

type('zzz');
check('a search that matches nothing shows no rows', titlesShown(), []);
check('...but leaves the search box in place (there is no empty-state branch)', searchBox() !== undefined, true);
check('...and it is still the text that was typed', searchBox().props.value, 'zzz');

type('');
check('clearing the search restores the whole library', rowEls().length, 5);

type('oats');
check('a match in a field that is not searched does not keep a row', titlesShown(), ['Overnight Oats']);
type('chili.png');
check('...including the image path', titlesShown(), []);

console.log('\nRecipeSelector — rows the library should not be able to break');

// MEASURED BEHAVIOUR, not a crash: a row with neither a title nor an archetype list is *hidden by
// the filter itself* — `r?.title?.includes('')` short-circuits to `undefined` and
// `[].some(…)` is `false`, so the OR is falsy even for an empty search. Every visible row in this
// app's library has a title, which is why it has never been noticed; the assertion pins it so a
// recipe that loses its title silently disappearing from the picker is a recorded fact.
LIBRARY = [{ id: 'weird' }, { id: 'nulls', title: null, archetypes: null }, { id: 'ok', title: 'Ok', archetypes: ['Thai'] }];
sel = mount(RecipeSelector, SEL);
check('a row with no title and no archetype list is filtered out even with an empty search',
    rowEls().length, 1);
check('...and the one row that has a title is the one that survives', rowEls().map((r) => r.props.key), ['ok']);
type('thai');
check('a null archetype list is not a crash and not a match for everything', titlesShown(), ['Ok']);
LIBRARY = [{ id: 'nullTitle', title: null, archetypes: ['Thai'] }];
sel = mount(RecipeSelector, SEL);
check('a row with an archetype but no title is still listed (an empty search matches its archetype)',
    rowEls().map((r) => r.props.key), ['nullTitle']);
check('...rendering an empty title rather than throwing', textOf(titleOfRow(rowEls()[0])), '');
LIBRARY = null;
sel = mount(RecipeSelector, SEL);
check('a missing recipe library renders an empty list, not a throw', rowEls().length, 0);

/* ------------------------------------------------------------------ the row */

console.log('\nRecipeSelector — what a row shows, and what selecting it hands over');

LIBRARY = LIB;
sel = mount(RecipeSelector, SEL);
const row = (id) => rowEls().find((r) => r.props.key === id);

check('a row is keyed by the recipe id', rowEls().map((r) => r.props.key), ['r1', 'r2', 'r3', 'r4', 'r5']);
check('a row is a pointer-target with the list-row class', row('r1').props.className, 'list-row');
check('a row shows the recipe title', textOf(titleOfRow(row('r2'))), 'Pasta Pesto');
check('the image prefers `image_url`', imgOfRow(row('r1')).props.src, 'chili.png');
check('...and falls back to `image`, the offline fixture\'s key', imgOfRow(row('r2')).props.src, 'pesto.png');
check('a recipe with neither carries no usable image source', imgOfRow(row('r4')).props.src, undefined);
check('the image is decorative (empty alt)', imgOfRow(row('r1')).props.alt, '');

check('a recipe with a time shows it', textOf(timeDivOf(row('r1'))), '45m');
check('...and the clock icon comes with it', timeDivOf(row('r1')).props.children[0].type === Clock, true);
check('a recipe with no time shows no time line at all', timeDivOf(row('r2')), undefined);
check('...rather than an empty one', timeDivOf(row('r4')), undefined);

check('one chip per archetype, in order', chipsOfRow(row('r1')).map((c) => c.props.label),
    ['Mexican', 'Comfort']);
check('...each keyed by its own label', chipsOfRow(row('r1')).map((c) => c.props.key), ['Mexican', 'Comfort']);
check('...and rendered as the static tag variant, not an interactive filter',
    chipsOfRow(row('r1')).map((c) => c.props.variant), ['tag', 'tag']);
check('an empty archetype list renders no chips', chipsOfRow(row('r3')).length, 0);
check('a row with no archetypes key renders no chips', chipsOfRow(row('r4')).length, 0);

console.log('\nRecipeSelector — selection');

selectSpy.calls.length = 0;
row('r2').props.onClick();
check('selecting a row hands over the recipe object itself', selectSpy.calls.length, 1);
check('...the very object from the library', selectSpy.calls[0][0] === LIB[1], true);
check('...not just its id (one consumer writes recipe.id, the other the whole row)',
    selectSpy.calls[0][0] === 'r2', false);
selectSpy.calls.length = 0;
row('r5').props.onClick();
check('a title-less recipe still hands over its row', selectSpy.calls[0][0] === LIB[4], true);
check('selecting does not close the sheet itself — the caller decides', closeSpy.calls.length, 0);
check('every row can be selected', (() => {
    selectSpy.calls.length = 0;
    for (const r of rowEls()) r.props.onClick();
    return selectSpy.calls.length;
})(), 5);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
