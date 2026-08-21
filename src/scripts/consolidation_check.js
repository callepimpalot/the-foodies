// Runnable check for the Shop consolidation pipeline.
//   node src/scripts/consolidation_check.js
//
// Covers every acceptance criterion in TASK_03 (canonicalName / toBaseUnit /
// compound quantities), TASK_04 (categorisation + the 'Other' fallback) and
// TASK_09 (per-source provenance summing to the displayed total), then runs the
// categoriser over the REAL ingredient names in final_recipes.json.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    canonicalName,
    toBaseUnit,
    categoriseIngredient,
    buildShoppingList,
    formatItemQuantity,
    formatMeasure,
    CATEGORY_ORDER,
    FALLBACK_CATEGORY,
    COMMON_ITEM_CATEGORY_CONFLICTS,
} from '../lib/consolidateIngredients.js';
import { commonItems } from '../data/commonItems.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
const failures = [];

function check(label, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) passed += 1;
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
   1. canonicalName
   ========================================================= */
section('canonicalName');

// -- merges the task file asks for
check('yellow onion === onion', canonicalName('Yellow Onion'), canonicalName('Onion'));
check('yellow onions === onion', canonicalName('Yellow Onions'), 'onion');
check('red onion === onion', canonicalName('Red Onion'), 'onion');
check('brown onion === onion', canonicalName('brown onions'), 'onion');
check('chicken breasts -> chicken breast', canonicalName('Chicken Breasts'), 'chicken breast');
check('chicken breast === chicken breasts', canonicalName('chicken breast'), canonicalName('chicken breasts'));
check('garlic clove -> garlic', canonicalName('garlic clove'), 'garlic');
check('cloves garlic -> garlic', canonicalName('cloves garlic'), 'garlic');
check('garlic cloves === cloves garlic', canonicalName('garlic cloves'), canonicalName('cloves garlic'));
check('tomatoes -> tomato', canonicalName('Tomatoes'), 'tomato');
check('potatoes -> potato', canonicalName('Potatoes'), 'potato');
check('trailing parenthetical', canonicalName('Onion (about 200g)'), 'onion');
check('inline parenthetical', canonicalName('Pork Roast (Skin on)'), 'pork roast');
check('prep words stripped', canonicalName('finely chopped fresh Onion'), 'onion');
check('boneless skinless', canonicalName('Boneless Skinless Chicken Breasts'), 'chicken breast');
check('comma clause dropped', canonicalName('Onion, diced'), 'onion');
check('tab whitespace', canonicalName('Ground Beef\t'), 'ground beef');
check('bay leaves -> bay leaf', canonicalName('Bay Leaves'), 'bay leaf');
check('organic stripped', canonicalName('Organic Carrots'), 'carrot');
check('ampersand normalised', canonicalName('Salt & Pepper'), 'salt and pepper');
check('empty input', canonicalName(null), '');
check('idempotent', canonicalName(canonicalName('Yellow Onions, diced')), 'onion');

