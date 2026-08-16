import React from 'react';
import { usePlan } from '../context/PlanContext';
import { DayCard } from './DayCard';

export function WeeklyCalendar({ onDayClick, onViewRecipe }) {
    const { isPlanConfirmed, clearDay, resolveDay } = usePlan();

    // Generate next 7 days
    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return {
            dateStr: d.toISOString().split('T')[0],
            dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
            dayNum: d.getDate(),
        };
    });

    const todayStr = new Date().toISOString().split('T')[0];

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex-1 w-full overflow-x-auto scrollbar-hide scroll-smooth pl-[24px] pr-[24px] pb-6 pt-2">
                <div className="flex gap-[12px] h-full min-w-max pb-[88px] snap-x snap-mandatory">
                    {days.map((day) => {
                        const isToday = day.dateStr === todayStr;
                        const isPast = day.dateStr < todayStr;

                        return (
                            <DayCard
                                key={day.dateStr}
                                dateStr={day.dateStr}
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
        </div>
    );
}
