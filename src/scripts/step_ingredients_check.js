/* global process */
// Runnable check for TASK_10's per-step ingredient matcher.
//   node src/scripts/step_ingredients_check.js
//
// Covers every acceptance criterion in TASK_10, then runs the matcher over the REAL
// steps in final_recipes.json and prints a sample so the quality can be judged by eye
// rather than taken on trust.
//
// (The `global` comment above is because eslint.config.js applies browser globals to
// **/*.{js,jsx}; this file only ever runs under node.)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    stepText,
    explicitStepIndexes,
    matchIngredientIndexes,
    ingredientsForStep,
    buildStepIngredients,
    withValidStepIngredients,
} from '../lib/stepIngredients.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const names = (result) => result.map((r) => r?.name);

/* =========================================================
   1. stepText — both stored shapes
   ========================================================= */
section('stepText — text[] and jsonb step shapes');

check('plain string passes through', stepText('Chop the onion.'), 'Chop the onion.');
check('object with .text', stepText({ text: 'Chop the onion.' }), 'Chop the onion.');
check('object with .step', stepText({ step: 'Chop the onion.' }), 'Chop the onion.');
check('object with .instruction', stepText({ instruction: 'Chop the onion.' }), 'Chop the onion.');
check('null is empty, not a crash', stepText(null), '');
check('undefined is empty, not a crash', stepText(undefined), '');
check('an object with none of the keys is empty', stepText({ foo: 1 }), '');

section('matchIngredientIndexes — the raw matcher, indexes only');

check('returns indexes into the ingredient list',
    matchIngredientIndexes('Add the onions and garlic.',
        [{ name: 'Yellow Onion' }, { name: 'Garlic' }, { name: 'Salt' }]), [0, 1]);
check('ignores explicit links — this is the matching layer, not the resolver',
    matchIngredientIndexes({ text: 'Preheat the oven.', ingredientIndexes: [0] }, [{ name: 'Onion' }]), []);
check('empty text matches nothing', matchIngredientIndexes('', [{ name: 'Onion' }]), []);
check('nameless ingredients are skipped, not counted',
    matchIngredientIndexes('Add the onion.', [{ quantity: 2 }, { name: 'Onion' }]), [1]);

/* =========================================================
   2. The headline acceptance criterion
   ========================================================= */
section('a step mentioning onion and garlic surfaces exactly those');

const STEW = [
    { name: 'Yellow Onion', quantity: 2, unit: null },
    { name: 'Garlic', quantity: 3, unit: 'cloves' },
    { name: 'Chicken Breasts', quantity: 400, unit: 'g' },
    { name: 'Olive Oil', quantity: 2, unit: 'tbsp' },
    { name: 'Salt', quantity: null, unit: null },
];

check('onion + garlic step',
    names(ingredientsForStep('Add the onions and garlic and cook until softened.', STEW)),
    ['Yellow Onion', 'Garlic']);

check('quantities come through with the match',
    ingredientsForStep('Add the onions and garlic.', STEW).map((r) => [r.quantity, r.unit]),
    [[2, null], [3, 'cloves']]);

check('indexes point back at the recipe list',
    ingredientsForStep('Add the onions and garlic.', STEW).map((r) => r.index), [0, 1]);

check('results keep the recipe order, not the step order',
    names(ingredientsForStep('Add garlic, then the onion.', STEW)), ['Yellow Onion', 'Garlic']);

/* =========================================================
   3. Steps with nothing in them render NOTHING
   ========================================================= */
section('steps with no detectable ingredients match nothing');

check('preheat the oven', ingredientsForStep('Preheat the oven to 200°C.', STEW), []);
check('rest before serving', ingredientsForStep('Rest for 10 minutes before serving.', STEW), []);
check('empty step', ingredientsForStep('', STEW), []);
check('null step', ingredientsForStep(null, STEW), []);
check('no ingredients at all', ingredientsForStep('Add the onion.', []), []);
check('null ingredients', ingredientsForStep('Add the onion.', null), []);

// TASK_10: steps referring to an earlier output will never match, and that is correct —
// showing nothing beats showing a wrong guess.
check('"add the sauce" matches nothing when there is no sauce ingredient',
    ingredientsForStep('Add the sauce and simmer.', STEW), []);
