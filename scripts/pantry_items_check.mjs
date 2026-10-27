/**
 * Pantry item-transition checks — `node scripts/pantry_items_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/lib/pantryItems.js` is the module TASK_11 extracted out of `InventoryContext` for exactly
 * one reason, stated in its own header: so that the flag-to-shopping-list behaviour can be
 * *asserted* from a plain node script instead of reasoned about inside a React context. It then
 * sat unread by every script in this directory. Measured, not assumed: `git grep -l pantryItems`
 * across all 24 heads (main + 23 PR heads) returns nothing under `scripts/`, and it is the last
 * pure-logic module in `src/lib/` with no suite — every other one is asserted somewhere
 * (planRows/task07, stepIngredients, recipeSearch's creator grouping, consolidateIngredients,
 * captureRouting, useByDates, unitPreference).
 *
 * WHY IT MATTERS
 * `flagged` is what puts an item on the shopping list. TASK_11 says in two separate places that
 * this path already works and must not regress, and must not be joined by a second route to the
 * list. Two properties in this module carry that:
 *
 *  - `withLowStockToggled` ('I'm running low') puts the item on the list through the existing
 *    `flagged` mechanism, so its result must always satisfy `flagged === lowStock`. If that ever
 *    drifts, Pantry and Shop disagree about the same item — and the failure is silent, because
 *    both screens keep rendering something plausible.
 *  - `withFlagToggled` clears `lowStock` when it un-flags. Ticking an item off in the supermarket
 *    means "I have it now", so a pantry still claiming you are low on it is worse than no pantry.
 *
 * The module feeds a document that is then written to Supabase, so these are not cosmetic: a
 * transition that drops a field silently erases it from the user's pantry on the next sync.
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * This is a node-level logic check. It renders nothing, exercises no React context, calls no
 * Gemini and touches no database — the same scope note as every other script in this directory.
 * It does not prove which components call these helpers, and it cannot prove the *derived* list in
 * `ShopContext.jsx` (which inlines `i?.flagged` rather than calling `isOnShoppingList`) is built
 * from them; that is a grep, not a test. What it does pin is that the two expressions agree.
 *
 * Plain script, no dependencies, non-zero exit on failure — same shape as
 * scripts/task07_check.mjs and scripts/date_unit_helpers_check.mjs.
 */
import {
    withFlagToggled,
    withLowStockToggled,
    withUseByDate,
    withFlagsCleared,
    isOnShoppingList,
} from '../src/lib/pantryItems.js';

let failures = 0;
/**
 * Canonical form for comparison: keys sorted, so a transition that returns the same *values* in a
 * different key order is not reported as a failure. Key order is not a property of this module.
 */
function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
        return Object.keys(value).sort().reduce((acc, k) => {
            acc[k] = canonical(value[k]);
            return acc;
        }, {});
    }
    return value;
}

function check(name, actual, expected) {
    const a = JSON.stringify(canonical(actual));
    const e = JSON.stringify(canonical(expected));
    if (a === e) {
        console.log(`  ok   ${name}`);
    } else {
        failures += 1;
        console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
    }
}

/** A pantry item, with deliberate holes so the pre-TASK_11 shape is representable. */
function item(fields) {
    return { id: 'i1', name: 'Milk', emoji: '🥛', category: 'dairy', ...fields };
}

/** Every key the module is allowed to put on an item. A new one is a decision, not a surprise. */
const ALLOWED_KEYS = ['id', 'name', 'emoji', 'category', 'flagged', 'lowStock', 'useByDate'];

/** The keys of `result` that were not on `before` — i.e. what the transition introduced. */
function introducedKeys(before, result) {
    return Object.keys(result).filter((k) => !(k in before)).sort();
}

function unknownKeys(result) {
    return Object.keys(result).filter((k) => !ALLOWED_KEYS.includes(k)).sort();
}

console.log('\npantryItems — withFlagToggled');

