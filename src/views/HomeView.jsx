import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { usePlan } from '../context/PlanContext';
import { useView } from '../context/ViewContext';
import { useRecipes } from '../hooks/useRecipes';
import { MealPreviewModal } from '../components/MealPreviewModal';
import { AddToPlanModal } from '../components/AddToPlanModal';
import { TicketCard, BoardCard } from '../components/ui/TicketCard';
import { Button } from '../components/ui/Button';
import { Sheet } from '../components/ui/Sheet';
import { VIEWS } from '../utils/constants';
import { ChevronRight, Clock, Flame, Users, Package, CalendarClock } from 'lucide-react';
import { expiringItems, describeUseBy, daysUntil } from '../lib/useByDates';
import { filterRecipes } from '../lib/recipeSearch';
import { matchIngredientIndexes } from '../lib/stepIngredients';

// Small kraft-safe meta chip for the hero ticket card — same shape/type as the shared `.tag`
// class, but using the ink-dim/ticket-shadow pair so it reads clearly on the cream ticket
// surface instead of the chalk/line pair `.tag` is tuned for on the dark board.
function TicketTag({ children }) {
    return (
        <span
            className="t-eyebrow"
            style={{
                padding: '4px 9px',
                borderRadius: 'var(--r-xs)',
                border: '1px solid var(--ticket-shadow)',
                color: 'var(--ink-dim)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
            }}
        >
            {children}
        </span>
    );
}

// Recipes that actually use this ingredient (TASK_11).
//
// Two existing pieces, composed — no third search implementation. recipeSearch's
// filterRecipes does the cheap library-wide scoping, then TASK_10's word-boundary
// matcher removes the substring false positives it lets through: a query of "salt"
// must not keep a recipe whose only match is "salted butter".
function recipesUsingIngredient(recipes, name) {
    if (!name?.trim()) return [];
    const candidates = filterRecipes(recipes, { query: name });
    return candidates.filter((recipe) => matchIngredientIndexes(name, recipe?.ingredients ?? []).length > 0);
}

