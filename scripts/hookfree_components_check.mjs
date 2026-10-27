/**
 * Hook-free component checks — `node scripts/hookfree_components_check.mjs`
 *
 * WHY THIS EXISTS
 * `scripts/ui_primitives_check.mjs` (PR #52) took the four hook-free `ui/` primitives out of the
 * uncovered set and its header then claimed the rest of the presentational layer was out of reach
 * because "they call a hook or a context". That claim is too broad, and it is measured wrong here:
 * of the 23 `.jsx` modules still named by no suite (re-measured across every remote head below),
 * **four call no hook and consume no context at all** — `ui/Sheet.jsx`, `RecipeFilterSheet.jsx`,
 * `RecipeSearchBar.jsx` and `MealPreviewModal.jsx`. They are prop-driven and pure, so the same
 * in-memory `esbuild` transform + `vm` technique that reaches `Button` reaches them too. This file
 * covers all four, which closes the last part of the presentational layer that is reachable from a
 * zero-dependency Node process.
 *
 * WHAT IS PINNED, AND WHY IT IS WORTH PINNING
 *  - `Sheet`: the `surface`→class/divider-token map (`card` vs `card-board`, `--ticket-shadow` vs
 *    `--line`), the header that renders only when there is a title or a close button, the two body
 *    padding rules that depend on exactly that (`paddingTop` 0 vs 20) and on the footer
 *    (`paddingBottom` 20 vs the safe-area calc), the overlay click that closes and the inner click
 *    that must NOT (the classic bottom-sheet bug), and the pinned max width.
 *  - `RecipeFilterSheet`: the composite filter key `${group.id}:${option.id}`. This is the contract
 *    the whole filter flow is keyed on, and it is the bug class PR #17 was about — a key that
 *    collides across groups silently toggles the wrong chip. Two groups sharing an option id is the
 *    case pinned here.
 *  - `RecipeSearchBar`: the clear affordance exists only while there is something to clear, and both
 *    callbacks are wired to the value they must carry (`onChange(e.target.value)` upward,
 *    `onChange('')` on clear).
 *  - `MealPreviewModal`: the branches that decide what the user sees — the kcal tag's
 *    `Number(x) ? Math.round(x) : null` rule (a missing, zero or non-numeric kcal renders NO tag),
 *    the ingredient line formatting for both the object and the string shape, the image fallback,
 *    and the `source` gate that decides which of "Add to Plan" / "Cook Now" exist. That
 *    `source`-gated pair is the difference between a modal that can be acted on and one that cannot.
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * This is a node-level logic check: it asserts the element object a component returns, not a
 * rendered screen. It mounts nothing, resolves no CSS, and cannot reach a `.jsx` module that calls a
 * hook or a context — the remaining 19 presentational modules (`src/components/*`, `src/views/*`,
 * `src/context/*`) all do, and `vitest`, `jest`, `jsdom`, `@testing-library/react` and
 * `react-test-renderer` are all absent from `node_modules`. Installing one is a human decision.
 *
 * `MealPreviewModal` renders through `createPortal`, which validates its container, so the one
 * global it needs is a `document.body` stub with a `nodeType`. That stub is not a DOM: nothing is
 * rendered into it, it exists only to satisfy the container check so the portal object (and the
 * `Sheet` element inside it) can be asserted on.
 *
 * Plain script, non-zero exit on failure — same shape as scripts/task07_check.mjs.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

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

/** Resolve a module specifier the way Vite does: extensionless relatives get `.jsx`/`.js`. */
function resolveSpecifier(baseRequire, spec) {
    const candidates = [spec, `${spec}.jsx`, `${spec}.js`, `${spec}/index.jsx`, `${spec}/index.js`];
    for (const candidate of candidates) {
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

/** Transform a `.jsx` file in memory and hand back its exports. No DOM, no bundler, no temp file. */
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
    // Relatives are resolved and loaded through this same loader, so a `.jsx` import chain works
    // (RecipeFilterSheet → ./ui/Sheet). Bare specifiers (react, lucide-react, react-dom) go to node_modules.
    const moduleRequire = (spec) => {
        if (typeof spec === 'string' && spec.startsWith('.')) {
            const resolved = resolveSpecifier(baseRequire, spec);
            if (!resolved) throw new Error(`Cannot resolve '${spec}' from ${key}`);
            if (resolved.endsWith('.jsx')) return loadJsx(pathToFileURL(resolved));
            return baseRequire(resolved);
        }
        return baseRequire(spec);
    };
    const mod = { exports: {} };
    const sandbox = { require: moduleRequire, module: mod, exports: mod.exports };
    if (globals) Object.assign(sandbox, globals);
    moduleCache.set(key, mod.exports);
    vm.runInNewContext(code, sandbox, { filename: key });
    moduleCache.set(key, mod.exports);
    return mod.exports;
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

/** A call recorder — structural comparison of "what did this callback get called with". */
function spy() {
    const calls = [];
    const fn = (...args) => { calls.push(args); };
    fn.calls = calls;
    return fn;
}

/** React children, normalised to an array (a single child is not an array). */
function kids(el) {
    if (!el || typeof el !== 'object' || !el.props) return [];
    const c = el.props.children;
    if (c === undefined) return [];
    return Array.isArray(c) ? c : [c];
}

/** Every element object in the tree (in render order) that satisfies `pred`. */
function findAll(el, pred, acc = []) {
    if (!el || typeof el !== 'object' || !el.props) return acc;
    if (pred(el)) acc.push(el);
    for (const child of kids(el)) findAll(child, pred, acc);
    return acc;
}

/** Every string reachable through `props.children`, concatenated — "what the user reads". */
function textOf(node) {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(textOf).join('');
    if (node && typeof node === 'object' && node.props) return textOf(node.props.children);
    return '';
}

const byClass = (className) => (el) => el.props.className === className;
const byAria = (label) => (el) => el.props['aria-label'] === label;
const byStyle = (key, value) => (el) => el.props.style && el.props.style[key] === value;

const { Sheet } = loadJsx('../src/components/ui/Sheet.jsx');
const { RecipeFilterSheet } = loadJsx('../src/components/RecipeFilterSheet.jsx');
const { RecipeSearchBar } = loadJsx('../src/components/RecipeSearchBar.jsx');
// The portal container stub: `createPortal` refuses anything without a `nodeType`. Nothing renders into it.
const { MealPreviewModal } = loadJsx('../src/components/MealPreviewModal.jsx', {
    document: { body: { nodeType: 1, nodeName: 'BODY' } },
});

/* ------------------------------------------------------------------ Sheet */

console.log('\nSheet — the surface map');

const overlayOf = (tree) => findAll(tree, byStyle('inset', 0))[0];
const panelOf = (tree) => findAll(tree, byStyle('maxWidth', '480px'))[0];
const bodyOf = (tree) => findAll(tree, byStyle('overflowY', 'auto'))[0];
const footerOf = (tree) => findAll(tree, (el) => Boolean(el.props.style && el.props.style.borderTop))[0];
const headerOf = (tree) => findAll(tree,
    (el) => Boolean(el.props.style && el.props.style.padding === '20px 20px 12px'))[0];

const closeSpy = spy();
const ticket = Sheet({ title: 'Filters', onClose: closeSpy, children: 'BODY' });
const board = Sheet({ title: 'Filters', surface: 'board', onClose: closeSpy, children: 'BODY' });

check('the overlay is a fixed full-screen div', overlayOf(ticket).type, 'div');
check('...above the app chrome (zIndex 60)', overlayOf(ticket).props.style.zIndex, 60);
check('the default surface renders the ticket card', panelOf(ticket).props.className, 'animate-slide-up card');
check('surface="board" renders the board card instead', panelOf(board).props.className, 'animate-slide-up card-board');
check('an unknown surface is treated as board, not as ticket', panelOf(Sheet({ surface: 'nope', children: 'x' })).props.className,
    'animate-slide-up card-board');
check('the panel is capped at 480px', panelOf(ticket).props.style.maxWidth, '480px');
check('...and at 88vh tall', panelOf(ticket).props.style.maxHeight, '88vh');

console.log('\nSheet — click to close, but not through the panel');

const clicked = Sheet({ onClose: closeSpy, children: 'BODY' });
const stopEvent = { stopped: false, stopPropagation() { this.stopped = true; } };
panelOf(clicked).props.onClick(stopEvent);
check('a click inside the panel stops propagating', stopEvent.stopped, true);
check('...and never reaches onClose', closeSpy.calls, []);
overlayOf(clicked).props.onClick();
check('a click on the overlay does call onClose', closeSpy.calls, [[]]);
check('the overlay click IS the onClose callback (no wrapper)', overlayOf(clicked).props.onClick === closeSpy, true);

console.log('\nSheet — the header exists only when it has something to show');

check('a title renders an h2 with the heading class',
    headerOf(ticket) && headerOf(ticket).props.children[0].props.className, 't-heading-md');
check('...carrying the title text', headerOf(ticket) && textOf(headerOf(ticket).props.children[0]), 'Filters');
check('a close button renders with its aria-label',
    headerOf(ticket) && headerOf(ticket).props.children[1].props['aria-label'], 'Close');
check('the close button closes', headerOf(ticket) && headerOf(ticket).props.children[1].props.onClick === closeSpy, true);
check('a title with no onClose renders no close button',
    headerOf(Sheet({ title: 'Filters', children: 'x' })).props.children[1], undefined);
const withCloseOnly = Sheet({ onClose: () => {}, children: 'x' });
check('an onClose with no title still renders the header (the spacer keeps the button right-aligned)',
    headerOf(withCloseOnly) && headerOf(withCloseOnly).props.children[0].type, 'span');
check('neither a title nor an onClose renders no header at all',
    headerOf(Sheet({ children: 'x' })), undefined);

console.log('\nSheet — the body padding rules');

const footed = Sheet({ title: 'T', footer: 'FOOT', children: 'x' });

check('a header means the body carries no top padding', bodyOf(ticket).props.style.paddingTop, 0);
check('no header means the body pads itself', bodyOf(Sheet({ children: 'x' })).props.style.paddingTop, 20);
check('a footer means the body does not carry the safe-area inset', bodyOf(footed).props.style.paddingBottom, 20);
check('no footer means the body carries the safe-area inset itself',
    bodyOf(Sheet({ title: 'T', children: 'x' })).props.style.paddingBottom,
    'calc(20px + env(safe-area-inset-bottom, 0px))');
check('the children render in the body', bodyOf(ticket).props.children, 'BODY');
check('the body is the scrolling element', bodyOf(ticket).props.style.overflowY, 'auto');

console.log('\nSheet — the footer and its divider token');

check('no footer prop renders no footer element', footerOf(Sheet({ title: 'T', children: 'x' })), undefined);
check('a footer renders below the body', kids(panelOf(footed)).indexOf(footerOf(footed)),
    kids(panelOf(footed)).length - 1);
check('the ticket surface divides with the ticket token', footerOf(footed).props.style.borderTop,
    '1px solid var(--ticket-shadow)');
check('the board surface divides with the line token',
    footerOf(Sheet({ title: 'T', surface: 'board', footer: 'FOOT', children: 'x' })).props.style.borderTop,
    '1px solid var(--line)');
check('the footer content renders inside it', textOf(footerOf(footed)), 'FOOT');

/* ------------------------------------------------------ RecipeFilterSheet */

console.log('\nRecipeFilterSheet — the composite filter key');

const GROUPS = [
    { id: 'creator', label: 'Creator', options: [{ id: 'anna', label: 'Anna' }, { id: 'bo', label: 'Bo' }] },
    { id: 'tag', label: 'Tag', options: [{ id: 'anna', label: 'anna-tag' }] },   // same option id, different group
];
const toggle = spy();
const clear = spy();
const close = spy();
const filters = RecipeFilterSheet({
    groups: GROUPS, activeKeys: ['creator:anna'], onToggle: toggle, onClear: clear, onClose: close,
});

check('it renders the shared Sheet, not its own overlay', filters.type === Sheet, true);
check('...with the Filters title', filters.props.title, 'Filters');
check('...on the board surface (chrome, not a recipe)', filters.props.surface, 'board');
check('...forwarding onClose', filters.props.onClose === close, true);

const chips = findAll(filters, (el) => el.props.label && el.props.active !== undefined
    && typeof el.props.onClick === 'function' && el.props.onClick !== close);
check('one chip per option, across every group', chips.length, 3);
check('the chip labels are the option labels', chips.map((c) => c.props.label), ['Anna', 'Bo', 'anna-tag']);
check('only the key named in activeKeys is active', chips.map((c) => c.props.active), [true, false, false]);
check('the same option id in another group is NOT active — the key is group-scoped',
    chips[2].props.active, false);
chips[1].props.onClick();
check('a chip toggles the composite key `${group.id}:${option.id}`', toggle.calls, [['creator:bo']]);
chips[2].props.onClick();
check('...and the group prefix is the group, not the label', toggle.calls[1], ['tag:anna']);

console.log('\nRecipeFilterSheet — groups, headings and the footer pair');

check('each group gets a heading', findAll(filters, byClass('t-eyebrow')).length, 2);
check('the headings carry the group labels',
    findAll(filters, byClass('t-eyebrow')).map((h) => textOf(h)), ['Creator', 'Tag']);
const footerButtons = kids(filters.props.footer);
check('the footer is a Clear all / Show results pair', footerButtons.length, 2);
check('...labelled', footerButtons.map((b) => textOf(b)), ['Clear all', 'Show results']);
check('...with the secondary/primary weighting', footerButtons.map((b) => b.props.variant),
    ['secondary', 'primary']);
check('Clear all clears', footerButtons[0].props.onClick === clear, true);
check('Show results closes (it does not clear)', footerButtons[1].props.onClick === close, true);
check('an empty group list renders no headings',
    findAll(RecipeFilterSheet({ groups: [], activeKeys: [], onToggle: spy(), onClear: spy(), onClose: spy() }),
        byClass('t-eyebrow')).length, 0);

/* -------------------------------------------------------- RecipeSearchBar */

console.log('\nRecipeSearchBar — the input and the conditional clear');

const onChange = spy();
const filled = RecipeSearchBar({ value: 'soup', onChange });
const empty = RecipeSearchBar({ value: '', onChange });
const fieldOf = (el) => findAll(el, (n) => n.type === 'input')[0];

check('the search field is an input', fieldOf(filled).type, 'input');
check('...showing the current value', fieldOf(filled).props.value, 'soup');
check('...with a search keyboard hint', fieldOf(filled).props.inputMode, 'search');
check('...and a placeholder that says what is searchable', fieldOf(filled).props.placeholder,
    'Search recipes, ingredients, tags...');
fieldOf(filled).props.onChange({ target: { value: 'stew' } });
check('typing reports the value, not the event', onChange.calls, [['stew']]);

const clearButton = (el) => findAll(el, byAria('Clear search'))[0];
check('the clear button exists while there is a value', Boolean(clearButton(filled)), true);
check('...and is absent when the field is empty', clearButton(empty), undefined);
clearButton(filled).props.onClick();
check('clearing reports an empty value', onChange.calls[1], ['']);

/* ------------------------------------------------------- MealPreviewModal */

console.log('\nMealPreviewModal — what it refuses to render');

check('no recipe renders nothing at all', MealPreviewModal({ recipe: null }), null);
check('...and undefined is the same as null', MealPreviewModal({}), null);

/** A portal is not an element tree — take the Sheet element it wraps. */
const modalOf = (props) => MealPreviewModal({ onClose: spy(), onAddToPlan: spy(), onCookNow: spy(), ...props }).children;

const RECIPE = {
    title: 'Lentil Soup',
    time: '35 min',
    kcal: '210.6',
    description: 'Warming.',
    image_url: 'https://example.test/soup.jpg',
    ingredients: [{ amount: '2', unit: 'tbsp', item: 'olive oil' }, { amount: '1', name: 'onion' }, 'a pinch of salt'],
};
const modal = MealPreviewModal({ recipe: RECIPE, onClose: close, onAddToPlan: spy(), onCookNow: spy() });
const sheetInPortal = modal.children;

check('it renders through a portal', typeof modal.$$typeof, 'symbol');
check('...into document.body', modal.containerInfo, { nodeType: 1, nodeName: 'BODY' });
check('...wrapping the ticket-surface Sheet', sheetInPortal.type === Sheet && sheetInPortal.props.surface,
    'ticket');
check('the title is the recipe title', textOf(findAll(sheetInPortal, byClass('t-heading-lg'))[0]), 'Lentil Soup');
check('the cooking time is badged when present', textOf(findAll(sheetInPortal, byClass('badge-grease t-mono'))[0]),
    '35 min');
check('...and not when absent',
    findAll(modalOf({ recipe: { title: 'R', ingredients: [] } }), byClass('badge-grease t-mono')).length, 0);

console.log('\nMealPreviewModal — the kcal rule (Number(x) ? Math.round(x) : null)');

check('a fractional kcal is rounded, not truncated', textOf(findAll(sheetInPortal, byClass('tag t-mono'))[0]),
    '211 kcal');
check('0.6 rounds up', textOf(findAll(modalOf({ recipe: { title: 'R', kcal: '210.4', ingredients: [] } }),
    byClass('tag t-mono'))[0]), '210 kcal');
check('a zero kcal renders no tag',
    findAll(modalOf({ recipe: { title: 'R', kcal: 0, ingredients: [] } }), byClass('tag t-mono')).length, 0);
check('a missing kcal renders no tag',
    findAll(modalOf({ recipe: { title: 'R', ingredients: [] } }), byClass('tag t-mono')).length, 0);
check('a non-numeric kcal renders no tag rather than a NaN badge',
    findAll(modalOf({ recipe: { title: 'R', kcal: 'lots', ingredients: [] } }), byClass('tag t-mono')).length, 0);

console.log('\nMealPreviewModal — the ingredient lines');

const lines = findAll(sheetInPortal, byClass('list-row')).map((row) => textOf(row));
check('there is one line per ingredient', lines.length, 3);
check('an amount+unit+item object renders in that order', lines[0].endsWith('2 tbsp olive oil'), true);
check('an item-less object falls back to `name`', lines[1].includes('onion'), true);
check('...and never leaks `undefined` into the line', lines[1].includes('undefined'), false);
check('a plain string ingredient passes through unchanged', lines[2], '•a pinch of salt');

console.log('\nMealPreviewModal — the description and the image fallback');

check('a description renders', textOf(findAll(sheetInPortal, byStyle('lineHeight', 1.6))[0]), 'Warming.');
check('no description renders no paragraph',
    findAll(modalOf({ recipe: { title: 'R', ingredients: [] } }), byStyle('lineHeight', 1.6)).length, 0);
const imageOf = (el) => findAll(el, (n) => n.props.style && typeof n.props.style.backgroundImage === 'string')[0];
check('the hero image uses the recipe image', imageOf(sheetInPortal).props.style.backgroundImage,
    'url(https://example.test/soup.jpg)');
const fallback = imageOf(modalOf({ recipe: { title: 'R', ingredients: [] } })).props.style.backgroundImage;
check('...and falls back to a stock photo, never to url(undefined)',
    fallback.startsWith('url(https://images.unsplash.com/') && !fallback.includes('undefined'), true);

console.log('\nMealPreviewModal — the source gate on the footer actions');

const footerOfModal = (source) => MealPreviewModal({
    recipe: RECIPE, source, onClose: spy(), onAddToPlan: spy(), onCookNow: spy(),
}).children.props.footer.props.children;
check('from the library both actions exist', footerOfModal('library').map((b) => Boolean(b)), [true, true]);
check('...and the second one is Cook Now', footerOfModal('library')[1].props.variant, 'primary');
check('from the hero there is no Add to Plan, only Cook Now',
    footerOfModal('hero').map((b) => Boolean(b)), [false, true]);
check('from any other source neither action exists',
    footerOfModal('pantry').map((b) => Boolean(b)), [false, false]);
check('the default source is the library path', footerOfModal(undefined).map((b) => Boolean(b)), [true, true]);

console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
