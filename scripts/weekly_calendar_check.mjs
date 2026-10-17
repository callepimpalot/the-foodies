/**
 * WeeklyCalendar checks — `node scripts/weekly_calendar_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/components/WeeklyCalendar.jsx` is the next-smallest of the ten modules no suite names
 * (measured 2026-10-17 14:12 UTC: 67 modules under `src/` + `netlify/` on `main`; the raw metric
 * names 57, the code-only metric names 46). It is the Planning HQ itself: every day the user can
 * plan is a row this file generates, and `resolveDay()` is the only thing that decides what a row
 * shows. `scripts/bottom_nav_check.mjs` (PR #56) established that a context *consumer* is a pure
 * function of the value it reads — this file applies that to a component that also **generates
 * seven dates from the clock**, which is the part nothing has ever held.
 *
 * WHAT IS PINNED, AND WHY IT IS WORTH PINNING
 *  - Seven days, starting today, consecutive: the `dateStr` keys are exactly `today .. today+6`,
 *    in order. `setDate(getDate() + i)` is the whole of it, and an off-by-one or a `- i` silently
 *    plans a week in the past or repeats one day seven times — both read as a plausible calendar.
 *  - `dayName` / `dayNum` agree with the `dateStr` they sit beside (asserted against the fixed clock,
 *    not against the same `Date` call the component makes).
 *  - `isToday` marks day 0 and **only** day 0 — an inverted comparison highlights every row except
 *    today.
 *  - `isPast` is false for all seven. The range is today..today+6, so no row can be past; the
 *    comparison direction (`<` vs `>`) is the only thing that could make today's own row read as
 *    history, and nothing else in the repo asserts it.
 *  - Each row's `resolved` is `resolveDay()` of **that row's own** date — a `resolveDay(todayStr)`
 *    here paints today's dinner onto all seven rows.
 *  - `resolveDay` is called once per row, in order, with that row's date, and `clearDay` is wired to
 *    the row it belongs to.
 *  - The "Nothing planned yet" line appears when no day resolves and disappears as soon as one does
 *    (`.some`, not `.every` — with `every` one planned day still shows the empty-state prompt).
 *  - The prop set handed to `DayCard` is exactly the signature `DayCard.jsx` declares — the two files
 *    are a contract and neither one's suite holds the other's end.
 *  - The wrapper's `pb-[160px]` — the padding the file's own comment says clears the fixed
 *    "Lock This Week" button and the bottom nav.
 *
 * HOW IT RUNS A DATE-GENERATING CONTEXT CONSUMER WITH NO REACT AND NO DOM
 * `react` is answered with a stub: `createElement` builds plain `{ type, props }` objects (JSX is
 * transformed by `esbuild`, already present as a Vite dependency — nothing is installed), `key` is
 * pulled onto the element the way a real renderer pulls it, and `usePlan` reads a fixture the test
 * sets. `Date` is injected as a **fixed clock** (2026-10-17T12:00:00Z, a Saturday) into the module's
 * `vm` sandbox, so the seven generated days are exact strings rather than "whatever today is".
 * `../context/PlanContext` is answered with a stub carrying only `usePlan`: the real module imports
 * `../lib/supabase` and builds a client at import time, which is a side effect a check script has no
 * business triggering. `./DayCard` is loaded **for real** (with a `lucide-react` icon stub), so the
 * element type compared here is the module's own export and not a lookalike.
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * This asserts the element objects `WeeklyCalendar` returns and the calls its handlers make — not a
 * rendered screen. No CSS, no layout, no real event dispatch, and no `DayCard` internals: `DayCard`
 * calls `useState` and is never invoked here. `vitest`, `jest`, `jsdom`, `@testing-library/react` and
 * `react-test-renderer` are all absent from `node_modules`; installing one is a human decision.
 *
 * NEGATIVE CONTROLS (each in its own fresh scratch layout, the unmutated copy of the SAME layout
 * green at **42 ok / 0 FAIL / exit 0** first, and each mutator asserting its anchor matches exactly
 * once so no control can silently become a no-op). Measured, one run per control:
 *   - `day.dateStr === todayStr` → `day.dateStr !== todayStr` → **39 ok / 3 FAIL, exit 1** (every row
 *     except today is marked as today).
 *   - `resolved={resolveDay(day.dateStr)}` → `resolved={resolveDay(todayStr)}` → **38 ok / 4 FAIL,
 *     exit 1** (today's dinner appears on all seven rows, and `resolveDay` is read seven times with
 *     the same date).
 *   - `days.some((day) => resolveDay(day.dateStr))` → `days.every(...)` → **37 ok / 5 FAIL, exit 1**
 *     (one planned day still shows "Nothing planned yet").
 *
 * Plain script, non-zero exit on failure — same shape as `scripts/bottom_nav_check.mjs`.
 */
