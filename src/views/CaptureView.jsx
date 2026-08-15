import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Plus, Trash2, ArrowLeft, X, Send, Utensils } from 'lucide-react';
import { useRecipeCapture } from '../hooks/useRecipeCapture';
import { useView } from '../context/ViewContext';

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner'];

export function CaptureView() {
    const { setCurrentView, VIEWS } = useView();
    const { status, error, draft, capture, updateDraft, save, reset, refine, refining, chatLog } = useRecipeCapture();
    const [pastedText, setPastedText] = useState('');
    const [images, setImages] = useState([]); // [{ file, previewUrl }]
    const [dishPhoto, setDishPhoto] = useState(null); // { file, previewUrl } | null
    const cameraInputRef = useRef(null);
    const libraryInputRef = useRef(null);

    const addImages = (files) => {
        const additions = files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
        setImages((prev) => [...prev, ...additions]);
    };

    const removeImage = (idx) => {
        setImages((prev) => {
            URL.revokeObjectURL(prev[idx].previewUrl);
            return prev.filter((_, i) => i !== idx);
        });
    };

    const handleFileChosen = (e) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = ''; // allow re-choosing the same file later
        if (files.length) addImages(files);
    };

    const handlePaste = (e) => {
        const files = Array.from(e.clipboardData?.items ?? [])
            .filter((item) => item.type.startsWith('image/'))
            .map((item) => item.getAsFile())
            .filter(Boolean);
        if (files.length) {
            e.preventDefault(); // don't also try to paste the image as garbled text
            addImages(files);
        }
    };

    const canExtract = pastedText.trim().length > 0 || images.length > 0;
    const handleExtract = () => capture({ text: pastedText, images: images.map((img) => img.file) });

    const setDishPhotoFile = (file) => {
        if (!file) return;
        if (dishPhoto) URL.revokeObjectURL(dishPhoto.previewUrl);
        setDishPhoto({ file, previewUrl: URL.createObjectURL(file) });
    };
    const clearDishPhoto = () => {
        if (dishPhoto) URL.revokeObjectURL(dishPhoto.previewUrl);
        setDishPhoto(null);
    };

    const resetComposer = () => {
        images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
        setImages([]);
        setPastedText('');
        clearDishPhoto();
        reset();
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
                <div className="flex flex-col gap-[16px]">
                    <div className="rounded-[18px] border border-[#3f3f46] bg-[#18181b] p-[16px] flex flex-col gap-[12px]">
                        {images.length > 0 && (
                            <div className="flex gap-[8px] flex-wrap">
                                {images.map((img, idx) => (
                                    <div key={img.previewUrl} className="relative w-[64px] h-[64px] rounded-[10px] overflow-hidden shrink-0">
                                        <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => removeImage(idx)}
                                            className="absolute top-[2px] right-[2px] w-[18px] h-[18px] rounded-full bg-black/70 flex items-center justify-center text-white"
                                        >
                                            <X size={11} strokeWidth={2} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <textarea
                            value={pastedText}
                            onChange={(e) => setPastedText(e.target.value)}
                            onPaste={handlePaste}
                            placeholder="Paste a screenshot (Ctrl/Cmd+V) and/or type or paste recipe text here..."
                            rows={6}
                            className="w-full resize-none bg-[#09090b] border border-[#27272a] rounded-[10px] p-[12px] font-sans text-[14px] text-[#e4e4e7] placeholder:text-[#52525b] focus:outline-none focus:border-[#71717a]"
                        />

                        <div className="flex gap-[8px]">
                            <button
                                onClick={() => cameraInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-2 py-[12px] rounded-[10px] border border-[#3f3f46] bg-[#09090b] text-[#a1a1aa] hover:text-[#e4e4e7] transition-colors"
                            >
                                <Camera size={16} strokeWidth={1.5} />
                                <span className="font-sans font-medium text-[12px]">Take Photo</span>
                            </button>
                            <button
                                onClick={() => libraryInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-2 py-[12px] rounded-[10px] border border-[#3f3f46] bg-[#09090b] text-[#a1a1aa] hover:text-[#e4e4e7] transition-colors"
                            >
                                <ImageIcon size={16} strokeWidth={1.5} />
                                <span className="font-sans font-medium text-[12px]">Add Photo</span>
                            </button>
                        </div>

                        <button
                            disabled={!canExtract}
                            onClick={handleExtract}
                            className="w-full py-[14px] rounded-full bg-[#fafafa] text-[#09090b] font-display font-bold text-[15px] disabled:opacity-30 disabled:cursor-not-allowed transition-transform active:scale-[0.98]"
                        >
                            Extract Recipe
                        </button>
                    </div>

                    <p className="font-sans text-[12px] text-[#52525b] text-center">
                        Combine a screenshot, a photo, and/or typed text — extraction uses everything you add.
                    </p>

                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChosen} />
                    <input ref={libraryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChosen} />
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
                    onCancel={resetComposer}
                    onSave={() => save(dishPhoto?.file)}
                    saveError={error}
                    onRefine={refine}
                    refining={refining}
                    chatLog={chatLog}
                    dishPhoto={dishPhoto}
                    onSetDishPhoto={setDishPhotoFile}
                    onClearDishPhoto={clearDishPhoto}
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
                            onClick={resetComposer}
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

function RecipeReviewForm({ draft, onChange, onCancel, onSave, saveError, onRefine, refining, chatLog, dishPhoto, onSetDishPhoto, onClearDishPhoto }) {
    const ingredients = draft.ingredients ?? [];
    const steps = draft.steps ?? [];
    const dishPhotoInputRef = useRef(null);

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

            <RefineChat onRefine={onRefine} refining={refining} chatLog={chatLog} />

            <Field label="Title">
                <input
                    value={draft.title ?? ''}
                    onChange={(e) => onChange({ title: e.target.value })}
                    className="w-full bg-[#18181b] border border-[#3f3f46] rounded-[10px] p-[12px] font-display font-bold text-[18px] text-[#fafafa] focus:outline-none focus:border-[#71717a]"
                />
            </Field>

            <Field label="Creator (optional)">
                <input
                    value={draft.creator ?? ''}
                    onChange={(e) => onChange({ creator: e.target.value })}
                    placeholder="e.g. Jamie Oliver, @claudiasoncooks, Half Baked Harvest"
                    className="w-full bg-[#18181b] border border-[#3f3f46] rounded-[10px] p-[10px] font-sans text-[14px] text-[#e4e4e7] placeholder:text-[#52525b] focus:outline-none focus:border-[#71717a]"
                />
            </Field>

            <Field label="Photo of the dish (optional)">
                {dishPhoto ? (
                    <div className="relative w-[100px] h-[100px] rounded-[12px] overflow-hidden">
                        <img src={dishPhoto.previewUrl} alt="" className="w-full h-full object-cover" />
                        <button
                            onClick={onClearDishPhoto}
                            className="absolute top-[4px] right-[4px] w-[20px] h-[20px] rounded-full bg-black/70 flex items-center justify-center text-white"
                        >
                            <X size={12} strokeWidth={2} />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => dishPhotoInputRef.current?.click()}
                        className="flex items-center gap-2 py-[10px] px-[14px] rounded-[10px] border border-dashed border-[#3f3f46] bg-[#09090b] text-[#71717a] hover:text-[#e4e4e7] self-start"
                    >
                        <Utensils size={15} strokeWidth={1.5} />
                        <span className="font-sans text-[12px]">Add a photo — now, or later from Recipes</span>
                    </button>
                )}
                <input
                    ref={dishPhotoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { onSetDishPhoto(e.target.files?.[0]); e.target.value = ''; }}
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
                disabled={refining}
                className="w-full py-[16px] rounded-full bg-[#fafafa] text-[#09090b] font-display font-bold text-[16px] transition-transform active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
                Looks Good — Save Recipe
            </button>
        </div>
    );
}

function RefineChat({ onRefine, refining, chatLog }) {
    const [message, setMessage] = useState('');

    const handleSend = () => {
        if (!message.trim() || refining) return;
        onRefine(message.trim());
        setMessage('');
    };

    return (
        <div className="flex flex-col gap-[10px] rounded-[14px] border border-[#3f3f46] bg-[#09090b] p-[14px]">
            <span className="font-sans font-semibold text-[10px] uppercase text-[#71717a] tracking-[0.12em]">
                Ask for changes
            </span>

            {chatLog.length > 0 && (
                <div className="flex flex-col gap-[10px] max-h-[180px] overflow-y-auto">
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

            <div className="flex gap-[8px]">
                <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                    placeholder="e.g. make it 4 servings, swap carrots for cucumbers"
                    disabled={refining}
                    className="flex-1 bg-[#18181b] border border-[#27272a] rounded-[10px] p-[10px] font-sans text-[13px] text-[#e4e4e7] placeholder:text-[#52525b] focus:outline-none focus:border-[#71717a] disabled:opacity-50"
                />
                <button
                    onClick={handleSend}
                    disabled={refining || !message.trim()}
                    className="px-[16px] rounded-[10px] bg-[#c9a96e] text-[#09090b] flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <Send size={15} strokeWidth={2} />
                </button>
            </div>
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
