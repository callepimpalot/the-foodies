/**
 * Gemini-proxy client checks — `node scripts/gemini_client_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/lib/geminiClient.js` is the single client every AI feature in the app goes through —
 * capture extraction, dish curation, the week planner. Since PR #4 moved the Gemini key
 * server-side, this file is the *only* thing standing between the browser code and
 * `netlify/functions/gemini.js`: it owns the proxy path, the request shape the function
 * destructures, and every user-facing error message the AI features show.
 *
 * Measured, not assumed: `git grep -l -- "lib/geminiClient"` across every remote head
 * (main + all 26 PR heads at the time of writing) returns NO `scripts/*_check.mjs`. It ships
 * live in production and had no suite of its own. `scripts/env_boundary_check.mjs` asserts that
 * the *key* stays server-side (a text check on the source); nothing asserted that the *client*
 * still talks to the function correctly.
 *
 * The module is a leaf — it imports nothing from the app — so it is imported directly, the same
 * rule that lets scripts/image_utils_check.mjs and pantry_items_check.mjs skip the resolution hook.
 *
 * WHAT IT ASSERTS, AND WHY EACH THING MATTERS
 *   - the request it makes. The path `/.netlify/functions/gemini` is the entire contract with the
 *     function; a typo here means every AI call 404s and the app falls back to its offline
 *     heuristics with no error anyone would connect to this file. Method, the JSON content type,
 *     and the exact `{ model, contents, config }` body are each asserted — a refactor that drops
 *     `config` would silently lose the schema/response-shaping the callers rely on. Config is
 *     compared structurally, not by identity (a stubbed fetch reads a *clone*).
 *   - the success path resolves to `body.text` and nothing else — callers parse that string.
 *   - the documented failure messages. Each is a distinct, user-visible string that names a
 *     different cause (offline, wrong dev server, unreadable reply, a proxy-reported error, a bare
 *     HTTP status). A regression here shows the wrong advice or crashes instead.
 *   - `… .get('content-type') ?? ''` — the missing-header case. A response with NO content-type
 *     header must still produce the friendly "use netlify dev" message; drop the `?? ''` and
 *     `.includes` is called on `null`, turning a helpful message into a TypeError.
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * This is a node-level contract check with `globalThis.fetch` stubbed. It proves what the client
 * *sends* and what it *does with a reply* — it does not exercise `netlify/functions/gemini.js`,
 * does not prove the key is absent from the deployed bundle (env_boundary_check does that), and
 * cannot reach the real Gemini service. The stub is the contract; the function is not exercised.
 *
 * NEGATIVE CONTROL (run it before trusting a clean result — each must turn the suite red):
 *   cp -r src scripts <scratch>/ctl && cd <scratch>/ctl
 *   # 1. break the proxy path — the boundary assertion fails
 *   sed -i "s#/.netlify/functions/gemini#/functions/gemini#" src/lib/geminiClient.js
 *   node scripts/gemini_client_check.mjs
 *   # 2. drop the content-type fallback — the missing-header case now TypeErrors
 *   sed -i "s/?? ''//" src/lib/geminiClient.js
 *   # 3. stop honouring a proxy-reported error on an OK response
 *   sed -i "s/!response.ok || body?.error/!response.ok/" src/lib/geminiClient.js
 *   # 4. stop catching a thrown fetch — the offline case leaks the raw error
 *   sed -i "s/} catch {/} catch (e) { throw e; /" src/lib/geminiClient.js
 * Each of the four was run against this suite on the branch and turns it red (see the PR body).
 *
 * Plain script, non-zero exit on failure — same shape as scripts/task07_check.mjs and
 * scripts/image_utils_check.mjs.
 */

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

async function caught(fn) {
    try {
        const value = await fn();
        return { threw: false, message: null, value };
    } catch (err) {
        return { threw: true, message: err?.message ?? String(err), value: null };
    }
}

// ── the fetch stub, made controllable and reset per case ────────────────────────────────────────
// `fetchCalls` records what the client actually sent; `reply` is a function producing the response
// (or throwing). Both are reset at the top of every case so no assertion can pass on stale state.
let fetchCalls = [];
let reply = null;

globalThis.fetch = async (url, opts) => {
    fetchCalls.push({ url, opts });
    return reply(url, opts);
};

// A response whose only contract is what geminiClient reads off it: ok, status, headers.get, json().
function response({ status = 200, body = {}, contentType = 'application/json', jsonThrows = false } = {}) {
    const headers = {};
    if (contentType !== null) headers['content-type'] = contentType;
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (k) => headers[String(k).toLowerCase()] ?? null },
        json: async () => {
            if (jsonThrows) throw new Error('not json');
            return body;
        },
    };
}

function reset() {
    fetchCalls = [];
    reply = () => response({ body: { text: '' } });
}

// A fresh object every call, so an assertion can never be satisfied by an earlier reference.
const sampleConfig = () => ({
    responseMimeType: 'application/json',
    responseSchema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
});

const { geminiGenerateContent } = await import('../src/lib/geminiClient.js');

console.log('\nthe request the client makes — the contract with netlify/functions/gemini.js');

