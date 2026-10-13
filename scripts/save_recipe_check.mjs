/**
 * Save-recipe checks — `node scripts/save_recipe_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/lib/saveRecipe.js` is the single writer for every recipe the app creates: it is what Capture's
 * review screen calls, and what the AI Week Planner calls when it applies a generated day to the plan
 * (`src/hooks/useRecipeCapture.js:66`, `src/components/WeekPlanChat.jsx:187`). Every row in the live
 * `recipes` table that is not one of the 400 deleted seeded imports came through this function.
 * Measured, not assumed: `git grep -l -- "saveRecipe"` across `origin/main` and all 31 remote heads,
 * limited to `scripts/`, returns nothing — no suite exercised it. `uploadRecipeImage.js`, which it
 * calls for the photo path, is likewise unreferenced by any script.
 *
 * WHAT IT ASSERTS, AND WHY EACH THING MATTERS
 *   - the two guards, and that they fire *before* any request: no Supabase client (a build without
 *     `VITE_SUPABASE_URL`) and a draft with no usable name. Both are messages a user can actually see
 *     (`useRecipeCapture.js` surfaces `err.message` verbatim), so the wording is pinned.
 *   - the exact row the module inserts — the 17 column names DATA_MODELS.md lists for `recipes`, no
 *     more and no fewer. A column that drifts out of this object is a silent field loss on every
 *     capture; a column that drifts in is a PostgREST 400 the user reads as "could not save".
 *   - the defaults the file documents: `cook_time_minutes` 30, `difficulty` 'Easy', `base_servings` 2,
 *     `meal_type` 'Dinner', `archetypes` [], `tags` ['captured'], and null (not undefined) for every
 *     optional column. `tags` is the one a caller overrides — the week planner sends
 *     `['captured', 'ai-planned']` — and `['captured']` is only the fallback.
 *   - `is_personal: true` unconditionally, including when a draft claims otherwise. That flag is the
 *     predicate the archive/delete migration used to tell the owner's captures from the seeded
 *     library, so it is not a field a draft gets a vote on.
 *   - the trims: `title` and `creator` are trimmed, a whitespace-only `creator` becomes null rather
 *     than '', and the *stored* title is the trimmed one.
 *   - the ingredient mapping into the canonical `{name, quantity, unit}` shape (the live Supabase
 *     shape, not the legacy `final_recipes.json` `{item, amount, unit}` shape) with quantity/unit
 *     defaulted to null — plus the fact that unknown keys on an ingredient are dropped rather than
 *     spread through, and that a non-array `ingredients` becomes [] instead of throwing.
 *   - `steps` passed through as given (TASK_10 keeps a parallel `step_ingredients` array; the two must
 *     survive together or Cook Mode's per-step links point at the wrong steps).
 *   - `source_url` — set by a URL capture (TASK_08), null for text and photo captures.
 *   - `created_at` is a fresh ISO timestamp, not a defaulted/absent column.
 *   - the call chain: `from('recipes')` -> `insert(row)` -> `select()` -> `single()`. `.select()` and
 *     `.single()` are what make the function return the stored row (with its uuid) rather than
 *     nothing, which is what the capture screen's "saved" step depends on.
 *   - the Supabase error is rethrown, not swallowed, and the value returned on success is the row the
 *     client handed back.
 *   - the photo path, through the REAL `uploadRecipeImage.js`: `dishPhotoFile` is passed to
 *     `uploadDishPhoto`, the upload goes to the `recipe-images` bucket as `image/jpeg` with
 *     `upsert: false`, the public URL comes back on the row, and the two documented failure messages
 *     ('bucket not found' -> the create-a-bucket instruction; anything else -> 'Could not upload
 *     photo: …'). No file means no upload and a null `image_url`.
 *
 * HOW THE MODULE IS LOADED, AND WHY IT IS NOT A CHEAT
 * `saveRecipe.js` imports `./supabase`, which reads `import.meta.env` — a Vite-injected global that
 * does not exist in bare Node (`TypeError: Cannot read properties of undefined (reading
 * 'VITE_SUPABASE_URL')`). So this process redirects that ONE specifier, via a resolve hook, to an
 * in-memory stand-in whose `supabase` export is a live binding the test points at a recording fake —
 * the same technique `scripts/cook_feedback_check.mjs` and `scripts/household_check.mjs` use. The
 * app's extensionless relative imports are resolved by the same hook. Everything else is the real
 * file: the assertions run the real `saveRecipe` and the real `uploadDishPhoto`, not a copy of their
 * logic.
 *
 * ONE REAL CONCESSION, STATED PLAINLY: `uploadDishPhoto` calls
 * `normalizeImage(file, 1600, 0.85)` from `./imageUtils`, which re-encodes through
 * `createImageBitmap` + a canvas. Bare Node has neither, so `normalizeImage` takes its own documented
 * fallback branch and returns the original file (its `catch` logs a warning, which this script
 * captures rather than prints). That is a measurement of the fallback, not of the canvas path: the
 * re-encode itself is NOT covered here, and no assertion below claims it is. What *is* covered is
 * that saveRecipe hands the file across and puts the returned URL on the row.
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * This is a node-level logic check. It renders nothing, exercises no React hook, calls no real
 * Supabase and touches no database — the same scope note as every other script in this directory. No
 * assertion here says anything about whether Postgres accepts the row, whether RLS admits it, or
 * whether `recipe-images` exists; those are `scripts/task07_check.mjs` and the migration checks.
 *
 * NEGATIVE CONTROL (run it before trusting a clean result): copy `src` and `scripts` to a scratch
 * directory, break one thing in the copy's `src/lib/saveRecipe.js`, and re-run this file from there.
 * Controls measured on this branch, 2026-10-13, each mutating *logic* rather than a comment, each
 * going red and leaving the rest of the file running (clean run: **67 ok / 0 FAIL, exit 0**):
 *   - `is_personal: true` -> `is_personal: false`                        -> 65 ok / 2 FAIL, exit 1
 *   - the `creator: draft.creator?.trim() || null,` line deleted         -> 63 ok / 4 FAIL, exit 1
 *   - `cook_time_minutes: draft.cook_time_minutes ?? 30` -> `?? 0`       -> 66 ok / 1 FAIL, exit 1
 *   - `image_url: imageUrl` -> `image_url: null`                         -> 66 ok / 1 FAIL, exit 1
 *   - the ingredient mapping -> `(draft.ingredients ?? []).map((i) => i)`
 *                                                                        -> 65 ok / 2 FAIL, exit 1
 * A restored copy is green again.
 *
 * One assertion pins a behaviour rather than blessing it: a non-array `ingredients` throws a bare
 * `TypeError` instead of being coerced. See the note at that assertion.
 *
 * Plain script, non-zero exit on failure — same shape as scripts/task07_check.mjs.
 */
