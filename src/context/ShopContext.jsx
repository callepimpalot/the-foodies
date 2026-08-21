import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { usePlan } from './PlanContext';
import { useInventory } from './InventoryContext';

const ShopContext = createContext();

const SCHEMA_VERSION = 'v1';
const STORAGE_KEY_CHECKED = 'meal_buddy_shop_checked';
const STORAGE_KEY_FINGERPRINT = 'meal_buddy_shop_fingerprint';

function readStorage(key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        console.error(`Failed to read ${key} from localStorage:`, e);
        return null;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        console.error(`Failed to write ${key} to localStorage:`, e);
    }
}

// A stable fingerprint of "what you're actually shopping for" — the schema
// version plus the confirmed plan's recipe ids + servings, sorted by date so
// the string is deterministic regardless of insertion order. Prefixing the
// schema version means a future change to the item `key` format (see
// TASK_03) can't silently collide with stale persisted checks.
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

function loadCheckedKeys() {
    const saved = readStorage(STORAGE_KEY_CHECKED);
    if (!saved) return new Set();
    try {
        return new Set(JSON.parse(saved));
    } catch (e) {
        console.error('Failed to parse shop checked keys:', e);
        return new Set();
    }
}

export function ShopProvider({ children }) {
    const { weeklyPlan } = usePlan();
    const { items: essentialItems } = useInventory();

    const currentFingerprint = useMemo(() => buildPlanFingerprint(weeklyPlan), [weeklyPlan]);

    const [checkedKeys, setCheckedKeys] = useState(() => {
        const storedFingerprint = readStorage(STORAGE_KEY_FINGERPRINT);
        if (storedFingerprint !== currentFingerprint) return new Set();
        return loadCheckedKeys();
    });

    // The fingerprint `checkedKeys` was last validated against. Whenever it's
    // stale (the plan changed since, not just on cold boot — persisted checks
    // are already reconciled by the lazy initialiser above), the mismatch is
    // caught below and the state is adjusted directly during render rather
    // than in an effect, so it converges before paint with no stale flash.
    const [fingerprint, setFingerprint] = useState(currentFingerprint);

    if (fingerprint !== currentFingerprint) {
        setFingerprint(currentFingerprint);
        setCheckedKeys(new Set());
    }

    // Derived, not stored: a household item belongs on the list if it's
    // currently flagged in Pantry (so newly-flagged items show up the moment
    // you switch to Shop) OR it's checked off in this session (so an item
    // doesn't vanish mid-shop the instant it's ticked — toggling a household
    // row also un-flags it in Pantry, which would otherwise drop it here).
    // Anything un-flagged in Pantry that was never checked here correctly
    // falls out. `essentialItems` and `checkedKeys` are each independently
    // persisted (InventoryContext's own storage, and this context's), so
    // this recomputes correctly after a hard reload with no extra storage.
    const householdSnapshot = useMemo(
        () => essentialItems.filter((i) => i?.flagged || checkedKeys.has(`household|${i?.id}`)),
        [essentialItems, checkedKeys]
    );

    useEffect(() => {
        writeStorage(STORAGE_KEY_CHECKED, JSON.stringify(Array.from(checkedKeys)));
    }, [checkedKeys]);

    useEffect(() => {
        writeStorage(STORAGE_KEY_FINGERPRINT, fingerprint ?? '');
    }, [fingerprint]);

    const toggleChecked = (key) => {
        setCheckedKeys((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    // Clearing checkedKeys is enough to re-base the household list on
    // currently-flagged items too — householdSnapshot is derived from
    // checkedKeys above, so an empty set drops any un-flagged-but-checked
    // items automatically.
    const resetList = () => {
        setCheckedKeys(new Set());
        setFingerprint(currentFingerprint);
    };

    return (
        <ShopContext.Provider value={{ checkedKeys, toggleChecked, resetList, householdSnapshot }}>
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
