
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const [, , rawTitle, imageUrl] = process.argv;

if (!rawTitle || !imageUrl) {
    console.error('❌ Usage: node update_supabase_image.js "Recipe Title" "/assets/path/to/image.jpg"');
    process.exit(1);
}

// Explicitly map " and " back to "&" if passed without ampersands for shell safety
const title = rawTitle.replace(/\s+and\s+/gi, ' & ');

async function updateImage() {
    console.log(`\n🔄 Updating "${title}" (Raw input: "${rawTitle}")...`);
    console.log(`   -> New Image: ${imageUrl}`);

    // 1. Update Supabase
    const { data, error } = await supabase
        .from('recipes')
        .update({ image_url: imageUrl })
        .ilike('title', `%${title}%`)
        .select();

    if (error) {
        console.error('   ❌ Supabase Update Failed:', error.message);
        // Do not exit, try local JSON
    } else if (data && data.length === 0) {
        console.error('   ❌ Recipe not found in Supabase (Check exact title match).');
        // Do not exit, try local JSON
    } else {
        console.log('   ✅ Supabase Updated!');
    }

    // 2. Update Local JSON (final_recipes.json)
    const jsonPath = path.resolve(__dirname, '../../final_recipes.json');
    try {
        const fileData = fs.readFileSync(jsonPath, 'utf8');
        const recipes = JSON.parse(fileData);
        const recipeIndex = recipes.findIndex(r => r.title === title);

        if (recipeIndex !== -1) {
            recipes[recipeIndex].image_url = imageUrl;
            fs.writeFileSync(jsonPath, JSON.stringify(recipes, null, 4));
            console.log('   ✅ final_recipes.json Updated!');
        } else {
            console.warn('   ⚠️ Recipe not found in local JSON.');
        }
    } catch (err) {
        console.error('   ⚠️ Failed to update local JSON:', err.message);
    }
}

updateImage();
