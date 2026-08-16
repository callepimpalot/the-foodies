
import React, { useState } from 'react';
import { Package, Heart, Plus, Trash2, ChevronDown, X, Map as MapIcon } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useArchetype } from '../context/ArchetypeContext';
import { QuickAddModal } from './QuickAddModal';
import { RoutePlannerModal } from './RoutePlannerModal';
import { Chip } from './ui/Chip';
import { Button, IconButton } from './ui/Button';
import { TicketCard } from './ui/TicketCard';


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
            <div className="flex gap-2" style={{ marginBottom: '1.5rem' }}>
                <Chip
                    variant="filter"
                    active={activeTab === 'ALL'}
                    onClick={() => setActiveTab('ALL')}
                    className="flex-1 flex items-center justify-center gap-2"
                    style={{ padding: '12px 14px' }}
                >
                    <Package size={14} /> All Items
                </Chip>
                <Chip
                    variant="filter"
                    active={activeTab === 'ESSENTIALS'}
                    onClick={() => setActiveTab('ESSENTIALS')}
                    className="flex-1 flex items-center justify-center gap-2"
                    style={{ padding: '12px 14px' }}
                >
                    <Heart size={14} /> Essentials
                </Chip>
            </div>

            <TicketCard style={{ marginBottom: '1.5rem' }}>
                <h2 className="t-heading-sm" style={{ marginBottom: '1rem' }}>Add to Pantry</h2>
                <form onSubmit={handleAddItem} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                        type="text"
                        className="input"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder="e.g. Milk, Bread, Apples..."
                        style={{ flex: 1, background: 'var(--ticket-2)', borderColor: 'var(--ticket-shadow)', color: 'var(--ink)' }}
                    />
                    <IconButton
                        type="submit"
                        style={{ borderColor: 'var(--ticket-shadow)', color: 'var(--ink-dim)', width: '44px', height: '44px' }}
                        aria-label="Add item"
                    >
                        <Plus size={18} />
                    </IconButton>
                </form>
            </TicketCard>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {sortedCategories.map(category => {
                    const categoryItems = getItemsByCategory(category.id);
                    if (categoryItems.length === 0 && category.id !== 'other') return null; // Hide empty categories except Unsorted

                    return (
                        <TicketCard key={category.id}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: categoryItems.length ? '0.5rem' : 0 }}>
                                <h3 className="t-heading-sm" style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                    {category.name === 'Other' ? 'Unsorted' : category.name}
                                    <span className="t-mono" style={{ fontSize: '12px', color: 'var(--ink-dim)', fontWeight: 400 }}>
                                        ({categoryItems.length})
                                    </span>
                                </h3>
                            </div>

                            <div>
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
                                    <div className="empty-state" style={{ color: 'var(--ink-dim)', padding: '16px 0 4px' }}>
                                        No unsorted items. Great job!
                                    </div>
                                )}
                            </div>
                        </TicketCard>
                    );
                })}

                {/* Add Category Section */}
                <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                    {!isAddingCategory ? (
                        <Button
                            variant="ghost"
                            onClick={() => setIsAddingCategory(true)}
                            className="inline-flex items-center gap-2"
                        >
                            <Plus size={14} /> Create New Category
                        </Button>
                    ) : (
                        <form onSubmit={handleAddCategory} className="flex items-center justify-center gap-2">
                            <input
                                autoFocus
                                type="text"
                                className="input"
                                placeholder="Category Name"
                                value={newCategoryName}
                                onChange={e => setNewCategoryName(e.target.value)}
                            />
                            <Button type="submit" variant="secondary">Add</Button>
                            <IconButton type="button" onClick={() => setIsAddingCategory(false)} aria-label="Cancel">
                                <X size={16} />
                            </IconButton>
                        </form>
                    )}
                </div>
            </div>

            {/* Quick Add FAB */}
            <div style={{ position: 'fixed', bottom: '100px', right: '20px', zIndex: 100 }}>
                <button
                    onClick={() => setShowQuickAdd(true)}
                    className="flex items-center justify-center"
                    style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: 'var(--r-md)',
                        background: 'var(--board-2)',
                        color: 'var(--chalk)',
                        border: '1px solid var(--line)',
                        boxShadow: 'var(--shadow-card)',
                    }}
                    aria-label="Quick add"
                >
                    <Plus size={24} />
                </button>
            </div>

            {/* Route Planner Button (Bottom Left) */}
            <div style={{ position: 'fixed', bottom: '100px', left: '20px', zIndex: 100 }}>
                <button
                    onClick={() => setShowRoutePlanner(true)}
                    className="flex items-center justify-center"
                    style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: 'var(--r-md)',
                        background: 'var(--board-2)',
                        color: 'var(--chalk-dim)',
                        border: '1px solid var(--line)',
                        boxShadow: 'var(--shadow-card)',
                    }}
                    title="Plan Route"
                    aria-label="Plan route"
                >
                    <MapIcon size={20} />
                </button>
            </div>

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
        </div>
    );
}

