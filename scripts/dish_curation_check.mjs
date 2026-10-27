/**
 * Dish-curation checks — `node scripts/dish_curation_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/lib/dishCuration.js` is the "propose ONE dish" builder behind Capture/Plan — the module that
 * turns the user's constraints, the batch accepted so far and the slot's rejections into the single
 * dish Gemini is asked for, and then maps the model's answer back onto a real library row. Measured,
 * not assumed: `git grep -l dishCuration` across every remote head (main + all PR heads) returns the
 * two docs/features directories, the app file itself, and exactly ONE `scripts/*_check.mjs` —
 * `recipe_extraction_check.mjs` — which mentions it only in a comment explaining that it imports FROM
 * `recipeExtraction.js` and is not asserted there. So the module has no suite of its own.
 *
 * WHAT IT ASSERTS, AND WHY EACH THING MATTERS
 *   - `parseTargetCount` — decides whether the UI asks "how many meals?" or guesses. An off-by-one in
 *     the 1..20 bound either refuses a perfectly ordinary "24 meals" plan or silently accepts a
 *     nonsense count and makes the model curate dozens of dishes.
 *   - `REJECTION_REASONS` — the exact strings the reject buttons send back as `rejectedForThisSlot`
 *     reasons. The prompt tells the model to steer by them ("too heavy" means lighter), so renaming
 *     one silently makes that steering stop working. Pinned as a list.
 *   - the request `proposeDish` actually sends — the `{{UNIT_INSTRUCTION}}` placeholder is substituted
 *     at call time from `unitPreference.js`. If the substitution is dropped the model is told to use
 *     "{{UNIT_INSTRUCTION}}", i.e. nothing, and every household silently gets the source's units. The
 *     payload's coercions matter too: `forceGenerated` must be a real boolean (the prompt branches on
 *     it), and an empty `customRequest` must arrive as null, not "". Asserted by stubbing `fetch` and
 *     reading the request body, so it exercises the real prompt builder rather than a copy of its text.
 *   - the schema sent — it is the response contract; `required`, the `source` enum and the nullability
 *     of `libraryIndex`/`recipe` are decisions. The nested `recipe` must be the shared `RECIPE_SCHEMA`,
 *     not a drifted copy.
 *   - `libraryIndex` → `recipeId` — the model answers with an index into `libraryShortlist`, and the
 *     module dereferences it. Index 0 must resolve to entry 0 (an off-by-one saves the wrong recipe),
 *     an out-of-range index must degrade to null (the caller's backstop), and a "generated" dish must
 *     never pick up a library id.
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * This is a node-level logic check. It renders nothing, exercises no React context, calls no real
 * Gemini and touches no database — the same scope note as every other script in this directory. No
 * assertion here says anything about what the model returns for a given prompt, only what is sent.
 *
 * NEGATIVE CONTROL (run it before trusting a clean result):
 *   cp -r src scripts <scratch>/ctl && sed -i "s/libraryShortlist?\.\[parsed.libraryIndex\]?\.id ?? null/null/" <scratch>/ctl/src/lib/dishCuration.js
 * then run this file from `<scratch>/ctl`: every `libraryIndex` mapping assertion fails. Changing the
 * `n <= 20` bound in `parseTargetCount` fails the "21 meals" assertion; dropping the `.replace(...)`
 * unit substitution fails the placeholder assertions.
 *
 * Plain script, non-zero exit on failure — same shape as scripts/task07_check.mjs.
 */
import { registerHooks } from 'node:module';

// The app's own imports are extensionless (`./recipeExtraction`), which Vite resolves at build time
// and bare Node does not. Resolve them for this process only, so the check runs the real module — the
// same hook shape as scripts/creator_group_check.mjs.
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('.') && !/\.[cm]?js$/.test(specifier)) {
            return nextResolve(`${specifier}.js`, context);
        }
        return nextResolve(specifier, context);
    },
});

const { REJECTION_REASONS, parseTargetCount, proposeDish } = await import('../src/lib/dishCuration.js');
const { RECIPE_SCHEMA } = await import('../src/lib/recipeExtraction.js');
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

/** Await a call and report whether it threw, plus the message and value. */
async function caught(fn) {
    try {
        const value = await fn();
        return { threw: false, message: null, value };
    } catch (err) {
        return { threw: true, message: err?.message ?? String(err), value: null };
    }
}

// ── a controllable stand-in for the Gemini proxy function ──────────────────────────────────────
// Every call is recorded, so the *request* can be asserted, not just the result.
let calls = [];
let reply = { ok: true, status: 200, contentType: 'application/json', body: { text: '{}' } };
let throwOnFetch = false;

function reset() {
    calls = [];
    throwOnFetch = false;
    reply = { ok: true, status: 200, contentType: 'application/json', body: { text: '{}' } };
}

