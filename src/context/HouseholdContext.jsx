import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
    clearHousehold,
    ensureHousehold,
    getHouseholdId,
    getJoinCode,
    getJoinCodeIsLocal,
    joinWithCode,
} from '../lib/household';

const HouseholdContext = createContext();

// Module-scope so simultaneous callers share one attempt — see the note in the
// provider's mount effect. Cleared as soon as it settles; a later call starts a
// fresh one, which is correct because ensureHousehold() re-reads the stored id
// first and returns the existing household rather than making another.
let inflight = null;

function ensureHouseholdOnce() {
    if (!inflight) {
        inflight = ensureHousehold().finally(() => { inflight = null; });
    }
    return inflight;
}

/**
 * TASK_07 — who this device is planning for.
 *
 * Deliberately tiny. It exists so Plan/Shop/Inventory don't each read
 * localStorage for the household id (three copies of the same credential is how
 * one of them ends up stale), and so the join screen has one obvious home.
 *
 * On mount it ensures a household exists, creating one if this device has never
 * had one. `remote: false` means Supabase was unconfigured or unreachable and the
 * household is device-local — the app is fully usable, it just isn't shared yet,
 * and the UI says so instead of leaving Casper to wonder why.
 */
export function HouseholdProvider({ children }) {
    const [state, setState] = useState(() => {
        const id = getHouseholdId();
        return {
            id,
            joinCode: getJoinCode(),
            remote: id ? !getJoinCodeIsLocal() : false,
            ready: false,
            status: id ? 'idle' : 'creating',
            error: null,
        };
    });

    // StrictMode double-invokes effects in dev, and a remount must not strand the
    // result: two concurrent `ensureHousehold()` calls would create two households
    // (the loser becoming invisible), and a per-effect `cancelled` flag would drop
    // the answer of a promise whose effect was already cleaned up. So one in-flight
    // promise is shared at module scope, and whoever is mounted last adopts it.
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;

        ensureHouseholdOnce()
            .then((result) => {
                if (!mounted.current) return;
                setState((prev) => ({
                    ...prev,
                    id: result.id,
                    joinCode: result.joinCode,
                    remote: result.remote,
                    ready: true,
                    status: 'idle',
                }));
            })
            .catch((err) => {
                if (!mounted.current) return;
                setState((prev) => ({ ...prev, ready: true, status: 'error', error: err }));
            });

        return () => { mounted.current = false; };
    }, []);

    /**
     * Adopt a household from its code. On success the three synced documents
     * reload themselves, because `id` changes and their load effect keys on it —
     * which is the behaviour that matters: after joining, this device shows the
     * other phone's plan, not its own.
     */
    const join = async (code) => {
        setState((prev) => ({ ...prev, status: 'joining', error: null }));
        const result = await joinWithCode(code);

        if (!result.ok) {
            setState((prev) => ({ ...prev, status: 'idle', error: result.reason }));
            return result;
        }

        setState((prev) => ({
            ...prev,
            id: result.id,
            joinCode: String(code ?? '').trim().toUpperCase(),
            remote: true,
            ready: true,
            status: 'idle',
            error: null,
        }));
        return result;
    };

    /** Start over on this device. The old household's rows are left alone. */
    const forget = () => {
        clearHousehold();
        setState({ id: null, joinCode: '', remote: false, ready: false, status: 'creating', error: null });
        ensureHousehold().then((result) => {
            setState((prev) => ({
                ...prev,
                id: result.id,
                joinCode: result.joinCode,
                remote: result.remote,
                ready: true,
                status: 'idle',
            }));
        });
    };

    return (
        <HouseholdContext.Provider value={{ ...state, join, forget }}>
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