import { registerHooks } from 'node:module';

// A live-binding stand-in for `./supabase`: exported as `let` so the module under test sees whatever
// the test points it at. `setClient(null)` is the "not configured" case, exercised below.
const SUPABASE_STUB_URL = 'data:text/javascript,' + encodeURIComponent([
    'export let supabase = null;',
    'export function setClient(client) { supabase = client; }',
    'export function setHouseholdHeader() { return false; }',
].join('\n'));

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === './supabase' || specifier === './supabase.js') {
            return { url: SUPABASE_STUB_URL, shortCircuit: true };
        }
        // The app's own imports are extensionless; Vite resolves them, bare Node does not.
        if (specifier.startsWith('.') && !/\.[cm]?js$/.test(specifier)) {
            return nextResolve(`${specifier}.js`, context);
        }
        return nextResolve(specifier, context);
    },
});

const { saveRecipe } = await import('../src/lib/saveRecipe.js');
const { setClient } = await import(SUPABASE_STUB_URL);

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

/** Await a call and report whether it threw, plus the message and value. */
async function caught(fn) {
    try {
        const value = await fn();
        return { threw: false, message: null, value };
    } catch (err) {
        return { threw: true, message: err?.message ?? String(err), value: null };
    }
}

// `normalizeImage`'s canvas fallback logs a warning on every photo-path call; capture it so the
// suite's output stays readable and so "it fell back" is recorded rather than invisible.
const warnings = [];
const realWarn = console.warn;
console.warn = (...args) => { warnings.push(args.map(String).join(' ')); };