check('"the reserved liquid" matches nothing',
    ingredientsForStep('Pour in the reserved liquid.', STEW), []);

/* =========================================================
   4. Word boundaries — the substring traps TASK_10 names
   ========================================================= */
section('word boundaries, not includes()');

const BUTTER_OIL = [
    { name: 'Salt', quantity: null, unit: null },
    { name: 'Salted Butter', quantity: 50, unit: 'g' },
    { name: 'Olive Oil', quantity: 2, unit: 'tbsp' },
    { name: 'Rice', quantity: 200, unit: 'g' },
];

check('"salted butter" in the step does NOT drag in salt',
    names(ingredientsForStep('Melt the salted butter in a pan.', BUTTER_OIL)), ['Salted Butter']);
check('"salt" in the step does NOT drag in salted butter',
    names(ingredientsForStep('Season with salt.', BUTTER_OIL)), ['Salt']);
check('"olive oil" matches olive oil, and nothing else',
    names(ingredientsForStep('Heat the olive oil.', BUTTER_OIL)), ['Olive Oil']);
check('bare "oil" still matches olive oil (correct — it IS the oil)',
    names(ingredientsForStep('Heat the oil until shimmering.', BUTTER_OIL)), ['Olive Oil']);
check('"priced" does not match rice by substring',
    ingredientsForStep('Serve at a sensibly priced restaurant.', BUTTER_OIL), []);

/* =========================================================
   5. Plural / singular / prep-word variation
   ========================================================= */
section('plural, singular and prep-word variations');

check('breasts (list) vs breast (step)',
    names(ingredientsForStep('Slice the chicken breast into strips.', STEW)), ['Chicken Breasts']);
check('breasts (list) vs chicken (step) — the spec\'s own example',
    names(ingredientsForStep('Brown the chicken on both sides.', STEW)), ['Chicken Breasts']);
check('onions (step) vs Yellow Onion (list)',
    names(ingredientsForStep('Dice the onions.', STEW)), ['Yellow Onion']);
check('"diced onion" matches',
    names(ingredientsForStep('Add the diced onion.', STEW)), ['Yellow Onion']);
check('tomatoes (step) vs Tomato (list)',
    names(ingredientsForStep('Crush the tomatoes.', [{ name: 'Tomato' }])), ['Tomato']);
check('chillies (step) vs Chilli (list) — spelling alias',
    names(ingredientsForStep('Slice the chillies.', [{ name: 'Chilli' }])), ['Chilli']);

/* =========================================================
   6. Both ingredient shapes
   ========================================================= */
section('both ingredient shapes via normalizeIngredient');

const LOCAL_SHAPE = [
    { item: 'Chicken Breast', amount: '400g', unit: 'g' },
    { item: 'Broccoli', amount: '1', unit: 'head' },
];

check('final_recipes.json {item, amount, unit} shape matches',
    names(ingredientsForStep('Slice chicken breast into strips.', LOCAL_SHAPE)), ['Chicken Breast']);
check('quantity parsed out of the local shape',
    ingredientsForStep('Steam the broccoli.', LOCAL_SHAPE)[0]?.quantity, 1);
check('a bare string ingredient still works',
    names(ingredientsForStep('Add the onion.', ['Onion'])), ['Onion']);

/* =========================================================
   7. Explicit links beat the matcher
   ========================================================= */
section('explicit per-step links take precedence');

check('indexes carried on a step object are used verbatim',
    names(ingredientsForStep({ text: 'Preheat the oven.', ingredientIndexes: [2, 4] }, STEW)),
    ['Chicken Breasts', 'Salt']);
check('snake_case key also accepted',
    names(ingredientsForStep({ text: 'Preheat.', ingredient_indexes: [0] }, STEW)), ['Yellow Onion']);
check('a stored parallel array wins over the step object',
    names(ingredientsForStep({ text: 'Add the onion.' }, STEW, [3])), ['Olive Oil']);
check('an explicit EMPTY array means "genuinely nothing", not "fall back"',
    ingredientsForStep({ text: 'Add the onion and garlic.', ingredientIndexes: [] }, STEW), []);