// -- must NOT merge (the whole point: a wrong merge = a missing ingredient)
checkTrue('red pepper !== green pepper', canonicalName('Red Pepper') !== canonicalName('Green Pepper'));
checkTrue('sweet potato !== potato', canonicalName('Sweet Potato') !== canonicalName('Potato'));
checkTrue('sweet potatoes !== potatoes', canonicalName('Sweet Potatoes') !== canonicalName('Potatoes'));
checkTrue('brown rice !== rice', canonicalName('Brown Rice') !== canonicalName('Rice'));
checkTrue('brown sugar !== sugar', canonicalName('Brown Sugar') !== canonicalName('Sugar'));
checkTrue('icing sugar !== sugar', canonicalName('Icing Sugar') !== canonicalName('Sugar'));
checkTrue('coconut milk !== milk', canonicalName('Coconut Milk') !== canonicalName('Milk'));
checkTrue('cream cheese !== cheese', canonicalName('Cream Cheese') !== canonicalName('Cheese'));
checkTrue('goat cheese !== cheddar cheese', canonicalName('Goat Cheese') !== canonicalName('Cheddar Cheese'));
checkTrue('rye bread !== bread', canonicalName('Rye Bread') !== canonicalName('Bread'));
checkTrue('smoked salmon !== salmon', canonicalName('Smoked Salmon') !== canonicalName('Salmon'));
checkTrue('chicken stock !== chicken', canonicalName('Chicken Stock') !== canonicalName('Chicken'));
checkTrue('dark chocolate !== chocolate', canonicalName('Dark Chocolate') !== canonicalName('Chocolate'));
checkTrue('corn tortilla !== tortilla', canonicalName('Corn Tortillas') !== canonicalName('Tortillas'));
checkTrue('spring onion !== onion', canonicalName('Spring Onions') !== canonicalName('Onions'));
checkTrue('crispy onion !== onion', canonicalName('Crispy Onions') !== canonicalName('Onions'));
checkTrue('white asparagus stays whole', canonicalName('White Asparagus') === 'white asparagus');
checkTrue('asparagus not singularised', canonicalName('Asparagus') === 'asparagus');
checkTrue('hummus not singularised', canonicalName('Hummus') === 'hummus');
checkTrue('couscous not singularised', canonicalName('Couscous') === 'couscous');
checkTrue('molasses not singularised', canonicalName('Molasses') === 'molasses');
checkTrue('cheeses -> cheese not chees', canonicalName('Cheeses') === 'cheese');
checkTrue('standalone cloves survives', canonicalName('Cloves') === 'clove');

/* =========================================================
   2. toBaseUnit
   ========================================================= */
section('toBaseUnit');

check('ml passthrough', toBaseUnit(60, 'ml'), { quantity: 60, unit: 'ml', measure: 'volume' });
check('l -> ml', toBaseUnit(1.5, 'l'), { quantity: 1500, unit: 'ml', measure: 'volume' });
check('litres spelled out', toBaseUnit(2, 'Litres'), { quantity: 2000, unit: 'ml', measure: 'volume' });
check('dl -> ml', toBaseUnit(2, 'dl'), { quantity: 200, unit: 'ml', measure: 'volume' });
check('tsp -> ml', toBaseUnit(3, 'tsp'), { quantity: 15, unit: 'ml', measure: 'volume' });
check('tbsp -> ml', toBaseUnit(2, 'tbsp'), { quantity: 30, unit: 'ml', measure: 'volume' });
check('tablespoons plural', toBaseUnit(2, 'tablespoons'), { quantity: 30, unit: 'ml', measure: 'volume' });
check('cup -> ml', toBaseUnit(2, 'cups'), { quantity: 480, unit: 'ml', measure: 'volume' });
check('g passthrough', toBaseUnit(250, 'g'), { quantity: 250, unit: 'g', measure: 'mass' });
check('kg -> g', toBaseUnit(1.2, 'kg'), { quantity: 1200, unit: 'g', measure: 'mass' });
check('grams spelled out', toBaseUnit(30, 'grams'), { quantity: 30, unit: 'g', measure: 'mass' });
check('oz -> g', toBaseUnit(1, 'oz'), { quantity: 28.3495, unit: 'g', measure: 'mass' });
check('lb -> g', toBaseUnit(1, 'lb'), { quantity: 453.592, unit: 'g', measure: 'mass' });
check('trailing dot unit', toBaseUnit(1, 'kg.'), { quantity: 1000, unit: 'g', measure: 'mass' });

// countable class — never converted into a mass
check('cloves stay countable', toBaseUnit(2, 'cloves'), { quantity: 2, unit: 'clove', measure: 'count' });
check('whole stays countable', toBaseUnit(1, 'whole'), { quantity: 1, unit: 'whole', measure: 'count' });
check('slice stays countable', toBaseUnit(4, 'slices'), { quantity: 4, unit: 'slice', measure: 'count' });
check('no unit at all', toBaseUnit(3, null), { quantity: 3, unit: null, measure: 'count' });
check('empty unit string', toBaseUnit(3, '   '), { quantity: 3, unit: null, measure: 'count' });
check('unknown unit stays its own class', toBaseUnit(1, 'punnet'), { quantity: 1, unit: 'punnet', measure: 'count' });
check('ambiguous pint NOT converted', toBaseUnit(1, 'pint'), { quantity: 1, unit: 'pint', measure: 'count' });
check('null quantity survives', toBaseUnit(null, 'g'), { quantity: null, unit: 'g', measure: 'mass' });
check('2 tbsp + 60ml sums to 90ml',
    toBaseUnit(2, 'tbsp').quantity + toBaseUnit(60, 'ml').quantity, 90);