// ── a recording stand-in for the Supabase client ────────────────────────────────────────────────
// Only the two surfaces saveRecipe/uploadDishPhoto touch: the `from().insert().select().single()`
// chain, and `storage.from(bucket).upload()/.getPublicUrl()`.
const RECIPES_COLUMNS = [
    'title', 'description', 'creator', 'image_url', 'cook_time_minutes', 'difficulty', 'kcal',
    'base_servings', 'meal_type', 'source_url', 'tags', 'archetypes', 'ingredients', 'steps',
    'step_ingredients', 'is_personal', 'created_at',
];

let fromCalls = [];
let insertCalls = [];
let insertReply = { data: null, error: null };
let uploadCalls = [];
let uploadReply = { error: null };
let publicUrlCalls = [];
let publicUrl = 'https://example.supabase.co/storage/v1/object/public/recipe-images/x.jpg';

function resetClient() {
    fromCalls = [];
    insertCalls = [];
    insertReply = { data: null, error: null };
    uploadCalls = [];
    uploadReply = { error: null };
    publicUrlCalls = [];
    publicUrl = 'https://example.supabase.co/storage/v1/object/public/recipe-images/x.jpg';
    warnings.length = 0;
}

const fakeClient = {
    from(table) {
        fromCalls.push(table);
        return {
            insert(row) {
                insertCalls.push(row);
                return {
                    select() {
                        return {
                            single() {
                                return Promise.resolve(insertReply);
                            },
                        };
                    },
                };
            },
        };
    },
    storage: {
        from(bucket) {
            return {
                upload(path, file, options) {
                    uploadCalls.push([bucket, path, file, options]);
                    return Promise.resolve(uploadReply);
                },
                getPublicUrl(path) {
                    publicUrlCalls.push(path);
                    return { data: { publicUrl } };
                },
            };
        },
    },
};

// ── the two guards, and that neither reaches the database ───────────────────────────────────────
console.log('\nsaveRecipe — the guards, which fire before any request');

resetClient();
setClient(null);
let result = await caught(() => saveRecipe({ title: 'Anything' }));
check('no Supabase client -> it throws', result.threw, true);
check('no Supabase client -> the documented message',
    result.message, 'Supabase is not configured — cannot save.');
check('no Supabase client -> no table was touched', [fromCalls.length, insertCalls.length], [0, 0]);

setClient(fakeClient);
resetClient();
result = await caught(() => saveRecipe(undefined));
check('no draft at all -> it throws', result.threw, true);
check('no draft at all -> the documented message',
    result.message, 'Recipe needs a name before saving.');
check('no draft at all -> no table was touched', insertCalls.length, 0);

resetClient();
result = await caught(() => saveRecipe({ title: '   ' }));
check('a whitespace-only title is refused', result.threw, true);
check('a whitespace-only title -> the documented message',
    result.message, 'Recipe needs a name before saving.');
check('a whitespace-only title -> no insert was attempted', insertCalls.length, 0);

resetClient();
result = await caught(() => saveRecipe({}));
check('a draft with no title key is refused', result.threw, true);

// ── the row that gets inserted ─────────────────────────────────────────────────────────────────
console.log('\nsaveRecipe — the row it inserts');

resetClient();
insertReply = { data: { id: '11111111-1111-1111-1111-111111111111' }, error: null };
result = await caught(() => saveRecipe({ title: '  Peanut Butter Pork Noodles  ' }));

check('it inserted exactly one row', insertCalls.length, 1);
const minimalRow = insertCalls[0];
check('the inserted row has exactly the documented column set',
    Object.keys(minimalRow ?? {}).sort(), [...RECIPES_COLUMNS].sort());
check('it targets the recipes table', fromCalls, ['recipes']);
check('the title is trimmed before it is stored', minimalRow?.title, 'Peanut Butter Pork Noodles');
check('description defaults to null', minimalRow?.description, null);
check('creator defaults to null', minimalRow?.creator, null);
check('image_url defaults to null', minimalRow?.image_url, null);
check('cook_time_minutes defaults to 30', minimalRow?.cook_time_minutes, 30);
check('difficulty defaults to Easy', minimalRow?.difficulty, 'Easy');
check('kcal defaults to null', minimalRow?.kcal, null);
check('base_servings defaults to 2', minimalRow?.base_servings, 2);
check('meal_type defaults to Dinner', minimalRow?.meal_type, 'Dinner');
check('source_url defaults to null (text and photo captures carry no link)', minimalRow?.source_url, null);
check('tags defaults to [captured]', minimalRow?.tags, ['captured']);
check('archetypes is always [] — legacy persona tags are not written by capture', minimalRow?.archetypes, []);
check('ingredients defaults to []', minimalRow?.ingredients, []);
check('steps defaults to []', minimalRow?.steps, []);
check('step_ingredients defaults to null (Cook Mode falls back to runtime matching)',
    minimalRow?.step_ingredients, null);
