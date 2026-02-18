import React, { useState } from 'react';
import { useArchetype } from '../context/ArchetypeContext';
import { useInventory } from '../context/InventoryContext';
import { usePlan } from '../context/PlanContext';
import { useFamily } from '../context/FamilyContext';
import { useView } from '../context/ViewContext';
import { useRecipes } from '../hooks/useRecipes';
import { MealPreviewModal } from '../components/MealPreviewModal';
import { AddToPlanModal } from '../components/AddToPlanModal';
import { VIEWS } from '../utils/constants';
import { ChevronRight, Clock, Flame, Users, User, Package } from 'lucide-react';

export function HomeView({ onOpenProfile }) {
    const { activeArchetype } = useArchetype();
    const { familyData } = useFamily();
    const { items } = useInventory();
    const { addToPlan, weeklyPlan } = usePlan();
    const { setCurrentView } = useView();
    const { recipes } = useRecipes();

    const [selectedMeal, setSelectedMeal] = useState(null);
    const [selectedSource, setSelectedSource] = useState('library'); // Track source
    const [showAddModal, setShowAddModal] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    // Time-based Greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

    // Featured Meal & Hero Logic
    const currentSlot = hour < 10 ? 'breakfast' : hour < 14 ? 'lunch' : 'dinner';
    const SLOTS = ['breakfast', 'lunch', 'dinner'];
    const today = new Date().toISOString().split('T')[0];

    // Calculate Next 3 Meals
    const nextMeals = [];
    let loopSlotIndex = SLOTS.indexOf(currentSlot);
    let loopDateObj = new Date(); // Start today

    for (let i = 0; i < 3; i++) {
        const loopDateStr = loopDateObj.toISOString().split('T')[0];
        const dayPlan = weeklyPlan[loopDateStr] || {};
        const mealEntry = dayPlan[SLOTS[loopSlotIndex]];

        let resolvedMeal = mealEntry?.recipe || mealEntry;

        // Comprehensive Mapping Logic
        // Comprehensive Mapping Logic
        if (resolvedMeal) {
            let foundRecipe = null;

            // 1. Try key lookup
            const idToFind = resolvedMeal.id || resolvedMeal.recipeId || (typeof resolvedMeal === 'string' ? resolvedMeal : null);

            if (idToFind) {
                // FORCE STRING COMPARISON
                foundRecipe = recipes.find(r => String(r.id) === String(idToFind));
            }

            // 2. Fallback: Title Match (Vital for Legacy/Migration)
            if (!foundRecipe && resolvedMeal.title) {
                foundRecipe = recipes.find(r => r.title.toLowerCase() === resolvedMeal.title.toLowerCase());
                if (foundRecipe) {
                    console.log(`🔧 Auto-Repaired Link for "${resolvedMeal.title}": Legacy ID ${idToFind} -> UUID ${foundRecipe.id}`);
                }
            }

            if (foundRecipe) {
                // 3. FORCE MERGE - Prefer generic library data for structural things like IMAGE
                resolvedMeal = {
                    ...foundRecipe, // Base library data (images, title)
                    ...((typeof resolvedMeal === 'object') ? resolvedMeal : {}), // Instance overrides
                    // EXPLICIT HYDRATION: Force core data from library to ensure Cook Mode works
                    id: foundRecipe.id, // Keep the real ID (Auto-Repair)
                    instructions: foundRecipe.instructions || resolvedMeal.instructions,
                    ingredients: foundRecipe.ingredients || resolvedMeal.ingredients,
                    description: foundRecipe.description || resolvedMeal.description,
                    calories: foundRecipe.calories || resolvedMeal.calories,
                    time: foundRecipe.time || resolvedMeal.time,
                    title: foundRecipe.title || resolvedMeal.title,
                    image_url: foundRecipe.image_url || ((typeof resolvedMeal === 'object') ? resolvedMeal.image_url : null)
                };
            } else {
                console.warn(`Hero Mapping: Could not find recipe with ID ${idToFind} or Title "${resolvedMeal.title}" in library.`);
            }
        } else {
            // Case: No meal logic
        }

        // Console Debugging
        console.log(`Hero Logic [${SLOTS[loopSlotIndex]}]:`, {
            idSearched: resolvedMeal?.id,
            found: !!resolvedMeal?.image_url,
            finalImage: resolvedMeal?.image_url
        });

        // Date Badge Logic
        let badgeLabel = null;
        if (i > 0) { // Don't show for first item (Today)
            if (i === 1 && loopSlotIndex === 0) {
                // Optimization: loop logic is complex, simpler check:
                // basic check if date is tomorrow
            }

            // Simplest approach: compare dates
            const now = new Date();
            const itemDate = new Date(loopDateObj);
            const diffTime = itemDate.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > 0) {
                if (diffDays === 1) badgeLabel = 'Tomorrow';
                else badgeLabel = loopDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
        }

        nextMeals.push({
            label: SLOTS[loopSlotIndex].charAt(0).toUpperCase() + SLOTS[loopSlotIndex].slice(1),
            badgeLabel,
            meal: resolvedMeal,
            slot: SLOTS[loopSlotIndex]
        });

        // Advance Loop
        loopSlotIndex++;
        if (loopSlotIndex >= SLOTS.length) {
            loopSlotIndex = 0;
            loopDateObj.setDate(loopDateObj.getDate() + 1);
        }
    }

    const handleMealClick = (meal, source = 'library') => {
        setSelectedMeal(meal);
        setSelectedSource(source);
    };
    const handleAddToPlanClick = () => setShowAddModal(true);
    const handleConfirmAddToPlan = (date, type, recipe) => {
        if (addToPlan) addToPlan(date, type, recipe);
        setShowAddModal(false);
        setSelectedMeal(null);
    };

    const handleScroll = (e) => {
        const index = Math.round(e.target.scrollLeft / e.target.offsetWidth);
        setActiveIndex(index);
    };

    const displayRecipes = recipes || [];

    return (
        <div className="animate-fade-in pb-32 relative">
            {/* Header - Fixed Frosted Glass with Gradient Mask */}
            <header
                className="fixed top-0 left-0 right-0 z-50 flex justify-between items-start px-4 pb-4 backdrop-blur-md bg-white/30 pt-[env(safe-area-inset-top,24px)] transition-all duration-300 pointer-events-auto"
                style={{ maskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)' }}
            >
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 drop-shadow-sm">{greeting}</h1>
                    <p className="text-sm text-zinc-800 font-bold opacity-80">
                        The Foodies Family Orchestrator
                    </p>
                </div>
                <button
                    onClick={onOpenProfile}
                    className="text-zinc-900 transition-colors hover:text-zinc-700 active:scale-95 mt-1 bg-white/20 backdrop-blur-sm p-2 rounded-full"
                >
                    <User size={20} strokeWidth={1.5} />
                </button>
            </header>

            {/* HERO CAROUSEL: Next 24H */}
            <section className="pt-0 relative z-0 mb-0 mt-3">
                {/* Spacer for Fixed Header - Reduced for Tuck */}
                <div className="h-[52px]" />

                {/* Old Up Next Label Removed - Now Inside Card */}

                <div
                    className="mx-4 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide space-x-4 pb-4 px-1"
                    onScroll={handleScroll}
                >
                    {nextMeals.map((slotItem, index) => (
                        <div
                            key={`${slotItem.slot}-${index}`}
                            onClick={() => slotItem.meal ? handleMealClick(slotItem.meal, 'hero') : setCurrentView(VIEWS.PLAN)}
                            className="snap-center min-w-full group relative h-[320px] overflow-hidden rounded-[2rem] shadow-xl cursor-pointer active:scale-[0.99] transition-all duration-300"
                        >
                            <div
                                className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
                            >
                                {/* Universal Image Mapping: Strictly use image_url */}
                                {slotItem.meal?.image_url ? (
                                    <img
                                        src={slotItem.meal.image_url}
                                        alt={slotItem.meal.title}
                                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                        onError={(e) => {
                                            // Fallback to FOODIES gradient only on actual error
                                            e.target.style.display = 'none';
                                            e.currentTarget.nextElementSibling.style.display = 'flex';
                                        }}
                                    />
                                ) : null}

                                {/* Fallback Container - Shown if no image_url OR on Error */}
                                <div
                                    className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-950 flex items-center justify-center"
                                    style={{ display: slotItem.meal?.image_url ? 'none' : 'flex' }}
                                >
                                    <span className="text-zinc-700 font-black text-4xl tracking-tighter opacity-50">FOODIES</span>
                                </div>
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                            {/* Up Next Overlay Tag */}
                            <div className="absolute top-6 left-6 z-20">
                                <span className="bg-zinc-900/60 backdrop-blur-md text-white px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm">
                                    Up Next
                                </span>
                            </div>

                            {/* Top Tags */}


                            {/* Bottom Content */}
                            <div className="absolute bottom-0 left-0 right-0 p-6">
                                {slotItem.meal ? (
                                    <>
                                        {/* Badges moved to bottom */}
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            <span className="bg-white/20 backdrop-blur-md border border-white/10 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase">
                                                {slotItem.label}
                                            </span>
                                            {slotItem.badgeLabel && (
                                                <span className="backdrop-blur-md bg-black/30 text-white text-[10px] font-medium px-2 py-1 rounded-full border border-white/5">
                                                    {slotItem.badgeLabel}
                                                </span>
                                            )}
                                            <span className="bg-zinc-900/80 backdrop-blur-sm text-white px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1">
                                                <Clock size={10} /> {slotItem.meal.time || '20m'}
                                            </span>
                                        </div>

                                        <h3 className="text-3xl font-bold text-white mb-2 leading-tight tracking-tight drop-shadow-md">
                                            {slotItem.meal.label || slotItem.meal.title}
                                        </h3>
                                        <div className="flex items-center gap-4 text-white/90 text-[13px] font-medium">
                                            <span className="flex items-center gap-1.5"><Flame size={14} className="text-orange-400" /> {slotItem.meal.calories || '450'} kcal</span>
                                            <span className="flex items-center gap-1.5"><Users size={14} /> 2 Servings</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center pb-4">
                                        <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">Nothing planned</h3>
                                        <button className="bg-white text-zinc-900 px-6 py-3 rounded-full font-bold text-sm hover:scale-105 transition-transform">
                                            Plan {slotItem.label}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Carousel Indicators */}
                <div className="flex justify-center gap-2 mt-2">
                    {nextMeals.map((_, index) => (
                        <div
                            key={index}
                            className={`h-1.5 rounded-full transition-all duration-300 ${index === activeIndex ? 'w-6 bg-zinc-800' : 'w-1.5 bg-zinc-200'}`}
                        />
                    ))}
                </div>
            </section>

            {/* PANTRY ACCESS */}
            <section className="mt-5">
                <div
                    onClick={() => setCurrentView(VIEWS.PANTRY)}
                    className="group bg-white border border-zinc-200/50 rounded-3xl p-5 shadow-sm hover:shadow-md active:scale-[0.99] transition-all cursor-pointer flex items-center justify-between"
                >
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center text-zinc-600 shadow-inner">
                            <Package size={32} strokeWidth={1.5} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-zinc-900 tracking-tight">My Pantry</h3>
                            <p className="text-zinc-500 text-sm font-medium mt-0.5">
                                {items.filter(i => i.inPantry).length} items available
                            </p>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-zinc-50 group-hover:bg-zinc-100 flex items-center justify-center text-zinc-400 group-hover:text-zinc-900 transition-colors">
                        <ChevronRight size={20} />
                    </div>
                </div>
            </section>

            {/* DISCOVER MEALS */}
            <section className="mt-5">
                <div className="flex justify-between items-center mb-4 px-2">
                    <h2 className="text-xl font-bold tracking-tight text-zinc-900">Discover</h2>
                    <button
                        onClick={() => setCurrentView(VIEWS.RECIPES)}
                        className="text-sm font-semibold text-zinc-900 hover:text-zinc-600 transition-colors"
                    >
                        View All
                    </button>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-6 -mx-5 pl-5 pr-5 snap-x snap-mandatory scrollbar-hide scroll-pl-5">
                    {displayRecipes.map(recipe => (
                        <div
                            key={recipe.id}
                            onClick={() => handleMealClick(recipe, 'library')}
                            className="snap-start shrink-0 w-[240px] group cursor-pointer active:scale-[0.98] transition-transform"
                        >
                            <div className="h-[300px] w-full rounded-[1.5rem] overflow-hidden relative shadow-sm hover:shadow-lg transition-shadow bg-zinc-100 mb-3">
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
                                <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-950 flex items-center justify-center" style={{ display: recipe.image_url ? 'none' : 'flex' }}>
                                    <span className="text-zinc-700 font-black text-2xl tracking-tighter opacity-50">FOODIES</span>
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                                <div className="absolute bottom-4 left-4 right-4">
                                    <span className="bg-white/20 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-full border border-white/10 mb-2 inline-block">
                                        {recipe.difficulty || 'Easy'}
                                    </span>
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-zinc-900 leading-tight px-1 tracking-tight">{recipe.title}</h3>
                            <p className="text-sm text-zinc-500 px-1 mt-1">{recipe.time} • {recipe.calories} kcal</p>
                        </div>
                    ))}
                </div>
            </section>

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
