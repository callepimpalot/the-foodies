import React, { useState } from 'react';
import { Utensils, RotateCcw, StickyNote, X } from 'lucide-react';
import { usePlan } from '../context/PlanContext';
import { RecipeSelector } from './RecipeSelector';

// Bottom sheet shown when tapping an empty day in Planning HQ.
// Lets the user choose a recipe, mark the day as leftovers from another day, or leave a free-text note.
export function DayActionSheet({ date, dayLabel, onClose }) {
    const { weeklyPlan, setDayRecipe, setDayLeftover, setDayNote } = usePlan();
    const [step, setStep] = useState('choose'); // choose | recipe | leftover | note
    const [noteText, setNoteText] = useState('');

    const daysWithRecipes = Object.entries(weeklyPlan)
        .filter(([d, entry]) => d !== date && entry.recipe)
        .map(([d, entry]) => ({
            dateStr: d,
            label: new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
            title: entry.recipe.title,
        }));

    if (step === 'recipe') {
        return (
            <RecipeSelector
                slot={dayLabel}
                onSelect={(recipe) => { setDayRecipe(date, recipe); onClose(); }}
                onClose={onClose}
            />
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full max-w-[500px] bg-[#18181b] border-t border-[#3f3f46] rounded-t-[24px] p-[24px] pb-[40px] flex flex-col gap-[16px]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-[18px] text-[#fafafa]">{dayLabel}</h3>
                    <button onClick={onClose} className="text-[#71717a]"><X size={20} strokeWidth={1.5} /></button>
                </div>

                {step === 'choose' && (
                    <div className="flex flex-col gap-[10px]">
                        <SheetOption icon={Utensils} label="Choose a recipe" onClick={() => setStep('recipe')} />
                        <SheetOption
                            icon={RotateCcw}
                            label="Leftovers from another day"
                            onClick={() => setStep('leftover')}
                            disabled={daysWithRecipes.length === 0}
                        />
                        <SheetOption icon={StickyNote} label="Just a note (e.g. eating out)" onClick={() => setStep('note')} />
                    </div>
                )}

                {step === 'leftover' && (
                    <div className="flex flex-col gap-[8px]">
                        {daysWithRecipes.map((d) => (
                            <button
                                key={d.dateStr}
                                onClick={() => { setDayLeftover(date, d.dateStr); onClose(); }}
                                className="text-left p-[12px] rounded-[10px] bg-[#09090b] border border-[#27272a] hover:border-[#71717a] transition-colors"
                            >
                                <div className="font-sans font-medium text-[13px] text-[#e4e4e7]">{d.label}</div>
                                <div className="font-sans text-[12px] text-[#71717a]">{d.title}</div>
                            </button>
                        ))}
                    </div>
                )}

                {step === 'note' && (
                    <div className="flex flex-col gap-[12px]">
                        <input
                            autoFocus
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="e.g. Mum's house, takeaway..."
                            className="w-full bg-[#09090b] border border-[#27272a] rounded-[10px] p-[12px] font-sans text-[14px] text-[#e4e4e7] placeholder:text-[#52525b] focus:outline-none focus:border-[#71717a]"
                        />
                        <button
                            disabled={!noteText.trim()}
                            onClick={() => { setDayNote(date, noteText.trim()); onClose(); }}
                            className="w-full py-[14px] rounded-full bg-[#fafafa] text-[#09090b] font-display font-bold text-[15px] disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            Save Note
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// eslint-disable-next-line no-unused-vars -- Icon is used as a JSX tag below; no react plugin in this project's eslint config to detect that.
function SheetOption({ icon: Icon, label, onClick, disabled }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="flex items-center gap-[12px] p-[14px] rounded-[12px] bg-[#09090b] border border-[#27272a] hover:border-[#71717a] transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-left"
        >
            <Icon size={18} strokeWidth={1.5} className="text-[#c9a96e]" />
            <span className="font-sans font-medium text-[14px] text-[#e4e4e7]">{label}</span>
        </button>
    );
}
