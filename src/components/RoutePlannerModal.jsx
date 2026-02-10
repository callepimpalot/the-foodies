
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useInventory } from '../context/InventoryContext';

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
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(5px)'
        }}>
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                    width: '90%',
                    maxWidth: '400px',
                    height: '80vh',
                    background: 'white',
                    borderRadius: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                }}
            >
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Route Planner 🗺️</h2>
                        <p style={{ margin: 0, color: '#888', fontSize: '0.8rem' }}>Order your household check</p>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {localOrder.map((catId, index) => {
                        const category = categories.find(c => c.id === catId);
                        if (!category) return null;

                        return (
                            <motion.div
                                key={catId}
                                layout
                                style={{
                                    padding: '12px',
                                    background: '#f9f9f9',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    border: '1px solid #eee'
                                }}
                            >
                                <div style={{ fontSize: '1.5rem' }}>{category.icon}</div>
                                <div style={{ flex: 1, fontWeight: 600 }}>{category.name}</div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <button
                                        onClick={() => moveItem(index, -1)}
                                        disabled={index === 0}
                                        style={{ border: 'none', background: 'white', cursor: 'pointer', padding: '4px', borderRadius: '4px', opacity: index === 0 ? 0.3 : 1 }}
                                    >
                                        ▲
                                    </button>
                                    <button
                                        onClick={() => moveItem(index, 1)}
                                        disabled={index === localOrder.length - 1}
                                        style={{ border: 'none', background: 'white', cursor: 'pointer', padding: '4px', borderRadius: '4px', opacity: index === localOrder.length - 1 ? 0.3 : 1 }}
                                    >
                                        ▼
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                <div style={{ padding: '1rem', borderTop: '1px solid #eee', display: 'flex', gap: '8px' }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#f0f0f0', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleSave} className="btn-primary" style={{ flex: 2, padding: '12px', borderRadius: '12px' }}>Save Route</button>
                </div>
            </motion.div>
        </div>
    );
}
