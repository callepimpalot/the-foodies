/**
 * Holistic-refine contract checks — `node scripts/refine_contract_check.mjs`
 *
 * WHY THIS EXISTS
 * `refineRecipe` is the app's "ASK FOR CHANGES" turn — a follow-up instruction applied to an
 * already-extracted recipe draft. It was measured, on the live provider (google/gemini-2.5-flash
 * via OpenRouter) with the app's REAL prompt and schema, to be rubbish: it does not treat the
 * recipe holistically. Four defects, all reproduced below with the real probe shapes:
 *
 *   D1 ingredient STRUCTURE COLLAPSES — probe A ("swap the pork mince for chicken breast") returned
 *      every ingredient as a bare `unit` with `quantity` GONE. 9 of 10 measurements destroyed.
 *   D2 fields MANGLED — probe B ("make this for 2 people") returned every row as
 *      `{name:'Pork mince', unit:'g  Pork mince  250'}` with no quantity: name+number crammed into
 *      `unit`. (The proxy sends json_schema.strict=false, so nothing enforces the shape.)
 *   D3 the monster — probe A ingredient 0's deliberation ran to ~1,300 characters in one field.
 *   D5 derived fields don't follow — kcal stayed 650 across a pork->chicken swap.
 *
 * The fix is code-side: a deterministic unit converter, a sanitiser that repairs/rejects malformed
 * rows and hard-refuses to lose a measurement the input carried, a step_ingredients recompute, and a
 * kcal/servings invariant. This file drives those REAL exported functions — never a re-implementation.
 *
 * WHAT IT ASSERTS (see the sections below): the sanitiser repairs the probe A + probe B shapes; no
 * field is malformed afterwards; a measurement the input carried is never lost; step_ingredients is
 * recomputed from the returned steps rather than trusted; kcal tracks base_servings; unit conversion
 * round-trips and leaves countable units alone; the new prompt text carries the propagation rules; and
 * the whole thing survives end to end through refineRecipe with a stubbed provider.
 *
 * MUTATION CONTROLS (per the repo's rule — a suite that only asserts the new behaviour proves the fix
 * runs, not that there was a bug). Five controls, each of which must go RED (exit 1):
 *     node scripts/refine_contract_check.mjs --controls
 * The controls are: stuffed-unit recovery disabled, quantity restore disabled, kcal scaling disabled,
 * step_ingredients recompute replaced by the model's own array, and countable units forced through a
 * conversion. A mutation whose anchor does not match exactly once refuses with MUTATION-NOT-APPLIED
 * (exit 2) rather than reporting a false red.
 *
 * NEGATIVE CONTROL / not covered: this is a node-level logic check. It renders nothing, calls no real
 * provider (the end-to-end section stubs `fetch`) and touches no database.
 *
 * Plain script, non-zero exit on failure — same shape as scripts/recipe_extraction_check.mjs.
 */
import { registerHooks } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('.') && path.extname(specifier) === '') {
            return nextResolve(`${specifier}.js`, context);
        }
        return nextResolve(specifier, context);
    },
});

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const SELF = fileURLToPath(import.meta.url);
const argv = process.argv.slice(2);
const mutateIdx = argv.indexOf('--mutate');
const MUTATE = mutateIdx >= 0 ? argv[mutateIdx + 1] : null;
const CONTROLS = argv.includes('--controls');

