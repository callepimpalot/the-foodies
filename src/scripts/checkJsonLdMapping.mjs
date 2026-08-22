// src/scripts/checkJsonLdMapping.mjs
//
// Runnable check for TASK_08's URL-capture JSON-LD mapper (netlify/functions/fetch-recipe.js).
// No HTTP server, no Netlify CLI — imports the pure functions directly and asserts against
// real JSON-LD payloads saved as fixtures (scraped from live food-blog pages).
//
// Run with: node src/scripts/checkJsonLdMapping.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

import {
    extractJsonLdBlocks,
    findRecipeNode,
    mapRecipeNode,
    flattenInstructions,
    mapIngredients,
    extractReadableText,
    extractHtmlTitle,
    isFetchableUrl,
} from '../../netlify/functions/fetch-recipe.js';
import { isBareUrl, isUrlCapture } from '../lib/captureRouting.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadFixture(name) {
    const raw = readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
    return JSON.parse(raw);
}

// Wraps a parsed JSON-LD object back into a minimal HTML page, the way it
// would really appear in a <script type="application/ld+json"> tag — so the
// test exercises the full pipeline (regex extraction -> @graph traversal ->
// field mapping), not just the mapper in isolation.
function wrapAsHtml(jsonLdValue, extraHead = '') {
    return `<!doctype html><html><head><title>Fixture Page</title>${extraHead}
<script type="application/ld+json">${JSON.stringify(jsonLdValue)}</script>
</head><body><main><p>Rendered recipe content would go here on the real page.</p></main></body></html>`;
}

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`      ${err.message}`);
        failed++;
    }
}

function section(title) {
    console.log(`\n${title}`);
}

// ---------------------------------------------------------------------------
// Fixture 1 — BBC Good Food, "Easy pancakes"
// https://www.bbcgoodfood.com/recipes/easy-pancakes
// Bare Recipe object (no @graph), HowToStep array, author array, "Makes 12" yield.
// ---------------------------------------------------------------------------
section('BBC Good Food — Easy pancakes (bare Recipe object)');
{
    const url = 'https://www.bbcgoodfood.com/recipes/easy-pancakes';
    const html = wrapAsHtml(loadFixture('bbcgoodfood-easy-pancakes.json'));

    const blocks = extractJsonLdBlocks(html);
    test('extracts the JSON-LD block', () => assert.equal(blocks.length, 1));

    const node = findRecipeNode(blocks);
    test('finds the Recipe node', () => assert.ok(node && node['@type'] === 'Recipe'));

    const recipe = mapRecipeNode(node, url);
    test('maps to a non-null recipe', () => assert.ok(recipe));
    test('title = "Easy pancakes"', () => assert.equal(recipe.title, 'Easy pancakes'));
    test('cook_time_minutes = 30 (from totalTime PT30M)', () => assert.equal(recipe.cook_time_minutes, 30));
    test('difficulty derived as Medium (20-40 min)', () => assert.equal(recipe.difficulty, 'Medium'));
    test('base_servings = 12 (parsed from "Makes 12")', () => assert.equal(recipe.base_servings, 12));
    test('kcal = 61 (parsed from "61 calories")', () => assert.equal(recipe.kcal, 61));
    test('creator = "Cassie Best" (from author array)', () => assert.equal(recipe.creator, 'Cassie Best'));
    test('source_url stored', () => assert.equal(recipe.source_url, url));
    test('6 ingredients mapped', () => assert.equal(recipe.ingredients.length, 6));
    test('"100g plain flour" -> {name, quantity:100, unit:"g"}', () => {
        const ing = recipe.ingredients[0];
        assert.equal(ing.name, 'plain flour');
        assert.equal(ing.quantity, 100);
        assert.equal(ing.unit, 'g');
    });
    test('every ingredient has {name, quantity, unit} shape', () => {
        for (const ing of recipe.ingredients) {
            assert.equal(typeof ing.name, 'string');
            assert.ok(ing.name.length > 0);
            assert.ok(ing.quantity === null || typeof ing.quantity === 'number');
            assert.ok(ing.unit === null || typeof ing.unit === 'string');
        }
    });
    test('5 steps flattened from HowToStep objects', () => assert.equal(recipe.steps.length, 5));
    test('steps are plain non-empty strings', () => {
        assert.ok(recipe.steps.every((s) => typeof s === 'string' && s.trim().length > 0));
    });
}