check('no link array at all falls back to matching',
    names(ingredientsForStep({ text: 'Add the onion.' }, STEW)), ['Yellow Onion']);

check('explicitStepIndexes returns null for a plain string', explicitStepIndexes('Add the onion.'), null);
check('explicitStepIndexes returns null when the key is absent', explicitStepIndexes({ text: 'x' }), null);
check('explicitStepIndexes dedupes and sorts', explicitStepIndexes({ ingredientIndexes: [3, 1, 3] }), [1, 3]);

// Never trust a stored index blindly — a bad backfill must not crash Cook Mode.
check('out-of-range indexes are dropped, not rendered as undefined',
    names(ingredientsForStep({ text: 'x', ingredientIndexes: [0, 99] }, STEW)), ['Yellow Onion']);
check('negative and non-numeric indexes are ignored',
    names(ingredientsForStep({ text: 'x', ingredientIndexes: [-1, 'two', null, 1] }, STEW)), ['Garlic']);

/* =========================================================
   8. buildStepIngredients — whole-recipe resolution
   ========================================================= */
section('buildStepIngredients over a whole recipe');

const RECIPE = {
    ingredients: STEW,
    step_ingredients: [[0], null, [1, 3]],
};
const STEPS = ['Preheat the oven.', 'Brown the chicken.', 'Finish the dish.'];
const built = buildStepIngredients(RECIPE, STEPS);

check('one entry per step', built.length, 3);
check('stored link used for step 1', names(built[0]), ['Yellow Onion']);
check('null entry falls back to matching for step 2', names(built[1]), ['Chicken Breasts']);
check('stored link used for step 3', names(built[2]), ['Garlic', 'Olive Oil']);
check('a recipe with no stored links resolves entirely by matching',
    names(buildStepIngredients({ ingredients: STEW }, ['Dice the onion.'])[0]), ['Yellow Onion']);
check('no steps is an empty array, not a crash', buildStepIngredients({ ingredients: STEW }, null), []);
check('no recipe at all is an empty array', buildStepIngredients(null, STEPS), [[], [], []]);

/* =========================================================
   9. The documented over-inclusion, asserted so it stays deliberate
   ========================================================= */
section('over-inclusion is deliberate, not accidental');

const AMBIGUOUS = [
    { name: 'Chicken Breast', quantity: 400, unit: 'g' },
    { name: 'Chicken Stock', quantity: 500, unit: 'ml' },
];
// TASK_10 requires "chicken breasts" to match a step saying "chicken". The unavoidable
// consequence is that "chicken stock" matches too. A missing ingredient means the user
// doesn't add it; an extra one is a glance — so this is the right side to err on.
check('a bare "chicken" step surfaces both chicken items',
    names(ingredientsForStep('Brown the chicken.', AMBIGUOUS)), ['Chicken Breast', 'Chicken Stock']);
check('naming the stock explicitly still surfaces both, never fewer',
    names(ingredientsForStep('Pour in the chicken stock.', AMBIGUOUS)), ['Chicken Breast', 'Chicken Stock']);

// But an unrelated ingredient must never be dragged in.
checkTrue('an unrelated ingredient is not matched',
    ingredientsForStep('Brown the chicken.', [...AMBIGUOUS, { name: 'Cinnamon' }]).length === 2);

/* =========================================================
   10. withValidStepIngredients — what comes back from Gemini is not trusted
   ========================================================= */
section('withValidStepIngredients — a wrong link is worse than none');

const DRAFT = { title: 'X', ingredients: [{ name: 'Onion' }, { name: 'Garlic' }], steps: ['a', 'b'] };

check('a well-formed draft keeps its links',
    withValidStepIngredients({ ...DRAFT, step_ingredients: [[0], [1]] })?.step_ingredients, [[0], [1]]);
check('an empty entry is legitimate and survives',
    withValidStepIngredients({ ...DRAFT, step_ingredients: [[], [0, 1]] })?.step_ingredients, [[], [0, 1]]);