// ── mutation table — each entry must break a different assertion ─────────────────────────────────
const MUTATIONS = {
    'stuffed-unit': {
        file: 'src/lib/recipeExtraction.js',
        from: 'const recovered = quantityFromStuffedUnit(rawUnit);',
        to: 'const recovered = null;',
    },
    'quantity-restore': {
        file: 'src/lib/recipeExtraction.js',
        from: "if (quantity == null && typeof anchor?.quantity === 'number' && Number.isFinite(anchor.quantity)) {",
        to: "if (false && typeof anchor?.quantity === 'number' && Number.isFinite(anchor.quantity)) {",
    },
    'kcal-scale': {
        file: 'src/lib/recipeExtraction.js',
        from: 'const scaled = Math.round(beforeKcal * afterServings / beforeServings);',
        to: 'const scaled = beforeKcal;',
    },
    'step-recompute': {
        file: 'src/lib/recipeExtraction.js',
        from: 'recipe.step_ingredients = recipe.steps.map((step) => matchIngredientIndexes(step, recipe.ingredients));',
        to: 'recipe.step_ingredients = Array.isArray(after.step_ingredients) ? after.step_ingredients : [];',
    },
    'count-unit': {
        file: 'src/lib/unitConversion.js',
        from: 'if (!spec) return out; // countable or unknown — never guess',
        to: "if (!spec) { out.unit = system === 'imperial' ? 'oz' : 'g'; return out; }",
    },
};

// ── controls mode: run each mutation in a child and require it to go red ─────────────────────────
if (CONTROLS) {
    console.log('\nMUTATION CONTROLS — each must go red (exit 1)\n');
    let bad = 0;
    const keys = Object.keys(MUTATIONS);
    for (const key of keys) {
        const res = spawnSync(process.execPath, [SELF, '--mutate', key], { cwd: REPO, encoding: 'utf8' });
        if (res.status === 1) {
            console.log(`  ok   control '${key}' went red (exit 1)`);
        } else {
            bad += 1;
            console.log(`  FAIL control '${key}' did NOT go red (exit ${res.status})`);
            console.log((res.stdout || '').split('\n').filter((l) => l.startsWith('  FAIL')).slice(0, 4).map((l) => '       ' + l.trim()).join('\n'));
        }
    }
    console.log('');
    if (bad) {
        console.log(`${bad} of ${keys.length} controls failed to go red`);
        process.exit(1);
    }
    console.log(`all ${keys.length} controls went red`);
    process.exit(0);
}

// ── module location: real repo, or a mutated copy ────────────────────────────────────────────────
let importLibDir = path.join(REPO, 'src', 'lib');
if (MUTATE) {
    const spec = MUTATIONS[MUTATE];
    if (!spec) {
        console.log(`unknown mutation '${MUTATE}'`);
        process.exit(2);
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `refine-check-${MUTATE.replace(/[^a-z0-9]/gi, '')}-`));
    fs.cpSync(path.join(REPO, 'src'), path.join(tmp, 'src'), { recursive: true });
    const target = path.join(tmp, spec.file);
    const text = fs.readFileSync(target, 'utf8');
    const matches = text.split(spec.from).length - 1;
    if (matches !== 1) {
        console.log(`MUTATION-NOT-APPLIED '${MUTATE}' anchor matched ${matches} time(s), expected exactly 1`);
        process.exit(2);
    }
    fs.writeFileSync(target, text.replace(spec.from, spec.to));
    importLibDir = path.join(tmp, 'src', 'lib');
    console.log(`\n[mutated run: ${MUTATE}]\n`);
}

const {
    sanitiseRefinedRecipe,
    refineRecipe,
    REFINE_SCHEMA,
    REFINE_PROMPT,
    MAX_INGREDIENT_NAME_LENGTH,
} = await import(pathToFileURL(path.join(importLibDir, 'recipeExtraction.js')).href);
const {
    convertIngredient,
    convertTemperature,
    isCountUnit,
    isConvertibleUnit,
} = await import(pathToFileURL(path.join(importLibDir, 'unitConversion.js')).href);
const { matchIngredientIndexes } = await import(pathToFileURL(path.join(REPO, 'src/lib/stepIngredients.js')).href);

let checksRun = 0;
let failures = 0;
function check(name, actual, expected) {
    checksRun += 1;
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
        console.log(`  ok   ${name}`);
    } else {
        failures += 1;
        console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
    }
}