check('is_personal is always true', minimalRow?.is_personal, true);
check('created_at is an ISO 8601 string', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(minimalRow?.created_at ?? ''), true);
const createdAtSkew = Math.abs(Date.now() - Date.parse(minimalRow?.created_at ?? ''));
check('created_at is now, not a fixed or defaulted value', createdAtSkew < 5000, true);
check('the stored value is what the client returned', result.value, insertReply.data);
check('nothing was uploaded for a capture with no photo',
    [uploadCalls.length, publicUrlCalls.length], [0, 0]);

// is_personal is not a field a draft gets a vote on: it is the predicate the seeded-recipe
// archive/delete migration used to tell the owner's captures from the imported library.
resetClient();
insertReply = { data: { id: 'x' }, error: null };
await caught(() => saveRecipe({ title: 'T', is_personal: false }));
check('a draft claiming is_personal:false still stores true', insertCalls[0]?.is_personal, true);

// ── overrides: whatever the caller supplied, as the file documents ──────────────────────────────
console.log('\nsaveRecipe — what a caller may override');

resetClient();
insertReply = { data: { id: 'full' }, error: null };
const fullDraft = {
    title: 'Spicy Peanut Noodles',
    description: 'Weeknight fast.',
    creator: '  @handle  ',
    cook_time_minutes: 25,
    difficulty: 'Medium',
    kcal: 640,
    base_servings: 4,
    meal_type: 'Lunch',
    source_url: 'https://example.com/recipe',
    tags: ['captured', 'ai-planned'],
    ingredients: [
        { name: 'peanut butter', quantity: 2, unit: 'tbsp', extra: 'dropped' },
        { name: 'noodles', quantity: null, unit: 'g' },
        { name: 'chilli' },
    ],
    steps: ['Boil the noodles.', 'Stir the sauce.'],
    step_ingredients: [[1], [0, 2]],
};
await caught(() => saveRecipe(fullDraft));
const fullRow = insertCalls[0];
check('description is passed through', fullRow?.description, 'Weeknight fast.');
check('creator is trimmed', fullRow?.creator, '@handle');
check('cook_time_minutes is passed through', fullRow?.cook_time_minutes, 25);
check('difficulty is passed through', fullRow?.difficulty, 'Medium');
check('kcal is passed through', fullRow?.kcal, 640);
check('base_servings is passed through', fullRow?.base_servings, 4);
check('meal_type is passed through', fullRow?.meal_type, 'Lunch');
check('source_url survives a URL capture', fullRow?.source_url, 'https://example.com/recipe');
check('caller-supplied tags win over the [captured] default',
    fullRow?.tags, ['captured', 'ai-planned']);
check('ingredients are mapped to the canonical {name, quantity, unit} shape',
    fullRow?.ingredients, [
        { name: 'peanut butter', quantity: 2, unit: 'tbsp' },
        { name: 'noodles', quantity: null, unit: 'g' },
        { name: 'chilli', quantity: null, unit: null },
    ]);
check('unknown keys on an ingredient are dropped, not spread through',
    Object.keys(fullRow?.ingredients?.[0] ?? {}).sort(), ['name', 'quantity', 'unit']);
check('steps are passed through unchanged', fullRow?.steps, ['Boil the noodles.', 'Stir the sauce.']);
check('step_ingredients survive alongside the steps they index',
    fullRow?.step_ingredients, [[1], [0, 2]]);

// A whitespace-only creator is a blank attribution, stored as null rather than '' — an empty string
// would render as an empty chip where the UI expects the absence of a creator. An explicit null
// `tags` falls back to ['captured'] for the same `??` reason.
resetClient();
insertReply = { data: { id: 'y' }, error: null };
await caught(() => saveRecipe({ title: 'T', creator: '   ', tags: null }));
check('a whitespace-only creator is stored as null', insertCalls[0]?.creator, null);
check('an explicit null tags value falls back to [captured]', insertCalls[0]?.tags, ['captured']);