// The refine-chat failure mode: the model changes the recipe and leaves stale indexes.
check('too few entries drops the whole thing (everything after would be off by one)',
    withValidStepIngredients({ ...DRAFT, step_ingredients: [[0]] })?.step_ingredients, undefined);
check('too many entries drops the whole thing',
    withValidStepIngredients({ ...DRAFT, step_ingredients: [[0], [1], [0]] })?.step_ingredients, undefined);
check('an index past the end of the ingredient list is dropped, the rest kept',
    withValidStepIngredients({ ...DRAFT, step_ingredients: [[0, 9], [1]] })?.step_ingredients, [[0], [1]]);
check('junk entries become empty rather than throwing',
    withValidStepIngredients({ ...DRAFT, step_ingredients: ['nope', [1]] })?.step_ingredients, [[], [1]]);
check('no links at all is left alone',
    Object.prototype.hasOwnProperty.call(withValidStepIngredients(DRAFT), 'step_ingredients'), false);
check('a recipe with no ingredients cannot have links',
    withValidStepIngredients({ steps: ['a'], ingredients: [], step_ingredients: [[0]] })?.step_ingredients, undefined);
check('null in, null out', withValidStepIngredients(null), null);

checkTrue('the rest of the draft is untouched',
    withValidStepIngredients({ ...DRAFT, step_ingredients: [[0], [1]] })?.title === 'X');
checkTrue('the original object is not mutated', (() => {
    const draft = { ...DRAFT, step_ingredients: [[0]] };
    withValidStepIngredients(draft);
    return Array.isArray(draft.step_ingredients);
})());

// And the validated output must be exactly what buildStepIngredients consumes.
check('validated links round-trip through buildStepIngredients',
    names(buildStepIngredients(withValidStepIngredients({ ...DRAFT, step_ingredients: [[1], [0]] }), DRAFT.steps)[0]),
    ['Garlic']);

/* =========================================================
   11. The real library
   ========================================================= */
section('real recipe library');

const recipesPath = path.join(__dirname, '../../final_recipes.json');
const samples = [];

try {
    const recipes = JSON.parse(fs.readFileSync(recipesPath, 'utf8'));
    let totalSteps = 0;
    let matchedSteps = 0;
    let totalMatches = 0;

    recipes.forEach((r) => {
        const steps = r?.instructions ?? r?.steps ?? [];
        const resolved = buildStepIngredients(r, steps);
        resolved.forEach((matches, i) => {
            totalSteps += 1;
            if (matches.length) {
                matchedSteps += 1;
                totalMatches += matches.length;
            }
            if (samples.length < 5 && matches.length && r?.title) {
                samples.push({ title: r.title, step: stepText(steps[i]), matches: names(matches) });
            }
        });

        // Nothing the matcher returns may point outside the ingredient list, and no
        // result may be nameless — either would render as a blank row mid-cook.
        const count = (r?.ingredients ?? []).length;
        resolved.forEach((matches) => {
            matches.forEach((m) => {
                if (!(m?.index >= 0 && m.index < count)) failures.push(`"${r?.title}": index ${m?.index} out of range`);
                else if (!m?.name) failures.push(`"${r?.title}": matched an ingredient with no name`);
                else passed += 1;
            });
        });
    });

    console.log(`   ${recipes.length} recipes, ${totalSteps} steps.`);
    console.log(`   ${matchedSteps} steps matched at least one ingredient (${Math.round((matchedSteps / totalSteps) * 100)}%).`);
    console.log(`   ${(totalMatches / Math.max(matchedSteps, 1)).toFixed(1)} ingredients per matched step on average.`);

    checkTrue('the matcher finds something on a majority of real steps', matchedSteps / totalSteps > 0.5);
    checkTrue('it does not simply return everything', totalMatches / Math.max(matchedSteps, 1) < 4);

    console.log('\n   Five real steps, and what the matcher returns — judge these by eye:');
    samples.forEach((s, i) => {
        console.log(`     ${i + 1}. [${s.title}] "${s.step}"`);
        console.log(`        -> ${s.matches.join(', ')}`);
    });
} catch (error) {
    failures.push(`Failed to read/scan final_recipes.json: ${error?.message ?? error}`);
}

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
