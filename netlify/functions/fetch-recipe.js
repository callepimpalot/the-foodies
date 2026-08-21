// netlify/functions/fetch-recipe.js
//
// Fast deterministic recipe capture path (TASK_08). A browser can't fetch an
// arbitrary food blog directly — CORS blocks it — so this Netlify Function
// fetches the page server-side, looks for schema.org/Recipe JSON-LD, and maps
// it straight to the app's recipe shape (DATA_MODELS.md §1).
//
// If the page has no usable Recipe JSON-LD, this returns the page's readable
// text instead of a recipe — the FRONTEND then feeds that text into the
// existing Gemini extraction path (src/lib/recipeExtraction.js). This file
// never calls Gemini itself, so it stays a pure "try the cheap path first"
// step, not a second AI integration.
//
// Every exported function below is pure and imported directly by
// src/scripts/checkJsonLdMapping.mjs for testing — no HTTP server required.

import { parseIngredient } from 'parse-ingredient';

const FETCH_TIMEOUT_MS = 7000; // well under Netlify's 10s function limit
const DEFAULT_SERVINGS = 4;
const DEFAULT_COOK_TIME_MINUTES = 30;
const MIN_FALLBACK_TEXT_LENGTH = 200; // below this, there's nothing worth sending to Gemini
const MAX_FALLBACK_TEXT_LENGTH = 15000; // cap what we forward, page bodies can be huge
const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 MealBuddyRecipeBot/1.0';

// ---------------------------------------------------------------------------
// JSON-LD extraction
// ---------------------------------------------------------------------------

// Finds every <script type="application/ld+json"> block in the HTML and
// parses it. A block that fails to parse (malformed JSON, a stray CDATA
// wrapper, etc.) is skipped rather than aborting the whole extraction.
export function extractJsonLdBlocks(html) {
    const blocks = [];
    if (typeof html !== 'string') return blocks;

    const scriptRegex = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = scriptRegex.exec(html))) {
        const raw = match[1]?.trim();
        if (!raw) continue;
        try {
            blocks.push(JSON.parse(raw));
        } catch {
            try {
                // Best-effort salvage for the most common real-world issue: a
                // trailing comma before a closing bracket/brace.
                blocks.push(JSON.parse(raw.replace(/,\s*([\]}])/g, '$1')));
            } catch {
                // Genuinely malformed — skip this block, keep looking at others.
            }
        }
    }
    return blocks;
}

function isRecipeType(type) {
    if (!type) return false;
    if (Array.isArray(type)) return type.some((t) => String(t).toLowerCase() === 'recipe');
    return String(type).toLowerCase() === 'recipe';
}

// Recursively collects every node object out of a parsed JSON-LD block,
// following @graph arrays and bare top-level arrays (both are common).
function collectNodes(node, acc) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
        node.forEach((n) => collectNodes(n, acc));
        return;
    }
    acc.push(node);
    if (Array.isArray(node['@graph'])) {
        node['@graph'].forEach((n) => collectNodes(n, acc));
    }
}

// Finds the first schema.org Recipe node across all parsed JSON-LD blocks,
// handling bare Recipe objects, @graph arrays, and pages with multiple
// Recipe nodes (first one wins).
export function findRecipeNode(blocks) {
    const nodes = [];
    (blocks ?? []).forEach((b) => collectNodes(b, nodes));
    return nodes.find((n) => isRecipeType(n?.['@type'])) ?? null;
}

// ---------------------------------------------------------------------------
// Field mapping helpers — each one is defensive against the real-world mess
// documented in TASK_08_url_capture_jsonld.md's "RISKS / EDGE CASES".
// ---------------------------------------------------------------------------

function firstString(value) {
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value)) return firstString(value[0]);
    return '';
}

// "PT30M", "PT1H30M", "PT1H" -> minutes. Returns null if unparseable.
function parseISODuration(iso) {
    if (typeof iso !== 'string') return null;
    const m = iso.trim().match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
    if (!m) return null;
    const days = Number(m[1] || 0);
    const hours = Number(m[2] || 0);
    const minutes = Number(m[3] || 0);
    const seconds = Number(m[4] || 0);
    const total = days * 24 * 60 + hours * 60 + minutes + Math.round(seconds / 60);
    return total > 0 ? total : null;
}

function computeCookTimeMinutes(node) {
    const total = parseISODuration(node?.totalTime);
    if (total) return total;
    const cook = parseISODuration(node?.cookTime) ?? 0;
    const prep = parseISODuration(node?.prepTime) ?? 0;
    const sum = cook + prep;
    return sum > 0 ? sum : DEFAULT_COOK_TIME_MINUTES;
}

