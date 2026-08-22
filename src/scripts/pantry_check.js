/* global process */
// Runnable check for TASK_11 Phase 1 — the pantry item transitions and the
// "use it up" date logic.
//   node src/scripts/pantry_check.js
//
// The reason this exists at all: TASK_11 warns twice that the existing
// flag-to-shopping-list behaviour must not regress, and that low-stock must flow
// through that same mechanism rather than a parallel one. Both are asserted here.
//
// (The `global` comment above is because eslint.config.js applies browser globals to
// **/*.{js,jsx}; this file only ever runs under node.)

import {
    withFlagToggled,
    withLowStockToggled,
    withUseByDate,
    withFlagsCleared,
    isOnShoppingList,
} from '../lib/pantryItems.js';
import {
    daysUntil,
    isoInDays,
    describeUseBy,
    expiringItems,
    parseUseByDate,
    EXPIRY_HORIZON_DAYS,
} from '../lib/useByDates.js';

let passed = 0;
const failures = [];

function check(label, actual, expected) {
    if (JSON.stringify(actual) === JSON.stringify(expected)) passed += 1;
    else failures.push(`${label}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`);
}

function checkTrue(label, actual) {
    if (actual === true) passed += 1;
    else failures.push(`${label}\n      expected: true\n      actual:   ${JSON.stringify(actual)}`);
}

function section(title) {
    console.log(`\n## ${title}`);
}

/* =========================================================
   1. Existing items migrate without loss
   ========================================================= */
section('migration — an item stored before Phase 1 still works');

// Exactly the shape DEFAULT_ITEMS and every persisted item had before this task.
const LEGACY = { id: 'seed-1', name: 'Milk', emoji: '🥛', category: 'dairy', flagged: false };

check('nothing is lost when flagging a legacy item',
    withFlagToggled(LEGACY),
    { id: 'seed-1', name: 'Milk', emoji: '🥛', category: 'dairy', flagged: true, lowStock: false });
checkTrue('a legacy item with no lowStock is not treated as low', withFlagToggled(LEGACY).lowStock === false);
checkTrue('a legacy item keeps its emoji and category through every transition', (() => {
    const next = withUseByDate(withLowStockToggled(LEGACY), '2026-08-25');
    return next.emoji === '🥛' && next.category === 'dairy' && next.name === 'Milk';
})());
check('both new fields absent is a valid resting state', daysUntil(LEGACY.useByDate), null);
check('describing a missing date is empty, not "Invalid Date"', describeUseBy(LEGACY.useByDate), '');
checkTrue('the original item is never mutated', (() => {
    const item = { ...LEGACY };
    withFlagToggled(item);
    withLowStockToggled(item);
    withUseByDate(item, '2026-08-25');
    return item.flagged === false && item.lowStock === undefined && item.useByDate === undefined;
})());

/* =========================================================
   2. THE non-regression: flag -> shopping list
   ========================================================= */
section('flag to shopping list — the behaviour that must not regress');

const stocked = { id: 'a', name: 'Milk', flagged: false };

check('flagging puts it on the list', isOnShoppingList(withFlagToggled(stocked)), true);
check('un-flagging takes it off', isOnShoppingList(withFlagToggled(withFlagToggled(stocked))), false);
check('toggling twice returns to the starting state',
    withFlagToggled(withFlagToggled(stocked)).flagged, false);

// ShopView ticks an item off by calling toggleFlag. That must clear "running low" too:
// you just bought it.
const low = withLowStockToggled(stocked);
checkTrue('marking low puts it on the list', isOnShoppingList(low));
checkTrue('marking low records the pantry state', low.lowStock === true);
const bought = withFlagToggled(low);
checkTrue('ticking it off in Shop takes it off the list', !isOnShoppingList(bought));
checkTrue('ticking it off in Shop also clears "running low"', bought.lowStock === false);

// ...but flagging something that was never marked low must not invent a low state.
checkTrue('flagging alone does not claim you are running low',
    withFlagToggled(stocked).lowStock === false);

/* =========================================================
   3. Low stock uses the existing mechanism, not a parallel one
   ========================================================= */
section('low stock rides the existing flag, not a second path');

checkTrue('one tap marks low AND lists it', (() => {
    const next = withLowStockToggled(stocked);
    return next.lowStock === true && next.flagged === true;
})());
checkTrue('tapping again clears both', (() => {
    const next = withLowStockToggled(withLowStockToggled(stocked));
    return next.lowStock === false && next.flagged === false;
})());
checkTrue('the net effect on Shop is identical to the old flag-only tap', (() => {
    const oldBehaviour = withFlagToggled(stocked);
    const newBehaviour = withLowStockToggled(stocked);
    return isOnShoppingList(oldBehaviour) === isOnShoppingList(newBehaviour);
})());

