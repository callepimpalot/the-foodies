import { normalizeImage, fileToBase64 } from './imageUtils';
import { unitSystemInstruction, getUnitSystem } from './unitPreference';
import { withValidStepIngredients, matchIngredientIndexes } from './stepIngredients';
import { convertIngredient } from './unitConversion';
import { geminiGenerateContent } from './geminiClient';

// Matches the real Supabase `recipes` columns (see scripts/import-to-supabase.ts),
// not the stale .agent/DATA_MODELS.md interface.
export const RECIPE_SCHEMA = {
    type: 'object',
    properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        creator: { type: 'string', nullable: true },
        cook_time_minutes: { type: 'integer' },
        difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
        kcal: { type: 'integer', nullable: true },
        base_servings: { type: 'integer' },
        meal_type: { type: 'string', enum: ['Breakfast', 'Lunch', 'Dinner'] },
        ingredients: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    quantity: { type: 'number', nullable: true },
                    unit: { type: 'string', nullable: true },
                },
                required: ['name'],
            },
        },
        steps: { type: 'array', items: { type: 'string' } },
        // TASK_10 — per-step ingredient links, one entry per step, each an array of
        // indexes into `ingredients`. Kept PARALLEL to `steps` rather than turning
        // steps into objects, because `recipes.steps` is `text[]` in Supabase and
        // cannot carry them inline. Deliberately NOT in `required`: if the model
        // omits it, Cook Mode falls back to runtime matching and nothing breaks.
        step_ingredients: {
            type: 'array',
            items: { type: 'array', items: { type: 'integer' } },
            nullable: true,
        },
    },
    required: ['title', 'cook_time_minutes', 'difficulty', 'base_servings', 'meal_type', 'ingredients', 'steps'],
};


const EXTRACTION_PROMPT = `You are a recipe extraction assistant. Extract a structured recipe from the
provided content, which may include pasted text, one or more photos/screenshots, or both together
(e.g. a screenshot of a recipe plus typed notes about it — combine every source into one recipe).

Rules:
- If multiple images are provided, synthesize them into one recipe — e.g. one screenshot may show
  ingredients and another the steps, or a photo of a handwritten card plus a typed correction.
- If a screenshot includes social-media chrome (likes, comments, unrelated captions), ignore that
  and extract only the actual recipe content — except the poster's username/handle, which is the
  primary source for the creator field below (see that rule before discarding anything).
- title: if the source doesn't clearly state a dish name, suggest a fitting, appetizing one yourself
  based on the main ingredients and cooking method (e.g. "Garlic Butter Chicken Thighs") — never
  leave it generic like "Recipe" or "Untitled".
- creator: actively look for who this recipe is from — a poster's username/handle in a screenshot
  (e.g. the @handle above or below the photo/video), a blog or publication name, a cookbook or
  chef's name in a byline. Extract it exactly as written (e.g. "@claudiasoncooks", "Half Baked
  Harvest", "Jamie Oliver"). Only leave this null if truly nothing in the source identifies an
  author or account — never guess or invent a name.
- If a field isn't present in any source, use a sensible default rather than leaving it out — except
  creator, which should stay null rather than be guessed.
- difficulty: derive from cook time and technique if not stated — under 20min simple prep = Easy, 20-40min = Medium, over 40min or technical = Hard.
- meal_type: infer from the dish itself (a dessert or dinner-style dish is "Dinner" unless clearly a breakfast/lunch dish).
- ingredients: split into clean {name, quantity, unit} — name should never include the quantity.
- steps: each entry is one complete instruction, not a sentence fragment.
- step_ingredients: exactly one entry per step, in the same order as steps. Each entry lists the
  0-based indexes into the ingredients array that the step actually uses. A step that uses no
  ingredients ("Preheat the oven to 200C") gets an empty array — never omit an entry to skip it, or
  every later step would be misaligned. Include an ingredient whenever the step plausibly uses it;
  a missing link means the cook doesn't add something, an extra one is just a glance.
- kcal: estimate per serving if not stated; use your best judgement, do not leave null unless truly impossible to estimate.
- base_servings: the number of people the recipe serves as written.
- units: {{UNIT_INSTRUCTION}}`;

