import React, { useState } from 'react';
import { Clock, Flame, Utensils } from 'lucide-react';
import { getDisplayTags } from '../lib/recipeSearch';
import { Chip } from './ui/Chip';

export function RecipeCard({ recipe, onClick, index }) {
    const [imageError, setImageError] = useState(false);

    if (!recipe) return null;

    // Data Mapping Fallbacks
    const title = recipe.title || recipe.name || 'Untitled Recipe';
    const image = recipe.image_url; // STRICT: Only use image_url (backfilled by hook)
    const time = recipe.time || recipe.cook_time || recipe.prep_time;
    const difficulty = recipe.difficulty || recipe.level;
    const displayTags = getDisplayTags(recipe, 2);

    // Trigger error if image is empty string or null
    const hasImage = image && image.length > 0;
    const showFallback = imageError || !hasImage;

    return (
        <div
            className="relative w-full aspect-[4/5] overflow-hidden cursor-pointer"
            onClick={onClick}
            style={{
                animation: `fadeIn 0.6s ease-out ${index * 0.08}s forwards`,
                opacity: 0,
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-md)',
                background: 'var(--board-2)',
            }}
        >
            {/* Background Layer */}
            {showFallback ? (
                // Fallback panel with title, board gradient
                <div
                    className="absolute inset-0 z-[-1] flex flex-col items-center justify-center px-4 text-center"
                    style={{ background: 'linear-gradient(160deg, var(--board-2), var(--board))', color: 'var(--chalk-dim)' }}
                >
                    <h3 className="t-heading-sm mb-2" style={{ color: 'var(--chalk)', fontStyle: 'italic' }}>{title}</h3>
                    <div className="flex items-center gap-1 opacity-70">
                        <Utensils size={14} />
                        <span className="t-eyebrow">Foodies</span>
                    </div>
                </div>
            ) : (
                // Image Layer
                <>
                    <img
                        src={image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800'}
                        alt={title}
                        onError={() => setImageError(true)}
                        className="absolute inset-0 w-full h-full object-cover z-[-2] transition-transform duration-500 ease-out"
                    />
                    {/* Gradient Overlay for Text Readability */}
                    <div className="absolute inset-0 z-[-1]" style={{ background: 'linear-gradient(to top, rgba(20,33,27,0.9), transparent 60%)' }} />
                </>
            )}

            {/* Content Overlay - Bottom 30% */}
            <div className="absolute bottom-0 left-0 w-full p-4 flex flex-col justify-end">
                <div
                    style={{
                        backdropFilter: 'blur(8px)',
                        padding: '0.75rem',
                        borderRadius: 'var(--r-sm)',
                        background: 'rgba(20, 33, 27, 0.55)',
                        border: '1px solid var(--line)',
                        color: 'var(--chalk)',
                    }}
                >
                    <h3 className="t-heading-sm leading-tight mb-1 line-clamp-2" style={{ color: 'var(--chalk)' }}>
                        {title}
                    </h3>

                    {recipe.creator && (
                        <p className="t-body mb-1 truncate" style={{ color: 'var(--chalk-dim)', fontSize: '11px', opacity: 0.85 }}>by {recipe.creator}</p>
                    )}

                    <div className="flex gap-3 mb-2" style={{ color: 'var(--chalk-dim)' }}>
                        {time && (
                            <div className="flex items-center gap-1">
                                <Clock size={12} strokeWidth={2} />
                                <span className="t-mono" style={{ fontSize: '11px' }}>{time}</span>
                            </div>
                        )}
                        {difficulty && (
                            <div className="flex items-center gap-1">
                                <Flame size={12} strokeWidth={2} />
                                <span className="t-body" style={{ fontSize: '11px' }}>{difficulty}</span>
                            </div>
                        )}
                    </div>

                    {displayTags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                            {displayTags.map((tag) => (
                                <Chip key={tag} variant="tag" label={tag} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