function PantryItemRow({ item, categories, updateItem, removeItem, toggleEssential, isEssentialView }) {
    const [isEditingCat, setIsEditingCat] = useState(false);

    return (
        <div className="list-row" style={{ alignItems: 'center' }}>
            {/* Delete - Left Side */}
            <IconButton
                onClick={() => removeItem(item.id)}
                style={{
                    borderColor: 'rgba(216, 115, 94, 0.35)',
                    color: 'var(--destructive)',
                    width: '32px',
                    height: '32px',
                    flexShrink: 0,
                }}
                aria-label={`Remove ${item.name}`}
            >
                <Trash2 size={15} />
            </IconButton>

            {/* Content (Flex 1) - Middle Left */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', opacity: item.inPantry ? 1 : 0.6, minWidth: 0 }}>
                <div className="t-body" style={{ fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {item.name}
                    {!item.inPantry && (
                        <span className="badge-stamp">To Buy</span>
                    )}
                </div>
                {/* Category Picker */}
                <div style={{ position: 'relative', display: 'inline-block', marginTop: '4px' }}>
                    <div
                        onClick={() => setIsEditingCat(!isEditingCat)}
                        className="t-eyebrow"
                        style={{
                            color: 'var(--ink-dim)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                            background: 'var(--ticket-2)',
                            padding: '3px 8px',
                            borderRadius: 'var(--r-xs)',
                            width: 'fit-content',
                            textTransform: 'none',
                            letterSpacing: 'normal',
                        }}
                    >
                        {categories.find(c => c.id === item.category)?.name || 'Unsorted'}
                        <ChevronDown size={12} />
                    </div>

                    {/* Simple Dropdown for Category Switch */}
                    {isEditingCat && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            zIndex: 100,
                            background: 'var(--ticket)',
                            border: '1px solid var(--ticket-shadow)',
                            borderRadius: 'var(--r-sm)',
                            boxShadow: 'var(--shadow-card)',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            width: '180px',
                            padding: '4px',
                        }}>
                            {categories.map(cat => (
                                <div
                                    key={cat.id}
                                    onClick={() => {
                                        updateItem(item.id, { category: cat.id });
                                        setIsEditingCat(false);
                                    }}
                                    className="t-body"
                                    style={{
                                        padding: '8px',
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        borderRadius: 'var(--r-xs)',
                                        color: 'var(--ink)',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--ticket-2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    {cat.name}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Quantity Controls - Middle Right */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {isEssentialView ? (
                    <>
                        <span className="t-eyebrow" style={{ color: 'var(--ink-dim)', marginRight: '2px' }}>Target</span>
                        <IconButton
                            onClick={() => updateItem(item.id, { targetQuantity: Math.max(1, (item.targetQuantity || 1) - 1) })}
                            style={{ borderColor: 'var(--ticket-shadow)', color: 'var(--ink-dim)', width: '28px', height: '28px' }}
                        >-</IconButton>
                        <span className="t-mono" style={{ minWidth: '20px', textAlign: 'center', color: 'var(--ink)' }}>
                            {item.targetQuantity || 1}
                        </span>
                        <IconButton
                            onClick={() => updateItem(item.id, { targetQuantity: (item.targetQuantity || 1) + 1 })}
                            style={{ borderColor: 'var(--ticket-shadow)', color: 'var(--ink-dim)', width: '28px', height: '28px' }}
                        >+</IconButton>
                    </>
                ) : (
                    <>
                        <IconButton
                            onClick={() => updateItem(item.id, { quantity: Math.max(0, (item.quantity ?? 1) - 1) })}
                            disabled={item.quantity === 0}
                            style={{
                                borderColor: 'var(--ticket-shadow)',
                                color: 'var(--ink-dim)',
                                width: '28px',
                                height: '28px',
                                opacity: item.quantity === 0 ? 0.4 : 1,
                            }}
                        >-</IconButton>
                        <span className="t-mono" style={{ minWidth: '20px', textAlign: 'center', color: item.quantity === 0 ? 'var(--stamp)' : 'var(--ink)' }}>
                            {item.quantity ?? 1}
                        </span>
                        <IconButton
                            onClick={() => updateItem(item.id, { quantity: (item.quantity || 0) + 1, inPantry: true })}
                            style={{ borderColor: 'var(--ticket-shadow)', color: 'var(--ink-dim)', width: '28px', height: '28px' }}
                        >+</IconButton>
                    </>
                )}
            </div>

            {/* Essential Heart Toggle */}
            <IconButton
                onClick={() => toggleEssential(item.id)}
                style={{
                    borderColor: item.isMaster ? 'var(--grease)' : 'var(--ticket-shadow)',
                    color: item.isMaster ? 'var(--grease)' : 'var(--ink-dim)',
                    width: '32px',
                    height: '32px',
                    flexShrink: 0,
                }}
                aria-label={item.isMaster ? 'Remove from essentials' : 'Mark as essential'}
            >
                <Heart size={15} fill={item.isMaster ? 'var(--grease)' : 'none'} />
            </IconButton>
        </div>
    );
}
