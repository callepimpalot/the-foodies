import React, { useState } from 'react';
import { Plus, X, RotateCcw, StickyNote } from 'lucide-react';

export function DayCard({ dayName, dayNum, isToday, isPast, resolved, onDayClick, onRemove, onViewRecipe, isPlanConfirmed }) {
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

    // A day with an actual recipe (planned or leftover) is always tappable to view it, locked or
    // not — locking the week only stops further planning changes, not looking at what's cooking.
    const handleTap = () => {
        if (resolved?.recipe) {
            onViewRecipe?.(resolved.recipe);
            return;
        }
        if (isPlanConfirmed || resolved) return;
        onDayClick();
    };

    const isClickable = Boolean(resolved?.recipe) || (!resolved && !isPlanConfirmed);

    return (
        <div
            onClick={handleTap}
            className={`min-w-[160px] w-[160px] bg-board2 rounded-lg p-[16px_12px] flex flex-col gap-[12px] snap-center border transition-colors ${isPast ? 'opacity-50 pointer-events-none' : ''} ${isToday ? 'border-stamp' : 'border-line'} ${isClickable ? 'cursor-pointer' : ''}`}
        >
            <div className="flex flex-col items-start min-h-[48px]">
                <span className="t-eyebrow" style={{ color: 'var(--chalk-dim)' }}>
                    {dayName}
                </span>
                <span className="t-mono leading-none" style={{ fontSize: '30px', fontWeight: 700, color: isToday ? 'var(--stamp)' : 'var(--chalk)' }}>
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
            <div className="w-full min-h-[100px] rounded-md border-[1.5px] border-dashed border-line flex flex-col items-center justify-center gap-1">
                <Plus size={16} strokeWidth={1.5} style={{ color: 'var(--chalk-dim)' }} />
                <span className="t-label" style={{ color: 'var(--chalk-dim)', textTransform: 'uppercase', fontSize: '11px' }}>Add meal</span>
            </div>
        );
    }

    if (resolved.type === 'note') {
        return (
            <div className="relative w-full min-h-[100px] rounded-md bg-board border border-line flex flex-col items-center justify-center gap-1 p-[10px] text-center">
                <StickyNote size={14} strokeWidth={1.5} style={{ color: 'var(--chalk-dim)' }} />
                <span className="leading-tight" style={{ fontFamily: 'var(--f-head)', fontStyle: 'italic', fontSize: '13px', color: 'var(--chalk)' }}>
                    {resolved.note}
                </span>
                {!isPlanConfirmed && (
                    <button onClick={onRemoveClick} className="absolute top-[4px] right-[4px] min-w-[24px] min-h-[24px] flex items-center justify-center" style={{ color: confirmRemove ? 'var(--destructive)' : 'var(--chalk-dim)' }}>
                        <X size={13} strokeWidth={1.5} />
                    </button>
                )}
            </div>
        );
    }

    if (resolved.type === 'leftover') {
        const recipe = resolved.recipe;
        return (
            <div className="relative w-full min-h-[100px] rounded-md overflow-hidden">
                {recipe?.image_url ? (
                    <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover absolute inset-0 opacity-50" />
                ) : (
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom right, var(--board-2), var(--board))' }} />
                )}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(20,33,27,0.92), rgba(20,33,27,0.7), rgba(20,33,27,0.4))' }} />
                <div className="relative flex flex-col items-center justify-center gap-1 h-full py-[10px] px-[8px] text-center">
                    <RotateCcw size={13} strokeWidth={1.5} style={{ color: 'var(--grease)' }} />
                    <span className="t-label" style={{ color: 'var(--grease)', textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.04em' }}>Leftovers</span>
                    <span className="leading-tight" style={{ fontFamily: 'var(--f-head)', fontWeight: 700, fontSize: '11px', color: 'var(--chalk)' }}>{recipe?.title ?? 'Unknown'}</span>
                </div>
                {!isPlanConfirmed && (
                    <button onClick={onRemoveClick} className="absolute top-[4px] right-[4px] min-w-[24px] min-h-[24px] flex items-center justify-center" style={{ color: confirmRemove ? 'var(--destructive)' : 'var(--chalk)' }}>
                        <X size={13} strokeWidth={1.5} />
                    </button>
                )}
            </div>
        );
    }

    // type === 'recipe'
    const recipe = resolved.recipe;
    return (
        <div className="relative w-full min-h-[100px] rounded-md overflow-hidden">
            <img src={recipe.image || recipe.image_url} alt={recipe.title} className="w-full h-full object-cover absolute inset-0" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(20,33,27,0.90), rgba(20,33,27,0.5), rgba(20,33,27,0.15))' }} />
            <div className="absolute bottom-[8px] left-[8px] right-[24px] leading-tight" style={{ fontFamily: 'var(--f-head)', fontWeight: 700, fontSize: '12px', color: 'var(--chalk)' }}>
                {recipe.title}
            </div>
            {!isPlanConfirmed && (
                <button onClick={onRemoveClick} className="absolute top-[4px] right-[4px] min-w-[28px] min-h-[28px] flex items-center justify-center" style={{ color: confirmRemove ? 'var(--destructive)' : 'var(--chalk-dim)' }}>
                    <X size={14} strokeWidth={1.5} />
                </button>
            )}
        </div>
    );
}
