import React, { useState } from 'react';
import { useArchetype } from '../context/ArchetypeContext';
import { usePlan } from '../context/PlanContext';
import { RECIPES } from '../data/recipes';

export function AutoPopulate() {
    const { activeArchetype } = useArchetype();
    const { bulkUpdatePlan, clearPlan } = usePlan();
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = () => {
        setIsGenerating(true);

        // Simulate a brief "magic" delay
        setTimeout(() => {
            const newPlan = {};
            const days = Array.from({ length: 7 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() + i);
                return d.toISOString().split('T')[0];
            });

            // Filter recipes for this archetype
            const archetypeRecipes = RECIPES.filter(r =>
                r.archetypes.includes(activeArchetype.id)
            );

            // Fallback to all recipes if none match (shouldn't happen with our new set)
            const pool = archetypeRecipes.length > 0 ? archetypeRecipes : RECIPES;

            days.forEach(date => {
                newPlan[date] = {
                    breakfast: pool[Math.floor(Math.random() * pool.length)],
                    lunch: pool[Math.floor(Math.random() * pool.length)],
                    dinner: pool[Math.floor(Math.random() * pool.length)]
                };
            });


            bulkUpdatePlan(newPlan);
            setIsGenerating(false);
            alert(`Generated a full week of ${activeArchetype.label} meals!`);
        }, 800);
    };

    return (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>{isGenerating ? '🪄' : '✨'}</div>
            <h2 className="title-display">Auto-Magic Planner</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: '1rem', maxWidth: '400px', margin: '1rem auto' }}>
                Fill your entire week with recipes tailored to the <strong>{activeArchetype.label}</strong> archetype.
            </p>

            <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button
                    className="btn-primary"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    style={{ padding: '0.75rem 2rem' }}
                >
                    {isGenerating ? 'Generating...' : 'Generate Week'}
                </button>
                <button
                    className="btn-primary"
                    onClick={() => { if (confirm('Clear entire plan?')) clearPlan(); }}
                    style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '0.75rem 2rem' }}
                >
                    Clear Plan
                </button>
            </div>
        </div>
    );
}

