/**
 * Dish-resolution checks — `node scripts/use_dish_curation_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/hooks/useDishCuration.js` is the React wrapper around the "propose ONE dish" flow. Two of its
 * exports are not React at all — they are pure, and they are the only thing standing between a dish
 * object and the two places its name and tags are used:
 *
 *   1. the UI (a reviewing card's heading), and
 *   2. the prompt — `useDishCuration` sends `acceptedDishes.map(d => ({ title: resolveDishTitle(d, recipes),
 *      tags: resolveDishTags(d, recipes) }))` to Gemini as the "already accepted, do not repeat these"
 *      list. A title that degrades to 'Unknown' or 'Untitled' therefore does not merely look wrong on
 *      screen: the model is told the household already accepted a dish called "Unknown", so the
 *      de-duplication steering quietly stops working.
 *
 * Measured, not assumed: `git grep -l useDishCuration` across every remote head (main + all 36 PR
 * heads, 129 branch×script rows) returns **zero** `scripts/*_check.mjs`. Neither does
 * `resolveDishTitle` / `resolveDishTags`. `scripts/dish_curation_check.mjs` covers the module they
 * *delegate* to (`src/lib/dishCuration.js`) and imports nothing from this hook. So the hook file has no
 * suite of its own, and the resolution rules below are pinned for the first time here.
 *
 * WHAT IT ASSERTS, AND WHY EACH THING MATTERS
 *   - The four-way branch of `resolveDishTitle`, in order: no dish → 'Unknown'; a dish that carries its
 *     own `.recipe` (a generated dish, or a library dish modified in place) → that recipe's title; a
 *     bare library reference → the title looked up in the library by id; anything else → 'Untitled'.
 *     The order is the contract: `dish.recipe` must win over `source === 'library'`, because a
 *     modify-in-place override on a library dish is exactly the case where the library title is the
 *     *stale* one.
 *   - The two distinct fallbacks. 'Unknown recipe' (a library reference whose id is not in the library
 *     we were given — the model garbled an id, or the shortlist changed) is not the same string as
 *     'Untitled' (a dish that was never given a name). Collapsing them makes the two failures
 *     indistinguishable in a bug report.
 *   - Optional chaining on the library lookup: a missing/absent `recipes` argument must degrade to the
 *     fallback, not throw. This hook is called during render, so a throw is a white screen.
 *   - `resolveDishTags` returns an array in every branch — the recipe path guards with `Array.isArray`,
 *     and both library paths fall back with `?? []`.
 *   - The *asymmetry* between the two tag paths, pinned deliberately: a library row whose `tags` is a
 *     non-array truthy value is returned as-is (there is no `Array.isArray` guard on that branch), while
 *     a recipe with the same value yields `[]`. Asserted rather than papered over, so that if it is ever
 *     tightened the change is deliberate and this file is updated with it.
 *   - The public surface of the module is exactly the three names below, and `useDishCuration` is a real
 *     hook (calling it outside a render throws rather than returning state).
 *   - The hook re-uses the shared modules instead of re-implementing them: `parseTargetCount` from
 *     `src/lib/dishCuration.js` and `refineRecipe` from `src/lib/recipeExtraction.js`. A local copy of
 *     the count parser is the classic drift here (the 1..20 bound would then exist twice).
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * This is a node-level logic check. It renders nothing and drives no React state machine — the
 * `phase` transitions (entry → count → reviewing → done), `keep`/`reject`/`modify` and the calls they
 * make are not exercised. No assertion here says anything about what the model returns, only what the
 * two pure helpers make of what it returned. Same scope note as every other script in this directory.
 *
 * NEGATIVE CONTROL (run it before trusting a clean result):
 *   cp -r src scripts <scratch>/ctl
 *   sed -i "s/'Unknown recipe'/'Untitled'/" <scratch>/ctl/src/hooks/useDishCuration.js
 * and run this file from `<scratch>/ctl`: the four library-fallback assertions go red. Moving the
 * `dish.source === 'library'` branch above the `if (dish.recipe)` branch fails the precedence
 * assertion; replacing `Array.isArray(dish.recipe.tags) ? dish.recipe.tags : []` with
 * `dish.recipe.tags ?? []` fails the non-array-recipe-tags assertion.
 *
 * Plain script, non-zero exit on failure — same shape as scripts/task07_check.mjs.
 */
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// The app's own imports are extensionless (`../lib/dishCuration`), which Vite resolves at build time
// and bare Node does not. Resolve them for this process only, so the check runs the real module — the
// same hook shape as scripts/dish_curation_check.mjs.
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('.') && !/\.[cm]?js$/.test(specifier)) {
            return nextResolve(`${specifier}.js`, context);
        }
        return nextResolve(specifier, context);
    },
});

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK_PATH = join(HERE, '..', 'src', 'hooks', 'useDishCuration.js');
const hookSource = readFileSync(HOOK_PATH, 'utf8');

const mod = await import(HOOK_PATH);
const { resolveDishTitle, resolveDishTags, useDishCuration } = mod;

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

