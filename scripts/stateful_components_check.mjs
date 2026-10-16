/**
 * Stateful component checks — `node scripts/stateful_components_check.mjs`
 *
 * WHY THIS EXISTS
 * `scripts/ui_primitives_check.mjs` (PR #52) reached the four hook-free `ui/` primitives with an
 * in-memory `esbuild` transform + `vm`; `scripts/hookfree_components_check.mjs` (PR #53) reached
 * four more. #53's header then says the remaining 19 presentational modules "all call a hook or a
 * context", and that the technique "cannot reach a `.jsx` module that calls a hook or a context".
 * The first half is true. The second is too broad, and this file measures it: a **`useState` is a
 * hook the harness can supply itself** — the repo has been running a hand-written `useState`
 * dispatcher for `src/hooks/*` since PR #49/#51 — so a component that calls `useState` but
 * **consumes no context** is reachable with no DOM and no reconciler at all.
 *
 * Read from their import blocks, **five** of #53's 19 consume no context module: `AddToPlanModal`,
 * `DayCard`, `QuickAddModal`, `RecipeDaySheet` and `DishCurationFlow`. This file covers the first
 * four; `DishCurationFlow` (335 lines, 10 state slots) is the same class and is left for a later
 * fire rather than half-asserted here.
 *
 * WHAT IS PINNED, AND WHY IT IS WORTH PINNING
 *  - `AddToPlanModal`: the seven-day strip — seven distinct consecutive ISO dates starting today,
 *    **exactly one active day**, the active state moving on click, and Confirm reporting the date
 *    the user last tapped (not the initial one). A strip where all seven buttons carry today's
 *    date still renders, and silently plans every meal onto today.
 *  - `DayCard`: the row's three state branches (empty / note / leftover / recipe), the icon and
 *    badge that go with each, `image` preferred over `image_url`, the deliberate "a locked week
 *    still lets you LOOK at what is cooking" tap rule, and the two-click remove gate — arm, wait
 *    3 s, re-arm — which is the one behaviour here with a timer in it. A remove button that fires
 *    on the first tap is a one-tap delete of a planned meal.
 *  - `QuickAddModal`: category chips driven by `commonItems` (exactly one active, the active one's
 *    items in the grid), toggle-on/toggle-off, the count-and-plural on the Add button, its
 *    disabled state at zero, and the exact payload handed to `onAdd`.
 *  - `RecipeDaySheet`: servings scaling — `ratio = servings / baseServings` with the zero base
 *    guarded, quantities rounded to 2 dp, a null quantity staying null rather than becoming `NaN`
 *    — the 1..20 clamps, the null-draft branch, the `{ recipe, servings }` lock-in payload, and the
 *    refine path: refused while empty, and on a failed call it surfaces the message, re-enables
 *    Send and KEEPS the typed instruction instead of silently dropping the user's text.
 *
 * HOW IT RUNS A STATEFUL COMPONENT WITH NO REACT AND NO DOM
 * A component is just a function returning an element tree, so the harness calls it. `react` is
 * answered with a stub whose `createElement` builds plain `{ type, props }` objects (JSX is
 * transformed to `React.createElement` calls by `esbuild`, which is already present as a Vite
 * dependency — nothing is installed), whose `useState` keeps a persistent slot array and
 * re-renders synchronously into the same mount object, and whose `Fragment` is a marker. Child
 * components are elements, never invoked, so `Sheet`/`Button`/`Chip` are asserted on by their
 * props. `registerHooks` resolves the app's extensionless relative imports for the `.js` chain a
 * component reaches (`../lib/recipeExtraction` → `./imageUtils`), and `setTimeout` is recorded
 * rather than scheduled so `DayCard`'s 3 s re-arm can be fired by hand.
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * This asserts the element object a component returns, not a rendered screen. No CSS, no layout,
 * no event bubbling — `stopPropagation` is asserted by the call the component makes, not by a real
 * dispatch. Effects are not modelled. The remaining 15 of the 19 consume a context and stay out of
 * reach (their providers' identity is what the assertion would depend on), and `vitest`, `jest`,
 * `jsdom`, `@testing-library/react` and `react-test-renderer` are all absent from `node_modules`;
 * installing one is a human decision.
 *
 * One guard in `DayCard` is deliberately left unpinned because **nothing can reach it**:
 * `handleRemoveClick` returns early `if (isPlanConfirmed)`, but a locked card renders no remove
 * button at all (`{!isEmpty && !isPlanConfirmed && …}`), so the early return is unreachable from
 * the tree this harness can see. Measured, not assumed: deleting that line outright leaves this
 * suite at **118 ok / 0 FAIL / exit 0** — green — which is why the control below mutates the
 * render gate that actually protects it.
 *
 * NEGATIVE CONTROLS (each in its own fresh scratch layout, the unmutated copy of the SAME layout
 * green at 118 ok / 0 FAIL / exit 0 first, and each mutator asserting its anchor matches exactly
 * once so no control can silently become a no-op). Measured, one run per control:
 *   - `AddToPlanModal` day strip: `date.getDate() + i` → `+ 0` → **110 ok / 8 FAIL, exit 1** (every
 *     day is today: 7 identical keys, 7 "active" buttons, and Confirm reports the wrong day).
 *   - `DayCard` remove button: drop `&& !isPlanConfirmed` from the render gate → **116 ok / 2 FAIL,
 *     exit 1** (a locked week offers a remove button).
 *   - `DayCard` re-arm timer: `3000` → `2000` → **117 ok / 1 FAIL, exit 1** (the arm expires twice
 *     as fast as it says).
 *   - `QuickAddModal` toggle: the `find ? filter : push` pair → always `[...prev, item]` → **115
 *     ok / 3 FAIL, exit 1** (an item can never be deselected, and the payload carries it twice).
 *   - `RecipeDaySheet` scaling: `Math.round(q * ratio * 100) / 100` → `q * ratio` → **116 ok / 2
 *     FAIL, exit 1** (unrounded quantities on screen).
 *   - `RecipeDaySheet` stepper: `Math.max(1, s - 1)` → `s - 1` → **117 ok / 1 FAIL, exit 1** (a day
 *     can be planned for zero servings).
 *   - `DayCard` image: `image || image_url` → `image_url` → **117 ok / 1 FAIL, exit 1**.
 *
 * Plain script, non-zero exit on failure — same shape as `scripts/hookfree_components_check.mjs`.
 */
