/**
 * Recipe-extraction checks — `node scripts/recipe_extraction_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/lib/recipeExtraction.js` is the Capture entry point — the module that turns pasted text, a
 * screenshot or a URL into the recipe row the app stores — and until this file it was asserted
 * nowhere. Measured, not assumed: `git grep -l recipeExtraction` across all 25 heads (main + 24 PR
 * heads) returns only the two docs/features directories and the *app* files — `src/lib/dishCuration.js`
 * and `src/lib/weekPlanChat.js` import FROM it, and no `scripts/*_check.mjs` on any head mentions it.
 * It is the largest uncovered module in `src/lib/` (12,668 bytes / 261 lines) and the one the TASK_07
 * header's ancestry note points at when it says the Gemini prompt builders are the capture surface.
 *
 * Note on the brief that asked for this: it named `src/lib/recipeImport.js`, which **does not exist on
 * any head** — `git ls-tree -r` finds nothing, and the only trace of the name is an archived feature
 * doc. The Gemini prompt builders it also named are the two prompt constants below, which live in this
 * module. That is the module this file asserts.
 *
 * WHAT IT ASSERTS, AND WHY EACH THING MATTERS
 *   - `cleanJson` — Gemini returns its JSON fenced in ```json about as often as bare. If the fence
 *     survives, `JSON.parse` throws and the user sees a capture failure on a perfectly good recipe.
 *   - `RECIPE_SCHEMA` — this object is sent as the model's responseSchema AND is the contract the rest
 *     of the app reads. The `required` list, the two enums and the nullability of `creator` and
 *     `kcal` are decisions; each is pinned so a later edit is deliberate rather than silent.
 *   - the prompt actually sent — the unit-system instruction is a `{{UNIT_INSTRUCTION}}` placeholder
 *     substituted at call time from `unitPreference.js`. If the substitution is dropped, the model is
 *     told to use "{{UNIT_INSTRUCTION}}", which is to say nothing, and every household silently gets
 *     whatever units the source happened to use. The pasted text must also arrive *trimmed*. This is
 *     asserted by stubbing `fetch` and reading the request body, so it exercises the real prompt
 *     builder rather than a copy of its text.
 *   - `withValidStepIngredients` is applied on the way out — an off-by-one `step_ingredients` array is
 *     dropped rather than stored misaligned (TASK_10).
 *   - `extractRecipeFromUrl` — the three response shapes the Netlify function can return (JSON-LD,
 *     readable-text fallback, error), plus the two guard messages. The jsonld branch must NOT invent a
 *     `source_url` (the function already carries one), and the fallback branch must reuse
 *     `extractRecipe` rather than duplicating extraction — both are asserted by call count.
 *   - `describeApiError` — a quota error must read as "wait a minute", not as "couldn't read that
 *     recipe". Each mapped code is pinned, including the JSON-in-a-string error body the Gemini REST
 *     layer actually produces.
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * This is a node-level logic check. It renders nothing, exercises no React context, calls no real
 * Gemini and touches no database — the same scope note as every other script in this directory. The
 * image path (`normalizeImage` / `fileToBase64`, canvas-dependent) is not exercised; no assertion here
 * says anything about what the model actually returns for a given prompt, only about what is sent.
 *
 * NEGATIVE CONTROL (run it before trusting a clean result):
 *   cp -r src scripts <scratch> && sed -i "s/\.replace('{{UNIT_INSTRUCTION}}', unitSystemInstruction())/.replace('{{UNIT_INSTRUCTION}}', '')/" <scratch>/src/lib/recipeExtraction.js
 * then run this file from `<scratch>`: the four "the unit instruction is substituted" assertions fail.
 * Dropping the `.replace(...)` call entirely also fails them. Two further controls are recorded in the
 * PR body (cleanJson returning its input unchanged; a `required` entry removed from RECIPE_SCHEMA).
 *
 * Plain script, non-zero exit on failure — same shape as scripts/task07_check.mjs.
 */
import { registerHooks } from 'node:module';

// The app's own imports are extensionless (`./imageUtils`), which Vite resolves at build time and
// bare Node does not. Resolve them for this process only, so the check runs the real module — the
// same hook shape as scripts/creator_group_check.mjs.
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('.') && !/\.[cm]?js$/.test(specifier)) {
            return nextResolve(`${specifier}.js`, context);
        }
        return nextResolve(specifier, context);
    },
});