/* =========================================================
   3. categoriseIngredient
   ========================================================= */
section('categoriseIngredient');

const CATEGORY_CASES = [
    // the fallback bug this task exists to fix
    ['cinnamon', 'Herbs & Spices'],
    ['honey', 'Pantry'],
    ['almonds', 'Pantry'],
    ['lentils', 'Pantry'],
    ['chocolate', 'Pantry'],
    ['tofu', 'Pantry'],
    ['soy sauce', 'Pantry'],
    // substring collisions the old regex cascade got wrong
    ['chicken stock', 'Pantry'],
    ['beef stock', 'Pantry'],
    ['vegetable stock', 'Pantry'],
    ['coconut milk', 'Pantry'],
    ['almond milk', 'Pantry'],
    ['garlic bread', 'Bakery'],
    ['garlic powder', 'Herbs & Spices'],
    ['peanut butter', 'Pantry'],
    ['ice cream', 'Frozen'],
    ['sour cream', 'Dairy & Eggs'],
    ['cream cheese', 'Dairy & Eggs'],
    ['bell peppers', 'Produce'],
    ['red pepper flakes', 'Herbs & Spices'],
    ['black pepper', 'Herbs & Spices'],
    ['eggplant', 'Produce'],          // must not match the "egg" keyword
    ['tomato sauce', 'Pantry'],
    ['tomato', 'Produce'],
    ['breadcrumbs', 'Pantry'],
    ['cocoa powder', 'Pantry'],
    ['baking powder', 'Pantry'],
    ['curry powder', 'Herbs & Spices'],
    ['green curry paste', 'Pantry'],
    // straightforward cases that must not regress
    ['chicken breast', 'Meat & Fish'],
    ['boneless skinless chicken breasts', 'Meat & Fish'],
    ['smoked salmon', 'Meat & Fish'],
    ['pickled herring', 'Meat & Fish'],
    ['ground beef', 'Meat & Fish'],
    ['milk', 'Dairy & Eggs'],
    ['eggs', 'Dairy & Eggs'],
    ['butter', 'Dairy & Eggs'],
    ['rye bread', 'Bakery'],
    ['burger buns', 'Bakery'],
    ['corn tortillas', 'Bakery'],
    ['pizza dough', 'Bakery'],
    ['onion', 'Produce'],
    ['yellow onion', 'Produce'],
    ['sweet potato', 'Produce'],
    ['garlic', 'Produce'],
    ['olive oil', 'Pantry'],
    ['brown rice', 'Pantry'],
    ['pearl barley', 'Pantry'],
    ['dijon mustard', 'Pantry'],
    ['frozen peas', 'Frozen'],
    ['bay leaves', 'Herbs & Spices'],
    ['dill', 'Herbs & Spices'],
    // the honest "I don't know" bucket
    ['flux capacitor', 'Other'],
    ['gribiche', 'Other'],
    ['', 'Other'],
];

CATEGORY_CASES.forEach(([name, expected]) => {
    check(`categorise "${name}"`, categoriseIngredient(name), expected);
});

checkTrue("'Other' exists in CATEGORY_ORDER", CATEGORY_ORDER.includes(FALLBACK_CATEGORY));
check("'Other' sorts last", CATEGORY_ORDER[CATEGORY_ORDER.length - 1], FALLBACK_CATEGORY);
checkTrue('every category is unique', new Set(CATEGORY_ORDER).size === CATEGORY_ORDER.length);

