// scripts/stage3-debug.ts
// Debug: print raw Gemini API response for ONE recipe then exit.
// Run with: npx tsx scripts/stage3-debug.ts

import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
if (!GEMINI_API_KEY) throw new Error('VITE_GEMINI_API_KEY missing from .env');

const MODEL = 'gemini-3-flash-preview';
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const candidates = JSON.parse(fs.readFileSync('data/stage2-passed.json', 'utf-8'));
const recipe = candidates[0];

const prompt = `You are a meal planning expert helping a modern European family plan weeknight dinners.
Score each recipe below on THREE dimensions, each from 1-5:

PRACTICALITY (1-5): Can a non-chef make this on a busy weeknight with ingredients 
findable in a standard European supermarket? 
5 = absolutely yes, 1 = no chance.

MODERNITY (1-5): Does this feel like something people actually eat today in 2025? 
5 = very current and appealing, 1 = dated or niche.

FAMILY (1-5): Would this work as a meal for a family with children? 
5 = perfect family meal, 1 = too adventurous or impractical for kids.

Also estimate cook time in minutes based on the directions text.

Recipes to score:

1. TITLE: ${recipe?.title}
   INGREDIENTS: ${(recipe?.ingredients ?? []).slice(0, 8).join(', ')}
   DIRECTIONS PREVIEW: ${(recipe?.directions?.[0] ?? '').slice(0, 150)}
   CATEGORIES: ${(recipe?.categories ?? []).join(', ')}

Return ONLY a valid JSON array. No markdown. No explanation. No backticks.
Each object must have exactly these fields:
[
  { "index": 1, "practicality": 4, "modernity": 5, "family": 4, "estimatedCookMinutes": 25 }
]
Return scores for all 1 recipes in order. No extra text.`;

console.log('=== RECIPE BEING SENT ===');
console.log('Title:', recipe?.title);
console.log('');

console.log('=== SENDING REQUEST TO:', URL.split('?')[0], '===\n');

const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1000 },
    }),
});

console.log('HTTP STATUS:', res.status, res.statusText);
console.log('');

const raw = await res.text();

console.log('=== RAW RESPONSE BODY ===');
console.log(raw);
console.log('=========================');

// Also try to parse and extract the text field specifically
try {
    const parsed = JSON.parse(raw);
    const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('\n=== EXTRACTED TEXT FIELD ===');
    console.log(JSON.stringify(text));
    console.log('============================');
} catch {
    console.log('\n(Could not parse response as JSON)');
}