const {
    RECIPE_SCHEMA,
    cleanJson,
    describeApiError,
    extractRecipe,
    extractRecipeFromUrl,
    refineRecipe,
} = await import('../src/lib/recipeExtraction.js');
const { UNIT_SYSTEM_INSTRUCTIONS } = await import('../src/lib/unitPreference.js');

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

/** Await a call and report whether it threw, plus the message. */
async function caught(fn) {
    try {
        const value = await fn();
        return { threw: false, message: null, value };
    } catch (err) {
        return { threw: true, message: err?.message ?? String(err), value: null };
    }
}

// ── a controllable stand-in for the two Netlify functions ──────────────────────────────────────
// Every call is recorded, so the *request* can be asserted, not just the result. `queue` lets one
// test hand out two different replies in order (fetch-recipe, then gemini); when it is empty the
// single `reply` is reused.
let calls = [];
let reply = { ok: true, status: 200, contentType: 'application/json', body: { text: '{}' } };
let queue = [];
let throwOnFetch = false;

function reset() {
    calls = [];
    queue = [];
    throwOnFetch = false;
    reply = { ok: true, status: 200, contentType: 'application/json', body: { text: '{}' } };
}

function fetchReply() {
    return queue.length ? queue.shift() : reply;
}

globalThis.fetch = async (url, opts) => {
    if (throwOnFetch) throw new Error('offline');
    calls.push({ url, body: opts?.body ? JSON.parse(opts.body) : null });
    const r = fetchReply();
    return {
        ok: r.ok,
        status: r.status,
        headers: { get: () => r.contentType },
        json: async () => r.body,
    };
};

/** A minimal shape-valid recipe for the model to "return". */
function modelRecipe(overrides = {}) {
    return {
        title: 'Garlic Butter Chicken Thighs',
        cook_time_minutes: 25,
        difficulty: 'Easy',
        base_servings: 2,
        meal_type: 'Dinner',
        ingredients: [{ name: 'chicken thighs', quantity: 500, unit: 'g' }, { name: 'butter', quantity: 30, unit: 'g' }],
        steps: ['Brown the chicken.', 'Melt the butter over it.'],
        ...overrides,
    };
}

console.log('\ncleanJson');

check('a ```json fence is removed', cleanJson('```json\n{"a":1}\n```'), '{"a":1}');
check('a bare ``` fence is removed', cleanJson('```\n{"a":1}\n```'), '{"a":1}');
check('both a json fence and a bare fence are removed', cleanJson('```json\n{"a":1}\n``````'), '{"a":1}');
check('unfenced JSON is passed through', cleanJson('{"a":1}'), '{"a":1}');
check('surrounding whitespace is trimmed', cleanJson('\n\n  {"a":1}  \n'), '{"a":1}');
check('null is the empty string, not "null"', cleanJson(null), '');
check('undefined is the empty string', cleanJson(undefined), '');
check('an empty response is the empty string', cleanJson(''), '');
check('a fenced response still parses as JSON', (() => { try { return JSON.parse(cleanJson('```json\n{"a":1}\n```')).a; } catch { return 'threw'; } })(), 1);

console.log('\nRECIPE_SCHEMA — the response contract');

check('required is exactly the seven fields the app reads',
    RECIPE_SCHEMA.required,
    ['title', 'cook_time_minutes', 'difficulty', 'base_servings', 'meal_type', 'ingredients', 'steps']);
check('step_ingredients is deliberately NOT required (TASK_10 fallback)', RECIPE_SCHEMA.required.includes('step_ingredients'), false);
check('creator is nullable, so "no author" is a valid answer', RECIPE_SCHEMA.properties.creator.nullable, true);
check('kcal is nullable', RECIPE_SCHEMA.properties.kcal.nullable, true);
check('title is not nullable', RECIPE_SCHEMA.properties.title.nullable, undefined);
check('difficulty enum is pinned', RECIPE_SCHEMA.properties.difficulty.enum, ['Easy', 'Medium', 'Hard']);
check('meal_type enum is pinned', RECIPE_SCHEMA.properties.meal_type.enum, ['Breakfast', 'Lunch', 'Dinner']);
check('cook_time_minutes is an integer, not a string', RECIPE_SCHEMA.properties.cook_time_minutes.type, 'integer');
check('base_servings is an integer', RECIPE_SCHEMA.properties.base_servings.type, 'integer');
check('ingredients and steps are arrays', [RECIPE_SCHEMA.properties.ingredients.type, RECIPE_SCHEMA.properties.steps.type], ['array', 'array']);
check('an ingredient requires only a name', RECIPE_SCHEMA.properties.ingredients.items.required, ['name']);
check('an ingredient may carry quantity and unit',
    Object.keys(RECIPE_SCHEMA.properties.ingredients.items.properties).sort(), ['name', 'quantity', 'unit']);