// ── the REAL production fixture ("Peanut Butter Pork Noodles", 4 servings, 10 ingredients) ────────
const BEFORE = {
    title: 'Peanut Butter Pork Noodles',
    description: 'A quick and flavorful dish featuring tender pork mince tossed with noodles in a rich and savory peanut butter sauce.',
    creator: 'Andy Cooks',
    cook_time_minutes: 30,
    difficulty: 'Medium',
    kcal: 650,
    base_servings: 4,
    meal_type: 'Dinner',
    ingredients: [
        { name: 'Pork mince', unit: 'g', quantity: 500 },
        { name: 'Udon', unit: 'g', quantity: 300 },
        { name: 'Peanut butter', unit: 'cup', quantity: 0.5 },
        { name: 'Soy sauce', unit: 'cup', quantity: 0.25 },
        { name: 'Rice vinegar', unit: 'tbsp', quantity: 2 },
        { name: 'Sesame oil', unit: 'tbsp', quantity: 1 },
        { name: 'Garlic', unit: 'cloves', quantity: 2 },
        { name: 'Chilli crisp', unit: 'tsp', quantity: 0.5 },
        { name: 'Spring onions', unit: 'stalks', quantity: 3 },
        { name: 'Lime juice', unit: 'tbsp', quantity: 1 },
    ],
    steps: [
        'Place a medium pot half filled with lightly salted water onto the boil.',
        'Finely slice the spring onions. Keep the white and green parts separate and set both aside.',
        'Peel, crush and finely chop the garlic then set aside.',
        'Heat a medium saucier over high heat. Add the oil and let it heat for 30 seconds.',
        'Add the pork mince, breaking it apart with a wooden spatula once it hits the pan. Spread it into a single layer and season with a pinch of salt.Sear for 4-5 minutes until golden brown on all sides.',
        'Add the sliced spring onion whites and garlic then stir through the pork.',
        'Add the peanut butter, soy sauce, rice vinegar and lime juice. Use the spatula to break up the peanut butter and emulsify it into the sauce. Add 2-3 tbsp of boiling water from the noodle pot and continue cooking for a further 2-3 minutes.',
        'Add in the chilli crisp, stir and turn the element off.',
        'Add the packet of udon to the boiling water and cook until tender.',
        'Use tongs to carefully remove the udon noodles from the boiling water and transfer them into the sauce pan. Add the sliced spring onion greens and toss the noodles through the peanut butter sauce.',
        'If the sauce feels too thick, add another splash of the noodle water. Serve immediately.',
    ],
};

// The monster unit string probe A really returned (ingredient 0). >60 chars, contains digits and the
// ingredient's own name — the D3 case.
const MONSTER_UNIT = "g, diced or minced (for a similar texture to mince if desired), or thinly sliced against the grain for strips if preferred for breast meat form for noodles dishes, about 500g in total in uncooked weight from 2-3 breasts, cooked to proper internal temperature (typically 74°C or 165°F at thickest part, or 70°C or 160°F for dark meat which still applies to lean breast that can dry out if overcooked) or until no longer pink when cut in half. The recipe is for mince therefore, 'diced or minced' will be suitable to get a similar texture and cooking time, so this will be the best option from a similar texture standpoint.";

// The model's own (wrong) step_ingredients from probe A — the array the sanitiser must ignore.
const PROBE_A_STEP_LINKS = [[], [], [], [], [0], [6, 8], [2, 3, 4, 9], [7], [1], [1, 8], []];