// Matches the same heuristic as the Gemini extraction prompt in
// src/lib/recipeExtraction.js, so a difficulty label means the same thing
// regardless of which capture path produced it.
function deriveDifficulty(cookTimeMinutes) {
    if (cookTimeMinutes < 20) return 'Easy';
    if (cookTimeMinutes <= 40) return 'Medium';
    return 'Hard';
}

// recipeYield shows up as "4", "4 servings", "Serves 4-6", ["4", "4 people"],
// etc. Grab the first integer we find; fall back to the app default rather
// than ever storing something nonsensical in base_servings.
function parseServings(recipeYield) {
    const str = Array.isArray(recipeYield) ? recipeYield.join(' ') : String(recipeYield ?? '');
    const match = str.match(/\d+/);
    if (!match) return null;
    const n = parseInt(match[0], 10);
    return Number.isFinite(n) && n > 0 ? n : null;
}

// nutrition.calories shows up as "270 kcal", "270 calories", "270", etc.
function parseKcal(nutrition) {
    const raw = nutrition?.calories;
    if (raw == null) return null;
    const match = String(raw).match(/[\d.]+/);
    if (!match) return null;
    const n = Math.round(parseFloat(match[0]));
    return Number.isFinite(n) ? n : null;
}

// author can be a string, a {name} object, a {@id} reference with no name
// (common on WordPress recipe plugins that point at a separate Person node
// we didn't bother resolving), or an array of any of those.
function extractCreator(author) {
    if (!author) return null;
    if (typeof author === 'string') return author.trim() || null;
    if (Array.isArray(author)) return extractCreator(author[0]);
    if (typeof author === 'object') return author.name?.trim() || null;
    return null;
}

function inferMealType(node) {
    const haystack = [node?.recipeCategory, node?.keywords, node?.name]
        .flatMap((v) => (Array.isArray(v) ? v : [v]))
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    if (/breakfast|brunch/.test(haystack)) return 'Breakfast';
    if (/\blunch\b/.test(haystack)) return 'Lunch';
    return 'Dinner';
}

// recipeIngredient is an array of raw strings like "1 1/2 cups flour" — parse
// each into {name, quantity, unit} with the `parse-ingredient` package, which
// handles mixed numbers ("1 1/2"), unicode vulgar fractions ("½"), decimals
// ("1.5"), and ranges ("2-3").
export function mapIngredients(rawList) {
    if (!Array.isArray(rawList)) return [];
    const cleaned = rawList.map((s) => String(s ?? '').trim()).filter(Boolean);
    if (!cleaned.length) return [];

    let parsed;
    try {
        parsed = parseIngredient(cleaned);
    } catch {
        return [];
    }

    return parsed
        .filter((ing) => !ing.isGroupHeader)
        .map((ing) => ({
            name: ing.description?.trim() || '',
            quantity: typeof ing.quantity === 'number' ? ing.quantity : null,
            unit: ing.unitOfMeasure || null,
        }))
        .filter((ing) => ing.name);
}

// recipeInstructions may be a plain string, an array of strings, an array of
// HowToStep objects, or HowToSection objects nesting their own
// itemListElement array of steps.
export function flattenInstructions(instructions) {
    if (!instructions) return [];

    if (typeof instructions === 'string') {
        return instructions
            .split(/\r?\n+/)
            .map((s) => s.trim())
            .filter(Boolean);
    }

    if (!Array.isArray(instructions)) return [];

    const steps = [];
    for (const item of instructions) {
        if (typeof item === 'string') {
            const trimmed = item.trim();
            if (trimmed) steps.push(trimmed);
        } else if (item && typeof item === 'object') {
            if (Array.isArray(item.itemListElement)) {
                steps.push(...flattenInstructions(item.itemListElement));
            } else if (typeof item.text === 'string' && item.text.trim()) {
                steps.push(item.text.trim());
            } else if (typeof item.name === 'string' && item.name.trim()) {
                steps.push(item.name.trim());
            }
        }
    }
    return steps;
}