import { createRequire, registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

/* ------------------------------------------------------------------ the fixed clock */

// 2026-10-17T12:00:00Z is a Saturday. Noon UTC keeps the local and UTC calendar date identical for
// every real-world offset except +13/+14; the seven days asserted below are exact strings.
const FIXED = Date.UTC(2026, 9, 17, 12, 0, 0);
const FIXED_ISO_DATE = '2026-10-17';

/** A Date whose no-argument constructor is frozen at FIXED. `new Date(ms)` still behaves. */
class FakeDate extends Date {
    constructor(...args) {
        if (args.length === 0) super(FIXED);
        else super(...args);
    }
    static now() { return FIXED; }
}

/* ------------------------------------------------------------------ the react stub */

/** The fixture `usePlan()` hands back. Set per assertion group. */
let contextValue;

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
    Fragment: Symbol('Fragment'),
    useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
    useContext: () => contextValue,
    createContext: () => ({ Provider: Symbol('Context.Provider'), defaultValue: undefined }),
    useEffect: () => {},
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useRef: (v) => ({ current: v }),
    createPortal: (el) => el,
};

/* ------------------------------------------------------------------ the module stubs */

/** One unique marker per icon `DayCard.jsx` imports, so an icon can be asserted by identity. */
const ICON_NAMES = ['Plus', 'X', 'RotateCcw', 'StickyNote', 'Utensils'];
const LucideStub = {};
for (const name of ICON_NAMES) {
    const marker = function IconStub() {};
    marker.iconName = name;
    LucideStub[name] = marker;
}

/** The real `PlanContext` builds a Supabase client at import time; a check script must not do that. */
const PlanContextStub = { usePlan: () => contextValue };

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
        if (spec === 'lucide-react') return LucideStub;
        if (spec === '../context/PlanContext') return PlanContextStub;
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
        ...(globals ?? {}),
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

const { WeeklyCalendar } = loadJsx('../src/components/WeeklyCalendar.jsx', { Date: FakeDate });
const { DayCard } = loadJsx('../src/components/DayCard.jsx');

/* ------------------------------------------------------------------ fixtures */

/** A `usePlan()` value shaped like the real one, recording every `resolveDay`/`clearDay` call. */
function fixtureFor(resolvedMap, isPlanConfirmed = false) {
    const calls = { resolve: [], clear: [] };
    return {
        calls,
        value: {
            isPlanConfirmed,
            clearDay: (d) => calls.clear.push(d),
            resolveDay: (d) => {
                calls.resolve.push(d);
                return resolvedMap[d] ?? null;
            },
        },
    };
}

/** The context value is the only state input, so a "mount" is just a call with the fixture in place. */
function render(fixture, props = {}) {
    contextValue = fixture.value;
    return { fixture, tree: WeeklyCalendar(props) };
}

const childrenOf = (el) => {
    const c = el.props.children;
    if (c === undefined || c === null) return [];
    return Array.isArray(c) ? c : [c];
};
const listTicketOf = (tree) => childrenOf(tree).find((c) => c && c.type === 'div' && c.props.className === 'list-ticket');
const emptyMessageOf = (tree) => childrenOf(tree).find((c) => c && c.type === 'p');
const cardsOf = (tree) => childrenOf(listTicketOf(tree));

const DAY_NAMES = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DAY_NUMS = [17, 18, 19, 20, 21, 22, 23];
const DATE_STRINGS = ['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'];
// The signature `DayCard.jsx` declares, sorted. `key` is pulled onto the element by createElement.
const DAYCARD_PROPS = ['dayName', 'dayNum', 'isPast', 'isPlanConfirmed', 'isToday', 'onDayClick', 'onRemove', 'onViewRecipe', 'resolved'];

/* ------------------------------------------------------------------ the shape of the week */

console.log('\nWeeklyCalendar — seven days, starting today');

const empty = render(fixtureFor({}));
const tree = empty.tree;

check('it renders a <div> wrapper', tree.type, 'div');
check("...carrying the padding the file's own comment says clears the fixed button and the nav",
    tree.props.className, 'w-full pb-[160px]');
check('the rows live in the list-ticket container', listTicketOf(tree) !== undefined, true);
check('it generates exactly seven days', cardsOf(tree).length, 7);
check('every row is a DayCard element from the real module',
    cardsOf(tree).every((c) => c.type === DayCard), true);

const cardKeys = cardsOf(tree).map((c) => c.key);
check('each row is keyed by its own date string', cardKeys, DATE_STRINGS);
check('...and the keys are unique', new Set(cardKeys).size, 7);
check('the first day of the week is today', cardKeys[0], FIXED_ISO_DATE);
check('the last day of the week is today + 6', cardKeys[6], '2026-10-23');
check('dayName agrees with each row\'s own date', cardsOf(tree).map((c) => c.props.dayName), DAY_NAMES);
check('dayNum agrees with each row\'s own date', cardsOf(tree).map((c) => c.props.dayNum), DAY_NUMS);

