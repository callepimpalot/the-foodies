/**
 * Fetch-recipe checks — `node scripts/fetch_recipe_check.mjs`
 *
 * WHY THIS EXISTS
 * `netlify/functions/fetch-recipe.js` is the URL-capture path: a browser cannot fetch a food blog
 * itself (CORS), so this Netlify Function fetches the page server-side, reads schema.org/Recipe
 * JSON-LD, maps it straight into the app's recipe draft shape, and — when there is no usable
 * JSON-LD — returns the page's readable text for the existing Gemini extraction path. It is also the
 * only *ingress* this app has: every URL or social link a user pastes goes through the SSRF guard and
 * the HTML reader here, so this file, not the client, decides what the server is willing to fetch.
 *
 * Measured, not assumed: at every remote head, `git grep -n -- "fetch-recipe" <ref> -- scripts/`
 * returns nothing, and the file at `src/scripts/checkJsonLdMapping.mjs` that its own header names as
 * its test is **not present on any branch** (`git grep -ln checkJsonLdMapping` across all refs: no
 * hits; `git ls-tree -r <ref> -- src/scripts`: empty). The header's claim was never true of this
 * repository as pushed — reported in the PR, not edited here, because this branch commits one file.
 *
 * WHAT IT ASSERTS, AND WHY EACH THING MATTERS
 *   - `isFetchableUrl`, the SSRF guard: only http/https, and none of localhost, 0.0.0.0, 127/8, 10/8,
 *     192.168/16, 172.16-31/12 or 169.254/16 (cloud metadata — `169.254.169.254` is the one that
 *     turns a URL-fetching endpoint into a credential leak). The 172.32 boundary is asserted too, so
 *     the range check cannot pass by over-matching everything with a `172.` prefix. Decimal, hex and
 *     octal encodings of 127.0.0.1 are asserted because `URL` normalises them before the guard runs.
 *   - **One real gap, pinned rather than papered over:** `URL.hostname` keeps the brackets on an IPv6
 *     literal, so `host === '::1'` can never match and `http://[::1]/`, `[::ffff:127.0.0.1]` and
 *     `[fd00::1]` all pass the guard. The assertions record the measured behaviour and the note is at
 *     the assertion; the fix is a one-line change this branch deliberately does not make.
 *   - `isSocialPostUrl`: instagram/tiktok/youtube/youtu.be and their subdomains, and NOT lookalikes —
 *     `notinstagram.com` and `instagram.com.evil.com` are the cases the `(^|\.)…$` anchoring exists for.
 *   - `socialIngestConfigured()`: both env vars required, so a half-configured deploy (only the URL, or
 *     only the token) leaves the social branch inert instead of half-running. The branch is documented
 *     as inert-by-default and this is the switch that decides it.
 *   - `buildSocialText`: the provenance line the extraction prompt relies on to fill `creator`, the
 *     creator/url trims, the CAPTION / SPOKEN TRANSCRIPT sections, and the 8000-char cap.
 *   - `extractJsonLdBlocks` / `findRecipeNode`: every block is parsed independently (one malformed
 *     block must not abort the extraction), the trailing-comma salvage, `@graph`, bare top-level
 *     arrays, `@type` as an array, first-Recipe-wins, and the null return that sends the caller down
 *     the fallback path.
 *   - `mapIngredients`: raw strings into the canonical `{name, quantity, unit}` shape — mixed numbers,
 *     unicode vulgar fractions, ranges, `null` (not `undefined`) quantity/unit, group headers dropped,
 *     and a non-array list becoming [] rather than throwing.
 *   - `flattenInstructions`: a string, an array of strings, `HowToStep` objects, and `HowToSection`
 *     nesting, with blank entries dropped — the four shapes real recipe plugins emit.
 *   - `extractImageUrl`: string, array and `ImageObject` forms, and null for a bare `@id` reference.
 *   - `mapRecipeNode`: the whole 11-field draft, and the three nulls (no ingredients / no steps / no
 *     title) that are what makes the caller fall back to Gemini instead of showing a half-empty recipe.
 *     Plus the documented defaults — 30 minutes, 4 servings, 'Dinner' — and the difficulty thresholds
 *     the file says match the Gemini prompt in `src/lib/recipeExtraction.js`.
 *   - `extractReadableText` / `extractHtmlTitle`: script/style/nav chrome stripped, `<body>` extracted,
 *     entities decoded (named and numeric), the 15000-char cap, and '' for non-string input.
 *   - the handler end to end with `fetch` stubbed: 405 / 400 (missing) / 400 (unfetchable, asserted to
 *     issue **no** request at all) / 502 for an upstream error, with the "may be broken or moved" suffix
 *     only on 404 / 415 for a non-HTML content type / 504 on an abort / 502 on a network throw / 200
 *     `source: 'jsonld'` with the image URL / 422 when the readable text is too thin to be worth
 *     sending to Gemini / 200 `source: 'fallback'` with `pageText`, `pageTitle` and `source_url`, which
 *     is the shape the client already consumes. The request headers (the documented UA and Accept) are
 *     asserted because a stripped UA is how recipe sites start returning 403 to this function.
 *   - the social branch through the handler: with the env vars unset the page is fetched normally and
 *     the ingest service is never called; with them set the post is POSTed to `<base>/ingest` (trailing
 *     slash stripped) as `{url, deep:false}` with a `Bearer` token; 200 comes back in the *same* shape
 *     as the generic fallback, so the client needs no new code path; and the 422 / 502 / 504 arms fire
 *     on an empty caption+transcript, an upstream failure and a timeout respectively.
 *
 * HOW IT IS LOADED, AND WHY IT IS NOT A CHEAT
 * The module under test is imported for real — no copy, no re-implementation. It needs no hooks: it
 * imports only `parse-ingredient` (2.2.0, a real dependency) and reads `process.env` at call time, so
 * bare Node runs it as-is. The handler's `fetch` is stubbed (the only way to exercise HTTP branches
 * offline); every other assertion calls the real exported function.
 *
 * NEGATIVE CONTROL (run it before trusting a clean result): copy `netlify/` and `scripts/` to a scratch
 * directory, break one thing in the copy's `netlify/functions/fetch-recipe.js`, and re-run this file
 * from there. Controls measured on this branch, 2026-10-13, each mutating *logic* rather than a
 * comment, each going red and leaving the rest of the file running (clean run: **152 ok / 0 FAIL,
 * exit 0**, and an unmutated copy of the same tree is 152 ok / 0 FAIL):
 *   - the `169.254.` metadata guard deleted                        -> 151 ok / 1 FAIL, exit 1
 *   - the http/https scheme test forced to `if (false)`            -> 150 ok / 2 FAIL, exit 1
 *   - the `youtu.be` host pattern deleted                          -> 151 ok / 1 FAIL, exit 1
 *   - `socialIngestConfigured`'s `&&` changed to `||`              -> 149 ok / 3 FAIL, exit 1
 *   - the difficulty boundary `<= 40` changed to `< 40`            -> 151 ok / 1 FAIL, exit 1
 *   - `if (!ingredients.length) return null;` deleted              -> 151 ok / 1 FAIL, exit 1
 *   - the nav/header/footer/aside/form strip narrowed to a
 *     tag that never matches                                      -> 150 ok / 2 FAIL, exit 1
 *   - `buildSocialText`'s `.slice(0, SOCIAL_TEXT_LENGTH_CAP)`
 *     widened past the cap                                        -> 151 ok / 1 FAIL, exit 1
 *   - the handler's `if (!isFetchableUrl(requestedUrl))` disabled  -> 150 ok / 2 FAIL, exit 1
 *   - `parseServings(...) ?? DEFAULT_SERVINGS` changed to `?? 0`   -> 149 ok / 3 FAIL, exit 1
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * This is a node-level logic check. It contacts nothing: no network, no database, no deployment. It
 * says nothing about whether Netlify routes `/.netlify/functions/fetch-recipe`, whether the social
 * ingest service on the VPS is reachable or answers in the shape assumed here, or how a real recipe
 * site's HTML is served. It also cannot prove the SSRF guard is sufficient — it pins which forms are
 * refused today, including the IPv6 forms that are not.
 *
 * Plain script, non-zero exit on failure — same shape as scripts/task07_check.mjs.
 */