check('quantity and unit are nullable (a "pinch" has no number)',
    [RECIPE_SCHEMA.properties.ingredients.items.properties.quantity.nullable, RECIPE_SCHEMA.properties.ingredients.items.properties.unit.nullable],
    [true, true]);
check('step_ingredients is an array of arrays of integers',
    [RECIPE_SCHEMA.properties.step_ingredients.type, RECIPE_SCHEMA.properties.step_ingredients.items.type, RECIPE_SCHEMA.properties.step_ingredients.items.items.type],
    ['array', 'array', 'integer']);
check('step_ingredients is nullable (a model that omits it must not be rejected)',
    RECIPE_SCHEMA.properties.step_ingredients.nullable, true);

console.log('\nextractRecipe — the request it sends');

reset();
let out = await caught(() => extractRecipe({}));
check('neither text nor images throws', out.threw, true);
check('...with the message the Capture screen shows', out.message, 'Add some text or at least one photo before extracting.');
reset();
out = await caught(() => extractRecipe());
check('no argument at all throws the same way', out.message, 'Add some text or at least one photo before extracting.');
reset();
out = await caught(() => extractRecipe({ text: '   \n  ' }));
check('whitespace-only text counts as no text', out.message, 'Add some text or at least one photo before extracting.');
reset();
out = await caught(() => extractRecipe({ text: 'x', images: [] }));
check('empty images with text proceeds to the model', out.threw, false);

reset();
reply.body = { text: JSON.stringify(modelRecipe()) };
const extracted = await extractRecipe({ text: '  My grandma’s soup  ' });
check('the request goes to the Gemini proxy function', calls[0].url, '/.netlify/functions/gemini');
check('the model is pinned', calls[0].body.model, 'gemini-2.5-flash');
check('the response is requested as JSON', calls[0].body.config.responseMimeType, 'application/json');
check('the schema sent is the module’s own RECIPE_SCHEMA',
    JSON.stringify(calls[0].body.config.responseSchema) === JSON.stringify(RECIPE_SCHEMA), true);
check('...with every required field present in the sent copy',
    calls[0].body.config.responseSchema.required, RECIPE_SCHEMA.required);
check('...and no extra top-level properties', Object.keys(calls[0].body.config.responseSchema.properties).sort(), Object.keys(RECIPE_SCHEMA.properties).sort());
check('the output-token budget is pinned', calls[0].body.config.maxOutputTokens, 8192);
check('text-only input sends one text part', calls[0].body.contents.length === 1 && typeof calls[0].body.contents[0].text === 'string', true);

const sentPrompt = calls[0].body.contents[0].text;
check('no {{UNIT_INSTRUCTION}} placeholder survives into the prompt', sentPrompt.includes('{{UNIT_INSTRUCTION}}'), false);
check('the substituted text is the unit-preference instruction', sentPrompt.includes(UNIT_SYSTEM_INSTRUCTIONS.metric), true);
check('...which is the metric one with no stored preference (node has none)', sentPrompt.includes('metric units only'), true);
check('the pasted text is appended', sentPrompt.includes('PASTED TEXT:'), true);
check('the pasted text arrives trimmed', sentPrompt.includes('My grandma’s soup'), true);
check('...and not with its original padding', sentPrompt.includes('My grandma’s soup  '), false);
check('no images means no image-count note', sentPrompt.includes('attached below'), false);
check('the parsed recipe is returned', extracted.title, 'Garlic Butter Chicken Thighs');

reset();
reply.body = { text: '```json\n' + JSON.stringify(modelRecipe()) + '\n```' };
const fenced = await extractRecipe({ text: 'x' });
check('a fenced model response is unwrapped before parsing', fenced.title, 'Garlic Butter Chicken Thighs');

reset();
reply.body = { text: '' };
out = await caught(() => extractRecipe({ text: 'x' }));
check('an empty model response throws', out.threw, true);
check('...with the unreadable-source message', out.message, 'Gemini returned an empty response — the image or text may be unreadable.');

reset();
reply.body = { text: 'not json at all' };
out = await caught(() => extractRecipe({ text: 'x' }));
check('a malformed model response surfaces rather than being swallowed', out.threw, true);
check('...as a JSON parse error', /JSON/i.test(out.message ?? ''), true);