check('an unflagged item becomes flagged',
    withFlagToggled(item({ flagged: false })).flagged, true);
check('a flagged item becomes unflagged',
    withFlagToggled(item({ flagged: true })).flagged, false);
check('a missing flag is treated as unflagged and turns on',
    withFlagToggled(item({})).flagged, true);

check('un-flagging clears lowStock (the documented addition)',
    withFlagToggled(item({ flagged: true, lowStock: true })).lowStock, false);
check('...and clears it even when the flag and lowStock disagreed',
    withFlagToggled(item({ flagged: true, lowStock: false })).lowStock, false);
check('un-flagging an item that never had lowStock records false, not undefined',
    withFlagToggled(item({ flagged: true })).lowStock, false);
check('un-flagging never leaves lowStock undefined',
    withFlagToggled(item({ flagged: true }))?.lowStock === undefined, false);

check('flagging ON preserves an existing lowStock: true',
    withFlagToggled(item({ flagged: false, lowStock: true })).lowStock, true);
check('flagging ON an item with no lowStock records false',
    withFlagToggled(item({ flagged: false })).lowStock, false);
check('flagging ON never leaves lowStock undefined',
    withFlagToggled(item({ flagged: false }))?.lowStock === undefined, false);

check('two flag toggles restore the original flag AND the cleared lowStock',
    withFlagToggled(withFlagToggled(item({ flagged: true, lowStock: true }))),
    item({ flagged: true, lowStock: false }));

const flagSource = item({ flagged: false, lowStock: true, useByDate: '2026-10-20' });
const flagBefore = JSON.stringify(flagSource);
withFlagToggled(flagSource);
check('withFlagToggled does not mutate its input', JSON.stringify(flagSource), flagBefore);
check('withFlagToggled leaves useByDate alone',
    withFlagToggled(flagSource).useByDate, '2026-10-20');
check('withFlagToggled carries the identity fields through',
    [withFlagToggled(flagSource).id, withFlagToggled(flagSource).name,
        withFlagToggled(flagSource).emoji, withFlagToggled(flagSource).category],
    ['i1', 'Milk', '🥛', 'dairy']);

console.log('\npantryItems — withLowStockToggled (the single route to the list)');

check('marking low stock puts the item on the shopping list',
    withLowStockToggled(item({}))?.flagged, true);
check('marking low stock records lowStock true',
    withLowStockToggled(item({}))?.lowStock, true);
check('UN-marking low stock takes it off the shopping list',
    withLowStockToggled(item({ lowStock: true, flagged: true }))?.flagged, false);
check('UN-marking low stock clears lowStock',
    withLowStockToggled(item({ lowStock: true, flagged: true }))?.lowStock, false);
check('an item flagged by hand that is not low stock stays on the list when marked low',
    withLowStockToggled(item({ flagged: true, lowStock: false }))?.flagged, true);
check('...but the same tap un-marked takes it off the list — it means "I have it now"',
    withLowStockToggled(withLowStockToggled(item({ flagged: true, lowStock: false })))?.flagged, false);

const lowStockMatrix = [
    item({}),
    item({ flagged: false }),
    item({ flagged: true }),
    item({ lowStock: false }),
    item({ lowStock: true }),
    item({ flagged: false, lowStock: false }),
    item({ flagged: true, lowStock: false }),
    item({ flagged: false, lowStock: true }),
    item({ flagged: true, lowStock: true }),
];
check('the invariant flagged === lowStock holds after every toggle-on',
    lowStockMatrix.map((i) => { const r = withLowStockToggled(i); return r?.flagged === r?.lowStock; }),
    lowStockMatrix.map(() => true));
check('the invariant flagged === lowStock holds after every toggle-off as well',
    lowStockMatrix.map((i) => {
        const r = withLowStockToggled(withLowStockToggled(i));
        return r?.flagged === r?.lowStock;
    }),
    lowStockMatrix.map(() => true));
