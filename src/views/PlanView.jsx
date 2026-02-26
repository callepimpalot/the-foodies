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

    // Tap-to-place state for Shortlist
    const [selectedShortlistRecipe, setSelectedShortlistRecipe] = useState(null);

    const hasItemsInPlan = Object.keys(weeklyPlan).some(date => Object.keys(weeklyPlan[date]).length > 0);

    // Identify recipes that have been placed in the plan
    const placedRecipeIds = new Set();
    Object.values(weeklyPlan).forEach(slots => {
        Object.values(slots).forEach(slotData => {
            if (slotData.recipe?.id) placedRecipeIds.add(slotData.recipe.id);
        });
    });

    // We assume `is_shortlisted` exists on recipe, else fallback to empty
    const shortlistedRecipes = recipes?.filter(r => r.is_shortlisted) || [];

    const handleSlotClick = (dateStr, slot) => {
        if (selectedShortlistRecipe) {
            addToPlan(dateStr, slot, selectedShortlistRecipe);
            setSelectedShortlistRecipe(null);
            return;
        }

        if (viewMode === 'JACKPOT_SELECT') {
            setJackpotTarget({ date: dateStr, slot, dayName: new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' }) });
            setViewMode('DEFAULT');
        } else {
            // Default Manual Mode
            setManualSelect({ date: dateStr, slot });
        }
    };

    return (
        <div className="flex flex-col h-full relative bg-[#09090b] text-[#e4e4e7]">
            {/* Minimal Header */}
            <div className="px-[24px] pt-[32px] pb-[20px] flex flex-col items-start w-full gap-1">
                <span className="font-sans font-semibold text-[10px] uppercase text-[#c9a96e] tracking-[0.12em]">
                    {viewMode === 'JACKPOT_SELECT' ? 'JACKPOT MODE' : 'PLANNING HQ'}
                </span>
                <h2 className="font-display font-black text-[clamp(28px,7vw,36px)] text-[#fafafa] leading-none">
                    {viewMode === 'JACKPOT_SELECT' ? 'Select Slot' : 'Curate your week'}
                </h2>
            </div>

            {/* Shortlist Row */}
            {shortlistedRecipes.length > 0 && (
                <div className="w-full pl-[24px] mb-4 flex flex-col gap-2">
                    <span className="font-sans font-semibold text-[10px] uppercase text-[#c9a96e] tracking-[0.12em]">
                        YOUR SHORTLIST
                    </span>
                    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 pr-[24px]">
                        {shortlistedRecipes.map((recipe) => {
                            const isPlaced = placedRecipeIds.has(recipe.id);
                            const isSelected = selectedShortlistRecipe?.id === recipe.id;

                            return (
                                <div
                                    key={recipe.id}
                                    onClick={() => {
                                        if (isPlaced) return;
                                        setSelectedShortlistRecipe(isSelected ? null : recipe);
                                    }}
                                    className={`relative min-w-[100px] w-[100px] h-[120px] rounded-[14px] overflow-hidden transition-transform duration-300
                                        ${isPlaced ? 'opacity-40 pointer-events-none' : 'cursor-pointer'}
                                        ${isSelected ? 'border-[1.5px] border-[#c9a96e] scale-[1.03]' : 'border border-[#3f3f46]'}
                                    `}
                                >
                                    <img src={recipe.image || recipe.image_url} alt={recipe.title} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[rgba(9,9,11,0.90)] to-[rgba(9,9,11,0.20)]" />
                                    <div className="absolute bottom-[8px] left-[8px] right-[8px] font-display font-bold text-[11px] text-[#f5f0e8] leading-tight">
                                        {recipe.title}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Calendar Area */}
            <div className="flex-1 w-full relative">
                <WeeklyCalendar
                    onSlotClick={handleSlotClick}
                    highlightMode={viewMode === 'JACKPOT_SELECT'}
                />

                {/* Empty State Overlay if no slots and no shortlist (or if just no slots? Prompt says "no recipes shortlisted, no slots filled") */}
                {!hasItemsInPlan && shortlistedRecipes.length === 0 && (
                    <div className="absolute top-[30%] left-0 w-full flex flex-col items-center justify-center pointer-events-none px-6">
                        <p className="font-display italic text-[20px] text-[#71717a] text-center font-normal">
                            Nothing planned yet.
                        </p>
                        <p className="font-sans font-light text-[14px] text-[#52525b] max-w-[240px] text-center mt-[8px]">
                            Swipe recipes in Discover to<br />build your shortlist.
                        </p>
                        <button className="font-sans font-medium text-[13px] text-[#a1a1aa] mt-[16px] pointer-events-auto hover:text-[#e4e4e7] transition-colors">
                            Go to Discover →
                        </button>
                    </div>
                )}
            </div>

            {/* Lock Week Button */}
            {hasItemsInPlan && !isPlanConfirmed && (
                <div className="fixed bottom-[88px] left-[24px] right-[24px] z-30">
                    <button
                        onClick={toggleConfirmation}
                        className="w-full py-[16px] px-[24px] rounded-full bg-[#fafafa] text-[#09090b] font-display font-bold text-[16px] text-center shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-transform active:scale-[0.98]"
                    >
                        Lock This Week
                    </button>
                </div>
            )}

            {hasItemsInPlan && isPlanConfirmed && (
                <div className="fixed bottom-[88px] left-[24px] right-[24px] z-30">
                    <button
                        onClick={toggleConfirmation}
                        className="w-full py-[16px] px-[24px] rounded-full bg-[#18181b] border border-[#3f3f46] text-[#a1a1aa] font-display font-bold text-[16px] text-center shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-transform active:scale-[0.98]"
                    >
                        Plan Locked
                    </button>
                </div>
            )}

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

