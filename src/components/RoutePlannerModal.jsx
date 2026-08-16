
import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Sheet } from './ui/Sheet';
import { Button, IconButton } from './ui/Button';

export function RoutePlannerModal({ onClose }) {
    const { categories, categoryOrder, updateCategoryOrder } = useInventory();
    const [localOrder, setLocalOrder] = useState(categoryOrder);

    // Sync local order if context changes (initial load)
    useEffect(() => {
        setLocalOrder(categoryOrder);
    }, [categoryOrder]);

    const moveItem = (index, direction) => {
        const newOrder = [...localOrder];
        const targetIndex = index + direction;

        if (targetIndex < 0 || targetIndex >= newOrder.length) return;

        // Swap
        const temp = newOrder[targetIndex];
        newOrder[targetIndex] = newOrder[index];
        newOrder[index] = temp;

        setLocalOrder(newOrder);
    };

    const handleSave = () => {
        updateCategoryOrder(localOrder);
        onClose();
    };

    return (
        <Sheet
            onClose={onClose}
            title="Route Planner"
            surface="board"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
                    <Button variant="primary" onClick={handleSave} style={{ flex: 2 }}>Save Route</Button>
                </>
            }
        >
            <p className="t-body" style={{ color: 'var(--chalk-dim)', marginTop: '-8px', marginBottom: '16px' }}>
                Order your household check
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {localOrder.map((catId, index) => {
                    const category = categories.find(c => c.id === catId);
                    if (!category) return null;

                    return (
                        <div
                            key={catId}
                            style={{
                                padding: '12px 14px',
                                background: 'var(--board)',
                                border: '1px solid var(--line)',
                                borderRadius: 'var(--r-sm)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                            }}
                        >
                            <span className="t-mono" style={{ fontSize: '12px', color: 'var(--chalk-dim)', width: '18px' }}>
                                {String(index + 1).padStart(2, '0')}
                            </span>
                            <div className="t-body" style={{ flex: 1, fontWeight: 600, color: 'var(--chalk)' }}>
                                {category.name}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <IconButton
                                    onClick={() => moveItem(index, -1)}
                                    disabled={index === 0}
                                    style={{ width: '26px', height: '26px', opacity: index === 0 ? 0.3 : 1 }}
                                    aria-label="Move up"
                                >
                                    <ChevronUp size={14} />
                                </IconButton>
                                <IconButton
                                    onClick={() => moveItem(index, 1)}
                                    disabled={index === localOrder.length - 1}
                                    style={{ width: '26px', height: '26px', opacity: index === localOrder.length - 1 ? 0.3 : 1 }}
                                    aria-label="Move down"
                                >
                                    <ChevronDown size={14} />
                                </IconButton>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Sheet>
    );
}
