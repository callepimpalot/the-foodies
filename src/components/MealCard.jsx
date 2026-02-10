import React from 'react';

export function MealCard({ recipe, onClick }) {
    if (!recipe) return null;

    return (
        <div
            className="card"
            onClick={onClick}
            style={{
                minWidth: '260px', // Wider for horizontal flow
                width: '260px',
                height: '180px',   // Compact but immersive
                cursor: 'pointer',
                position: 'relative',
                backgroundImage: `url(${recipe.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400'})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                overflow: 'hidden',
                borderRadius: '20px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
        >
            {/* Gradient Overlay - Bottom Up */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0) 40%, rgba(0,0,0,0.85) 100%)',
                zIndex: 1
            }} />

            {/* Top Badges */}
            <div style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                right: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                zIndex: 2
            }}>
                {/* Optional "Promo" or "Category" badge could go here */}
                <div />

                <div style={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    padding: '4px 8px',
                    borderRadius: '8px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#1a1a1a',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                    {recipe.time || '20m'}
                </div>
            </div>

            {/* Bottom Content */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '16px',
                zIndex: 2,
                color: 'white'
            }}>
                <h3 className="title-md" style={{
                    marginBottom: '4px',
                    fontSize: '1rem',
                    lineHeight: '1.3',
                    textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                }}>
                    {recipe.label || recipe.title || 'Unknown Meal'}
                </h3>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', opacity: 0.9 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        🔥 {Math.round(recipe.calories || 450)}
                    </span>
                    <span>•</span>
                    <span>{recipe.ingredients?.length || 3} items</span>
                </div>
            </div>
        </div>
    );
}
