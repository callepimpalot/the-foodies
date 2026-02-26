import React, { useState } from 'react';
import { usePlan } from '../context/PlanContext';
import { RecipeSelector } from './RecipeSelector';
import { DayCard } from './DayCard';

export function WeeklyCalendar({ onSlotClick, highlightMode = false }) {
    const { weeklyPlan, isPlanConfirmed, addToPlan, removeFromPlan } = usePlan();
    const [selecting, setSelecting] = useState(null); // { date, slot } - fallback if no onSlotClick

    // Generate next 7 days
    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return {
            dateStr: d.toISOString().split('T')[0],
            dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
            dayNum: d.getDate()
        };
    });

    const todayStr = new Date().toISOString().split('T')[0];

    const handleSlotInteraction = (date, slot) => {
        if (isPlanConfirmed) return;

        if (onSlotClick) {
            onSlotClick(date, slot);
        } else {
            setSelecting({ date, slot });
        }
    };

    const handleSlotRemove = (date, slot) => {
        if (isPlanConfirmed) return;
        removeFromPlan(date, slot);
    };

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex-1 w-full overflow-x-auto no-scrollbar scroll-smooth pl-[24px] pr-[24px] pb-6 pt-2">
                <div className="flex gap-[12px] h-full min-w-max pb-[88px] snap-x snap-mandatory">
                    {days.map((day, index) => {
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
                                slots={weeklyPlan[day.dateStr] || {}}
                                onSlotClick={(date, slot) => handleSlotInteraction(date, slot)}
                                onSlotRemove={(date, slot) => handleSlotRemove(date, slot)}
                                isPlanConfirmed={isPlanConfirmed}
                                selectedSlot={selecting}
                            />
                        );
                    })}
                </div>
            </div>

            {
                selecting && (
                    <RecipeSelector
                        slot={selecting.slot}
                        onSelect={(recipe) => {
                            addToPlan(selecting.date, selecting.slot, recipe);
                            setSelecting(null);
                        }}
                        onClose={() => setSelecting(null)}
                    />
                )
            }
        </div>
    );
}