import handler, {
    isFetchableUrl, isSocialPostUrl, socialIngestConfigured, buildSocialText,
    extractJsonLdBlocks, findRecipeNode, mapIngredients, flattenInstructions,
    extractImageUrl, mapRecipeNode, extractReadableText, extractHtmlTitle,
} from '../netlify/functions/fetch-recipe.js';

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

// ── HTTP stub ──────────────────────────────────────────────────────────────────────────────────
// One stub for the whole run, replaced only through `queue`/`setReply`. Anything the handler fetches
// is recorded in `calls`, which is how "the guard refused before any request was made" is asserted.
let calls = [];
let queue = [];
let reply = null;
let stubRestored = false;

function stubFetch(url, opts) {
    calls.push({ url: String(url), opts: opts ?? {} });
    const next = queue.length ? queue.shift() : reply;
    if (typeof next === 'function') return next(url, opts);
    return next;
}
globalThis.fetch = stubFetch;

function pageResponse(html, contentType = 'text/html; charset=utf-8', status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (k) => (k.toLowerCase() === 'content-type' ? contentType : null) },
        text: async () => html,
    };
}

function abortError() {
    const err = new Error('aborted');
    err.name = 'AbortError';
    return err;
}

/** Call the handler and compare [status, body] with one assertion. */
async function respond(name, response, expected) {
    const body = await response.json();
    check(name, [response.status, body], expected);
}

