import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
if (!GEMINI_API_KEY) throw new Error('VITE_GEMINI_API_KEY missing from .env');

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const BATCH_SIZE = 10;
const DELAY_MS = 2000;
const TOP_N = 400;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Load input
// ---------------------------------------------------------------------------

const recipes = JSON.parse(fs.readFileSync('data/stage2-passed.json', 'utf-8'));
console.log(`Loaded ${recipes.length} recipes. Starting scoring...`);

const scored: any[] = [];
const batches: any[][] = [];
for (let i = 0; i < recipes.length; i += BATCH_SIZE) {
    batches.push(recipes.slice(i, i + BATCH_SIZE));
}
console.log(`Total batches: ${batches.length}`);

// ---------------------------------------------------------------------------
// Batch loop
// ---------------------------------------------------------------------------

for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`Processing batch ${i + 1}/${batches.length}...`);

    const prompt = `You are a meal planning expert helping a modern European family plan weeknight dinners.
Score each recipe below on THREE dimensions, each from 1-5:

PRACTICALITY (1-5): Can a non-chef make this on a busy weeknight with ingredients findable in a standard European supermarket? 5=yes absolutely, 1=no chance.
MODERNITY (1-5): Does this feel like something people actually eat today in 2025? 5=very current, 1=dated or niche.
FAMILY (1-5): Would this work as a meal for a family with children? 5=perfect family meal, 1=impractical for kids.
COOK TIME: Estimate total cook time in minutes based on the directions.

Recipes:
${batch.map((r: any, idx: number) => `
${idx + 1}. TITLE: ${r.title}
   INGREDIENTS: ${r.ingredients?.slice(0, 6).join(', ')}
   DIRECTIONS: ${r.directions?.[0]?.slice(0, 100)}
   CATEGORIES: ${r.categories?.slice(0, 5).join(', ')}
`).join('')}

Return exactly ${batch.length} objects, one per recipe, in order.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            index: { type: 'integer' },
                            practicality: { type: 'integer' },
                            modernity: { type: 'integer' },
                            family: { type: 'integer' },
                            estimatedCookMinutes: { type: 'integer' },
                        },
                        required: ['index', 'practicality', 'modernity', 'family', 'estimatedCookMinutes'],
                    },
                },
            },
        });

        const scores = JSON.parse(response.text ?? '[]');

        if (!Array.isArray(scores)) {
            console.log(`⚠ Batch ${i + 1} — response not an array, skipping`);
            await delay(DELAY_MS);
            continue;
        }

        for (let j = 0; j < batch.length; j++) {
            const score = scores[j];
            if (!score) continue;
            const combined = (score.practicality + score.modernity + (score.family * 1.5)) / 3.5;
            scored.push({
                ...batch[j],
                aiPracticality: score.practicality,
                aiModernity: score.modernity,
                aiFamily: score.family,
                aiCombinedScore: Math.round(combined * 100) / 100,
                estimatedCookMinutes: score.estimatedCookMinutes ?? 30,
            });
        }

        console.log(`✓ Batch ${i + 1}/${batches.length} complete — total scored: ${scored.length}`);
    } catch (err) {
        console.log(`⚠ Batch ${i + 1} failed — skipping. Error: ${err instanceof Error ? err.message : err}`);
    }

    await delay(DELAY_MS);
}

// ---------------------------------------------------------------------------
// Sort and save top 400
// ---------------------------------------------------------------------------

scored.sort((a, b) => {
    if (b.aiCombinedScore !== a.aiCombinedScore) return b.aiCombinedScore - a.aiCombinedScore;
    return (b.rating ?? 0) - (a.rating ?? 0);
});

const final = scored.slice(0, TOP_N);
fs.writeFileSync('data/stage3-final.json', JSON.stringify(final, null, 2));

console.log('');
console.log('==========================================');
console.log('STAGE 3 COMPLETE');
console.log('==========================================');
console.log(`Total scored: ${scored.length}`);
console.log(`Final selection: ${final.length}`);
console.log('Top 10 recipes:');
final.slice(0, 10).forEach((r: any, i: number) => {
    console.log(`  ${i + 1}. [${r.aiCombinedScore}] ${r.title}`);
});
console.log('==========================================');
