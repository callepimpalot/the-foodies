import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

export function MealSlot({ slotContext, recipe, onSelect, onRemove, isPlanConfirmed, isSelected }) {
    const slotName = slotContext.toUpperCase();
    const isDinner = slotName === 'DINNER';

    const [isExpanded, setIsExpanded] = useState(isDinner || !!recipe);
    const [confirmRemove, setConfirmRemove] = useState(false);

    const handleTap = (e) => {
        e.stopPropagation();
        if (isPlanConfirmed) return;

        if (!recipe) {
            if (!isExpanded) {
                setIsExpanded(true);
            } else {
                onSelect();
            }
        }
    };

    const handleRemoveClick = (e) => {
        e.stopPropagation();
        if (isPlanConfirmed) return;

        if (!confirmRemove) {
            setConfirmRemove(true);
            setTimeout(() => setConfirmRemove(false), 3000); // reset after 3s
        } else {
            onRemove();
            if (!isDinner) {
                setIsExpanded(false);
            }
            setConfirmRemove(false);
        }
    };

    if (recipe) {
        return (
            <div className="relative w-full h-[80px] rounded-[10px] overflow-hidden">
                <img src={recipe.image || recipe.image_url} alt={recipe.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[rgba(9,9,11,0.90)] via-[rgba(9,9,11,0.6)] to-[rgba(9,9,11,0.20)]" />
                <div className="absolute bottom-[6px] left-[8px] right-[24px] font-display font-bold text-[11px] text-[#f5f0e8] leading-tight">
                    {recipe.title}
                </div>
                {!isPlanConfirmed && (
                    <button
                        onClick={handleRemoveClick}
                        className={`absolute top-[4px] right-[4px] min-w-[28px] min-h-[28px] flex items-center justify-center transition-colors bg-transparent rounded-full ${confirmRemove ? 'text-[#ef4444]' : 'text-[#71717a]'}`}
                    >
                        <X size={14} strokeWidth={1.5} />
                    </button>
                )}
            </div>
        );
    }

    if (!isExpanded) {
        return (
            <div
                onClick={handleTap}
                className="w-full h-[32px] rounded-[10px] border border-dashed border-[#27272a] flex items-center justify-center cursor-pointer opacity-70 transition-opacity hover:opacity-100"
            >
                <div className="flex items-center gap-1">
                    <Plus size={12} strokeWidth={1.5} className={slotName === 'BREAKFAST' ? 'text-[#27272a]' : 'text-[#3f3f46]'} />
                    <span className={`font-sans font-normal text-[10px] uppercase ${slotName === 'BREAKFAST' ? 'text-[#27272a]' : 'text-[#3f3f46]'}`}>
                        {slotName}
                    </span>
                </div>
            </div>
        );
    }

    // Empty expanded state
    return (
        <div
            onClick={handleTap}
            className={`w-full min-h-[64px] rounded-[10px] border-[1.5px] ${isSelected ? 'border-solid border-[rgba(201,169,110,0.4)] bg-[rgba(201,169,110,0.08)]' : 'border-dashed border-[#3f3f46] bg-transparent'} flex flex-col items-center justify-center cursor-pointer transition-colors p-[12px_8px]`}
        >
            <div className={`flex items-center gap-1 ${isSelected ? 'text-[#c9a96e]' : 'text-[#52525b]'}`}>
                <Plus size={14} strokeWidth={1.5} />
                <span className="font-sans font-medium text-[11px] uppercase">
                    {slotName}
                </span>
            </div>
        </div>
    );
}

export function DayCard({ dateStr, dayName, dayNum, isToday, isPast, slots, onSlotClick, onSlotRemove, isPlanConfirmed, selectedSlot }) {
    return (
        <div
            className={`min-w-[160px] w-[160px] bg-[#18181b] rounded-[18px] p-[16px_12px] flex flex-col gap-[12px] snap-center ${isPast ? 'opacity-50 pointer-events-none' : ''} ${isToday ? 'border-[1px] border-[#71717a]' : 'border-[1px] border-[#3f3f46]'}`}
        >
            <div className="flex flex-col items-start min-h-[48px]">
                <span className="font-sans font-semibold text-[10px] uppercase text-[#71717a] tracking-[0.12em]">
                    {dayName}
                </span>
                <span className={`font-display font-black text-[32px] leading-none ${isToday ? 'text-[#c9a96e]' : 'text-[#fafafa]'}`}>
                    {dayNum}
                </span>
            </div>

            <div className="flex flex-col gap-[12px]">
                <MealSlot
                    slotContext="dinner"
                    recipe={slots.dinner?.recipe}
                    onSelect={() => onSlotClick(dateStr, 'dinner')}
                    onRemove={() => onSlotRemove(dateStr, 'dinner')}
                    isPlanConfirmed={isPlanConfirmed}
                    isSelected={selectedSlot?.date === dateStr && selectedSlot?.slot === 'dinner'}
                />
                <MealSlot
                    slotContext="lunch"
                    recipe={slots.lunch?.recipe}
                    onSelect={() => onSlotClick(dateStr, 'lunch')}
                    onRemove={() => onSlotRemove(dateStr, 'lunch')}
                    isPlanConfirmed={isPlanConfirmed}
                    isSelected={selectedSlot?.date === dateStr && selectedSlot?.slot === 'lunch'}
                />
                <MealSlot
                    slotContext="breakfast"
                    recipe={slots.breakfast?.recipe}
                    onSelect={() => onSlotClick(dateStr, 'breakfast')}
                    onRemove={() => onSlotRemove(dateStr, 'breakfast')}
                    isPlanConfirmed={isPlanConfirmed}
                    isSelected={selectedSlot?.date === dateStr && selectedSlot?.slot === 'breakfast'}
                />
            </div>
        </div>
    );
}
