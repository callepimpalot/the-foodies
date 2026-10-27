/**
 * PlanView checks — `node scripts/plan_view_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/views/PlanView.jsx` is the Plan half of Capture → Plan → Shop → Cook, and no check script
 * named it: measured 2026-10-18 11:2x UTC across all 52 heads (189 `(ref, scripts/*_check.mjs)`
 * blobs, read in one `git cat-file --batch` pass), it scores **zero** word-bounded hits in every
 * suite, raw and comment-stripped alike. The smaller module that shares that score is PantryView
 * (1,685 B against this file's 5,406 B), but its whole logic is one derived count plus its wording.
 * This file is the smallest uncovered module that carries **decisions**: which mode is showing,
 * whether the header collapses, which of two mutually exclusive lock buttons is on screen, and what
 * happens when the user asks to cook the recipe they just opened.
 *
 * WHAT IS PINNED, AND WHY IT IS WORTH PINNING
 *  - **The header collapse is a deliberate phone-UX decision, and it is an AND.** `compactHeader`
 *    is `mode === 'chat' && hasChatProposal`: the big static title is dropped only once a chat
 *    proposal exists, because on a phone it was eating a third of the screen above the day list.
 *    With the operator relaxed to `||`, simply opening the Chat Plan tab loses the title before
 *    there is anything to replace it with; with the proposal term dropped, the header collapses on
 *    a screen that has nothing to show instead.
 *  - **The two lock buttons are mutually exclusive, and both are gated on the plan having
 *    contents.** `manual && hasItemsInPlan && !isPlanConfirmed` is "Lock This Week" (primary);
 *    `… && isPlanConfirmed` is "Plan Locked" (secondary, with an opaque backdrop of its own). A
 *    predicate that dropped the `hasItemsInPlan` term offers to lock an empty week; one that
 *    dropped `mode === 'manual'` floats a lock button over the chat planner, where it has no
 *    meaning. Both are one-character edits away and neither is visible in a screenshot of a
 *    populated week.
 *  - **`Plan Locked` is `variant="secondary"`, and that is the whole of the visual difference
 *    between "do it" and "it is done".**
 *  - **The day sheet's label is the en-US long form of the date string**, recomputed at render time
 *    from `activeDay`. A label that stopped reading the active day (or lost its `weekday`) shows
 *    the wrong day over the right day's meals.
 *  - **The cook handoff carries the recipe, not just the view.** `onCookNow` calls
 *    `setCurrentView(VIEWS.COOK_MODE, viewingRecipe)`; dropping the second argument sends the user
 *    to a cook screen with no recipe on it while everything still renders.
 *
 * HOW IT RUNS A STATEFUL VIEW WITH NO REACT AND NO DOM
 * `src/views/PlanView.jsx` calls four `useState`s and two context hooks, and renders five
 * components. `react` is answered with a stub whose `createElement` builds plain `{ type, props }`
 * objects and whose `useState` keeps a persistent slot array and re-renders synchronously into the
 * same mount object — the same technique as `scripts/stateful_components_check.mjs` (PR #54) and
 * `scripts/view_context_check.mjs` (PR #55). The two contexts are answered from stub modules (a
 * `useContext` fixture *is* the provider, per #55), and the four heavy children — `WeeklyCalendar`,
 * `WeekPlanChat`, `DayActionSheet`, `RecipeDetailSheet` — are stubbed as identity markers, because
 * this file only ever *builds* those elements and never calls them. `Button` is loaded **for real**
 * and recognised by identity, so the assertions are about the app's own primitive. `esbuild` is
 * already present as a Vite dependency; nothing is installed.
 *
 * The two stub factories read live module-level state, so each section swaps its fixture and
 * re-mounts. `mount()` re-points the single re-render target, so an extra mount mid-section would
 * swallow every later state update — every mount here is deliberate and followed by a fresh query.
 *
 * THE DAY LABEL IS COMPARED AGAINST THE HOST'S OWN FORMATTING, NOT A LITERAL
 * `toLocaleDateString('en-US', …)` is timezone-dependent when the input is a bare `YYYY-MM-DD`
 * (it parses as UTC midnight, and a machine west of Greenwich formats the previous day). The
 * assertion therefore compares the rendered label to the same call made in this script — the same
 * realm, the same TZ — which pins the format and the source date without pinning a timezone.
 *
 * NEGATIVE CONTROLS
 * Each in its own fresh scratch layout, the unmutated copy of the SAME layout green first, and each
 * mutator asserting its anchor matches exactly once so no control can silently become a no-op:
 *   - `const compactHeader = mode === 'chat' && hasChatProposal;` → `||` → red
 *   - `Object.keys(weeklyPlan).length > 0` → `>= 0` → red
 *   - the locked button's `variant="secondary"` → `variant="primary"` → red
 *   - `setCurrentView(VIEWS.COOK_MODE, viewingRecipe)` → `setCurrentView(VIEWS.COOK_MODE)` → red
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * This asserts the element object the view returns, not a rendered screen: no CSS, no layout, no
 * real event dispatch — a press is asserted by the call the handler makes, not by a tap.
 * `vitest`, `jest`, `jsdom`, `@testing-library/react` and `react-test-renderer` are all absent from
 * `node_modules`; installing one is a human decision.
 *
 * Plain script, non-zero exit on failure — same shape as `scripts/stateful_components_check.mjs`.
 */