const PROBE_A_AFTER = {
    ...BEFORE,
    title: 'Peanut Butter Chicken Noodles',
    kcal: 650, // stale — a pork->chicken swap changes it; the model left it (D5)
    ingredients: [
        { name: 'Chicken breast', unit: MONSTER_UNIT },
        { name: 'Udon', unit: 'g' },
        { name: 'Peanut butter', unit: 'g' },
        { name: 'Soy sauce', unit: 'ml' },
        { name: 'Rice vinegar', unit: 'ml' },
        { name: 'Sesame oil', unit: 'ml' },
        { name: 'Garlic', unit: 'cloves' },
        { name: 'Chilli crisp', unit: 'ml' },
        { name: 'Spring onions', unit: 'stalks' },
        { name: 'Lime juice', unit: 'ml' },
    ],
    steps: BEFORE.steps.map((s, i) => (i === 4
        ? 'Add the chicken breast, breaking it apart with a wooden spatula if minced, or searing if diced/sliced. Spread it into a single layer and season with a pinch of salt. Sear for 4-5 minutes until golden brown on all sides and cooked through.'
        : i === 5 ? 'Add the sliced spring onion whites and garlic then stir through the chicken.' : s)),
    step_ingredients: PROBE_A_STEP_LINKS,
};

const PROBE_B_AFTER = {
    ...BEFORE,
    base_servings: 2,
    kcal: 325,
    ingredients: [
        { name: 'Pork mince', unit: 'g  Pork mince  250' },
        { name: 'Udon', unit: 'g  Udon  150' },
        { name: 'Peanut butter', unit: 'g  Peanut butter  60' },
        { name: 'Soy sauce', unit: 'ml  Soy sauce  30' },
        { name: 'Rice vinegar', unit: 'ml  Rice vinegar  15' },
        { name: 'Sesame oil', unit: 'ml  Sesame oil  7.5' },
        { name: 'Garlic', unit: 'cloves  Garlic  1' },
        { name: 'Chilli crisp', unit: 'ml  Chilli crisp  2.5' },
        { name: 'Spring onions', unit: 'stalks  Spring onions  1.5' },
        { name: 'Lime juice', unit: 'ml  Lime juice  7.5' },
    ],
    step_ingredients: [[], [], [], [], [], [], [], [], [], [], []],
};

const noDigits = (s) => !/\d/.test(String(s));

// ═════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\nsanitiseRefinedRecipe — probe A: the structure collapse (D1) and the monster (D3)');

const a = sanitiseRefinedRecipe(BEFORE, PROBE_A_AFTER).recipe;
check('ingredient 0 keeps its name, not the deliberation', a.ingredients[0].name, 'Chicken breast');
check('ingredient 0 recovers the quantity the input carried (D1)', a.ingredients[0].quantity, 500);
check('ingredient 0 unit is a bare token, not the monster', a.ingredients[0].unit, 'g');
check('the monster unit is gone (< 12 chars)', a.ingredients[0].unit.length <= 12, true);
check('Peanut butter restores its 0.5 (D1)', a.ingredients[2].quantity, 0.5);
check('...and its original unit (quantity+unit are a pair)', a.ingredients[2].unit, 'cup');
check('Garlic keeps a countable unit and its 2', [a.ingredients[6].quantity, a.ingredients[6].unit], [2, 'cloves']);
check('every ingredient now has a numeric quantity', a.ingredients.every((i) => typeof i.quantity === 'number'), true);
check('...all ten of them', a.ingredients.filter((i) => typeof i.quantity === 'number').length, 10);
check('no unit carries digits', a.ingredients.every((i) => noDigits(i.unit)), true);
check('no unit exceeds the token length cap', a.ingredients.every((i) => i.unit.length <= 12), true);
check('no name exceeds the length cap', a.ingredients.every((i) => i.name.length <= MAX_INGREDIENT_NAME_LENGTH), true);
check('a repaired result carries a warning string', typeof sanitiseRefinedRecipe(BEFORE, PROBE_A_AFTER).warning, 'string');

console.log('\nsanitiseRefinedRecipe — probe B: the mangled fields (D2)');

