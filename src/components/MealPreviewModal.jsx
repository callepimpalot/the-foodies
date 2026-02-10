import React from 'react';
import { createPortal } from 'react-dom';

export function MealPreviewModal({ recipe, onClose, onAddToPlan }) {
    if (!recipe) return null;

    return createPortal(
        <div className="modal-overlay" onClick={onClose} style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: 0
        }}>
            <div
                className="card animate-slide-up"
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: '600px', // constrain on desktop
                    height: '92vh',    // Almost full screen
                    background: '#ffffff', // FORCE SOLID WHITE
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    borderRadius: '32px 32px 0 0',
                    overflow: 'hidden',
                    boxShadow: '0 -10px 40px rgba(0,0,0,0.2)'
                }}
            >
                {/* Hero Image */}
                <div style={{
                    height: '35vh',
                    minHeight: '250px',
                    backgroundImage: `url(${recipe.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800'})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative',
                    flexShrink: 0
                }}>
                    {/* Close Button */}
                    <button
                        className="icon-btn"
                        onClick={onClose}
                        style={{
                            position: 'absolute',
                            top: '20px',
                            right: '20px',
                            background: 'rgba(0, 0, 0, 0.5)',
                            backdropFilter: 'blur(8px)',
                            border: 'none',
                            color: 'white',
                            width: '40px',
                            height: '40px'
                        }}
                    >
                        ✕
                    </button>

                    {/* Gradient for text visibility if needed, or style hook */}
                    <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '80px',
                        background: 'linear-gradient(to top, var(--color-surface), transparent)'
                    }} />
                </div>

                {/* Content Scroll View - Now with solid background */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '24px',
                    marginTop: '-24px', // Pull up to overlap image
                    position: 'relative',
                    zIndex: 10,
                    background: '#ffffff', // Ensure this is also white
                    borderRadius: '24px 24px 0 0', // Rounded top for the sheet look
                }}>
                    <div style={{ marginBottom: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                            background: 'var(--color-primary-dim)',
                            color: 'var(--color-primary)',
                            padding: '6px 14px',
                            borderRadius: '100px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            textTransform: 'uppercase'
                        }}>
                            {recipe.time || '20 min'}
                        </span>
                        <span style={{
                            background: 'var(--color-surface-dim)',
                            padding: '6px 14px',
                            borderRadius: '100px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--color-text-secondary)'
                        }}>
                            {Math.round(recipe.calories || 450)} kcal
                        </span>
                    </div>

                    <h2 className="title-xl" style={{ marginBottom: '16px', lineHeight: 1.1 }}>
                        {recipe.label || recipe.title || 'Unknown Meal'}
                    </h2>

                    <p className="text-body" style={{ fontSize: '1rem', lineHeight: 1.6, marginBottom: '32px' }}>
                        {recipe.description || "A delicious and nutritious meal perfect for any day of the week. Packed with flavor and essential nutrients."}
                    </p>

                    <div style={{ marginBottom: '32px' }}>
                        <h3 className="title-md" style={{ marginBottom: '16px' }}>Ingredients</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {(recipe.ingredients || ['Tomato', 'Basil', 'Mozzarella', 'Olive Oil', 'Garlic']).map(ing => (
                                <div key={ing} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px',
                                    background: 'var(--color-surface-dim)',
                                    borderRadius: '16px'
                                }}>
                                    <span style={{ color: 'var(--color-primary)' }}>•</span>
                                    <span style={{ fontWeight: 500 }}>{ing}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Add extra padding at bottom so content isn't hidden by footer */}
                    <div style={{ height: '80px' }} />
                </div>

                {/* Sticky Footer */}
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '16px 24px 32px 24px', // Extra bottom pad for safe area
                    background: '#ffffff',
                    borderTop: '1px solid #f0f0f0',
                    zIndex: 10
                }}>
                    <button
                        className="btn-primary"
                        onClick={onAddToPlan}
                        style={{
                            width: '100%',
                            padding: '18px',
                            fontSize: '1.1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        <span>📅</span> Add to Plan
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