// ---------------------------------------------------------------------------
// Fixture 2 — Cafe Delites, "Creamy Garlic Chicken Breasts" (MESSY CASE)
// https://cafedelites.com/creamy-garlic-chicken-breasts/
// @graph array mixing Article/WebPage/FAQPage/Person/Question/Recipe nodes —
// the Recipe node must be found among unrelated siblings. recipeYield is an
// array, author is an @id-only reference with no name, quantities include a
// mixed fraction ("1 1/4 cup") and a range ("2-3").
// ---------------------------------------------------------------------------
section('Cafe Delites — Creamy Garlic Chicken (messy @graph, mixed node types)');
{
    const url = 'https://cafedelites.com/creamy-garlic-chicken-breasts/';
    const html = wrapAsHtml(loadFixture('cafedelites-creamy-garlic-chicken.json'));

    const blocks = extractJsonLdBlocks(html);
    test('extracts the JSON-LD block', () => assert.equal(blocks.length, 1));
    test('the block is a single @graph object, not a bare Recipe', () => {
        assert.ok(!Array.isArray(blocks[0]));
        assert.ok(Array.isArray(blocks[0]['@graph']));
        assert.ok(blocks[0]['@graph'].length > 3, 'graph should contain several unrelated node types');
    });

    const node = findRecipeNode(blocks);
    test('finds the Recipe node among Article/FAQPage/Person/Question siblings', () => {
        assert.ok(node);
        assert.ok(isRecipeTypeForTest(node['@type']));
    });

    const recipe = mapRecipeNode(node, url);
    test('maps to a non-null recipe', () => assert.ok(recipe));
    test('title = "Creamy Garlic Chicken Breast Recipe"', () => assert.equal(recipe.title, 'Creamy Garlic Chicken Breast Recipe'));
    test('base_servings = 4 (first int from recipeYield array ["4","4 people"])', () => assert.equal(recipe.base_servings, 4));
    test('cook_time_minutes = 35 (from totalTime PT35M)', () => assert.equal(recipe.cook_time_minutes, 35));
    test('kcal = 666 (parsed from "666 kcal")', () => assert.equal(recipe.kcal, 666));
    test('creator falls back to null ({@id}-only author, no name — never guessed)', () => assert.equal(recipe.creator, null));
    test('14 ingredients mapped', () => assert.equal(recipe.ingredients.length, 14));
    test('mixed-fraction quantity: "1 1/4 cup chicken broth" -> quantity 1.25, unit "cup"', () => {
        const ing = recipe.ingredients.find((i) => i.name.includes('chicken broth'));
        assert.ok(ing, 'expected to find the chicken broth ingredient');
        assert.equal(ing.quantity, 1.25);
        assert.equal(ing.unit, 'cup');
    });
    test('range quantity: "2-3 boneless chicken breasts" -> quantity 2 (lower bound)', () => {
        const ing = recipe.ingredients.find((i) => i.name.includes('chicken breasts'));
        assert.ok(ing, 'expected to find the chicken breasts ingredient');
        assert.equal(ing.quantity, 2);
    });
    test('12 steps flattened from HowToStep objects with extra url/name fields', () => assert.equal(recipe.steps.length, 12));
    test('no ingredient/step accidentally pulled in a Question or FAQ node', () => {
        const joined = [...recipe.ingredients.map((i) => i.name), ...recipe.steps].join(' ').toLowerCase();
        assert.ok(!joined.includes('frequently asked'), 'FAQ content leaked into the mapped recipe');
    });
}

// ---------------------------------------------------------------------------
// Fixture 3 — Skinnytaste, "Instant Pot Chicken Tikka Masala" (unicode fractions)
// https://www.skinnytaste.com/instant-pot-chicken-tikka-masala-with-cauliflower-and-peas/
// Another messy @graph, but the key thing under test here is unicode vulgar
// fractions ("1 ½ pounds", "½ tablespoon") parsing correctly.
// ---------------------------------------------------------------------------
section('Skinnytaste — Chicken Tikka Masala (unicode fraction quantities)');
{
    const url = 'https://www.skinnytaste.com/instant-pot-chicken-tikka-masala-with-cauliflower-and-peas/';
    const html = wrapAsHtml(loadFixture('skinnytaste-tikka-masala.json'));

    const blocks = extractJsonLdBlocks(html);
    const node = findRecipeNode(blocks);
    test('finds the Recipe node inside @graph', () => assert.ok(node));

    const recipe = mapRecipeNode(node, url);
    test('maps to a non-null recipe', () => assert.ok(recipe));
    test('base_servings = 6 (from recipeYield array ["6","6 servings"])', () => assert.equal(recipe.base_servings, 6));
    test('unicode fraction "1 ½ pounds ... chicken thighs" -> quantity 1.5, unit "pounds"', () => {
        const ing = recipe.ingredients.find((i) => i.name.toLowerCase().includes('chicken thighs'));
        assert.ok(ing, 'expected to find the chicken thighs ingredient');
        assert.equal(ing.quantity, 1.5);
        assert.equal(ing.unit, 'pounds');
    });
    test('unicode fraction "½ tablespoon ghee" -> quantity 0.5, unit "tablespoon"', () => {
        const ing = recipe.ingredients.find((i) => i.name.toLowerCase().includes('ghee'));
        assert.ok(ing, 'expected to find the ghee ingredient');
        assert.equal(ing.quantity, 0.5);
        assert.equal(ing.unit, 'tablespoon');
    });
    test('kcal = 226 (parsed from "226 kcal")', () => assert.equal(recipe.kcal, 226));
}

