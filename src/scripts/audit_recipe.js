
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectRecipe() {
    console.log("Fetching 'Street Tacos'...");
    const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .ilike('title', '%Street Tacos%')
        .limit(1);

    if (error) {
        console.error("Error:", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No recipe found. Listing first 5 recipes to check keys...");
        const { data: listData } = await supabase.from('recipes').select('*').limit(5);
        console.log(JSON.stringify(listData, null, 2));
    } else {
        console.log("--- Recipe Data ---");
        console.log(JSON.stringify(data[0], null, 2));
        console.log("--- Keys ---");
        console.log(Object.keys(data[0]));
    }
}

inspectRecipe();