import { createRequire, registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

// The app's own modules import each other extensionlessly (Vite resolves that at build time; bare
// Node does not), and a view's import chain reaches them.
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
    createContext: (d) => ({ Provider: Symbol('Context.Provider'), defaultValue: d }),
    useContext: (ctx) => ctx.defaultValue,
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
 * `'../context/PlanContext'`) to a function returning that module's exports — called at require
 * time so a stub can read live module-level state on each render.
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
const classIs = (cls) => (el) => el.props.className === cls;

/* ------------------------------------------------------------------ the child stubs and the live fixtures */

// Identity markers: this file only ever *builds* these elements, so they are never called. Returning
// a plain element object keeps the traversal helpers working if one ever is.
const WeeklyCalendarStub = (props) => ({ type: 'WeeklyCalendarStub', props });
const WeekPlanChatStub = (props) => ({ type: 'WeekPlanChatStub', props });
const DayActionSheetStub = (props) => ({ type: 'DayActionSheetStub', props });
const RecipeDetailSheetStub = (props) => ({ type: 'RecipeDetailSheetStub', props });

const viewSpy = spy();
const toggleSpy = spy();

/** The fixture `usePlan()` hands back — reassigned per section, read live on every render. */
let PLAN = { isPlanConfirmed: false, toggleConfirmation: toggleSpy, weeklyPlan: {} };
/** The fixture `useView()` hands back. */
const VIEW_FIXTURE = { setCurrentView: viewSpy, VIEWS: null };

const { PlanView } = loadJsx('../src/views/PlanView.jsx', {
    '../context/PlanContext': () => ({ usePlan: () => PLAN }),
    '../context/ViewContext': () => ({ useView: () => VIEW_FIXTURE }),
    '../components/WeeklyCalendar': () => ({ WeeklyCalendar: WeeklyCalendarStub }),
    '../components/WeekPlanChat': () => ({ WeekPlanChat: WeekPlanChatStub }),
    '../components/DayActionSheet': () => ({ DayActionSheet: DayActionSheetStub }),
    '../components/RecipeDetailSheet': () => ({ RecipeDetailSheet: RecipeDetailSheetStub }),
});
const { Button } = loadJsx('../src/components/ui/Button.jsx');
const { VIEWS } = require(join(dirname(here), '..', 'src', 'utils', 'constants.js'));
VIEW_FIXTURE.VIEWS = VIEWS;

const ROOT_CLASS = 'flex flex-col h-full relative bg-board text-chalk';
const FULL_HEADER_CLASS = 'pt-5 pb-3 flex flex-col items-start w-full gap-2';
const COMPACT_HEADER_CLASS = 'pt-4 pb-3 flex items-center justify-between w-full';

const root = (v) => v.tree;
const header = (v) => findAll(root(v), classIs(FULL_HEADER_CLASS))[0]
    || findAll(root(v), classIs(COMPACT_HEADER_CLASS))[0];
const isCompact = (v) => findAll(root(v), classIs(COMPACT_HEADER_CLASS)).length === 1;
const toggleBtn = (v, label) => findAll(root(v), byType('button')).find((b) => textOf(b) === label);
const calendar = (v) => findAll(root(v), byType(WeeklyCalendarStub))[0];
const chat = (v) => findAll(root(v), byType(WeekPlanChatStub))[0];
const buttons = (v) => findAll(root(v), byType(Button));
const lockBtn = (v) => buttons(v).find((b) => textOf(b) === 'Lock This Week');
const lockedBtn = (v) => buttons(v).find((b) => textOf(b) === 'Plan Locked');
const daySheet = (v) => findAll(root(v), byType(DayActionSheetStub))[0];
const recipeSheet = (v) => findAll(root(v), byType(RecipeDetailSheetStub))[0];
const title = (v) => findAll(root(v), byType('h2')).find((el) => textOf(el) === 'Curate your week');
const eyebrow = (v) => findAll(root(v), byType('span')).find((el) => textOf(el) === 'Planning HQ');

/* ================================================================== the shell */

console.log('\nPlanView — the shell it always renders');

let v = mount(PlanView, {});

