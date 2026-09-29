import { useCallback, useEffect, useRef, useState } from 'react';
import {
    clearPending,
    parkPending,
    readJson,
    readPending,
    writeJson,
} from '../lib/documentCache';

/**
 * TASK_07 — one storage layer, shared by PlanContext, ShopContext and
 * InventoryContext. Each context keeps its existing public API and its existing
 * in-memory shape; only where the bytes live changes.
 *
 * The contract, in order of what matters:
 *
 *  1. **First paint comes from the cache, synchronously.** No loading state, no
 *     empty flash, and the app is fully usable with no network at all — the Shop
 *     tab in a supermarket basement is the case that matters.
 *  2. **Supabase reconciles afterwards.** `loadRemote()` runs once per household
 *     and its result replaces the cache, unless the user has already edited
 *     something in this session (`dirty`), in which case the local edit wins and
 *     is pushed. Last-write-wins, as TASK_07 specifies.
 *  3. **Writes are debounced, then saved whole.** A failed or offline save is
 *     parked on disk and retried when the browser reports `online`, so closing
 *     the tab mid-queue loses nothing.
 *  4. **Supabase being unreachable is not an error state.** `status` reports
 *     `'offline'` and the app carries on exactly as it does today. Signing a user
 *     out (or blocking a tab) because a free-tier project paused is the bug this
 *     avoids.
 *
 * @param {object}   options
 * @param {string}   options.cacheKey    localStorage key for this document
 * @param {string}   options.householdId the household this document belongs to
 * @param {Function} options.loadRemote  async () => document | null
 * @param {Function} options.saveRemote  async (document) => void
 * @param {any}      options.fallback    value to use when there is no cache yet
 * @param {Function} [options.fromLegacy] (legacyValues) => document | null, run once
 * @param {string[]} [options.legacyKeys] keys the one-shot migration reads
 * @param {number}   [options.debounceMs]
 *
 * `update(doc, { removed })` takes a list of opaque string tokens for anything
 * the caller deleted. They are accumulated and handed back to `saveRemote` as the
 * second argument's `removed`, so a context with more than one table can
 * namespace them (`item:<id>`, `category:<id>`) — see InventoryContext. Plan
 * uses bare dates.
 */