check('the toggle flips lowStock in both directions over the whole matrix',
    lowStockMatrix.map((i) => [withLowStockToggled(i)?.lowStock, i?.lowStock === true ? false : true]),
    lowStockMatrix.map((i) => [i?.lowStock === true ? false : true, i?.lowStock === true ? false : true]));

check('two low-stock toggles restore a flagged+low item exactly',
    withLowStockToggled(withLowStockToggled(item({ flagged: true, lowStock: true }))),
    item({ flagged: true, lowStock: true }));
check('two low-stock toggles restore a plain item to off-list and not-low',
    withLowStockToggled(withLowStockToggled(item({}))),
    item({ flagged: false, lowStock: false }));

const lowSource = item({ flagged: false, lowStock: false, useByDate: '2026-11-01' });
const lowBefore = JSON.stringify(lowSource);
withLowStockToggled(lowSource);
check('withLowStockToggled does not mutate its input', JSON.stringify(lowSource), lowBefore);
check('withLowStockToggled leaves useByDate alone',
    withLowStockToggled(lowSource).useByDate, '2026-11-01');

console.log('\npantryItems — the cross-function invariants');

check('isOnShoppingList is true exactly when flagged is truthy',
    [item({ flagged: true }), item({ flagged: false }), item({})].map(isOnShoppingList),
    [true, false, false]);
check('isOnShoppingList agrees with the raw expression ShopContext inlines',
    lowStockMatrix.map((i) => [isOnShoppingList(i), !!i?.flagged]),
    lowStockMatrix.map((i) => [!!i?.flagged, !!i?.flagged]));
check('after a low-stock toggle the list membership follows lowStock, not the old flag',
    lowStockMatrix.map((i) => isOnShoppingList(withLowStockToggled(i))),
    lowStockMatrix.map((i) => withLowStockToggled(i)?.lowStock));
/**
 * What `withFlagToggled` is required to do, written independently of the module: the flag bit
 * inverts, and `lowStock` survives only when the new flag is ON. An item with a missing flag is
 * unflagged, so it turns on.
 */
function flagToggleModel(i) {
    const nextFlag = i?.flagged === true ? false : true;
    return { flagged: nextFlag, lowStock: nextFlag ? i?.lowStock === true : false };
}

check('toggling the flag inverts list membership against the item\'s stored flag',
    lowStockMatrix.map((i) => isOnShoppingList(withFlagToggled(i))),
    lowStockMatrix.map((i) => flagToggleModel(i).flagged));
check('...and nothing is left claiming a low stock unless the item was already low',
    lowStockMatrix.map((i) => withFlagToggled(i)?.lowStock),
    lowStockMatrix.map((i) => flagToggleModel(i).lowStock));
check('un-flagging an item that was flagged always ends off the list and not-low',
    [item({ flagged: true }), item({ flagged: true, lowStock: true }), item({ flagged: true, lowStock: false })]
        .map((i) => {
            const r = withFlagToggled(i);
            return [isOnShoppingList(r), r?.lowStock];
        }),
    [[false, false], [false, false], [false, false]]);
check('ticking low stock off then flagging on cannot resurrect a low-stock claim',
    withFlagToggled(withLowStockToggled(item({ lowStock: true, flagged: true }))),
    item({ flagged: true, lowStock: false }));

console.log('\npantryItems — withUseByDate');

check('an ISO date is stored', withUseByDate(item({}), '2026-10-20').useByDate, '2026-10-20');
check('an ISO date overwrites an existing one',
    withUseByDate(item({ useByDate: '2026-01-01' }), '2026-10-20').useByDate, '2026-10-20');
check('null clears the date', withUseByDate(item({ useByDate: '2026-10-20' }), null).useByDate, null);
check('undefined clears the date', withUseByDate(item({ useByDate: '2026-10-20' }), undefined).useByDate, null);
check('an empty string clears the date rather than storing ""',
    withUseByDate(item({ useByDate: '2026-10-20' }), '').useByDate, null);
