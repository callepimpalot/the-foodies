import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, ClipboardPaste, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { useRecipeCapture } from '../hooks/useRecipeCapture';
import { useView } from '../context/ViewContext';

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner'];

export function CaptureView() {
    const { setCurrentView, VIEWS } = useView();
    const { status, error, draft, captureFromText, captureFromImage, updateDraft, save, reset } = useRecipeCapture();
    const [pastedText, setPastedText] = useState('');
    const cameraInputRef = useRef(null);
    const libraryInputRef = useRef(null);

    const handleFileChosen = (e) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // allow re-choosing the same file later
        if (file) captureFromImage(file);
    };

    return (
        <div className="flex flex-col min-h-full bg-[#09090b] text-[#e4e4e7] px-[24px] pt-[32px] pb-[24px]">
            <div className="flex flex-col items-start gap-1 mb-[24px]">
                <span className="font-sans font-semibold text-[10px] uppercase text-[#c9a96e] tracking-[0.12em]">
                    CAPTURE
                </span>
                <h2 className="font-display font-black text-[clamp(28px,7vw,36px)] text-[#fafafa] leading-none">
                    Add a recipe
                </h2>
            </div>

            {status === 'idle' && (
                <div className="flex flex-col gap-[20px]">
                    <div className="rounded-[18px] border border-[#3f3f46] bg-[#18181b] p-[16px] flex flex-col gap-[12px]">
                        <div className="flex items-center gap-2 text-[#a1a1aa]">
                            <ClipboardPaste size={16} strokeWidth={1.5} />
                            <span className="font-sans font-medium text-[12px] uppercase tracking-wide">Paste recipe text</span>
                        </div>
                        <textarea
                            value={pastedText}
                            onChange={(e) => setPastedText(e.target.value)}
                            placeholder="Paste a recipe from anywhere — a website, a message, notes..."
                            rows={6}
                            className="w-full resize-none bg-[#09090b] border border-[#27272a] rounded-[10px] p-[12px] font-sans text-[14px] text-[#e4e4e7] placeholder:text-[#52525b] focus:outline-none focus:border-[#71717a]"
                        />
                        <button
                            disabled={!pastedText.trim()}
                            onClick={() => captureFromText(pastedText)}
                            className="w-full py-[14px] rounded-full bg-[#fafafa] text-[#09090b] font-display font-bold text-[15px] disabled:opacity-30 disabled:cursor-not-allowed transition-transform active:scale-[0.98]"
                        >
                            Extract Recipe
                        </button>
                    </div>

                    <div className="flex items-center gap-3 text-[#3f3f46]">
                        <div className="flex-1 h-px bg-[#27272a]" />
                        <span className="font-sans text-[11px] uppercase tracking-wide text-[#52525b]">or</span>
                        <div className="flex-1 h-px bg-[#27272a]" />
                    </div>

                    <div className="grid grid-cols-2 gap-[12px]">
                        <button
                            onClick={() => cameraInputRef.current?.click()}
                            className="flex flex-col items-center justify-center gap-2 py-[24px] rounded-[18px] border border-[#3f3f46] bg-[#18181b] text-[#a1a1aa] hover:text-[#e4e4e7] transition-colors"
                        >
                            <Camera size={22} strokeWidth={1.5} />
                            <span className="font-sans font-medium text-[12px]">Take Photo</span>
                        </button>
                        <button
                            onClick={() => libraryInputRef.current?.click()}
                            className="flex flex-col items-center justify-center gap-2 py-[24px] rounded-[18px] border border-[#3f3f46] bg-[#18181b] text-[#a1a1aa] hover:text-[#e4e4e7] transition-colors"
                        >
                            <ImageIcon size={22} strokeWidth={1.5} />
                            <span className="font-sans font-medium text-[12px]">From Library</span>
                        </button>
                    </div>
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChosen} />
                    <input ref={libraryInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChosen} />
                </div>
            )}

            {status === 'extracting' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 min-h-[300px]">
                    <p className="font-display italic text-[18px] text-[#71717a] animate-pulse">
                        Reading your recipe...
                    </p>
                </div>
            )}

            {status === 'error' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-[300px] px-6 text-center">
                    <p className="font-display italic text-[18px] text-[#71717a]">{error}</p>
                    <button
                        onClick={reset}
                        className="py-[12px] px-[24px] rounded-full bg-[#18181b] border border-[#3f3f46] text-[#e4e4e7] font-sans font-medium text-[13px]"
                    >
                        Try Again
                    </button>
                </div>
            )}

            {status === 'review' && draft && (
                <RecipeReviewForm
                    draft={draft}
                    onChange={updateDraft}
                    onCancel={reset}
                    onSave={save}
                    saveError={error}
                />
            )}

            {status === 'saving' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 min-h-[300px]">
                    <p className="font-display italic text-[18px] text-[#71717a] animate-pulse">Saving...</p>
                </div>
            )}

            {status === 'saved' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-[300px] px-6 text-center">
                    <p className="font-display italic text-[20px] text-[#fafafa]">Recipe saved to your library.</p>
                    <div className="flex flex-col gap-3 w-full max-w-[280px]">
                        <button
                            onClick={() => setCurrentView(VIEWS.RECIPES)}
                            className="w-full py-[14px] rounded-full bg-[#fafafa] text-[#09090b] font-display font-bold text-[15px]"
                        >
                            View in Recipes
                        </button>
                        <button
                            onClick={() => { reset(); setPastedText(''); }}
                            className="w-full py-[12px] rounded-full bg-transparent text-[#a1a1aa] font-sans font-medium text-[13px]"
                        >
                            Add another
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function RecipeReviewForm({ draft, onChange, onCancel, onSave, saveError }) {
    const ingredients = draft.ingredients ?? [];
    const steps = draft.steps ?? [];

    const updateIngredient = (idx, patch) => {
        const next = ingredients.map((ing, i) => (i === idx ? { ...ing, ...patch } : ing));
        onChange({ ingredients: next });
    };
    const removeIngredient = (idx) => onChange({ ingredients: ingredients.filter((_, i) => i !== idx) });
    const addIngredient = () => onChange({ ingredients: [...ingredients, { name: '', quantity: null, unit: null }] });

    const updateStep = (idx, value) => {
        const next = steps.map((s, i) => (i === idx ? value : s));
        onChange({ steps: next });
    };
    const removeStep = (idx) => onChange({ steps: steps.filter((_, i) => i !== idx) });
    const addStep = () => onChange({ steps: [...steps, ''] });

    return (
        <div className="flex flex-col gap-[24px] pb-[24px]">
            <button onClick={onCancel} className="flex items-center gap-1 text-[#71717a] font-sans text-[13px] self-start">
                <ArrowLeft size={16} strokeWidth={1.5} /> Start over
            </button>

            <Field label="Title">
                <input
                    value={draft.title ?? ''}
                    onChange={(e) => onChange({ title: e.target.value })}
                    className="w-full bg-[#18181b] border border-[#3f3f46] rounded-[10px] p-[12px] font-display font-bold text-[18px] text-[#fafafa] focus:outline-none focus:border-[#71717a]"
                />
            </Field>

            <div className="grid grid-cols-3 gap-[12px]">
                <Field label="Cook Time (min)">
                    <input
                        type="number"
                        value={draft.cook_time_minutes ?? ''}
                        onChange={(e) => onChange({ cook_time_minutes: Number(e.target.value) || 0 })}
                        className="w-full bg-[#18181b] border border-[#3f3f46] rounded-[10px] p-[10px] font-sans text-[14px] text-[#e4e4e7] focus:outline-none focus:border-[#71717a]"
                    />
                </Field>
                <Field label="Servings">
                    <input
                        type="number"
                        value={draft.base_servings ?? ''}
                        onChange={(e) => onChange({ base_servings: Number(e.target.value) || 1 })}
                        className="w-full bg-[#18181b] border border-[#3f3f46] rounded-[10px] p-[10px] font-sans text-[14px] text-[#e4e4e7] focus:outline-none focus:border-[#71717a]"
                    />
                </Field>
                <Field label="Difficulty">
                    <select
                        value={draft.difficulty ?? 'Easy'}
                        onChange={(e) => onChange({ difficulty: e.target.value })}
                        className="w-full bg-[#18181b] border border-[#3f3f46] rounded-[10px] p-[10px] font-sans text-[14px] text-[#e4e4e7] focus:outline-none focus:border-[#71717a]"
                    >
                        {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                </Field>
            </div>

            <Field label="Meal Type">
                <select
                    value={draft.meal_type ?? 'Dinner'}
                    onChange={(e) => onChange({ meal_type: e.target.value })}
                    className="w-full bg-[#18181b] border border-[#3f3f46] rounded-[10px] p-[10px] font-sans text-[14px] text-[#e4e4e7] focus:outline-none focus:border-[#71717a]"
                >
                    {MEAL_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
            </Field>

            <div className="flex flex-col gap-[10px]">
                <span className="font-sans font-semibold text-[10px] uppercase text-[#71717a] tracking-[0.12em]">Ingredients</span>
                {ingredients.map((ing, idx) => (
                    <div key={idx} className="flex gap-[8px] items-center">
                        <input
                            value={ing.quantity ?? ''}
                            onChange={(e) => updateIngredient(idx, { quantity: e.target.value === '' ? null : Number(e.target.value) })}
                            placeholder="qty"
                            className="w-[56px] bg-[#18181b] border border-[#3f3f46] rounded-[8px] p-[8px] font-sans text-[13px] text-[#e4e4e7] focus:outline-none focus:border-[#71717a]"
                        />
                        <input
                            value={ing.unit ?? ''}
                            onChange={(e) => updateIngredient(idx, { unit: e.target.value || null })}
                            placeholder="unit"
                            className="w-[64px] bg-[#18181b] border border-[#3f3f46] rounded-[8px] p-[8px] font-sans text-[13px] text-[#e4e4e7] focus:outline-none focus:border-[#71717a]"
                        />
                        <input
                            value={ing.name ?? ''}
                            onChange={(e) => updateIngredient(idx, { name: e.target.value })}
                            placeholder="ingredient"
                            className="flex-1 bg-[#18181b] border border-[#3f3f46] rounded-[8px] p-[8px] font-sans text-[13px] text-[#e4e4e7] focus:outline-none focus:border-[#71717a]"
                        />
                        <button onClick={() => removeIngredient(idx)} className="text-[#71717a] hover:text-[#ef4444] p-[6px]">
                            <Trash2 size={14} strokeWidth={1.5} />
                        </button>
                    </div>
                ))}
                <button onClick={addIngredient} className="flex items-center gap-1 text-[#c9a96e] font-sans text-[13px] self-start mt-[4px]">
                    <Plus size={14} strokeWidth={1.5} /> Add ingredient
                </button>
            </div>

            <div className="flex flex-col gap-[10px]">
                <span className="font-sans font-semibold text-[10px] uppercase text-[#71717a] tracking-[0.12em]">Steps</span>
                {steps.map((step, idx) => (
                    <div key={idx} className="flex gap-[8px] items-start">
                        <span className="font-mono text-[12px] text-[#52525b] mt-[10px] w-[16px]">{idx + 1}</span>
                        <textarea
                            value={step}
                            onChange={(e) => updateStep(idx, e.target.value)}
                            rows={2}
                            className="flex-1 resize-none bg-[#18181b] border border-[#3f3f46] rounded-[8px] p-[8px] font-sans text-[13px] text-[#e4e4e7] focus:outline-none focus:border-[#71717a]"
                        />
                        <button onClick={() => removeStep(idx)} className="text-[#71717a] hover:text-[#ef4444] p-[6px] mt-[6px]">
                            <Trash2 size={14} strokeWidth={1.5} />
                        </button>
                    </div>
                ))}
                <button onClick={addStep} className="flex items-center gap-1 text-[#c9a96e] font-sans text-[13px] self-start mt-[4px]">
                    <Plus size={14} strokeWidth={1.5} /> Add step
                </button>
            </div>

            {saveError && (
                <p className="font-sans text-[13px] text-[#ef4444] text-center">{saveError}</p>
            )}

            <button
                onClick={onSave}
                className="w-full py-[16px] rounded-full bg-[#fafafa] text-[#09090b] font-display font-bold text-[16px] transition-transform active:scale-[0.98]"
            >
                Looks Good — Save Recipe
            </button>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div className="flex flex-col gap-[6px]">
            <span className="font-sans font-semibold text-[10px] uppercase text-[#71717a] tracking-[0.1em]">{label}</span>
            {children}
        </div>
    );
}
