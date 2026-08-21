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
    const [hasChatProposal, setHasChatProposal] = useState(false);

    const hasItemsInPlan = Object.keys(weeklyPlan).length > 0;
    // Once a chat proposal exists, the big static title is dead weight — on a phone it was eating
    // a third of the screen above the actual day list, the thing being planned. Collapse to just
    // the mode toggle so the list gets the room instead.
    const compactHeader = mode === 'chat' && hasChatProposal;

    const modeToggle = (
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
    );

    return (
        <div className="flex flex-col h-full relative bg-board text-chalk">
            {compactHeader ? (
                <div className="pt-4 pb-3 flex items-center justify-between w-full">
                    {modeToggle}
                </div>
            ) : (
                <div className="pt-5 pb-3 flex flex-col items-start w-full gap-2">
                    <div className="flex items-baseline gap-2">
                        <h2 className="t-display leading-none" style={{ fontSize: 'clamp(22px, 6vw, 28px)', color: 'var(--chalk)' }}>
                            Curate your week
                        </h2>
                        <span className="t-eyebrow" style={{ color: 'var(--grease)' }}>
                            Planning HQ
                        </span>
                    </div>
                    {modeToggle}
                </div>
            )}

            {mode === 'chat' ? (
                <WeekPlanChat onApplied={() => setMode('manual')} onProposalChange={setHasChatProposal} />
            ) : (
                <div className="w-full">
                    <WeeklyCalendar onDayClick={(dateStr) => setActiveDay(dateStr)} onViewRecipe={setViewingRecipe} />
                </div>
            )}

            {/* Lock Week Button */}
            {mode === 'manual' && hasItemsInPlan && !isPlanConfirmed && (
                <div className="fixed bottom-[88px] left-[16px] right-[16px] z-30">
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
                <div className="fixed bottom-[88px] left-[16px] right-[16px] z-30">
                    {/* .btn-secondary is transparent by design (an outline style meant to sit on a
                        solid surface) — this button floats over scrolling list content, so it needs
                        its own opaque backdrop or whatever's scrolled underneath shows straight
                        through it. */}
                    <Button
                        variant="secondary"
                        onClick={toggleConfirmation}
                        className="w-full transition-transform active:scale-[0.98]"
                        style={{ background: 'var(--board-2)', boxShadow: 'var(--shadow-hero)' }}
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
