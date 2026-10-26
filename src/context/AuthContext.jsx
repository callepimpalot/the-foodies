import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
    getSession,
    onAuthStateChange,
    signIn as doSignIn,
    signOut as doSignOut,
    signUp as doSignUp,
} from '../lib/auth';

const AuthContext = createContext();

/**
 * FAMILY HOUSEHOLDS — the session, in one place.
 *
 * Owns who is signed in. It is deliberately ignorant of households: the
 * HouseholdContext consumes this to decide whether the household comes from
 * membership (a real session) or from the legacy device-held id (no session).
 * Keeping the two separate is what lets Plan/Shop/Inventory stay untouched —
 * they read useHousehold().id and get the right answer either way.
 *
 * "Unreachable" is not "signed out": if getSession() throws (paused project,
 * offline) the provider stays in the signed-out shape rather than erroring, so
 * the app falls back to the device-local household and keeps working.
 */
export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;

        getSession()
            .then((s) => { if (mounted.current) setSession(s); })
            .catch(() => { /* unreachable; stay signed-out, never error */ })
            .finally(() => { if (mounted.current) setLoading(false); });

        const unsub = onAuthStateChange((s) => { if (mounted.current) setSession(s); });

        return () => {
            mounted.current = false;
            unsub?.();
        };
    }, []);

    const user = session?.user ?? null;

    const signIn = async (email, password) => doSignIn(email, password);
    const signUp = async (email, password) => doSignUp(email, password);
    const signOut = async () => {
        await doSignOut();
        setSession(null);
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}