/**
 * Step-ingredient checks — `node scripts/step_ingredients_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/lib/stepIngredients.js` decides which ingredients a Cook Mode step shows. It is the
 * densest pure-logic module in the app — word-boundary matching, plural/-ies variants,
 * phrase matching, link sanitisation and link validation — and until this file it was the one
 * such module with no check script. Its own header comment even pointed at a checker that does
 * not exist (`src/scripts/step_ingredients_check.js`, a path no branch has ever carried), so
 * the module looked covered while nothing read it.
 *
 * The cost of a wrong answer here is asymmetric and that is the whole reason to assert it: a
 * missed ingredient means the user does not put it in the pan, and the module's own header says
 * to over-include when the two trade off. So the assertions below pin BOTH directions — the
 * cases where a naive `includes()` would over-match ("salt" inside "salted butter") must stay
 * clean, and the case the module deliberately over-includes ("brown the chicken" surfacing both
 * chicken breast and chicken stock) must keep doing so. A future "tidy-up" of either is a
 * regression the user feels at the stove.
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * This is a node-level logic check. It does not render CookModeView, does not exercise the
 * Gemini extraction that produces `recipe.step_ingredients`, and touches no database — same
 * scope note as the other scripts in this directory.
 *
 * Plain script, non-zero exit on failure — same shape as scripts/task07_check.mjs.
 */
import {
    stepText,
    explicitStepIndexes,
    matchIngredientIndexes,
    ingredientsForStep,
    buildStepIngredients,
    withValidStepIngredients,
} from '../src/lib/stepIngredients.js';

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

// A pantry that carries every shape the matcher has to survive: multi-word names, a
// count-class and a mass-class ingredient, a pair that share a word (chicken), the
// "salted butter" trap, and one row with no name at all (must never match anything).
// Indexes are the contract `ingredientsForStep` returns, so they are commented.
const PANTRY = [
    { name: 'Boneless Skinless Chicken Breasts', quantity: 2, unit: null }, // 0
    { name: 'Chicken Stock', quantity: '500', unit: 'ml' },                 // 1
    { name: 'Salted Butter', quantity: 2, unit: 'tbsp' },                   // 2
    { name: 'Olive Oil', quantity: 1, unit: 'tbsp' },                       // 3
    { name: 'Salt', quantity: null, unit: null },                           // 4
    { name: 'Sweet Potato', quantity: 1, unit: null },                      // 5
    { name: 'Onions', quantity: 2, unit: null },                            // 6
    { name: 'Chillies', quantity: 1, unit: null },                          // 7
    { name: 'Berries', quantity: 100, unit: 'g' },                          // 8
    { quantity: 3, unit: 'g' },                                             // 9 — unnamed row
];

const indexesFor = (step) => matchIngredientIndexes(step, PANTRY);

console.log('\nstepText — the two stored step shapes');

check('a plain string is itself', stepText('Chop the onion'), 'Chop the onion');
check('an object reads .text', stepText({ text: 'Chop' }), 'Chop');
check('an object falls back to .step', stepText({ step: 'Chop' }), 'Chop');
check('an object falls back to .instruction', stepText({ instruction: 'Chop' }), 'Chop');
check('a number becomes its string', stepText(3), '3');
check('null is the empty string, not "null"', stepText(null), '');
check('undefined is the empty string', stepText(undefined), '');

console.log('\nexplicitStepIndexes — the fallback signal, and the Number(null) = 0 trap');

check('a string step carries no links (null = fall back to matching)',
    explicitStepIndexes('Chop the onion'), null);
check('an object with no link array is also null', explicitStepIndexes({ text: 'Chop' }), null);
check('an explicit EMPTY array means "this step uses nothing" — and is honoured',
    explicitStepIndexes({ ingredientIndexes: [] }), []);
check('the snake_case key is read too',
    explicitStepIndexes({ ingredient_indexes: [1] }), [1]);
check('null and "" entries are dropped, not coerced to ingredient 0',
    explicitStepIndexes({ ingredientIndexes: [null, '', 2] }), [2]);
check('a false entry is dropped too (Number(false) is also 0)',
    explicitStepIndexes({ ingredientIndexes: [false, 1] }), [1]);
check('duplicates collapse and the result is sorted',
    explicitStepIndexes({ ingredientIndexes: [4, 1, 4, 0] }), [0, 1, 4]);
check('non-integers and negatives are rejected; numeric strings are accepted',
    explicitStepIndexes({ ingredientIndexes: [1.5, -1, '2', ' 3 '] }), [2, 3]);
check('a non-array is the fallback signal, not an empty link set',
    explicitStepIndexes({ ingredientIndexes: 'nope' }), null);

console.log('\nmatchIngredientIndexes — word boundaries and the deliberate over-include');

check('a plain single ingredient matches its step', indexesFor('Season with salt.'), [4]);
check('"salted butter" does NOT drag in the separate "Salt" row',
    indexesFor('Melt the salted butter.'), [2]);
check('a bare "oil" does NOT drag in "Olive Oil" by substring',
    indexesFor('Heat the oil in a pan.'), [3]);
check('a plural list name matches a singular step word',
    indexesFor('Chop the onion.'), [6]);
