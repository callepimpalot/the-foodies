import React, { useState } from 'react';
import { JackpotModal } from '../components/Jackpot';
import { WeeklyCalendar } from '../components/WeeklyCalendar';
import { AutoPopulateModal } from '../components/AutoPopulateModal';
import { useArchetype } from '../context/ArchetypeContext';
import { usePlan } from '../context/PlanContext';
import { useRecipes } from '../hooks/useRecipes';
import { RecipeSelector } from '../components/RecipeSelector';
import { Sparkles, Dices, Check, Lock, Unlock } from 'lucide-react';

export function PlanView() {
    const { activeArchetype } = useArchetype();
    const { isPlanConfirmed, toggleConfirmation, startPlan, weeklyPlan, addToPlan } = usePlan();
    const { recipes } = useRecipes();

    // UI State
    const [viewMode, setViewMode] = useState('DEFAULT'); // DEFAULT, JACKPOT_SELECT
    const [showAutoModal, setShowAutoModal] = useState(false);
    const [jackpotTarget, setJackpotTarget] = useState(null); // { date, slot }
    const [manualSelect, setManualSelect] = useState(null); // { date, slot }

    const hasItemsInPlan = Object.keys(weeklyPlan).length > 0;

    const handleSlotClick = (dateStr, slot) => {
        if (viewMode === 'JACKPOT_SELECT') {
            setJackpotTarget({ date: dateStr, slot, dayName: new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' }) });
            setViewMode('DEFAULT');
        } else {
            // Default Manual Mode
            setManualSelect({ date: dateStr, slot });
        }
    };

    return (
        <div className="flex flex-col h-full relative">
            {/* Minimal Header */}
            <div className="mb-4 pl-1 animate-fade-in-down">
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900 leading-none mb-1">
                    {viewMode === 'JACKPOT_SELECT' ? 'Select Slot' : 'Planning HQ'}
                </h2>
                <p className="text-sm text-zinc-500 font-bold tracking-tight">
                    {viewMode === 'JACKPOT_SELECT' ? 'Tap a meal card to spin for a new recipe' : 'Curate your culinary week'}
                </p>
            </div>

            {/* Calendar Area - Full Width/Height with Vertical Rhythm */}
            <div className="flex-1 overflow-hidden relative -mx-4 px-4 pb-24">
                <div className="h-full">
                    <WeeklyCalendar
                        onSlotClick={handleSlotClick}
                        highlightMode={viewMode === 'JACKPOT_SELECT'}
                        className="h-full"
                    />
                </div>
            </div>

            {/* Floating Editorial Toolbar */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1.5 bg-zinc-900/95 backdrop-blur-2xl rounded-full shadow-2xl border border-white/10 z-30 animate-slide-up hover:scale-105 transition-transform duration-300">
                {isPlanConfirmed ? (
                    <button
                        onClick={toggleConfirmation}
                        className="flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-sm border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                    >
                        <Lock size={16} strokeWidth={2.5} />
                        <span>Plan Locked</span>
                    </button>
                ) : (
                    <>
                        {/* Auto-Fill */}
                        <button
                            onClick={() => setShowAutoModal(true)}
                            className="p-3.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-all active:scale-90"
                            title="Auto-Fill"
                        >
                            <Sparkles size={20} strokeWidth={2} />
                        </button>

                        <div className="w-px h-6 bg-white/10" />

                        {/* Jackpot Toggle */}
                        <button
                            onClick={() => setViewMode(viewMode === 'JACKPOT_SELECT' ? 'DEFAULT' : 'JACKPOT_SELECT')}
                            className={`p-3.5 rounded-full transition-all active:scale-90 ${viewMode === 'JACKPOT_SELECT' ? 'bg-amber-500 text-zinc-900 shadow-lg shadow-amber-500/20' : 'hover:bg-white/10 text-zinc-400 hover:text-white'}`}
                            title="Jackpot Mode"
                        >
                            <Dices size={20} strokeWidth={2} />
                        </button>

                        <div className="w-px h-6 bg-white/10" />

                        {/* Confirm/Lock */}
                        <button
                            disabled={!hasItemsInPlan}
                            onClick={toggleConfirmation}
                            className={`p-3.5 rounded-full transition-all active:scale-90 flex items-center gap-2 ${hasItemsInPlan ? 'hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-400' : 'opacity-30 cursor-not-allowed text-zinc-600'}`}
                            title="Confirm Plan"
                        >
                            <Check size={20} strokeWidth={2} />
                        </button>
                    </>
                )}
            </div>

            {/* Modals */}
            {showAutoModal && (
                <AutoPopulateModal onClose={() => setShowAutoModal(false)} />
            )}

            <JackpotModal
                isOpen={!!jackpotTarget}
                onClose={() => setJackpotTarget(null)}
                targetSlot={jackpotTarget}
            />

            {manualSelect && (
                <RecipeSelector
                    slot={manualSelect.slot}
                    onSelect={(recipe) => {
                        addToPlan(manualSelect.date, manualSelect.slot, recipe);
                        setManualSelect(null);
                    }}
                    onClose={() => setManualSelect(null)}
                />
            )}
        </div>
    );
}