const b = sanitiseRefinedRecipe(BEFORE, PROBE_B_AFTER).recipe;
check('the crammed number is recovered as a quantity (D2)', b.ingredients[0].quantity, 250);
check('...and the unit is the bare token, not the sentence', b.ingredients[0].unit, 'g');
check('a scaled row keeps its scaled value', [b.ingredients[1].quantity, b.ingredients[1].unit], [150, 'g']);
check('a fractional scale survives', [b.ingredients[5].quantity, b.ingredients[5].unit], [7.5, 'ml']);
check('a countable row is unscrambled too', [b.ingredients[6].quantity, b.ingredients[6].unit], [1, 'cloves']);
check('a fractional countable scale survives', b.ingredients[8].quantity, 1.5);
check('every row has a numeric quantity (D2 structure survived)', b.ingredients.every((i) => typeof i.quantity === 'number'), true);
check('no unit has digits or the ingredient name', b.ingredients.every((i) => noDigits(i.unit) && i.unit.length <= 12), true);
check('probe B is repaired', typeof sanitiseRefinedRecipe(BEFORE, PROBE_B_AFTER).warning, 'string');

console.log('\nsanitiseRefinedRecipe — field-contract repairs');

const strQty = sanitiseRefinedRecipe({}, { ingredients: [{ name: 'Salt', quantity: '3', unit: 'g' }] }).recipe;
check('a string quantity is coerced to a number', strQty.ingredients[0].quantity, 3);
check('...and typed as a number', typeof strQty.ingredients[0].quantity, 'number');
const namedQty = sanitiseRefinedRecipe({}, { ingredients: [{ name: '500 g chicken breast, diced', quantity: 500, unit: 'g' }] }).recipe;
check('a measurement is stripped out of the name', namedQty.ingredients[0].name, 'chicken breast');
const junkUnit = sanitiseRefinedRecipe({}, { ingredients: [{ name: 'Oil', quantity: 2, unit: 'tbsp  Oil  2' }] }).recipe;
check('a stuffed unit is reduced to its token', junkUnit.ingredients[0].unit, 'tbsp');
const noQty = sanitiseRefinedRecipe({}, { ingredients: [{ name: 'Salt', unit: 'g' }] }).recipe;
check('an input with no quantity is left with no quantity (no invention)', 'quantity' in noQty.ingredients[0], false);

console.log('\nsanitiseRefinedRecipe — the input’s measurement is never lost');

// every quantity the input carried must appear somewhere in the output for probe A
const inputQty = BEFORE.ingredients.map((i) => i.quantity);
const outQty = sanitiseRefinedRecipe(BEFORE, PROBE_A_AFTER).recipe.ingredients.map((i) => i.quantity);
check('probe A loses none of the input’s ten measurements', inputQty.every((q) => outQty.includes(q)), true);
const cleanAfter = { ...BEFORE, ingredients: BEFORE.ingredients.map((i) => ({ ...i })) };
check('an unchanged refine is not flagged as repaired', sanitiseRefinedRecipe(BEFORE, cleanAfter).warning, null);

console.log('\nsanitiseRefinedRecipe — step_ingredients is recomputed, not trusted');

const sLinks = sanitiseRefinedRecipe(BEFORE, PROBE_A_AFTER).recipe;
const expectedLinks = sLinks.steps.map((step) => matchIngredientIndexes(step, sLinks.ingredients));
check('the returned links equal a fresh match over the returned steps', sLinks.step_ingredients, expectedLinks);
check('...and are NOT the model’s own (wrong) index array', JSON.stringify(sLinks.step_ingredients) === JSON.stringify(PROBE_A_STEP_LINKS), false);
check('there is exactly one link entry per step', sLinks.step_ingredients.length, sLinks.steps.length);
check('the swap step now points at the chicken (index 0)', sLinks.step_ingredients[4], [0]);

console.log('\nsanitiseRefinedRecipe — kcal tracks base_servings');

