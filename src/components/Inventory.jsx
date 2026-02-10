
import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useArchetype } from '../context/ArchetypeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { QuickAddModal } from './QuickAddModal';
import { RoutePlannerModal } from './RoutePlannerModal';


export function Inventory() {
    const { items, categories, addItem, removeItem, updateItem, toggleEssential, addCategory, removeCategory } = useInventory();
    const { activeArchetype } = useArchetype();
    const [newItemName, setNewItemName] = useState('');
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' or 'ESSENTIALS'
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [showRoutePlanner, setShowRoutePlanner] = useState(false);

    const handleAddItem = (e) => {
        e.preventDefault();
        if (newItemName.trim()) {
            addItem(newItemName.trim(), 'other'); // Default to 'other' (Unsorted)
            setNewItemName('');
        }
    };

    const handleAddCategory = (e) => {
        e.preventDefault();
        if (newCategoryName.trim()) {
            addCategory(newCategoryName.trim());
            setNewCategoryName('');
            setIsAddingCategory(false);
        }
    };

    // Group items by category
    const getItemsByCategory = (catId) => {
        if (activeTab === 'ESSENTIALS') {
            return items.filter(i => i.isMaster && i.category === catId);
        }
        return items.filter(i => i.inPantry && i.category === catId);
    };

    // Sort items: Unsorted ('other') first, then defined categories
    const sortedCategories = [
        ...categories.filter(c => c.id === 'other'),
        ...categories.filter(c => c.id !== 'other')
    ];

    return (
        <div style={{ padding: '0 0 100px 0', width: '100%' }}>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', padding: '0 0.5rem' }}>
                <button
                    onClick={() => setActiveTab('ALL')}
                    style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '16px',
                        border: 'none',
                        background: activeTab === 'ALL' ? 'var(--color-primary)' : 'rgba(255,255,255,0.5)',
                        color: activeTab === 'ALL' ? 'white' : 'var(--color-text-secondary)',
                        fontWeight: 600,
                        fontSize: '1rem',
                        boxShadow: activeTab === 'ALL' ? '0 4px 12px rgba(var(--active-glow), 0.3)' : 'none',
                        transition: 'all 0.2s',
                        cursor: 'pointer'
                    }}
                >
                    📦 All Items
                </button>
                <button
                    onClick={() => setActiveTab('ESSENTIALS')}
                    style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '16px',
                        border: 'none',
                        background: activeTab === 'ESSENTIALS' ? 'var(--color-primary)' : 'rgba(255,255,255,0.5)',
                        color: activeTab === 'ESSENTIALS' ? 'white' : 'var(--color-text-secondary)',
                        fontWeight: 600,
                        fontSize: '1rem',
                        boxShadow: activeTab === 'ESSENTIALS' ? '0 4px 12px rgba(var(--active-glow), 0.3)' : 'none',
                        transition: 'all 0.2s',
                        cursor: 'pointer'
                    }}
                >
                    ❤️ Essentials
                </button>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h2 className="title-md" style={{ marginBottom: '1rem' }}>Add to Pantry</h2>
                <form onSubmit={handleAddItem} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                        type="text"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder="e.g. Milk, Bread, Apples..."
                        style={{
                            flex: 1,
                            padding: '12px',
                            borderRadius: '12px',
                            border: '1px solid rgba(0,0,0,0.1)',
                            background: 'rgba(255,255,255,0.5)',
                            fontSize: '1rem'
                        }}
                    />
                    <button className="btn-primary" type="submit" style={{ borderRadius: '12px', padding: '0 20px' }}>
                        +
                    </button>
                </form>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {sortedCategories.map(category => {
                    const categoryItems = getItemsByCategory(category.id);
                    if (categoryItems.length === 0 && category.id !== 'other') return null; // Hide empty categories except Unsorted

                    return (
                        <div
                            key={category.id}
                            className="glass-panel"
                            style={{ padding: '1rem' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <h3 className="title-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'capitalize' }}>
                                    <span>{category.icon}</span>
                                    {category.name === 'Other' ? 'Unsorted' : category.name}
                                    <span style={{ fontSize: '0.8rem', opacity: 0.5, fontWeight: 400 }}>({categoryItems.length})</span>
                                </h3>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {categoryItems.map(item => (
                                    <PantryItemRow
                                        key={item.id}
                                        item={item}
                                        categories={categories}
                                        updateItem={updateItem}
                                        removeItem={removeItem}
                                        toggleEssential={toggleEssential}
                                        isEssentialView={activeTab === 'ESSENTIALS'}
                                    />
                                ))}
                                {categoryItems.length === 0 && category.id === 'other' && (
                                    <div
                                        style={{ textAlign: 'center', padding: '20px', fontSize: '0.9rem', opacity: 0.5 }}
                                    >
                                        No unsorted items. Great job!
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Add Category Section */}
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                    {!isAddingCategory ? (
                        <button
                            onClick={() => setIsAddingCategory(true)}
                            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer' }}
                        >
                            + Create New Category
                        </button>
                    ) : (
                        <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <input
                                autoFocus
                                type="text"
                                placeholder="Category Name"
                                value={newCategoryName}
                                onChange={e => setNewCategoryName(e.target.value)}
                                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ccc' }}
                            />
                            <button type="submit" className="btn-primary" style={{ padding: '8px 16px' }}>Add</button>
                            <button type="button" onClick={() => setIsAddingCategory(false)} style={{ background: 'none', border: 'none', color: '#666' }}>X</button>
                        </form>
                    )}
                </div>
            </div>

            {/* Quick Add FAB */}
            <div style={{ position: 'fixed', bottom: '100px', right: '20px', zIndex: 100 }}>
                <button
                    onClick={() => setShowQuickAdd(true)}
                    style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'var(--color-primary)',
                        color: 'white',
                        border: 'none',
                        fontSize: '2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        cursor: 'pointer'
                    }}
                >
                    +
                </button>
            </div>

            {/* Route Planner Button (Bottom Left) */}
            <div style={{ position: 'fixed', bottom: '100px', left: '20px', zIndex: 100 }}>
                <button
                    onClick={() => setShowRoutePlanner(true)}
                    style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: 'white',
                        color: '#666',
                        border: '1px solid #ddd',
                        fontSize: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        cursor: 'pointer'
                    }}
                    title="Plan Route"
                >
                    🗺️
                </button>
            </div>

            <AnimatePresence>
                {showQuickAdd && (
                    <QuickAddModal
                        onClose={() => setShowQuickAdd(false)}
                        onAdd={(items) => items.forEach(i => addItem(i))}
                    />
                )}
                {showRoutePlanner && (
                    <RoutePlannerModal
                        onClose={() => setShowRoutePlanner(false)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

function PantryItemRow({ item, categories, updateItem, removeItem, toggleEssential, isEssentialView }) {
    const [isEditingCat, setIsEditingCat] = useState(false);

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                background: 'rgba(255,255,255,0.6)',
                borderRadius: '12px',
                border: '1px solid rgba(0,0,0,0.05)',
                position: 'relative'
            }}
        >
            {/* Delete - Left Side */}
            <button
                onClick={() => removeItem(item.id)}
                style={{
                    border: 'none',
                    background: 'rgba(255, 71, 87, 0.1)', // Light red background
                    color: '#ff4757',
                    cursor: 'pointer',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                    transition: 'all 0.2s',
                    flexShrink: 0
                }}
            >
                ✕
            </button>

            {/* Content (Flex 1) - Middle Left */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', opacity: item.inPantry ? 1 : 0.5 }}>
                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {item.name}
                    {!item.inPantry && (
                        <span style={{ fontSize: '0.7rem', background: '#ff4757', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>TO BUY</span>
                    )}
                </div>
                {/* Category Picker */}
                <div style={{ position: 'relative', display: 'inline-block', marginTop: '4px' }}>
                    <div
                        onClick={() => setIsEditingCat(!isEditingCat)}
                        style={{
                            fontSize: '0.75rem',
                            color: 'var(--color-text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                            background: 'rgba(0,0,0,0.05)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            width: 'fit-content'
                        }}
                    >
                        {categories.find(c => c.id === item.category)?.name || 'Unsorted'} ▾
                    </div>

                    {/* Simple Dropdown for Category Switch */}
                    {isEditingCat && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            zIndex: 100,
                            background: 'white',
                            border: '1px solid #eee',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            width: '180px',
                            padding: '4px'
                        }}>
                            {categories.map(cat => (
                                <div
                                    key={cat.id}
                                    onClick={() => {
                                        updateItem(item.id, { category: cat.id });
                                        setIsEditingCat(false);
                                    }}
                                    style={{
                                        padding: '8px',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                    onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
                                    onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                >
                                    <span>{cat.icon}</span> {cat.name}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Quantity Controls - Middle Right */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.03)', padding: '4px', borderRadius: '8px' }}>
                {isEssentialView ? (
                    <>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', marginRight: '4px' }}>Target</div>
                        <button
                            onClick={() => updateItem(item.id, { targetQuantity: Math.max(1, (item.targetQuantity || 1) - 1) })}
                            style={{
                                border: 'none',
                                background: 'white',
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >-</button>
                        <span style={{
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            minWidth: '20px',
                            textAlign: 'center'
                        }}>{item.targetQuantity || 1}</span>
                        <button
                            onClick={() => updateItem(item.id, { targetQuantity: (item.targetQuantity || 1) + 1 })}
                            style={{ border: 'none', background: 'white', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >+</button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => updateItem(item.id, { quantity: Math.max(0, (item.quantity ?? 1) - 1) })}
                            disabled={item.quantity === 0}
                            style={{
                                border: 'none',
                                background: 'white',
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                cursor: item.quantity === 0 ? 'default' : 'pointer',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: item.quantity === 0 ? 0.5 : 1
                            }}
                        >-</button>
                        <span style={{
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            minWidth: '20px',
                            textAlign: 'center',
                            color: item.quantity === 0 ? '#ff4757' : 'inherit' // Red if 0
                        }}>{item.quantity ?? 1}</span>
                        <button
                            onClick={() => updateItem(item.id, { quantity: (item.quantity || 0) + 1, inPantry: true })}
                            style={{ border: 'none', background: 'white', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >+</button>
                    </>
                )}
            </div>

            {/* Essential Heart Toggle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <button
                    onClick={() => toggleEssential(item.id)}
                    style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '1.5rem',
                        cursor: 'pointer',
                        filter: item.isMaster ? 'grayscale(0)' : 'grayscale(100%) opacity(0.3)',
                        transition: 'all 0.2s',
                        transform: item.isMaster ? 'scale(1.1)' : 'scale(1)'
                    }}
                >
                    ❤️
                </button>
            </div>
        </div>
    );
}
