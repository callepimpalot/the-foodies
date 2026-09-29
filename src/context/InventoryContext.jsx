import { createContext, useContext, useCallback } from 'react';
import {
    withFlagToggled,
    withLowStockToggled,
    withUseByDate,
    withFlagsCleared,
} from '../lib/pantryItems';
import { useHousehold } from './HouseholdContext';
import { useSyncedDocument } from '../hooks/useSyncedDocument';
import { supabase } from '../lib/supabase';

const CACHE_KEY = 'meal_buddy_essentials_doc';
const LEGACY_KEYS = ['meal_buddy_essentials_items', 'meal_buddy_essentials_categories'];

const InventoryContext = createContext();

const DEFAULT_CATEGORIES = [
    { id: 'produce', name: 'Fruit & Veg' },
    { id: 'protein', name: 'Meat & Seafood' },
    { id: 'dairy', name: 'Dairy & Eggs' },
    { id: 'grains', name: 'Grains & Pasta' },
    { id: 'frozen', name: 'Frozen' },
    { id: 'canned', name: 'Canned Goods' },
    { id: 'snacks', name: 'Snacks' },
    { id: 'beverages', name: 'Beverages' },
    { id: 'condiments', name: 'Condiments & Spices' },
    { id: 'household', name: 'Household' },
    { id: 'other', name: 'Other' },
];

const DEFAULT_ITEMS = [
    { id: 'seed-1', name: 'Milk', emoji: '🥛', category: 'dairy', flagged: false },
    { id: 'seed-2', name: 'Eggs', emoji: '🥚', category: 'dairy', flagged: false },
    { id: 'seed-3', name: 'Bread', emoji: '🍞', category: 'grains', flagged: false },
    { id: 'seed-4', name: 'Coffee', emoji: '☕', category: 'beverages', flagged: false },
    { id: 'seed-5', name: 'Dish Soap', emoji: '🧼', category: 'household', flagged: false },
];

const FALLBACK_DOC = { items: DEFAULT_ITEMS, categories: DEFAULT_CATEGORIES };

// Deletions are namespaced into tokens so one hook can carry removals for two
// tables — see the note on useSyncedDocument's `removed`.
const itemToken = (id) => `item:${id}`;
const categoryToken = (id) => `category:${id}`;

/** InventoryItem -> an essentials row. */
function itemToRow(item, householdId) {
    return {
        household_id: householdId,
        item_id: String(item?.id),
        name: item?.name ?? '(unnamed)',
        emoji: item?.emoji ?? null,
        category: item?.category ?? 'other',
        flagged: item?.flagged === true,
        low_stock: item?.lowStock === true,
        use_by_date: item?.useByDate ?? null,
    };
}

/** An essentials row -> InventoryItem. */
function rowToItem(row) {
    const item = {
        id: row.item_id,
        name: row.name,
        emoji: row.emoji ?? '📦',
        category: row.category ?? 'other',
        flagged: row.flagged === true,
    };
    // Only set what is actually there: writing `lowStock: false` onto an item that
    // never had the field would change its shape on a round trip for no reason,
    // and DATA_MODELS §2 is explicit that both fields being absent is valid.
    if (row.low_stock === true) item.lowStock = true;
    if (row.use_by_date) item.useByDate = row.use_by_date;
    return item;
}

function itemsMatch(a, b) {
    if (!a || !b) return false;
    return (
        a.item_id === b.item_id &&
        a.name === b.name &&
        (a.emoji ?? null) === (b.emoji ?? null) &&
        a.category === b.category &&
        a.flagged === b.flagged &&
        a.low_stock === b.low_stock &&
        (a.use_by_date ?? null) === (b.use_by_date ?? null)
    );
}

function categoriesMatch(a, b) {
    if (!a || !b) return false;
    return a.category_id === b.category_id && a.name === b.name && a.position === b.position;
}

/**
 * TASK_07 — Essentials (the Pantry tab), from localStorage to Supabase.
 *
 * Public API unchanged: `items`, `categories`, `addItem`, `removeItem`,
 * `toggleFlag`, `toggleLowStock`, `setUseByDate`, `clearFlags`, `addCategory`,
 * `removeCategory`.
 *
 * One deliberate call worth reviewing: a household whose remote row set is empty
 * keeps the local defaults instead of being replaced by an empty pantry. A brand
 * new household has to start with the five seed items and eleven categories
 * exactly as a fresh device does today, and remotely there is no difference
 * between "never used" and "deliberately emptied". The seed items are pushed on
 * the first edit rather than at creation, so nothing is written for a household
 * that never opens the Pantry tab.
 */