// ---------------------------------------------------------------------------
// Fraction parsing — explicit checks called out in the acceptance criteria:
// "1 1/2", unicode "½", and decimal "1.5" must all parse the same way.
// ---------------------------------------------------------------------------
section('Fraction parsing — "1 1/2", "½", and "1.5" all normalize identically');
{
    const mixedNumber = mapIngredients(['1 1/2 cups flour']);
    const unicodeFraction = mapIngredients(['½ cup flour']); // "½ cup flour" — note different phrasing below matches too
    const decimal = mapIngredients(['1.5 cups flour']);

    test('"1 1/2 cups flour" -> quantity 1.5, unit "cups"', () => {
        assert.equal(mixedNumber[0].quantity, 1.5);
        assert.equal(mixedNumber[0].unit, 'cups');
    });
    test('"1.5 cups flour" -> quantity 1.5, unit "cups"', () => {
        assert.equal(decimal[0].quantity, 1.5);
        assert.equal(decimal[0].unit, 'cups');
    });
    test('"½ cup flour" -> quantity 0.5 (half of the 1.5 cases above)', () => {
        assert.equal(unicodeFraction[0].quantity, 0.5);
        assert.equal(unicodeFraction[0].unit, 'cup');
    });

    const mixedAndUnicodeSameCup = mapIngredients(['1 ½ cups flour']);
    test('"1 ½ cups flour" (unicode mixed number) -> quantity 1.5, matching "1 1/2"', () => {
        assert.equal(mixedAndUnicodeSameCup[0].quantity, mixedNumber[0].quantity);
    });
}

// ---------------------------------------------------------------------------
// Instruction flattening — HowToSection nesting (the other "messy" shape
// called out in the task besides @graph — neither real fixture above happened
// to use it, so it's exercised directly here against synthetic-but-schema-
// accurate input matching schema.org's own HowToSection example).
// ---------------------------------------------------------------------------
section('flattenInstructions — HowToSection nesting');
{
    const nested = [
        {
            '@type': 'HowToSection',
            name: 'For the icing',
            itemListElement: [
                { '@type': 'HowToStep', text: 'Beat the butter until fluffy.' },
                { '@type': 'HowToStep', text: 'Add the icing sugar gradually.' },
            ],
        },
        {
            '@type': 'HowToSection',
            name: 'For the cake',
            itemListElement: [{ '@type': 'HowToStep', text: 'Bake at 180C for 25 minutes.' }],
        },
    ];
    const steps = flattenInstructions(nested);
    test('flattens both sections into a single ordered array of 3 steps', () => assert.equal(steps.length, 3));
    test('section order and step order preserved', () => {
        assert.equal(steps[0], 'Beat the butter until fluffy.');
        assert.equal(steps[2], 'Bake at 180C for 25 minutes.');
    });

    const plainStringSteps = flattenInstructions('Mix everything.\nBake for 20 minutes.\n\nServe warm.');
    test('a single newline-separated string also flattens correctly', () => assert.equal(plainStringSteps.length, 3));
}