const handlerReq = (method, url) => ({ method, url });

// ── SSRF / URL guard ───────────────────────────────────────────────────────────────────────────
console.log('\nisFetchableUrl — schemes and the private-network guard');

check('an https page is fetchable', isFetchableUrl('https://example.com/recipe'), true);
check('an http page is fetchable', isFetchableUrl('http://example.com/recipe'), true);
check('a non-http scheme is refused', isFetchableUrl('ftp://example.com/x'), false);
check('a javascript: URL is refused', isFetchableUrl('javascript:alert(1)'), false);
check('a string that is not a URL is refused', isFetchableUrl('not a url'), false);
check('a non-string is refused', isFetchableUrl(null), false);
check('localhost is refused', isFetchableUrl('http://localhost:3000/x'), false);
check('0.0.0.0 is refused', isFetchableUrl('http://0.0.0.0/'), false);
check('127.0.0.1 is refused', isFetchableUrl('http://127.0.0.1/x'), false);
check('a 10.x address is refused', isFetchableUrl('http://10.1.2.3/'), false);
check('a 192.168.x address is refused', isFetchableUrl('http://192.168.0.1/'), false);
check('a 172.16.x address is refused', isFetchableUrl('http://172.16.5.5/'), false);
check('a 172.31.x address is refused', isFetchableUrl('http://172.31.255.255/'), false);
check('a 172.32.x address is NOT refused (range boundary)',
    isFetchableUrl('http://172.32.5.5/'), true);
check('the cloud metadata address is refused',
    isFetchableUrl('http://169.254.169.254/latest/meta-data/'), false);
check('a decimal-encoded 127.0.0.1 is refused', isFetchableUrl('http://2130706433/'), false);
check('a hex-encoded 127.0.0.1 is refused', isFetchableUrl('http://0x7f000001/'), false);
check('an octal-encoded 127.0.0.1 is refused', isFetchableUrl('http://0177.0.0.1/'), false);
check('a short-form 127.1 is refused', isFetchableUrl('http://127.1/'), false);
check('userinfo cannot hide a private host',
    isFetchableUrl('http://example.com@127.0.0.1/'), false);
check('a port is allowed', isFetchableUrl('http://example.com:8080/recipe'), true);

// The guard's own IPv6 special case is unreachable: `new URL('http://[::1]/').hostname` is '[::1]',
// brackets included, so `host === '::1'` never matches. These four are the measured behaviour of the
// module as it stands — recorded so the gap is visible and a fix has something to go red against.
check('[MEASURED GAP] an IPv6 loopback literal is NOT refused',
    isFetchableUrl('http://[::1]/'), true);
check('[MEASURED GAP] the IPv4-mapped IPv6 loopback is NOT refused',
    isFetchableUrl('http://[::ffff:127.0.0.1]/'), true);
check('[MEASURED GAP] a private IPv6 literal is NOT refused',
    isFetchableUrl('http://[fd00::1]/'), true);
check('[MEASURED GAP] the long-form IPv6 loopback is NOT refused',
    isFetchableUrl('http://[0:0:0:0:0:0:0:1]/'), true);

// ── social URL detection and configuration ─────────────────────────────────────────────────────
console.log('\nisSocialPostUrl / socialIngestConfigured — the inert-by-default switch');

check('an instagram post is a social post',
    isSocialPostUrl('https://www.instagram.com/p/abc/'), true);
check('a tiktok video is a social post',
    isSocialPostUrl('https://www.tiktok.com/@chef/video/1'), true);
check('a youtu.be link is a social post', isSocialPostUrl('https://youtu.be/abc'), true);
check('a youtube short is a social post',
    isSocialPostUrl('https://www.youtube.com/shorts/abc'), true);
check('an instagram lookalike domain is not a social post',
    isSocialPostUrl('https://notinstagram.com/p/abc/'), false);
check('a subdomain trick is not a social post',
    isSocialPostUrl('https://instagram.com.evil.com/p/abc/'), false);
check('an ordinary recipe blog is not a social post',
    isSocialPostUrl('https://smittenkitchen.com/2020/01/soup/'), false);
check('a string that is not a URL is not a social post', isSocialPostUrl('nope'), false);

delete process.env.SOCIAL_INGEST_URL;
delete process.env.SOCIAL_INGEST_TOKEN;
check('unconfigured: the social branch is off', socialIngestConfigured(), false);
process.env.SOCIAL_INGEST_URL = 'http://vps:9000';
check('only the URL set: still off', socialIngestConfigured(), false);
delete process.env.SOCIAL_INGEST_URL;
process.env.SOCIAL_INGEST_TOKEN = 'tok';
check('only the token set: still off', socialIngestConfigured(), false);
process.env.SOCIAL_INGEST_URL = 'http://vps:9000';
check('both set: on', socialIngestConfigured(), true);
process.env.SOCIAL_INGEST_URL = '';
check('an empty URL is not configuration', socialIngestConfigured(), false);
delete process.env.SOCIAL_INGEST_URL;
delete process.env.SOCIAL_INGEST_TOKEN;

