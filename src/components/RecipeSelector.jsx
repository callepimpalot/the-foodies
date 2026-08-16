import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import { useRecipes } from '../hooks/useRecipes';
import { Sheet } from './ui/Sheet';
import { Chip } from './ui/Chip';

export function RecipeSelector({ onSelect, onClose, slot, date }) {
    const [search, setSearch] = useState('');
    const { recipes } = useRecipes();

    const filteredRecipes = (recipes || []).filter(r =>
        r?.title?.toLowerCase()?.includes(search.toLowerCase()) ||
        (r?.archetypes || []).some(a => a?.toLowerCase()?.includes(search.toLowerCase()))
    );

    return (
        <Sheet onClose={onClose} title={`Select for ${slot}`} surface="ticket">
            <input
                type="text"
                placeholder="Search recipes or archetypes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input"
                style={{
                    width: '100%',
                    marginBottom: 'var(--sp-4)',
                    background: 'var(--ticket-2)',
                    color: 'var(--ink)',
                    border: '1px solid var(--ticket-shadow)',
                }}
            />

            <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
                {filteredRecipes.map(recipe => (
                    <div
                        key={recipe.id}
                        onClick={() => onSelect(recipe)}
                        className="list-row"
                        style={{
                            cursor: 'pointer',
                            borderBottom: 'none',
                            padding: 'var(--sp-3)',
                            borderRadius: 'var(--r-sm)',
                            background: 'var(--ticket-2)',
                            transition: 'background var(--t-fast)',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--ticket-shadow)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--ticket-2)'}
                    >
                        <img
                            src={recipe.image_url || recipe.image}
                            style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: 'var(--r-xs)', flexShrink: 0 }}
                            alt=""
                        />
                        <div style={{ minWidth: 0 }}>
                            <div className="t-body" style={{ fontWeight: 600, color: 'var(--ink)' }}>{recipe.title}</div>
                            {recipe.time && (
                                <div className="t-mono" style={{ fontSize: '11px', color: 'var(--ink-dim)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                    <Clock size={11} strokeWidth={2} />
                                    {recipe.time}
                                </div>
                            )}
                            {(recipe.archetypes || []).length > 0 && (
                                <div style={{ display: 'flex', gap: '4px', marginTop: 'var(--sp-1)', flexWrap: 'wrap' }}>
                                    {recipe.archetypes.map(a => (
                                        <Chip key={a} variant="tag" label={a} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </Sheet>
    );
}