import { createRequire, registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
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

/** Recorded timers (a component's `setTimeout` never actually fires here) and console calls. */
const timers = [];
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
        console: {
            error: (...args) => logged.push(['error', ...args]),
            warn: (...args) => logged.push(['warn', ...args]),
            log: () => {},
            info: () => {},
        },
        setTimeout: (cb, ms) => { timers.push({ cb, ms }); return timers.length; },
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

/** A call recorder — structural comparison of "what did this callback get called with". */
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
    // A `{arr.map(...)}` child is itself an array, and it is one of several children whenever an
    // element mixes a mapped list with literals — so flatten one level of nesting.
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
const byClass = (className) => (el) => el.props.className === className;
const classHas = (fragment) => (el) => typeof el.props.className === 'string'
    && el.props.className.includes(fragment);
const named = (name) => (el) => typeof el.type === 'function' && el.type.name === name;
const textHas = (fragment) => (el) => textOf(el).includes(fragment);

const { DayCard } = loadJsx('../src/components/DayCard.jsx');
const { AddToPlanModal } = loadJsx('../src/components/AddToPlanModal.jsx');
const { QuickAddModal } = loadJsx('../src/components/QuickAddModal.jsx');
const { RecipeDaySheet } = loadJsx('../src/components/RecipeDaySheet.jsx');
const { commonItems } = require(join(dirname(here), '..', 'src', 'data', 'commonItems.js'));

const iso = (d) => d.toISOString().split('T')[0];
const TODAY = iso(new Date());
const inDays = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
};

/** Fire a recorded timer (the only one with a callback — console calls are not timers). */
function pendingTimers() {
    return timers.filter((t) => t.cb);
}

/* ------------------------------------------------------------ AddToPlanModal */

console.log('\nAddToPlanModal — the seven-day strip');