// ── buildSocialText ───────────────────────────────────────────────────────────────────────────
console.log('\nbuildSocialText — the blob Gemini reads');

check('the provenance line names the creator and the URL',
    buildSocialText({ creator: 'chef', caption: 'c', transcript: 't', source_url: 'https://i/p/1' }, null),
    'Captured from a social post by chef (https://i/p/1).\n\nCAPTION:\nc\n\nSPOKEN TRANSCRIPT:\nt');
check('the creator is trimmed', buildSocialText({ creator: '  chef  ' }, 'u').split('\n')[0],
    'Captured from a social post by chef (u).');
check('no creator: no "by" clause',
    buildSocialText({ caption: 'c' }, 'u').split('\n')[0], 'Captured from a social post (u).');
check('the URL falls back to the requested URL',
    buildSocialText({ caption: 'c' }, 'https://fallback').split('\n')[0],
    'Captured from a social post (https://fallback).');
check('no URL anywhere: the parenthetical is omitted',
    buildSocialText({ caption: 'c' }, null).split('\n')[0], 'Captured from a social post.');
check('a null bundle still produces the provenance line',
    buildSocialText(null, null), 'Captured from a social post.');
check('a caption with no transcript has no transcript section',
    buildSocialText({ caption: 'only caption' }, 'u').includes('SPOKEN TRANSCRIPT'), false);
check('a transcript with no caption has no caption section',
    buildSocialText({ transcript: 'only speech' }, 'u').includes('CAPTION:'), false);
check('a whitespace-only caption is treated as absent',
    buildSocialText({ caption: '   ' }, 'u'), 'Captured from a social post (u).');
check('the blob is capped at 8000 characters',
    buildSocialText({ caption: 'x'.repeat(9000) }, 'u').length, 8000);

// ── JSON-LD blocks and nodes ───────────────────────────────────────────────────────────────────
console.log('\nextractJsonLdBlocks / findRecipeNode — finding the recipe node');

check('a single block is parsed', extractJsonLdBlocks(
    '<script type="application/ld+json">{"a":1}</script>'), [{ a: 1 }]);
check('two blocks are both parsed', extractJsonLdBlocks(
    '<script type="application/ld+json">{"a":1}</script><p>x</p>'
    + '<script type="application/ld+json">{"b":2}</script>'), [{ a: 1 }, { b: 2 }]);
check('a malformed block is skipped and the rest kept', extractJsonLdBlocks(
    '<script type="application/ld+json">{bad}</script>'
    + '<script type="application/ld+json">{"ok":true}</script>'), [{ ok: true }]);
check('a trailing comma is salvaged', extractJsonLdBlocks(
    '<script type="application/ld+json">{"a":1,}</script>'), [{ a: 1 }]);
check('an empty block is skipped', extractJsonLdBlocks(
    '<script type="application/ld+json">   </script>'), []);
check('single quotes and spacing around the type attribute are accepted', extractJsonLdBlocks(
    "<script type = 'application/ld+json' >{\"a\":1}</script>"), [{ a: 1 }]);
check('non-string input yields no blocks', extractJsonLdBlocks(null), []);

const recipeNode = { '@type': 'Recipe', name: 'Soup' };
check('a bare Recipe node is found',
    findRecipeNode([recipeNode]), recipeNode);
check('a Recipe inside @graph is found',
    findRecipeNode([{ '@graph': [{ '@type': 'WebPage' }, recipeNode] }]), recipeNode);
check('a Recipe in a bare top-level array is found',
    findRecipeNode([[{ '@type': 'Thing' }, recipeNode]]), recipeNode);
check('@type as an array containing Recipe is found',
    findRecipeNode([{ '@type': ['Thing', 'Recipe'], name: 'x' }]).name, 'x');
check('the type match is case-insensitive',
    findRecipeNode([{ '@type': 'recipe', name: 'lower' }]).name, 'lower');
check('the FIRST recipe node wins',
    findRecipeNode([{ '@type': 'Recipe', name: 'first' }, { '@type': 'Recipe', name: 'second' }]).name,
    'first');
check('no Recipe node returns null', findRecipeNode([{ '@type': 'WebPage' }]), null);
check('no blocks at all returns null', findRecipeNode(null), null);

// ── mapIngredients ────────────────────────────────────────────────────────────────────────────
console.log('\nmapIngredients — raw strings into {name, quantity, unit}');

check('a mixed number becomes 1.5',
    mapIngredients(['1 1/2 cups flour'])[0], { name: 'flour', quantity: 1.5, unit: 'cups' });
check('a unicode vulgar fraction is understood',
    mapIngredients(['½ tsp salt'])[0], { name: 'salt', quantity: 0.5, unit: 'tsp' });
