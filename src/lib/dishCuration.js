import { GoogleGenAI } from '@google/genai';
import { RECIPE_SCHEMA, cleanJson, describeApiError } from './recipeExtraction';
import { unitSystemInstruction } from './unitPreference';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

export const REJECTION_REASONS = [
    'Too heavy',
    'Had this recently',
    'Not feeling it',
    'Too much effort',
    'Wrong season',
];

// Picks an explicit meal count out of the opening message ("4 meals", "3 dinners") — returns null
// when none is stated, so the UI can ask instead of guessing at how many dishes to curate.
export function parseTargetCount(text) {
    const match = (text ?? '').match(/\b(\d{1,2})\b\s*(meals?|dinners?|dishes|recipes|days?)/i);
    if (!match) return null;
    const n = parseInt(match[1], 10);
    return n >= 1 && n <= 20 ? n : null;
}

const DISH_SCHEMA = {
    type: 'object',
    properties: {
        source: { type: 'string', enum: ['library', 'generated'] },
        libraryIndex: { type: 'integer', nullable: true },
        recipe: { ...RECIPE_SCHEMA, nullable: true },
        reasoning: { type: 'string' },
    },
    required: ['source', 'reasoning'],
};

const PROPOSE_PROMPT = `You are proposing ONE dish at a time for a home cook building out a set of
meals — like a chef suggesting one option, hearing "yes / tweak it / no," then suggesting the next.
You'll be given JSON data with:
- constraints: the user's original request in their own words (protein, diet, cuisine, effort, etc.)
- acceptedDishes: dishes already kept for this batch ({title, tags}) — actively vary what you propose
  against these: don't repeat a protein or cuisine that's already well represented, aim for a genuinely
  balanced spread across the whole batch, the way a good week of meals should feel varied rather than
  repetitive
- rejectedForThisSlot: dishes already turned down for this specific slot in this session ({title,
  reason}) — never propose the same dish again for this slot, and actively steer away from whatever the
  reason implies (e.g. "too heavy" means lean lighter next time, "too much effort" means simpler)
- libraryShortlist: a condensed, 0-indexed array of the user's existing recipe library ({id, title,
  meal_type, tags, kcal, difficulty}) to match against — reference an entry by its position in this
  array, never by copying its id
- forceGenerated: if true, the user has explicitly asked for something NOT from their library — you
  MUST use source "generated" this turn, even if a library dish would otherwise fit well. Do not
  reference libraryShortlist at all when this is true.
- customRequest: if forceGenerated is true, an optional specific ask from the user for this invented
  dish (e.g. "something with lamb," "a Thai dish") — satisfy it specifically if given; if it's empty,
  just invent something good that fits constraints/acceptedDishes/rejectedForThisSlot as usual.

Propose exactly one dish:
- If forceGenerated is true: invent a brand-new dish (source "generated") satisfying customRequest (if
  given) and everything else above — skip the library matching step entirely.
- Otherwise, prefer source "library" — pick the best fit from libraryShortlist given constraints, what's
  already accepted, and what's been rejected, and reference it via libraryIndex, the integer position of
  that entry in libraryShortlist (0 for the first entry) — never an index outside its length, never a
  dish already in acceptedDishes or rejectedForThisSlot. Only use source "generated" here — inventing a
  brand-new dish — when nothing in the library reasonably fits everything above.
- A "generated" dish needs a full recipe body: title, description, cook_time_minutes, difficulty, kcal,
  base_servings, meal_type, ingredients, steps. For its ingredients: {{UNIT_INSTRUCTION}}
- reasoning: one short, human sentence on why THIS dish fits right now, e.g. "A lighter vegetarian
  option to balance yesterday's beef stew." This is shown directly to the user — make it genuinely
  specific to this batch, not generic filler.`;

function assertConfigured() {
    if (!ai) {
        throw new Error('Dish curation is not configured — missing VITE_GEMINI_API_KEY.');
    }
}

// Proposes one dish given what's already been accepted (to balance against) and what's already been
// rejected for this specific slot (never repeated). Used both for the first proposal in a slot and
// every "reject, try again" that follows.
export async function proposeDish({ constraints, acceptedDishes, rejectedForThisSlot, libraryShortlist, forceGenerated, customRequest }) {
    assertConfigured();

    const payload = {
        constraints: constraints ?? '',
        acceptedDishes: acceptedDishes ?? [],
        rejectedForThisSlot: rejectedForThisSlot ?? [],
        libraryShortlist,
        forceGenerated: !!forceGenerated,
        customRequest: customRequest?.trim() || null,
    };

    const prompt = PROPOSE_PROMPT.replace('{{UNIT_INSTRUCTION}}', unitSystemInstruction());

    let response;
    try {
        response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${prompt}\n\nDATA:\n${JSON.stringify(payload)}`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: DISH_SCHEMA,
                maxOutputTokens: 4096,
            },
        });
    } catch (err) {
        throw describeApiError(err);
    }

    const raw = cleanJson(response.text);
    if (!raw) throw new Error('Gemini returned an empty response.');
    const parsed = JSON.parse(raw);

    const recipeId = parsed.source === 'library' ? (libraryShortlist?.[parsed.libraryIndex]?.id ?? null) : null;

    return {
        source: parsed.source,
        recipeId,
        recipe: parsed.recipe ?? null,
        reasoning: parsed.reasoning ?? '',
    };
}
