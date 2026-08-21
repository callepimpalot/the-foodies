import React, { useState } from 'react';
import { Plus, Trash2, X, PenLine, Check } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { QuickAddModal } from './QuickAddModal';
import { Button, IconButton } from './ui/Button';
import { TicketCard } from './ui/TicketCard';

export function Inventory() {
    const { items, categories, addItem, removeItem, toggleFlag, addCategory } = useInventory();
    const [newItemName, setNewItemName] = useState('');
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isManaging, setIsManaging] = useState(false);
    const [showQuickAdd, setShowQuickAdd] = useState(false);

    const handleAddItem = (e) => {
        e.preventDefault();
        if (newItemName.trim()) {
            addItem(newItemName.trim(), 'other');
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

    const categoriesWithItems = categories
        .map(cat => ({ ...cat, items: items.filter(i => i.category === cat.id) }))
        .filter(cat => cat.items.length > 0);

    if (items.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <h3 className="t-heading-sm" style={{ fontStyle: 'italic', color: 'var(--chalk-dim)', marginBottom: '8px' }}>
                    Nothing here yet.
                </h3>
                <p className="t-body" style={{ color: 'var(--chalk-dim)', maxWidth: '260px', margin: '0 auto 20px' }}>
                    Add the things you always want stocked at home.
                </p>
                <Button variant="secondary" onClick={() => setShowQuickAdd(true)}>Add your first items</Button>
                {showQuickAdd && (
                    <QuickAddModal onClose={() => setShowQuickAdd(false)} onAdd={(picked) => picked.forEach(i => addItem(i))} />
                )}
            </div>
        );
    }

    return (
        <div style={{ padding: '0 0 100px 0', width: '100%' }}>
            <TicketCard style={{ marginBottom: '1.5rem' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: '1rem' }}>
                    <h2 className="t-heading-sm">Add to List</h2>
                    <Button
                        variant="ghost"
                        onClick={() => setIsManaging(m => !m)}
                        className="flex items-center gap-1"
                    >
                        {isManaging ? <Check size={14} /> : <PenLine size={14} />}
                        {isManaging ? 'Done' : 'Manage'}
                    </Button>
                </div>
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

            {isManaging && (
                <p className="t-body" style={{ color: 'var(--ink-dim)', marginTop: '-0.75rem', marginBottom: '1.5rem' }}>
                    Tap an item to remove it from your list.
                </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {categoriesWithItems.map(category => (
                    <TicketCard key={category.id}>
                        <h3 className="t-heading-sm" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            {category.name}
                            <span className="t-mono" style={{ fontSize: '12px', color: 'var(--ink-dim)', fontWeight: 400 }}>
                                ({category.items.length})
                            </span>
                        </h3>
                        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))' }}>
                            {category.items.map(item => (
                                <EssentialItemCard
                                    key={item.id}
                                    item={item}
                                    isManaging={isManaging}
                                    onToggle={() => toggleFlag(item.id)}
                                    onRemove={() => removeItem(item.id)}
                                />
                            ))}
                        </div>
                    </TicketCard>
                ))}

                <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                    {!isAddingCategory ? (
                        <Button variant="ghost" onClick={() => setIsAddingCategory(true)} className="inline-flex items-center gap-2">
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
            <div style={{ position: 'fixed', bottom: '100px', right: '16px', zIndex: 100 }}>
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

            {showQuickAdd && (
                <QuickAddModal
                    onClose={() => setShowQuickAdd(false)}
                    onAdd={(picked) => picked.forEach(i => addItem(i))}
                />
            )}
        </div>
    );
}

function EssentialItemCard({ item, isManaging, onToggle, onRemove }) {
    return (
        <button
            onClick={isManaging ? onRemove : onToggle}
            aria-label={isManaging ? `Remove ${item.name}` : (item.flagged ? `Mark ${item.name} as stocked` : `Flag ${item.name} as needed`)}
            style={{
                aspectRatio: '1',
                background: item.flagged ? 'rgba(185, 133, 35, 0.12)' : 'var(--ticket-2)',
                border: `1.5px solid ${item.flagged ? 'var(--grease)' : 'var(--ticket-shadow)'}`,
                borderRadius: 'var(--r-md)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                position: 'relative',
                color: item.flagged ? 'var(--grease)' : 'var(--ink)',
                transition: 'background var(--t-fast), border-color var(--t-fast)',
            }}
        >
            <div style={{ fontSize: '1.75rem' }}>{item.emoji || '📦'}</div>
            <div className="t-body" style={{ fontSize: '11px', textAlign: 'center', fontWeight: 600, lineHeight: 1.2 }}>
                {item.name}
            </div>

            {isManaging && (
                <div style={{
                    position: 'absolute', top: '4px', right: '4px',
                    width: '20px', height: '20px', borderRadius: 'var(--r-xs)',
                    background: 'var(--destructive)', color: 'var(--ticket)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Trash2 size={11} />
                </div>
            )}
        </button>
    );
}