check('a decimal quantity is understood',
    mapIngredients(['1.5 kg beef'])[0], { name: 'beef', quantity: 1.5, unit: 'kg' });
check('a range takes the first number',
    mapIngredients(['2-3 cloves garlic'])[0], { name: 'garlic', quantity: 2, unit: 'cloves' });
check('an amount-less line keeps its name with null quantity and unit',
    mapIngredients(['Salt and pepper to taste'])[0],
    { name: 'Salt and pepper to taste', quantity: null, unit: null });
check('a group header is dropped',
    mapIngredients(['For the sauce:', '2 tbsp butter']),
    [{ name: 'butter', quantity: 2, unit: 'tbsp' }]);
check('blank and whitespace entries are dropped',
    mapIngredients(['', '   ', null]), []);
check('a non-array yields [] rather than throwing', mapIngredients('1 cup flour'), []);
check('every mapped ingredient is exactly {name, quantity, unit}',
    mapIngredients(['1 cup flour']).map((i) => Object.keys(i).sort()),
    [['name', 'quantity', 'unit']]);

// ── flattenInstructions ───────────────────────────────────────────────────────────────────────
console.log('\nflattenInstructions — the four shapes recipe plugins emit');

check('a string is split on newlines', flattenInstructions('Boil water\n\nAdd pasta\n'),
    ['Boil water', 'Add pasta']);
check('an array of strings passes through',
    flattenInstructions(['One', 'Two']), ['One', 'Two']);
check('HowToStep objects use .text',
    flattenInstructions([{ '@type': 'HowToStep', text: 'Stir' }]), ['Stir']);
check('a HowToSection nests its steps',
    flattenInstructions([{ '@type': 'HowToSection', itemListElement: ['a', { text: 'b' }] }]),
    ['a', 'b']);
check('an object with no text falls back to .name',
    flattenInstructions([{ name: 'Named step' }]), ['Named step']);
check('entry types it cannot read are ignored',
    flattenInstructions([42, null, { text: '   ' }, 'kept']), ['kept']);
check('a missing instruction list yields []', flattenInstructions(undefined), []);
check('a non-string, non-array value yields []', flattenInstructions({ text: 'x' }), []);

// ── extractImageUrl ───────────────────────────────────────────────────────────────────────────
console.log('\nextractImageUrl — the picture that ships with a recipe page');

check('a string image is trimmed', extractImageUrl({ image: '  a.jpg  ' }), 'a.jpg');
check('an array takes the first entry', extractImageUrl({ image: ['b.jpg', 'c.jpg'] }), 'b.jpg');
check('an ImageObject uses .url', extractImageUrl({ image: { url: 'd.jpg' } }), 'd.jpg');
check('a bare @id reference yields null', extractImageUrl({ image: { '@id': '#primaryimage' } }), null);
check('no image yields null', extractImageUrl({}), null);

// ── mapRecipeNode ─────────────────────────────────────────────────────────────────────────────
console.log('\nmapRecipeNode — the draft the review screen receives');

const minimal = mapRecipeNode({
    '@type': 'Recipe', name: 'Soup', recipeIngredient: ['1 cup water'],
    recipeInstructions: ['Boil'],
}, 'https://blog/soup');
check('the draft has exactly the 11 documented fields',
    Object.keys(minimal),
    ['title', 'description', 'creator', 'cook_time_minutes', 'difficulty', 'kcal',
        'base_servings', 'meal_type', 'ingredients', 'steps', 'source_url']);
check('the documented defaults are applied', [
    minimal.cook_time_minutes, minimal.difficulty, minimal.base_servings,
    minimal.meal_type, minimal.description, minimal.creator, minimal.kcal,
], [30, 'Medium', 4, 'Dinner', null, null, null]);
check('source_url is passed through verbatim', minimal.source_url, 'https://blog/soup');
check('a null source_url is allowed',
    mapRecipeNode({ name: 'x', recipeIngredient: ['1 cup a'], recipeInstructions: ['s'] }, null)
        .source_url, null);

check('no ingredients means no draft (falls back to Gemini)',
    mapRecipeNode({ name: 'S', recipeInstructions: ['do'] }), null);
check('no steps means no draft', mapRecipeNode({ name: 'S', recipeIngredient: ['1 cup x'] }), null);
check('no title means no draft',
    mapRecipeNode({ recipeIngredient: ['1 cup x'], recipeInstructions: ['do'] }), null);

const rich = mapRecipeNode({
    name: '  Pancakes  ', description: '  Fluffy  ', author: { name: '  Chef  ' },
    totalTime: 'PT25M', recipeYield: ['Serves 4-6'], nutrition: { calories: '270 kcal' },
    recipeCategory: 'Breakfast', recipeIngredient: ['1 cup flour'], recipeInstructions: ['mix'],
}, 'https://blog/pancakes');
check('title, description and creator are trimmed',
    [rich.title, rich.description, rich.creator], ['Pancakes', 'Fluffy', 'Chef']);