reset();
reply.ok = false;
reply.status = 500;
reply.body = { error: 'AI request failed (500).' };
out = await caught(() => extractRecipe({ text: 'x' }));
check('a proxy failure is re-thrown through describeApiError', out.message, 'AI request failed (500).');

console.log('\nextractRecipe — step_ingredients is validated on the way out');

reset();
reply.body = { text: JSON.stringify(modelRecipe({ step_ingredients: [[0], [1, 0]] })) };
const aligned = await extractRecipe({ text: 'x' });
check('one entry per step survives, sorted ascending', aligned.step_ingredients, [[0], [0, 1]]);

reset();
reply.body = { text: JSON.stringify(modelRecipe({ step_ingredients: [[0, 0, 1], []] })) };
const deduped = await extractRecipe({ text: 'x' });
check('a repeated index in one step is deduped', deduped.step_ingredients, [[0, 1], []]);

reset();
reply.body = { text: JSON.stringify(modelRecipe({ step_ingredients: [[null, '', -2, 0], []] })) };
const junk = await extractRecipe({ text: 'x' });
check('nulls, blanks and negatives never become "ingredient 0"', junk.step_ingredients, [[0], []]);

reset();
reply.body = { text: JSON.stringify(modelRecipe({ step_ingredients: [['1'], []] })) };
const stringIndexes = await extractRecipe({ text: 'x' });
check('a numeric string is coerced, not dropped', stringIndexes.step_ingredients, [[1], []]);

reset();
reply.body = { text: JSON.stringify(modelRecipe({ step_ingredients: [[0]] })) };
const misaligned = await extractRecipe({ text: 'x' });
check('a mismatched length is dropped, not stored misaligned', 'step_ingredients' in misaligned, false);

reset();
reply.body = { text: JSON.stringify(modelRecipe({ step_ingredients: [[0], [9]] })) };
const outOfRange = await extractRecipe({ text: 'x' });
check('an out-of-range index is filtered against the ingredient count', outOfRange.step_ingredients, [[0], []]);

reset();
reply.body = { text: JSON.stringify(modelRecipe()) };
const noLinks = await extractRecipe({ text: 'x' });
check('a model that omits step_ingredients is still accepted', 'step_ingredients' in noLinks, false);

console.log('\nrefineRecipe');

reset();
out = await caught(() => refineRecipe({ title: 'T' }, ''));
check('an empty instruction throws', out.message, 'Describe what you want to change.');
reset();
out = await caught(() => refineRecipe({ title: 'T' }, '   '));
check('a whitespace-only instruction throws', out.message, 'Describe what you want to change.');
reset();
out = await caught(() => refineRecipe({ title: 'T' }));
check('a missing instruction throws the same way', out.message, 'Describe what you want to change.');

reset();
reply.body = { text: JSON.stringify({ recipe: modelRecipe({ title: 'Scaled' }), changeSummary: 'Scaled to 4 servings.' }) };
const refined = await refineRecipe({ title: 'Original', base_servings: 2 }, '  make it 4 servings  ');
const refinePrompt = calls[0].body.contents;
check('the refine prompt is sent as plain text, not parts', typeof refinePrompt, 'string');
check('...carrying the current recipe as JSON', refinePrompt.includes('"title":"Original"'), true);
check('...and the user request, trimmed', refinePrompt.includes('REQUEST:\nmake it 4 servings'), true);
check('...with the unit instruction substituted too', refinePrompt.includes('{{UNIT_INSTRUCTION}}'), false);
check('...and the metric instruction present', refinePrompt.includes(UNIT_SYSTEM_INSTRUCTIONS.metric), true);
check('the same schema path is used (JSON response)', calls[0].body.config.responseMimeType, 'application/json');
check('the refined recipe is returned', refined.recipe.title, 'Scaled');
check('the change summary is returned alongside it', refined.changeSummary, 'Scaled to 4 servings.');

console.log('\nextractRecipeFromUrl — the TASK_08 fast path');

reset();
out = await caught(() => extractRecipeFromUrl('   '));
check('a blank URL throws', out.message, 'Paste a recipe URL first.');
reset();
out = await caught(() => extractRecipeFromUrl());
check('a missing URL throws the same way', out.message, 'Paste a recipe URL first.');

