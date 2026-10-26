import { supabase } from './supabase';

/**
 * FAMILY HOUSEHOLDS — the auth layer, a thin wrapper over supabase.auth.
 *
 * The whole point of this feature is that the household credential stops being a
 * uuid in localStorage and becomes a real session the database can verify. This
 * file is where that session is created, held and dropped. It deliberately keeps
 * the surface tiny so the rest of the app does not grow a second opinion about
 * who is signed in.
 *
 * Two rules that cost nothing here and everything if broken:
 *   * "Supabase unreachable" is NOT "signed out". A paused free-tier project must
 *     not log the user out and dump them onto a sign-in screen — the brief calls
 *     that out by name. Callers treat a thrown error as "offline", not "anonymous".
 *   * The session is persisted by supabase-js in localStorage by default. Do not
 *     disable it: the Shop tab has to work in a supermarket basement.
 */

function isConfigured() {
    return Boolean(supabase);
}

/**
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function signUp(email, password) {
    if (!isConfigured()) return { ok: false, error: 'Backend not configured.' };
    const { data, error } = await supabase.auth.signUp({
        email: (email ?? '').trim(),
        password,
        options: { emailRedirectTo: window?.location?.origin ?? undefined },
    });
    if (error) return { ok: false, error: error.message };
    // A confirmed session appears immediately when email confirmation is off;
    // when it is on, the user must confirm first and `.session` is null.
    return { ok: true, needsConfirmation: !data?.session };
}

/**
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function signIn(email, password) {
    if (!isConfigured()) return { ok: false, error: 'Backend not configured.' };
    const { error } = await supabase.auth.signInWithPassword({
        email: (email ?? '').trim(),
        password,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
}

export async function signOut() {
    if (!isConfigured()) return;
    await supabase.auth.signOut();
}

/**
 * Subscribe to session changes. Returns an unsubscribe function.
 * @param {(session: object|null) => void} cb
 */
export function onAuthStateChange(cb) {
    if (!isConfigured()) return () => {};
    const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
    return () => data?.subscription?.unsubscribe?.();
}

export async function getSession() {
    if (!isConfigured()) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session ?? null;
}