const confirmSpy = spy();
const closeSpy = spy();
const RECIPE = { id: 'r1', title: 'Chili' };
const modalProps = { recipe: RECIPE, onClose: closeSpy, onConfirm: confirmSpy };
let modal = mount(AddToPlanModal, modalProps);

const dayButtons = () => findAll(modal.tree, (el) => el.type === 'button');
const footerButtons = () => kids(modal.tree.props.footer);
const activeDays = () => dayButtons().filter((b) => b.props.style.border.includes('var(--stamp)'));

check('it opens a Sheet titled "Add to Plan"', modal.tree.props.title, 'Add to Plan');
check('the Sheet closes through onClose', modal.tree.props.onClose === closeSpy, true);
check('the sheet asks the user to select a day', textOf(modal.tree).includes('Select Day'), true);
check('there are exactly seven days to pick from', dayButtons().length, 7);
check('...one per consecutive date, starting today',
    dayButtons().map((b) => b.props.key),
    [0, 1, 2, 3, 4, 5, 6].map((n) => iso(inDays(n))));
check('the weekday label is the short locale name',
    dayButtons()[0].props.children[0].props.children,
    inDays(0).toLocaleDateString('en-US', { weekday: 'short' }));
check('the day number is the date of the month', dayButtons()[0].props.children[1].props.children, inDays(0).getDate());
check('today is the selected day on open', dayButtons()[0].props.key, TODAY);
check('...and it is the only selected one', activeDays().length, 1);
check('the selected day is outlined with the stamp token',
    activeDays()[0].props.style.border, '1px solid var(--stamp)');
check('...filled with the stamp tint', activeDays()[0].props.style.background, 'var(--stamp-tint)');
check('an unselected day uses the ticket-shadow border',
    dayButtons()[1].props.style.border, '1px solid var(--ticket-shadow)');
check('...and no fill', dayButtons()[1].props.style.background, 'transparent');

console.log('\nAddToPlanModal — selection moves, and Confirm reports it');

dayButtons()[2].props.onClick();
check('clicking a day selects that day', activeDays().length, 1);
check('...the one that was clicked', activeDays()[0].props.key, iso(inDays(2)));
check('...and today is no longer selected', dayButtons()[0].props.style.border, '1px solid var(--ticket-shadow)');

footerButtons()[1].props.onClick();
check('Confirm reports the day the user last tapped', confirmSpy.calls, [[iso(inDays(2)), RECIPE]]);
check('Confirm carries the recipe it was opened with', confirmSpy.calls[0][1] === RECIPE, true);

closeSpy.calls.length = 0;
footerButtons()[0].props.onClick();
check('Cancel closes without confirming', [closeSpy.calls.length, confirmSpy.calls.length], [1, 1]);
check('the Confirm button is the primary one', footerButtons()[1].props.variant, 'primary');
check('the Cancel button is the secondary one', footerButtons()[0].props.variant, 'secondary');

/* ------------------------------------------------------------------ DayCard */

console.log('\nDayCard — the empty day');

const tapSpy = spy();
const removeSpy = spy();
const viewSpy = spy();
const cardProps = {
    dayName: 'Fri', dayNum: 16, isToday: false, isPast: false,
    resolved: null, onDayClick: tapSpy, onRemove: removeSpy, onViewRecipe: viewSpy, isPlanConfirmed: false,
};
const card = mount(DayCard, cardProps);
const rowsOf = (c) => findAll(c.tree, byType('button'));
const titleOf = (c) => findAll(c.tree, classHas('t-body truncate'))[0];
const dayNumOf = (c) => findAll(c.tree, classHas('t-mono leading-none'))[0];
const badgeOf = (c) => findAll(c.tree, classHas('badge-grease'))[0];
const imageOf = (c) => findAll(c.tree, byType('img'))[0];
const removeBtnOf = (c) => rowsOf(c)[0];