const stale = sanitiseRefinedRecipe(
    { kcal: 650, base_servings: 4, ingredients: [] },
    { kcal: 650, base_servings: 2, ingredients: [] }
).recipe;
check('4 -> 2 scales a stale 650 to the per-serving 325', stale.kcal, 325);
const up = sanitiseRefinedRecipe(
    { kcal: 650, base_servings: 4, ingredients: [] },
    { kcal: 650, base_servings: 8, ingredients: [] }
).recipe;
check('4 -> 8 scales 650 up to 1300', up.kcal, 1300);
const same = sanitiseRefinedRecipe(
    { kcal: 650, base_servings: 4, ingredients: [] },
    { kcal: 640, base_servings: 4, ingredients: [] }
).recipe;
check('an unchanged serving count never rewrites kcal', same.kcal, 640);
check('probe B’s kcal is 325', sanitiseRefinedRecipe(BEFORE, PROBE_B_AFTER).recipe.kcal, 325);

console.log('\nunitConversion — deterministic, and never destroys a measurement');

check('500 g -> 1.1 lb (imperial picks the pound past a pound)', convertIngredient({ name: 'x', quantity: 500, unit: 'g' }, 'imperial'), { name: 'x', quantity: 1.1, unit: 'lb' });
check('100 g -> 3.53 oz', convertIngredient({ name: 'x', quantity: 100, unit: 'g' }, 'imperial'), { name: 'x', quantity: 3.53, unit: 'oz' });
check('0.5 cup -> 118.29 ml', convertIngredient({ name: 'x', quantity: 0.5, unit: 'cup' }, 'metric'), { name: 'x', quantity: 118.29, unit: 'ml' });
check('2 tbsp -> 29.57 ml', convertIngredient({ name: 'x', quantity: 2, unit: 'tbsp' }, 'metric'), { name: 'x', quantity: 29.57, unit: 'ml' });
check('metric is the default when the system is unknown', convertIngredient({ name: 'x', quantity: 2, unit: 'tbsp' }, 'nonsense').unit, 'ml');

const roundTrips = [[500, 'g'], [2.5, 'kg'], [250, 'ml'], [1.5, 'l']];
let worst = 0;
for (const [q, u] of roundTrips) {
    const imperial = convertIngredient({ name: 'x', quantity: q, unit: u }, 'imperial');
    const back = convertIngredient(imperial, 'metric');
    worst = Math.max(worst, Math.abs(back.quantity - q) / q);
    check(`  ${q} ${u} round-trips to the same unit`, back.unit, u);
}
check('metric -> imperial -> metric round-trips within 2% for every unit', worst < 0.02, true);
check('16 oz -> 453.59 g', convertIngredient({ name: 'x', quantity: 16, unit: 'oz' }, 'metric'), { name: 'x', quantity: 453.59, unit: 'g' });
check('1 lb -> 453.59 g', convertIngredient({ name: 'x', quantity: 1, unit: 'lb' }, 'metric'), { name: 'x', quantity: 453.59, unit: 'g' });
check('an imperial unit left in imperial is a no-op', convertIngredient({ name: 'x', quantity: 1, unit: 'lb' }, 'imperial'), { name: 'x', quantity: 1, unit: 'lb' });

check('a countable unit passes through untouched (cloves)', convertIngredient({ name: 'Garlic', quantity: 2, unit: 'cloves' }, 'imperial'), { name: 'Garlic', quantity: 2, unit: 'cloves' });
check('stalks pass through untouched', convertIngredient({ name: 'Spring onions', quantity: 3, unit: 'stalks' }, 'metric'), { name: 'Spring onions', quantity: 3, unit: 'stalks' });
check('...even when scaling changed the number', convertIngredient({ name: 'Spring onions', quantity: 1.5, unit: 'stalks' }, 'imperial').quantity, 1.5);
check('an unknown unit passes through untouched', convertIngredient({ name: 'x', quantity: 1, unit: 'splash' }, 'imperial'), { name: 'x', quantity: 1, unit: 'splash' });
check('a null quantity passes through untouched', convertIngredient({ name: 'Salt', quantity: null, unit: 'g' }, 'imperial'), { name: 'Salt', quantity: null, unit: 'g' });
check('isCountUnit knows a stalk', isCountUnit('stalks'), true);
check('isCountUnit does not claim grams', isCountUnit('g'), false);
check('isConvertibleUnit knows a cup', isConvertibleUnit('cup'), true);
check('temperature: 180 °C -> 356 °F', convertTemperature(180, 'f'), 356);
check('temperature: 356 °F -> 180 °C', convertTemperature(356, 'c'), 180);

