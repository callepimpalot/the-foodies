import { createContext, useContext, useCallback, useMemo } from 'react';
import { usePlan } from './PlanContext';
import { useInventory } from './InventoryContext';
import { useHousehold } from './HouseholdContext';
import { useSyncedDocument } from '../hooks/useSyncedDocument';
import { supabase } from '../lib/supabase';

const ShopContext = createContext();

const SCHEMA_VERSION = 'v2';
const CACHE_KEY = 'meal_buddy_shop_doc';
const LEGACY_KEYS = ['meal_buddy_shop_checked', 'meal_buddy_shop_fingerprint'];
const EMPTY_DOC = { checkedKeys: [], fingerprint: '' };

// A stable fingerprint of "what you're actually shopping for" — the schema
// version plus the confirmed plan's recipe ids + servings, sorted by date so
// the string is deterministic regardless of insertion order. Prefixing the
// schema version means a future change to the item `key` format (see
// TASK_03) can't silently collide with stale persisted checks.
//
// Unchanged from before, with one new job: the fingerprint is now compared on
// both phones, so the second device can tell that the ticks it holds belonged to
// a plan that has since been rebuilt.
function buildPlanFingerprint(weeklyPlan) {
    const parts = Object.keys(weeklyPlan ?? {})
        .sort()
        .map((date) => {
            const entry = weeklyPlan?.[date];
            if (!entry?.recipe) return null;
            return `${date}:${entry?.recipe?.id ?? ''}:${entry?.servings ?? ''}`;
        })
        .filter(Boolean);
    return [SCHEMA_VERSION, ...parts].join('|');
}

/**
 * TASK_07 — the checked-off state and the plan fingerprint, now shared.
 *
 * Public API unchanged: `checkedKeys` (a Set, as before) and `toggleChecked`,
 * `resetList`, `householdSnapshot`.
 *
 * The stale-fingerprint rule still converges before paint, but it no longer
 * needs the old setState-during-render trick: the reset is *derived* here rather
 * than stored. If the stored fingerprint isn't the current one, the ticks are
 * empty for this render, and the next write repairs the stored copy. One fewer
 * piece of state, same visible behaviour.
 */
export function ShopProvider({ children }) {
    const { weeklyPlan } = usePlan();
    const { items: essentialItems } = useInventory();
    const { id: householdId } = useHousehold();

    const currentFingerprint = useMemo(() => buildPlanFingerprint(weeklyPlan), [weeklyPlan]);

    const loadRemote = useCallback(async () => {
        if (!supabase || !householdId) throw new Error('Supabase unavailable');

        const { data, error } = await supabase
            .from('shopping_state')
            .select('checked_keys, plan_fingerprint')
            .eq('household_id', householdId)
            .maybeSingle();
        if (error) throw error;

        // No row yet means nothing has ever been ticked in this household.
        // Returning a null value (rather than an empty document) leaves the local
        // cache alone, which is what keeps the Shop tab usable on a first run with
        // no plan and no row.
        if (!data) return { rows: [], value: null };

        const storedFingerprint = data.plan_fingerprint ?? '';
        return {
            rows: [data],
            value: {
                // Ticks made against a plan that has since changed are dropped —
                // the same rule the local build applied, now applied to whatever
                // came off the wire.
                checkedKeys: storedFingerprint === currentFingerprint && Array.isArray(data.checked_keys)
                    ? data.checked_keys
                    : [],
                fingerprint: storedFingerprint === currentFingerprint ? storedFingerprint : currentFingerprint,
            },
        };
    }, [householdId, currentFingerprint]);

    const saveRemote = useCallback(async (doc) => {
        if (!supabase || !householdId) throw new Error('Supabase unavailable');

        const { error } = await supabase
            .from('shopping_state')
            .upsert({
                household_id: householdId,
                checked_keys: Array.from(doc?.checkedKeys ?? []),
                plan_fingerprint: doc?.fingerprint ?? '',
            }, { onConflict: 'household_id' });
        if (error) throw error;
    }, [householdId]);

    const { value, update, status } = useSyncedDocument({
        cacheKey: CACHE_KEY,
        householdId,
        loadRemote,
        saveRemote,
        fallback: EMPTY_DOC,
        legacyKeys: LEGACY_KEYS,
        fromLegacy: (legacy) => ({
            checkedKeys: Array.isArray(legacy?.['meal_buddy_shop_checked'])
                ? legacy['meal_buddy_shop_checked']
                : [],
            fingerprint: legacy?.['meal_buddy_shop_fingerprint'] ?? '',
        }),
    });

    // Derived, as described above: a fingerprint that doesn't match the plan means
    // these ticks belong to a list that no longer exists.
    //
    // The cache holds an array (JSON has no Set); the context has always exposed a
    // Set and views call .has() on it. Converting at this boundary is cheaper than
    // changing every caller, and it keeps that API promise exact.
    const checkedKeys = useMemo(() => {
        const isStale = (value?.fingerprint ?? '') !== currentFingerprint;
        return new Set(!isStale && Array.isArray(value?.checkedKeys) ? value.checkedKeys : []);
    }, [value, currentFingerprint]);

    // Derived, not stored: a household item belongs on the list if it's currently
    // flagged in Pantry (so newly-flagged items show up the moment you switch to
    // Shop) OR it's checked off (so an item doesn't vanish mid-shop the instant
    // it's ticked — toggling a household row also un-flags it in Pantry, which
    // would otherwise drop it here). Anything un-flagged in Pantry that was never
    // checked here correctly falls out.
    const householdSnapshot = useMemo(
        () => essentialItems.filter((i) => i?.flagged || checkedKeys.has(`household|${i?.id}`)),
        [essentialItems, checkedKeys]
    );

    // Every write stamps the current fingerprint, which is what repairs the stored
    // copy after a stale load — no separate reconciliation effect needed.
    const toggleChecked = (key) => {
        const next = new Set(checkedKeys);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        update({ checkedKeys: Array.from(next), fingerprint: currentFingerprint });
    };

    // Clearing checkedKeys is enough to re-base the household list on
    // currently-flagged items too — householdSnapshot is derived from
    // checkedKeys above, so an empty set drops any un-flagged-but-checked items.
    const resetList = () => {
        update({ checkedKeys: [], fingerprint: currentFingerprint });
    };

    return (
        <ShopContext.Provider value={{ checkedKeys, toggleChecked, resetList, householdSnapshot, syncStatus: status }}>
            {children}
        </ShopContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useShop() {
    const context = useContext(ShopContext);
    if (!context) {
        throw new Error('useShop must be used within a ShopProvider');
    }
    return context;
}