check('an empty day offers "Add meal"', textOf(titleOf(card)), 'Add meal');
check('...in italic, as a placeholder', titleOf(card).props.className.includes('italic'), true);
check('...and is tappable', card.tree.props.className.includes('cursor-pointer'), true);
check('no remove button exists until there is something to remove', removeBtnOf(card), undefined);
check('the empty slot has a dashed border', findAll(card.tree, classHas('border-dashed')).length, 1);
check('a day that is not today uses the ink token', dayNumOf(card).props.style.color, 'var(--ink)');
check('tapping an empty day opens the day picker', (card.tree.props.onClick(), tapSpy.calls.length), 1);

console.log('\nDayCard — today, past days, and the icon per state');

const todayCard = mount(DayCard, { ...cardProps, isToday: true });
check('today is stamped', dayNumOf(todayCard).props.style.color, 'var(--stamp)');

const pastCard = mount(DayCard, { ...cardProps, isPast: true, resolved: { type: 'recipe', recipe: { title: 'Stew' } } });
check('a past day is dimmed', pastCard.tree.props.className.includes('opacity-50'), true);
check('...and does not take pointer events', pastCard.tree.props.className.includes('pointer-events-none'), true);

const noteCard = mount(DayCard, { ...cardProps, resolved: { type: 'note', note: 'Eating out' } });
check('a note renders its text', textOf(titleOf(noteCard)), 'Eating out');
check('a note carries no badge', badgeOf(noteCard), undefined);
check('a note carries no image', imageOf(noteCard), undefined);
check('a note row is not tappable (there is no recipe to open)',
    noteCard.tree.props.className.includes('cursor-pointer'), false);
tapSpy.calls.length = 0;
noteCard.tree.props.onClick();
check('...and tapping it does nothing at all', [tapSpy.calls.length, viewSpy.calls.length], [0, 0]);

const leftoverCard = mount(DayCard, {
    ...cardProps,
    resolved: { type: 'leftover', recipe: { title: 'Chili', image_url: 'leftover.png' } },
});
check('a leftover is labelled as such', textOf(badgeOf(leftoverCard)), 'Leftovers');
check('...shows the picture of what is left', imageOf(leftoverCard) && imageOf(leftoverCard).props.src, 'leftover.png');
check('...and carries the recipe title', textOf(titleOf(leftoverCard)), 'Chili');

const recipeCard = mount(DayCard, {
    ...cardProps,
    resolved: { type: 'recipe', recipe: { title: 'Pasta', image: 'hero.png', image_url: 'thumb.png' } },
});
check('a planned recipe prefers `image` over `image_url`', imageOf(recipeCard) && imageOf(recipeCard).props.src, 'hero.png');
check('...and has no badge', badgeOf(recipeCard), undefined);
check('a recipe with no image falls back to the image_url',
    imageOf(mount(DayCard, { ...cardProps, resolved: { type: 'recipe', recipe: { title: 'X', image_url: 'thumb.png' } } })).props.src,
    'thumb.png');
check('a recipe with no title still reads as something', textOf(titleOf(
    mount(DayCard, { ...cardProps, resolved: { type: 'recipe', recipe: { image_url: 'x.png' } } }))), 'Unknown');

console.log('\nDayCard — tapping, and the locked week');

tapSpy.calls.length = 0;
viewSpy.calls.length = 0;
recipeCard.tree.props.onClick();
check('tapping a planned meal opens the recipe', viewSpy.calls, [[recipeCard.props.resolved.recipe]]);
check('...instead of the day picker', tapSpy.calls, []);

const lockedCard = mount(DayCard, {
    ...cardProps,
    isPlanConfirmed: true,
    resolved: { type: 'recipe', recipe: { title: 'Pasta' } },
});
check('a locked week shows no remove button', rowsOf(lockedCard).length, 0);
viewSpy.calls.length = 0;
lockedCard.tree.props.onClick();
check('a locked week still lets you look at what is cooking', viewSpy.calls.length, 1);

const lockedEmpty = mount(DayCard, { ...cardProps, isPlanConfirmed: true });
check('a locked, empty day is not tappable', lockedEmpty.tree.props.className.includes('cursor-pointer'), false);
tapSpy.calls.length = 0;
lockedEmpty.tree.props.onClick();
check('...and tapping it does not open the picker', tapSpy.calls.length, 0);

console.log('\nDayCard — the two-click remove gate');

