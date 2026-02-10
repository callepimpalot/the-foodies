import React from 'react';
import { usePlan } from '../context/PlanContext';
import { useInventory } from '../context/InventoryContext';

export function ShopView() {
    const { weeklyPlan, isPlanConfirmed } = usePlan();
    const { items: pantryItems } = useInventory();

    // 1. Gather all ingredients from the plan (only if confirmed)
    const shoppingList = {};

    if (isPlanConfirmed) {
        Object.values(weeklyPlan).forEach(daySlots => {
            Object.values(daySlots).forEach(entry => {
                const recipe = entry.recipe || entry;
                const servings = entry.servings || recipe.baseServings || 2;
                const baseServings = recipe.baseServings || 2;
                const ratio = servings / baseServings;

                if (recipe.ingredients) {
                    recipe.ingredients.forEach(ing => {
                        if (shoppingList[ing]) {
                            shoppingList[ing].count += ratio;
                        } else {
                            shoppingList[ing] = { name: ing, count: ratio };
                        }
                    });
                }
            });
        });
    }


    // 2. Add items from the Master Pantry that are marked "toBuy"
    pantryItems.forEach(item => {
        if (item.toBuy) {
            if (shoppingList[item.name]) {
                shoppingList[item.name].isPantryAdd = true;
            } else {
                shoppingList[item.name] = { name: item.name, count: 1, isPantryAdd: true };
            }
        }
    });

    const listItems = Object.values(shoppingList);

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 className="title-display" style={{ textAlign: 'center', marginBottom: '2rem' }}>Shopping List</h2>

            {!isPlanConfirmed && (
                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', marginBottom: '2rem', border: '1px dashed rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📝</div>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>Your plan is still in draft mode.</p>
                    <p style={{ fontSize: '0.9rem', fontStyle: 'italic' }}>Confirm your week in the <strong>Plan</strong> tab to lock in the quantities and generate your list.</p>
                </div>
            )}

            {listItems.length === 0 ? (
                <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛒</div>
                    <p>Your list is empty. Confirm a plan or check items in your pantry.</p>
                </div>
            ) : (
                <div className="glass-panel" style={{ padding: '1rem' }}>
                    {listItems.map((item, index) => {
                        const pantryEntry = pantryItems.find(p => p.name.toLowerCase() === item.name.toLowerCase());
                        const inPantry = pantryEntry?.inPantry;

                        // Format the count (rounding for clean UI)
                        const formattedCount = item.isPantryAdd ? '' : `x${Number(item.count.toFixed(1))}`;

                        return (
                            <div key={index} style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '1rem',
                                borderBottom: index !== listItems.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                                opacity: inPantry ? 0.5 : 1
                            }}>
                                <div style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    border: '2px solid var(--color-text-secondary)',
                                    marginRight: '1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {inPantry && "✓"}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '1.1rem', textDecoration: inPantry ? 'line-through' : 'none' }}>
                                        {item.name} <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginLeft: '0.5rem' }}>{formattedCount}</span>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                        {item.isPantryAdd ? 'Pantry replenishment' : 'Scaled for attendance'}
                                    </div>
                                </div>
                                {item.isPantryAdd && <span style={{ fontSize: '0.7rem', background: 'rgba(52, 211, 153, 0.1)', color: '#10b981', padding: '2px 6px', borderRadius: '4px', marginLeft: '0.5rem' }}>STOCKUP</span>}
                                {inPantry && <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginLeft: '0.5rem' }}>In Pantry</span>}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