// categorisation must still work on canonicalised names (TASK_03 risk note)
checkTrue(
    'categorisation survives canonicalisation',
    CATEGORY_CASES.every(([name, expected]) => categoriseIngredient(canonicalName(name)) === expected)
);

// commonItems.js reconciliation — no silent contradictions
const COMMON_ITEM_EXPECTED = {
    Apples: 'Produce', Bananas: 'Produce', Avocado: 'Produce', Broccoli: 'Produce',
    Carrots: 'Produce', Onions: 'Produce', Potatoes: 'Produce', Tomatoes: 'Produce',
    Lemons: 'Produce', Garlic: 'Produce',
    'Chicken Breast': 'Meat & Fish', 'Ground Beef': 'Meat & Fish',
    Eggs: 'Dairy & Eggs', Milk: 'Dairy & Eggs', Cheese: 'Dairy & Eggs',
    Butter: 'Dairy & Eggs', Yogurt: 'Dairy & Eggs',
    Bread: 'Bakery', // deliberate override of commonItems' `grains` slug
    Rice: 'Pantry', Pasta: 'Pantry', Cereal: 'Pantry', 'Olive Oil': 'Pantry',
    'Salt & Pepper': 'Herbs & Spices', Coffee: 'Pantry', Tea: 'Pantry',
    'Toilet Paper': 'Other', 'Paper Towels': 'Other', 'Dish Soap': 'Other',
    Sponge: 'Other', 'Trash Bags': 'Other', 'Laundry Det.': 'Other',
    Shampoo: 'Other', 'Body Wash': 'Other', Toothpaste: 'Other', Batteries: 'Other',
};

commonItems.forEach((group) => {
    group?.items?.forEach((item) => {
        const expected = COMMON_ITEM_EXPECTED?.[item?.name];
        if (!expected) {
            failures.push(`commonItems entry "${item?.name}" has no expected shop category in this check`);
            return;
        }
        check(`commonItems "${item?.name}"`, categoriseIngredient(item?.name), expected);
    });
});

/* =========================================================
   4. buildShoppingList — merging, compound quantities, provenance
   ========================================================= */
section('buildShoppingList');

const recipe = (title, baseServings, ingredients) => ({
    id: title.toLowerCase().replace(/\s+/g, '-'),
    title,
    baseServings,
    ingredients,
});

const plan = {
    '2026-08-24': {
        recipe: recipe('Beef Stew', 4, [
            { name: 'Yellow Onion', quantity: 2, unit: null },
            { name: 'Garlic', quantity: 2, unit: 'cloves' },
            { name: 'Olive Oil', quantity: 2, unit: 'tbsp' },
            { name: 'Chicken Breasts', quantity: 400, unit: 'g' },
            { name: 'Red Pepper', quantity: 1, unit: null },
            { name: 'Sweet Potato', quantity: 2, unit: null },
            { name: 'Cinnamon', quantity: null, unit: null },
        ]),
        servings: 4,
    },
    // same recipe, a different day — the ambiguity TASK_09 calls out
    '2026-08-26': {
        recipe: recipe('Beef Stew', 4, [
            { name: 'Onion', quantity: 1, unit: null },
            { name: 'Garlic', quantity: 30, unit: 'g' },
        ]),
        servings: 2, // ratio 0.5
    },
    '2026-08-25': { leftoverOfDate: '2026-08-24' },
    '2026-08-27': { note: 'Eating out' },
    '2026-08-28': {
        // local final_recipes.json shape: {item, amount, unit}
        recipe: recipe('Taco Night', 2, [
            { item: 'onions', amount: '3', unit: null },
            { item: 'Olive Oil', amount: 60, unit: 'ml' },
            { item: 'Chicken Breast', amount: 200, unit: 'g' },
            { item: 'Green Pepper', amount: 1, unit: null },
            { item: 'Potatoes', amount: 2, unit: null },
        ]),
        servings: 2,
    },
};

const list = buildShoppingList(plan);
const byCanonical = Object.fromEntries(list.map((i) => [i.canonicalName, i]));