check('the whole view renders one root element', root(v).type, 'div');
check('...carrying the board surface the design tokens define', root(v).props.className, ROOT_CLASS);
check('an empty plan still renders the header (there is no early return)', header(v) !== undefined, true);
check('...and neither sheet is open to begin with', [daySheet(v), recipeSheet(v)], [undefined, undefined]);

/* ================================================================== the mode toggle */

console.log('\nPlanView — the manual / chat toggle');

check('there is a Manual button', toggleBtn(v, 'Manual') !== undefined, true);
check('...and a Chat Plan button', toggleBtn(v, 'Chat Plan') !== undefined, true);
check('the two share the pill chrome', toggleBtn(v, 'Manual').props.className.includes('t-label')
    && toggleBtn(v, 'Chat Plan').props.className.includes('t-label'), true);
check('the active mode is the filled one',
    toggleBtn(v, 'Manual').props.className.includes('bg-chalk text-board'), true);
check('...and the inactive one is dimmed',
    toggleBtn(v, 'Chat Plan').props.className.includes('text-chalkDim'), true);

check('manual mode shows the week calendar', calendar(v) !== undefined, true);
check('...and not the chat planner', chat(v), undefined);
check('the calendar is given a day-click handler', typeof calendar(v).props.onDayClick, 'function');
check('...and a view-recipe handler', typeof calendar(v).props.onViewRecipe, 'function');

toggleBtn(v, 'Chat Plan').props.onClick();
check('tapping Chat Plan swaps the body to the planner', chat(v) !== undefined, true);
check('...and takes the calendar away', calendar(v), undefined);
check('the active pill moves with it',
    toggleBtn(v, 'Chat Plan').props.className.includes('bg-chalk text-board'), true);
check('...while Manual dims', toggleBtn(v, 'Manual').props.className.includes('text-chalkDim'), true);

toggleBtn(v, 'Manual').props.onClick();
check('tapping Manual swaps it back', calendar(v) !== undefined, true);
check('...and the chat planner is gone again', chat(v), undefined);

/* ================================================================== the collapsed header */

console.log('\nPlanView — the header collapse, and the AND that governs it');

check('with no chat proposal the title is on screen', title(v) !== undefined, true);
check('...with its eyebrow', eyebrow(v) !== undefined, true);
check('...and the header is the full one', isCompact(v), false);

toggleBtn(v, 'Chat Plan').props.onClick();
check('chat mode alone does NOT collapse the header', isCompact(v), false);
check('...the title stays until there is something to replace it with', title(v) !== undefined, true);

chat(v).props.onProposalChange(true);
check('once a proposal exists in chat mode the header collapses', isCompact(v), true);
check('...the static title goes', title(v), undefined);
check('...and the mode toggle stays, so the user can still leave',
    toggleBtn(v, 'Chat Plan') !== undefined, true);
check('...and so does the planner itself', chat(v) !== undefined, true);

chat(v).props.onApplied();
check('applying a proposal returns to manual mode', calendar(v) !== undefined, true);
check('...and the full header comes back with it', isCompact(v), false);
check('...because the collapse is an AND, not a latch on the proposal alone',
    title(v) !== undefined, true);

toggleBtn(v, 'Chat Plan').props.onClick();
check('returning to chat re-collapses (the proposal is remembered)', isCompact(v), true);
toggleBtn(v, 'Manual').props.onClick();
check('...and leaving chat brings the title back again', title(v) !== undefined, true);

/* ================================================================== the lock buttons */

console.log('\nPlanView — the two lock buttons, and the gate on both');

const WEEK = { Monday: [{ id: 'r1' }] };

PLAN = { isPlanConfirmed: false, toggleConfirmation: toggleSpy, weeklyPlan: {} };
let w = mount(PlanView, {});
check('an empty week shows no lock button', lockBtn(w), undefined);
check('...and no locked button either', lockedBtn(w), undefined);

PLAN = { isPlanConfirmed: false, toggleConfirmation: toggleSpy, weeklyPlan: WEEK };
w = mount(PlanView, {});
check('a week with contents offers to lock it', lockBtn(w) !== undefined, true);
check('...and the button says what it does', textOf(lockBtn(w)), 'Lock This Week');
check('...as the app\'s own Button primitive, and the only one on screen', buttons(w).length, 1);
check('...in the primary variant (this is the "do it" affordance)', lockBtn(w).props.variant, 'primary');
check('...full width inside a floating bar',
    lockBtn(w).props.className, 'w-full transition-transform active:scale-[0.98]');
check('...and pressing it toggles the confirmation', (() => {
    toggleSpy.calls.length = 0;
    lockBtn(w).props.onClick();
    return toggleSpy.calls.length;
})(), 1);
check('the locked state is not on screen at the same time', lockedBtn(w), undefined);