check('totalTime PT25M is 25 minutes', rich.cook_time_minutes, 25);
check('nutrition.calories "270 kcal" is 270', rich.kcal, 270);
check('recipeYield "Serves 4-6" takes the first integer', rich.base_servings, 4);
check('recipeCategory Breakfast sets meal_type', rich.meal_type, 'Breakfast');

check('cookTime + prepTime are summed when totalTime is absent',
    mapRecipeNode({ name: 'H', recipeIngredient: ['1 cup x'], recipeInstructions: ['do'], cookTime: 'PT1H', prepTime: 'PT30M' }).cook_time_minutes,
    90);
check('seconds are rounded into the minute total',
    mapRecipeNode({ name: 'H', recipeIngredient: ['1 cup x'], recipeInstructions: ['do'], totalTime: 'PT1M30S' }).cook_time_minutes,
    2);
check('an unparseable duration falls back to 30',
    mapRecipeNode({ name: 'H', recipeIngredient: ['1 cup x'], recipeInstructions: ['do'], totalTime: 'about half an hour' }).cook_time_minutes,
    30);
check('a numeric recipeYield is read', mapRecipeNode(
    { name: 'x', recipeIngredient: ['1 cup a'], recipeInstructions: ['s'], recipeYield: '4' })
    .base_servings, 4);
check('a recipeYield with no number falls back to 4', mapRecipeNode(
    { name: 'x', recipeIngredient: ['1 cup a'], recipeInstructions: ['s'], recipeYield: 'a few' })
    .base_servings, 4);

const cookTimeOf = (t) => mapRecipeNode({
    name: 'x', recipeIngredient: ['1 cup a'], recipeInstructions: ['s'], totalTime: t,
}).difficulty;
check('under 20 minutes is Easy', cookTimeOf('PT19M'), 'Easy');
check('exactly 20 minutes is Medium', cookTimeOf('PT20M'), 'Medium');
check('exactly 40 minutes is Medium', cookTimeOf('PT40M'), 'Medium');
check('over 40 minutes is Hard', cookTimeOf('PT41M'), 'Hard');

check('a string author is the creator', mapRecipeNode(
    { name: 'x', recipeIngredient: ['1 cup a'], recipeInstructions: ['s'], author: '  Ann  ' }).creator,
    'Ann');
check('an array author takes the first entry', mapRecipeNode(
    { name: 'x', recipeIngredient: ['1 cup a'], recipeInstructions: ['s'], author: [{ name: 'First' }, { name: 'Second' }] }).creator,
    'First');
check('an author that is only an @id reference yields null', mapRecipeNode(
    { name: 'x', recipeIngredient: ['1 cup a'], recipeInstructions: ['s'], author: { '@id': '#person' } }).creator,
    null);
check('keywords mentioning lunch set meal_type Lunch', mapRecipeNode(
    { name: 'x', recipeIngredient: ['1 cup a'], recipeInstructions: ['s'], keywords: 'quick, lunch' }).meal_type,
    'Lunch');
check('a brunch category sets meal_type Breakfast', mapRecipeNode(
    { name: 'x', recipeIngredient: ['1 cup a'], recipeInstructions: ['s'], recipeCategory: ['Brunch'] }).meal_type,
    'Breakfast');
check('no hint at all means Dinner', mapRecipeNode(
    { name: 'x', recipeIngredient: ['1 cup a'], recipeInstructions: ['s'] }).meal_type, 'Dinner');

// ── readable text fallback ────────────────────────────────────────────────────────────────────
console.log('\nextractReadableText / extractHtmlTitle — the Gemini fallback');

check('scripts, styles, comments and nav chrome are stripped',
    extractReadableText('<html><head><title>T</title><style>b{}</style></head><body>'
        + '<nav>Menu</nav><p>Hello&nbsp;there &amp; welcome</p><script>bad()</script><!-- x -->'
        + '</body></html>'),
    'Hello there & welcome');
check('a numeric entity is decoded', extractReadableText('<p>&#233;clair</p>'), 'éclair');
check('an apostrophe entity is decoded', extractReadableText('<p>chef&rsquo;s</p>'), 'chef’s');
check('footer and form chrome are stripped',
    extractReadableText('<footer>© 2026</footer><p>Real text</p><form><input></form>'),
    'Real text');
check('a page with no <body> is still read', extractReadableText('<p>Only a paragraph</p>'),
    'Only a paragraph');
check('the text is capped at 15000 characters',
    extractReadableText('<p>' + 'a'.repeat(20000) + '</p>').length, 15000);
check('non-string input yields the empty string', extractReadableText(undefined), '');

check('a title is returned, decoded and trimmed',
    extractHtmlTitle('<title> A &amp; B </title>'), 'A & B');