check('yellow onion + onion + onions => one row', list.filter((i) => i.canonicalName === 'onion').length, 1);
check('onion total 2 + 0.5 + 3 = 5.5', byCanonical.onion?.quantity, 5.5);
check('olive oil 2 tbsp + 60 ml = 90 ml', byCanonical['olive oil']?.quantityLabel, '90ml');
check('chicken breast(s) merge to 600g', byCanonical['chicken breast']?.quantityLabel, '600g');
check('red pepper stays separate', !!byCanonical['red pepper'], true);
check('green pepper stays separate', !!byCanonical['green pepper'], true);
checkTrue('red and green pepper are different rows', byCanonical['red pepper'] !== byCanonical['green pepper']);
check('sweet potato stays separate from potato', !!byCanonical['sweet potato'] && !!byCanonical.potato, true);

// compound quantity: 2 cloves + 30g garlic (scaled 0.5 -> 15g)
check('garlic renders compound, never blank', byCanonical.garlic?.quantityLabel, '2 cloves + 15g');
checkTrue('compound flag set', byCanonical.garlic?.isCompound === true);
checkTrue('compound quantity label is never empty', (byCanonical.garlic?.quantityLabel ?? '').length > 0);
checkTrue('unquantified item flagged, not crashed', byCanonical.cinnamon?.hasUnquantified === true);

// original recipe wording preserved
checkTrue('original wording kept on the row', byCanonical.onion?.name === 'Yellow Onion');
checkTrue(
    'every merged wording retained',
    ['Yellow Onion', 'Onion', 'onions'].every((n) => byCanonical.onion?.variants?.includes(n))
);

// provenance
check('onion has 3 sources', byCanonical.onion?.sources?.length, 3);
check('single-source item has 1 source', byCanonical['red pepper']?.sources?.length, 1);
checkTrue(
    'sources carry recipe title and date',
    byCanonical.onion?.sources?.every((s) => !!s?.recipeTitle && /^\d{4}-\d{2}-\d{2}$/.test(s?.date ?? ''))
);
checkTrue(
    'same recipe on two days is distinguishable by date',
    new Set(byCanonical.onion?.sources?.filter((s) => s?.recipeTitle === 'Beef Stew').map((s) => s?.date)).size === 2
);
checkTrue(
    'scaled per-source amount, not the raw recipe amount',
    byCanonical.onion?.sources?.find((s) => s?.date === '2026-08-26')?.quantity === 0.5
);
check('leftover day attributed to its source day',
    byCanonical.onion?.sources?.find((s) => s?.date === '2026-08-24')?.leftoverDates, ['2026-08-25']);
checkTrue('leftover day adds no separate source',
    byCanonical.onion?.sources?.every((s) => s?.date !== '2026-08-25'));
checkTrue('note day contributes nothing',
    list.every((i) => i?.sources?.every((s) => s?.date !== '2026-08-27')));

// keys
checkTrue('keys are unique', new Set(list.map((i) => i.key)).size === list.length);
checkTrue('keys are namespaced away from household|', list.every((i) => i.key.startsWith('recipe|')));

/* =========================================================
   5. THE assertion — sources must sum to the displayed total
   ========================================================= */
section('sources sum to displayed total');

function bucketOf(source) {
    if (source?.measure === 'volume') return 'volume';
    if (source?.measure === 'mass') return 'mass';
    return `count:${source?.unit ?? ''}`;
}

function totalsFromSources(item) {
    const buckets = new Map();
    (item?.sources ?? []).forEach((s) => {
        if (s?.quantity == null) return;
        const b = bucketOf(s);
        const prev = buckets.get(b) ?? { quantity: 0, unit: s?.unit ?? null };
        buckets.set(b, { quantity: prev.quantity + s.quantity, unit: prev.unit });
    });
    return buckets;
}

function assertSourcesSum(item, listLabel) {
    const fromSources = totalsFromSources(item);
    const rebuilt = Array.from(fromSources.values())
        .map((p) => formatMeasure(p.quantity, p.unit))
        .join(' + ');
    const displayed = formatItemQuantity(item);
    if (rebuilt !== displayed) {
        failures.push(
            `${listLabel}: sources do not sum to the displayed total for "${item?.name}"\n`
            + `      displayed:    ${JSON.stringify(displayed)}\n`
            + `      from sources: ${JSON.stringify(rebuilt)}`
        );
        return;
    }
    passed += 1;
}