PLAN = { isPlanConfirmed: true, toggleConfirmation: toggleSpy, weeklyPlan: WEEK };
w = mount(PlanView, {});
check('a locked week shows the locked state instead', lockedBtn(w) !== undefined, true);
check('...saying so', textOf(lockedBtn(w)), 'Plan Locked');
check('...in the secondary variant — that is what tells the user a tap unlocks',
    lockedBtn(w).props.variant, 'secondary');
check('...with a backdrop of its own, because .btn-secondary is transparent by design',
    lockedBtn(w).props.style, { background: 'var(--board-2)', boxShadow: 'var(--shadow-hero)' });
check('...and it is the only button in the tree', buttons(w).length, 1);
check('...pressing it unlocks through the same handler', (() => {
    toggleSpy.calls.length = 0;
    lockedBtn(w).props.onClick();
    return toggleSpy.calls.length;
})(), 1);
check('the "Lock This Week" affordance is gone once locked', lockBtn(w), undefined);

PLAN = { isPlanConfirmed: true, toggleConfirmation: toggleSpy, weeklyPlan: {} };
w = mount(PlanView, {});
check('a locked flag with nothing planned still shows no lock button',
    [lockBtn(w), lockedBtn(w)], [undefined, undefined]);

PLAN = { isPlanConfirmed: false, toggleConfirmation: toggleSpy, weeklyPlan: WEEK };
w = mount(PlanView, {});
toggleBtn(w, 'Chat Plan').props.onClick();
check('chat mode gets no lock button at all, even with a full week',
    [lockBtn(w), lockedBtn(w)], [undefined, undefined]);
check('...although the planner is the thing showing', chat(w) !== undefined, true);

PLAN = { isPlanConfirmed: true, toggleConfirmation: toggleSpy, weeklyPlan: WEEK };
w = mount(PlanView, {});
toggleBtn(w, 'Chat Plan').props.onClick();
check('...and a locked week in chat mode does not either', lockedBtn(w), undefined);

/* ================================================================== the day sheet */

console.log('\nPlanView — opening a day, and the label it carries');

const dateStr = '2026-10-23';
const label = (d) => new Date(d)
    .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

PLAN = { isPlanConfirmed: false, toggleConfirmation: toggleSpy, weeklyPlan: WEEK };
w = mount(PlanView, {});
check('no day sheet is open yet', daySheet(w), undefined);

calendar(w).props.onDayClick(dateStr);
check('clicking a day opens the day sheet', daySheet(w) !== undefined, true);
check('...for that day', daySheet(w).props.date, dateStr);
check('...labelled with the long en-US form of the date',
    daySheet(w).props.dayLabel, label(dateStr));
check('...which is a different label for a different day',
    daySheet(w).props.dayLabel === label('2026-10-26'), false);
check('...and the label follows the day that was clicked',
    (() => {
        calendar(w).props.onDayClick('2026-10-26');
        return daySheet(w).props.dayLabel;
    })(), label('2026-10-26'));

daySheet(w).props.onClose();
check('closing it clears the active day', daySheet(w), undefined);
check('...without disturbing the calendar', calendar(w) !== undefined, true);
check('...or the plan behind it', lockBtn(w) !== undefined, true);

/* ================================================================== the recipe sheet and the cook handoff */

console.log('\nPlanView — the recipe sheet, and what "cook now" carries');

const recipe = { id: 'r9', title: 'Chicken Curry' };
viewSpy.calls.length = 0;
calendar(w).props.onViewRecipe(recipe);
check('viewing a recipe opens the detail sheet', recipeSheet(w) !== undefined, true);
check('...with the very object the calendar handed over', recipeSheet(w).props.recipe === recipe, true);

const shown = recipeSheet(w).props.recipe;
check('cook now navigates to cook mode', (() => {
    recipeSheet(w).props.onCookNow();
    return viewSpy.calls.length;
})(), 1);
check('...carrying the recipe itself, not just the view name',
    [viewSpy.calls[0][0], viewSpy.calls[0][1] === shown], ['COOK_MODE', true]);
check('...and COOK_MODE is the constant the router compares against',
    viewSpy.calls[0][0], VIEWS.COOK_MODE);
check('...while the sheet itself stays open, so the user can back out',
    recipeSheet(w) !== undefined, true);

check('an edit from the sheet updates the recipe it is showing', (() => {
    const edited = { ...shown, title: 'Curry', servings: 4 };
    recipeSheet(w).props.onRecipeUpdated(edited);
    return recipeSheet(w).props.recipe === edited;
})(), true);
check('...and the cook handoff then carries the edited row',
    (() => {
        viewSpy.calls.length = 0;
        recipeSheet(w).props.onCookNow();
        return viewSpy.calls[0][1] === recipeSheet(w).props.recipe;
    })(), true);

check('closing the sheet clears the viewing state only', (() => {
    recipeSheet(w).props.onClose();
    return [recipeSheet(w), calendar(w) !== undefined];
})(), [undefined, true]);

/* ------------------------------------------------------------------ summary */

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