// Maps a schema.org Recipe node to the app's recipe draft shape. Returns
// null if the result isn't usable (no title, no steps) so the caller can
// fall back to the Gemini text path instead of handing the review screen a
// half-empty recipe.
export function mapRecipeNode(node, sourceUrl) {
    const ingredients = mapIngredients(node?.recipeIngredient);
    if (!ingredients.length) return null;

    const title = firstString(node?.name);
    const steps = flattenInstructions(node?.recipeInstructions);
    if (!title || !steps.length) return null;

    const cookTimeMinutes = computeCookTimeMinutes(node);

    return {
        title,
        description: firstString(node?.description) || null,
        creator: extractCreator(node?.author),
        cook_time_minutes: cookTimeMinutes,
        difficulty: deriveDifficulty(cookTimeMinutes),
        kcal: parseKcal(node?.nutrition),
        base_servings: parseServings(node?.recipeYield) ?? DEFAULT_SERVINGS,
        meal_type: inferMealType(node),
        ingredients,
        steps,
        source_url: sourceUrl,
    };
}

// ---------------------------------------------------------------------------
// Fallback readable-text extraction (for the Gemini path)
// ---------------------------------------------------------------------------

function decodeEntities(str) {
    return str
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#0?39;/gi, "'")
        .replace(/&rsquo;/gi, '’')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

// Strips scripts/styles/nav chrome and tags, leaving a plain-text blob good
// enough to hand to Gemini the same way pasted text works today.
export function extractReadableText(html) {
    if (typeof html !== 'string') return '';

    let text = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<(nav|header|footer|aside|form)[^>]*>[\s\S]*?<\/\1>/gi, ' ');

    const bodyMatch = text.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) text = bodyMatch[1];

    text = text.replace(/<[^>]+>/g, ' ');
    text = decodeEntities(text);
    text = text.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();

    return text.slice(0, MAX_FALLBACK_TEXT_LENGTH);
}

export function extractHtmlTitle(html) {
    const match = typeof html === 'string' ? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) : null;
    return match ? decodeEntities(match[1]).trim() : null;
}

// ---------------------------------------------------------------------------
// URL / SSRF guards
// ---------------------------------------------------------------------------

export function isFetchableUrl(str) {
    let parsed;
    try {
        parsed = new URL(str);
    } catch {
        return false;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '0.0.0.0' || host === '::1') return false;
    if (/^127\./.test(host)) return false;
    if (/^10\./.test(host)) return false;
    if (/^192\.168\./.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
    if (/^169\.254\./.test(host)) return false;

    return true;
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

function jsonResponse(status, payload) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

export default async (req) => {
    if (req.method !== 'GET') {
        return jsonResponse(405, { error: 'Use GET with a ?url= parameter.' });
    }

    const requestedUrl = new URL(req.url).searchParams.get('url')?.trim();
    if (!requestedUrl) {
        return jsonResponse(400, { error: 'Missing url parameter.' });
    }
    if (!isFetchableUrl(requestedUrl)) {
        return jsonResponse(400, { error: 'That doesn\'t look like a fetchable web address.' });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let html;
    try {
        const response = await fetch(requestedUrl, {
            signal: controller.signal,
            redirect: 'follow',
            headers: {
                'User-Agent': USER_AGENT,
                Accept: 'text/html,application/xhtml+xml',
            },
        });

        if (!response.ok) {
            return jsonResponse(502, {
                error: `That page returned an error (${response.status}). Check the link${response.status === 404 ? ' — it may be broken or moved' : ''}, or paste the recipe text directly.`,
            });
        }

        const contentType = response.headers.get('content-type') ?? '';
        if (!/text\/html|application\/xhtml/i.test(contentType)) {
            return jsonResponse(415, { error: "That link doesn't point to a web page Meal Buddy can read." });
        }

        html = await response.text();
    } catch (err) {
        if (err?.name === 'AbortError') {
            return jsonResponse(504, { error: 'That page took too long to load. Try again, or paste the recipe text directly.' });
        }
        return jsonResponse(502, { error: "Couldn't reach that page. Check the link and try again." });
    } finally {
        clearTimeout(timeoutId);
    }

    const blocks = extractJsonLdBlocks(html);
    const recipeNode = findRecipeNode(blocks);
    const recipe = recipeNode ? mapRecipeNode(recipeNode, requestedUrl) : null;

    if (recipe) {
        return jsonResponse(200, { source: 'jsonld', recipe });
    }

    // No usable JSON-LD — fall back to handing the page's readable text to
    // the existing Gemini extraction path (done client-side, not here).
    const pageText = extractReadableText(html);
    if (pageText.length < MIN_FALLBACK_TEXT_LENGTH) {
        return jsonResponse(422, { error: "Couldn't find a recipe on that page. Try pasting the recipe text directly." });
    }

    return jsonResponse(200, {
        source: 'fallback',
        pageText,
        pageTitle: extractHtmlTitle(html),
        source_url: requestedUrl,
    });
};
