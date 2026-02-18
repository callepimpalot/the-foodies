import React from 'react';
import { createPortal } from 'react-dom';

export function MealPreviewModal({ recipe, onClose, onAddToPlan, onCookNow, source = 'library' }) {
    if (!recipe) return null;

    // Safety fallback
    const safeRecipe = recipe;

    return createPortal(
        <div className="modal-overlay" onClick={onClose} style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.4)', // Lighter overlay
            backdropFilter: 'blur(24px)', // Force backdrop-blur-2xl (approx 24px)
            zIndex: 999, // Force Top Layer
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
                    background: 'rgba(24, 24, 27, 0.40)', // Zinc-900/40 (Nuclear Transparency)
                    backdropFilter: 'blur(64px)', // Force backdrop-blur-3xl
                    border: '1px solid rgba(255, 255, 255, 0.1)', // Crisper border
                    color: '#fff',
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
                    backgroundImage: `url(${recipe.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800'})`,
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
                    zIndex: 10,
                    background: 'rgba(24, 24, 27, 0.40)', // Zinc-900/40
                    backdropFilter: 'blur(64px)',
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '24px 24px 0 0', // Rounded top for the sheet look
                    padding: '24px', // 24px padding (6x4)
                    marginTop: '-24px', // Restore Overlap
                    position: 'relative', // Needed for z-index overlapping
                    paddingBottom: '10rem', // pb-40 Safe Guard
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px', // gap-y-6 (24px)
                    overflowY: 'auto' // Added back for scrollability
                }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <h2 className="text-white font-extrabold tracking-tighter drop-shadow-md" style={{
                            fontSize: '4.5rem', // text-5xl+
                            margin: 0,
                            lineHeight: 1,
                            flex: 1
                        }}>
                            {safeRecipe.title}
                        </h2>
                        <span style={{
                            background: 'var(--color-primary-dim)',
                            color: 'var(--color-primary)',
                            padding: '6px 14px',
                            borderRadius: '100px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            textTransform: 'uppercase'
                        }}>
                            {safeRecipe.time}
                        </span>
                        <span style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            padding: '6px 14px',
                            borderRadius: '100px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#e4e4e7'
                        }}>
                            {Number(safeRecipe.calories) ? Math.round(Number(safeRecipe.calories)) : '450'} kcal
                        </span>
                    </div>

                    <p className="text-body" style={{ fontSize: '1rem', lineHeight: 1.6, color: '#d4d4d8' }}>
                        {safeRecipe.description}
                    </p>

                    <div style={{ marginBottom: '32px' }}>
                        <h3 className="title-md" style={{ marginBottom: '16px' }}>Ingredients</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {(safeRecipe.ingredients || []).map((ing, i) => {
                                const displayText = typeof ing === 'object' && ing !== null
                                    ? `${ing.amount || ''} ${ing.unit || ''} ${ing.item || ing.name || ''}`.trim()
                                    : ing;

                                return (
                                    <div key={i} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        borderRadius: '16px'
                                    }}>
                                        <span style={{ color: 'var(--color-primary)' }}>•</span>
                                        <span style={{ fontWeight: 500 }}>{displayText}</span>
                                    </div>
                                );
                            })}
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
                    padding: '16px 24px 48px 24px', // Extra bottom pad for safe area
                    background: 'rgba(24, 24, 27, 0.60)', // Slightly more solid for footer
                    backdropFilter: 'blur(64px)',
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    zIndex: 1000 // Above content
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {source === 'library' && (
                            <button
                                onClick={onAddToPlan}
                                style={{
                                    width: '100%',
                                    padding: '16px',
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    background: '#27272a', // Zinc-800
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '16px',
                                    cursor: 'pointer'
                                }}
                            >
                                <span>📅</span> Add to Plan
                            </button>
                        )}

                        {/* Always show Cook Now if it's Hero OR Library */}
                        {(source === 'hero' || source === 'library') && (
                            <button
                                onClick={onCookNow}
                                style={{
                                    width: '100%',
                                    padding: '16px',
                                    fontSize: '1.1rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    background: '#f4f4f5', // Zinc-100
                                    color: '#09090b', // Zinc-950/Black
                                    border: 'none',
                                    borderRadius: '16px',
                                    cursor: 'pointer'
                                }}
                            >
                                <span>👨‍🍳</span> Cook Now
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
