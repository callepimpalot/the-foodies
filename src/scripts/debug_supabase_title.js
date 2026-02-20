
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTitle() {
    console.log('Checking recipes with "Salmon"...');
    const { data, error } = await supabase
        .from('recipes')
        .select('title, id')
        .ilike('title', '%Salmon%');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Found:', data);
    }
}

checkTitle();