console.log('\nthe refine prompt carries the propagation rules');

check('an INGREDIENT SWAP rule is stated', REFINE_PROMPT.includes('INGREDIENT SWAP'), true);
check('an INGREDIENT REMOVAL rule is stated', REFINE_PROMPT.includes('INGREDIENT REMOVAL'), true);
check('a SCALING rule is stated', REFINE_PROMPT.includes('SCALING'), true);
check('a CHARACTER CHANGE rule is stated', REFINE_PROMPT.includes('CHARACTER CHANGE'), true);
check('a DERIVED FIELDS rule is stated', REFINE_PROMPT.includes('DERIVED FIELDS'), true);
check('the field contract is stated', REFINE_PROMPT.includes('FIELD CONTRACT'), true);
check('it demands the whole steps array be rewritten', /Rewrite the WHOLE/.test(REFINE_PROMPT), true);
check('it tells the model NOT to convert units', REFINE_PROMPT.includes('Do NOT convert unit systems'), true);
check('no {{UNIT_INSTRUCTION}} placeholder survives in the refine prompt', REFINE_PROMPT.includes('{{UNIT_INSTRUCTION}}'), false);
check('the refine schema carries a per-field review list', REFINE_SCHEMA.properties.review.type, 'array');

// ── end to end through refineRecipe, with a stubbed provider ──────────────────────────────────────
console.log('\nrefineRecipe — end to end (stubbed provider)');

let lastPrompt = null;
globalThis.fetch = async (url, opts) => {
    const body = opts?.body ? JSON.parse(opts.body) : null;
    lastPrompt = body?.contents;
    return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ text: JSON.stringify({ recipe: PROBE_A_AFTER, changeSummary: 'Swapped pork for chicken.', review: ['steps 5-6: renamed pork -> chicken'] }) }),
    };
};

const e2e = await refineRecipe(BEFORE, 'Swap the pork mince for chicken breast');
check('the returned recipe’s ingredient 0 has a number, not a monster', typeof e2e.recipe.ingredients[0].quantity, 'number');
check('...the restored 500 g, end to end', [e2e.recipe.ingredients[0].quantity, e2e.recipe.ingredients[0].unit], [500, 'g']);
check('the cup measurements are converted to metric in code', [e2e.recipe.ingredients[2].quantity, e2e.recipe.ingredients[2].unit], [118.29, 'ml']);
check('the countable still passes through', [e2e.recipe.ingredients[6].quantity, e2e.recipe.ingredients[6].unit], [2, 'cloves']);
check('the repair warning is surfaced to the caller', typeof e2e.warning, 'string');
check('the per-field review is passed through', e2e.review, ['steps 5-6: renamed pork -> chicken']);
check('the request prompt has no unit instruction (conversion is in code)', lastPrompt.includes('{{UNIT_INSTRUCTION}}'), false);
check('...and does carry the checklist', lastPrompt.includes('INGREDIENT SWAP'), true);

const e2eHistory = await refineRecipe(BEFORE, 'actually make it less spicy', { history: [{ instruction: 'add more chilli', changeSummary: 'Doubled the chilli crisp.' }] });
check('a prior turn is carried into the prompt (stateful sparring)', lastPrompt.includes('CONVERSATION SO FAR'), true);
check('...verbatim', lastPrompt.includes('add more chilli') && lastPrompt.includes('Doubled the chilli crisp.'), true);
check('a two-argument call still works (backward compatible)', typeof e2eHistory.recipe, 'object');
delete globalThis.fetch;

// ═════════════════════════════════════════════════════════════════════════════════════════════════
console.log('');
if (failures) {
    console.log(`${failures} of ${checksRun} checks FAILED`);
    process.exit(1);
}
console.log(`all ${checksRun} checks passed`);
