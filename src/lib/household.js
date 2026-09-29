import { supabase, setHouseholdHeader } from './supabase';

// TASK_07 — the household identity, and the whole of the join flow.
//
// There is no account here. The household id in localStorage IS the credential,
// exactly as TASK_07 describes, and this file is where that is made explicit
// rather than accidental:
//
//   * it is stored under a clearly-named key, not woven into each context,
//   * it is attached to every Supabase request as `x-household-id`, so the
//     database can enforce "you may only touch the household you presented"
//     (see the migration for precisely what that does and does not buy),
//   * and it is generated locally when Supabase is unconfigured or unreachable,
//     so the app keeps working with no backend at all — which is how it works
//     today, and which is the state the free tier's pause puts it in.
//
// TASK_12 replaces all of this with auth.users + household_members. When it
// lands, the id stays (it becomes the household the user belongs to) and this
// file loses `resolveJoinCode` to a real invite flow.

const STORAGE_KEY = 'meal_buddy_household_id';
const STORAGE_KEY_JOIN_CODE = 'meal_buddy_household_code';
const STORAGE_KEY_JOIN_CODE_IS_LOCAL = 'meal_buddy_household_code_is_local';

function safeGet(key) {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function safeSet(key, value) {
    try {
        if (value == null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
    } catch {
        /* private mode / full quota: the app still works, in memory only */
    }
}

/** A short, unambiguous code for the local-only case (no Supabase configured). */
export function generateLocalJoinCode() {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    const bytes = new Uint8Array(8);
    if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
    for (let i = 0; i < 8; i += 1) {
        const n = bytes[i] || Math.floor(Math.random() * 256);
        code += alphabet[n % alphabet.length];
    }
    return code;
}

export function getHouseholdId() {
    const id = safeGet(STORAGE_KEY);
    if (id) setHouseholdHeader(id);
    return id;
}

export function getJoinCode() {
    return safeGet(STORAGE_KEY_JOIN_CODE) ?? '';
}

/** True when the code shown belongs to a device-local household, not a real row. */
export function getJoinCodeIsLocal() {
    return safeGet(STORAGE_KEY_JOIN_CODE_IS_LOCAL) === 'true';
}

export function setHousehold(id, { joinCode = null, joinCodeIsLocal = false } = {}) {
    safeSet(STORAGE_KEY, id);
    if (joinCode != null) safeSet(STORAGE_KEY_JOIN_CODE, joinCode);
    safeSet(STORAGE_KEY_JOIN_CODE_IS_LOCAL, joinCodeIsLocal ? 'true' : 'false');
    setHouseholdHeader(id);
    return id;
}

export function clearHousehold() {
    safeSet(STORAGE_KEY, null);
    safeSet(STORAGE_KEY_JOIN_CODE, null);
    safeSet(STORAGE_KEY_JOIN_CODE_IS_LOCAL, null);
    setHouseholdHeader(null);
}

/**
 * Get this device's household, creating one if it has none.
 *
 * Returns `{ id, joinCode, remote }`:
 *   remote: true  — a real row exists in Supabase, and the planning tables accept
 *                   writes scoped to `id`
 *   remote: false — Supabase is unconfigured or unreachable, so this is a
 *                   device-local household. Everything still works from the
 *                   write-through cache; it just isn't shared yet. Surfaced in
 *                   the UI rather than hidden, because "why doesn't my wife see
 *                   it" is the question this state produces.
 */
export async function ensureHousehold(name) {
    const existing = getHouseholdId();
    if (existing) {
        return { id: existing, joinCode: getJoinCode(), remote: !getJoinCodeIsLocal() };
    }

    if (supabase) {
        try {
            const { data, error } = await supabase.rpc('create_household', {
                p_name: name ?? null,
            });
            const row = Array.isArray(data) ? data[0] : data;
            if (!error && row?.id) {
                setHousehold(row.id, { joinCode: row.join_code, joinCodeIsLocal: false });
                return { id: row.id, joinCode: row.join_code, remote: true };
            }
            console.warn('Meal Buddy: could not create a household remotely, going local.', error);
        } catch (err) {
            console.warn('Meal Buddy: household creation failed, going local.', err);
        }
    }

    const localId = globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}`;
    const code = generateLocalJoinCode();
    setHousehold(localId, { joinCode: code, joinCodeIsLocal: true });
    return { id: localId, joinCode: code, remote: false };
}

/**
 * Turn a typed code into a household this device can adopt.
 *
 * Two paths, and the local one is not a sneaky fallback: without Supabase there
 * is no table to look the code up in, so a code can only be meaningful if the
 * two devices are pointed at the same backend. In the local case this returns an
 * explicit `unsupported` rather than silently pretending to join.
 */
export async function joinWithCode(code) {
    const trimmed = (code ?? '').trim().toUpperCase();
    if (!trimmed) return { ok: false, reason: 'empty' };

    if (!supabase) return { ok: false, reason: 'unsupported' };

    try {
        const { data, error } = await supabase.rpc('resolve_join_code', { p_code: trimmed });
        if (error) return { ok: false, reason: 'error', error };

        const id = typeof data === 'string' ? data : data?.[0]?.resolve_join_code ?? null;
        if (!id) return { ok: false, reason: 'not_found' };

        setHousehold(id, { joinCode: trimmed, joinCodeIsLocal: false });
        return { ok: true, id };
    } catch (err) {
        return { ok: false, reason: 'error', error: err };
    }
}
