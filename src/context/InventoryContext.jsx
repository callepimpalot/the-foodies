import { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY_ITEMS = 'meal_buddy_essentials_items';
const STORAGE_KEY_CATEGORIES = 'meal_buddy_essentials_categories';

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

function loadCategories() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY_CATEGORIES);
        return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
    } catch {
        return DEFAULT_CATEGORIES;
    }
}

function loadItems() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY_ITEMS);
        return saved ? JSON.parse(saved) : DEFAULT_ITEMS;
    } catch {
        return DEFAULT_ITEMS;
    }
}

export function InventoryProvider({ children }) {
    const [categories, setCategories] = useState(loadCategories);
    const [items, setItems] = useState(loadItems);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(categories));
    }, [categories]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
    }, [items]);

    const addCategory = (name) => {
        const id = name.toLowerCase().replace(/\s+/g, '-');
        if (!categories.find(c => c.id === id)) {
            setCategories(prev => [...prev, { id, name }]);
        }
    };

    const removeCategory = (id) => {
        setCategories(prev => prev.filter(c => c.id !== id));
        setItems(prev => prev.map(i => i.category === id ? { ...i, category: 'other' } : i));
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

        const alreadyTracked = items.find(i => i.name.toLowerCase() === name.toLowerCase());
        if (alreadyTracked) return;

        setItems(prev => [...prev, {
            id: crypto.randomUUID(),
            name,
            emoji,
            category: itemCategory,
            flagged: false,
        }]);
    };

    const removeItem = (id) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const toggleFlag = (id) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, flagged: !i.flagged } : i));
    };

    const clearFlags = () => {
        setItems(prev => prev.map(i => i.flagged ? { ...i, flagged: false } : i));
    };

    return (
        <InventoryContext.Provider value={{
            items,
            categories,
            addItem,
            removeItem,
            toggleFlag,
            clearFlags,
            addCategory,
            removeCategory,
        }}>
            {children}
        </InventoryContext.Provider>
    );
}

export function useInventory() {
    const context = useContext(InventoryContext);
    if (!context) {
        throw new Error('useInventory must be used within an InventoryProvider');
    }
    return context;
}
