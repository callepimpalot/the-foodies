import React, { useState } from 'react';
import { useRecipes } from '../hooks/useRecipes';
import { usePlan } from '../context/PlanContext';
import { useView } from '../context/ViewContext';
import { RecipeCard } from '../components/RecipeCard';

export function RecipeView() {
    const { recipes, loading, error } = useRecipes();
    const { addToPlan } = usePlan();
    const { setCurrentView, VIEWS } = useView();
    // console.log('Rendering Recipes:', recipes); // Debug Log
    const [selectedRecipe, setSelectedRecipe] = useState(null);

    // Zinc Skeleton Loader
    if (loading) {
        return (
            <div className="animate-fade-in" style={{ paddingBottom: '8rem', maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
                <header style={{ textAlign: 'left', marginBottom: '40px' }}>
                    <div className="skeleton bg-zinc-800/50" style={{ height: '3.5rem', width: '60%', borderRadius: '12px', marginBottom: '1rem' }}></div>
                    <div className="skeleton bg-zinc-800/50" style={{ height: '3.5rem', width: '40%', borderRadius: '12px' }}></div>
                </header>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '40px' }}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="skeleton bg-zinc-800/50" style={{ height: '450px', borderRadius: '24px' }}></div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) return <div style={{ padding: '20px', color: 'red' }}>Error loading recipes. Please try again.</div>;

    return (
        <div className="animate-fade-in" style={{ paddingBottom: '8rem', maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}> {/* 20px Global Gutter */}
            {/* Magazine Header */}
            <header style={{ textAlign: 'left', marginBottom: '3rem' }}>
                <p style={{ color: 'rgba(var(--active-glow), 1)', fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    Curated Discovery
                </p>
                <h2 className="title-display tracking-tight font-bold" style={{ fontSize: '3.5rem', lineHeight: 0.9 }}>Digital Culinary</h2>
                <h2 className="title-display tracking-tight font-bold" style={{ fontSize: '3.5rem', lineHeight: 0.9, opacity: 0.5 }}>Magazine</h2>
            </header>

            {/* Cards-over-Canvas Feed with Cinematic Masking */}
            <div className="grid grid-cols-2 gap-4 px-5 pb-20 pt-5">
                {recipes.map((recipe, index) => (
                    <RecipeCard
                        key={recipe.id}
                        recipe={recipe}
                        index={index}
                        onClick={() => setSelectedRecipe(recipe)}
                    />
                ))}
            </div>

            {/* Persistent Bottom Sheet (342pt width logic in CSS/Mobile view) */}
            {selectedRecipe && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    zIndex: 100, // Explicit z-[100]
                    background: 'rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-end',
                    animation: 'fadeIn 0.3s ease'
                }} onClick={() => setSelectedRecipe(null)}>
                    <div
                        className="glass-panel animate-squish"
                        style={{
                            width: '100%',
                            maxWidth: '600px',
                            height: '85vh',
                            background: 'rgba(24, 24, 27, 0.40)', // Zinc-900/40
                            backdropFilter: 'blur(64px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)', // Crisper border
                            color: '#fff',
                            overflowY: 'auto',
                            padding: '3rem 2rem 10rem 2rem', // pb-40 Safe Guard
                            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: '0 -10px 60px rgba(0,0,0,0.5)' // Deeper shadow for lift
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drag Handle */}
                        <div style={{
                            width: '40px',
                            height: '4px',
                            background: 'rgba(0,0,0,0.1)',
                            borderRadius: '2px',
                            margin: '0 auto 2rem auto'
                        }} />
                        Drum
                        <div style={{ position: 'relative', height: '300px', borderRadius: '20px', overflow: 'hidden', marginBottom: '2rem' }}>
                            <img
                                src={selectedRecipe.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800'}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800';
                                }}
                            />
                        </div>

                        <h2 className="title-display tracking-tight font-bold text-zinc-50" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
                            {selectedRecipe.title || selectedRecipe.name || 'Untitled Recipe'}
                        </h2>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                            <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>PREP</div>
                                <div style={{ fontWeight: 800 }}>{selectedRecipe.time || selectedRecipe.cook_time || '20m'}</div>
                            </div>
                            <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>SERVINGS</div>
                                <div style={{ fontWeight: 800 }}>{selectedRecipe.baseServings || selectedRecipe.servings || '2'}</div>
                            </div>
                            <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>MACROS</div>
                                <div style={{ fontWeight: 800 }}>Clean</div>
                            </div>
                        </div>

                        <h4 style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.8rem', color: 'rgba(var(--active-glow), 1)', marginBottom: '1rem' }}>Ingredients Matrix</h4>
                        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            {(selectedRecipe.ingredients || []).map((ing, i) => {
                                const displayText = typeof ing === 'object' && ing !== null
                                    ? `${ing.amount || ''} ${ing.unit || ''} ${ing.item || ing.name || ''}`.trim()
                                    : ing;

                                return (
                                    <li key={i} style={{
                                        padding: '1rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        border: '1px solid rgba(0,0,0,0.05)'
                                    }}>
                                        <span>{displayText}</span>
                                        <span style={{ opacity: 0.4 }}>Capture Active</span>
                                    </li>
                                );
                            })}
                        </ul>

                        <div className="flex flex-col gap-3 mt-8">
                            <button
                                onClick={() => {
                                    // Default to today for quick add, or open a selector. For now, simple add.
                                    addToPlan(new Date().toISOString().split('T')[0], 'dinner', selectedRecipe);
                                    setSelectedRecipe(null);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '16px',
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    background: '#27272a', // Zinc-800 (Secondary)
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '16px',
                                    cursor: 'pointer'
                                }}
                            >
                                <span>📅</span> Add to Plan
                            </button>

                            <button
                                onClick={() => {
                                    setCurrentView(VIEWS.COOK_MODE, selectedRecipe);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '16px',
                                    fontSize: '1.1rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    background: '#f4f4f5', // Zinc-100 (Primary)
                                    color: '#09090b', // Zinc-950/Black
                                    border: 'none',
                                    borderRadius: '16px',
                                    cursor: 'pointer'
                                }}
                            >
                                <span>👨‍🍳</span> Cook Now
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
