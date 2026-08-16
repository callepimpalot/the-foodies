import React, { useState } from 'react';
import { WeeklyCalendar } from '../components/WeeklyCalendar';
import { usePlan } from '../context/PlanContext';
import { useView } from '../context/ViewContext';
import { DayActionSheet } from '../components/DayActionSheet';
import { WeekPlanChat } from '../components/WeekPlanChat';
import { RecipeDetailSheet } from '../components/RecipeDetailSheet';
import { Button } from '../components/ui/Button';

export function PlanView() {
    const { isPlanConfirmed, toggleConfirmation, weeklyPlan } = usePlan();
    const { setCurrentView, VIEWS } = useView();

    const [activeDay, setActiveDay] = useState(null); // dateStr
    const [mode, setMode] = useState('manual'); // 'manual' | 'chat'
    const [viewingRecipe, setViewingRecipe] = useState(null);

    const hasItemsInPlan = Object.keys(weeklyPlan).length > 0;

    return (
        <div className="flex flex-col h-full relative bg-board text-chalk">
            {/* Header */}
            <div className="px-6 pt-8 pb-5 flex flex-col items-start w-full gap-[14px]">
                <span className="t-eyebrow" style={{ color: 'var(--grease)' }}>
                    Planning HQ
                </span>
                <h2 className="t-display leading-none" style={{ fontSize: 'clamp(28px, 7vw, 36px)', color: 'var(--chalk)' }}>
                    Curate your week
                </h2>

                <div className="flex gap-[6px] p-[3px] rounded-md bg-board2 border border-line">
                    <button
                        onClick={() => setMode('manual')}
                        className={`px-[14px] py-[7px] rounded-sm t-label transition-colors ${mode === 'manual' ? 'bg-chalk text-board' : 'text-chalkDim'}`}
                    >
                        Manual
                    </button>
                    <button
                        onClick={() => setMode('chat')}
                        className={`px-[14px] py-[7px] rounded-sm t-label transition-colors ${mode === 'chat' ? 'bg-chalk text-board' : 'text-chalkDim'}`}
                    >
                        Chat Plan
                    </button>
                </div>
            </div>

            {mode === 'chat' ? (
                <WeekPlanChat onApplied={() => setMode('manual')} />
            ) : (
                <div className="flex-1 w-full relative">
                    <WeeklyCalendar onDayClick={(dateStr) => setActiveDay(dateStr)} onViewRecipe={setViewingRecipe} />

                    {!hasItemsInPlan && (
                        <div className="absolute top-[30%] left-0 w-full flex flex-col items-center justify-center pointer-events-none px-6">
                            <p className="empty-state" style={{ fontSize: '20px' }}>
                                Nothing planned yet.
                            </p>
                            <p className="t-body text-center mt-[8px]" style={{ color: 'var(--chalk-dim)', maxWidth: '240px' }}>
                                Tap a day to add a meal, mark leftovers, or leave a note.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Lock Week Button */}
            {mode === 'manual' && hasItemsInPlan && !isPlanConfirmed && (
                <div className="fixed bottom-[88px] left-[24px] right-[24px] z-30">
                    <Button
                        variant="primary"
                        onClick={toggleConfirmation}
                        className="w-full transition-transform active:scale-[0.98]"
                        style={{ boxShadow: 'var(--shadow-hero)' }}
                    >
                        Lock This Week
                    </Button>
                </div>
            )}

            {mode === 'manual' && hasItemsInPlan && isPlanConfirmed && (
                <div className="fixed bottom-[88px] left-[24px] right-[24px] z-30">
                    <Button
                        variant="secondary"
                        onClick={toggleConfirmation}
                        className="w-full transition-transform active:scale-[0.98]"
                        style={{ boxShadow: 'var(--shadow-hero)' }}
                    >
                        Plan Locked
                    </Button>
                </div>
            )}

            {activeDay && (
                <DayActionSheet
                    date={activeDay}
                    dayLabel={new Date(activeDay).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    onClose={() => setActiveDay(null)}
                />
            )}

            {viewingRecipe && (
                <RecipeDetailSheet
                    recipe={viewingRecipe}
                    onClose={() => setViewingRecipe(null)}
                    onRecipeUpdated={setViewingRecipe}
                    onCookNow={() => setCurrentView(VIEWS.COOK_MODE, viewingRecipe)}
                />
            )}
        </div>
    );
}