timers.length = 0;
removeSpy.calls.length = 0;
tapSpy.calls.length = 0;
const armed = mount(DayCard, { ...cardProps, resolved: { type: 'recipe', recipe: { title: 'Pasta' } } });
const xt = { stopPropagation() { this.stopped = true; } };
removeBtnOf(armed).props.onClick(xt);
check('the first tap arms the button instead of removing', removeSpy.calls, []);
check('...and stops the click reaching the row (no day picker)', tapSpy.calls, []);
check('the row is still there', removeBtnOf(armed) !== undefined, true);
check('the armed button turns destructive', removeBtnOf(armed).props.style.color, 'var(--destructive)');
check('the arm is re-armed after 3 seconds', pendingTimers().map((t) => t.ms), [3000]);
check('...exactly once', pendingTimers().length, 1);

pendingTimers()[0].cb();
check('after the timer the button is safe again', removeBtnOf(armed).props.style.color, 'var(--ink-dim)');
check('...and still removes nothing', removeSpy.calls, []);

removeBtnOf(armed).props.onClick(xt);
removeBtnOf(armed).props.onClick(xt);
check('the second tap within the window removes the meal', removeSpy.calls, [[]]);
check('...and disarms', removeBtnOf(armed).props.style.color, 'var(--ink-dim)');

timers.length = 0;
const lockedRemove = mount(DayCard, {
    ...cardProps, isPlanConfirmed: true, resolved: { type: 'recipe', recipe: { title: 'Pasta' } },
});
check('a locked week has no remove button to click at all', rowsOf(lockedRemove).length, 0);
check('...so no timer is ever armed', pendingTimers().length, 0);

/* ------------------------------------------------------------------ QuickAddModal */

console.log('\nQuickAddModal — categories from the data');

const addSpy = spy();
const qaCloseSpy = spy();
let qa = mount(QuickAddModal, { onClose: qaCloseSpy, onAdd: addSpy });
const chips = () => findAll(qa.tree, named('Chip'));
const gridItems = () => findAll(qa.tree, (el) => el.type === 'button' && el.props.style
    && el.props.style.aspectRatio === '1');
const addButton = () => qa.tree.props.footer;
const activeChips = () => chips().filter((c) => c.props.active);
const normalText = (s) => s.replace(/\u00a0/g, ' ');

check('it opens a Sheet titled "Quick Add"', qa.tree.props.title, 'Quick Add');
check('every category is offered as a chip', chips().map((c) => c.props.label), commonItems.map((c) => c.category));
check('the chips are filter chips', chips()[0].props.variant, 'filter');
check('exactly one category starts active', activeChips().length, 1);
check('...and it is the first one', activeChips()[0].props.label, commonItems[0].category);
check('the grid lists that category\'s items',
    gridItems().map((b) => textOf(b)), commonItems[0].items.map((i) => i.emoji + i.name));

const third = commonItems[2].category;
chips()[2].props.onClick();
check('picking a category moves the active chip', activeChips().map((c) => c.props.label), [third]);
check('...and swaps the grid to its items',
    gridItems().map((b) => textOf(b)),
    commonItems[2].items.map((i) => i.emoji + i.name));

console.log('\nQuickAddModal — selection, count, and the add payload');

const marker = () => findAll(qa.tree, (el) => el.props.style && el.props.style.borderRadius === 'var(--r-xs)');
check('nothing is selected to begin with', marker().length, 0);
check('...and the Add button is disabled', addButton().props.disabled, true);
check('...at half opacity', addButton().props.style.opacity, 0.5);
check('...and the disabled state is what gates the add, not the handler',
    typeof addButton().props.disabled === 'boolean' && addButton().props.onClick !== undefined, true);

gridItems()[0].props.onClick();
check('tapping an item selects it', gridItems()[0].props.style.background, 'var(--stamp-tint)');
check('...with a check marker', marker().length, 1);
check('...and the button enables', addButton().props.disabled, false);
check('...at full opacity', addButton().props.style.opacity, 1);
check('the count is shown on the button', normalText(textOf(addButton())), 'Add 1 Item');

