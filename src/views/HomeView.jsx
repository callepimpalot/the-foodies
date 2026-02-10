import React, { useState } from 'react';
import { useArchetype } from '../context/ArchetypeContext';
import { useInventory } from '../context/InventoryContext';
import { usePlan } from '../context/PlanContext';
import { useView } from '../context/ViewContext';
import { RECIPES } from '../data/recipes';
import { MealCard } from '../components/MealCard';
import { MealPreviewModal } from '../components/MealPreviewModal';
import { AddToPlanModal } from '../components/AddToPlanModal';
import { VIEWS } from '../utils/constants';

export function HomeView() {
    const { activeArchetype } = useArchetype();
    const { items } = useInventory();
    const { addToPlan } = usePlan();
    const { setCurrentView } = useView();

    const [selectedMeal, setSelectedMeal] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);

    // Get current time for greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

    // Featured Meal (First unavailable meal of the day or just a random one)
    const featuredMeal = RECIPES[0];

    const handleMealClick = (meal) => {
        console.log('Meal clicked:', meal);
        setSelectedMeal(meal);
    };

    const handleAddToPlanClick = () => {
        setShowAddModal(true);
    };

    const handleConfirmAddToPlan = (date, type, recipe) => {
        if (addToPlan) {
            addToPlan(date, type, recipe);
        } else {
            console.warn("addToPlan not available in context");
        }

        setShowAddModal(false);
        setSelectedMeal(null);
    };

    // Hero Logic
    // const currentHour = new Date().getHours(); // Already got hour above
    let currentSlot = 'dinner';
    let slotLabel = 'Dinner';

    if (hour < 10) {
        currentSlot = 'breakfast';
        slotLabel = 'Breakfast';
    } else if (hour < 14) {
        currentSlot = 'lunch';
        slotLabel = 'Lunch';
    }

    const { weeklyPlan } = usePlan();
    const today = new Date().toISOString().split('T')[0];
    const todaysPlan = weeklyPlan[today] || {};
    const plannedMealEntry = todaysPlan[currentSlot];

    // Resolve full recipe details
    let plannedMeal = plannedMealEntry?.recipe || plannedMealEntry;

    // If plannedMeal is just an ID or missing image, try to find it in RECIPES
    if (plannedMeal && (!plannedMeal.image || typeof plannedMeal === 'string' || typeof plannedMeal === 'number')) {
        const idToFind = plannedMeal.id || plannedMeal;
        const foundRecipe = RECIPES.find(r => r.id == idToFind);
        if (foundRecipe) {
            plannedMeal = { ...foundRecipe, ...plannedMeal }; // Merge to keep any custom overrides
        }
    }

    return (
        <div className="animate-fade-in" style={{ paddingBottom: '80px' }}>
            {/* Header */}
            <header style={{
                marginBottom: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div>
                    <h1 className="title-lg">{greeting}</h1>
                    <p className="text-body">{activeArchetype.label}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="icon-btn" style={{ borderRadius: '12px' }}>🔔</button>
                </div>
            </header>

            {/* HERO CARD: Up Next */}
            <div style={{ marginBottom: '32px' }}>
                <div
                    className="card"
                    onClick={() => plannedMeal ? handleMealClick(plannedMeal) : setCurrentView(VIEWS.PLAN)}
                    style={{
                        height: '320px', // Slightly taller for more presence
                        backgroundImage: `url(${plannedMeal?.image || 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=800'})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        position: 'relative',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        borderRadius: '24px', // Requested rounding
                        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.3)', // Deep shadow for pop
                        margin: '0 4px' // Slight inset to see shadow sides
                    }}
                >
                    {/* Gradient Overlay */}
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.8) 100%)',
                        zIndex: 1
                    }} />

                    {/* Top Badge */}
                    <div style={{ position: 'relative', zIndex: 2, padding: '20px', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{
                            background: 'rgba(255, 255, 255, 0.2)',
                            backdropFilter: 'blur(8px)',
                            color: '#fff',
                            padding: '6px 12px',
                            borderRadius: '100px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            border: '1px solid rgba(255, 255, 255, 0.3)'
                        }}>
                            Up Next: {slotLabel}
                        </span>

                        {plannedMeal && (
                            <span style={{
                                background: 'var(--color-primary)',
                                color: '#fff',
                                padding: '6px 12px',
                                borderRadius: '100px',
                                fontSize: '0.75rem',
                                fontWeight: 700
                            }}>
                                {plannedMeal.time || '20m'}
                            </span>
                        )}
                    </div>

                    {/* Bottom Content */}
                    <div style={{ position: 'relative', zIndex: 2, padding: '20px' }}>
                        {plannedMeal ? (
                            <>
                                <h2 className="title-xl" style={{ color: '#fff', marginBottom: '12px', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                                    {plannedMeal.label || plannedMeal.title}
                                </h2>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button className="btn-primary" style={{ flex: 1 }}>
                                        Start Cooking
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', paddingBottom: '20px' }}>
                                <h2 className="title-lg" style={{ color: '#fff', marginBottom: '8px' }}>
                                    Nothing planned for {slotLabel}
                                </h2>
                                <button className="btn-primary" style={{ background: '#fff', color: '#000' }}>
                                    Plan {slotLabel}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Pantry Access */}
            <div
                className="card"
                onClick={() => setCurrentView(VIEWS.PANTRY)}
                style={{
                    padding: '24px',
                    marginBottom: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-surface-dim)',
                    cursor: 'pointer'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{
                        fontSize: '2rem',
                        background: 'var(--color-surface-dim)',
                        width: '64px',
                        height: '64px',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        📦
                    </div>
                    <div>
                        <h3 className="title-md">My Pantry</h3>
                        <p className="text-body" style={{ marginTop: '4px' }}>
                            {items.filter(i => i.inPantry).length} items available
                        </p>
                    </div>
                </div>
                <div className="icon-btn" style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)' }}>
                    ➔
                </div>
            </div>

            {/* Discover Section */}
            <div style={{ marginBottom: '40px' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px',
                    padding: '0 8px'
                }}>
                    <h2 className="title-lg">Discover Meals</h2>
                    <button
                        onClick={() => setCurrentView(VIEWS.RECIPES)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-primary)',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            cursor: 'pointer'
                        }}
                    >
                        View All
                    </button>
                </div>

                <div className="section-scroll" style={{
                    display: 'flex',
                    flexWrap: 'nowrap',
                    overflowX: 'auto',
                    gap: '16px',
                    padding: '4px 20px 32px 20px',
                    margin: '0 -20px',
                    scrollPaddingLeft: '20px',
                    WebkitOverflowScrolling: 'touch',
                    scrollSnapType: 'x mandatory',
                    scrollbarWidth: 'none', // Firefox
                    msOverflowStyle: 'none'  // IE/Edge
                }}>
                    {/* Hide scrollbar for Chrome/Safari/Opera */}
                    <style>{`
                        .section-scroll::-webkit-scrollbar {
                            display: none;
                        }
                    `}</style>
                    {RECIPES.map(recipe => (
                        <div key={recipe.id} style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
                            <MealCard
                                recipe={recipe}
                                onClick={() => handleMealClick(recipe)}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Featured / Up Next (Optional, but good for engagement) */}
            <div style={{ marginBottom: '32px' }}>
                <h2 className="title-lg" style={{ marginBottom: '16px' }}>Trending Now</h2>
                <div
                    className="card"
                    onClick={() => handleMealClick(featuredMeal)}
                    style={{
                        height: '220px',
                        backgroundImage: `url(${featuredMeal?.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        display: 'flex',
                        alignItems: 'flex-end',
                        position: 'relative',
                        cursor: 'pointer'
                    }}
                >
                    <div style={{
                        width: '100%',
                        padding: '20px',
                        background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
                        color: 'white'
                    }}>
                        <div style={{
                            background: 'var(--color-primary)',
                            padding: '4px 12px',
                            borderRadius: '100px',
                            display: 'inline-block',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            marginBottom: '8px'
                        }}>
                            FEATURED
                        </div>
                        <h3 className="title-xl">{featuredMeal?.title || 'Delicious Meal'}</h3>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {selectedMeal && !showAddModal && (
                <MealPreviewModal
                    recipe={selectedMeal}
                    onClose={() => setSelectedMeal(null)}
                    onAddToPlan={handleAddToPlanClick}
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
