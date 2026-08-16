import React, { useMemo, useState } from 'react';
import { SlidersHorizontal, AlertTriangle } from 'lucide-react';
import { useRecipes } from '../hooks/useRecipes';
import { usePlan } from '../context/PlanContext';
import { useView } from '../context/ViewContext';
import { RecipeCard } from '../components/RecipeCard';
import { RecipeDetailSheet } from '../components/RecipeDetailSheet';
import { AddToPlanModal } from '../components/AddToPlanModal';
import { RecipeSearchBar } from '../components/RecipeSearchBar';
import { RecipeFilterSheet } from '../components/RecipeFilterSheet';
import { FilterChip } from '../components/FilterChip';
import { filterRecipes, buildCreatorGroup, FILTER_GROUPS, QUICK_FILTERS } from '../lib/recipeSearch';

export function RecipeView() {
    const { recipes, loading, error, refetch } = useRecipes();
    const { setDayRecipe } = usePlan();
    const { setCurrentView, VIEWS } = useView();
    const [selectedRecipe, setSelectedRecipe] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [search, setSearch] = useState('');
    const [activeKeys, setActiveKeys] = useState([]);
    const [showFilterSheet, setShowFilterSheet] = useState(false);

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

    // Board skeleton loader
    if (loading) {
        return (
            <div className="animate-fade-in" style={{ paddingBottom: '8rem', maxWidth: '1200px', margin: '0 auto', padding: '0 20px', background: 'var(--board)', minHeight: '100%' }}>
                <header style={{ textAlign: 'left', paddingTop: '2rem', marginBottom: '2.5rem' }}>
                    <div style={{ height: '3.5rem', width: '60%', borderRadius: 'var(--r-md)', marginBottom: '1rem', background: 'var(--board-2)' }} />
                    <div style={{ height: '1.5rem', width: '40%', borderRadius: 'var(--r-sm)', background: 'var(--board-2)' }} />
                </header>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} style={{ aspectRatio: '4 / 5', borderRadius: 'var(--r-md)', background: 'var(--board-2)' }} />
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
            background: 'var(--board)',
            textAlign: 'center',
        }}>
            <AlertTriangle size={32} strokeWidth={1.5} color="var(--stamp)" />
            <p className="t-heading-sm" style={{ color: 'var(--stamp)', margin: 0 }}>
                Could not connect to recipe database
            </p>
            <p className="t-body" style={{ color: 'var(--chalk-dim)', margin: 0 }}>
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
                background: 'var(--board)',
                minHeight: '100%',
            }}
        >
            {/* Header */}
            <header style={{ textAlign: 'left', paddingTop: '2rem', marginBottom: '1.5rem' }}>
                <p className="t-eyebrow" style={{ marginBottom: '0.5rem', color: 'var(--chalk-dim)' }}>Your Library</p>
                <h2 className="t-display" style={{ fontSize: '2.75rem', lineHeight: 0.95, color: 'var(--chalk)', marginBottom: '0.5rem' }}>
                    Recipes
                </h2>
                <p className="t-body" style={{ margin: 0, color: 'var(--chalk-dim)' }}>
                    {hasActiveFilters
                        ? <span className="t-mono">{displayedRecipes.length} of {recipes.length}</span>
                        : <span className="t-mono">{recipes.length}</span>}
                    {hasActiveFilters ? ' recipes match' : ' recipes to explore'}
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
                        padding: '8px 14px',
                        borderRadius: 'var(--r-sm)',
                        fontFamily: 'var(--f-mono)',
                        fontSize: '11px',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        background: extraFilterCount > 0 ? 'var(--stamp-tint)' : 'transparent',
                        color: extraFilterCount > 0 ? 'var(--stamp)' : 'var(--chalk-dim)',
                        border: `1px solid ${extraFilterCount > 0 ? 'var(--stamp)' : 'var(--line)'}`,
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
                    style={{ marginBottom: '1rem', padding: '4px 8px', fontSize: '13px' }}
                >
                    Clear all
                </button>
            )}

            {/* Results */}
            {displayedRecipes.length === 0 ? (
                <div className="empty-state" style={{ padding: '3rem 1rem' }}>
                    <p className="t-heading-sm" style={{ color: 'var(--chalk)', marginBottom: '0.5rem' }}>Nothing matches, yet</p>
                    <p className="t-body" style={{ color: 'var(--chalk-dim)', marginBottom: '1.25rem' }}>
                        Try a different search term or clear a filter — your library has <span className="t-mono">{recipes.length}</span> recipes waiting.
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

            {selectedRecipe && !showAddModal && (
                <RecipeDetailSheet
                    recipe={selectedRecipe}
                    onClose={() => setSelectedRecipe(null)}
                    onRecipeUpdated={(updated) => { setSelectedRecipe(updated); refetch(); }}
                    onAddToPlan={() => setShowAddModal(true)}
                    onCookNow={() => setCurrentView(VIEWS.COOK_MODE, selectedRecipe)}
                />
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