// ---------------------------------------------------------------------------
// Failure paths — the mapper must never hallucinate a recipe.
// ---------------------------------------------------------------------------
section('Failure paths (no hallucinated recipes)');
{
    test('mapRecipeNode returns null when there are no ingredients', () => {
        const result = mapRecipeNode({ '@type': 'Recipe', name: 'Nothing here', recipeInstructions: ['Do a thing'] }, 'https://example.com');
        assert.equal(result, null);
    });
    test('mapRecipeNode returns null when there is no title', () => {
        const result = mapRecipeNode({ '@type': 'Recipe', recipeIngredient: ['1 cup flour'], recipeInstructions: ['Mix it'] }, 'https://example.com');
        assert.equal(result, null);
    });
    test('mapRecipeNode returns null when there are no steps', () => {
        const result = mapRecipeNode({ '@type': 'Recipe', name: 'Flour Soup', recipeIngredient: ['1 cup flour'], recipeInstructions: [] }, 'https://example.com');
        assert.equal(result, null);
    });
    test('findRecipeNode returns null when the page has JSON-LD but no Recipe type', () => {
        const blocks = extractJsonLdBlocks(wrapAsHtml({ '@context': 'https://schema.org', '@type': 'Article', headline: 'Not a recipe' }));
        assert.equal(findRecipeNode(blocks), null);
    });
    test('extractJsonLdBlocks tolerates a page with no JSON-LD at all', () => {
        assert.deepEqual(extractJsonLdBlocks('<html><body>no structured data here</body></html>'), []);
    });
    test('extractJsonLdBlocks skips a malformed block instead of throwing', () => {
        const html = '<script type="application/ld+json">{not valid json,,,}</script>';
        assert.deepEqual(extractJsonLdBlocks(html), []);
    });
    test('extractReadableText returns "" below the usable-length floor for a thin/paywalled page', () => {
        const thin = wrapAsHtml({ '@type': 'Article' }).replace('Rendered recipe content would go here on the real page.', 'Subscribe to continue reading.');
        const text = extractReadableText(thin);
        assert.ok(text.length < 200, `expected a short paywall-style page to stay under the 200-char floor, got ${text.length}`);
    });
    test('isFetchableUrl rejects non-http(s) schemes', () => {
        assert.equal(isFetchableUrl('javascript:alert(1)'), false);
        assert.equal(isFetchableUrl('ftp://example.com/x'), false);
        assert.equal(isFetchableUrl('not a url'), false);
    });
    test('isFetchableUrl rejects localhost/private-network hosts (SSRF guard)', () => {
        assert.equal(isFetchableUrl('http://localhost:3000/'), false);
        assert.equal(isFetchableUrl('http://127.0.0.1/'), false);
        assert.equal(isFetchableUrl('http://192.168.1.5/'), false);
        assert.equal(isFetchableUrl('http://169.254.169.254/'), false);
    });
    test('isFetchableUrl accepts a normal https food-blog URL', () => {
        assert.equal(isFetchableUrl('https://www.bbcgoodfood.com/recipes/easy-pancakes'), true);
    });
}

// The composer's routing gate. TASK_08's hardest requirement is that the pre-existing
// text and photo capture paths are COMPLETELY unaffected, and this predicate is the
// only thing standing between them and the new URL path.
section('Capture routing — existing text/photo paths must be untouched');
{
    const urlOnly = 'https://www.bbcgoodfood.com/recipes/easy-pancakes';

    test('a bare pasted URL, nothing else, routes to the URL path', () => {
        assert.equal(isUrlCapture({ text: urlOnly, imageCount: 0 }), true);
        assert.equal(isUrlCapture({ text: `  ${urlOnly}  `.trim(), imageCount: 0 }), true);
        assert.equal(isUrlCapture({ text: 'HTTPS://EXAMPLE.COM/r/1', imageCount: 0 }), true);
    });
    test('a URL with ANY attached photo stays on the existing text+photo path', () => {
        assert.equal(isUrlCapture({ text: urlOnly, imageCount: 1 }), false);
        assert.equal(isUrlCapture({ text: urlOnly, imageCount: 3 }), false);
    });
    test('a URL mentioned inside recipe text stays on the existing text path', () => {
        assert.equal(isUrlCapture({ text: `Mum's pancakes, adapted from ${urlOnly}`, imageCount: 0 }), false);
        assert.equal(isUrlCapture({ text: `${urlOnly}\n\n2 eggs\n300ml milk`, imageCount: 0 }), false);
        assert.equal(isUrlCapture({ text: `${urlOnly} — halve the sugar`, imageCount: 0 }), false);
    });
    test('ordinary pasted recipe text never routes to the URL path', () => {
        assert.equal(isUrlCapture({ text: '2 eggs\n300ml milk\n140g flour', imageCount: 0 }), false);
        assert.equal(isUrlCapture({ text: 'www.bbcgoodfood.com/recipes/easy-pancakes', imageCount: 0 }), false);
        assert.equal(isUrlCapture({ text: '', imageCount: 0 }), false);
        assert.equal(isUrlCapture({ text: undefined, imageCount: 0 }), false);
        assert.equal(isUrlCapture(), false);
    });
    test('photos with no text at all stay on the existing photo path', () => {
        assert.equal(isUrlCapture({ text: '', imageCount: 2 }), false);
    });
    test('isBareUrl rejects non-http(s) schemes the composer should not fetch', () => {
        assert.equal(isBareUrl('javascript:alert(1)'), false);
        assert.equal(isBareUrl('ftp://example.com/x'), false);
        assert.equal(isBareUrl('file:///etc/passwd'), false);
    });
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

// Small local helper mirroring the module's private isRecipeType check, kept
// here (not exported from fetch-recipe.js) since it's only needed to assert
// on the raw @type value in the "messy @graph" test above.
function isRecipeTypeForTest(type) {
    if (!type) return false;
    if (Array.isArray(type)) return type.some((t) => String(t).toLowerCase() === 'recipe');
    return String(type).toLowerCase() === 'recipe';
}