list.forEach((item) => assertSourcesSum(item, 'synthetic plan'));
console.log(`   ${list.length} items in the synthetic plan verified.`);

/* =========================================================
   6. Real library — 20 most common ingredients landing in 'Other'
   ========================================================= */
section('real recipe library');

const recipesPath = path.join(__dirname, '../../final_recipes.json');
let otherReport = [];
let realPlanItems = 0;

try {
    const recipes = JSON.parse(fs.readFileSync(recipesPath, 'utf8'));

    const counts = new Map();
    recipes.forEach((r) => {
        (r?.ingredients ?? []).forEach((ing) => {
            const raw = String(ing?.item ?? ing?.name ?? '').replace(/\s+/g, ' ').trim();
            if (!raw) return;
            const entry = counts.get(raw) ?? { raw, count: 0 };
            entry.count += 1;
            counts.set(raw, entry);
        });
    });

    const all = Array.from(counts.values());
    const categorised = all.map((e) => ({ ...e, category: categoriseIngredient(e.raw) }));

    const tally = {};
    categorised.forEach((e) => { tally[e.category] = (tally[e.category] ?? 0) + e.count; });

    console.log(`   ${recipes.length} recipes, ${all.length} distinct ingredient names.`);
    console.log('   Category spread (by occurrence):');
    CATEGORY_ORDER.forEach((c) => {
        if (tally?.[c]) console.log(`     ${String(c).padEnd(15)} ${tally[c]}`);
    });

    otherReport = categorised
        .filter((e) => e.category === FALLBACK_CATEGORY)
        .sort((a, b) => b.count - a.count || a.raw.localeCompare(b.raw))
        .slice(0, 20);

    console.log(`\n   Top ${otherReport.length} ingredients landing in 'Other':`);
    if (!otherReport.length) console.log('     (none)');
    otherReport.forEach((e, i) => {
        console.log(`     ${String(i + 1).padStart(2)}. ${e.raw}  (x${e.count})  -> canonical "${canonicalName(e.raw)}"`);
    });

    // Build a real plan out of the whole library and re-run the sources-sum
    // assertion against it — far more adversarial than the synthetic plan.
    const realPlan = {};
    recipes.forEach((r, i) => {
        const date = `2026-09-${String((i % 28) + 1).padStart(2, '0')}`;
        realPlan[date] = {
            recipe: { ...r, baseServings: r?.servings ?? r?.base_servings ?? 2 },
            servings: 3,
        };
    });
    const realList = buildShoppingList(realPlan);
    realPlanItems = realList.length;
    realList.forEach((item) => assertSourcesSum(item, 'real library plan'));
    console.log(`\n   ${realPlanItems} consolidated items from the real library verified for source-sum integrity.`);
    checkTrue('no real-library item renders a blank quantity where a number existed',
        realList.every((i) => (i?.parts ?? []).every((p) => p?.quantity == null) || (i?.quantityLabel ?? '').length > 0));
} catch (error) {
    failures.push(`Failed to read/scan final_recipes.json: ${error?.message ?? error}`);
}

/* =========================================================
   Reconciliation notes + result
   ========================================================= */
section('commonItems.js reconciliation');
if (!COMMON_ITEM_CATEGORY_CONFLICTS.length) {
    console.log('   No unreconciled conflicts between commonItems.js and the aisle map.');
} else {
    COMMON_ITEM_CATEGORY_CONFLICTS.forEach((c) => {
        console.log(`   "${c.pattern}": commonItems -> ${c.commonItems}, shop map -> ${c.shop} (shop map wins)`);
    });
}

console.log('\n=========================================');
if (failures.length) {
    console.log(`FAILED — ${passed} passed, ${failures.length} failed\n`);
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    process.exit(1);
}
console.log(`PASSED — ${passed} assertions green.`);