export function InventoryProvider({ children }) {
    const { id: householdId } = useHousehold();

    const loadRemote = useCallback(async () => {
        if (!supabase || !householdId) throw new Error('Supabase unavailable');

        const [itemsRes, categoriesRes] = await Promise.all([
            supabase.from('essentials').select('*').eq('household_id', householdId),
            supabase.from('essentials_categories').select('*').eq('household_id', householdId).order('position'),
        ]);
        if (itemsRes.error) throw itemsRes.error;
        if (categoriesRes.error) throw categoriesRes.error;

        const itemRows = itemsRes.data ?? [];
        const categoryRows = categoriesRes.data ?? [];

        // See the note above: an empty household keeps its local defaults.
        if (!itemRows.length && !categoryRows.length) return { rows: [], value: null };

        return {
            rows: { items: itemRows, categories: categoryRows },
            value: {
                items: itemRows.map(rowToItem),
                categories: categoryRows.length
                    ? categoryRows.map((c) => ({ id: c.category_id, name: c.name }))
                    : DEFAULT_CATEGORIES,
            },
        };
    }, [householdId]);

    const saveRemote = useCallback(async (doc, { rows, removed = [] } = {}) => {
        if (!supabase || !householdId) throw new Error('Supabase unavailable');

        const knownItems = new Map((rows?.items ?? []).map((r) => [r.item_id, r]));
        const knownCategories = new Map((rows?.categories ?? []).map((r) => [r.category_id, r]));

        const itemRows = (doc?.items ?? []).map((item) => itemToRow(item, householdId));
        const categoryRows = (doc?.categories ?? []).map((c, i) => ({
            household_id: householdId,
            category_id: c.id,
            name: c.name,
            position: i,
        }));

        const changedItems = itemRows.filter((row) => !itemsMatch(row, knownItems.get(row.item_id)));
        const changedCategories = categoryRows.filter(
            (row) => !categoriesMatch(row, knownCategories.get(row.category_id))
        );

        if (changedItems.length) {
            const { error } = await supabase
                .from('essentials')
                .upsert(changedItems, { onConflict: 'household_id,item_id' });
            if (error) throw error;
        }

        if (changedCategories.length) {
            const { error } = await supabase
                .from('essentials_categories')
                .upsert(changedCategories, { onConflict: 'household_id,category_id' });
            if (error) throw error;
        }

        const removedItemIds = removed.filter((t) => t.startsWith('item:')).map((t) => t.slice(5));
        const removedCategoryIds = removed.filter((t) => t.startsWith('category:')).map((t) => t.slice(9));

        if (removedItemIds.length) {
            const { error } = await supabase
                .from('essentials').delete().eq('household_id', householdId).in('item_id', removedItemIds);
            if (error) throw error;
        }

        if (removedCategoryIds.length) {
            const { error } = await supabase
                .from('essentials_categories').delete().eq('household_id', householdId).in('category_id', removedCategoryIds);
            if (error) throw error;
        }
    }, [householdId]);

    const { value, update, status } = useSyncedDocument({
        cacheKey: CACHE_KEY,
        householdId,
        loadRemote,
        saveRemote,
        fallback: FALLBACK_DOC,
        legacyKeys: LEGACY_KEYS,
        fromLegacy: (legacy) => ({
            items: Array.isArray(legacy?.['meal_buddy_essentials_items'])
                ? legacy['meal_buddy_essentials_items']
                : DEFAULT_ITEMS,
            categories: Array.isArray(legacy?.['meal_buddy_essentials_categories'])
                ? legacy['meal_buddy_essentials_categories']
                : DEFAULT_CATEGORIES,
        }),
    });

    const items = value?.items ?? DEFAULT_ITEMS;
    const categories = value?.categories ?? DEFAULT_CATEGORIES;

    const addCategory = (name) => {
        const id = name.toLowerCase().replace(/\s+/g, '-');
        update((doc) => (
            doc.categories.find((c) => c.id === id)
                ? doc
                : { ...doc, categories: [...doc.categories, { id, name }] }
        ));
    };

    const removeCategory = (id) => {
        update((doc) => ({
            categories: doc.categories.filter((c) => c.id !== id),
            // Items in the removed category are re-pointed at 'other' rather than
            // orphaned — unchanged behaviour, now applied to what the other phone
            // can see too.
            items: doc.items.map((i) => (i.category === id ? { ...i, category: 'other' } : i)),
        }), { removed: [categoryToken(id)] });
    };

    // Accepts either a plain name string (defaults to 'other', 📦) or an
    // { name, category, emoji } object — QuickAddModal's commonItems shape.
    const addItem = (nameOrItem, category = 'other') => {
        let name = nameOrItem;
        let itemCategory = category;
        let emoji = '📦';

        if (typeof nameOrItem === 'object') {
            name = nameOrItem.name;
            itemCategory = nameOrItem.category || 'other';
            emoji = nameOrItem.emoji || '📦';
        }
        if (!name?.trim()) return;

        update((doc) => {
            // Duplicates are rejected case-insensitively, as before.
            if (doc.items.find((i) => i.name.toLowerCase() === name.toLowerCase())) return doc;
            return {
                ...doc,
                items: [...doc.items, {
                    id: crypto.randomUUID(),
                    name,
                    emoji,
                    category: itemCategory,
                    flagged: false,
                }],
            };
        });
    };

    const removeItem = (id) => {
        update((doc) => ({ ...doc, items: doc.items.filter((i) => i.id !== id) }), { removed: [itemToken(id)] });
    };

    // The transitions themselves live in src/lib/pantryItems.js as pure functions, so
    // the flag-to-shopping-list behaviour TASK_11 warns twice about regressing can be
    // asserted directly instead of reasoned about. TASK_07 does not touch them.
    const updateItem = (id, fn) => {
        update((doc) => ({ ...doc, items: doc.items.map((i) => (i?.id === id ? fn(i) : i)) }));
    };

    const toggleFlag = (id) => updateItem(id, withFlagToggled);
    const toggleLowStock = (id) => updateItem(id, withLowStockToggled);
    const setUseByDate = (id, isoDate) => updateItem(id, (i) => withUseByDate(i, isoDate));

    const clearFlags = () => {
        update((doc) => ({
            ...doc,
            items: doc.items.map((i) => (i?.flagged || i?.lowStock ? withFlagsCleared(i) : i)),
        }));
    };

    return (
        <InventoryContext.Provider value={{
            items,
            categories,
            addItem,
            removeItem,
            toggleFlag,
            toggleLowStock,
            setUseByDate,
            clearFlags,
            addCategory,
            removeCategory,
            syncStatus: status,
        }}>
            {children}
        </InventoryContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useInventory() {
    const context = useContext(InventoryContext);
    if (!context) {
        throw new Error('useInventory must be used within an InventoryProvider');
    }
    return context;
}