check('an -ies plural matches its -y-stemmed list name (chillies)',
    indexesFor('Add the chillies.'), [7]);
check('an -ies plural matches its -i-stemmed list name (berries)',
    indexesFor('Top with berries.'), [8]);
check('a multi-word name matches as a phrase',
    indexesFor('Roast the sweet potatoes.'), [5]);
check('the documented over-include: chicken breast AND chicken stock both surface',
    indexesFor('Brown the chicken in a pan.'), [0, 1]);
check('a step mentioning nothing returns no indexes', indexesFor('Preheat the oven.'), []);
check('a null step returns no indexes', indexesFor(null), []);
check('the unnamed row can never be matched',
    indexesFor('Add 3 grams of it.'), []);

console.log('\ningredientsForStep — explicit links win, [] means render nothing');

check('an explicit link set beats the matcher', (() => {
    const out = ingredientsForStep('Brown the chicken', PANTRY, [5]);
    return out.map((x) => [x.index, x.name]);
})(), [[5, 'Sweet Potato']]);
check('an explicit EMPTY link set renders nothing, even though the text would match',
    ingredientsForStep('Season with salt', PANTRY, []), []);
check('links past the end of the ingredient list are dropped', (() => {
    const out = ingredientsForStep('x', PANTRY, [99, 0]);
    return out.map((x) => x.index);
})(), [0]);
check('links carried ON the step object are used when no stored set is passed', (() => {
    const out = ingredientsForStep({ text: 'x', ingredientIndexes: [4] }, PANTRY, null);
    return out.map((x) => x.index);
})(), [4]);
check('with no links at all it falls back to the matcher', (() => {
    const out = ingredientsForStep('Season with salt', PANTRY, null);
    return out.map((x) => x.index);
})(), [4]);
check('an empty ingredient list is [] and never throws',
    ingredientsForStep('Season with salt', []), []);
check('results come back in the recipe\'s own order', (() => {
    const out = ingredientsForStep('Brown the chicken, then season with salt', PANTRY);
    return out.map((x) => x.index);
})(), [0, 1, 4]);
check('each result is the normalised shape {index,name,quantity,unit}', (() => {
    const out = ingredientsForStep('Season with salt', PANTRY);
    return out.map((x) => Object.keys(x));
})(), [['index', 'name', 'quantity', 'unit']]);
check('an unnamed ingredient never appears in a result, even when matched', (() => {
    const out = ingredientsForStep('Season with salt', PANTRY);
    return out.every((x) => !!x.name);
})(), true);

console.log('\nbuildStepIngredients — every step of a recipe in one pass');

const RECIPE = {
    ingredients: PANTRY,
    steps: ['Brown the chicken.', 'Season with salt.', 'Add the chillies.'],
    step_ingredients: [[0, 1], [4], [7]],
};
check('links are read per step from recipe.step_ingredients', (() => {
    const out = buildStepIngredients(RECIPE, RECIPE.steps);
    return out.map((step) => step.map((x) => x.name));
})(), [
    ['Boneless Skinless Chicken Breasts', 'Chicken Stock'],
    ['Salt'],
    ['Chillies'],
]);
check('a recipe with no links at all falls back to matching for every step', (() => {
    const out = buildStepIngredients({ ingredients: PANTRY, steps: ['Add the chillies.'] }, ['Add the chillies.']);
    return out.map((step) => step.map((x) => x.name));
})(), [['Chillies']]);
check('no steps means no work and no throw',
    buildStepIngredients({ ingredients: PANTRY }, undefined), []);

console.log('\nwithValidStepIngredients — drop a wrong link, never show one');

check('a well-formed link set survives', (() => {
    const out = withValidStepIngredients({ ingredients: PANTRY, steps: ['a', 'b'], step_ingredients: [[0], [4]] });
    return out.step_ingredients;
})(), [[0], [4]]);
check('a length mismatch drops the WHOLE link set (off-by-one is worse than none)', (() => {
    const out = withValidStepIngredients({ ingredients: PANTRY, steps: ['a'], step_ingredients: [[0], [1]] });
    return 'step_ingredients' in out;
})(), false);
check('a link past the end of the ingredient list is filtered out', (() => {
    const out = withValidStepIngredients({ ingredients: PANTRY.slice(0, 2), steps: ['a'], step_ingredients: [[0, 9]] });
    return out.step_ingredients;
})(), [[0]]);
check('a non-array entry becomes an empty link set, not a crash', (() => {
    const out = withValidStepIngredients({ ingredients: PANTRY, steps: ['a', 'b'], step_ingredients: ['nope', [4]] });
    return out.step_ingredients;
})(), [[], [4]]);
check('a recipe with no ingredients drops the link set', (() => {
    const out = withValidStepIngredients({ ingredients: [], steps: ['a'], step_ingredients: [[0]] });
    return 'step_ingredients' in out;
})(), false);
check('a recipe with no steps drops the link set', (() => {
    const out = withValidStepIngredients({ ingredients: PANTRY, steps: [], step_ingredients: [] });
    return 'step_ingredients' in out;
})(), false);
check('null in, null out', withValidStepIngredients(null), null);

console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
