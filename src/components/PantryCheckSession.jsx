import React, { useState } from 'react';
import { Package, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { SwipeDeck } from './SwipeDeck';

import { ZoneWheel } from './ZoneWheel';
import { Button } from './ui/Button';

export function PantryCheckSession({ onComplete }) {
    const inventory = useInventory();

    // Safety check for context
    if (!inventory) return <div className="t-body" style={{ color: 'var(--chalk)', padding: '2rem' }}>Error: No Inventory Context</div>;

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
        const categoryInfo = categories.find(c => c.id === item.category);
        const isAlreadyProcessed = processedIds.has(item.id);

        return (
            <div className="card card-torn" style={{
                position: 'relative',
                height: '100%',
                padding: '30px 24px 22px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
            }}>
                <div className="card-punch" />

                {categoryInfo && (
                    <span className="t-eyebrow" style={{ position: 'absolute', top: '24px', left: '22px', color: 'var(--ink-dim)' }}>
                        {categoryInfo.name}
                    </span>
                )}

                {isAlreadyProcessed && (
                    <span className="badge-grease" style={{ position: 'absolute', top: '20px', right: '18px' }}>
                        Checked
                    </span>
                )}

                <Package size={52} strokeWidth={1.5} style={{ color: 'var(--ink-dim)', marginBottom: '18px' }} />

                <h3 className="t-heading-lg" style={{ marginBottom: '14px', color: 'var(--ink)' }}>{item.name}</h3>

                <div className="t-mono" style={{
                    fontSize: '13px',
                    padding: '6px 14px',
                    background: 'var(--ticket-2)',
                    border: '1px solid var(--ticket-shadow)',
                    borderRadius: 'var(--r-sm)',
                    color: 'var(--ink-dim)',
                }}>
                    {item.quantity || 0} / {item.targetQuantity || 1}
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', gap: '32px', paddingTop: '20px' }}>
                    <div className="t-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--ink-dim)' }}>
                        <ArrowLeft size={14} /> Got It
                    </div>
                    <div className="t-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--stamp)' }}>
                        Need It <ArrowRight size={14} />
                    </div>
                </div>
            </div>
        );
    };

    if (masterItems.length === 0) {
        return (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
                <h2 className="t-heading-md" style={{ marginBottom: '0.5rem' }}>No Essentials Found</h2>
                <p className="t-body" style={{ color: 'var(--chalk-dim)', marginBottom: '1.5rem' }}>
                    Mark items as essential to include them in the household check.
                </p>
                <Button variant="secondary" onClick={onComplete}>Back</Button>
            </div>
        );
    }

    if (isFinished) {
        return (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
                <CheckCircle2 size={48} strokeWidth={1.5} style={{ color: 'var(--done)', marginBottom: '1rem' }} />
                <h2 className="t-heading-md" style={{ marginBottom: '0.5rem' }}>All Set</h2>
                <p className="t-body" style={{ color: 'var(--chalk-dim)', marginBottom: '1.5rem' }}>
                    Household check complete.
                </p>
                <Button variant="secondary" onClick={onComplete}>Back</Button>
            </div>
        );
    }

    // Filter categories to only those that have items in this session
    const uniqueCategories = [...new Set(masterItems.map(i => i.category))];
    const activeCategories = categories.filter(c => uniqueCategories.includes(c.id));

    return (
        <div style={{ padding: '2rem 0', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h2 className="t-heading-lg" style={{ textAlign: 'center', marginBottom: '1rem' }}>Household Check</h2>

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

            <div className="t-mono" style={{ textAlign: 'center', color: 'var(--chalk-dim)', fontSize: '12px', marginBottom: '1rem' }}>
                {masterItems.length - processedIds.size} items remaining
            </div>
        </div>
    );
}
