/**
 * OpenRouter proxy checks — `node scripts/openrouter_proxy_check.mjs`
 *
 * The app's AI calls were failing with "Gemini rate limit or quota reached" during
 * ordinary use. The fix routes them through OpenRouter while keeping the client contract
 * ({ model, contents, config } in, { text } out) exactly as it was, so three call sites
 * and the UI needed no changes at all.
 *
 * That is only safe if the translation is right, so this suite tests two things:
 *
 *   1. the pure translation (src/lib/openRouterRequest.js) — no network, no provider
 *   2. the REAL Netlify handler (netlify/functions/gemini.js) driven with a stubbed
 *      fetch — including the failure path, because the failure path is the one that was
 *      broken and the one a user actually sees
 *
 * The last section is the important one: it proves a 429 from OpenRouter still reaches the
 * user as the plain-English rate-limit sentence, rather than a wall of provider JSON.
 *
 * There is no test runner in this project and adding one would be a new build step, so
 * this is a plain script with a non-zero exit on failure — the shape task07_check.mjs uses.
 */
import { registerHooks } from 'node:module';
import pathlib from 'node:path';

const ROOT = pathlib.resolve(pathlib.dirname(new URL(import.meta.url).pathname), '..');

// The app's modules import each other without file extensions (Vite resolves that;
// plain node does not). Same hook the repo's other suites use — but keyed on "has no
// extension at all" rather than "does not end in .js", because the looser form rewrites
// node_modules' own `require('../../../package.json')` into `package.json.js` and dies.
registerHooks({
    resolve(spec, ctx, next) {
        if (spec.startsWith('.') && pathlib.extname(spec) === '') return next(`${spec}.js`, ctx);
        return next(spec, ctx);
    },
});

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
function assert(name, condition, detail = '') {
    if (condition) console.log(`  ok   ${name}`);
    else { failures += 1; console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ''}`); }
}

const {
    OPENROUTER_ENDPOINT,
    OPENROUTER_DEFAULT_MODEL,
    resolveModel,
    contentsToMessages,
    configToBodyFields,
    systemMessages,
    toOpenRouterBody,
    textFromOpenRouterResponse,
    openRouterFailure,
} = await import(pathlib.join(ROOT, 'src/lib/openRouterRequest.js'));

// Imported from the app itself, so the schema under test is the real one rather than a
// copy that could drift away from it.
const { describeApiError, RECIPE_SCHEMA } = await import(
    pathlib.join(ROOT, 'src/lib/recipeExtraction.js'));

/* -------------------------------------------------------------- 1. model mapping */

console.log('\nModel mapping');
check('the app\'s flash name maps to the namespaced id',
    resolveModel('gemini-2.5-flash'), 'google/gemini-2.5-flash');
check('pro maps through too', resolveModel('gemini-2.5-pro'), 'google/gemini-2.5-pro');
check('an OpenRouter id is passed through untouched',
    resolveModel('openai/gpt-4o-mini'), 'openai/gpt-4o-mini');
check('an unknown name falls back rather than failing',
    resolveModel('gpt-9-imaginary'), OPENROUTER_DEFAULT_MODEL);
check('a missing name falls back', resolveModel(undefined), OPENROUTER_DEFAULT_MODEL);

/* --------------------------------------------------------------- 2. contents -> messages */

console.log('\nContents translation');
check('a string becomes one user message',
    contentsToMessages('hello'), [{ role: 'user', content: 'hello' }]);

check('text + image becomes an image_url data uri', contentsToMessages([
    { text: 'read this' },
    { inlineData: { mimeType: 'image/png', data: 'AAAABBBB' } },
]), [{
    role: 'user',
    content: [
        { type: 'text', text: 'read this' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAABBBB' } },
    ],
}]);

check('a single text part flattens back to a plain string',
    contentsToMessages([{ text: 'only text' }]), [{ role: 'user', content: 'only text' }]);

check('snake_case inline_data is accepted too', contentsToMessages([
    { text: 'x' },
    { inline_data: { mime_type: 'image/jpeg', data: 'ZZZ' } },
]), [{
    role: 'user',
    content: [
        { type: 'text', text: 'x' },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,ZZZ' } },
    ],
}]);

check('a missing mimeType defaults rather than emitting "undefined"',
    contentsToMessages([{ text: 'x' }, { inlineData: { data: 'Q' } }])[0].content[1].image_url.url,
    'data:image/png;base64,Q');

check('a {role, parts} turn is handled',
    contentsToMessages({ role: 'user', parts: [{ text: 'hi' }] }),
    [{ role: 'user', content: 'hi' }]);

check('null contents yields no messages', contentsToMessages(null), []);

/* ---------------------------------------------------------------- 3. schema -> response_format */

console.log('\nStructured output');
const withSchema = configToBodyFields({
    responseMimeType: 'application/json',
    responseSchema: RECIPE_SCHEMA,
    maxOutputTokens: 8192,
});
check('the schema is sent as json_schema, NOT json_object',
    withSchema.response_format.type, 'json_schema');
check('and the app\'s schema rides through deep-equal, unmodified',
    withSchema.response_format.json_schema.schema, RECIPE_SCHEMA);
check('the schema is the object one, with its required list intact',
    [withSchema.response_format.json_schema.schema.type,
     withSchema.response_format.json_schema.schema.required.length], ['object', 7]);
check('nullable survives the trip (found via properties, not a top-level key)',
    withSchema.response_format.json_schema.schema.properties.creator.nullable, true);
check('strict is left false (the schema uses nullable)',
    withSchema.response_format.json_schema.strict, false);
check('maxOutputTokens maps to max_tokens', withSchema.max_tokens, 8192);
check('no schema but JSON mime -> json_object fallback',
    configToBodyFields({ responseMimeType: 'application/json' }).response_format.type, 'json_object');
check('neither -> no response_format at all',
    configToBodyFields({}).response_format, undefined);
check('temperature is passed through', configToBodyFields({ temperature: 0.2 }).temperature, 0.2);

console.log('\nSystem instruction + full body');
check('a string systemInstruction becomes a leading system message',
    systemMessages('be terse'), [{ role: 'system', content: 'be terse' }]);
check('no systemInstruction adds nothing', systemMessages(undefined), []);
const full = toOpenRouterBody({
    model: 'gemini-2.5-flash',
    contents: 'make a recipe',
    config: { responseSchema: RECIPE_SCHEMA, maxOutputTokens: 100, systemInstruction: 'sys' },
});
check('the full body puts system first, then user', full.messages.map((m) => m.role), ['system', 'user']);
check('and targets the mapped model', full.model, 'google/gemini-2.5-flash');

/* ------------------------------------------------------------------ 4. response -> text */

console.log('\nResponse translation');
check('string content', textFromOpenRouterResponse({ choices: [{ message: { content: 'hi' } }] }), 'hi');
check('array content is joined',
    textFromOpenRouterResponse({ choices: [{ message: { content: [{ text: 'a' }, { text: 'b' }] } }] }), 'ab');
check('a malformed response is empty, not a throw',
    textFromOpenRouterResponse({ nonsense: true }), '');

/* -------------------------------------------------------- 5. the REAL handler, stubbed */

console.log('\nThe real Netlify handler (stubbed fetch)');

const FN_PATH = pathlib.join(ROOT, 'netlify/functions/gemini.js');
const realFetch = globalThis.fetch;
let calls = [];
let nextReply = null;

function stubFetch() {
    globalThis.fetch = async (url, opts) => {
        calls.push({ url, body: JSON.parse(opts.body), headers: opts.headers });
        if (nextReply instanceof Error) throw nextReply;
        return nextReply;
    };
}

function jsonRes(status, obj) {
    return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

const req = (payload) => ({ method: 'POST', json: async () => payload });

/** Import a fresh copy of the handler — it reads process.env at module load. */
async function loadHandler(env) {
    for (const k of ['OPENROUTER_API_KEY', 'GEMINI_API_KEY']) delete process.env[k];
    Object.assign(process.env, env);
    return (await import(`${FN_PATH}?case=${Math.random()}`)).default;
}

// --- no provider configured at all
{
    const handler = await loadHandler({});
    const res = await handler(req({ model: 'gemini-2.5-flash', contents: 'x' }));
    const body = await res.json();
    check('no keys -> 500', res.status, 500);
    assert('and the message names both env vars',
        body.error.includes('OPENROUTER_API_KEY') && body.error.includes('GEMINI_API_KEY'), body.error);
}

// --- OpenRouter configured: the happy path
{
    calls = [];
    stubFetch();
    nextReply = jsonRes(200, {
        model: 'google/gemini-2.5-flash',
        choices: [{ message: { content: '{"title":"Tuscan Salmon"}' } }],
        usage: { total_tokens: 12 },
    });
    const handler = await loadHandler({ OPENROUTER_API_KEY: 'or-test-key' });
    const res = await handler(req({
        model: 'gemini-2.5-flash',
        contents: [{ text: 'extract this' }, { inlineData: { mimeType: 'image/png', data: 'QUJD' } }],
        config: { responseMimeType: 'application/json', responseSchema: RECIPE_SCHEMA, maxOutputTokens: 8192 },
    }));
    const body = await res.json();

    check('200', res.status, 200);
    check('{ text } comes back in the client\'s shape', body.text, '{"title":"Tuscan Salmon"}');
    check('exactly one upstream call', calls.length, 1);
    check('it went to OpenRouter', calls[0].url, OPENROUTER_ENDPOINT);
    check('the model was mapped', calls[0].body.model, 'google/gemini-2.5-flash');
    check('the key was sent as a bearer token',
        calls[0].headers.Authorization, 'Bearer or-test-key');
    check('the image survived as a data uri',
        calls[0].body.messages[0].content[1].image_url.url, 'data:image/png;base64,QUJD');
    check('the schema rode along as json_schema',
        calls[0].body.response_format.type, 'json_schema');
    globalThis.fetch = realFetch;
}

// --- the failure path that actually bit him
{
    calls = [];
    stubFetch();
    nextReply = jsonRes(429, { error: { message: 'Rate limit exceeded: free-models-per-day', code: 429 } });
    const handler = await loadHandler({ OPENROUTER_API_KEY: 'or-test-key' });
    const res = await handler(req({ model: 'gemini-2.5-flash', contents: 'x' }));
    const body = await res.json();

    check('a 429 is passed through as 429, not flattened to 500', res.status, 429);

    // The whole point: the app's own error handler must still recognise it.
    const err = new Error(body.error);
    err.status = res.status;
    const friendly = describeApiError(err);
    check('and the user still sees the plain-English rate-limit message',
        friendly.message, 'The AI is rate limited or out of quota — wait a minute and try again.');

    // Belt and braces: the nested error body alone carries the code, so the message holds
    // even on a path where the HTTP status never made it through.
    const errNoStatus = new Error(body.error);
    check('the same message holds from the error body alone, with no status attached',
        describeApiError(errNoStatus).message,
        'The AI is rate limited or out of quota — wait a minute and try again.');
    globalThis.fetch = realFetch;
}

// --- the proxy must not swallow a transport failure
{
    calls = [];
    stubFetch();
    nextReply = new Error('ECONNREFUSED');
    const handler = await loadHandler({ OPENROUTER_API_KEY: 'or-test-key' });
    const res = await handler(req({ model: 'gemini-2.5-flash', contents: 'x' }));
    const body = await res.json();
    check('a transport failure is a 502, not a 500', res.status, 502);
    assert('and says what could not be reached', body.error.includes('OpenRouter'), body.error);
    globalThis.fetch = realFetch;
}

// --- Gemini still behind it, so the app survives until the env var is added
{
    calls = [];
    stubFetch();
    const handler = await loadHandler({ GEMINI_API_KEY: 'gem-test-key' });
    const res = await handler(req({ model: 'gemini-2.5-flash', contents: 'x' }));
    // Note: this is NOT "no fetch happened" — @google/genai uses fetch internally too, so
    // the stub sees its attempt. The claim that matters is that nothing went to OpenRouter.
    const toOpenRouter = calls.filter((c) => c.url === OPENROUTER_ENDPOINT).length;
    check('with only GEMINI_API_KEY set, OpenRouter is NOT called', toOpenRouter, 0);
    assert('and the Gemini path was the one exercised (its own call went out)',
        calls.length >= 1, `no upstream call at all: ${JSON.stringify(calls.map((c) => c.url))}`);
    assert('and the handler took the Gemini branch, not the 400/405 guard',
        res.status === 500 || res.status === 200, `status ${res.status}`);
    globalThis.fetch = realFetch;
}

// --- OpenRouter wins when both are set
{
    calls = [];
    stubFetch();
    nextReply = jsonRes(200, { choices: [{ message: { content: 'ok' } }] });
    const handler = await loadHandler({ OPENROUTER_API_KEY: 'or', GEMINI_API_KEY: 'gem' });
    await handler(req({ model: 'gemini-2.5-flash', contents: 'x' }));
    check('with both keys, OpenRouter is preferred', calls.length, 1);
    globalThis.fetch = realFetch;
}

// --- bad input still rejected before any upstream call
{
    calls = [];
    stubFetch();
    const handler = await loadHandler({ OPENROUTER_API_KEY: 'or' });
    const r1 = await handler(req({ contents: 'x' }));
    check('missing model -> 400', r1.status, 400);
    const r2 = await handler(req({ model: 'gemini-2.5-flash' }));
    check('missing contents -> 400', r2.status, 400);
    const r3 = await handler({ method: 'GET', json: async () => ({}) });
    check('GET -> 405', r3.status, 405);
    check('and none of those reached the network', calls.length, 0);
    globalThis.fetch = realFetch;
}

/* --------------------------------------------------------------------------- done */

console.log('');
if (failures > 0) {
    console.log(`${failures} failure(s)\n`);
    process.exit(1);
}
console.log('all checks passed\n');