check('no title yields null', extractHtmlTitle('<p>x</p>'), null);
check('non-string input yields null', extractHtmlTitle(null), null);

// ── the handler ───────────────────────────────────────────────────────────────────────────────
console.log('\nthe handler — status codes, the guard, and the two response shapes');

queue = [];
reply = null;
calls = [];

await respond('a non-GET request is refused',
    await handler(handlerReq('POST', 'https://f.test/?url=https://blog/x')),
    [405, { error: 'Use GET with a ?url= parameter.' }]);
await respond('a missing url parameter is refused',
    await handler(handlerReq('GET', 'https://f.test/')),
    [400, { error: 'Missing url parameter.' }]);

calls = [];
await respond('an unfetchable url is refused',
    await handler(handlerReq('GET', 'https://f.test/?url=http://localhost:3000/secret')),
    [400, { error: "That doesn't look like a fetchable web address." }]);
check('the guard refuses BEFORE any request is made', calls.length, 0);

queue = [];
calls = [];
reply = pageResponse('<p>nope</p>', 'text/html', 404);
await respond('an upstream 404 explains the link may be broken',
    await handler(handlerReq('GET', 'https://f.test/?url=https://blog/gone')),
    [502, { error: 'That page returned an error (404). Check the link — it may be broken or moved, or paste the recipe text directly.' }]);
check('the page was actually requested once', calls.length, 1);
check('the documented user agent is sent',
    calls[0]?.opts?.headers?.['User-Agent']?.includes('MealBuddyRecipeBot/1.0'), true);
check('only HTML is accepted in the Accept header',
    calls[0]?.opts?.headers?.Accept, 'text/html,application/xhtml+xml');
check('redirects are followed', calls[0]?.opts?.redirect, 'follow');
check('a signal is passed so the timeout can abort the fetch',
    calls[0]?.opts?.signal instanceof AbortSignal, true);

reply = pageResponse('nope', 'text/html', 500);
await respond('another upstream error uses the plain message',
    await handler(handlerReq('GET', 'https://f.test/?url=https://blog/boom')),
    [502, { error: 'That page returned an error (500). Check the link, or paste the recipe text directly.' }]);

reply = pageResponse('%PDF-1.4', 'application/pdf', 200);
await respond('a non-HTML content type is refused',
    await handler(handlerReq('GET', 'https://f.test/?url=https://blog/file.pdf')),
    [415, { error: "That link doesn't point to a web page Meal Buddy can read." }]);

reply = () => { throw abortError(); };
await respond('an aborted fetch is a 504',
    await handler(handlerReq('GET', 'https://f.test/?url=https://blog/slow')),
    [504, { error: 'That page took too long to load. Try again, or paste the recipe text directly.' }]);

reply = () => { throw new TypeError('fetch failed'); };
await respond('a network failure is a 502',
    await handler(handlerReq('GET', 'https://f.test/?url=https://blog/dead')),
    [502, { error: "Couldn't reach that page. Check the link and try again." }]);

const ldHtml = '<html><head><title>Blog</title></head><body><script type="application/ld+json">'
    + JSON.stringify({
        '@type': 'Recipe', name: 'Soup', recipeIngredient: ['2 cups water'],
        recipeInstructions: [{ '@type': 'HowToStep', text: 'Boil' }],
        image: { url: 'https://blog/soup.jpg' },
    }) + '</script></body></html>';
reply = pageResponse(ldHtml);
await respond('a page with JSON-LD comes back as source jsonld',
    await handler(handlerReq('GET', 'https://f.test/?url=https://blog/soup')),
    [200, {
        source: 'jsonld',
        recipe: {
            title: 'Soup', description: null, creator: null, cook_time_minutes: 30,
            difficulty: 'Medium', kcal: null, base_servings: 4, meal_type: 'Dinner',
            ingredients: [{ name: 'water', quantity: 2, unit: 'cups' }], steps: ['Boil'],
            source_url: 'https://blog/soup',
        },
        imageUrl: 'https://blog/soup.jpg',
    }]);

reply = pageResponse('<p>too short</p>');
await respond('a page with no recipe and no readable text is a 422',
    await handler(handlerReq('GET', 'https://f.test/?url=https://blog/empty')),
    [422, { error: "Couldn't find a recipe on that page. Try pasting the recipe text directly." }]);

const wordy = '<html><head><title>My Blog</title></head><body><p>' + 'word '.repeat(120)
    + '</p></body></html>';
reply = pageResponse(wordy);
const fallback = await handler(handlerReq('GET', 'https://f.test/?url=https://blog/wordy'));
const fallbackBody = await fallback.json();
check('a page with readable text comes back as source fallback',
    [fallback.status, fallbackBody],
    [200, {
        source: 'fallback',
        pageText: 'word '.repeat(120).trim(),
        pageTitle: 'My Blog',
        source_url: 'https://blog/wordy',
    }]);
