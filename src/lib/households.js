import { supabase, setHouseholdHeader } from './supabase';

/**
 * FAMILY HOUSEHOLDS — the membership and invite layer over the RPCs added in
 * `supabase/migrations/20261026_family_households_schema.sql`.
 *
 * This is the authenticated half of the household story. It sits beside
 * `src/lib/household.js`, which stays as the LEGACY device-held path (the
 * localStorage id that TASK_07 introduced) and is only used when there is no
 * session. Everything here presupposes auth.uid() is set, because every RPC and
 * policy below resolves membership through it — the client never asserts which
 * household it belongs to.
 *
 * Naming: these are MEMBERS. The roles are 'owner' and 'member'. There is no
 * "child user" and no "sub-user" anywhere in this surface.
 */

/** The caller's membership row joined to its household; the first one (Q3: one
 *  household is exposed in the UI even though the schema allows several). */
export async function getMembership() {
    if (!supabase) return null;
    const { data: sessionData } = await supabase.auth.getUser();
    const userId = sessionData?.user?.id;
    if (!userId) return null;

    const { data, error } = await supabase
        .from('household_members')
        .select('household_id, role, display_name, households(name)')
        .eq('user_id', userId)
        .limit(1);
    if (error || !data?.length) return null;

    const row = data[0];
    return {
        id: row.household_id,
        role: row.role ?? 'member',
        isOwner: row.role === 'owner',
        displayName: row.display_name ?? null,
        name: row.households?.name ?? 'Our household',
    };
}

/** Everyone in the household, for the Profile screen. */
export async function listMembers(householdId) {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('household_members')
        .select('user_id, role, display_name, joined_at')
        .eq('household_id', householdId)
        .order('joined_at');
    if (error) throw error;
    return (data ?? []).map((m) => ({
        userId: m.user_id,
        role: m.role,
        displayName: m.display_name,
        joinedAt: m.joined_at,
    }));
}

/**
 * Ask the database to mint an invite token. Owner-only (the RPC refuses
 * otherwise). The token goes in the share link — never a household id.
 */
export async function createInvite(householdId) {
    if (!supabase) return { ok: false, reason: 'unconfigured' };
    const { data, error } = await supabase.rpc('create_invite', { p_household_id: householdId });
    if (error) return { ok: false, reason: 'error', error };
    return { ok: true, token: data };
}

/** Redeem an invite token. Only works once, and only before expiry. */
export async function acceptInvite(token) {
    if (!supabase) return { ok: false, reason: 'unconfigured' };
    const { data, error } = await supabase.rpc('accept_invite', { p_token: token });
    if (error) return { ok: false, reason: 'error', message: error.message, error };
    const row = Array.isArray(data) ? data[0] : data;
    return { ok: true, id: row?.household_id, name: row?.household_name };
}

/** The owner removes another member. Refused by RLS for non-owners and by the
 *  trigger when it would strand the household. */
export async function removeMember(householdId, userId) {
    if (!supabase) return { ok: false, reason: 'unconfigured' };
    const { error } = await supabase.from('household_members').delete()
        .eq('household_id', householdId).eq('user_id', userId);
    if (error) return { ok: false, reason: 'error', error };
    return { ok: true };
}

export async function renameHousehold(householdId, name) {
    if (!supabase) return { ok: false, reason: 'unconfigured' };
    const { error } = await supabase
        .from('households')
        .update({ name })
        .eq('id', householdId);
    if (error) return { ok: false, reason: 'error', error };
    return { ok: true };
}

export async function transferOwnership(householdId, newOwnerUserId) {
    if (!supabase) return { ok: false, reason: 'unconfigured' };
    const { error } = await supabase.rpc('transfer_ownership', {
        p_household_id: householdId,
        p_new_owner_user_id: newOwnerUserId,
    });
    if (error) return { ok: false, reason: 'error', error };
    return { ok: true };
}

/**
 * Turn a legacy device-held household id into a claimed household, or create a
 * fresh one, for the signed-in user. This is migration Step 2+3 from the brief.
 *
 *  - If `legacyId` is provided, claim_household() attaches the user as owner and
 *    stamps the device's captures — idempotent for the same user.
 *  - If claiming fails (e.g. the legacy id was already claimed by someone else),
 *    fall back to creating a new household rather than wedging the user.
 *  - If no legacy id, create a brand-new household with the user as owner.
 */
export async function createOrClaimHousehold(legacyId) {
    if (!supabase) return { ok: false, reason: 'unconfigured' };

    if (legacyId) {
        const { data, error } = await supabase.rpc('claim_household', { p_legacy_id: legacyId });
        if (!error && Array.isArray(data) && data[0]?.id) {
            const h = data[0];
            return { ok: true, id: h.id, name: h.name ?? 'Our household', claimed: true };
        }
        // Claim failed — do not wedge the user; create a new household below.
        console.warn('Meal Buddy: household claim did not complete; creating a new one.', error);
    }

    const { data: created, error: cErr } = await supabase.rpc('create_household_for_user', {});
    if (cErr || !Array.isArray(created) || !created[0]?.id) {
        return { ok: false, reason: 'error', error: cErr };
    }
    const h = created[0];
    return { ok: true, id: h.id, name: h.name ?? 'Our household', claimed: false };
}

/**
 * Point every subsequent PostgREST request at the active household through the
 * TASK_07 header. Pre-tighten this is what the policies read; post-tighten it is
 * inert (membership decides) but harmless. Kept so the dual-read period stays
 * honest — the header and the session describe the same household.
 */
export function setActiveHouseholdHeader(id) {
    setHouseholdHeader(id);
}

// The three synced-document cache keys, as defined locally in PlanContext,
// ShopContext and InventoryContext. Sign-out must clear them (plus their parked
// pending copies) so the next person on this device does not see this
// household's plan, list or pantry — the brief names this edge case explicitly.
const SYNCED_CACHE_KEYS = [
    'meal_buddy_plan_doc',
    'meal_buddy_shop_doc',
    'meal_buddy_essentials_doc',
];

export function clearCachedHouseholdData() {
    if (typeof window === 'undefined') return;
    const storage = window.localStorage;
    for (const key of SYNCED_CACHE_KEYS) {
        try {
            storage.removeItem(key);
            storage.removeItem(`${key}__pending`);
        } catch { /* a blocked localStorage must not break sign-out */ }
    }
}