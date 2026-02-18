import React, { useState } from 'react';
import { Clock, Flame, Utensils } from 'lucide-react';

export function RecipeCard({ recipe, onClick, index }) {
    const [imageError, setImageError] = useState(false);

    if (!recipe) return null;

    // Data Mapping Fallbacks
    const title = recipe.title || recipe.name || 'Untitled Recipe';
    const image = recipe.image_url; // STRICT: Only use image_url (backfilled by hook)
    const time = recipe.time || recipe.cook_time || recipe.prep_time;
    const difficulty = recipe.difficulty || recipe.level;

    // Trigger error if image is empty string or null
    const hasImage = image && image.length > 0;
    const showFallback = imageError || !hasImage;

    return (
        <div
            className="relative w-full aspect-[4/5] overflow-hidden rounded-3xl cursor-pointer animate-squish"
            onClick={onClick}
            style={{
                animation: `fadeIn 0.8s var(--spring-easing) ${index * 0.1}s forwards`,
                opacity: 0,
                border: '1px solid rgba(255,255,255,0.05)'
            }}
        >
            {/* Background Layer */}
            {showFallback ? (
                // Fallback Zinc Gradient with Logo
                <div className="absolute inset-0 z-[-1] flex flex-col items-center justify-center text-zinc-700 bg-gradient-to-br from-zinc-900 to-zinc-950">
                    <Utensils size={24} />
                    <span className="mt-2 text-[0.6rem] font-bold tracking-[0.2em] uppercase">Foodies</span>
                </div>
            ) : (
                // Image Layer
                <>
                    <img
                        src={image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800'}
                        alt={title}
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800';
                            setImageError(true);
                        }}
                        className="absolute inset-0 w-full h-full object-cover z-[-2] transition-transform duration-500 ease-[var(--spring-easing)]"
                    />
                    {/* Gradient Overlay for Text Readability */}
                    <div className="absolute inset-0 z-[-1] bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                </>
            )}

            {/* Content Overlay - Bottom 30% */}
            <div className="absolute bottom-0 left-0 w-full p-4 flex flex-col justify-end">
                <div style={{
                    backdropFilter: 'blur(8px)', // Reduced Blur
                    padding: '0.75rem', // Reduced Padding
                    borderRadius: '16px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                }}>
                    <h3 className="font-bold text-lg leading-tight mb-1 text-white shadow-sm line-clamp-2 tracking-tight">
                        {title}
                    </h3>

                    <div className="flex gap-3 text-xs opacity-90 text-zinc-200">
                        {time && (
                            <div className="flex items-center gap-1">
                                <Clock size={12} strokeWidth={2} />
                                <span>{time}</span>
                            </div>
                        )}
                        {difficulty && (
                            <div className="flex items-center gap-1">
                                <Flame size={12} strokeWidth={2} />
                                <span>{difficulty}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