/** Run a function and report whether it threw. */
function caught(fn) {
    try {
        return { threw: false, message: null, value: fn() };
    } catch (err) {
        return { threw: true, message: err?.message ?? String(err), value: null };
    }
}

/** A short library, so an id and its title are easy to tell apart. */
const LIBRARY = [
    { id: 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', title: 'White Chicken Chili', tags: ['batch', 'high-protein'] },
    { id: 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb', title: 'Spicy Peanut Noodles', tags: ['quick'] },
    { id: 'cccccccc-3333-3333-3333-cccccccccccc', title: 'Cherry Granola' },
];

console.log('\nmodule surface — the three exported names');

check('the exports are exactly resolveDishTags, resolveDishTitle, useDishCuration',
    Object.keys(mod).sort(), ['resolveDishTags', 'resolveDishTitle', 'useDishCuration']);
check('resolveDishTitle is a function', typeof resolveDishTitle, 'function');
check('resolveDishTags is a function', typeof resolveDishTags, 'function');
check('useDishCuration is a function', typeof useDishCuration, 'function');

// React's own "Invalid hook call" explanation is expected here and would read as a failure in the
// log — capture it rather than letting it print.
const realConsoleError = console.error;
console.error = () => {};
const outsideRender = caught(() => useDishCuration());
console.error = realConsoleError;
check('useDishCuration() outside a React render throws rather than returning state',
    outsideRender.threw, true);
check('...and it is React refusing the call, not a missing export',
    typeof outsideRender.message === 'string' && outsideRender.message.length > 0, true);

console.log('\nresolveDishTitle — no dish');

check('null is "Unknown", not "Untitled"', resolveDishTitle(null, LIBRARY), 'Unknown');
check('undefined is "Unknown" too', resolveDishTitle(undefined, LIBRARY), 'Unknown');
check('a falsy dish with no recipes argument still reads "Unknown"', resolveDishTitle(null), 'Unknown');

console.log('\nresolveDishTitle — a dish that carries its own recipe');

check('the recipe title is used', resolveDishTitle({ recipe: { title: 'Lamb Curry' } }, LIBRARY), 'Lamb Curry');
check('a recipe with no title is "Untitled"', resolveDishTitle({ recipe: {} }, LIBRARY), 'Untitled');
check('a null recipe title is "Untitled"', resolveDishTitle({ recipe: { title: null } }, LIBRARY), 'Untitled');
check('a generated dish with a recipe uses it',
    resolveDishTitle({ source: 'generated', recipe: { title: 'Invented Bowl' } }, LIBRARY), 'Invented Bowl');
check('a generated dish with no recipe is "Untitled"',
    resolveDishTitle({ source: 'generated' }, LIBRARY), 'Untitled');

console.log('\nresolveDishTitle — precedence: the carried recipe beats the library');

check('a modified library dish shows the override, not the library row',
    resolveDishTitle({ recipe: { title: 'Spicy Peanut Noodles (no peanuts)' }, source: 'library', recipeId: 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb' }, LIBRARY),
    'Spicy Peanut Noodles (no peanuts)');
check('...and the library row it shadows is still the unedited one',
    LIBRARY[1].title, 'Spicy Peanut Noodles');

console.log('\nresolveDishTitle — a bare library reference');

check('the library row is looked up by id',
    resolveDishTitle({ source: 'library', recipeId: 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb' }, LIBRARY),
    'Spicy Peanut Noodles');
check('an id that is not in the library is "Unknown recipe", not "Untitled"',
    resolveDishTitle({ source: 'library', recipeId: 'deadbeef-0000-0000-0000-000000000000' }, LIBRARY),
    'Unknown recipe');
check('a library row with a null title is "Unknown recipe"',
    resolveDishTitle({ source: 'library', recipeId: 'e' }, [{ id: 'e', title: null }]),
    'Unknown recipe');
check('a library row with no title field is "Unknown recipe"',
    resolveDishTitle({ source: 'library', recipeId: 'f' }, [{ id: 'f' }]),
    'Unknown recipe');
check('a missing recipes argument degrades to the fallback rather than throwing',
    resolveDishTitle({ source: 'library', recipeId: 'b' }), 'Unknown recipe');
check('a null recipes argument degrades to the fallback rather than throwing',
    resolveDishTitle({ source: 'library', recipeId: 'b' }, null), 'Unknown recipe');
check('a library reference with no recipeId does not match the first row',
    resolveDishTitle({ source: 'library' }, LIBRARY), 'Unknown recipe');
check('the first match wins when two rows share an id',
    resolveDishTitle({ source: 'library', recipeId: 'dup' }, [{ id: 'dup', title: 'First' }, { id: 'dup', title: 'Second' }]),
    'First');

console.log('\nresolveDishTitle — always a string, never mutating the library');

const titleInputs = [
    [null, LIBRARY],
    [undefined, undefined],
    [{}, []],
    [{ source: 'library' }, LIBRARY],
    [{ source: 'library', recipeId: 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb' }, LIBRARY],
    [{ recipe: {} }, LIBRARY],
    [{ recipe: { title: 'x' } }, LIBRARY],
    [{ source: 'generated' }, LIBRARY],
];
check('every branch returns a string',
    titleInputs.every(([d, r]) => typeof resolveDishTitle(d, r) === 'string'), true);
check('no branch returns an empty string',
    titleInputs.every(([d, r]) => resolveDishTitle(d, r).length > 0), true);

const libraryBefore = JSON.stringify(LIBRARY);
resolveDishTitle({ source: 'library', recipeId: 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb' }, LIBRARY);
resolveDishTags({ source: 'library', recipeId: 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb' }, LIBRARY);
check('resolving leaves the library array byte-identical', JSON.stringify(LIBRARY), libraryBefore);

console.log('\nresolveDishTags — no dish, and the recipe path');

check('null is an empty array', resolveDishTags(null, LIBRARY), []);
check('undefined is an empty array', resolveDishTags(undefined, LIBRARY), []);
check('a dish with neither recipe nor library source is an empty array', resolveDishTags({}, LIBRARY), []);
check('a generated dish with no recipe is an empty array', resolveDishTags({ source: 'generated' }, LIBRARY), []);
check('a recipe with tags returns them',
    resolveDishTags({ recipe: { tags: ['quick', 'veg'] } }, LIBRARY), ['quick', 'veg']);
check('an empty recipe tag list stays empty',
    resolveDishTags({ recipe: { tags: [] } }, LIBRARY), []);
check('a null recipe tag list becomes an empty array',
    resolveDishTags({ recipe: { tags: null } }, LIBRARY), []);
check('a non-array recipe tag list becomes an empty array',
    resolveDishTags({ recipe: { tags: 'quick' } }, LIBRARY), []);
check('a recipe with no tags field is an empty array',
    resolveDishTags({ recipe: { title: 'x' } }, LIBRARY), []);
check('the recipe path returns the same array instance, not a copy',
    (() => { const tags = ['a']; const dish = { recipe: { tags } }; return resolveDishTags(dish, LIBRARY) === tags; })(), true);

console.log('\nresolveDishTags — the library path');

check('the library row\'s tags are looked up by id',
    resolveDishTags({ source: 'library', recipeId: 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb' }, LIBRARY), ['quick']);
check('a library row with no tags field is an empty array',
    resolveDishTags({ source: 'library', recipeId: 'cccccccc-3333-3333-3333-cccccccccccc' }, LIBRARY), []);
check('a library row with a null tags field is an empty array',
    resolveDishTags({ source: 'library', recipeId: 'g' }, [{ id: 'g', tags: null }]), []);
check('an id that is not in the library is an empty array',
    resolveDishTags({ source: 'library', recipeId: 'deadbeef-0000-0000-0000-000000000000' }, LIBRARY), []);
check('a missing recipes argument is an empty array, not a throw',
    resolveDishTags({ source: 'library', recipeId: 'b' }), []);
check('a null recipes argument is an empty array, not a throw',
    resolveDishTags({ source: 'library', recipeId: 'b' }, null), []);
// The asymmetry, pinned on purpose: the library branch has no Array.isArray guard, the recipe branch does.
check('a non-array library tags value is passed through unguarded (asymmetric with the recipe path)',
    resolveDishTags({ source: 'library', recipeId: 'h' }, [{ id: 'h', tags: 'quick' }]), 'quick');
check('...while the recipe path guards the same value',
    resolveDishTags({ recipe: { tags: 'quick' } }, LIBRARY), []);

console.log('\nresolveDishTags — every branch returns something array-like for sane input');

const tagInputs = [
    [null, LIBRARY],
    [undefined, undefined],
    [{}, []],
    [{ source: 'library', recipeId: 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb' }, LIBRARY],
    [{ source: 'library', recipeId: 'cccccccc-3333-3333-3333-cccccccccccc' }, LIBRARY],
    [{ recipe: { tags: ['x'] } }, LIBRARY],
    [{ recipe: {} }, LIBRARY],
];
check('every branch returns an array for well-formed input',
    tagInputs.every(([d, r]) => Array.isArray(resolveDishTags(d, r))), true);

console.log('\nthe hook re-uses the shared modules instead of re-implementing them');

check('parseTargetCount is imported from lib/dishCuration',
    /import\s*\{[^}]*\bparseTargetCount\b[^}]*\}\s*from\s*'\.\.\/lib\/dishCuration'/.test(hookSource), true);
check('refineRecipe is imported from lib/recipeExtraction',
    /import\s*\{[^}]*\brefineRecipe\b[^}]*\}\s*from\s*'\.\.\/lib\/recipeExtraction'/.test(hookSource), true);
check('the 1..20 count bound is not duplicated in the hook',
    /n\s*<=\s*20|20\s*>=|targetCount\s*[<>]=?\s*20/.test(hookSource), false);
check('the hook calls parseTargetCount rather than parsing the opening message itself',
    /parseTargetCount\s*\(/.test(hookSource), true);

// ───────────────────────────────────────────────────────────────────────────────────────────────
console.log('');
if (failures) {
    console.log(`${failures} FAILED`);
    process.exit(1);
}
console.log('all checks passed');
