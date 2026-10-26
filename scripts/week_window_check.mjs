/**
 * The visible week — `node scripts/week_window_check.mjs`
 *
 * What this is for
 * ----------------
 * The Shop tab listed ingredients for meals the Plan tab no longer showed. The cause
 * was two views computing "which days?" separately: WeeklyCalendar generated today + 6
 * inline, while ShopView passed the WHOLE plan document to buildShoppingList. The plan
 * document accumulates a day entry per date and nothing prunes the ones that have gone
 * by, so the list grew every week while the plan looked correct.
 *
 * So this suite does not merely test a helper. Section 3 drives the REAL
 * buildShoppingList over a plan spanning three weeks and asserts both halves of the
 * claim: that the old call leaked an out-of-window meal, and that the new call does not.
 * If section 3 passes, the bug is reproducible and fixed; if the filter is removed, it
 * goes red — which is the mutation control recorded in the PR.
 *
 * There is no test runner in this project and adding one would be a new build step, so
 * this is a plain script with a non-zero exit on failure — the shape task07_check.mjs
 * already uses.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
    WEEK_LENGTH_DAYS,
    toDateStr,
    visibleWeekDays,
    visibleWeekDates,
    isInVisibleWeek,
    planInVisibleWeek,
} = require('../src/lib/weekWindow.js');

// buildShoppingList is imported from the app itself, not re-implemented here — the point
// of section 3 is that the real aggregation is what changed.
const { buildShoppingList } = require('../src/lib/consolidateIngredients.js');

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

function assert(name, condition, detail = '') {
    if (condition) {
        console.log(`  ok   ${name}`);
    } else {
        failures += 1;
        console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ''}`);
    }
}

/** A fixed base so the whole file is deterministic — never `new Date()`. */
const BASE = new Date('2026-10-26T09:00:00Z');
const WEEK = visibleWeekDates(BASE);

/** The same shift the app does, so an out-of-window date is a real date string. */
function dateStrOffset(days) {
    const d = new Date(BASE);
    d.setDate(d.getDate() + days);
    return toDateStr(d);
}

const OLD_DATE = dateStrOffset(-21); // three weeks before the window
const OLDER_DATE = dateStrOffset(-14);
const FUTURE_DATE = dateStrOffset(30); // past the end of the window

/* ------------------------------------------------------------------ 1. the window */

console.log('\nThe visible week');

check('is seven days', WEEK.length, WEEK_LENGTH_DAYS);
check('starts on the base date', WEEK[0], toDateStr(BASE));
check('all dates are distinct', new Set(WEEK).size, 7);
check('is consecutive', WEEK.map((d, i) => i === 0 ? null : (new Date(d) - new Date(WEEK[i - 1])) / 86400000).slice(1), [1, 1, 1, 1, 1, 1]);

// Seven consecutive days contain exactly one of each weekday — this is what makes the
// Shop tab's "Mon"/"Thu" labels unambiguous once the list is windowed.
check('covers one of each weekday',
    [...new Set(visibleWeekDays(BASE).map((d) => d.dayName))].length, 7);

assert('a date inside the window is reported inside', isInVisibleWeek(WEEK[3], BASE));
assert('a date before the window is reported outside', !isInVisibleWeek(OLD_DATE, BASE));
assert('a date after the window is reported outside', !isInVisibleWeek(FUTURE_DATE, BASE));

/* -------------------------------------------------------- 2. scoping the plan doc */

console.log('\nScoping the plan document');

const PLAN = {
    [OLD_DATE]: { recipe: { id: 'r-beef', title: 'Korean Beef Bowl', baseServings: 2 }, servings: 2 },
    [OLDER_DATE]: { recipe: { id: 'r-udon', title: 'Pork Udon Soup', baseServings: 2 }, servings: 2 },
    [WEEK[0]]: { recipe: { id: 'r-pasta', title: 'Pasta with Ricotta Meatballs', baseServings: 2 }, servings: 2 },
    [WEEK[6]]: { recipe: { id: 'r-chicken', title: 'High-Protein Chicken & Broccoli', baseServings: 2 }, servings: 2 },
    [FUTURE_DATE]: { recipe: { id: 'r-later', title: 'Something Later', baseServings: 2 }, servings: 2 },
    [WEEK[2]]: { note: 'Takeaway — nobody is cooking' },
};

const scoped = planInVisibleWeek(PLAN, BASE);