export const REFINE_SCHEMA = {
    type: 'object',
    properties: {
        recipe: RECIPE_SCHEMA,
        changeSummary: { type: 'string' },
        // A short per-field review — which fields changed and why, which were deliberately left
        // alone. It exists so a silent no-op ("I applied your change" while changing nothing)
        // becomes visible instead of being claimed. Optional: a model that omits it is accepted.
        review: { type: 'array', items: { type: 'string' }, nullable: true },
    },
    required: ['recipe', 'changeSummary'],
};

// A chef-EDITOR, not a patcher. The two measured failures this prompt is built to stop are a
// change that touches only 2 of 11 steps, and a rewrite that is hedged and wordy ("breaking it
// apart with a wooden spatula if minced, or searing if diced/sliced") instead of sweeping the
// whole recipe. So it states an explicit propagation checklist, the FIELD CONTRACT the code-side
// sanitiser enforces anyway, and it tells the model to REWRITE every step rather than edit in
// place. It deliberately carries NO unit-system instruction — unit conversion is done in code
// (see unitConversion.js and refineRecipe below), because doing that arithmetic in prose is what
// destroyed the ingredient rows in the first place.
export const REFINE_PROMPT = `You are a chef-editor refining a recipe. You are given the current recipe as JSON,
the conversation so far, and the latest request. Apply the request and return the COMPLETE updated recipe
(not just the changed fields), a one-sentence change summary, and a short per-field review.

Work as an editor, not a patcher. Before you emit anything, walk this propagation checklist and make the
recipe agree with itself everywhere the change reaches:

1. INGREDIENT SWAP — when one ingredient replaces another: update EVERY step that names the old
   ingredient to name the replacement, and update the technique and timing if the replacement cooks
   differently (a quick-seared chicken breast does not braise like pork mince). Keep a sensible
   quantity and unit for the replacement.
2. INGREDIENT REMOVAL — when an ingredient is removed: delete it from the list AND delete or rewrite
   every step that uses it, so no step ever calls for something that is gone.
3. SCALING — when the servings change: scale every ingredient quantity by the same factor, scale kcal
   to the new per-serving value, and set base_servings to the new number.
4. CHARACTER CHANGE — a change to the dish's character (spicier, lighter, dairy-free, vegetarian, …) is
   applied consistently everywhere it matters, INCLUDING the title and the description, not only the
   ingredient list.
5. DERIVED FIELDS — cook_time_minutes, difficulty and description must follow the change that was made;
   never leave them stale when the change affects them.

Rewrite the WHOLE \`steps\` array from the recipe you are returning — re-read every step against the new
ingredient list rather than editing steps in place. A step that is hedged, half-updated, or that still
names an ingredient the recipe no longer has is a failure.

FIELD CONTRACT (a wrong value here is worse than a missing one — the app repairs or rejects violations):
- ingredient.name is a SHORT ingredient name ONLY. Never a quantity, never a unit, never an explanation,
  and at most about 60 characters. "Chicken breast" — never "Chicken breast (about 500g, cook to 74°C
  because lean meat dries out)".
- ingredient.quantity is a number or null. NEVER a string.
- ingredient.unit is a bare unit token of at most about 12 characters. Never digits, never the ingredient
  name, never a whole sentence. "g", "ml", "tbsp", "cloves".
- Do NOT convert unit systems and do NOT do unit arithmetic. The app converts units deterministically
  after you reply. Keep each quantity in the unit it already had unless the request itself changes it.
- step_ingredients: omit it. The app recomputes the step -> ingredient links from your returned steps.

changeSummary: one short human sentence, e.g. "Swapped pork mince for chicken breast and adjusted step 5."
review: a short list of which fields you changed and why, and which you deliberately left alone — so a
  change that quietly did nothing becomes visible, e.g. "steps 5-6: renamed pork -> chicken",
  "kcal: unchanged (no serving change)".
Return only the JSON object.`;

