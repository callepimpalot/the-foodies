import React, { useState } from 'react';
import { X, Minus, Plus, Send } from 'lucide-react';
import { refineRecipe } from '../lib/recipeExtraction';
import { normalizeIngredient } from '../lib/consolidateIngredients';

// Inspect + refine a single day's recipe before committing it — servings stepper, scaled
// ingredients, steps, and the same "ask for changes" refine-chat pattern as Capture. Never touches
// the shared library recipe; "Lock In This Day" saves the adjusted copy onto just this day.
export function RecipeDaySheet({ date, day, recipes, onSave, onClose }) {
    const initial = day?.source === 'library'
        ? (day.recipeOverride ?? recipes?.find((r) => r.id === day.recipeId))
        : day?.recipe;

    const [draft, setDraft] = useState(() => (initial
        ? { ...initial, ingredients: [...(initial.ingredients ?? [])], steps: [...(initial.steps ?? [])] }
        : null));
    const baseServings = draft?.base_servings ?? draft?.baseServings ?? 2;
    const [servings, setServings] = useState(day?.servings ?? baseServings);
    const [chatLog, setChatLog] = useState([]);
    const [instruction, setInstruction] = useState('');
    const [refining, setRefining] = useState(false);
    const [error, setError] = useState(null);

    const dayLabel = new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    if (!draft) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
                <p className="font-sans text-[14px] text-[#e4e4e7]" onClick={(e) => e.stopPropagation()}>
                    Couldn't find that recipe.
                </p>
            </div>
        );
    }

    const ratio = baseServings > 0 ? servings / baseServings : 1;
    const scaledIngredients = (draft.ingredients ?? []).map((raw) => {
        const ing = normalizeIngredient(raw);
        return { ...ing, quantity: ing.quantity != null ? Math.round(ing.quantity * ratio * 100) / 100 : null };
    });

    const handleRefine = async () => {
        if (!instruction.trim() || refining) return;
        setRefining(true);
        setError(null);
        try {
            const { recipe, changeSummary } = await refineRecipe(draft, instruction.trim());
            setDraft({ ...recipe });
            setChatLog((prev) => [...prev, { instruction: instruction.trim(), changeSummary }]);
            setInstruction('');
        } catch (err) {
            console.error('Recipe day refine failed:', err);
            setError(err?.message || "Couldn't apply that change — try rephrasing it.");
        } finally {
            setRefining(false);
        }
    };

    const handleLockIn = () => {
        onSave({ recipe: draft, servings });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full max-w-[500px] max-h-[85vh] bg-[#18181b] border-t border-[#3f3f46] rounded-t-[24px] p-[24px] pb-[32px] flex flex-col gap-[16px] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <span className="font-sans font-semibold text-[10px] uppercase text-[#71717a] tracking-[0.12em]">{dayLabel}</span>
                    <button onClick={onClose} className="text-[#71717a]"><X size={20} strokeWidth={1.5} /></button>
                </div>

                <h3 className="font-display font-bold text-[22px] text-[#fafafa] leading-tight">{draft.title}</h3>
                {draft.description && <p className="font-sans text-[13px] text-[#a1a1aa]">{draft.description}</p>}

                <div className="flex items-center gap-2 bg-[#09090b] border border-[#27272a] rounded-full px-[12px] py-[6px] self-start">
                    <button onClick={() => setServings((s) => Math.max(1, s - 1))} className="text-[#71717a] hover:text-[#e4e4e7] p-[4px]">
                        <Minus size={14} strokeWidth={2} />
                    </button>
                    <span className="font-mono text-[12px] text-[#e4e4e7] w-[80px] text-center">{servings} servings</span>
                    <button onClick={() => setServings((s) => Math.min(20, s + 1))} className="text-[#71717a] hover:text-[#e4e4e7] p-[4px]">
                        <Plus size={14} strokeWidth={2} />
                    </button>
                </div>

                <div className="flex flex-col gap-[8px]">
                    <span className="font-sans font-semibold text-[10px] uppercase text-[#71717a] tracking-[0.12em]">Ingredients</span>
                    {scaledIngredients.map((ing, idx) => (
                        <div key={idx} className="flex gap-[8px] font-sans text-[13px] text-[#e4e4e7]">
                            <span className="font-mono text-[12px] text-[#c9a96e] w-[64px] shrink-0">
                                {ing.quantity ?? ''} {ing.unit ?? ''}
                            </span>
                            <span>{ing.name}</span>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-[8px]">
                    <span className="font-sans font-semibold text-[10px] uppercase text-[#71717a] tracking-[0.12em]">Steps</span>
                    {(draft.steps ?? []).map((step, idx) => (
                        <div key={idx} className="flex gap-[8px] font-sans text-[13px] text-[#e4e4e7]">
                            <span className="font-mono text-[12px] text-[#52525b] w-[16px] shrink-0">{idx + 1}</span>
                            <span>{step}</span>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-[10px] rounded-[14px] border border-[#3f3f46] bg-[#09090b] p-[14px]">
                    <span className="font-sans font-semibold text-[10px] uppercase text-[#71717a] tracking-[0.12em]">
                        Ask for changes
                    </span>

                    {chatLog.length > 0 && (
                        <div className="flex flex-col gap-[8px] max-h-[140px] overflow-y-auto">
                            {chatLog.map((entry, idx) => (
                                <div key={idx} className="flex flex-col gap-[2px]">
                                    <span className="font-sans text-[13px] text-[#e4e4e7]">"{entry.instruction}"</span>
                                    <span className="font-sans text-[12px] text-[#c9a96e] italic">{entry.changeSummary}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {refining && (
                        <p className="font-display italic text-[13px] text-[#71717a] animate-pulse">Applying that change...</p>
                    )}
                    {error && <p className="font-sans text-[13px] text-[#ef4444]">{error}</p>}

                    <div className="flex gap-[8px]">
                        <input
                            value={instruction}
                            onChange={(e) => setInstruction(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleRefine(); }}
                            placeholder="e.g. swap chicken for tofu"
                            disabled={refining}
                            className="flex-1 bg-[#18181b] border border-[#27272a] rounded-[10px] p-[10px] font-sans text-[13px] text-[#e4e4e7] placeholder:text-[#52525b] focus:outline-none focus:border-[#71717a] disabled:opacity-50"
                        />
                        <button
                            onClick={handleRefine}
                            disabled={refining || !instruction.trim()}
                            className="px-[14px] rounded-[10px] bg-[#c9a96e] text-[#09090b] flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <Send size={14} strokeWidth={2} />
                        </button>
                    </div>
                </div>

                <button
                    onClick={handleLockIn}
                    className="w-full py-[14px] rounded-full bg-[#fafafa] text-[#09090b] font-display font-bold text-[15px] transition-transform active:scale-[0.98]"
                >
                    Lock In This Day
                </button>
            </div>
        </div>
    );
}