gridItems()[1].props.onClick();
check('a second item joins the selection', marker().length, 2);
check('...and the plural appears', normalText(textOf(addButton())), 'Add 2 Items');

gridItems()[0].props.onClick();
check('tapping a selected item deselects it', marker().length, 1);
check('...back to the singular', normalText(textOf(addButton())), 'Add 1 Item');

addSpy.calls.length = 0;
qaCloseSpy.calls.length = 0;
addButton().props.onClick();
check('Add hands over exactly what was selected', addSpy.calls, [[[commonItems[2].items[1]]]]);
check('...and closes the sheet', qaCloseSpy.calls.length, 1);

/* ------------------------------------------------------------------ RecipeDaySheet */

console.log('\nRecipeDaySheet — no recipe for that day');

const saveSpy = spy();
const rdsCloseSpy = spy();
const empty = mount(RecipeDaySheet, { date: TODAY, day: null, recipes: [], onSave: saveSpy, onClose: rdsCloseSpy });
check('a day with no recipe says so', textOf(empty.tree), "Couldn't find that recipe.");
check('...on the board surface (it is a cooking screen)', empty.tree.props.surface, 'board');
check('...and still closes', empty.tree.props.onClose === rdsCloseSpy, true);

console.log('\nRecipeDaySheet — the servings stepper and the scaling it drives');

const LIB = {
    id: 'r9', title: 'Curry', description: 'A curry',
    base_servings: 2,
    ingredients: [{ quantity: 0.25, unit: 'g', name: 'Spice' }, { quantity: 0.333333, unit: 'g', name: 'Salt' }, 'Pepper to taste'],
    steps: ['Chop', 'Simmer'],
};
const day = { source: 'library', recipeId: 'r9', servings: 4 };
let rds = mount(RecipeDaySheet, { date: TODAY, day, recipes: [LIB], onSave: saveSpy, onClose: rdsCloseSpy });
const stepperButtons = () => findAll(rds.tree, (el) => el.type === 'button'
    && el.props.style && el.props.style.padding === '4px');
const sendButton = () => findAll(rds.tree, byClass('btn-stamp'))[0];
const rowEls = () => findAll(rds.tree, byClass('flex gap-[8px] t-body'));
const ingredientRows = () => rowEls().slice(0, 3);
const leafContaining = (fragment) => (el) => textOf(el).includes(fragment)
    && !kids(el).some((k) => k && typeof k === 'object' && k.props);
const servingsText = () => findAll(rds.tree, leafContaining('servings')).map(textOf)[0];
const errorText = () => findAll(rds.tree, (el) => el.props.style
    && el.props.style.color === 'var(--destructive)').map(textOf)[0];
const instructionInput = () => findAll(rds.tree, byType('input'))[0];

check('the day label is the long date', rds.tree.props.title, new Date(TODAY).toLocaleDateString('en-US',
    { weekday: 'long', month: 'long', day: 'numeric' }));
check('the recipe title is shown', textOf(findAll(rds.tree, byClass('t-heading-md'))[0]), 'Curry');
check('the description is shown', textOf(findAll(rds.tree,
    (el) => el.props.style && el.props.style.marginTop === '4px')[0]), 'A curry');
check('the servings come from the day', servingsText(), '4 servings');
check('quantities are scaled to the servings asked for',
    ingredientRows().map((r) => textOf(r.props.children[0])), ['0.5 g', '0.67 g', ' ']);
check('a null quantity renders as nothing, not as NaN',
    [textOf(ingredientRows()[2].props.children[0]).trim(), textOf(ingredientRows()[2]).includes('NaN')], ['', false]);
check('the ingredient name survives the scaling',
    ingredientRows().map((r) => textOf(r.props.children[1])), ['Spice', 'Salt', 'Pepper to taste']);
check('the steps are numbered', rowEls().slice(3).map((r) => textOf(r.props.children[0])), ['1', '2']);
check('the steps are the recipe\'s own text',
    rowEls().slice(3).map((r) => textOf(r.props.children[1])), ['Chop', 'Simmer']);

