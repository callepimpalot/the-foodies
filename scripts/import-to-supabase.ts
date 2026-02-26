// scripts/import-to-supabase.ts
// Imports data/stage3-final.json into the Supabase `recipes` table.
// Run with: npx tsx scripts/import-to-supabase.ts

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) throw new Error('VITE_SUPABASE_URL missing from .env');
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('VITE_SUPABASE_SERVICE_ROLE_KEY missing from .env');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INPUT_PATH = 'data/stage3-final.json';
const INSERT_DELAY_MS = 300;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const sanitizeString = (str: string): string => {
    if (!str) return '';
    return str
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
};

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------

const raw: Record<string, unknown>[] = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf-8'));
console.log(`Loaded ${raw.length} recipes from ${INPUT_PATH}\n`);

// ---------------------------------------------------------------------------
// Import loop
// ---------------------------------------------------------------------------

let inserted = 0;
let skipped = 0;
let failed = 0;

for (let i = 0; i < raw.length; i++) {
    const recipe = raw[i];
    const title = sanitizeString(String(recipe?.title ?? ''));

    if (!title) {
        console.log(`✗ Failed: (index ${i}) — title is empty after sanitization`);
        failed++;
        await delay(INSERT_DELAY_MS);
        continue;
    }

    // --- Deduplication check ---
    const { data: existing, error: checkError } = await supabase
        .from('recipes')
        .select('id')
        .ilike('title', title)
        .limit(1);

    if (checkError) {
        console.log(`✗ Failed: "${title}" — dedup check error: ${checkError?.message}`);
        failed++;
        await delay(INSERT_DELAY_MS);
        continue;
    }

    if (existing && existing?.length > 0) {
        console.log(`⊘ Skipped: "${title}" (duplicate)`);
        skipped++;
        await delay(INSERT_DELAY_MS);
        continue;
    }

    // --- Field mapping ---
    const caloriesRaw = recipe?.calories;
    const kcalValue = typeof caloriesRaw === 'number'
        ? Math.round(caloriesRaw)
        : null;

    const cookMins = typeof recipe?.estimatedCookMinutes === 'number'
        ? recipe.estimatedCookMinutes
        : 30;

    const ingredientStrings: string[] = Array.isArray(recipe?.ingredients)
        ? recipe.ingredients as string[]
        : [];

    const parsedIngredients = ingredientStrings.map((str: string) => ({
        name: sanitizeString(str),
        quantity: null,
        unit: null,
    }));

    const directionsRaw: string[] = Array.isArray(recipe?.directions)
        ? recipe.directions as string[]
        : [];

    const steps = directionsRaw.map((d: string) => sanitizeString(d));

    const categoriesRaw: string[] = Array.isArray(recipe?.categories)
        ? recipe.categories as string[]
        : [];

    const row = {
        id: crypto.randomUUID(),
        title,
        description: sanitizeString(String(recipe?.desc ?? '')),
        image_url: null,
        cook_time_minutes: cookMins,
        difficulty: recipe?.difficulty != null ? sanitizeString(String(recipe.difficulty)) : null,
        kcal: kcalValue,
        base_servings: 4,
        meal_type: recipe?.mealType != null ? sanitizeString(String(recipe.mealType)) : null,
        tags: categoriesRaw.map(c => sanitizeString(c)).filter(s => s.length > 0),
        archetypes: [],
        ingredients: parsedIngredients,
        steps,
        is_personal: false,
        created_at: new Date().toISOString(),
    };

    // --- Insert ---
    const { error: insertError } = await supabase.from('recipes').insert(row);

    if (insertError) {
        console.log(`✗ Failed: "${title}" — ${insertError?.message}`);
        failed++;
    } else {
        console.log(`✓ Inserted: "${title}"`);
        inserted++;
    }

    await delay(INSERT_DELAY_MS);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('');
console.log(`Import complete. ${inserted} inserted, ${skipped} skipped, ${failed} failed.`);