// MEASURED, and not the tidier behaviour one might assume: a non-array `ingredients` value is not
// coerced to [] — `(draft.ingredients ?? []).map(...)` runs anyway, so the function throws a bare
// TypeError. `useRecipeCapture.js` surfaces `err.message` verbatim, so the user would read
// "(draft.ingredients ?? []).map is not a function". Pinned as the current behaviour rather than
// papered over; if a guard is ever added, this assertion is the one that should change.
resetClient();
insertReply = { data: { id: 'y2' }, error: null };
result = await caught(() => saveRecipe({ title: 'T', ingredients: 'not-an-array' }));
check('a non-array ingredients value throws rather than being coerced', result.threw, true);
check('the thrown message is the TypeError from the mapping itself',
    result.message, '(draft.ingredients ?? []).map is not a function');
check('no insert was attempted for that draft', insertCalls.length, 0);

// ── the client-side outcome ─────────────────────────────────────────────────────────────────────
console.log('\nsaveRecipe — the call chain and the error path');

resetClient();
insertReply = { data: null, error: { message: 'new row violates row-level security policy' } };
result = await caught(() => saveRecipe({ title: 'RLS blocked' }));
check('a Supabase error is rethrown, not swallowed', result.threw, true);
check('the rethrown message is the database\'s own', result.message, 'new row violates row-level security policy');

// ── the photo path, through the real uploadDishPhoto ────────────────────────────────────────────
console.log('\nuploadDishPhoto (reached from saveRecipe) — the photo path');

resetClient();
insertReply = { data: { id: 'photo' }, error: null };
publicUrl = 'https://example.supabase.co/storage/v1/object/public/recipe-images/abc.jpg';
const fakeFile = new File([new Uint8Array([1, 2, 3])], 'dish.png', { type: 'image/png' });
const realRandomUUID = globalThis.crypto.randomUUID.bind(globalThis.crypto);
globalThis.crypto.randomUUID = () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
await caught(() => saveRecipe({ title: 'With a photo' }, fakeFile));
globalThis.crypto.randomUUID = realRandomUUID;

check('the photo was uploaded exactly once', uploadCalls.length, 1);
check('the bucket is recipe-images', uploadCalls[0]?.[0], 'recipe-images');
check('the object path is a fresh uuid.jpg', uploadCalls[0]?.[1], 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg');
check('the original file is what gets handed to the uploader (canvas re-encode falls back in Node)',
    uploadCalls[0]?.[2] === fakeFile, true);
check('the upload is declared image/jpeg', uploadCalls[0]?.[3], { contentType: 'image/jpeg', upsert: false });
check('the public URL of that exact path is requested', publicUrlCalls, ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg']);
check('the public URL lands on the row as image_url', insertCalls[0]?.image_url, publicUrl);
check('the canvas fallback was taken, not silently skipped',
    warnings.some((w) => w.includes('Image normalization failed')), true);

// The two documented failures. 'bucket not found' is the one a fresh Supabase project actually
// produces, and it is why the message tells the user how to fix it rather than echoing the API error.
resetClient();
insertReply = { data: { id: 'z' }, error: null };
uploadReply = { error: { message: 'Bucket not found' } };
result = await caught(() => saveRecipe({ title: 'T' }, fakeFile));
check('a missing bucket is reported, not thrown raw', result.threw, true);
check('the missing-bucket message names the bucket and the fix',
    result.message,
    'No "recipe-images" storage bucket exists in Supabase yet — create one (Storage → New bucket, name it "recipe-images", make it public) and try again.');
check('a failed upload inserts no row', insertCalls.length, 0);

resetClient();
insertReply = { data: { id: 'z' }, error: null };
uploadReply = { error: { message: 'Payload too large' } };
result = await caught(() => saveRecipe({ title: 'T' }, fakeFile));
check('any other upload error is prefixed for the user',
    result.message, 'Could not upload photo: Payload too large');
check('a failed upload still inserts no row', insertCalls.length, 0);

// ───────────────────────────────────────────────────────────────────────────────────────────────
console.warn = realWarn;
setClient(null);
console.log('');
if (failures) {
    console.log(`${failures} FAILED`);
    process.exit(1);
}
console.log('all checks passed');