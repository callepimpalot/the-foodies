import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import {
    clearHousehold,
    ensureHousehold,
    getHouseholdId,
    getJoinCode,
    getJoinCodeIsLocal,
    joinWithCode,
} from '../lib/household';
import {
    acceptInvite,
    clearCachedHouseholdData,
    createInvite,
    createOrClaimHousehold,
    getMembership,
    listMembers,
    removeMember,
    renameHousehold,
    setActiveHouseholdHeader,
    transferOwnership,
} from '../lib/households';
import { useAuth } from './AuthContext';

const HouseholdContext = createContext();

// The legacy device path (no session) creates a household in Supabase if it can
// and locally if it cannot. Two simultaneous providers must not create two
// households — share one in-flight attempt at module scope, as TASK_07 did.
let legacyInflight = null;

function ensureLegacyHouseholdOnce() {
    if (!legacyInflight) {
        legacyInflight = ensureHousehold().finally(() => { legacyInflight = null; });
    }
    return legacyInflight;
}

/**
 * FAMILY HOUSEHOLDS — resolves which household this device is planning for.
 *
 * The resolution has two arms, and the boundary is a session:
 *
 *   signed in  -> the household comes from household_members. The id is the one
 *                 the membership row says, decided by the database, never by a
 *                 value this device asserts. A session with no membership yet
 *                 (fresh sign-up) claims the device's legacy household or creates
 *                 a new one, both through security-definer RPCs.
 *   signed out -> the legacy TASK_07 path, unchanged: the device-held household
 *                 id (localStorage), created locally when the backend is gone.
 *                 This is the "he dismisses the sign-up prompt and the app keeps
 *                 working exactly as before" arm (Flow A).
 *
 * The rest of the app never learns which arm is active: Plan/Shop/Inventory read
 * `useHousehold().id` and get the right answer either way. That is the TASK_07
 * context boundary holding one layer up, which is the whole point of the feature.
 */