check('keeps only in-window dates', Object.keys(scoped).sort(), [WEEK[0], WEEK[2], WEEK[6]].sort());
assert('drops the three-weeks-ago meal', !(OLD_DATE in scoped));
assert('drops the future meal', !(FUTURE_DATE in scoped));
assert('keeps a note day', scoped[WEEK[2]]?.note === 'Takeaway — nobody is cooking');
assert('does not mutate the input', Object.keys(PLAN).length === 6,
    `input now has ${Object.keys(PLAN).length} keys`);
assert('entries are passed through by reference, not copied',
    scoped[WEEK[0]] === PLAN[WEEK[0]]);
check('an empty plan scopes to an empty plan', planInVisibleWeek({}, BASE), {});
check('a null plan scopes to an empty plan', planInVisibleWeek(null, BASE), {});

/* ------------------------------------ 3. the reported bug, through the real builder */

console.log('\nThe reported bug, through the real buildShoppingList');

const GARLIC = { name: 'Garlic, minced', quantity: 10, unit: 'clove' };
const GINGER = { name: 'Fresh ginger, grated', quantity: 25, unit: 'g' };
const BROCCOLI = { name: 'Broccoli', quantity: 2, unit: 'head' };
const RICOTTA = { name: 'Ricotta', quantity: 250, unit: 'g' };

const FULL_PLAN = {
    [OLD_DATE]: {
        recipe: {
            id: 'r-beef', title: 'Korean Beef Bowl', baseServings: 2,
            ingredients: [GARLIC, GINGER],
        },
        servings: 2,
    },
    [OLDER_DATE]: {
        recipe: {
            id: 'r-udon', title: 'Pork Udon Soup', baseServings: 2,
            ingredients: [{ name: 'Shiitake mushrooms', quantity: 150, unit: 'g' }],
        },
        servings: 2,
    },
    [WEEK[0]]: {
        recipe: {
            id: 'r-pasta', title: 'Pasta with Ricotta Meatballs', baseServings: 2,
            ingredients: [RICOTTA, GARLIC],
        },
        servings: 2,
    },
    [WEEK[6]]: {
        recipe: {
            id: 'r-chicken', title: 'High-Protein Chicken & Broccoli', baseServings: 2,
            ingredients: [BROCCOLI],
        },
        servings: 2,
    },
};

const namesOf = (items) => items.map((i) => i.canonicalName).sort();

// (a) The OLD behaviour: the whole document. This is the bug as reported — the list
//     carries meals that are not in the week the Plan tab is showing.
const unscopedNames = namesOf(buildShoppingList(FULL_PLAN));
assert('OLD call does leak the three-weeks-ago meal (the reported bug)',
    unscopedNames.includes('ginger'),
    `unscoped list was ${JSON.stringify(unscopedNames)}`);
assert('OLD call does leak the two-weeks-ago meal',
    unscopedNames.includes('shiitake mushroom'),
    `unscoped list was ${JSON.stringify(unscopedNames)}`);

// (b) The FIXED behaviour: the same document, scoped to the visible week.
const scopedNames = namesOf(buildShoppingList(planInVisibleWeek(FULL_PLAN, BASE)));

assert('FIXED call keeps this week\'s ricotta', scopedNames.includes('ricotta'),
    `scoped list was ${JSON.stringify(scopedNames)}`);
assert('FIXED call keeps this week\'s broccoli', scopedNames.includes('broccoli'),
    `scoped list was ${JSON.stringify(scopedNames)}`);
assert('FIXED call drops the out-of-window ginger', !scopedNames.includes('ginger'),
    `scoped list was ${JSON.stringify(scopedNames)}`);
assert('FIXED call drops the out-of-window shiitake mushrooms',
    !scopedNames.includes('shiitake mushroom'),
    `scoped list was ${JSON.stringify(scopedNames)}`);

// The two meals that share garlic: the in-window one must survive on its own. This is
// the "under-merge, never over-merge" rule holding after the filter — the fix removes
// the *source day*, not the ingredient.
const garlicRow = buildShoppingList(planInVisibleWeek(FULL_PLAN, BASE))
    .find((i) => i.canonicalName === 'garlic');
assert('garlic survives from the in-window meal alone', Boolean(garlicRow));
check('garlic is attributed to exactly one day', garlicRow?.sources?.length, 1);
check('and that day is in the window', garlicRow?.sources?.[0]?.date, WEEK[0]);

/* --------------------------------------------------------------------------- done */

console.log('');
if (failures > 0) {
    console.log(`${failures} failure(s)\n`);
    process.exit(1);
}
console.log('all checks passed\n');
