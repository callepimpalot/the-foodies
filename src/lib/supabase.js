import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const isValidUrl = (url) => {
    try {
        return url && (url.startsWith('https://') || url.startsWith('http://'));
    } catch {
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

/**
 * TASK_07 — tell PostgREST which household this client is speaking for.
 *
 * The interim security model in `supabase/migrations/20260926_task07_household_planning.sql`
 * reads this header in `request_household_id()`, and every policy on the new
 * tables compares it to the row's household_id. Without it a query returns
 * nothing — deliberately: `household_id = NULL` is never true, so the "no header"
 * case denies instead of opening up.
 *
 * `supabase.rest.headers` is a WHATWG `Headers` instance in supabase-js v2
 * (`PostgrestClient`: `this.headers = new Headers(headers)`) and `from()` copies
 * it per query, so `.set()` here affects every subsequent request. Verified
 * against the installed version (2.95.3) — if that package is ever bumped across
 * a major, re-check it, because a silent failure here would look like "the plan
 * stopped saving" rather than like a broken header.
 */
export function setHouseholdHeader(id) {
    const headers = supabase?.rest?.headers;
    if (!headers) return false;

    if (id) {
        // Guard against a stale id from another household lingering on a request.
        headers.set('x-household-id', String(id));
        return true;
    }

    if (typeof headers.delete === 'function') headers.delete('x-household-id');
    return true;
}
