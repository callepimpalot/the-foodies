import React, { useRef, useState } from 'react';
import { Camera, Loader2, Calendar, ChefHat } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uploadDishPhoto } from '../lib/uploadRecipeImage';
import { getDisplayTags } from '../lib/recipeSearch';
import { Sheet } from './ui/Sheet';
import { Button } from './ui/Button';

// Full recipe detail bottom sheet — image (with in-place photo upload/replace), title, creator,
// tags, prep/servings/difficulty stats, ingredients. Shared by RecipeView.jsx (Recipes tab, with
// "Add to Plan") and PlanView.jsx (viewing what's already planned for a day — omit onAddToPlan
// there, since the day is already placed).
export function RecipeDetailSheet({ recipe, onClose, onRecipeUpdated, onAddToPlan, onCookNow }) {
    const [current, setCurrent] = useState(recipe);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [photoError, setPhotoError] = useState(null);
    const photoInputRef = useRef(null);

    const handlePhotoChosen = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !current?.id) return;

        setUploadingPhoto(true);
        setPhotoError(null);
        try {
            const url = await uploadDishPhoto(file);
            if (!supabase) throw new Error('Supabase is not configured — cannot save photo.');

            const { error: updateError } = await supabase
                .from('recipes')
                .update({ image_url: url })
                .eq('id', current.id);

            if (updateError) throw updateError;

            const updated = { ...current, image_url: url, image: url };
            setCurrent(updated);
            onRecipeUpdated?.(updated);
        } catch (err) {
            console.error('Recipe photo update failed:', err);
            setPhotoError(err?.message || 'Could not save that photo. Please try again.');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const tags = getDisplayTags(current, 4);

    return (
        <Sheet
            onClose={onClose}
            surface="board"
            footer={
                (onAddToPlan || onCookNow) && (
                    <>
                        {onAddToPlan && (
                            <Button
                                variant="secondary"
                                onClick={onAddToPlan}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                <Calendar size={16} strokeWidth={2} />
                                Add to Plan
                            </Button>
                        )}
                        {onCookNow && (
                            <Button
                                variant="primary"
                                onClick={onCookNow}
                                style={{ flex: onAddToPlan ? 1.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                <ChefHat size={16} strokeWidth={2} />
                                Cook Now
                            </Button>
                        )}
                    </>
                )
            }
        >
            <div style={{ position: 'relative', height: '220px', borderRadius: 'var(--r-md)', overflow: 'hidden', marginBottom: 'var(--sp-5)' }}>
                <img
                    src={current.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800';
                    }}
                    alt={current.title || current.name || ''}
                />
                {current.id && (
                    <button
                        onClick={() => photoInputRef.current?.click()}
                        disabled={uploadingPhoto}
                        className="badge-stamp"
                        style={{
                            position: 'absolute', bottom: '10px', right: '10px',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            border: 'none', cursor: uploadingPhoto ? 'default' : 'pointer',
                        }}
                    >
                        {uploadingPhoto ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                        {uploadingPhoto ? 'Uploading...' : (current.image_url ? 'Change Photo' : 'Add Photo')}
                    </button>
                )}
                <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChosen} />
            </div>

            {photoError && (
                <p className="t-body" style={{ color: 'var(--destructive)', marginBottom: 'var(--sp-3)' }}>{photoError}</p>
            )}

            <h2 className="t-heading-lg" style={{ color: 'var(--chalk)', marginBottom: current.creator ? '4px' : 'var(--sp-3)' }}>
                {current.title || current.name || 'Untitled Recipe'}
            </h2>

            {current.creator && (
                <p className="t-eyebrow" style={{ color: 'var(--chalk-dim)', marginBottom: 'var(--sp-3)' }}>by {current.creator}</p>
            )}

            {tags.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: 'var(--sp-5)' }}>
                    {tags.map((tag) => (
                        <span key={tag} className="tag">{tag}</span>
                    ))}
                </div>
            )}

            <div style={{
                display: 'grid',
                gridTemplateColumns: current.difficulty ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
                gap: 'var(--sp-3)',
                marginBottom: 'var(--sp-6)',
            }}>
                <div style={{ padding: 'var(--sp-3)', textAlign: 'center', background: 'var(--board-2)', borderRadius: 'var(--r-sm)' }}>
                    <div className="t-eyebrow" style={{ color: 'var(--chalk-dim)' }}>Prep</div>
                    <div className="t-mono" style={{ fontWeight: 600, color: 'var(--chalk)', marginTop: '2px' }}>{current.time || current.cook_time || '20m'}</div>
                </div>
                <div style={{ padding: 'var(--sp-3)', textAlign: 'center', background: 'var(--board-2)', borderRadius: 'var(--r-sm)' }}>
                    <div className="t-eyebrow" style={{ color: 'var(--chalk-dim)' }}>Servings</div>
                    <div className="t-mono" style={{ fontWeight: 600, color: 'var(--chalk)', marginTop: '2px' }}>{current.baseServings || current.servings || '2'}</div>
                </div>
                {current.difficulty && (
                    <div style={{ padding: 'var(--sp-3)', textAlign: 'center', background: 'var(--board-2)', borderRadius: 'var(--r-sm)' }}>
                        <div className="t-eyebrow" style={{ color: 'var(--chalk-dim)' }}>Difficulty</div>
                        <div className="t-body" style={{ fontWeight: 600, color: 'var(--chalk)', marginTop: '2px' }}>{current.difficulty}</div>
                    </div>
                )}
            </div>

            <h4 className="t-eyebrow" style={{ color: 'var(--stamp)', marginBottom: 'var(--sp-2)' }}>Ingredients</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', marginBottom: 'var(--sp-6)' }}>
                {(current.ingredients || []).map((ing, i) => {
                    const isObj = typeof ing === 'object' && ing !== null;
                    const qty = isObj ? `${ing.quantity ?? ing.amount ?? ''} ${ing.unit ?? ''}`.trim() : '';
                    const name = isObj ? (ing.name ?? ing.item ?? '') : ing;

                    return (
                        <div key={i} style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                            {qty && (
                                <span className="t-mono" style={{ color: 'var(--stamp)', minWidth: '68px', flexShrink: 0 }}>{qty}</span>
                            )}
                            <span className="t-body" style={{ color: 'var(--chalk)' }}>{name}</span>
                        </div>
                    );
                })}
            </div>

            {Array.isArray(current.steps) && current.steps.length > 0 && (
                <>
                    <h4 className="t-eyebrow" style={{ color: 'var(--stamp)', marginBottom: 'var(--sp-2)' }}>Steps</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                        {current.steps.map((step, i) => (
                            <div key={i} style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                                <span className="t-mono" style={{ color: 'var(--chalk-dim)', fontWeight: 600, flexShrink: 0 }}>{i + 1}</span>
                                <span className="t-body" style={{ color: 'var(--chalk)' }}>{typeof step === 'string' ? step : step?.text || step?.instruction}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </Sheet>
    );
}