console.log('\nWeeklyCalendar — isToday / isPast');

check('isToday marks exactly one row', cardsOf(tree).filter((c) => c.props.isToday).length, 1);
check('...and it is the first one', cardsOf(tree)[0].props.isToday, true);
check('...and no other row claims to be today', cardsOf(tree).slice(1).map((c) => c.props.isToday),
    [false, false, false, false, false, false]);
check('no row in a today..today+6 window is past', cardsOf(tree).map((c) => c.props.isPast),
    [false, false, false, false, false, false, false]);
check("...today's own row included (the comparison is <, not >)", cardsOf(tree)[0].props.isPast, false);

console.log('\nWeeklyCalendar — every row resolves its OWN day');

const planned = render(fixtureFor({
    '2026-10-19': { recipe: { id: 'r2', title: 'Dal' } },
    '2026-10-23': { leftover: true },
}));
const plannedCards = cardsOf(planned.tree);

check('with nothing planned, the empty-state probe reads every day', empty.fixture.calls.resolve.length, 14);
check("...and each row's own read is that row's own date",
    planned.fixture.calls.resolve.slice(-7), DATE_STRINGS);
check('...the probe short-circuits at the first planned day (3 reads, not 7)',
    planned.fixture.calls.resolve.slice(0, 3), DATE_STRINGS.slice(0, 3));
check('...so a planned week costs 10 reads: 3 to probe, 7 to paint', planned.fixture.calls.resolve.length, 10);
check('...so a planned day carries its own recipe', plannedCards[2].props.resolved, { recipe: { id: 'r2', title: 'Dal' } });
check('...a leftover day carries its own flag', plannedCards[6].props.resolved, { leftover: true });
check('...and an unplanned day resolves to null', plannedCards[0].props.resolved, null);
check('the seven rows do not share one resolved object',
    new Set(plannedCards.map((c) => JSON.stringify(c.props.resolved))).size, 3);

console.log('\nWeeklyCalendar — the prop contract with DayCard');

check('each row is handed exactly the props DayCard declares',
    Object.keys(cardsOf(tree)[0].props).sort(), DAYCARD_PROPS);
check('...on every row',
    cardsOf(tree).every((c) => JSON.stringify(Object.keys(c.props).sort()) === JSON.stringify(DAYCARD_PROPS)), true);
check('isPlanConfirmed passes through to every row',
    cardsOf(render(fixtureFor({}, true)).tree).map((c) => c.props.isPlanConfirmed),
    [true, true, true, true, true, true, true]);
check('...and is false when the plan is not confirmed',
    cardsOf(tree).map((c) => c.props.isPlanConfirmed), [false, false, false, false, false, false, false]);

console.log('\nWeeklyCalendar — the empty-state line');

check('with nothing planned it renders the prompt', emptyMessageOf(empty.tree) !== undefined, true);
check('...as a <p>', emptyMessageOf(empty.tree).type, 'p');
check('...carrying the italic body class', emptyMessageOf(empty.tree).props.className, 't-body italic mb-3');
check('...and it says nothing is planned yet',
    String(emptyMessageOf(empty.tree).props.children).includes('Nothing planned yet'), true);
check('one planned day suppresses it (`.some`, not `.every`)',
    emptyMessageOf(render(fixtureFor({ '2026-10-21': { note: 'x' } })).tree) === undefined, true);
check('...the last day alone is enough',
    emptyMessageOf(render(fixtureFor({ '2026-10-23': { note: 'x' } })).tree) === undefined, true);
check('...and it comes back when every day resolves to null',
    emptyMessageOf(render(fixtureFor({})).tree) !== undefined, true);

console.log('\nWeeklyCalendar — the handlers reach the right day');

const taps = [];
const viewRecipe = () => {};
const wired = render(fixtureFor({}), { onDayClick: (d) => taps.push(d), onViewRecipe: viewRecipe });
const wiredCards = cardsOf(wired.tree);

check('every row carries an onRemove', wiredCards.every((c) => typeof c.props.onRemove === 'function'), true);
check('every row carries an onDayClick', wiredCards.every((c) => typeof c.props.onDayClick === 'function'), true);
check('onViewRecipe is passed through by identity',
    wiredCards.every((c) => c.props.onViewRecipe === viewRecipe), true);

wiredCards[3].props.onDayClick();
check("tapping row 3 opens row 3's own date", taps, ['2026-10-20']);
wiredCards[6].props.onDayClick();
check("...and row 6 opens row 6's", taps, ['2026-10-20', '2026-10-23']);

wiredCards[5].props.onRemove();
check("removing row 5 clears row 5's own date", wired.fixture.calls.clear, ['2026-10-22']);
check('...and nothing else', wired.fixture.calls.clear.length, 1);

/* ------------------------------------------------------------------ summary */

console.log(`\n${failures === 0 ? 'ALL OK' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
