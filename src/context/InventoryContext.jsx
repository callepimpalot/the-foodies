import { createContext, useContext, useState, useEffect } from 'react';

const InventoryContext = createContext();

export function InventoryProvider({ children }) {
    // Default Categories
    const DEFAULT_CATEGORIES = [
        { id: 'produce', name: 'Fruit & Veg', icon: '🥦' },
        { id: 'protein', name: 'Meat & Seafood', icon: '🥩' },
        { id: 'dairy', name: 'Dairy & Eggs', icon: '🧀' },
        { id: 'grains', name: 'Grains & Pasta', icon: '🍝' },
        { id: 'frozen', name: 'Frozen', icon: 'ice' },
        { id: 'canned', name: 'Canned Goods', icon: '🥫' },
        { id: 'snacks', name: 'Snacks', icon: '🍿' },
        { id: 'beverages', name: 'Beverages', icon: '🥤' },
        { id: 'condiments', name: 'Condiments & Spices', icon: '🧂' },
        { id: 'household', name: 'Household', icon: '🏠' },
        { id: 'other', name: 'Other', icon: '📦' }
    ];

    const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

    // Default Route Order
    const [categoryOrder, setCategoryOrder] = useState([
        'produce', 'dairy', 'protein', 'frozen', // Fridge/Fresh
        'grains', 'canned', 'spices', 'condiments', 'snacks', 'beverages', // Pantry
        'household', 'other' // Home
    ]);

    const updateCategoryOrder = (newOrder) => {
        setCategoryOrder(newOrder);
    };

    // Initial State with updated schema
    const [items, setItems] = useState([
        { id: '1', name: 'Chicken Breast', category: 'protein', quantity: 2, targetQuantity: 1, unit: 'kg', inPantry: true, isMaster: true, toBuy: false },
        { id: '2', name: 'Rice', category: 'grains', quantity: 1, targetQuantity: 1, unit: 'bag', inPantry: true, isMaster: true, toBuy: false },
        { id: '3', name: 'Broccoli', category: 'produce', quantity: 3, targetQuantity: 1, unit: 'pcs', inPantry: true, isMaster: true, toBuy: false },
        { id: '4', name: 'Eggs', category: 'dairy', quantity: 12, targetQuantity: 1, unit: 'pcs', inPantry: true, isMaster: true, toBuy: false },
        { id: '5', name: 'Pasta', category: 'grains', quantity: 2, targetQuantity: 1, unit: 'box', inPantry: true, isMaster: true, toBuy: false }
    ]);

    const addCategory = (name) => {
        const id = name.toLowerCase().replace(/\s+/g, '-');
        if (!categories.find(c => c.id === id)) {
            setCategories([...categories, { id, name, icon: '🏷️' }]);
        }
    };

    const removeCategory = (id) => {
        setCategories(categories.filter(c => c.id !== id));
        // Move items in this category to 'other'
        setItems(items.map(i => i.category === id ? { ...i, category: 'other' } : i));
    };

    const addItem = (nameOrItem, category = 'other') => {
        let name = nameOrItem;
        let itemCategory = category;

        if (typeof nameOrItem === 'object') {
            name = nameOrItem.name;
            itemCategory = nameOrItem.category || 'other';
        }

        const existing = items.find(i => i.name.toLowerCase() === name.toLowerCase());
        if (existing) {
            if (!existing.inPantry) {
                updateItem(existing.id, { inPantry: true });
            } else {
                updateItem(existing.id, { quantity: (existing.quantity || 1) + 1 });
            }
            return;
        }

        const newItem = {
            id: Date.now().toString() + Math.random(), // Ensure unique ID
            name: name,
            category: itemCategory,
            quantity: 1,
            targetQuantity: 1, // Default Target
            unit: 'pcs',
            inPantry: true,
            isMaster: false, // Default to FALSE (User must heart it)
            toBuy: false
        };
        setItems(prev => [...prev, newItem]);
    };

    const removeItem = (id) => {
        // Soft delete for pantry view
        updateItem(id, { inPantry: false, quantity: 0 });
    };

    const updateItem = (id, updates) => {
        setItems(items.map(item => item.id === id ? { ...item, ...updates } : item));
    };

    const toggleEssential = (id) => {
        const item = items.find(i => i.id === id);
        if (item) updateItem(id, { isMaster: !item.isMaster });
    };

    const toggleToBuy = (id, status) => {
        updateItem(id, { toBuy: status });
    };

    return (
        <InventoryContext.Provider value={{
            items,
            categories,
            addItem,
            removeItem,
            updateItem,
            toggleEssential,
            toggleToBuy,
            addCategory,
            removeCategory,
            categoryOrder,
            updateCategoryOrder
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
