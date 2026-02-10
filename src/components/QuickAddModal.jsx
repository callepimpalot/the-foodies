
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { commonItems } from '../data/commonItems';

export function QuickAddModal({ onClose, onAdd }) {
    const [selectedItems, setSelectedItems] = useState([]);
    const [activeCategory, setActiveCategory] = useState(commonItems[0].category);

    const toggleSelection = (item) => {
        if (selectedItems.find(i => i.name === item.name)) {
            setSelectedItems(selectedItems.filter(i => i.name !== item.name));
        } else {
            setSelectedItems([...selectedItems, item]);
        }
    };

    const handleAdd = () => {
        onAdd(selectedItems);
        onClose();
    };

    const currentCategoryItems = commonItems.find(c => c.category === activeCategory)?.items || [];

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-end', // Bottom sheet style
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(5px)'
        }}>
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                style={{
                    width: '100%',
                    maxWidth: '800px', // Match main container
                    height: '85vh',
                    background: 'white',
                    borderRadius: '24px 24px 0 0',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 -10px 40px rgba(0,0,0,0.2)'
                }}
            >
                {/* Header */}
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Quick Add</h2>
                        <p style={{ margin: 0, color: '#888', fontSize: '0.9rem' }}>Tap items to add to inventory</p>
                    </div>
                    <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                </div>

                {/* Category Tabs */}
                <div style={{ display: 'flex', gap: '8px', padding: '1rem', overflowX: 'auto', borderBottom: '1px solid #f0f0f0' }}>
                    {commonItems.map(cat => (
                        <button
                            key={cat.category}
                            onClick={() => setActiveCategory(cat.category)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '100px',
                                border: 'none',
                                background: activeCategory === cat.category ? 'var(--color-primary)' : '#f5f5f5',
                                color: activeCategory === cat.category ? 'white' : '#666',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {cat.category}
                        </button>
                    ))}
                </div>

                {/* Grid */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '12px' }}>
                        {currentCategoryItems.map(item => {
                            const isSelected = !!selectedItems.find(i => i.name === item.name);
                            return (
                                <motion.div
                                    key={item.name}
                                    onClick={() => toggleSelection(item)}
                                    layout
                                    style={{
                                        aspectRatio: '1',
                                        background: isSelected ? 'rgba(16, 185, 129, 0.1)' : '#f9f9f9',
                                        border: isSelected ? '2px solid #10b981' : '1px solid #eee',
                                        borderRadius: '16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{ fontSize: '2rem', marginBottom: '4px' }}>{item.emoji}</div>
                                    <div style={{ fontSize: '0.8rem', textAlign: 'center', fontWeight: 500, lineHeight: 1.2 }}>{item.name}</div>

                                    {isSelected && (
                                        <div style={{ position: 'absolute', top: '4px', right: '4px', background: '#10b981', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.8rem' }}>✓</div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer Action */}
                <div style={{ padding: '1rem', borderTop: '1px solid #eee', background: 'white' }}>
                    <button
                        className="btn-primary"
                        disabled={selectedItems.length === 0}
                        onClick={handleAdd}
                        style={{ width: '100%', opacity: selectedItems.length === 0 ? 0.5 : 1 }}
                    >
                        Add {selectedItems.length} Items
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
