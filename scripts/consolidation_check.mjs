/**
 * Shop consolidation checks — `node scripts/consolidation_check.mjs`
 *
 * `src/lib/consolidateIngredients.js` is the largest piece of logic in the app and, until this script,
 * the only one with no check at all. It merges every recipe day in the plan into one shopping list, and
 * it has an explicit governing bias written into its header:
 *
 *     "under-merge, never over-merge. A duplicate row is a mild annoyance. A wrong merge is an
 *      ingredient silently missing at cook time."
 *
 * That bias is what these assertions pin. Every one of them is a claim the module makes about itself —
 * in its header comments and in its own doc-comments — turned into a runnable check, so a future edit
 * that quietly merges "red pepper" into "pepper" or sums a head of garlic into grams goes red here
 * instead of going unnoticed into a supermarket.
 *
 * Scope, honestly stated: this is a *logic* check. It exercises the module through `node` directly
 * (which is why the module imports with explicit `.js` extensions). It does NOT cover anything that
 * needs the browser, the database or Gemini. It is the same plain-script shape as the other check
 * scripts here — no test runner, non-zero exit on failure.
 *
 * Non-vacuity: each assertion below was proven to fail when the property it protects is broken. The
 * over-merge control — adding `'red'` to INTERCHANGEABLE_QUALIFIERS.pepper — turns the pepper
 * assertions red; see the commit message for the measured run.
 */
import {
    canonicalName,
    categoriseIngredient,
    toBaseUnit,
    formatMeasure,
    buildShoppingList,
    CATEGORY_ORDER,
    FALLBACK_CATEGORY,
    COMMON_ITEM_CATEGORY_CONFLICTS,
} from '../src/lib/consolidateIngredients.js';

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
function checkTrue(name, cond) {
    check(name, Boolean(cond), true);
}

/* ── LAYER 1 — canonicalName: the merge key ─────────────────────────────────────────────────── */

console.log('\ncanonicalName — what merges, and the things that must NEVER merge');

check('preparation words and a parenthetical amount are stripped',
    canonicalName('Yellow Onions, finely diced (about 200g)'), 'onion');

check('interchangeable qualifiers on a whitelisted head noun collapse',
    [canonicalName('yellow onion'), canonicalName('white onion'), canonicalName('red onion')],
    ['onion', 'onion', 'onion']);

// The whitelist is deliberate: a blanket adjective-stripper would fold these together, and that is
// the exact failure the module exists to prevent.
check('red and green pepper stay distinct (they are different purchases)',
    [canonicalName('red pepper'), canonicalName('green pepper')], ['red pepper', 'green pepper']);
check('sweet potato does NOT collapse into potato',
    [canonicalName('sweet potato'), canonicalName('potato')], ['sweet potato', 'potato']);

check('a measure word is stripped only when something else survives',
    [canonicalName('2 cloves garlic'), canonicalName('garlic clove')], ['garlic', 'garlic']);
check('a standalone "cloves" (the spice) survives',
    canonicalName('cloves'), 'clove');

check('spelling aliases fold onto one key', [
    canonicalName('spring onion') === canonicalName('scallions'),
    canonicalName('coriander leaves') === canonicalName('cilantro'),
    canonicalName('yoghurt') === canonicalName('yogurt'),
    canonicalName('chick peas') === canonicalName('chickpea'),
], [true, true, true, true]);

check('plurals singularise', [
    canonicalName('tomatoes') === canonicalName('tomato'),
    canonicalName('eggs') === canonicalName('egg'),
    canonicalName('oats') === canonicalName('oat'),
], [true, true, true]);
check('words that end in s but are not plurals are left alone',
    [canonicalName('molasses'), canonicalName('asparagus')], ['molasses', 'asparagus']);

check('a stray amount inside the name field is stripped', canonicalName('1/2 cup milk'), 'milk');

check('nothing meaningful left reads as empty, never as a crash',
    [canonicalName(''), canonicalName(null), canonicalName('   '), canonicalName('123')],
    ['', '', '', '']);

/* ── LAYER 2 — toBaseUnit: the number that can be added ─────────────────────────────────────── */

console.log('\ntoBaseUnit — metric kitchen conventions, and the count class that is never a mass');

check('metric volume to ml', toBaseUnit(2, 'tbsp'), { quantity: 30, unit: 'ml', measure: 'volume' });
check('mass to g', toBaseUnit(1, 'kg'), { quantity: 1000, unit: 'g', measure: 'mass' });
check('a count unit keeps its own bucket', toBaseUnit(2, 'cloves'),
    { quantity: 2, unit: 'clove', measure: 'count' });
check('a bare number is a count', toBaseUnit(3, null), { quantity: 3, unit: null, measure: 'count' });

// Deliberate omission: pint/quart/fl oz differ between UK and US, so they must NOT be summed as
// volume — they fall through to their own row.
check('ambiguous imperial volumes fall through to their own count row',
    [toBaseUnit(1, 'pint'), toBaseUnit(1, 'fl oz')],
    [{ quantity: 1, unit: 'pint', measure: 'count' },
        { quantity: 1, unit: 'fl oz', measure: 'count' }]);

check('formatMeasure pluralises a count but keeps g/ml tight',
    [formatMeasure(1, 'clove'), formatMeasure(2, 'clove'), formatMeasure(30, 'g')],
    ['1 clove', '2 cloves', '30g']);

