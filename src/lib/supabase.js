import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const isValidUrl = (url) => {
    try {
        return url && (url.startsWith('https://') || url.startsWith('http://'));
    } catch (e) {
        return false;
    }
};

const isConfigured = isValidUrl(supabaseUrl) && supabaseAnonKey && supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY';

if (!isConfigured) {
    console.warn('Supabase is not configured. Check your .env file.');
}

export const supabase = isConfigured
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