// Names longer than this are the model narrating its reasoning into the field rather than naming an
// ingredient. Measured: one probe returned a ~1,300-character deliberation as an ingredient field.
export const MAX_INGREDIENT_NAME_LENGTH = 60;
const MAX_UNIT_LENGTH = 12;
const QUANTITY_FROM_UNIT_MAX = 40;
const MEASUREMENT_IN_NAME = /(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|oz|lb|tsp|tbsp|cups?|cloves?|stalks?|pinch(?:es)?)\b/i;

function isBlank(value) {
    return value == null || (typeof value === 'string' && !value.trim());
}

function normalizeNameKey(name) {
    return typeof name === 'string' ? name.trim().toLowerCase().replace(/\s+/g, ' ') : '';
}

// Cut a narration or a quantity+unit back to a short ingredient name. "Chicken breast, diced or
// minced (…)" -> "Chicken breast". Returns null when nothing usable is left.
function cleanName(rawName) {
    if (typeof rawName !== 'string') return null;
    let name = rawName.trim();
    if (!name) return null;
    if (name.length > MAX_INGREDIENT_NAME_LENGTH || MEASUREMENT_IN_NAME.test(name)) {
        const leading = name.split(/\s*[,(]|\s+-\s+|\s+or\s+/i)[0].trim();
        name = leading || name;
        // drop a leading measurement, e.g. "500 g chicken" -> "chicken"
        name = name.replace(/^\d+(?:[.,]\d+)?\s*(g|kg|ml|l|oz|lb|tsp|tbsp|cups?|cloves?|stalks?)\b\.?\s*/i, '').trim();
    }
    if (!name || name.length > MAX_INGREDIENT_NAME_LENGTH) {
        name = name.split(/\s+/).slice(0, 4).join(' ').trim();
    }
    return name || null;
}

// A unit is a bare token: at most MAX_UNIT_LENGTH characters, no digits, no spaces. "g  Pork mince
// 250" -> "g"; "g, diced or minced (…)" -> "g"; "ml" -> "ml"; "cloves" -> "cloves".
function cleanUnit(rawUnit) {
    if (isBlank(rawUnit) || typeof rawUnit !== 'string') return null;
    const token = rawUnit.trim().split(/[\s,]+/)[0].replace(/[^A-Za-z°]/g, '');
    if (!token) return null;
    return token.slice(0, MAX_UNIT_LENGTH).toLowerCase();
}

// A number the model crammed into a unit field. Only recovered from a SHORT unit string, where the
// reading is unambiguous ("g  Pork mince  250" -> 250). A long unit is narration full of unrelated
// numbers (74°C, 2-3 breasts, 500g) and is not trusted.
function quantityFromStuffedUnit(rawUnit) {
    if (typeof rawUnit !== 'string') return null;
    const raw = rawUnit.trim();
    if (!raw || raw.length > QUANTITY_FROM_UNIT_MAX) return null;
    const match = raw.match(/(\d+(?:[.,]\d+)?)/);
    if (!match) return null;
    const n = Number(match[1].replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

// The unit string carries text it should not: digits, more than one word, or the ingredient's own name.
function unitIsStuffed(rawUnit, name) {
    if (typeof rawUnit !== 'string') return false;
    const raw = rawUnit.trim();
    if (!raw) return false;
    if (/\d/.test(raw)) return true;
    if (raw.split(/\s+/).length > 1) return true;
    const key = normalizeNameKey(name);
    return !!key && raw.toLowerCase().includes(key);
}

// Find the input ingredient this refined row corresponds to: by name first (a scale or a reorder
// keeps names), then by position (a swap changes the name but keeps the slot).
function findBeforeIngredient(name, index, beforeIngredients) {
    const key = normalizeNameKey(name);
    if (key) {
        const byName = beforeIngredients.find((b) => normalizeNameKey(b?.name) === key);
        if (byName) return byName;
    }
    if (index != null && index < beforeIngredients.length) return beforeIngredients[index];
    return null;
}

/**
 * Sanitise a refined recipe against the recipe it was derived from.
 *
 * The refine turn is the one place a model rewrites a whole row, and it is the place two measured
 * defects live: a rich `{quantity, unit}` pair collapsing to a bare unit, and a name/number crammed
 * into the unit string. This function repairs both and HARD-REFUSES to let a measurement the input
 * carried disappear — if the model dropped it, the input's quantity+unit are restored for the
 * ingredients the model did not deliberately re-measure.
 *
 * It also does two things the model must not be trusted with:
 *   - `step_ingredients` is RECOMPUTED from the RETURNED steps and ingredients via the app's own
 *     matcher, never copied from the model's index arithmetic.
 *   - `kcal` is recomputed deterministically when base_servings changes (per-serving).
 *
 * Returns { recipe, warning } — warning is a human string when anything had to be repaired, so the
 * UI can say so, or null.
 */
export function sanitiseRefinedRecipe(before, after) {
    if (!after || typeof after !== 'object') return { recipe: after, warning: null };

    const state = { repaired: false, restored: false, stuffed: false };
    const beforeIngredients = Array.isArray(before?.ingredients) ? before.ingredients : [];
    const recipe = { ...after };

    if (Array.isArray(after.ingredients)) {
        recipe.ingredients = after.ingredients.map((raw, index) => {
            const source = raw ?? {};
            const out = {};

            // --- name ---
            let name = cleanName(source.name);
            if (name == null) {
                const fallback = beforeIngredients[index];
                name = typeof fallback?.name === 'string' ? fallback.name : null;
                if (name) state.repaired = true;
            } else if (name !== source.name) {
                state.repaired = true;
            }
            out.name = name;

            // --- unit ---
            const rawUnit = source.unit;
            const stuffed = unitIsStuffed(rawUnit, name);
            if (stuffed) state.stuffed = true;
            let unit = cleanUnit(rawUnit);
            if (unit !== null && typeof rawUnit === 'string' && unit !== rawUnit.trim().toLowerCase()) {
                state.repaired = true;
            }

            // --- quantity ---
            let quantity = null;
            if (typeof source.quantity === 'number' && Number.isFinite(source.quantity)) {
                quantity = source.quantity;
            } else if (typeof source.quantity === 'string' && source.quantity.trim()) {
                const n = Number(source.quantity.replace(',', '.'));
                quantity = Number.isFinite(n) ? n : null;
                state.repaired = true;
            }
            if (quantity == null && stuffed) {
                const recovered = quantityFromStuffedUnit(rawUnit);
                if (recovered != null) { quantity = recovered; state.repaired = true; }
            }

            // HARD REFUSE: the input carried a measurement and the refined row lost it. Restore the
            // input's quantity AND unit (they are a pair — a restored number under a half-converted
            // unit would be a new corruption) unless the model deliberately re-measured.
            const anchor = findBeforeIngredient(name, index, beforeIngredients);
            if (quantity == null && typeof anchor?.quantity === 'number' && Number.isFinite(anchor.quantity)) {
                quantity = anchor.quantity;
                state.restored = true;
                const anchorUnit = cleanUnit(anchor.unit);
                if (anchorUnit) unit = anchorUnit;
            }

            out.unit = unit;
            if (quantity != null) out.quantity = quantity;
            return out;
        });
    }

    // --- kcal tracks base_servings, deterministically ---
    const beforeServings = Number(before?.base_servings);
    const afterServings = Number(recipe.base_servings);
    const beforeKcal = before?.kcal;
    if (
        Number.isFinite(beforeServings) && beforeServings > 0 &&
        Number.isFinite(afterServings) && afterServings > 0 &&
        afterServings !== beforeServings &&
        typeof beforeKcal === 'number' && Number.isFinite(beforeKcal)
    ) {
        const scaled = Math.round(beforeKcal * afterServings / beforeServings);
        if (scaled !== recipe.kcal) state.repaired = true;
        recipe.kcal = scaled;
    }

    // --- step_ingredients is RECOMPUTED from the returned steps, never trusted ---
    if (Array.isArray(recipe.steps) && Array.isArray(recipe.ingredients)) {
        recipe.step_ingredients = recipe.steps.map((step) => matchIngredientIndexes(step, recipe.ingredients));
    }

    const notes = [];
    if (state.stuffed) notes.push('the model crammed a name/number into a unit field');
    if (state.restored) notes.push('a measurement the input carried was restored from the input');
    if (state.repaired) notes.push('a malformed field was repaired');
    const warning = notes.length ? `Refine result was repaired in code — ${notes.join('; ')}.` : null;
    return { recipe, warning };
}

export function cleanJson(text) {
    return (text ?? '').replace(/```json/g, '').replace(/```/g, '').trim();
}

// Extracts a recipe from any combination of pasted text and attached images (screenshots/photos).
// At least one of text or images must be provided.
export async function extractRecipe({ text, images = [] } = {}) {
    const hasText = !!text?.trim();
    const hasImages = images.length > 0;
    if (!hasText && !hasImages) {
        throw new Error('Add some text or at least one photo before extracting.');
    }

    let promptText = EXTRACTION_PROMPT.replace('{{UNIT_INSTRUCTION}}', unitSystemInstruction());
    if (hasText) promptText += `\n\nPASTED TEXT:\n${text.trim()}`;
    if (hasImages) promptText += `\n\n(${images.length} image${images.length > 1 ? 's are' : ' is'} attached below.)`;

    const parts = [{ text: promptText }];
    for (const file of images) {
        const normalized = await normalizeImage(file);
        const { base64, mimeType } = await fileToBase64(normalized);
        parts.push({ inlineData: { mimeType, data: base64 } });
    }

    let rawText;
    try {
        rawText = await geminiGenerateContent({
            model: 'gemini-2.5-flash',
            contents: parts,
            config: {
                responseMimeType: 'application/json',
                responseSchema: RECIPE_SCHEMA,
                maxOutputTokens: 8192,
            },
        });
    } catch (err) {
        throw describeApiError(err);
    }

    const raw = cleanJson(rawText);
    if (!raw) throw new Error('The AI returned an empty response — the image or text may be unreadable.');
    return withValidStepIngredients(JSON.parse(raw));
}

// Applies one follow-up instruction to an already-extracted recipe draft, e.g. "make it 4 servings"
// or "swap carrots for cucumbers". Returns the updated recipe plus a short human-readable summary.
//
// STATEFUL SPARRING (TASK_11): `options.history` is the accumulated `[{ instruction, changeSummary }]`
// from earlier turns, so a SECOND instruction ("actually make it less spicy") knows what the first one
// did. The third argument is optional, so existing two-argument callers keep working unchanged.
//
// The model is trusted ONLY for the language of the recipe. Unit conversion, `step_ingredients`, the
// kcal/servings invariant and the ingredient field contract are all done in code afterwards — see
// sanitiseRefinedRecipe() and unitConversion.js.
export async function refineRecipe(currentRecipe, instruction, options = {}) {
    if (!instruction?.trim()) {
        throw new Error('Describe what you want to change.');
    }

    const history = Array.isArray(options?.history) ? options.history : [];
    const conversation = history.length
        ? '\n\nCONVERSATION SO FAR (instructions you already applied, oldest first — build on these, do not undo them):\n'
            + history.map((turn, i) => {
                const summary = turn?.changeSummary ? `\n   You changed: ${turn.changeSummary}` : '';
                return `${i + 1}. Request: ${turn?.instruction ?? ''}${summary}`;
            }).join('\n')
        : '';

    let text;
    try {
        text = await geminiGenerateContent({
            model: 'gemini-2.5-flash',
            contents: `${REFINE_PROMPT}${conversation}\n\nCURRENT RECIPE:\n${JSON.stringify(currentRecipe)}\n\nREQUEST:\n${instruction.trim()}`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: REFINE_SCHEMA,
                maxOutputTokens: 8192,
            },
        });
    } catch (err) {
        throw describeApiError(err);
    }

    const raw = cleanJson(text);
    if (!raw) throw new Error('The AI returned an empty response.');
    const parsed = JSON.parse(raw);

    // Repair + verify the model's output, THEN convert units — deterministically, in code.
    const { recipe, warning } = sanitiseRefinedRecipe(currentRecipe, parsed.recipe);
    if (Array.isArray(recipe?.ingredients)) {
        const system = getUnitSystem();
        recipe.ingredients = recipe.ingredients.map((ing) => convertIngredient(ing, system));
    }

    return {
        recipe,
        changeSummary: parsed.changeSummary,
        review: Array.isArray(parsed.review) ? parsed.review : undefined,
        warning,
    };
}

// URL capture (TASK_08): a fast, free, deterministic path IN FRONT of the Gemini extraction
// above — not a replacement for it. Calls the netlify/functions/fetch-recipe.js function, which
// fetches the page server-side (a browser can't, CORS) and either:
//   - finds schema.org/Recipe JSON-LD and returns an already-mapped recipe (no Gemini call), or
//   - finds no usable JSON-LD and returns the page's readable text instead, which we then run
//     through the SAME extractRecipe() above — no duplicated extraction logic.
export async function extractRecipeFromUrl(url) {
    const trimmedUrl = url?.trim();
    if (!trimmedUrl) {
        throw new Error('Paste a recipe URL first.');
    }

    let response;
    try {
        response = await fetch(`/.netlify/functions/fetch-recipe?url=${encodeURIComponent(trimmedUrl)}`);
    } catch {
        throw new Error("Couldn't reach the recipe fetcher. Check your connection and try again.");
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
        throw new Error(
            "The recipe-fetching function isn't available here. If you're running `npm run dev`, use `netlify dev` instead so Netlify Functions are served locally."
        );
    }

    let body;
    try {
        body = await response.json();
    } catch {
        throw new Error("Couldn't read that page — the fetcher returned something unexpected.");
    }

    if (!response.ok || body?.error) {
        throw new Error(body?.error || `Couldn't fetch that page (${response.status}).`);
    }

    if (body?.source === 'jsonld' && body?.recipe) {
        return { ...body.recipe, capture_image_url: body.imageUrl ?? null };
    }

    if (body?.source === 'fallback' && body?.pageText) {
        const recipe = await extractRecipe({ text: body.pageText });
        // capture_image_url is app metadata, not a Gemini field: it's the picture that came
        // with the source (a social post's photo, or the blog's own image). The review screen
        // attaches it and saving re-uploads it, so the stored recipe never hotlinks a CDN
        // URL that expires.
        return {
            ...recipe,
            source_url: body.source_url ?? trimmedUrl,
            capture_image_url: body.imageUrl ?? null,
        };
    }

    throw new Error("Couldn't find a recipe on that page. Try pasting the recipe text directly.");
}

// Translates raw Gemini API errors into something a user's error message can actually reflect,
// instead of a one-size-fits-all "couldn't read that recipe."
export function describeApiError(err) {
    const raw = err?.message ?? String(err);
    let code = err?.status ?? null;
    let status = null;
    try {
        const parsed = JSON.parse(raw);
        code = parsed?.error?.code ?? code;
        status = parsed?.error?.status ?? null;
    } catch {
        // not a JSON error body — fall through with whatever we already have
    }

    if (status === 'RESOURCE_EXHAUSTED' || code === 429) {
        return new Error('The AI is rate limited or out of quota — wait a minute and try again.');
    }
    if (status === 'INVALID_ARGUMENT' || code === 400) {
        return new Error(`The AI rejected the request (${raw.slice(0, 200)}).`);
    }
    if (code === 401 || code === 403) {
        return new Error('The AI service rejected its API key — check the provider key set in Netlify.');
    }
    return new Error(raw);
}
