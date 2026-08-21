import React, { useState } from 'react';
import { Minus, Plus, Send } from 'lucide-react';
import { refineRecipe } from '../lib/recipeExtraction';
import { normalizeIngredient } from '../lib/consolidateIngredients';
import { Sheet } from './ui/Sheet';
import { Button } from './ui/Button';

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
            <Sheet onClose={onClose} surface="board">
                <p className="t-body" style={{ color: 'var(--chalk-dim)' }}>Couldn't find that recipe.</p>
            </Sheet>
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
        <Sheet
            onClose={onClose}
            title={dayLabel}
            surface="board"
            footer={
                <Button variant="primary" onClick={handleLockIn} className="w-full">
                    Lock In This Day
                </Button>
            }
        >
            <div className="flex flex-col gap-[16px]">
                <div>
                    <h3 className="t-heading-md" style={{ color: 'var(--chalk)' }}>{draft.title}</h3>
                    {draft.description && (
                        <p className="t-body" style={{ color: 'var(--chalk-dim)', marginTop: '4px' }}>{draft.description}</p>
                    )}
                </div>

                <div className="flex items-center gap-2 self-start" style={{ background: 'var(--board)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '6px 12px' }}>
                    <button onClick={() => setServings((s) => Math.max(1, s - 1))} style={{ color: 'var(--chalk-dim)', padding: '4px' }}>
                        <Minus size={14} strokeWidth={2} />
                    </button>
                    <span className="t-mono" style={{ fontSize: '12px', color: 'var(--chalk)', width: '80px', textAlign: 'center' }}>{servings} servings</span>
                    <button onClick={() => setServings((s) => Math.min(20, s + 1))} style={{ color: 'var(--chalk-dim)', padding: '4px' }}>
                        <Plus size={14} strokeWidth={2} />
                    </button>
                </div>

                <div className="flex flex-col gap-[8px]">
                    <span className="t-eyebrow" style={{ color: 'var(--chalk-dim)' }}>Ingredients</span>
                    {scaledIngredients.map((ing, idx) => (
                        <div key={idx} className="flex gap-[8px] t-body" style={{ color: 'var(--chalk)' }}>
                            <span className="t-mono" style={{ fontSize: '12px', color: 'var(--grease)', width: '64px', flexShrink: 0 }}>
                                {ing.quantity ?? ''} {ing.unit ?? ''}
                            </span>
                            <span>{ing.name}</span>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-[8px]">
                    <span className="t-eyebrow" style={{ color: 'var(--chalk-dim)' }}>Steps</span>
                    {(draft.steps ?? []).map((step, idx) => (
                        <div key={idx} className="flex gap-[8px] t-body" style={{ color: 'var(--chalk)' }}>
                            <span className="t-mono" style={{ fontSize: '12px', color: 'var(--chalk-dim)', width: '16px', flexShrink: 0 }}>{idx + 1}</span>
                            <span>{step}</span>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-[10px]" style={{ borderRadius: 'var(--r-lg)', border: '1px solid var(--line)', background: 'var(--board)', padding: '14px' }}>
                    <span className="t-eyebrow" style={{ color: 'var(--chalk-dim)' }}>
                        Ask for changes
                    </span>

                    {chatLog.length > 0 && (
                        <div className="flex flex-col gap-[8px]" style={{ maxHeight: '140px', overflowY: 'auto' }}>
                            {chatLog.map((entry, idx) => (
                                <div key={idx} className="flex flex-col gap-[2px]">
                                    <span className="t-body" style={{ fontSize: '13px', color: 'var(--chalk)' }}>"{entry.instruction}"</span>
                                    <span className="t-body" style={{ fontSize: '12px', color: 'var(--grease)', fontStyle: 'italic' }}>{entry.changeSummary}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {refining && (
                        <p className="t-heading-sm" style={{ fontStyle: 'italic', fontSize: '13px', color: 'var(--chalk-dim)' }}>Applying that change...</p>
                    )}
                    {error && <p className="t-body" style={{ fontSize: '13px', color: 'var(--destructive)' }}>{error}</p>}

                    <div className="flex gap-[8px]">
                        <input
                            value={instruction}
                            onChange={(e) => setInstruction(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleRefine(); }}
                            placeholder="e.g. swap chicken for tofu"
                            disabled={refining}
                            className="input flex-1 disabled:opacity-50"
                        />
                        <button
                            onClick={handleRefine}
                            disabled={refining || !instruction.trim()}
                            className="btn-stamp"
                            style={{ width: '40px', height: '40px', flexShrink: 0, opacity: (refining || !instruction.trim()) ? 0.3 : 1, cursor: (refining || !instruction.trim()) ? 'not-allowed' : 'pointer' }}
                        >
                            <Send size={14} strokeWidth={2} />
                        </button>
                    </div>
                </div>
            </div>
        </Sheet>
    );
}
