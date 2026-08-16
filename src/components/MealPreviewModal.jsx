import React from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChefHat } from 'lucide-react';
import { Sheet } from './ui/Sheet';
import { Button } from './ui/Button';

export function MealPreviewModal({ recipe, onClose, onAddToPlan, onCookNow, source = 'library' }) {
    if (!recipe) return null;

    // Safety fallback
    const safeRecipe = recipe;
    const kcalValue = Number(safeRecipe?.kcal) ? Math.round(Number(safeRecipe.kcal)) : null;

    return createPortal(
        <Sheet
            onClose={onClose}
            surface="ticket"
            footer={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', width: '100%' }}>
                    {source === 'library' && (
                        <Button
                            variant="secondary"
                            onClick={onAddToPlan}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                color: 'var(--ink)',
                                borderColor: 'var(--ticket-shadow)',
                            }}
                        >
                            <Calendar size={16} strokeWidth={2} />
                            Add to Plan
                        </Button>
                    )}
                    {(source === 'hero' || source === 'library') && (
                        <Button variant="primary" onClick={onCookNow} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <ChefHat size={16} strokeWidth={2} />
                            Cook Now
                        </Button>
                    )}
                </div>
            }
        >
            {/* Hero Image */}
            <div
                style={{
                    height: '30vh',
                    minHeight: '200px',
                    backgroundImage: `url(${safeRecipe.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800'})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderRadius: 'var(--r-md)',
                    marginBottom: 'var(--sp-4)',
                }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
                <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <h2 className="t-heading-lg" style={{ margin: 0, flex: 1, color: 'var(--ink)' }}>
                        {safeRecipe.title}
                    </h2>
                    {safeRecipe.time && (
                        <span className="badge-grease t-mono">{safeRecipe.time}</span>
                    )}
                    {kcalValue != null && (
                        <span className="tag t-mono">{kcalValue} kcal</span>
                    )}
                </div>

                {safeRecipe.description && (
                    <p className="t-body" style={{ lineHeight: 1.6, color: 'var(--ink-dim)', margin: 0 }}>
                        {safeRecipe.description}
                    </p>
                )}

                <div>
                    <h3 className="t-heading-sm" style={{ marginBottom: 'var(--sp-3)', color: 'var(--ink)' }}>Ingredients</h3>
                    <div className="list-ticket" style={{ background: 'var(--ticket-2)' }}>
                        {(safeRecipe.ingredients || []).map((ing, i) => {
                            const displayText = typeof ing === 'object' && ing !== null
                                ? `${ing.amount || ''} ${ing.unit || ''} ${ing.item || ing.name || ''}`.trim()
                                : ing;

                            return (
                                <div key={i} className="list-row">
                                    <span style={{ color: 'var(--stamp)' }}>&bull;</span>
                                    <span className="t-body" style={{ fontWeight: 500, color: 'var(--ink)' }}>{displayText}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Sheet>,
        document.body
    );
}
