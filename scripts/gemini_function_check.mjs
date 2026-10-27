/**
 * gemini-function checks — `node scripts/gemini_function_check.mjs`
 *
 * WHY THIS EXISTS
 * `netlify/functions/gemini.js` is the server-side Gemini proxy. It is the only place
 * `GEMINI_API_KEY` is read, and it is the whole reason the key is not in the client bundle —
 * the module's own header says so. Every AI call the app makes (capture, dish curation, week
 * planning, URL capture's second hop) passes through it.
 *
 * THE GAP, MEASURED, NOT ASSUMED
 * At every remote head, `git grep -l -- "functions/gemini.js"` over `scripts/*_check.mjs` returns
 * only prose: `chore/gemini-client-check`'s `gemini_client_check.mjs` names the file in a comment
 * and then says, in its own words, that it "does not exercise `netlify/functions/gemini.js`". The
 * import count is the proof: `grep -c "from '../netlify/functions/gemini.js'"` across all 24
 * distinct check scripts is **0**. The sibling function `netlify/functions/fetch-recipe.js` *is*
 * imported directly by `fetch_recipe_check.mjs`, so this is a one-function hole, not a policy.
 *
 * WHAT THIS SUITE PINS — the branches the function owns, none of which any other script reaches:
 *   - the method guard: a non-POST is refused 405 *before* anything else runs (the ordering is
 *     asserted, because a keyless server must still answer 405 to a GET, not 500).
 *   - the JSON guard: an unparseable body is 400 'Invalid JSON body.'
 *   - the input guard: `model` and `contents` are both required, and `contents: null` counts as
 *     missing (`contents == null` — the loose comparison is deliberate and is what is pinned).
 *   - the success path: 200, `{ text }`, and the SDK call arguments forwarded *unchanged* —
 *     `model`, `contents` (string OR parts array with inlineData) and `config` (the responseSchema
 *     carrier) compared structurally, not by identity.
 *   - `response.text ?? ''`: a null text must not surface as `null`.
 *   - the error path: the SDK throwing surfaces as 500 carrying `err.message`, and a thrown
 *     non-Error surfaces via `String(err)`.
 *   - the missing-key path: 500 with the exact message the module documents, and **no client
 *     constructed** — the key is read from `process.env` at module load, so this is asserted by
 *     loading a second instance with the variable absent.
 *   - that no response body ever contains the key.
 *
 * HOW THE MODULE IS LOADED, AND WHY IT IS NOT A CHEAT
 * `@google/genai` is redirected, via `registerHooks`, to an in-memory stand-in (`data:` URL). The
 * module under test is the real file, unmodified. Two instances are loaded because the API key is
 * read once at load time: `...gemini.js?withkey=1` with `GEMINI_API_KEY` set, and
 * `...gemini.js?nokey=1` with it deleted. The query string is what makes Node treat them as two
 * module instances; the hook resolves both to the same file.
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * Nothing here says whether Netlify routes `/.netlify/functions/gemini`, whether `GEMINI_API_KEY`
 * is set in the Netlify environment, whether the real SDK accepts the payload, or what Google
 * replies. It is a node-level logic check: no network, no database, no deployment.
 *
 * NEGATIVE CONTROL (run it before trusting a clean result): copy `netlify/` and `scripts/` into a
 * scratch directory, break one thing in the copy's `netlify/functions/gemini.js`, and re-run this
 * file from there. Controls measured on this branch, 2026-10-14, each mutating *logic* and not a
 * comment (clean run: **43 ok / 0 FAIL, exit 0**; the unmutated copy re-run from the same scratch
 * layout gives the identical 43/0 and exit 0, so a red control cannot be blamed on the copy):
 *   - `jsonResponse(405, …)` -> `jsonResponse(200, …)`          -> 41 ok / 2 FAIL, exit 1
 *   - `if (!model || contents == null)` -> `if (false)`         -> 36 ok / 7 FAIL, exit 1
 *   - `generateContent({ model, contents, config })` -> without `config` -> 39 ok / 4 FAIL, exit 1
 *   - `response.text ?? ''` -> `response.text`                  -> 42 ok / 1 FAIL, exit 1
 *   - `err?.message ?? String(err)` -> `'upstream failed'`      -> 41 ok / 2 FAIL, exit 1
 *   - `if (!ai)` -> `if (false)`                                -> 42 ok / 1 FAIL, exit 1
 * A restored copy is green again.
 *
 * Plain script, non-zero exit on failure — same shape as `scripts/task07_check.mjs`.
 */
