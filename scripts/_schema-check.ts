import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

// Fetch one row to see real column names
const { data, error } = await sb.from('recipes').select('*').limit(1);

if (error) {
    console.log('ERROR:', error.message);
} else if (!data || data.length === 0) {
    // Table is empty — try an insert with no fields to get the schema error listing columns
    console.log('Table is empty. Trying information_schema query...');
    const { data: cols, error: colErr } = await sb
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'recipes')
        .order('column_name');
    if (colErr) {
        console.log('Schema query error:', colErr.message);
    } else {
        console.log('COLUMNS:', cols?.map((c: Record<string, unknown>) => c.column_name).join(', '));
    }
} else {
    console.log('COLUMNS:', Object.keys(data[0]).join(', '));
    console.log('\nSAMPLE ROW (first record):');
    console.log(JSON.stringify(data[0], null, 2));
}
