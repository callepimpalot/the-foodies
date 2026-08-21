import React, { useState } from 'react';
import { Plus, X, RotateCcw, StickyNote, Utensils } from 'lucide-react';

// A single day's row on the Planning HQ ticket list. Was previously a horizontally-scrolling
// card — rebuilt as a vertical list row (matching WeekPlanChat's day list) because the card row's
// height depended on a flex/h-full chain that collapsed unpredictably on mobile viewports, and
// swiping through 7 cards one at a time hid most of the week at once.
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
    const isEmpty = !resolved;

    let Icon = Plus;
    let title = 'Add meal';
    let badge = null;
    let image = null;

    if (resolved?.type === 'note') {
        Icon = StickyNote;
        title = resolved.note || 'Note';
    } else if (resolved?.type === 'leftover') {
        Icon = RotateCcw;
        title = resolved.recipe?.title ?? 'Unknown';
        badge = 'Leftovers';
        image = resolved.recipe?.image_url;
    } else if (resolved?.type === 'recipe') {
        Icon = Utensils;
        title = resolved.recipe?.title ?? 'Unknown';
        image = resolved.recipe?.image || resolved.recipe?.image_url;
    }

    return (
        <div
            onClick={handleTap}
            className={`list-row relative ${isPast ? 'opacity-50 pointer-events-none' : ''} ${isClickable ? 'cursor-pointer' : ''}`}
        >
            <div className="shrink-0 w-[30px] flex flex-col items-center">
                <span className="t-eyebrow" style={{ color: 'var(--ink-dim)', fontSize: '9px' }}>{dayName}</span>
                <span className="t-mono leading-none" style={{ fontSize: '17px', fontWeight: 700, color: isToday ? 'var(--stamp)' : 'var(--ink)' }}>
                    {dayNum}
                </span>
            </div>

            {image ? (
                <div
                    className="shrink-0 w-[34px] h-[34px] rounded-sm overflow-hidden border"
                    style={{ borderColor: 'var(--ticket-shadow)', transform: 'rotate(-1.5deg)' }}
                >
                    <img src={image} alt="" className="w-full h-full object-cover" />
                </div>
            ) : (
                <div
                    className={`shrink-0 w-[34px] h-[34px] rounded-sm flex items-center justify-center ${isEmpty ? 'border border-dashed' : ''}`}
                    style={{ borderColor: 'var(--ticket-shadow)', background: isEmpty ? 'transparent' : 'var(--ticket-2)' }}
                >
                    <Icon size={14} strokeWidth={1.5} style={{ color: 'var(--ink-dim)' }} />
                </div>
            )}

            <div className="flex-1 min-w-0 flex items-center gap-2">
                <span
                    className={`t-body truncate ${isEmpty ? 'italic' : ''}`}
                    style={{ color: isEmpty ? 'var(--ink-dim)' : 'var(--ink)' }}
                >
                    {title}
                </span>
                {badge && <span className="badge-grease shrink-0">{badge}</span>}
            </div>

            {!isEmpty && !isPlanConfirmed && (
                <button
                    onClick={handleRemoveClick}
                    className="shrink-0 min-w-[28px] min-h-[28px] flex items-center justify-center"
                    style={{ color: confirmRemove ? 'var(--destructive)' : 'var(--ink-dim)' }}
                >
                    <X size={15} strokeWidth={1.5} />
                </button>
            )}
        </div>
    );
}