export function HouseholdProvider({ children }) {
    const { user, loading: authLoading, signOut: authSignOut } = useAuth();

    const [state, setState] = useState(() => {
        const id = getHouseholdId();
        return {
            id,
            name: 'Our household',
            role: null,
            isOwner: false,
            members: [],
            joinCode: getJoinCode(),
            remote: id ? !getJoinCodeIsLocal() : false,
            ready: false,
            status: id ? 'idle' : 'creating',
            error: null,
        };
    });

    const mounted = useRef(true);
    const userId = user?.id ?? null;

    // Signed-in arm: resolve the household from membership, then its members.
    useEffect(() => {
        if (authLoading) return;
        if (!userId) return; // signed-out arm is a separate effect below

        let cancelled = false;

        (async () => {
            try {
                let membership = await getMembership();

                if (!membership) {
                    // A real session but no membership: claim the legacy device
                    // household if there is one, otherwise create a fresh one.
                    const legacyId = getHouseholdId();
                    const created = await createOrClaimHousehold(legacyId);
                    if (!created.ok) {
                        if (!cancelled) setState((p) => ({ ...p, ready: true, status: 'error', error: created.error ?? new Error('household') }));
                        return;
                    }
                    membership = { id: created.id, name: created.name, role: 'owner', isOwner: true, displayName: null };
                }

                setActiveHouseholdHeader(membership.id);

                if (!cancelled) {
                    setState((p) => ({
                        ...p,
                        id: membership.id,
                        name: membership.name,
                        role: membership.role,
                        isOwner: membership.isOwner,
                        ready: true,
                        status: 'idle',
                        error: null,
                    }));
                }

                const members = await listMembers(membership.id);
                if (!cancelled) setState((p) => ({ ...p, members }));
            } catch (err) {
                // Unreachable is not signed out. Keep whatever id we have; the
                // synced documents treat a thrown loadRemote as offline.
                console.warn('Meal Buddy: household resolution unavailable, staying on the current id.', err);
                if (!cancelled) setState((p) => ({ ...p, ready: true, status: p.id ? 'idle' : 'error', error: err }));
            }
        })();

        return () => { cancelled = true; };
    }, [userId, authLoading]);

    // Signed-out arm: the legacy device path, unchanged.
    useEffect(() => {
        if (authLoading) return;
        if (userId) return;

        mounted.current = true;

        ensureLegacyHouseholdOnce()
            .then((result) => {
                if (!mounted.current) return;
                setActiveHouseholdHeader(result.id);
                setState((p) => ({
                    ...p,
                    id: result.id,
                    name: 'Our household',
                    role: null,
                    isOwner: false,
                    members: [],
                    joinCode: result.joinCode,
                    remote: result.remote,
                    ready: true,
                    status: 'idle',
                }));
            })
            .catch((err) => {
                if (!mounted.current) return;
                setState((p) => ({ ...p, ready: true, status: 'error', error: err }));
            });

        return () => { mounted.current = false; };
    }, [userId, authLoading]);

    /** Legacy join-by-code (the Q6 small-print fallback). Signed-out arm only. */
    const join = async (code) => {
        setState((p) => ({ ...p, status: 'joining', error: null }));
        const result = await joinWithCode(code);
        if (!result.ok) {
            setState((p) => ({ ...p, status: 'idle', error: result.reason }));
            return result;
        }
        setActiveHouseholdHeader(result.id);
        setState((p) => ({
            ...p,
            id: result.id,
            joinCode: String(code ?? '').trim().toUpperCase(),
            remote: true,
            ready: true,
            status: 'idle',
            error: null,
        }));
        return result;
    };

    /** Legacy "start over on this device". */
    const forget = () => {
        clearHousehold();
        setState((p) => ({ ...p, id: null, joinCode: '', remote: false, ready: false, status: 'creating', error: null }));
        ensureLegacyHouseholdOnce().then((result) => {
            setActiveHouseholdHeader(result.id);
            setState((p) => ({
                ...p,
                id: result.id,
                joinCode: result.joinCode,
                remote: result.remote,
                ready: true,
                status: 'idle',
            }));
        });
    };

    // ---- the authenticated surface (owner + member actions) ----------------

    const refreshMembers = useCallback(async () => {
        if (!state.id) return;
        try {
            const members = await listMembers(state.id);
            setState((p) => ({ ...p, members }));
        } catch { /* unreachable; keep the current list */ }
    }, [state.id]);

    const inviteMember = async () => {
        if (!state.id) return { ok: false, reason: 'unconfigured' };
        return createInvite(state.id);
    };

    const accept = async (token) => {
        const result = await acceptInvite(token);
        if (result.ok) await refreshMembers();
        return result;
    };

    const remove = async (memberUserId) => {
        if (!state.id) return { ok: false, reason: 'unconfigured' };
        const result = await removeMember(state.id, memberUserId);
        if (result.ok) await refreshMembers();
        return result;
    };

    const rename = async (name) => {
        if (!state.id) return { ok: false, reason: 'unconfigured' };
        const result = await renameHousehold(state.id, name);
        if (result.ok) setState((p) => ({ ...p, name }));
        return result;
    };

    const transferOwner = async (newOwnerUserId) => {
        if (!state.id) return { ok: false, reason: 'unconfigured' };
        const result = await transferOwnership(state.id, newOwnerUserId);
        if (result.ok) await refreshMembers();
        return result;
    };

    /** Sign out: drop the session AND clear the cached household data, so the
     *  next person to open the app on this device does not see this household's
     *  plan, list or pantry (the brief names this edge case explicitly). */
    const signOut = async () => {
        clearCachedHouseholdData();
        await authSignOut();
    };

    return (
        <HouseholdContext.Provider value={{
            ...state,
            isAuthed: Boolean(userId),
            user,
            join,
            forget,
            signOut,
            inviteMember,
            accept,
            remove,
            rename,
            transferOwner,
            refreshMembers,
        }}>
            {children}
        </HouseholdContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useHousehold() {
    const context = useContext(HouseholdContext);
    if (!context) {
        throw new Error('useHousehold must be used within a HouseholdProvider');
    }
    return context;
}