export function useSyncedDocument({
    cacheKey,
    householdId,
    loadRemote,
    saveRemote,
    fallback = null,
    fromLegacy,
    legacyKeys = [],
    debounceMs = 500,
}) {
    const storage = typeof window !== 'undefined' ? window.localStorage : null;

    // Synchronous seed: cache, else anything parked from a previous session,
    // else the caller's fallback.
    const [value, setValue] = useState(() => {
        const cached = readJson(storage, cacheKey, null);
        if (cached != null) return cached;
        const pending = readPending(storage, cacheKey);
        if (pending != null) return pending;
        return fallback;
    });

    const [status, setStatus] = useState('idle');
    const valueRef = useRef(value);
    const dirtyRef = useRef(false);
    const rowsRef = useRef([]);          // last rows seen remotely, for diffing
    const removedRef = useRef([]);       // dates/ids cleared locally since last save
    const timerRef = useRef(null);
    const mountedRef = useRef(true);

    // Must be re-armed on mount, not only disarmed on unmount. React 19's
    // StrictMode runs mount -> cleanup -> mount in development, so a cleanup-only
    // version leaves `mountedRef.current === false` for the life of the page —
    // and every guard below it then returns early. The visible symptom is a
    // status stuck on 'syncing' forever; the one that matters is that
    // `commit(remote.value)` is skipped, so a reachable remote is never applied.
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const commit = useCallback((next) => {
        valueRef.current = next;
        setValue(next);
        writeJson(storage, cacheKey, next);
    }, [cacheKey, storage]);

    const save = useCallback(async () => {
        if (!householdId) return;
        try {
            setStatus('syncing');
            await saveRemote(valueRef.current, {
                rows: rowsRef.current,
                removed: removedRef.current,
            });
            dirtyRef.current = false;
            removedRef.current = [];
            clearPending(storage, cacheKey);
            if (mountedRef.current) setStatus('idle');
        } catch (err) {
            // Offline, paused project, or a rejected write. Park it; do not lose it.
            console.warn('Meal Buddy: keeping this change locally, will retry.', err);
            parkPending(storage, cacheKey, valueRef.current);
            if (mountedRef.current) setStatus('offline');
        }
    }, [cacheKey, householdId, saveRemote, storage]);

    const schedule = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => { save(); }, debounceMs);
    }, [debounceMs, save]);

    /** The contexts' setState. Keeps the cache and the remote in step. */
    const update = useCallback((nextOrFn, { removed } = {}) => {
        const next = typeof nextOrFn === 'function' ? nextOrFn(valueRef.current) : nextOrFn;
        if (removed) removedRef.current = Array.from(new Set([...removedRef.current, ...removed]));
        dirtyRef.current = true;
        commit(next);
        schedule();
    }, [commit, schedule]);

    /** Adopt a document that came from somewhere else (the legacy migration). */
    const replace = useCallback((next, { dirty = true } = {}) => {
        dirtyRef.current = dirty;
        commit(next);
        if (dirty) schedule();
    }, [commit, schedule]);

    // ---- one-shot migration of the data already on this device -------------
    useEffect(() => {
        if (!householdId || !fromLegacy || !legacyKeys.length) return;
        let cancelled = false;
        (async () => {
            const { migrateLegacy, markMigrated } = await import('../lib/documentCache');
            const result = migrateLegacy(storage, { legacyKeys, targetCacheKey: cacheKey });
            if (cancelled || result.alreadyDone) return;

            const migrated = result.found ? fromLegacy(result.legacy) : null;
            if (migrated) {
                commit(migrated);
                dirtyRef.current = true;
                try {
                    await saveRemote(migrated, { rows: [], removed: [] });
                    // Only now is it safe to consider the old keys migrated. They are
                    // deliberately NOT deleted: if this was a paused project, the
                    // backup is the only copy that exists.
                    markMigrated(storage, cacheKey);
                } catch {
                    parkPending(storage, cacheKey, migrated);
                }
            } else {
                markMigrated(storage, cacheKey);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [householdId, cacheKey]);

    // ---- reconcile with the remote, once per household --------------------
    useEffect(() => {
        if (!householdId) return;
        let cancelled = false;
        (async () => {
            try {
                setStatus('syncing');
                const remote = await loadRemote();
                if (cancelled || !mountedRef.current) return;
                if (remote?.rows) rowsRef.current = remote.rows;
                if (remote?.value != null && !dirtyRef.current) {
                    commit(remote.value);
                    clearPending(storage, cacheKey);
                }
                setStatus('idle');
                // The household id arriving late (it is created asynchronously) must
                // not strand an edit made before it existed.
                if (dirtyRef.current) schedule();
            } catch (err) {
                // Unreachable is not signed-out. Stay on the cache and say so quietly.
                console.warn('Meal Buddy: Supabase unreachable, using the local copy.', err);
                if (!cancelled && mountedRef.current) setStatus('offline');
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [householdId, cacheKey]);

    // ---- retry when the network comes back --------------------------------
    useEffect(() => {
        const retry = () => {
            if (dirtyRef.current) { save(); return; }
            const parked = readPending(storage, cacheKey);
            if (parked != null) { dirtyRef.current = true; save(); }
        };
        window.addEventListener('online', retry);
        return () => window.removeEventListener('online', retry);
    }, [cacheKey, save, storage]);

    // A queued save must not be lost by closing the tab.
    useEffect(() => {
        const flush = () => {
            if (dirtyRef.current) parkPending(storage, cacheKey, valueRef.current);
        };
        window.addEventListener('pagehide', flush);
        document.addEventListener('visibilitychange', flush);
        return () => {
            window.removeEventListener('pagehide', flush);
            document.removeEventListener('visibilitychange', flush);
        };
    }, [cacheKey, storage]);

    return { value, update, replace, status, rowsRef };
}
