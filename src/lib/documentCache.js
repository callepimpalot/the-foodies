// TASK_07 — the storage layer under the three contexts.
//
// The rule this file exists to enforce: **localStorage stops being the store of
// record and becomes a write-through cache.** Reads come from the cache first so
// the first paint is never empty and the Shop tab works in a supermarket
// basement; writes land in the cache synchronously and go to Supabase when they
// can. TASK_07 calls this non-negotiable and it is: the Supabase free tier
// pauses, and useRecipes.js already falls back to local JSON for that reason.
//
// Dependency-free and side-effect-free so it can be asserted directly — see
// scripts/task07_check.mjs.

export const PENDING_SUFFIX = '__pending';

/** Read + parse, never throwing. A corrupt cache is the same as an empty one. */
export function readJson(storage, key, fallback = null) {
    try {
        const raw = storage?.getItem(key);
        if (raw == null) return fallback;
        const parsed = JSON.parse(raw);
        return parsed ?? fallback;
    } catch {
        return fallback;
    }
}

/** Write, never throwing. A full or blocked localStorage must not break the app. */
export function writeJson(storage, key, value) {
    try {
        storage?.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

export function removeKey(storage, key) {
    try {
        storage?.removeItem(key);
        return true;
    } catch {
        return false;
    }
}

/**
 * A save that failed or was attempted offline is parked under
 * `<cacheKey>__pending` so it is not lost when the tab is closed mid-queue.
 * It holds the whole document, not a list of operations: every write in this
 * design is "the household's current state", so the newest document always
 * supersedes anything older and last-write-wins is the stated policy anyway.
 */
export function parkPending(storage, cacheKey, value) {
    return writeJson(storage, `${cacheKey}${PENDING_SUFFIX}`, {
        at: new Date().toISOString(),
        value,
    });
}

export function readPending(storage, cacheKey) {
    const parked = readJson(storage, `${cacheKey}${PENDING_SUFFIX}`, null);
    return parked?.value ?? null;
}

export function clearPending(storage, cacheKey) {
    return removeKey(storage, `${cacheKey}${PENDING_SUFFIX}`);
}

/**
 * The one-shot migration for the data already on this device.
 *
 * TASK_07 is emphatic that losing the current plan is unacceptable, so this:
 *  1. copies every legacy key to `<key>__backup_v1` before anything else,
 *  2. reports what it found so the caller can push it to Supabase,
 *  3. and is guarded by a flag file, so whatever the caller does next it happens
 *     once and re-running it cannot overwrite live data with a stale copy.
 *
 * Note what it does NOT do: delete the legacy keys. If Supabase is paused on the
 * first run after the update, the old data has to still be there. The cleanup
 * happens only after a save is confirmed — see markMigrated().
 */
export const MIGRATED_FLAG_SUFFIX = '__migrated_v1';
export const BACKUP_SUFFIX = '__backup_v1';

export function migrateLegacy(storage, { legacyKeys, targetCacheKey }) {
    const flagKey = `${targetCacheKey}${MIGRATED_FLAG_SUFFIX}`;
    if (readJson(storage, flagKey, null)) {
        return { alreadyDone: true, found: false, legacy: {} };
    }

    const found = {};
    let any = false;
    for (const key of legacyKeys) {
        const value = readJson(storage, key, null);
        if (value != null) {
            found[key] = value;
            any = true;
            // Backup first, unconditionally, even if the write below fails.
            writeJson(storage, `${key}${BACKUP_SUFFIX}`, value);
        }
    }

    return { alreadyDone: false, found: any, legacy: found };
}

/** Called only after the migrated document has been saved successfully. */
export function markMigrated(storage, targetCacheKey) {
    return writeJson(storage, `${targetCacheKey}${MIGRATED_FLAG_SUFFIX}`, {
        at: new Date().toISOString(),
    });
}

export function isMigrated(storage, targetCacheKey) {
    return readJson(storage, `${targetCacheKey}${MIGRATED_FLAG_SUFFIX}`, null) != null;
}