check('clearing never leaves undefined in the document',
    withUseByDate(item({}), undefined)?.useByDate === undefined, false);
check('a cleared date is null, so a JSON round trip keeps the key',
    Object.keys(JSON.parse(JSON.stringify(withUseByDate(item({}), null)))).includes('useByDate'), true);

const dateSource = item({ flagged: true, lowStock: true, useByDate: '2026-10-20' });
const dateBefore = JSON.stringify(dateSource);
withUseByDate(dateSource, '2026-12-24');
check('withUseByDate does not mutate its input', JSON.stringify(dateSource), dateBefore);
check('withUseByDate leaves the list flags alone',
    [withUseByDate(dateSource, '2026-12-24').flagged, withUseByDate(dateSource, '2026-12-24').lowStock],
    [true, true]);

console.log('\npantryItems — withFlagsCleared');

check('both flags go false from flagged+low',
    withFlagsCleared(item({ flagged: true, lowStock: true })),
    item({ flagged: false, lowStock: false }));
check('a low-stock-only item clears too',
    withFlagsCleared(item({ flagged: false, lowStock: true })),
    item({ flagged: false, lowStock: false }));
check('an item with neither field gains both, set false',
    [withFlagsCleared(item({})).flagged, withFlagsCleared(item({})).lowStock],
    [false, false]);
check('clearing is idempotent',
    withFlagsCleared(withFlagsCleared(item({ flagged: true, lowStock: true }))),
    item({ flagged: false, lowStock: false }));
check('clearing keeps the use-by date — it is not part of the flags',
    withFlagsCleared(item({ flagged: true, lowStock: true, useByDate: '2026-10-20' })).useByDate,
    '2026-10-20');

const clearSource = item({ flagged: true, lowStock: true });
const clearBefore = JSON.stringify(clearSource);
withFlagsCleared(clearSource);
check('withFlagsCleared does not mutate its input', JSON.stringify(clearSource), clearBefore);

console.log('\npantryItems — the item shape');

const legacyItem = { id: 'legacy', name: 'Bread', emoji: '🍞', category: 'grains', flagged: false };
check('a pre-TASK_11 item (no lowStock, no useByDate) is valid input to all four transitions',
    [withFlagToggled(legacyItem), withLowStockToggled(legacyItem), withUseByDate(legacyItem, '2026-10-20'),
        withFlagsCleared(legacyItem)]
        .map((r) => typeof r?.id === 'string' && typeof r?.flagged === 'boolean'),
    [true, true, true, true]);
check('no transition invents a key outside the declared item shape',
    [withFlagToggled(legacyItem), withLowStockToggled(legacyItem), withUseByDate(legacyItem, '2026-10-20'),
        withFlagsCleared(legacyItem)].map(unknownKeys),
    [[], [], [], []]);
check('the only field withFlagToggled introduces is lowStock',
    introducedKeys(legacyItem, withFlagToggled(legacyItem)), ['lowStock']);
check('the only field withLowStockToggled introduces is lowStock',
    introducedKeys(legacyItem, withLowStockToggled(legacyItem)), ['lowStock']);
check('the only field withUseByDate introduces is useByDate',
    introducedKeys(legacyItem, withUseByDate(legacyItem, '2026-10-20')), ['useByDate']);
check('withFlagsCleared introduces only lowStock (flagged is already there)',
    introducedKeys(legacyItem, withFlagsCleared(legacyItem)), ['lowStock']);
check('every transition returns a fresh object, never the same reference',
    [withFlagToggled(legacyItem) === legacyItem, withLowStockToggled(legacyItem) === legacyItem,
        withUseByDate(legacyItem, '2026-10-20') === legacyItem, withFlagsCleared(legacyItem) === legacyItem],
    [false, false, false, false]);

console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
