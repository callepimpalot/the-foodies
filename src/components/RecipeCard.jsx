import React, { useState } from 'react';
import { Utensils } from 'lucide-react';

// Mirrors the Discover rail's card pattern (HomeView.jsx): the photo is the
// hero, left un-obscured except a subtle gradient near the very bottom and one
// small badge. Everything else (title, creator, meta) lives below the image
// in its own space, not layered on top of it.
export function RecipeCard({ recipe, onClick, index }) {
    const [imageError, setImageError] = useState(false);

    if (!recipe) return null;

    const title = recipe.title || recipe.name || 'Untitled Recipe';
    const image = recipe.image_url; // STRICT: Only use image_url (backfilled by hook)
    const time = recipe.time || recipe.cook_time || recipe.prep_time;
    const difficulty = recipe.difficulty || recipe.level;

    const hasImage = image && image.length > 0;
    const showFallback = imageError || !hasImage;

    const metaLine = [time, recipe.kcal ? `${recipe.kcal} kcal` : null].filter(Boolean).join(' · ');

    return (
        <div
            className="cursor-pointer"
            onClick={onClick}
            style={{
                animation: `fadeIn 0.6s ease-out ${index * 0.08}s forwards`,
                opacity: 0,
            }}
        >
            <div
                className="relative w-full aspect-[4/5] overflow-hidden mb-2"
                style={{
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--r-md)',
                    background: 'var(--board-2)',
                }}
            >
                {showFallback ? (
                    <div
                        className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center"
                        style={{ background: 'linear-gradient(160deg, var(--board-2), var(--board))', color: 'var(--chalk-dim)' }}
                    >
                        <h3 className="t-heading-sm mb-2" style={{ color: 'var(--chalk)', fontStyle: 'italic' }}>{title}</h3>
                        <div className="flex items-center gap-1 opacity-70">
                            <Utensils size={14} />
                            <span className="t-eyebrow">Foodies</span>
                        </div>
                    </div>
                ) : (
                    <>
                        <img
                            src={image}
                            alt={title}
                            onError={() => setImageError(true)}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out"
                        />
                        {/* Subtle gradient, only tall enough to keep the badge legible — the photo stays the focus */}
                        <div
                            className="absolute inset-0"
                            style={{ background: 'linear-gradient(to top, rgba(20,33,27,0.78), transparent 45%)' }}
                        />
                    </>
                )}

                {difficulty && !showFallback && (
                    <span
                        className="t-eyebrow absolute bottom-3 left-3"
                        style={{
                            padding: '4px 9px',
                            borderRadius: 'var(--r-xs)',
                            background: 'rgba(20,33,27,0.65)',
                            border: '1px solid var(--line)',
                            color: 'var(--chalk)',
                        }}
                    >
                        {difficulty}
                    </span>
                )}
            </div>

            <h3 className="t-heading-sm leading-tight line-clamp-2" style={{ color: 'var(--chalk)' }}>
                {title}
            </h3>

            {recipe.creator && (
                <p className="t-body truncate" style={{ color: 'var(--chalk-dim)', fontSize: '12px', marginTop: '2px' }}>
                    by {recipe.creator}
                </p>
            )}

            {metaLine && (
                <p className="t-mono" style={{ color: 'var(--chalk-dim)', fontSize: '12px', marginTop: '4px' }}>
                    {metaLine}
                </p>
            )}
        </div>
    );
}