globalThis.fetch = async (url, opts) => {
    if (throwOnFetch) throw new Error('offline');
    calls.push({ url, body: opts?.body ? JSON.parse(opts.body) : null });
    return {
        ok: reply.ok,
        status: reply.status,
        headers: { get: () => reply.contentType },
        json: async () => reply.body,
    };
};

/** A short library, so an index and its id are easy to tell apart. */
const LIBRARY = [
    { id: 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', title: 'White Chicken Chili' },
    { id: 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb', title: 'Spicy Peanut Noodles' },
    { id: 'cccccccc-3333-3333-3333-cccccccccccc', title: 'Cherry Granola' },
];

/** The DATA object carried in the prompt body, parsed back out of the recorded call. */
function sentPayload() {
    const contents = calls[0].body.contents;
    const marker = '\n\nDATA:\n';
    const at = contents.indexOf(marker);
    return JSON.parse(contents.slice(at + marker.length));
}

console.log('\nparseTargetCount — how many dishes the user asked for');

check('"4 meals" reads as 4', parseTargetCount('4 meals'), 4);
check('"3 dinners" reads as 3', parseTargetCount('3 dinners'), 3);
check('the count and unit may sit inside a sentence', parseTargetCount('plan me 5 dishes please'), 5);
check('"recipes" is accepted too', parseTargetCount('2 recipes'), 2);
check('"days" is accepted too', parseTargetCount('7 days of food'), 7);
check('the lower bound is inclusive', parseTargetCount('1 meal'), 1);
check('the upper bound is inclusive', parseTargetCount('20 meals'), 20);
check('a count above 20 is refused, not clamped', parseTargetCount('21 meals'), null);
check('zero is not a valid count', parseTargetCount('0 meals'), null);
check('a three-digit count is not matched at all', parseTargetCount('100 meals'), null);
check('the unit word must follow the number', parseTargetCount('meals for 4 people'), null);
check('a lone number with no unit word is not a count', parseTargetCount('4'), null);
check('text with no number at all returns null', parseTargetCount('something light and quick'), null);
check('an empty string returns null', parseTargetCount(''), null);
check('null is handled', parseTargetCount(null), null);
check('undefined is handled', parseTargetCount(undefined), null);

console.log('\nREJECTION_REASONS — the strings the reject buttons send back');

check('the list is exactly the five the UI serves', REJECTION_REASONS, [
    'Too heavy',
    'Had this recently',
    'Not feeling it',
    'Too much effort',
    'Wrong season',
]);

console.log('\nproposeDish — the request it sends');

reset();
reply.body = { text: JSON.stringify({ source: 'library', libraryIndex: 1, reasoning: 'A lighter option.' }) };
await proposeDish({ constraints: 'something light', libraryShortlist: LIBRARY });
check('the request goes to the Gemini proxy function', calls[0].url, '/.netlify/functions/gemini');
check('the model is pinned', calls[0].body.model, 'gemini-2.5-flash');
check('the response is requested as JSON', calls[0].body.config.responseMimeType, 'application/json');
check('the output-token budget is pinned', calls[0].body.config.maxOutputTokens, 4096);

const sentSchema = calls[0].body.config.responseSchema;
check('source is required and pinned to library|generated', sentSchema.properties.source.enum, ['library', 'generated']);
check('only source and reasoning are required', sentSchema.required, ['source', 'reasoning']);
check('libraryIndex is a nullable integer', [sentSchema.properties.libraryIndex.type, sentSchema.properties.libraryIndex.nullable], ['integer', true]);
check('recipe is nullable (a library pick carries no body)', sentSchema.properties.recipe.nullable, true);
check('the nested recipe is the shared RECIPE_SCHEMA, not a drifted copy',
    JSON.stringify(sentSchema.properties.recipe) === JSON.stringify({ ...RECIPE_SCHEMA, nullable: true }), true);
check('...with every required recipe field intact', sentSchema.properties.recipe.required, RECIPE_SCHEMA.required);

const sentPrompt = calls[0].body.contents;
check('no {{UNIT_INSTRUCTION}} placeholder survives into the prompt', sentPrompt.includes('{{UNIT_INSTRUCTION}}'), false);
check('the substituted text is the unit-preference instruction', sentPrompt.includes(UNIT_SYSTEM_INSTRUCTIONS.metric), true);
check('...which is the metric one with no stored preference (node has none)', sentPrompt.includes('metric units only'), true);
check('the constraints are carried in the DATA payload', sentPayload().constraints, 'something light');
check('the library shortlist is passed through', sentPayload().libraryShortlist.length, 3);
check('acceptedDishes defaults to an empty array', sentPayload().acceptedDishes, []);
check('rejectedForThisSlot defaults to an empty array', sentPayload().rejectedForThisSlot, []);
check('forceGenerated defaults to false', sentPayload().forceGenerated, false);
check('an absent customRequest becomes null', sentPayload().customRequest, null);

reset();
reply.body = { text: JSON.stringify({ source: 'generated', recipe: { title: 'Lamb Curry' }, reasoning: 'Invented.' }) };
await proposeDish({
    constraints: '',
    acceptedDishes: [{ title: 'White Chicken Chili' }],
    rejectedForThisSlot: [{ title: 'Stew', reason: 'Too heavy' }],
    libraryShortlist: LIBRARY,
    forceGenerated: 1,
    customRequest: '   something with lamb   ',
});
const forced = sentPayload();
check('forceGenerated is coerced to a real boolean', [forced.forceGenerated, typeof forced.forceGenerated], [true, 'boolean']);
check('customRequest is trimmed', forced.customRequest, 'something with lamb');
check('acceptedDishes is passed through', forced.acceptedDishes.length, 1);
check('rejectedForThisSlot is passed through', forced.rejectedForThisSlot.length, 1);
check('constraints default to the empty string', forced.constraints, '');

reset();
reply.body = { text: JSON.stringify({ source: 'generated', reasoning: 'No ask given.' }) };
await proposeDish({ constraints: 'x', libraryShortlist: LIBRARY, customRequest: '   ' });
check('a whitespace-only customRequest is null, not ""', sentPayload().customRequest, null);

console.log('\nproposeDish — the answer it maps back onto a library row');

reset();
reply.body = { text: JSON.stringify({ source: 'library', libraryIndex: 0, reasoning: 'First pick fits.' }) };
let out = await caught(() => proposeDish({ constraints: 'x', libraryShortlist: LIBRARY }));
check('index 0 resolves to the FIRST library row, not the second', out.value.recipeId, LIBRARY[0].id);
check('index 0 does not off-by-one onto index 1', out.value.recipeId !== LIBRARY[1].id, true);

reset();
reply.body = { text: JSON.stringify({ source: 'library', libraryIndex: 2, reasoning: 'Third fits.' }) };
out = await caught(() => proposeDish({ constraints: 'x', libraryShortlist: LIBRARY }));
check('index 2 resolves to the third row', out.value.recipeId, LIBRARY[2].id);

reset();
reply.body = { text: JSON.stringify({ source: 'library', libraryIndex: 9, reasoning: 'Out of range.' }) };
out = await caught(() => proposeDish({ constraints: 'x', libraryShortlist: LIBRARY }));
check('an out-of-range index degrades to a null recipeId, not a crash', out.value.recipeId, null);

reset();
reply.body = { text: JSON.stringify({ source: 'generated', libraryIndex: 1, reasoning: 'Invented.' }) };
out = await caught(() => proposeDish({ constraints: 'x', libraryShortlist: LIBRARY }));
check('a generated dish never picks up a library id', out.value.recipeId, null);

reset();
reply.body = { text: JSON.stringify({ source: 'library', libraryIndex: 1, reasoning: 'Fits.' }) };
out = await caught(() => proposeDish({ constraints: 'x' }));
check('a missing shortlist yields a null recipeId rather than throwing', out.value.recipeId, null);

reset();
reply.body = { text: JSON.stringify({ source: 'generated', recipe: { title: 'Lamb Curry' }, reasoning: 'A Thai nod.' }) };
out = await caught(() => proposeDish({ constraints: 'x', libraryShortlist: LIBRARY }));
check('the returned recipe body is passed through', out.value.recipe.title, 'Lamb Curry');
check('the reasoning is passed through', out.value.reasoning, 'A Thai nod.');

reset();
reply.body = { text: JSON.stringify({ source: 'generated' }) };
out = await caught(() => proposeDish({ constraints: 'x', libraryShortlist: LIBRARY }));
check('a missing recipe becomes null, not undefined', out.value.recipe, null);
check('a missing reasoning becomes the empty string', out.value.reasoning, '');

console.log('\nproposeDish — error paths');

reset();
reply.body = { text: '' };
out = await caught(() => proposeDish({ constraints: 'x', libraryShortlist: LIBRARY }));
check('an empty model response throws', out.threw, true);
check('...with the empty-response message', out.message, 'The AI returned an empty response.');

reset();
reply.body = { text: '```json\n' + JSON.stringify({ source: 'generated', reasoning: 'Fenced.' }) + '\n```' };
out = await caught(() => proposeDish({ constraints: 'x', libraryShortlist: LIBRARY }));
check('a fenced model response is unwrapped before parsing', out.value.reasoning, 'Fenced.');

reset();
reply.ok = false;
reply.status = 500;
reply.body = { error: 'AI request failed (500).' };
out = await caught(() => proposeDish({ constraints: 'x', libraryShortlist: LIBRARY }));
check('a proxy failure is re-thrown through describeApiError', out.message, 'AI request failed (500).');

reset();
throwOnFetch = true;
out = await caught(() => proposeDish({ constraints: 'x', libraryShortlist: LIBRARY }));
check('an unreachable function says so', out.message, "Couldn't reach the AI service. Check your connection and try again.");

// ───────────────────────────────────────────────────────────────────────────────────────────────
console.log('');
if (failures) {
    console.log(`${failures} FAILED`);
    process.exit(1);
}
console.log('all checks passed');
