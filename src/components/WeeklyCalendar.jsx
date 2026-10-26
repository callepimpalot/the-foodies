import React from 'react';
import { usePlan } from '../context/PlanContext';
import { DayCard } from './DayCard';
import { toDateStr, visibleWeekDays } from '../lib/weekWindow';

export function WeeklyCalendar({ onDayClick, onViewRecipe }) {
    const { isPlanConfirmed, clearDay, resolveDay } = usePlan();

    // The seven days this tab shows. Defined in lib/weekWindow.js rather than here,
    // because the Shop tab has to agree with this list exactly — when each view built
    // its own window they drifted, and the shopping list filled up with meals from
    // weeks the plan no longer displayed.
    const days = visibleWeekDays();

    const todayStr = toDateStr(new Date());
    const hasAnyPlanned = days.some((day) => resolveDay(day.dateStr));

    // A plain vertical list flowing inside App.jsx's own scrollable <main> — no nested scroll
    // container, no h-full/flex-1 height chain to collapse on mobile. Bottom padding clears the
    // fixed "Lock This Week" button and the bottom nav.
    return (
        <div className="w-full pb-[160px]">
            {!hasAnyPlanned && (
                <p className="t-body italic mb-3" style={{ color: 'var(--chalk-dim)', fontSize: '13px' }}>
                    Nothing planned yet — tap a day to add a meal, mark leftovers, or leave a note.
                </p>
            )}
            <div className="list-ticket">
                {days.map((day) => {
                    const isToday = day.dateStr === todayStr;
                    const isPast = day.dateStr < todayStr;

                    return (
                        <DayCard
                            key={day.dateStr}
                            dayName={day.dayName}
                            dayNum={day.dayNum}
                            isToday={isToday}
                            isPast={isPast}
                            resolved={resolveDay(day.dateStr)}
                            onDayClick={() => onDayClick(day.dateStr)}
                            onRemove={() => clearDay(day.dateStr)}
                            onViewRecipe={onViewRecipe}
                            isPlanConfirmed={isPlanConfirmed}
                        />
                    );
                })}
            </div>
        </div>
    );
}
