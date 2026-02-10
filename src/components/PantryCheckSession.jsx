import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { SwipeDeck } from './SwipeDeck';

import { ZoneWheel } from './ZoneWheel';

export function PantryCheckSession({ onComplete }) {
    const inventory = useInventory();

    // Safety check for context
    if (!inventory) return <div>Error: No Inventory Context</div>;

    const { items = [], categories = [], toggleToBuy, updateItem, categoryOrder = [] } = inventory;

    // Safe Sort
    let masterItems = [];
    try {
        masterItems = items
            .filter(i => i && i.isMaster)
            .sort((a, b) => {
                const order = categoryOrder || [];
                const indexA = order.indexOf(a.category);
                const indexB = order.indexOf(b.category);
                const safeIndexA = indexA === -1 ? 999 : indexA;
                const safeIndexB = indexB === -1 ? 999 : indexB;
                return safeIndexA - safeIndexB;
            });
    } catch (err) {
        console.error("Sort Error", err);
        masterItems = items.filter(i => i && i.isMaster); // Fallback
    }

    const [currentIndex, setCurrentIndex] = useState(0);
    const [processedIds, setProcessedIds] = useState(new Set()); // Track items we've handled this session
    const [isFinished, setIsFinished] = useState(false);

    // Filter Logic: What to show?
    // We show items that are NOT processed yet.
    // However, SwipeDeck takes a static list. If we filter the list, indices shift.
    // Better: Keep full list, but "jump" over processed items if needed, or just let user loop.
    // Wait, SwipeDeck needs a linear list.
    // Let's stick to the linear masterItems list, but track progress.

    const handleSwipeLeft = (item) => {
        // Have it
        toggleToBuy(item.id, false);
        updateItem(item.id, { inPantry: true });
        markAsProcessed(item.id);
    };

    const handleSwipeRight = (item) => {
        // Need it
        toggleToBuy(item.id, true);
        updateItem(item.id, { inPantry: false });
        markAsProcessed(item.id);
    };

    const markAsProcessed = (id) => {
        setProcessedIds(prev => new Set(prev).add(id));
    };

    // Safe Emoji
    const getEmoji = (name) => {
        if (!name) return '📦';
        const n = String(name).toLowerCase();
        if (n.includes('chicken')) return '🍗';
        if (n.includes('rice')) return '🍚';
        if (n.includes('broccoli')) return '🥦';
        if (n.includes('egg')) return '🥚';
        if (n.includes('pasta')) return '🍝';
        return '📦';
    };

    // Navigation Logic
    const currentItem = masterItems[currentIndex];

    // If currentItem is already processed (e.g. we looped back), should we skip it?
    // Maybe better to show status? For now, let's just let user re-decide.

    const currentCategory = currentItem?.category;
    const currentCategoryInfo = categories.find(c => c.id === currentCategory);

    const handleZoneClick = (categoryId) => {
        const index = masterItems.findIndex(i => i.category === categoryId);
        if (index !== -1) {
            setCurrentIndex(index);
        }
    };

    const handleFinish = () => {
        // Check if there are any unprocessed items
        const unprocessed = masterItems.filter(i => !processedIds.has(i.id));

        if (unprocessed.length > 0) {
            // Did we miss some? Loop back to the first one!
            const firstUnprocessedIndex = masterItems.findIndex(i => !processedIds.has(i.id));
            if (firstUnprocessedIndex !== -1) {
                // Loop!
                setCurrentIndex(firstUnprocessedIndex);
                // Ideally show a toast: "Checking missed items..."
                return;
            }
        }

        setIsFinished(true);
    };

    const renderCard = (item) => {
        if (!item) return null;
        // const categoryName = categories?.find(c => c.id === item.category)?.name || 'Misc';
        const isAlreadyProcessed = processedIds.has(item.id);

        return (
            <div className="glass-panel" style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                textAlign: 'center',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.2)',
                position: 'relative'
            }}>
                {isAlreadyProcessed && (
                    <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: 'rgba(255,255,255,0.2)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.7rem'
                    }}>
                        Already Checked
                    </div>
                )}

                <div style={{ fontSize: '4rem', marginBottom: '1.5rem', marginTop: '2rem' }}>
                    {getEmoji(item.name)}
                </div>
                <h3 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{item.name}</h3>

                <div style={{ margin: '1rem 0', padding: '8px 16px', background: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}>
                    <strong>{item.quantity || 0}</strong> / <strong>{item.targetQuantity || 1}</strong>
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', gap: '2rem', fontSize: '0.9rem', fontWeight: 600 }}>
                    <div style={{ color: '#ff4757' }}>👈 Got It</div>
                    <div style={{ color: '#10C26D' }}>Need It 👉</div>
                </div>
            </div>
        );
    };

    if (masterItems.length === 0) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <h2>No Essentials Found</h2>
                <button onClick={onComplete}>Back</button>
            </div>
        );
    }

    if (isFinished) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <h2>Done!</h2>
                <button onClick={onComplete}>Back</button>
            </div>
        );
    }

    // Filter categories to only those that have items in this session
    const uniqueCategories = [...new Set(masterItems.map(i => i.category))];
    const activeCategories = categories.filter(c => uniqueCategories.includes(c.id));

    return (
        <div style={{ padding: '2rem 0', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h2 className="title-display" style={{ textAlign: 'center', marginBottom: '1rem' }}>Household Check</h2>

            <div style={{ flex: 1, position: 'relative' }}>
                <SwipeDeck
                    items={masterItems}
                    currentIndex={currentIndex}
                    onIndexChange={setCurrentIndex}
                    onSwipeLeft={handleSwipeLeft}
                    onSwipeRight={handleSwipeRight}
                    onFinish={handleFinish}
                    renderCard={renderCard}
                />
            </div>

            {/* Zone Wheel Navigation (Bottom) */}
            <ZoneWheel
                categories={activeCategories}
                currentCategoryInfo={currentCategoryInfo}
                onZoneClick={handleZoneClick}
                categoryOrder={categoryOrder}
            />

            <div style={{ textAlign: 'center', opacity: 0.5, fontSize: '0.8rem', marginBottom: '1rem' }}>
                {masterItems.length - processedIds.size} items remaining
            </div>
        </div>
    );
}
