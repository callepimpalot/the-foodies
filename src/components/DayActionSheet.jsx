import React, { useState } from 'react';
import { Utensils, RotateCcw, StickyNote } from 'lucide-react';
import { usePlan } from '../context/PlanContext';
import { RecipeSelector } from './RecipeSelector';
import { Sheet } from './ui/Sheet';
import { Button } from './ui/Button';

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
        <Sheet title={dayLabel} onClose={onClose} surface="board">
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
                <div className="flex flex-col gap-2">
                    {daysWithRecipes.map((d) => (
                        <button
                            key={d.dateStr}
                            onClick={() => { setDayLeftover(date, d.dateStr); onClose(); }}
                            className="text-left p-3 rounded-md bg-board border border-line hover:border-chalkDim transition-colors"
                        >
                            <div className="t-body" style={{ color: 'var(--chalk)' }}>{d.label}</div>
                            <div className="t-body" style={{ color: 'var(--chalk-dim)', fontSize: '12px' }}>{d.title}</div>
                        </button>
                    ))}
                </div>
            )}

            {step === 'note' && (
                <div className="flex flex-col gap-3">
                    <input
                        autoFocus
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="e.g. Mum's house, takeaway..."
                        className="input w-full"
                    />
                    <Button
                        variant="primary"
                        disabled={!noteText.trim()}
                        onClick={() => { setDayNote(date, noteText.trim()); onClose(); }}
                        className="w-full disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        Save Note
                    </Button>
                </div>
            )}
        </Sheet>
    );
}

// eslint-disable-next-line no-unused-vars -- Icon is used as a JSX tag below; no react plugin in this project's eslint config to detect that.
function SheetOption({ icon: Icon, label, onClick, disabled }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="flex items-center gap-3 p-[14px] rounded-md bg-board border border-line hover:border-chalkDim transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-left"
        >
            <Icon size={18} strokeWidth={1.5} style={{ color: 'var(--grease)' }} />
            <span className="t-body" style={{ color: 'var(--chalk)' }}>{label}</span>
        </button>
    );
}