export function HomeView() {
    const { items } = useInventory();
    const { setDayRecipe, resolveDay } = usePlan();
    const { setCurrentView } = useView();
    const { recipes } = useRecipes();

    const [selectedMeal, setSelectedMeal] = useState(null);
    const [selectedSource, setSelectedSource] = useState('library'); // Track source
    const [showAddModal, setShowAddModal] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [useItUpFor, setUseItUpFor] = useState(null);

    // Time-based Greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

    // Next 3 days — one meal per day
    const nextDays = Array.from({ length: 3 }, (_, i) => {
        const dateObj = new Date();
        dateObj.setDate(dateObj.getDate() + i);
        const dateStr = dateObj.toISOString().split('T')[0];
        const resolved = resolveDay(dateStr);

        let badgeLabel = null;
        if (i === 1) badgeLabel = 'Tomorrow';
        else if (i > 1) badgeLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        return {
            dateStr,
            label: i === 0 ? 'Today' : dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
            badgeLabel,
            resolved,
        };
    });

    const handleMealClick = (meal, source = 'library') => {
        setSelectedMeal(meal);
        setSelectedSource(source);
    };
    const handleAddToPlanClick = () => setShowAddModal(true);
    const handleConfirmAddToPlan = (date, recipe) => {
        setDayRecipe(date, recipe);
        setShowAddModal(false);
        setSelectedMeal(null);
    };

    const handleScroll = (e) => {
        const index = Math.round(e.target.scrollLeft / e.target.offsetWidth);
        setActiveIndex(index);
    };

    const displayRecipes = recipes || [];

    // Things about to go off, soonest first. Empty means this section renders NOTHING —
    // no empty state, no placeholder. A Home screen that nags every launch is one you
    // learn to ignore, which would poison the rest of the screen too.
    const expiring = expiringItems(items);

    return (
        <div className="animate-fade-in pb-32 relative">
            {/* Header - Fixed, dark chrome, fades into the board as you scroll past it */}
            <header
                className="fixed top-0 left-0 right-0 z-50 flex justify-between items-start px-4 pb-4 backdrop-blur-md bg-board/70 pt-[env(safe-area-inset-top,24px)] transition-all duration-300 pointer-events-auto"
                style={{ maskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)' }}
            >
                <div>
                    <h1 className="t-heading-lg" style={{ color: 'var(--chalk)' }}>{greeting}</h1>
                    <p className="t-body" style={{ color: 'var(--chalk-dim)' }}>
                        Your culinary week, organised.
                    </p>
                </div>
            </header>

            {/* HERO CAROUSEL: Next 3 days, as torn order tickets */}
            <section className="pt-0 relative z-0 mb-0 mt-3">
                {/* Spacer for Fixed Header */}
                <div className="h-[52px]" />

                <div
                    className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide space-x-4 pb-4"
                    onScroll={handleScroll}
                >
                    {nextDays.map((day) => {
                        const recipe = day.resolved?.recipe;
                        const isClickable = !!recipe;

                        return (
                            <TicketCard
                                key={day.dateStr}
                                torn
                                eyebrow={recipe ? (day.resolved?.type === 'leftover' ? 'Leftovers' : 'Up Next') : undefined}
                                onClick={() => isClickable ? handleMealClick(recipe, 'hero') : setCurrentView(VIEWS.PLAN)}
                                className="snap-center min-w-full cursor-pointer active:scale-[0.99] transition-transform duration-300"
                            >
                                {recipe ? (
                                    <>
                                        <div className="relative w-full h-[170px] rounded-md overflow-hidden mb-4">
                                            {recipe.image_url ? (
                                                <img
                                                    src={recipe.image_url}
                                                    alt={recipe.title}
                                                    className="absolute inset-0 w-full h-full object-cover"
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                        e.currentTarget.nextElementSibling.style.display = 'flex';
                                                    }}
                                                />
                                            ) : null}
                                            <div
                                                className="absolute inset-0 flex items-center justify-center"
                                                style={{ display: recipe.image_url ? 'none' : 'flex', background: 'linear-gradient(to bottom right, var(--board-2), var(--board))' }}
                                            >
                                                <span className="t-eyebrow" style={{ color: 'var(--chalk-dim)', opacity: 0.6 }}>Foodies</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 mb-3">
                                            <TicketTag>{day.label}</TicketTag>
                                            {day.badgeLabel && <TicketTag>{day.badgeLabel}</TicketTag>}
                                            <TicketTag>
                                                <Clock size={10} />
                                                <span className="t-mono">{recipe.time || '20m'}</span>
                                            </TicketTag>
                                        </div>

                                        <h3 className="t-heading-md mb-2" style={{ color: 'var(--ink)' }}>
                                            {recipe.title}
                                        </h3>
                                        <div className="flex items-center gap-4 t-mono" style={{ color: 'var(--ink-dim)', fontSize: '13px' }}>
                                            <span className="flex items-center gap-1.5">
                                                <Flame size={14} style={{ color: 'var(--grease)' }} /> {recipe.kcal ?? '450'} kcal
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <Users size={14} /> {day.resolved?.servings ?? recipe.baseServings ?? 2} Servings
                                            </span>
                                        </div>
                                    </>
                                ) : day.resolved?.type === 'note' ? (
                                    <div className="text-center py-6">
                                        <h3 className="t-heading-sm mb-1" style={{ color: 'var(--ink)', fontStyle: 'italic' }}>{day.resolved.note}</h3>
                                        <p className="t-body" style={{ color: 'var(--ink-dim)' }}>{day.label}</p>
                                    </div>
                                ) : (
                                    <div className="text-center py-6">
                                        <h3 className="t-heading-sm mb-3" style={{ color: 'var(--ink)' }}>Nothing planned</h3>
                                        <Button
                                            variant="primary"
                                            onClick={(e) => { e.stopPropagation(); setCurrentView(VIEWS.PLAN); }}
                                        >
                                            Plan {day.label}
                                        </Button>
                                    </div>
                                )}
                            </TicketCard>
                        );
                    })}
                </div>

                {/* Carousel Indicators */}
                <div className="flex justify-center gap-2 mt-2">
                    {nextDays.map((_, index) => (
                        <div
                            key={index}
                            className="h-[6px] rounded-xs transition-all duration-300"
                            style={{
                                width: index === activeIndex ? '24px' : '6px',
                                background: index === activeIndex ? 'var(--chalk)' : 'var(--line)',
                            }}
                        />
                    ))}
                </div>
            </section>

            {/* USE IT UP — only ever rendered when there is genuinely something to say */}
            {expiring.length > 0 && (
                <section className="mt-5">
                    <div className="flex items-center gap-2 mb-3">
                        <CalendarClock size={16} strokeWidth={1.75} style={{ color: 'var(--grease)' }} />
                        <h2 className="t-heading-md" style={{ color: 'var(--chalk)' }}>Use it up</h2>
                    </div>
                    <BoardCard className="flex flex-col">
                        {expiring.map(({ item, days }, index) => (
                            <div
                                key={item?.id}
                                className="flex items-center justify-between gap-3"
                                style={{
                                    minHeight: '44px',
                                    paddingTop: index === 0 ? 0 : '12px',
                                    paddingBottom: index === expiring.length - 1 ? 0 : '12px',
                                    borderBottom: index === expiring.length - 1 ? 'none' : '1px dashed var(--line)',
                                }}
                            >
                                <div className="min-w-0">
                                    <p className="t-body" style={{ color: 'var(--chalk)' }}>{item?.name}</p>
                                    <p
                                        className="t-mono"
                                        style={{ fontSize: '12px', color: days <= 0 ? 'var(--grease)' : 'var(--chalk-dim)', marginTop: '2px' }}
                                    >
                                        {days < 0 ? 'Was due ' : 'Use by '}{describeUseBy(item?.useByDate)}
                                    </p>
                                </div>
                                <Button
                                    variant="secondary"
                                    onClick={() => setUseItUpFor(item)}
                                    className="shrink-0"
                                >
                                    Find a recipe
                                </Button>
                            </div>
                        ))}
                    </BoardCard>
                </section>
            )}

            {/* PANTRY ACCESS */}
            <section className="mt-5">
                <BoardCard
                    onClick={() => setCurrentView(VIEWS.PANTRY)}
                    className="cursor-pointer active:scale-[0.99] transition-transform flex items-center justify-between"
                >
                    <div className="flex items-center gap-5">
                        <div
                            className="w-16 h-16 rounded-md flex items-center justify-center"
                            style={{ background: 'var(--board)', color: 'var(--chalk-dim)' }}
                        >
                            <Package size={32} strokeWidth={1.5} />
                        </div>
                        <div>
                            <h3 className="t-heading-sm" style={{ color: 'var(--chalk)' }}>My Pantry</h3>
                            <p className="t-body" style={{ color: 'var(--chalk-dim)', marginTop: '2px' }}>
                                <span className="t-mono">{items.length}</span> items tracked
                            </p>
                        </div>
                    </div>
                    <div className="icon-btn">
                        <ChevronRight size={20} />
                    </div>
                </BoardCard>
            </section>

            {/* DISCOVER MEALS */}
            <section className="mt-5">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="t-heading-md" style={{ color: 'var(--chalk)' }}>Discover</h2>
                    <button
                        onClick={() => setCurrentView(VIEWS.RECIPES)}
                        className="t-label transition-colors"
                        style={{ color: 'var(--chalk-dim)' }}
                    >
                        View All
                    </button>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-6 -mx-5 pl-5 pr-5 snap-x snap-mandatory scrollbar-hide scroll-pl-5">
                    {displayRecipes.map(recipe => (
                        <div
                            key={recipe.id}
                            onClick={() => handleMealClick(recipe, 'library')}
                            className="snap-start shrink-0 w-[220px] group cursor-pointer active:scale-[0.98] transition-transform"
                        >
                            <div
                                className="h-[260px] w-full rounded-lg overflow-hidden relative mb-3"
                                style={{ background: 'var(--board-2)', boxShadow: 'var(--shadow-card)' }}
                            >
                                {recipe.image_url ? (
                                    <img
                                        src={recipe.image_url}
                                        alt={recipe.title || recipe.name}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex'; // Show fallback
                                        }}
                                    />
                                ) : null}
                                <div
                                    className="absolute inset-0 flex items-center justify-center"
                                    style={{ display: recipe.image_url ? 'none' : 'flex', background: 'linear-gradient(to bottom right, var(--board-2), var(--board))' }}
                                >
                                    <span className="t-eyebrow" style={{ color: 'var(--chalk-dim)', opacity: 0.6 }}>Foodies</span>
                                </div>
                                <div
                                    className="absolute inset-0"
                                    style={{ background: 'linear-gradient(to top, rgba(20,33,27,0.78), transparent 55%)' }}
                                />
                                <div className="absolute bottom-3 left-3 right-3">
                                    <span
                                        className="t-eyebrow"
                                        style={{
                                            padding: '4px 9px',
                                            borderRadius: 'var(--r-xs)',
                                            background: 'rgba(20,33,27,0.65)',
                                            border: '1px solid var(--line)',
                                            color: 'var(--chalk)',
                                            display: 'inline-block',
                                        }}
                                    >
                                        {recipe.difficulty || 'Easy'}
                                    </span>
                                </div>
                            </div>
                            <h3 className="t-heading-sm px-1" style={{ color: 'var(--chalk)' }}>{recipe.title}</h3>
                            <p className="t-mono px-1" style={{ color: 'var(--chalk-dim)', fontSize: '12px', marginTop: '4px' }}>
                                {recipe.time} · {recipe.kcal ?? '450'} kcal
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {useItUpFor && (
                <UseItUpSheet
                    item={useItUpFor}
                    recipes={recipesUsingIngredient(displayRecipes, useItUpFor?.name)}
                    onClose={() => setUseItUpFor(null)}
                    onPick={(recipe) => { setUseItUpFor(null); handleMealClick(recipe, 'library'); }}
                    onBrowseAll={() => { setUseItUpFor(null); setCurrentView(VIEWS.RECIPES); }}
                />
            )}

            {/* Modals */}
            {selectedMeal && !showAddModal && (
                <MealPreviewModal
                    recipe={selectedMeal}
                    source={selectedSource}
                    onClose={() => setSelectedMeal(null)}
                    onAddToPlan={handleAddToPlanClick}
                    onCookNow={() => {
                        // JIT (Just-in-Time) Hydration Bridge
                        // Don't trust the 'selectedMeal' to have everything.
                        // Go to the Source of Truth (recipes array) one last time.
                        const truthId = selectedMeal.id || selectedMeal.recipeId || (typeof selectedMeal.recipe === 'object' ? selectedMeal.recipe.id : selectedMeal.recipe);

                        let fullPayload = recipes.find(r => String(r.id) === String(truthId));

                        // Fallback: Title Match (if ID failed)
                        if (!fullPayload && selectedMeal.title) {
                            fullPayload = recipes.find(r => r.title.toLowerCase() === selectedMeal.title.toLowerCase());
                            if (fullPayload) {
                                console.log(`👨‍🍳 JIT Repair: Matched by title "${selectedMeal.title}"`);
                            }
                        }

                        // Final Fallback: Use what we have (better than crashing)
                        fullPayload = fullPayload || selectedMeal;

                        // CRITICAL: Verify Instructions
                        if (!fullPayload.instructions || fullPayload.instructions.length === 0) {
                            console.error("❌ CRITICAL: No instructions found in payload!", fullPayload);
                        }

                        setCurrentView(VIEWS.COOK_MODE, fullPayload);
                    }}
                />
            )}

            {showAddModal && (
                <AddToPlanModal
                    recipe={selectedMeal}
                    onClose={() => setShowAddModal(false)}
                    onConfirm={handleConfirmAddToPlan}
                />
            )}
        </div>
    );
}