reset();
await caught(() => geminiGenerateContent({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: 'hi' }] }], config: sampleConfig() }));
check('exactly one request is made per call (no hidden retry)', fetchCalls.length, 1);
check('it posts to the proxy path, not directly to Google', fetchCalls[0]?.url, '/.netlify/functions/gemini');
check('...with method POST', fetchCalls[0]?.opts?.method, 'POST');
check('...declaring a JSON request body', fetchCalls[0]?.opts?.headers?.['Content-Type'], 'application/json');

const sent = JSON.parse(fetchCalls[0]?.opts?.body ?? 'null');
check('the body carries model, contents and config — nothing else', Object.keys(sent ?? {}).sort(), ['config', 'contents', 'model']);
check('the model name is passed through', sent?.model, 'gemini-2.5-flash');
check('the contents are passed through', sent?.contents, [{ parts: [{ text: 'hi' }] }]);
// Structural, not identity: a stubbed fetch reads a clone, so `===` on the schema would always be false.
check('the caller\'s config survives the round trip byte-for-byte', JSON.stringify(sent?.config), JSON.stringify(sampleConfig()));
check('...including a nested responseSchema', sent?.config?.responseSchema?.required, ['title']);

reset();
await caught(() => geminiGenerateContent({ model: 'm', contents: [], config: {} }));
const bare = JSON.parse(fetchCalls[0]?.opts?.body ?? 'null');
check('an absent/empty config is still sent as a field, not omitted', Object.keys(bare ?? {}).sort(), ['config', 'contents', 'model']);
check('...as an empty object', bare?.config, {});

console.log('\nthe success path');

reset();
reply = () => response({ body: { text: 'extracted recipe text' } });
let ok = await caught(() => geminiGenerateContent({ model: 'm', contents: [], config: {} }));
check('a 200 with text resolves', ok.threw, false);
check('...to body.text and nothing else (callers parse that string)', ok.value, 'extracted recipe text');

reset();
reply = () => response({ body: { text: '' } });
ok = await caught(() => geminiGenerateContent({ model: 'm', contents: [], config: {} }));
check('an empty reply resolves to an empty string rather than throwing', ok.value, '');

reset();
reply = () => response({ body: { text: 'x', extra: 'ignored' } });
ok = await caught(() => geminiGenerateContent({ model: 'm', contents: [], config: {} }));
check('extra fields in the reply are ignored — only text is returned', ok.value, 'x');

console.log('\nthe documented failure messages');

reset();
reply = () => { throw new Error('ECONNREFUSED'); };
let bad = await caught(() => geminiGenerateContent({ model: 'm', contents: [], config: {} }));
check('a thrown fetch is caught, not propagated', bad.threw, true);
check('...and becomes the offline message', bad.message, "Couldn't reach the AI service. Check your connection and try again.");

reset();
reply = () => response({ contentType: 'text/html; charset=utf-8', body: {} });
bad = await caught(() => geminiGenerateContent({ model: 'm', contents: [], config: {} }));
check('a non-JSON reply (a bare dev server answering /) names the netlify-dev fix', bad.message, "The AI service isn't available here. If you're running `npm run dev`, use `netlify dev` so Netlify Functions are served locally.");

reset();
reply = () => response({ contentType: null, body: {} });
bad = await caught(() => geminiGenerateContent({ model: 'm', contents: [], config: {} }));
check('a reply with NO content-type header takes the same path (the `?? \'\'` guard)', bad.threw, true);
check('...with the same message — not a TypeError', bad.message, "The AI service isn't available here. If you're running `npm run dev`, use `netlify dev` so Netlify Functions are served locally.");

reset();
reply = () => response({ jsonThrows: true });
bad = await caught(() => geminiGenerateContent({ model: 'm', contents: [], config: {} }));
check('a JSON content-type whose body will not parse is reported', bad.message, "Couldn't read the AI response.");

reset();
reply = () => response({ status: 500, body: { error: 'Model overloaded, try again.' } });
bad = await caught(() => geminiGenerateContent({ model: 'm', contents: [], config: {} }));
check('an HTTP error carrying the proxy\'s own message surfaces that message', bad.message, 'Model overloaded, try again.');

reset();
reply = () => response({ status: 502, body: {} });
bad = await caught(() => geminiGenerateContent({ model: 'm', contents: [], config: {} }));
check('an HTTP error with no message falls back to the status', bad.message, 'AI request failed (502).');

reset();
reply = () => response({ status: 429, body: null });
bad = await caught(() => geminiGenerateContent({ model: 'm', contents: [], config: {} }));
check('a null body on an error status does not crash the optional chain', bad.message, 'AI request failed (429).');

reset();
reply = () => response({ status: 200, body: { error: 'quota exceeded' } });
bad = await caught(() => geminiGenerateContent({ model: 'm', contents: [], config: {} }));
check('an error reported on an OK response still throws (the proxy\'s handled-error convention)', bad.message, 'quota exceeded');

reset();
reply = () => response({ status: 200, body: {} });
bad = await caught(() => geminiGenerateContent({ model: 'm', contents: [], config: {} }));
check('an OK response with no text resolves to undefined rather than throwing', [bad.threw, bad.value], [false, undefined]);

// ───────────────────────────────────────────────────────────────────────────────────────────────
console.log('');
if (failures) {
    console.log(`${failures} FAILED`);
    process.exit(1);
}
console.log('all checks passed');
