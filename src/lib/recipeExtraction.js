import { GoogleGenAI } from '@google/genai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

// Matches the real Supabase `recipes` columns (see scripts/import-to-supabase.ts),
// not the stale .agent/DATA_MODELS.md interface.
const RECIPE_SCHEMA = {
    type: 'object',
    properties: {
        title: { type: 'string' },
        description: { type: 'string' },
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
provided content (pasted text, or a photo/screenshot of a recipe).

Rules:
- If a field isn't present in the source, use a sensible default rather than leaving it out.
- difficulty: derive from cook time and technique if not stated — under 20min simple prep = Easy, 20-40min = Medium, over 40min or technical = Hard.
- meal_type: infer from the dish itself (a dessert or dinner-style dish is "Dinner" unless clearly a breakfast/lunch dish).
- ingredients: split into clean {name, quantity, unit} — name should never include the quantity.
- steps: each entry is one complete instruction, not a sentence fragment.
- kcal: estimate per serving if not stated; use your best judgement, do not leave null unless truly impossible to estimate.
- base_servings: the number of people the recipe serves as written.`;

function cleanJson(text) {
    return (text ?? '').replace(/```json/g, '').replace(/```/g, '').trim();
}

function assertConfigured() {
    if (!ai) {
        throw new Error('Recipe capture is not configured — missing VITE_GEMINI_API_KEY.');
    }
}

export async function extractRecipeFromText(pastedText) {
    assertConfigured();

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `${EXTRACTION_PROMPT}\n\nSOURCE TEXT:\n${pastedText}`,
        config: {
            responseMimeType: 'application/json',
            responseSchema: RECIPE_SCHEMA,
        },
    });

    return JSON.parse(cleanJson(response.text));
}

export async function extractRecipeFromImage(imageFile) {
    assertConfigured();

    const { base64, mimeType } = await fileToBase64(imageFile);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            { text: EXTRACTION_PROMPT },
            { inlineData: { mimeType, data: base64 } },
        ],
        config: {
            responseMimeType: 'application/json',
            responseSchema: RECIPE_SCHEMA,
        },
    });

    return JSON.parse(cleanJson(response.text));
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            resolve({ base64: result.split(',')[1], mimeType: file.type });
        };
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
    });
}
