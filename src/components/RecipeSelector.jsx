import React, { useState } from 'react';
import { RECIPES } from '../data/recipes';

export function RecipeSelector({ onSelect, onClose, slot, date }) {
    const [search, setSearch] = useState('');

    const filteredRecipes = RECIPES.filter(r =>
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.archetypes.some(a => a.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
        }}>
            <div className="glass-panel" style={{
                width: '100%',
                maxWidth: '500px',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                padding: '1.5rem',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0 }}>Select for {slot}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
                </div>

                <input
                    type="text"
                    placeholder="Search recipes or archetypes..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: '#fff',
                        marginBottom: '1rem',
                        outline: 'none'
                    }}
                />

                <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gap: '0.75rem' }}>
                    {filteredRecipes.map(recipe => (
                        <div
                            key={recipe.id}
                            onClick={() => onSelect(recipe)}
                            style={{
                                display: 'flex',
                                gap: '1rem',
                                padding: '0.75rem',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                        >
                            <img src={recipe.image} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }} alt="" />
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{recipe.title}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>⏱ {recipe.time}</div>
                                <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem' }}>
                                    {recipe.archetypes.map(a => (
                                        <span key={a} style={{ fontSize: '0.6rem', opacity: 0.6 }}>#{a}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
