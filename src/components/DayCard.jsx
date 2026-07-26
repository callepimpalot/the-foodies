import React, { useState } from 'react';
import { Plus, X, RotateCcw, StickyNote } from 'lucide-react';

export function DayCard({ dayName, dayNum, isToday, isPast, resolved, onDayClick, onRemove, isPlanConfirmed }) {
    const [confirmRemove, setConfirmRemove] = useState(false);

    const handleRemoveClick = (e) => {
        e.stopPropagation();
        if (isPlanConfirmed) return;
        if (!confirmRemove) {
            setConfirmRemove(true);
            setTimeout(() => setConfirmRemove(false), 3000);
        } else {
            onRemove();
            setConfirmRemove(false);
        }
    };

    const handleTap = () => {
        if (isPlanConfirmed || resolved) return;
        onDayClick();
    };

    return (
        <div
            onClick={handleTap}
            className={`min-w-[160px] w-[160px] bg-[#18181b] rounded-[18px] p-[16px_12px] flex flex-col gap-[12px] snap-center ${isPast ? 'opacity-50 pointer-events-none' : ''} ${isToday ? 'border-[1px] border-[#71717a]' : 'border-[1px] border-[#3f3f46]'} ${!resolved && !isPlanConfirmed ? 'cursor-pointer' : ''}`}
        >
            <div className="flex flex-col items-start min-h-[48px]">
                <span className="font-sans font-semibold text-[10px] uppercase text-[#71717a] tracking-[0.12em]">
                    {dayName}
                </span>
                <span className={`font-display font-black text-[32px] leading-none ${isToday ? 'text-[#c9a96e]' : 'text-[#fafafa]'}`}>
                    {dayNum}
                </span>
            </div>

            <DaySlot resolved={resolved} isPlanConfirmed={isPlanConfirmed} confirmRemove={confirmRemove} onRemoveClick={handleRemoveClick} />
        </div>
    );
}

function DaySlot({ resolved, isPlanConfirmed, confirmRemove, onRemoveClick }) {
    if (!resolved) {
        return (
            <div className="w-full min-h-[100px] rounded-[10px] border-[1.5px] border-dashed border-[#3f3f46] flex flex-col items-center justify-center gap-1">
                <Plus size={16} strokeWidth={1.5} className="text-[#52525b]" />
                <span className="font-sans font-medium text-[11px] uppercase text-[#52525b]">Add meal</span>
            </div>
        );
    }

    if (resolved.type === 'note') {
        return (
            <div className="relative w-full min-h-[100px] rounded-[10px] bg-[#09090b] border border-[#27272a] flex flex-col items-center justify-center gap-1 p-[10px] text-center">
                <StickyNote size={14} strokeWidth={1.5} className="text-[#71717a]" />
                <span className="font-display italic text-[13px] text-[#a1a1aa] leading-tight">{resolved.note}</span>
                {!isPlanConfirmed && (
                    <button onClick={onRemoveClick} className={`absolute top-[4px] right-[4px] min-w-[24px] min-h-[24px] flex items-center justify-center ${confirmRemove ? 'text-[#ef4444]' : 'text-[#52525b]'}`}>
                        <X size={13} strokeWidth={1.5} />
                    </button>
                )}
            </div>
        );
    }

    if (resolved.type === 'leftover') {
        const recipe = resolved.recipe;
        return (
            <div className="relative w-full min-h-[100px] rounded-[10px] overflow-hidden">
                {recipe?.image_url ? (
                    <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover absolute inset-0 opacity-50" />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#18181b] to-[#09090b]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[rgba(9,9,11,0.92)] via-[rgba(9,9,11,0.7)] to-[rgba(9,9,11,0.4)]" />
                <div className="relative flex flex-col items-center justify-center gap-1 h-full py-[10px] px-[8px] text-center">
                    <RotateCcw size={13} strokeWidth={1.5} className="text-[#c9a96e]" />
                    <span className="font-sans font-semibold text-[9px] uppercase text-[#c9a96e] tracking-wide">Leftovers</span>
                    <span className="font-display font-bold text-[11px] text-[#f5f0e8] leading-tight">{recipe?.title ?? 'Unknown'}</span>
                </div>
                {!isPlanConfirmed && (
                    <button onClick={onRemoveClick} className={`absolute top-[4px] right-[4px] min-w-[24px] min-h-[24px] flex items-center justify-center ${confirmRemove ? 'text-[#ef4444]' : 'text-[#e4e4e7]'}`}>
                        <X size={13} strokeWidth={1.5} />
                    </button>
                )}
            </div>
        );
    }

    // type === 'recipe'
    const recipe = resolved.recipe;
    return (
        <div className="relative w-full min-h-[100px] rounded-[10px] overflow-hidden">
            <img src={recipe.image || recipe.image_url} alt={recipe.title} className="w-full h-full object-cover absolute inset-0" />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(9,9,11,0.90)] via-[rgba(9,9,11,0.5)] to-[rgba(9,9,11,0.15)]" />
            <div className="absolute bottom-[8px] left-[8px] right-[24px] font-display font-bold text-[12px] text-[#f5f0e8] leading-tight">
                {recipe.title}
            </div>
            {!isPlanConfirmed && (
                <button onClick={onRemoveClick} className={`absolute top-[4px] right-[4px] min-w-[28px] min-h-[28px] flex items-center justify-center ${confirmRemove ? 'text-[#ef4444]' : 'text-[#71717a]'}`}>
                    <X size={14} strokeWidth={1.5} />
                </button>
            )}
        </div>
    );
}
