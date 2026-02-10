import React, { useState } from 'react';
import { useArchetype } from '../context/ArchetypeContext';
import { usePlan } from '../context/PlanContext';
import { useInventory } from '../context/InventoryContext';
import { RECIPES } from '../data/recipes';

export function AutoPopulateModal({ onClose }) {
    const { activeArchetype } = useArchetype();
    const { bulkUpdatePlan, weeklyPlan } = usePlan();
    const { items: pantryItems } = useInventory(); // Assuming items is an array of strings or objects with name
    const [isGenerating, setIsGenerating] = useState(false);

    // Preferences
    const [maxTime, setMaxTime] = useState(30);
    const [prioritizePantry, setPrioritizePantry] = useState(true);
    const [keepExisting, setKeepExisting] = useState(true);

    const handleGenerate = () => {
        setIsGenerating(true);

        setTimeout(() => {
            const newPlan = { ...weeklyPlan };
            const days = Array.from({ length: 7 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() + i);
                return d.toISOString().split('T')[0];
            });

            // Filter recipes
            let availableRecipes = RECIPES.filter(r => {
                // 1. Archetype filter (loose)
                const matchArchetype = r.archetypes.includes(activeArchetype.id);

                // 2. Time filter
                const timeStr = r.time.replace('m', '');
                const time = parseInt(timeStr) || 999;
                const matchTime = time <= maxTime;

                return matchArchetype && matchTime;
            });

            // If too strict, fallback to all matching time
            if (availableRecipes.length === 0) {
                availableRecipes = RECIPES.filter(r => {
                    const timeStr = r.time.replace('m', '');
                    const time = parseInt(timeStr) || 999;
                    return time <= maxTime;
                });
            }

            // If still none, fallback to all
            if (availableRecipes.length === 0) availableRecipes = RECIPES;

            // Sort by pantry match if requested
            if (prioritizePantry) {
                availableRecipes.sort((a, b) => {
                    const countMatches = (recipe) => {
                        return recipe.ingredients.filter(ing =>
                            pantryItems.some(pi => pi.name.toLowerCase().includes(ing.toLowerCase()))
                        ).length;
                    };
                    return countMatches(b) - countMatches(a);
                });
            }

            days.forEach(date => {
                ['breakfast', 'lunch', 'dinner'].forEach(slot => {
                    // Skip if keeping existing and slot is filled
                    if (keepExisting && newPlan[date]?.[slot]) return;

                    // Pick a random recipe from the top 5 (to maintain variety but respect sort)
                    const poolSize = Math.min(5, availableRecipes.length);
                    const randomIdx = Math.floor(Math.random() * poolSize);
                    const selectedRecipe = availableRecipes[randomIdx];

                    if (!newPlan[date]) newPlan[date] = {};
                    newPlan[date][slot] = {
                        recipe: selectedRecipe,
                        servings: 2 // Default
                    };
                });
            });

            bulkUpdatePlan(newPlan);
            setIsGenerating(false);
            onClose();
            // Optional: toast or alert here, but UI update should be enough
        }, 1200);
    };

    const glowVar = activeArchetype.glow;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'end', // Bottom sheet style
            justifyContent: 'center',
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease-out'
        }} onClick={onClose}>
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: '600px',
                    background: '#1a1b1e',
                    borderTopLeftRadius: '24px',
                    borderTopRightRadius: '24px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '2rem',
                    animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Auto-Planner Preferences</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>

                    {/* Max Time Slider */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <label style={{ color: 'var(--color-text-secondary)' }}>Max Prep Time</label>
                            <span style={{ fontWeight: 600 }}>{maxTime} min</span>
                        </div>
                        <input
                            type="range"
                            min="5"
                            max="60"
                            step="5"
                            value={maxTime}
                            onChange={(e) => setMaxTime(parseInt(e.target.value))}
                            style={{ width: '100%', accentColor: `rgb(${glowVar})` }}
                        />
                    </div>

                    {/* Toggles */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontWeight: 600 }}>Use Pantry First</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Prioritize ingredients you have</div>
                        </div>
                        <input
                            type="checkbox"
                            checked={prioritizePantry}
                            onChange={e => setPrioritizePantry(e.target.checked)}
                            style={{ transform: 'scale(1.5)', accentColor: `rgb(${glowVar})` }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontWeight: 600 }}>Keep Existing Meals</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Don't overwrite what you've planned</div>
                        </div>
                        <input
                            type="checkbox"
                            checked={keepExisting}
                            onChange={e => setKeepExisting(e.target.checked)}
                            style={{ transform: 'scale(1.5)', accentColor: `rgb(${glowVar})` }}
                        />
                    </div>

                </div>

                <button
                    className="btn-primary"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    style={{
                        width: '100%',
                        padding: '1rem',
                        fontSize: '1.1rem',
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '0.5rem'
                    }}
                >
                    {isGenerating ? (
                        <>
                            <span className="spinner"></span> Generating...
                        </>
                    ) : (
                        <>✨ Generate Week</>
                    )}
                </button>
            </div>
        </div>
    );
}