check('clearFlags resets both fields', withFlagsCleared(low), { id: 'a', name: 'Milk', flagged: false, lowStock: false });

/* =========================================================
   4. Use-by dates
   ========================================================= */
section('use-by dates');

check('setting a date', withUseByDate(stocked, '2026-08-25').useByDate, '2026-08-25');
check('clearing with null', withUseByDate({ ...stocked, useByDate: '2026-08-25' }, null).useByDate, null);
check('clearing with an empty string', withUseByDate(stocked, '').useByDate, null);
checkTrue('setting a date does not touch the list flag', withUseByDate(low, '2026-08-25').flagged === true);

check('today is 0 days away', daysUntil(isoInDays(0)), 0);
check('tomorrow is 1', daysUntil(isoInDays(1)), 1);
check('yesterday is -1', daysUntil(isoInDays(-1)), -1);
check('a week out is 7', daysUntil(isoInDays(7)), 7);
check('an unparseable date is null, not NaN', daysUntil('not-a-date'), null);
check('no date is null', daysUntil(null), null);
check('parseUseByDate rejects junk', parseUseByDate('nope'), null);

check('today reads as Today', describeUseBy(isoInDays(0)), 'Today');
check('tomorrow reads as Tomorrow', describeUseBy(isoInDays(1)), 'Tomorrow');
check('yesterday reads as Yesterday', describeUseBy(isoInDays(-1)), 'Yesterday');
check('three days overdue reads in days', describeUseBy(isoInDays(-3)), '3 days ago');
checkTrue('within the week reads as a weekday name',
    /^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day$/.test(describeUseBy(isoInDays(4))));
checkTrue('beyond a week reads as a date', /^[A-Z][a-z]{2} \d+$/.test(describeUseBy(isoInDays(20))));

/* =========================================================
   5. What the Home screen surfaces — and when it stays quiet
   ========================================================= */
section('the Home section, including its silence');

const PANTRY = [
    { id: 'a', name: 'Spinach', useByDate: isoInDays(2) },
    { id: 'b', name: 'Milk', useByDate: isoInDays(-1) },
    { id: 'c', name: 'Rice' },                              // no date at all
    { id: 'd', name: 'Yogurt', useByDate: isoInDays(9) },   // beyond the horizon
    { id: 'e', name: 'Bread', useByDate: isoInDays(EXPIRY_HORIZON_DAYS) },
    { id: 'f', name: 'Cheese', useByDate: isoInDays(EXPIRY_HORIZON_DAYS + 1) },
];

check('soonest first, overdue included',
    expiringItems(PANTRY).map((e) => e.item.name), ['Milk', 'Spinach', 'Bread']);
check('an item on the horizon boundary is included', daysUntil(isoInDays(EXPIRY_HORIZON_DAYS)), EXPIRY_HORIZON_DAYS);
checkTrue('one day past the horizon is excluded',
    !expiringItems(PANTRY).some((e) => e.item.name === 'Cheese'));
checkTrue('an item with no date is never surfaced',
    !expiringItems(PANTRY).some((e) => e.item.name === 'Rice'));

// The rule the whole section lives or dies by: when there's nothing to say, say nothing.
check('nothing expiring returns empty, so the section renders nothing',
    expiringItems([{ id: 'x', name: 'Rice' }, { id: 'y', name: 'Salt' }]), []);
check('an empty pantry returns empty', expiringItems([]), []);
check('a null pantry returns empty, not a crash', expiringItems(null), []);
check('items with junk dates are dropped rather than shown as Invalid Date',
    expiringItems([{ id: 'z', name: 'Mystery', useByDate: 'soon' }]), []);

check('same-day items sort alphabetically so the order is stable',
    expiringItems([
        { id: '1', name: 'Zucchini', useByDate: isoInDays(1) },
        { id: '2', name: 'Apples', useByDate: isoInDays(1) },
    ]).map((e) => e.item.name), ['Apples', 'Zucchini']);

/* =========================================================
   Result
   ========================================================= */
console.log('\n=========================================');
if (failures.length) {
    console.log(`FAILED — ${passed} passed, ${failures.length} failed\n`);
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    process.exit(1);
}
console.log(`PASSED — ${passed} assertions green.`);