import { registerHooks } from 'node:module';

// A recording stand-in for `@google/genai`. `state` is a single mutable object so the test can
// choose the reply or make `generateContent` throw, and read back every argument it was handed.
const GENAI_STUB_URL = 'data:text/javascript,' + encodeURIComponent([
    'export const state = { ctorArgs: [], calls: [], reply: { text: "HELLO" }, throwWith: null };',
    'export class GoogleGenAI {',
    '    constructor(opts) { state.ctorArgs.push(opts); }',
    '    get models() {',
    '        return {',
    '            generateContent: async (args) => {',
    '                state.calls.push(args);',
    '                if (state.throwWith !== null) throw state.throwWith;',
    '                return state.reply;',
    '            },',
    '        };',
    '    }',
    '}',
].join('\n'));

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === '@google/genai') {
            return { url: GENAI_STUB_URL, shortCircuit: true };
        }
        // The app's own imports are extensionless; Vite resolves them, bare Node does not.
        if (specifier.startsWith('.') && !/\.[cm]?js(\?|$)/.test(specifier)) {
            return nextResolve(`${specifier}.js`, context);
        }
        return nextResolve(specifier, context);
    },
});

const KEY = 'test-key-not-a-secret';

process.env.GEMINI_API_KEY = KEY;
const modWithKey = await import('../netlify/functions/gemini.js?withkey=1');
const ctorArgsAfterImport = (await import(GENAI_STUB_URL)).state.ctorArgs.length;

delete process.env.GEMINI_API_KEY;
const modWithoutKey = await import('../netlify/functions/gemini.js?nokey=1');
process.env.GEMINI_API_KEY = KEY;

const stub = await import(GENAI_STUB_URL);
const handler = modWithKey.default;
const keylessHandler = modWithoutKey.default;

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

/** A stand-in for the Netlify v2 request object: only `.method` and `.json()` are touched. */
function request(method, body, { badJson = false } = {}) {
    return {
        method,
        json: async () => {
            if (badJson) throw new SyntaxError('Unexpected token < in JSON at position 0');
            return body;
        },
    };
}

/** Read a Response once: status, content-type and the parsed body. */
async function read(res) {
    return {
        isResponse: res instanceof Response,
        status: res.status,
        contentType: res.headers?.get?.('Content-Type'),
        body: await res.json(),
    };
}

function resetStub() {
    stub.state.calls.length = 0;
    stub.state.reply = { text: 'HELLO' };
    stub.state.throwWith = null;
}

console.log('the module under test');

check('the default export is a function', typeof handler, 'function');
check('the default export is the only export', Object.keys(modWithKey), ['default']);
check('the keyless instance also exports a function', typeof keylessHandler, 'function');
check(
    'a client is constructed at load time when GEMINI_API_KEY is set',
    ctorArgsAfterImport,
    1,
);
check(
    'the client is constructed with the server env key',
    stub.state.ctorArgs[0],
    { apiKey: KEY },
);

console.log('\nthe method guard (asserted before the key check)');

resetStub();
const get = await read(await handler(request('GET')));
check('a GET returns 405', get.status, 405);
check('a GET says to use POST', get.body, { error: 'Use POST with a JSON body.' });
check('the reply is a real Response', get.isResponse, true);
check('the reply is JSON', get.contentType, 'application/json');
check(
    'a GET on a keyless server is still 405, not 500 (guard order)',
    (await read(await keylessHandler(request('GET')))).status,
    405,
);
check('a GET never reaches the SDK', stub.state.calls.length, 0);

console.log('\nthe input guards');

resetStub();
const badJson = await read(await handler(request('POST', null, { badJson: true })));
check('an unparseable body returns 400', badJson.status, 400);
check('an unparseable body says so', badJson.body, { error: 'Invalid JSON body.' });
check('an unparseable body never reaches the SDK', stub.state.calls.length, 0);

resetStub();
const empty = await read(await handler(request('POST', {})));
check('an empty body returns 400', empty.status, 400);
check(
    'an empty body names both required fields',
    empty.body,
    { error: 'model and contents are required.' },
);