// The "find a recipe" destination. Deliberately a sheet on Home rather than a jump to
// the Recipes tab: the point is to decide what to cook with the spinach right now, and
// picking one here drops straight into the existing preview → Cook now / Add to plan.
// The full library is one tap further for when nothing here fits.
function UseItUpSheet({ item, recipes, onClose, onPick, onBrowseAll }) {
    const days = daysUntil(item?.useByDate);

    return (
        <Sheet onClose={onClose} title={`Use up ${item?.name}`} surface="board">
            <p className="t-body" style={{ color: 'var(--chalk-dim)', marginBottom: '16px' }}>
                {days != null && days < 0
                    ? `Was due ${describeUseBy(item?.useByDate).toLowerCase()}.`
                    : `Due ${describeUseBy(item?.useByDate).toLowerCase()}.`}
                {' '}
                <span className="t-mono">{recipes.length}</span>
                {recipes.length === 1 ? ' recipe uses it.' : ' recipes use it.'}
            </p>

            {recipes.length === 0 ? (
                <p className="t-body" style={{ color: 'var(--chalk-dim)', marginBottom: '16px' }}>
                    Nothing in your library calls for it by name.
                </p>
            ) : (
                <div className="flex flex-col">
                    {recipes.map((recipe, index) => (
                        <button
                            key={recipe?.id ?? index}
                            onClick={() => onPick(recipe)}
                            className="flex items-center justify-between gap-3 text-left"
                            style={{
                                minHeight: '44px',
                                padding: '12px 0',
                                borderBottom: index === recipes.length - 1 ? 'none' : '1px dashed var(--line)',
                                background: 'transparent',
                            }}
                        >
                            <span className="t-body min-w-0" style={{ color: 'var(--chalk)' }}>{recipe?.title}</span>
                            <span className="t-mono shrink-0" style={{ fontSize: '12px', color: 'var(--chalk-dim)' }}>
                                {recipe?.time ?? `${recipe?.cook_time_minutes ?? '—'}m`}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            <Button variant="ghost" onClick={onBrowseAll} className="w-full" style={{ marginTop: '16px' }}>
                Browse the whole library
            </Button>
        </Sheet>
    );
}
