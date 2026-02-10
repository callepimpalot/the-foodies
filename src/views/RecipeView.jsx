import React, { useState } from 'react';
import { RECIPES } from '../data/recipes';

export function RecipeView() {
    // const { activeArchetype } = useArchetype();
    const [selectedRecipe, setSelectedRecipe] = useState(null);

    return (
        <div className="animate-fade-in" style={{ paddingBottom: '8rem', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Magazine Header */}
            <header style={{ textAlign: 'left', marginBottom: '3rem', padding: '0 1rem' }}>
                <p style={{ color: 'rgba(var(--active-glow), 1)', fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    Curated Discovery
                </p>
                <h2 className="title-display" style={{ fontSize: '3.5rem', lineHeight: 0.9 }}>Digital Culinary</h2>
                <h2 className="title-display" style={{ fontSize: '3.5rem', lineHeight: 0.9, opacity: 0.5 }}>Magazine</h2>
            </header>

            {/* Cards-over-Canvas Feed */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2rem',
                padding: '0 1rem'
            }}>
                {RECIPES.map((recipe, index) => (
                    <div
                        key={recipe.id}
                        className="glass-panel animate-squish"
                        onClick={() => setSelectedRecipe(recipe)}
                        style={{
                            position: 'relative',
                            width: '342pt', // 2026 Spec
                            height: '450px',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-end',
                            padding: '1.5rem',
                            border: '1px solid rgba(0,0,0,0.05)',
                            animation: `fadeIn 0.8s var(--spring-easing) ${index * 0.1}s forwards`,
                            opacity: 0
                        }}
                    >
                        {/* High-Res Background */}
                        <div style={{
                            position: 'absolute',
                            top: 0, left: 0, width: '100%', height: '100%', zIndex: -1,
                            background: `linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 60%), url("${recipe.image}")`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            transition: 'transform 0.5s var(--spring-easing)'
                        }} />

                        {/* Content */}
                        <h3 className="title-display" style={{
                            fontSize: '2.2rem',
                            lineHeight: 1,
                            marginBottom: '0.5rem',
                            color: '#fff',
                            textShadow: '0 2px 10px rgba(0,0,0,0.3)'
                        }}>{recipe.title}</h3>
                        <p style={{
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: '0.85rem',
                            lineHeight: 1.4,
                            marginBottom: '1rem'
                        }}>
                            {recipe.description}
                        </p>
                    </div>
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
                    zIndex: 1000,
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
                            background: 'var(--color-bg-mesh)',
                            overflowY: 'auto',
                            padding: '3rem 2rem',
                            borderTop: '1px solid rgba(var(--active-glow), 0.3)',
                            boxShadow: '0 -10px 40px rgba(0,0,0,0.1)'
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
                            <img src={selectedRecipe.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>

                        <h2 className="title-display" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{selectedRecipe.title}</h2>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                            <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>PREP</div>
                                <div style={{ fontWeight: 800 }}>{selectedRecipe.time}</div>
                            </div>
                            <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>SERVINGS</div>
                                <div style={{ fontWeight: 800 }}>{selectedRecipe.baseServings}</div>
                            </div>
                            <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>MACROS</div>
                                <div style={{ fontWeight: 800 }}>Clean</div>
                            </div>
                        </div>

                        <h4 style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.8rem', color: 'rgba(var(--active-glow), 1)', marginBottom: '1rem' }}>Ingredients Matrix</h4>
                        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            {selectedRecipe.ingredients.map(ing => (
                                <li key={ing} style={{
                                    padding: '1rem',
                                    background: 'rgba(0,0,0,0.03)',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    border: '1px solid rgba(0,0,0,0.05)'
                                }}>
                                    <span>{ing}</span>
                                    <span style={{ opacity: 0.4 }}>Capture Active</span>
                                </li>
                            ))}
                        </ul>

                        <button
                            className="btn-primary"
                            style={{ width: '100%', marginTop: '3rem', padding: '1.2rem' }}
                            onClick={() => setSelectedRecipe(null)}
                        >
                            Close Recipe
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
