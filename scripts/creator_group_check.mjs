/**
 * Creator-group checks — `node scripts/creator_group_check.mjs`
 *
 * WHY THIS EXISTS
 * The Creator filter group is built from whatever `recipes.creator` values happen to exist, and
 * the matching was an exact trimmed-string compare. The same person captured twice with different
 * casing — "Jamie Oliver" from a blog byline, "jamie oliver" typed by hand in Capture — therefore
 * produced *two* filter chips, each matching only its own spelling. The recipes are all there; the
 * filter just looks like the library has two of that person and neither chip finds the other half.
 *
 * That was written up in `.agent/features/FEATURE_recipe_library_redesign.md` as a known
 * limitation ("no case-folding or fuzzy merge"), justified there as "acceptable for v1 solo use".
 * That justification is stale — the app is a multi-household product now and attribution is
 * shared, so two households capturing the same creator is the expected case, not the edge one.
 *
 * WHAT THIS ASSERTS
 *   - the group is keyed on a case-folded name: N spellings of one creator → ONE option
 *   - the option's label carries the most common spelling, and its count is the folded total
 *   - the option's `match` accepts every spelling, and rejects a different creator
 *   - `filterRecipes` honours that option for records of either spelling
 *   - distinct creators stay distinct; blank / missing creators are ignored
 *   - the label's count equals the number of recipes the option actually matches
 *
 * WHAT IT IS NOT
 * A unit check of two pure functions. It does not render the filter sheet, and it says nothing
 * about how the group looks in the UI — the chip label is asserted, the layout is not.
 *
 * Negative control (run it against the pre-fix file and it must fail):
 *   git show <base>:src/lib/recipeSearch.js > /tmp/old.js
 * — then import `buildCreatorGroup` from that copy. On the pre-fix code the "one option per
 * creator" assertions fail. Do that before trusting a clean run.
 *
 * Plain script, non-zero exit on failure — same shape as scripts/task07_check.mjs.
 */
import { registerHooks } from 'node:module';

// The app's own imports are extensionless (`./consolidateIngredients`), which Vite resolves at
// build time and bare Node does not. Resolve them for this process only, so the check runs the
// real module rather than a copy of its logic.
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('.') && !/\.[cm]?js$/.test(specifier)) {
            return nextResolve(`${specifier}.js`, context);
        }
        return nextResolve(specifier, context);
    },
});

const { buildCreatorGroup, filterRecipes } = await import('../src/lib/recipeSearch.js');

let failures = 0;
function check(name, cond, detail = '') {
    if (cond) {
        console.log(`  ok   ${name}`);
    } else {
        failures += 1;
        console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ''}`);
    }
}

const recipe = (id, creator) => ({ id, title: `recipe ${id}`, creator, tags: [], ingredients: [] });

console.log('Creator filter group — case folding');

// ── one creator, two spellings ────────────────────────────────────────────────────────────────
const mixed = [
    recipe(1, 'Jamie Oliver'),
    recipe(2, 'jamie oliver'),
    recipe(3, 'jamie oliver'),
    recipe(4, 'Nigella Lawson'),
];
const group = buildCreatorGroup(mixed);

check('a creator group is built when creators exist', group !== null && group.id === 'creator');
check('two spellings of one creator collapse to one option',
    group?.options.length === 2 && group.options.filter((o) => o.id === 'jamie oliver').length === 1,
    `option ids: ${JSON.stringify(group?.options.map((o) => o.id))}`);
check('the folded option counts every spelling',
    group?.options.find((o) => o.id === 'jamie oliver')?.label === 'jamie oliver (3)',
    `label: ${JSON.stringify(group?.options.find((o) => o.id === 'jamie oliver')?.label)}`);
check('a different creator is still its own option',
    group?.options.length === 2 && group.options.some((o) => o.id === 'nigella lawson'));

const jamie = group?.options.find((o) => o.id === 'jamie oliver');
check('the folded option matches both spellings',
    jamie?.match(recipe(1, 'Jamie Oliver')) === true && jamie?.match(recipe(2, 'jamie oliver')) === true);
check('the folded option rejects a different creator', jamie?.match(recipe(4, 'Nigella Lawson')) === false);

// ── the label's count must equal what the option matches ─────────────────────────────────────
for (const option of group?.options ?? []) {
    const matched = mixed.filter((r) => option.match(r)).length;
    const claimed = Number((option.label.match(/\((\d+)\)$/) ?? [])[1]);
    check(`option "${option.id}" claims ${claimed} and matches ${matched}`, claimed === matched);
}

// ── filtering through the option, not just calling match() ───────────────────────────────────
const filtered = filterRecipes(mixed, { activeKeys: ['creator:jamie oliver'], groups: [group] });
check('selecting the folded option returns every recipe by that creator, both spellings',
    filtered.length === 3 && [1, 2, 3].every((id) => filtered.some((r) => r.id === id)),
    `ids: ${JSON.stringify(filtered.map((r) => r.id))}`);
check('selecting the folded option returns no one else',
    filtered.every((r) => r.creator?.trim().toLowerCase() === 'jamie oliver'));

// ── edges ────────────────────────────────────────────────────────────────────────────────────
check('no creators at all → no group', buildCreatorGroup([recipe(1), recipe(2, '   ')]) === null);
check('blank and missing creators are ignored',
    buildCreatorGroup([recipe(1, '   '), recipe(2, null), recipe(3, undefined), recipe(4, 'Ada')])
        ?.options.length === 1);
check('a single-creator set is still a group',
    buildCreatorGroup([recipe(1, 'Ada')])?.options[0]?.label === 'Ada (1)');

console.log('');
if (failures > 0) {
    console.log(`${failures} check(s) FAILED`);
    process.exit(1);
}
console.log('all checks passed — two pure functions only; nothing here renders or queries anything.');
