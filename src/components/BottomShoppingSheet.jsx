import React, { useState } from 'react';
import { usePlan } from '../context/PlanContext';
import { useInventory } from '../context/InventoryContext';

export function BottomShoppingSheet() {
    const [isOpen, setIsOpen] = useState(false);
    const { weeklyPlan, isPlanConfirmed } = usePlan();
    const { items: pantryItems } = useInventory();

    // Aggregation logic (from ShopView but simplified for peek)
    const shoppingList = {};
    if (isPlanConfirmed) {
        Object.values(weeklyPlan).forEach(daySlots => {
            Object.values(daySlots).forEach(entry => {
                const recipe = entry.recipe;
                const servings = entry.servings || 2;
                if (recipe && recipe.ingredients) {
                    recipe.ingredients.forEach(ing => {
                        shoppingList[ing] = (shoppingList[ing] || 0) + (servings / recipe.baseServings);
                    });
                }
            });
        });
    }

    const neededItems = Object.entries(shoppingList).filter(([name]) => {
        const inPantry = pantryItems.find(p => p.name.toLowerCase() === name.toLowerCase() && p.inPantry);
        return !inPantry;
    });

    if (!isPlanConfirmed || neededItems.length === 0) return null;

    return (
        <div
            className="glass-panel animate-squish"
            style={{
                position: 'fixed',
                bottom: isOpen ? '0' : '-calc(100% - 60px)',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '100%',
                maxWidth: '600px',
                height: '70vh',
                zIndex: 1000,
                background: 'var(--color-bg)',
                borderTop: '1px solid rgba(0,0,0,0.1)',
                transition: 'bottom 0.4s var(--spring-easing)',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.1)',
                padding: '1rem 2rem'
            }}
        >
            {/* Drag Handle / Peek Header */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    height: '40px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    marginBottom: '1rem'
                }}
            >
                <div style={{ width: '40px', height: '4px', background: 'rgba(0,0,0,0.1)', borderRadius: '2px', marginBottom: '8px' }} />
                <div style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-secondary)' }}>
                    {isOpen ? 'Minimize List' : `Peek Grocery List (${neededItems.length})`}
                </div>
            </div>

            <div style={{ height: 'calc(100% - 60px)', overflowY: 'auto' }}>
                <h3 className="title-display" style={{ fontSize: '1.8rem', marginBottom: '1.5rem' }}>Smart List</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    {neededItems.map(([name, amount]) => (
                        <div
                            key={name}
                            style={{
                                padding: '1rem',
                                background: 'rgba(0,0,0,0.03)',
                                borderRadius: '16px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                border: '1px solid rgba(0,0,0,0.05)'
                            }}
                        >
                            <span style={{ fontWeight: 600 }}>{name}</span>
                            <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>x{amount.toFixed(1)} qty</span>
                        </div>
                    ))}
                </div>

                <button
                    className="btn-primary"
                    style={{ width: '100%', marginTop: '2rem', padding: '1.2rem' }}
                    onClick={() => {
                        // In a real app, this would trigger 1-click delivery
                        alert('Sending to Delivery Partner...');
                    }}
                >
                    1-Click Checkout
                </button>
            </div>
        </div>
    );
}