check('the generic fallback carries no "via" key', 'via' in fallbackBody, false);

// ── the social branch, through the handler ────────────────────────────────────────────────────
console.log('\nthe handler — the social branch (inert until both env vars are set)');

delete process.env.SOCIAL_INGEST_URL;
delete process.env.SOCIAL_INGEST_TOKEN;
calls = [];
reply = pageResponse(wordy);
await respond('unconfigured: an instagram link is fetched as an ordinary page',
    await handler(handlerReq('GET', 'https://f.test/?url=https://www.instagram.com/p/abc/')),
    [200, {
        source: 'fallback', pageText: 'word '.repeat(120).trim(), pageTitle: 'My Blog',
        source_url: 'https://www.instagram.com/p/abc/',
    }]);
check('unconfigured: the ingest service is never called',
    calls.map((c) => c.url), ['https://www.instagram.com/p/abc/']);

// A queue: the first reply is the ingest service's, the second would be the page fetch — which must
// never happen on a social URL.
process.env.SOCIAL_INGEST_URL = 'http://vps:9000/';
process.env.SOCIAL_INGEST_TOKEN = 'tok';
const socialBundle = {
    ok: true, creator: 'chef', caption: 'cap', transcript: 'tr',
    title: 'A post', cover_image_url: 'https://img/cover.jpg',
};
queue = [{ ok: true, status: 200, json: async () => socialBundle },
    pageResponse(wordy)];
calls = [];
await respond('a configured social post comes back in the fallback shape, via social',
    await handler(handlerReq('GET', 'https://f.test/?url=https://www.instagram.com/p/abc/')),
    [200, {
        source: 'fallback',
        pageText: 'Captured from a social post by chef (https://www.instagram.com/p/abc/).'
            + '\n\nCAPTION:\ncap\n\nSPOKEN TRANSCRIPT:\ntr',
        pageTitle: 'A post',
        source_url: 'https://www.instagram.com/p/abc/',
        via: 'social',
        imageUrl: 'https://img/cover.jpg',
    }]);
check('exactly one request was made, and it was the ingest call', calls.length, 1);
check('the ingest call strips the trailing slash and posts {url, deep:false}',
    [calls[0]?.url, calls[0]?.opts?.method, JSON.parse(calls[0]?.opts?.body ?? 'null')],
    ['http://vps:9000/ingest', 'POST', { url: 'https://www.instagram.com/p/abc/', deep: false }]);
check('the ingest call carries the bearer token',
    calls[0]?.opts?.headers?.Authorization, 'Bearer tok');

queue = [{ ok: true, status: 200, json: async () => ({ ok: true, caption: '   ', transcript: '' }) },
    pageResponse(wordy)];
calls = [];
await respond('a social post with no caption and no audio is a 422',
    await handler(handlerReq('GET', 'https://f.test/?url=https://www.instagram.com/p/abc/')),
    [422, { error: 'That post has no caption or audio to read. Paste the recipe text directly instead.' }]);
check('an empty-caption post is not fetched as a page either', calls.length, 1);

queue = [{ ok: false, status: 503, json: async () => ({}) }, pageResponse(wordy)];
await respond('an ingest failure is a 502',
    await handler(handlerReq('GET', 'https://f.test/?url=https://www.instagram.com/p/abc/')),
    [502, { error: "Couldn't read that post right now. Try again in a moment, or paste the recipe text directly." }]);

queue = [{ ok: true, status: 200, json: async () => ({ ok: false, error: 'no caption found' }) },
    pageResponse(wordy)];
await respond('an ingest reply of ok:false is a 502 with the generic message',
    await handler(handlerReq('GET', 'https://f.test/?url=https://www.instagram.com/p/abc/')),
    [502, { error: "Couldn't read that post right now. Try again in a moment, or paste the recipe text directly." }]);

queue = [() => { throw abortError(); }, pageResponse(wordy)];
await respond('an ingest timeout is a 504',
    await handler(handlerReq('GET', 'https://f.test/?url=https://www.instagram.com/p/abc/')),
    [504, { error: 'That post took too long to read. Try again in a moment, or paste the recipe text directly.' }]);

queue = [];
reply = pageResponse(wordy);
await respond('the social branch does not touch an ordinary blog page',
    await handler(handlerReq('GET', 'https://f.test/?url=https://blog/wordy')),
    [200, {
        source: 'fallback', pageText: 'word '.repeat(120).trim(), pageTitle: 'My Blog',
        source_url: 'https://blog/wordy',
    }]);

// ── restore the stub ──────────────────────────────────────────────────────────────────────────
delete process.env.SOCIAL_INGEST_URL;
delete process.env.SOCIAL_INGEST_TOKEN;
globalThis.fetch = stubFetch;

console.log('');
if (failures) {
    console.log(`${failures} FAILED`);
    process.exit(1);
}
console.log('all checks passed');
