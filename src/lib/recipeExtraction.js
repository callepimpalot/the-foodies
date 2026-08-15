import { GoogleGenAI } from '@google/genai';
import { normalizeImage, fileToBase64 } from './imageUtils';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

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
- kcal: estimate per serving if not stated; use your best judgement, do not leave null unless truly impossible to estimate.
- base_servings: the number of people the recipe serves as written.`;

const REFINE_SCHEMA = {
    type: 'object',
    properties: {
        recipe: RECIPE_SCHEMA,
        changeSummary: { type: 'string' },
    },
    required: ['recipe', 'changeSummary'],
};

const REFINE_PROMPT = `You are helping refine a recipe based on a follow-up request, like sparring
with a chef before committing to a final version. You'll be given the current recipe as JSON and a
request describing a change. Apply the request and return the complete updated recipe (not just the
changed fields) plus a one-sentence summary of what you changed.

Rules:
- Apply only what's asked, but adjust anything that logically follows — e.g. scaling servings scales
  every ingredient quantity proportionally; swapping an ingredient keeps a sensible quantity/unit for
  the replacement; removing an ingredient also removes or rewrites any step that specifically calls
  for it.
- Keep everything else identical to the current recipe unless the request requires changing it.
- changeSummary should be short and human, e.g. "Scaled to 4 servings and swapped carrots for cucumbers."`;

export function cleanJson(text) {
    return (text ?? '').replace(/```json/g, '').replace(/```/g, '').trim();
}

function assertConfigured() {
    if (!ai) {
        throw new Error('Recipe capture is not configured — missing VITE_GEMINI_API_KEY.');
    }
}

// Extracts a recipe from any combination of pasted text and attached images (screenshots/photos).
// At least one of text or images must be provided.
export async function extractRecipe({ text, images = [] } = {}) {
    assertConfigured();

    const hasText = !!text?.trim();
    const hasImages = images.length > 0;
    if (!hasText && !hasImages) {
        throw new Error('Add some text or at least one photo before extracting.');
    }

    let promptText = EXTRACTION_PROMPT;
    if (hasText) promptText += `\n\nPASTED TEXT:\n${text.trim()}`;
    if (hasImages) promptText += `\n\n(${images.length} image${images.length > 1 ? 's are' : ' is'} attached below.)`;

    const parts = [{ text: promptText }];
    for (const file of images) {
        const normalized = await normalizeImage(file);
        const { base64, mimeType } = await fileToBase64(normalized);
        parts.push({ inlineData: { mimeType, data: base64 } });
    }

    let response;
    try {
        response = await ai.models.generateContent({
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

    const raw = cleanJson(response.text);
    if (!raw) throw new Error('Gemini returned an empty response — the image or text may be unreadable.');
    return JSON.parse(raw);
}

// Applies one follow-up instruction to an already-extracted recipe draft, e.g. "make it 4 servings"
// or "swap carrots for cucumbers". Returns the updated recipe plus a short human-readable summary.
export async function refineRecipe(currentRecipe, instruction) {
    assertConfigured();
    if (!instruction?.trim()) {
        throw new Error('Describe what you want to change.');
    }

    let response;
    try {
        response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${REFINE_PROMPT}\n\nCURRENT RECIPE:\n${JSON.stringify(currentRecipe)}\n\nREQUEST:\n${instruction.trim()}`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: REFINE_SCHEMA,
                maxOutputTokens: 8192,
            },
        });
    } catch (err) {
        throw describeApiError(err);
    }

    const raw = cleanJson(response.text);
    if (!raw) throw new Error('Gemini returned an empty response.');
    const parsed = JSON.parse(raw);
    return { recipe: parsed.recipe, changeSummary: parsed.changeSummary };
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
        return new Error('Gemini rate limit or quota reached — wait a minute and try again.');
    }
    if (status === 'INVALID_ARGUMENT' || code === 400) {
        return new Error(`Gemini rejected the request (${raw.slice(0, 200)}).`);
    }
    if (code === 401 || code === 403) {
        return new Error('Gemini API key was rejected — check VITE_GEMINI_API_KEY.');
    }
    return new Error(raw);
}
