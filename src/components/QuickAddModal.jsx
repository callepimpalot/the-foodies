
import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { commonItems } from '../data/commonItems';
import { Sheet } from './ui/Sheet';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';

export function QuickAddModal({ onClose, onAdd }) {
    const [selectedItems, setSelectedItems] = useState([]);
    const [activeCategory, setActiveCategory] = useState(commonItems[0].category);

    const toggleSelection = (item) => {
        setSelectedItems(prev =>
            prev.find(i => i.name === item.name)
                ? prev.filter(i => i.name !== item.name)
                : [...prev, item]
        );
    };

    const handleAdd = () => {
        onAdd(selectedItems);
        onClose();
    };

    const currentCategoryItems = commonItems.find(c => c.category === activeCategory)?.items || [];

    return (
        <Sheet
            onClose={onClose}
            title="Quick Add"
            footer={
                <Button
                    variant="primary"
                    disabled={selectedItems.length === 0}
                    onClick={handleAdd}
                    className="w-full"
                    style={{ opacity: selectedItems.length === 0 ? 0.5 : 1 }}
                >
                    Add <span className="t-mono">{selectedItems.length}</span>&nbsp;
                    {selectedItems.length === 1 ? 'Item' : 'Items'}
                </Button>
            }
        >
            <p className="t-body" style={{ color: 'var(--ink-dim)', marginTop: '-8px', marginBottom: '16px' }}>
                Tap items to add to inventory
            </p>

            <div className="flex gap-2 overflow-x-auto scrollbar-hide" style={{ marginBottom: '18px', paddingBottom: '4px' }}>
                {commonItems.map(cat => (
                    <Chip
                        key={cat.category}
                        variant="filter"
                        active={activeCategory === cat.category}
                        label={cat.category}
                        onClick={() => setActiveCategory(cat.category)}
                    />
                ))}
            </div>

            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))' }}>
                {currentCategoryItems.map(item => {
                    const isSelected = !!selectedItems.find(i => i.name === item.name);
                    return (
                        <button
                            key={item.name}
                            onClick={() => toggleSelection(item)}
                            style={{
                                aspectRatio: '1',
                                background: isSelected ? 'var(--stamp-tint)' : 'var(--ticket-2)',
                                border: `1.5px solid ${isSelected ? 'var(--stamp)' : 'var(--ticket-shadow)'}`,
                                borderRadius: 'var(--r-md)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                position: 'relative',
                                color: 'var(--ink)',
                                transition: 'background var(--t-fast), border-color var(--t-fast)',
                            }}
                        >
                            <div style={{ fontSize: '1.75rem' }}>{item.emoji}</div>
                            <div className="t-body" style={{ fontSize: '11px', textAlign: 'center', fontWeight: 600, lineHeight: 1.2 }}>
                                {item.name}
                            </div>

                            {isSelected && (
                                <div style={{
                                    position: 'absolute', top: '4px', right: '4px',
                                    width: '18px', height: '18px', borderRadius: 'var(--r-xs)',
                                    background: 'var(--stamp)', color: 'var(--ticket)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Check size={12} strokeWidth={3} />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </Sheet>
    );
}