/* ── CATEGORISATION — the fallback sorts last, on purpose ───────────────────────────────────── */

console.log('\ncategoriseIngredient — most specific match wins, unknown is honestly "Other"');

check('a multi-word phrase beats a single word', categoriseIngredient('chicken stock'), 'Pantry');
check('the single word still resolves on its own', categoriseIngredient('chicken'), 'Meat & Fish');
check('matching is whole-word, so egg never matches eggplant',
    [categoriseIngredient('egg'), categoriseIngredient('eggplant')], ['Dairy & Eggs', 'Produce']);
check('the documented commonItems override holds', categoriseIngredient('bread'), 'Bakery');
check('an unrecognised name lands in the fallback, not a confident wrong aisle',
    categoriseIngredient('mystery thing'), 'Other');
check('"Other" is the last category and the declared fallback',
    [CATEGORY_ORDER[CATEGORY_ORDER.length - 1], FALLBACK_CATEGORY], ['Other', 'Other']);
checkTrue('commonItems/shop category disagreements are surfaced, not hidden',
    Array.isArray(COMMON_ITEM_CATEGORY_CONFLICTS));

/* ── LAYER 3 — buildShoppingList: the merge itself ──────────────────────────────────────────── */

console.log('\nbuildShoppingList — summing, the compound row, and what a leftover day does');

const curry = {
    id: 'r1', title: 'Thai Green Curry', baseServings: 4,
    ingredients: [
        { name: 'Garlic', quantity: 2, unit: 'cloves' },
        { name: 'Garlic', quantity: 30, unit: 'g' },
        { name: 'Coconut milk', quantity: 400, unit: 'ml' },
        { name: 'Chicken breast', quantity: 500, unit: 'g' },
        { name: 'Salt', quantity: null, unit: null },
    ],
};
const stirFry = {
    id: 'r2', title: 'Veg Stir-fry', baseServings: 2,
    // The legacy {item, amount} shape from final_recipes.json — the module accepts either.
    ingredients: [
        { item: 'Garlic', amount: '1', unit: 'clove' },
        { item: 'Coconut Milk', amount: '200', unit: 'ml' },
        { item: 'Spring onions', amount: 2, unit: null },
    ],
};
const plan = {
    '2026-10-10': { recipe: curry, servings: 4 },
    '2026-10-11': { recipe: stirFry, servings: 2 },
    '2026-10-12': { leftoverOfDate: '2026-10-11' },
    '2026-10-13': { note: 'eating out' },
};
const list = buildShoppingList(plan);
const byName = (n) => list.find((i) => i.canonicalName === n);

check('two amounts that cannot be summed are BOTH kept, not destroyed',
    (() => { const g = byName('garlic'); return [g.quantityLabel, g.isCompound]; })(),
    ['3 cloves + 30g', true]);
check('the back-compat scalar is null when a row is compound',
    byName('garlic').quantity, null);

check('one ingredient across two recipes and two shapes sums into a single row',
    (() => { const c = list.filter((i) => i.canonicalName === 'coconut milk');
        return [c.length, byName('coconut milk').quantityLabel]; })(),
    [1, '600ml']);
check('a merged row keeps every distinct wording it absorbed',
    byName('coconut milk').variants, ['Coconut milk', 'Coconut Milk']);

check('an unquantified ingredient is flagged, not given a fake number',
    (() => { const s = byName('salt'); return [s.hasUnquantified, s.quantityLabel]; })(),
    [true, '']);

check('a leftover day adds no ingredients but is attributed back to its source day',
    (() => {
        const sourced = list.filter((i) => i.sources.some((s) => s.leftoverDates.includes('2026-10-12')));
        return [byName('scallion') ? true : false, sourced.length > 0];
    })(), [true, true]);
check('the leftover day itself contributes no rows of its own',
    list.some((i) => i.sources.some((s) => s.date === '2026-10-12')), false);
check('a note day contributes nothing',
    list.some((i) => i.sources.some((s) => s.date === '2026-10-13')), false);

check('distinct ingredients stay distinct rows (under-merge, never over-merge)',
    (() => {
        const l = buildShoppingList({
            d: {
                recipe: { id: 'x', title: 't', baseServings: 2, ingredients: [
                    { name: 'Sweet potato', quantity: 1, unit: null },
                    { name: 'Potato', quantity: 1, unit: null },
                    { name: 'Red pepper', quantity: 1, unit: null },
                    { name: 'Green pepper', quantity: 1, unit: null },
                ] },
            },
        });
        return l.map((i) => i.canonicalName).sort();
    })(), ['green pepper', 'potato', 'red pepper', 'sweet potato']);

check('servings scaling multiplies the amounts',
    buildShoppingList({ d: { recipe: curry, servings: 8 } })
        .find((i) => i.canonicalName === 'chicken breast').quantityLabel,
    '1000g');

check('an empty or absent plan produces an empty list, not a crash',
    [buildShoppingList(null), buildShoppingList({}), buildShoppingList(undefined)], [[], [], []]);
check('a plan of only leftovers and notes produces an empty list',
    buildShoppingList({ d: { leftoverOfDate: 'x' }, e: { note: 'n' } }), []);

console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