reset();
reply.body = { source: 'jsonld', recipe: modelRecipe({ title: 'From JSON-LD' }), imageUrl: 'https://cdn.example/a.jpg', source_url: 'https://blog.example/r' };
const jsonld = await extractRecipeFromUrl('  https://blog.example/r  ');
check('the URL is encoded into the function query', calls[0].url, '/.netlify/functions/fetch-recipe?url=https%3A%2F%2Fblog.example%2Fr');
check('the URL is trimmed before it is encoded', calls[0].url.includes('%20'), false);
check('a JSON-LD hit is returned directly, with no Gemini call', calls.length, 1);
check('...with the recipe intact', jsonld.title, 'From JSON-LD');
check('...and the source image attached as capture_image_url', jsonld.capture_image_url, 'https://cdn.example/a.jpg');
check('...and the function’s own source_url left alone (not overwritten)', jsonld.source_url, undefined);

reset();
queue = [
    { ok: true, status: 200, contentType: 'application/json', body: { source: 'fallback', pageText: 'A readable recipe page', source_url: 'https://blog.example/r', imageUrl: null } },
    { ok: true, status: 200, contentType: 'application/json', body: { text: JSON.stringify(modelRecipe({ title: 'From fallback text' })) } },
];
const fallback = await extractRecipeFromUrl('https://blog.example/r');
check('a fallback hit reuses extractRecipe (two calls: fetch-recipe, then gemini)', calls.length, 2);
check('the second call is the Gemini proxy', calls[1].url, '/.netlify/functions/gemini');
check('the page text is what gets extracted', calls[1].body.contents[0].text.includes('A readable recipe page'), true);
check('the result carries the function’s source_url', fallback.source_url, 'https://blog.example/r');
check('a null source image becomes a null capture_image_url', fallback.capture_image_url, null);
check('the recipe from the fallback text is returned', fallback.title, 'From fallback text');

reset();
reply.ok = false;
reply.status = 404;
reply.body = { error: "Couldn't find that page (404)." };
out = await caught(() => extractRecipeFromUrl('https://blog.example/x'));
check('an error body is surfaced as its own message', out.message, "Couldn't find that page (404).");

reset();
reply.body = { source: 'none' };
out = await caught(() => extractRecipeFromUrl('https://blog.example/x'));
check('a response with neither shape throws', out.message, "Couldn't find a recipe on that page. Try pasting the recipe text directly.");

reset();
reply.contentType = 'text/html';
out = await caught(() => extractRecipeFromUrl('https://blog.example/x'));
check('a non-JSON response names the netlify-dev requirement', /netlify dev/.test(out.message ?? ''), true);

reset();
throwOnFetch = true;
out = await caught(() => extractRecipeFromUrl('https://blog.example/x'));
check('an unreachable function says so', out.message, "Couldn't reach the recipe fetcher. Check your connection and try again.");

console.log('\ndescribeApiError');

check('a 429 status reads as a quota message',
    describeApiError({ status: 429 }).message, 'Gemini rate limit or quota reached — wait a minute and try again.');
check('RESOURCE_EXHAUSTED in a JSON body reads the same',
    describeApiError({ message: JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED' } }) }).message,
    'Gemini rate limit or quota reached — wait a minute and try again.');
check('a numeric 400 with a JSON body names the rejection',
    describeApiError({ message: JSON.stringify({ error: { code: 400, status: 'INVALID_ARGUMENT' } }) }).message,
    'Gemini rejected the request ({"error":{"code":400,"status":"INVALID_ARGUMENT"}}).');
check('a 400 status alone is enough to name the rejection',
    describeApiError({ status: 400, message: 'bad request' }).message, 'Gemini rejected the request (bad request).');
check('the quoted rejection is truncated to 200 characters',
    describeApiError({ status: 400, message: 'y'.repeat(300) }).message, `Gemini rejected the request (${'y'.repeat(200)}).`);
check('a 401 points at the key', describeApiError({ status: 401 }).message, 'Gemini API key was rejected — check GEMINI_API_KEY.');
check('a 403 points at the key too', describeApiError({ status: 403 }).message, 'Gemini API key was rejected — check GEMINI_API_KEY.');
check('an unrecognised error passes its message straight through', describeApiError({ message: 'something odd' }).message, 'something odd');
check('a thrown string is handled', describeApiError('boom').message, 'boom');
check('something with no message at all is still handled', describeApiError({}).message, '[object Object]');

// ───────────────────────────────────────────────────────────────────────────────────────────────
console.log('');
if (failures) {
    console.log(`${failures} FAILED`);
    process.exit(1);
}
console.log('all checks passed');
