import React, { useMemo, useRef, useState } from 'react';
import { Camera, Loader2, SlidersHorizontal } from 'lucide-react';
import { useRecipes } from '../hooks/useRecipes';
import { usePlan } from '../context/PlanContext';
import { useView } from '../context/ViewContext';
import { RecipeCard } from '../components/RecipeCard';
import { AddToPlanModal } from '../components/AddToPlanModal';
import { RecipeSearchBar } from '../components/RecipeSearchBar';
import { RecipeFilterSheet } from '../components/RecipeFilterSheet';
import { FilterChip } from '../components/FilterChip';
import { filterRecipes, getDisplayTags, buildCreatorGroup, FILTER_GROUPS, QUICK_FILTERS } from '../lib/recipeSearch';
import { supabase } from '../lib/supabase';
import { uploadDishPhoto } from '../lib/uploadRecipeImage';

export function RecipeView() {
    const { recipes, loading, error, refetch } = useRecipes();
    const { setDayRecipe } = usePlan();
    const { setCurrentView, VIEWS } = useView();
    const [selectedRecipe, setSelectedRecipe] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [search, setSearch] = useState('');
    const [activeKeys, setActiveKeys] = useState([]);
    const [showFilterSheet, setShowFilterSheet] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [photoError, setPhotoError] = useState(null);
    const photoInputRef = useRef(null);

    const handlePhotoChosen = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !selectedRecipe) return;

        setUploadingPhoto(true);
        setPhotoError(null);
        try {
            const url = await uploadDishPhoto(file);
            if (!supabase) throw new Error('Supabase is not configured — cannot save photo.');

            const { error: updateError } = await supabase
                .from('recipes')
                .update({ image_url: url })
                .eq('id', selectedRecipe.id);

            if (updateError) throw updateError;

            setSelectedRecipe((prev) => (prev ? { ...prev, image_url: url, image: url } : prev));
            refetch();
        } catch (err) {
            console.error('Recipe photo update failed:', err);
            setPhotoError(err?.message || 'Could not save that photo. Please try again.');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const toggleFilter = (key) => {
        setActiveKeys((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
    };

    const clearFilters = () => {
        setSearch('');
        setActiveKeys([]);
    };

    const creatorGroup = useMemo(() => buildCreatorGroup(recipes), [recipes]);
    const allGroups = useMemo(
        () => creatorGroup ? [...FILTER_GROUPS, creatorGroup] : FILTER_GROUPS,
        [creatorGroup]
    );

    const displayedRecipes = useMemo(
        () => filterRecipes(recipes, { query: search, activeKeys, groups: allGroups }),
        [recipes, search, activeKeys, allGroups]
    );

    const hasActiveFilters = search.trim().length > 0 || activeKeys.length > 0;
    const quickKeys = new Set(QUICK_FILTERS.map((f) => f.key));
    const extraFilterCount = activeKeys.filter((k) => !quickKeys.has(k)).length;

    // Zinc Skeleton Loader
    if (loading) {
        return (
            <div className="animate-fade-in" style={{ paddingBottom: '8rem', maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
                <header style={{ textAlign: 'left', marginBottom: '40px' }}>
                    <div className="skeleton bg-zinc-800/50" style={{ height: '3.5rem', width: '60%', borderRadius: '12px', marginBottom: '1rem' }}></div>
                    <div className="skeleton bg-zinc-800/50" style={{ height: '3.5rem', width: '40%', borderRadius: '12px' }}></div>
                </header>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '40px' }}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="skeleton bg-zinc-800/50" style={{ height: '450px', borderRadius: '24px' }}></div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) return (
        <div style={{
            minHeight: '60vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            padding: '2rem',
            background: 'var(--color-bg, #09090b)',
            textAlign: 'center',
        }}>
            <span style={{ fontSize: '2rem' }}>⚠️</span>
            <p style={{ color: '#f87171', fontWeight: 700, fontSize: '1rem', margin: 0 }}>
                Could not connect to recipe database
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', margin: 0 }}>
                {error?.message ?? 'Unknown error'} — check Supabase project status or network connection.
            </p>
        </div>
    );

    return (
        <div
            className="animate-fade-in"
            style={{
                paddingBottom: '8rem',
                maxWidth: '1200px',
                margin: '0 auto',
                padding: '0 20px',
                background: 'var(--zinc-950)',
                minHeight: '100%',
            }}
        >
            {/* Header */}
            <header style={{ textAlign: 'left', paddingTop: '2rem', marginBottom: '1.5rem' }}>
                <p className="t-eyebrow" style={{ marginBottom: '0.5rem' }}>Your Library</p>
                <h2 className="title-display tracking-tight font-bold" style={{ fontSize: '2.75rem', lineHeight: 0.95, color: 'var(--zinc-50)', marginBottom: '0.5rem' }}>
                    Recipes
                </h2>
                <p className="t-body" style={{ margin: 0 }}>
                    {hasActiveFilters
                        ? `${displayedRecipes.length} of ${recipes.length} recipes match`
                        : `${recipes.length} recipes to explore`}
                </p>
            </header>

            {/* Search */}
            <div style={{ marginBottom: '1rem' }}>
                <RecipeSearchBar value={search} onChange={setSearch} />
            </div>

            {/* Quick filter chips + "More filters" trigger */}
            <div
                className="scrollbar-hide"
                style={{
                    display: 'flex',
                    gap: '0.5rem',
                    overflowX: 'auto',
                    paddingBottom: '1rem',
                    marginBottom: '0.5rem',
                }}
            >
                <button
                    onClick={() => setShowFilterSheet(true)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.5rem 1rem',
                        borderRadius: 'var(--radius-pill)',
                        fontFamily: 'var(--font-ui)',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        background: extraFilterCount > 0 ? 'var(--gold-bg)' : 'rgba(255,255,255,0.05)',
                        color: extraFilterCount > 0 ? 'var(--gold)' : 'var(--zinc-400)',
                        border: `1px solid ${extraFilterCount > 0 ? 'var(--gold-border)' : 'rgba(255,255,255,0.1)'}`,
                        cursor: 'pointer',
                    }}
                >
                    <SlidersHorizontal size={14} strokeWidth={2} />
                    Filters{extraFilterCount > 0 ? ` (${extraFilterCount})` : ''}
                </button>
                {QUICK_FILTERS.map(({ key, label }) => (
                    <FilterChip key={key} label={label} active={activeKeys.includes(key)} onClick={() => toggleFilter(key)} />
                ))}
            </div>

            {hasActiveFilters && (
                <button
                    onClick={clearFilters}
                    className="btn-ghost"
                    style={{ marginBottom: '1rem', padding: '4px 8px', fontSize: '0.8rem' }}
                >
                    Clear all
                </button>
            )}

            {/* Results */}
            {displayedRecipes.length === 0 ? (
                <div className="empty-state">
                    <p className="empty-state-title">Nothing matches, yet</p>
                    <p className="empty-state-body">
                        Try a different search term or clear a filter — your library has {recipes.length} recipes waiting.
                    </p>
                    {hasActiveFilters && (
                        <button className="btn-secondary" onClick={clearFilters}>Clear all filters</button>
                    )}
                </div>
            ) : (
            <div className="grid grid-cols-2 gap-4 pb-20 pt-1">
                {displayedRecipes.map((recipe, index) => (
                    <RecipeCard
                        key={recipe.id}
                        recipe={recipe}
                        index={index}
                        onClick={() => setSelectedRecipe(recipe)}
                    />
                ))}
            </div>
            )}

            {showFilterSheet && (
                <RecipeFilterSheet
                    groups={allGroups}
                    activeKeys={activeKeys}
                    onToggle={toggleFilter}
                    onClear={() => setActiveKeys([])}
                    onClose={() => setShowFilterSheet(false)}
                />
            )}

            {/* Persistent Bottom Sheet (342pt width logic in CSS/Mobile view) */}
            {selectedRecipe && !showAddModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    zIndex: 100, // Explicit z-[100]
                    background: 'rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-end',
                    animation: 'fadeIn 0.3s ease'
                }} onClick={() => setSelectedRecipe(null)}>
                    <div
                        className="glass-panel animate-squish"
                        style={{
                            width: '100%',
                            maxWidth: '600px',
                            height: '85vh',
                            background: 'rgba(24, 24, 27, 0.40)', // Zinc-900/40
                            backdropFilter: 'blur(64px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)', // Crisper border
                            color: '#fff',
                            overflowY: 'auto',
                            padding: '3rem 2rem 10rem 2rem', // pb-40 Safe Guard
                            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: '0 -10px 60px rgba(0,0,0,0.5)' // Deeper shadow for lift
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drag Handle */}
                        <div style={{
                            width: '40px',
                            height: '4px',
                            background: 'rgba(0,0,0,0.1)',
                            borderRadius: '2px',
                            margin: '0 auto 2rem auto'
                        }} />
                        <div style={{ position: 'relative', height: '300px', borderRadius: '20px', overflow: 'hidden', marginBottom: '2rem' }}>
                            <img
                                src={selectedRecipe.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800'}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800';
                                }}
                            />
                            <button
                                onClick={() => photoInputRef.current?.click()}
                                disabled={uploadingPhoto}
                                style={{
                                    position: 'absolute',
                                    bottom: '12px',
                                    right: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '8px 14px',
                                    borderRadius: '999px',
                                    background: 'rgba(0,0,0,0.6)',
                                    backdropFilter: 'blur(8px)',
                                    border: 'none',
                                    color: '#fff',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: uploadingPhoto ? 'default' : 'pointer',
                                }}
                            >
                                {uploadingPhoto ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                                {uploadingPhoto ? 'Uploading...' : (selectedRecipe.image_url ? 'Change Photo' : 'Add Photo')}
                            </button>
                            <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChosen} />
                        </div>

                        {photoError && (
                            <p style={{ color: '#f87171', fontSize: '0.8rem', marginBottom: '1rem' }}>{photoError}</p>
                        )}

                        <h2 className="title-display tracking-tight font-bold text-zinc-50" style={{ fontSize: '2.5rem', marginBottom: selectedRecipe.creator ? '0.35rem' : '1rem' }}>
                            {selectedRecipe.title || selectedRecipe.name || 'Untitled Recipe'}
                        </h2>

                        {selectedRecipe.creator && (
                            <p className="t-caption" style={{ marginBottom: '1rem' }}>by {selectedRecipe.creator}</p>
                        )}

                        {getDisplayTags(selectedRecipe, 4).length > 0 && (
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                                {getDisplayTags(selectedRecipe, 4).map((tag) => (
                                    <span key={tag} className="tag">{tag}</span>
                                ))}
                            </div>
                        )}

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: selectedRecipe.difficulty ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
                            gap: '1rem',
                            marginBottom: '2rem',
                        }}>
                            <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>PREP</div>
                                <div style={{ fontWeight: 800 }}>{selectedRecipe.time || selectedRecipe.cook_time || '20m'}</div>
                            </div>
                            <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>SERVINGS</div>
                                <div style={{ fontWeight: 800 }}>{selectedRecipe.baseServings || selectedRecipe.servings || '2'}</div>
                            </div>
                            {selectedRecipe.difficulty && (
                                <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>DIFFICULTY</div>
                                    <div style={{ fontWeight: 800 }}>{selectedRecipe.difficulty}</div>
                                </div>
                            )}
                        </div>

                        <h4 style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.8rem', color: 'rgba(var(--active-glow), 1)', marginBottom: '1rem' }}>Ingredients Matrix</h4>
                        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            {(selectedRecipe.ingredients || []).map((ing, i) => {
                                const displayText = typeof ing === 'object' && ing !== null
                                    ? `${ing.quantity ?? ing.amount ?? ''} ${ing.unit || ''} ${ing.name || ing.item || ''}`.trim()
                                    : ing;

                                return (
                                    <li key={i} style={{
                                        padding: '1rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(0,0,0,0.05)'
                                    }}>
                                        <span>{displayText}</span>
                                    </li>
                                );
                            })}
                        </ul>

                        <div className="flex flex-col gap-3 mt-8">
                            <button
                                onClick={() => setShowAddModal(true)}
                                style={{
                                    width: '100%',
                                    padding: '16px',
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    background: '#27272a', // Zinc-800 (Secondary)
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '16px',
                                    cursor: 'pointer'
                                }}
                            >
                                <span>📅</span> Add to Plan
                            </button>

                            <button
                                onClick={() => {
                                    setCurrentView(VIEWS.COOK_MODE, selectedRecipe);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '16px',
                                    fontSize: '1.1rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    background: '#f4f4f5', // Zinc-100 (Primary)
                                    color: '#09090b', // Zinc-950/Black
                                    border: 'none',
                                    borderRadius: '16px',
                                    cursor: 'pointer'
                                }}
                            >
                                <span>👨‍🍳</span> Cook Now
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAddModal && selectedRecipe && (
                <AddToPlanModal
                    recipe={selectedRecipe}
                    onClose={() => setShowAddModal(false)}
                    onConfirm={(date, recipe) => {
                        setDayRecipe(date, recipe);
                        setShowAddModal(false);
                        setSelectedRecipe(null);
                    }}
                />
            )}
        </div>
    );
}