stepperButtons()[1].props.onClick();
check('+ adds a serving', servingsText(), '5 servings');
check('...and rescales again', textOf(ingredientRows()[0].props.children[0]), '0.63 g');
stepperButtons()[0].props.onClick();
check('- takes it back down', servingsText(), '4 servings');

const oneServing = mount(RecipeDaySheet, { date: TODAY, day: { ...day, servings: 1 }, recipes: [LIB], onSave: saveSpy, onClose: rdsCloseSpy });
check('servings start at the day value when it is lower than the base',
    findAll(oneServing.tree, leafContaining('servings')).map(textOf)[0], '1 servings');
findAll(oneServing.tree, (el) => el.type === 'button' && el.props.style && el.props.style.padding === '4px')[0].props.onClick();
check('...and never go below one', findAll(oneServing.tree, leafContaining('servings')).map(textOf)[0], '1 servings');

const baseOnly = mount(RecipeDaySheet, { date: TODAY, day: { source: 'library', recipeId: 'r9' }, recipes: [LIB], onSave: saveSpy, onClose: rdsCloseSpy });
check('with no day servings the recipe base is used',
    findAll(baseOnly.tree, leafContaining('servings')).map(textOf)[0], '2 servings');
for (let i = 0; i < 30; i += 1) {
    findAll(baseOnly.tree, (el) => el.type === 'button' && el.props.style && el.props.style.padding === '4px')[1].props.onClick();
}
check('...and never above twenty', findAll(baseOnly.tree, leafContaining('servings')).map(textOf)[0], '20 servings');

const zeroBase = mount(RecipeDaySheet, {
    date: TODAY,
    day: { source: 'library', recipeId: 'r0', servings: 3 },
    recipes: [{ id: 'r0', title: 'Zero', base_servings: 0, ingredients: [{ quantity: 2, unit: 'g', name: 'X' }], steps: [] }],
    onSave: saveSpy, onClose: rdsCloseSpy,
});
check('a base of zero servings does not turn the quantities into NaN',
    textOf(findAll(zeroBase.tree, byClass('flex gap-[8px] t-body'))[0]).includes('NaN'), false);

console.log('\nRecipeDaySheet — locking a day in');

saveSpy.calls.length = 0;
const lockIn = rds.tree.props.footer;
lockIn.props.onClick();
check('locking in saves the adjusted recipe', saveSpy.calls[0][0].recipe.title, 'Curry');
check('...with the servings currently on screen', saveSpy.calls[0][0].servings, 4);
check('...and closes the sheet', rdsCloseSpy.calls.length, 1);
check('the saved recipe is a copy, not the library row', saveSpy.calls[0][0].recipe === LIB, false);
check('...and so is its ingredient list', saveSpy.calls[0][0].recipe.ingredients === LIB.ingredients, false);

/* ------------------------------------------------------------------ refine */

console.log('\nRecipeDaySheet — the refine path');

rds = mount(RecipeDaySheet, { date: TODAY, day, recipes: [LIB], onSave: saveSpy, onClose: rdsCloseSpy });
const realFetch = globalThis.fetch;
let fetchCalls = 0;
globalThis.fetch = async () => { fetchCalls += 1; throw new Error('offline'); };

check('Send is disabled while there is nothing to ask for', sendButton().props.disabled, true);
await sendButton().props.onClick();
check('...and clicking it calls nothing', fetchCalls, 0);

instructionInput().props.onChange({ target: { value: 'swap the spice for tofu' } });
check('typing enables Send', sendButton().props.disabled, false);
check('...and the instruction is on screen', instructionInput().props.value, 'swap the spice for tofu');

logged.length = 0;
await sendButton().props.onClick();
check('a failed refine reaches the API exactly once', fetchCalls, 1);
check('...is logged with its own label', logged[0] && logged[0][0] === 'error' && logged[0][1],
    'error' && 'Recipe day refine failed:');
check('...and the message is shown to the user',
    errorText(), "Couldn't reach the AI service. Check your connection and try again.");
check('...the button is usable again (not stuck refining)', sendButton().props.disabled, false);
check('...and the typed instruction is kept, not dropped',
    instructionInput().props.value, 'swap the spice for tofu');
globalThis.fetch = realFetch;

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