resetStub();
const noModel = await read(await handler(request('POST', { contents: 'hi' })));
check('a missing model returns 400', noModel.status, 400);
check('a missing model never reaches the SDK', stub.state.calls.length, 0);

resetStub();
const nullContents = await read(await handler(request('POST', { model: 'gemini-2.5-flash', contents: null })));
check('a null contents returns 400 (the loose `== null` is pinned)', nullContents.status, 400);
check('a null contents never reaches the SDK', stub.state.calls.length, 0);

resetStub();
const undefinedBody = await read(await handler(request('POST', undefined)));
check('an undefined body returns 400, not a crash', undefinedBody.status, 400);

console.log('\nthe success path');

resetStub();
const ok = await read(await handler(request('POST', { model: 'gemini-2.5-flash', contents: 'hi' })));
check('a valid POST returns 200', ok.status, 200);
check('a valid POST returns { text } and names the provider', ok.body, { text: 'HELLO', provider: 'gemini' });
check('the SDK is called exactly once', stub.state.calls.length, 1);
check('the SDK receives the model unchanged', stub.state.calls[0].model, 'gemini-2.5-flash');
check('the SDK receives the contents unchanged', stub.state.calls[0].contents, 'hi');
check(
    'the SDK call carries exactly model/contents/config, nothing added or dropped',
    Object.keys(stub.state.calls[0]).sort(),
    ['config', 'contents', 'model'],
);
check('an omitted config is still forwarded as an explicit key', 'config' in stub.state.calls[0], true);
check('an omitted config stays undefined', stub.state.calls[0].config, undefined);
check('no response body carries the key', JSON.stringify(ok.body).includes(KEY), false);

resetStub();
const schema = {
    type: 'object',
    properties: { title: { type: 'string' }, ingredients: { type: 'array', items: { type: 'string' } } },
    required: ['title'],
};
const structured = await read(await handler(request('POST', {
    model: 'gemini-2.5-flash',
    contents: 'extract this',
    config: { responseSchema: schema, responseMimeType: 'application/json' },
})));
check('a structured-output request returns 200', structured.status, 200);
check(
    'the responseSchema is forwarded structurally identical',
    stub.state.calls[0].config,
    { responseSchema: schema, responseMimeType: 'application/json' },
);
check(
    'the forwarded schema survives the round trip structurally',
    stub.state.calls[0].config?.responseSchema,
    schema,
);

resetStub();
const parts = [
    { text: 'what is in this photo?' },
    { inlineData: { mimeType: 'image/jpeg', data: 'BASE64PAYLOAD' } },
];
const withImage = await read(await handler(request('POST', { model: 'gemini-2.5-flash', contents: parts })));
check('an image request returns 200', withImage.status, 200);
check('a parts array is forwarded structurally identical', stub.state.calls[0].contents, parts);

resetStub();
stub.state.reply = { text: null };
const nullText = await read(await handler(request('POST', { model: 'gemini-2.5-flash', contents: 'hi' })));
check('a null text is returned as an empty string', nullText.body, { text: '', provider: 'gemini' });

console.log('\nthe error path');

resetStub();
stub.state.throwWith = new Error('boom from the SDK');
const threw = await read(await handler(request('POST', { model: 'gemini-2.5-flash', contents: 'hi' })));
check('an SDK failure returns 500', threw.status, 500);
check('an SDK failure surfaces its message', threw.body, { error: 'boom from the SDK' });

resetStub();
stub.state.throwWith = 'kaput';
const threwString = await read(await handler(request('POST', { model: 'gemini-2.5-flash', contents: 'hi' })));
check('a thrown non-Error returns 500', threwString.status, 500);
check('a thrown non-Error is stringified', threwString.body, { error: 'kaput' });

console.log('\nthe missing-key path');

const ctorBeforeKeyless = stub.state.ctorArgs.length;
const noKey = await read(await keylessHandler(request('POST', { model: 'gemini-2.5-flash', contents: 'hi' })));
check('a POST without a key returns 500', noKey.status, 500);
check(
    'a POST without a key names the missing variable',
    noKey.body,
    { error: 'No AI provider is configured on the server. Set OPENROUTER_API_KEY (preferred) or GEMINI_API_KEY in the Netlify environment.' },
);
check('no client is constructed without a key', stub.state.ctorArgs.length, ctorBeforeKeyless);

console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
