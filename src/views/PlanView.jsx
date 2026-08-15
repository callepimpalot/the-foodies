import React, { useState } from 'react';
import { WeeklyCalendar } from '../components/WeeklyCalendar';
import { usePlan } from '../context/PlanContext';
import { DayActionSheet } from '../components/DayActionSheet';
import { WeekPlanChat } from '../components/WeekPlanChat';

export function PlanView() {
    const { isPlanConfirmed, toggleConfirmation, weeklyPlan } = usePlan();

    const [activeDay, setActiveDay] = useState(null); // dateStr
    const [mode, setMode] = useState('manual'); // 'manual' | 'chat'

    const hasItemsInPlan = Object.keys(weeklyPlan).length > 0;

    return (
        <div className="flex flex-col h-full relative bg-[#09090b] text-[#e4e4e7]">
            {/* Minimal Header */}
            <div className="px-[24px] pt-[32px] pb-[20px] flex flex-col items-start w-full gap-[14px]">
                <span className="font-sans font-semibold text-[10px] uppercase text-[#c9a96e] tracking-[0.12em]">
                    PLANNING HQ
                </span>
                <h2 className="font-display font-black text-[clamp(28px,7vw,36px)] text-[#fafafa] leading-none">
                    Curate your week
                </h2>

                <div className="flex gap-[6px] p-[3px] rounded-full bg-[#18181b] border border-[#27272a]">
                    <button
                        onClick={() => setMode('manual')}
                        className={`px-[14px] py-[7px] rounded-full font-sans font-medium text-[12px] transition-colors ${mode === 'manual' ? 'bg-[#fafafa] text-[#09090b]' : 'text-[#71717a]'}`}
                    >
                        Manual
                    </button>
                    <button
                        onClick={() => setMode('chat')}
                        className={`px-[14px] py-[7px] rounded-full font-sans font-medium text-[12px] transition-colors ${mode === 'chat' ? 'bg-[#fafafa] text-[#09090b]' : 'text-[#71717a]'}`}
                    >
                        Chat Plan
                    </button>
                </div>
            </div>

            {mode === 'chat' ? (
                <WeekPlanChat onApplied={() => setMode('manual')} />
            ) : (
                <div className="flex-1 w-full relative">
                    <WeeklyCalendar onDayClick={(dateStr) => setActiveDay(dateStr)} />

                    {!hasItemsInPlan && (
                        <div className="absolute top-[30%] left-0 w-full flex flex-col items-center justify-center pointer-events-none px-6">
                            <p className="font-display italic text-[20px] text-[#71717a] text-center font-normal">
                                Nothing planned yet.
                            </p>
                            <p className="font-sans font-light text-[14px] text-[#52525b] max-w-[240px] text-center mt-[8px]">
                                Tap a day to add a meal, mark leftovers, or leave a note.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Lock Week Button */}
            {mode === 'manual' && hasItemsInPlan && !isPlanConfirmed && (
                <div className="fixed bottom-[88px] left-[24px] right-[24px] z-30">
                    <button
                        onClick={toggleConfirmation}
                        className="w-full py-[16px] px-[24px] rounded-full bg-[#fafafa] text-[#09090b] font-display font-bold text-[16px] text-center shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-transform active:scale-[0.98]"
                    >
                        Lock This Week
                    </button>
                </div>
            )}

            {mode === 'manual' && hasItemsInPlan && isPlanConfirmed && (
                <div className="fixed bottom-[88px] left-[24px] right-[24px] z-30">
                    <button
                        onClick={toggleConfirmation}
                        className="w-full py-[16px] px-[24px] rounded-full bg-[#18181b] border border-[#3f3f46] text-[#a1a1aa] font-display font-bold text-[16px] text-center shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-transform active:scale-[0.98]"
                    >
                        Plan Locked
                    </button>
                </div>
            )}

            {activeDay && (
                <DayActionSheet
                    date={activeDay}
                    dayLabel={new Date(activeDay).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    onClose={() => setActiveDay(null)}
                />
            )}
        </div>
    );
}
