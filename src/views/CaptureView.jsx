import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Plus, Trash2, ArrowLeft, X, Send, Utensils } from 'lucide-react';
import { useRecipeCapture } from '../hooks/useRecipeCapture';
import { useView } from '../context/ViewContext';
import { useUnitPreference } from '../hooks/useUnitPreference';
import { Button, IconButton } from '../components/ui/Button';
import { TicketCard, BoardCard } from '../components/ui/TicketCard';

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner'];

// A single pasted token that's a bare http(s) URL — nothing else on the line. Deliberately strict
// (no surrounding text, no newlines) so this only fires when the user pastes just a link, not when
// a URL happens to appear inside a block of recipe text.
const BARE_URL_RE = /^https?:\/\/\S+$/i;
const isBareUrl = (value) => BARE_URL_RE.test(value ?? '');

function sourceDomain(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
}

export function CaptureView() {
    const { setCurrentView, VIEWS } = useView();
    const { unitSystem, setUnitSystem } = useUnitPreference();
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

    const trimmedText = pastedText.trim();
    // Only treat the composer as "a URL was pasted" when it's the ONLY thing in the box and no
    // photos are attached — otherwise this falls straight through to the existing text/photo path,
    // completely unchanged.
    const isUrlCapture = images.length === 0 && isBareUrl(trimmedText);
    const canExtract = trimmedText.length > 0 || images.length > 0;
    const handleExtract = () => {
        if (isUrlCapture) {
            capture({ url: trimmedText });
        } else {
            capture({ text: pastedText, images: images.map((img) => img.file) });
        }
    };

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
        <div className="flex flex-col min-h-full bg-board text-chalk pt-[24px] pb-[24px]">
            <div className="flex flex-col items-start gap-[14px] mb-[24px]">
                <div className="flex flex-col items-start gap-1">
                    <span className="t-eyebrow text-grease">
                        Capture
                    </span>
                    <h2 className="t-display text-[clamp(28px,7vw,36px)] text-chalk leading-none">
                        Add a recipe
                    </h2>
                </div>

                <div className="flex items-center gap-[10px]">
                    <span className="font-body text-[11px] text-chalkDim">Units for new recipes</span>
                    <div className="flex gap-[4px] p-[3px] rounded-sm bg-board2 border border-line">
                        <button
                            onClick={() => setUnitSystem('metric')}
                            className={`px-[12px] py-[5px] rounded-xs font-body font-medium text-[11px] transition-colors ${unitSystem === 'metric' ? 'bg-chalk text-board' : 'text-chalkDim'}`}
                        >
                            Metric
                        </button>
                        <button
                            onClick={() => setUnitSystem('imperial')}
                            className={`px-[12px] py-[5px] rounded-xs font-body font-medium text-[11px] transition-colors ${unitSystem === 'imperial' ? 'bg-chalk text-board' : 'text-chalkDim'}`}
                        >
                            Imperial
                        </button>
                    </div>
                </div>
            </div>

            {status === 'idle' && (
                <div className="flex flex-col flex-1 min-h-0 gap-[16px]">
                    <BoardCard style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 0 }}>
                        {images.length > 0 && (
                            <div className="flex gap-[8px] flex-wrap">
                                {images.map((img, idx) => (
                                    <div key={img.previewUrl} className="relative w-[64px] h-[64px] rounded-md overflow-hidden shrink-0">
                                        <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => removeImage(idx)}
                                            className="absolute top-[2px] right-[2px] w-[18px] h-[18px] rounded-xs bg-board/80 flex items-center justify-center text-chalk"
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
                            placeholder="Paste a screenshot (Ctrl/Cmd+V), a recipe URL, and/or type or paste recipe text here..."
                            className="input w-full resize-none flex-1"
                            style={{ minHeight: '120px' }}
                        />

                        <div className="flex gap-[8px]">
                            <Button
                                variant="secondary"
                                onClick={() => cameraInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-2"
                            >
                                <Camera size={16} strokeWidth={1.5} />
                                <span className="font-body font-medium text-[12px]">Take Photo</span>
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => libraryInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-2"
                            >
                                <ImageIcon size={16} strokeWidth={1.5} />
                                <span className="font-body font-medium text-[12px]">Add Photo</span>
                            </Button>
                        </div>

                        <Button
                            variant="primary"
                            disabled={!canExtract}
                            onClick={handleExtract}
                            className="w-full disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            {isUrlCapture ? 'Fetch Recipe' : 'Extract Recipe'}
                        </Button>
                    </BoardCard>

                    <p className="font-body text-[12px] text-chalkDim text-center">
                        {isUrlCapture
                            ? 'Meal Buddy will pull the recipe straight from that link.'
                            : 'Combine a screenshot, a photo, and/or typed text — extraction uses everything you add.'}
                    </p>

                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChosen} />
                    <input ref={libraryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChosen} />
                </div>
            )}

            {status === 'extracting' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 min-h-[300px]">
                    <p className="font-head italic text-[18px] text-chalkDim animate-pulse">
                        {isUrlCapture ? 'Fetching that page...' : 'Reading your recipe...'}
                    </p>
                </div>
            )}

            {status === 'error' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-[300px] px-6 text-center">
                    <p className="font-head italic text-[18px] text-[var(--destructive)]">{error}</p>
                    <Button variant="secondary" onClick={reset}>
                        Try Again
                    </Button>
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
                    <p className="font-head italic text-[18px] text-chalkDim animate-pulse">Saving...</p>
                </div>
            )}

            {status === 'saved' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-[300px] px-6 text-center">
                    <p className="font-head italic text-[20px] text-chalk">Recipe saved to your library.</p>
                    <div className="flex flex-col gap-3 w-full max-w-[280px]">
                        <Button variant="primary" onClick={() => setCurrentView(VIEWS.RECIPES)} className="w-full">
                            View in Recipes
                        </Button>
                        <Button variant="ghost" onClick={resetComposer} className="w-full">
                            Add another
                        </Button>
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

    const ticketInput = "w-full bg-ticket2 border border-ticketShadow rounded-sm p-[12px] font-body text-[14px] text-ink placeholder:text-inkDim focus:outline-none focus:border-stamp";
    const ticketInputSm = "bg-ticket2 border border-ticketShadow rounded-xs p-[8px] font-body text-[13px] text-ink placeholder:text-inkDim focus:outline-none focus:border-stamp";

    return (
        <div className="flex flex-col gap-[20px] pb-[24px]">
            <button onClick={onCancel} className="flex items-center gap-1 text-chalkDim hover:text-chalk font-body text-[13px] self-start transition-colors">
                <ArrowLeft size={16} strokeWidth={1.5} /> Start over
            </button>

            <RefineChat onRefine={onRefine} refining={refining} chatLog={chatLog} />

            <TicketCard torn eyebrow="New Recipe" className="flex flex-col gap-[24px]">
                <Field label="Title">
                    <input
                        value={draft.title ?? ''}
                        onChange={(e) => onChange({ title: e.target.value })}
                        className={`${ticketInput} font-head font-bold text-[18px]`}
                    />
                </Field>

                <Field label="Creator (optional)">
                    <input
                        value={draft.creator ?? ''}
                        onChange={(e) => onChange({ creator: e.target.value })}
                        placeholder="e.g. Jamie Oliver, @claudiasoncooks, Half Baked Harvest"
                        className={ticketInput}
                    />
                </Field>

                <Field label="Photo of the dish (optional)">
                    {dishPhoto ? (
                        <div className="relative w-[100px] h-[100px] rounded-md overflow-hidden">
                            <img src={dishPhoto.previewUrl} alt="" className="w-full h-full object-cover" />
                            <button
                                onClick={onClearDishPhoto}
                                className="absolute top-[4px] right-[4px] w-[20px] h-[20px] rounded-xs bg-board/80 flex items-center justify-center text-chalk"
                            >
                                <X size={12} strokeWidth={2} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => dishPhotoInputRef.current?.click()}
                            className="flex items-center gap-2 py-[10px] px-[14px] rounded-sm border border-dashed border-ticketShadow bg-ticket2 text-inkDim hover:text-ink self-start transition-colors"
                        >
                            <Utensils size={15} strokeWidth={1.5} />
                            <span className="font-body text-[12px]">Add a photo — now, or later from Recipes</span>
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
                            className={`${ticketInput} font-mono`}
                        />
                    </Field>
                    <Field label="Servings">
                        <input
                            type="number"
                            value={draft.base_servings ?? ''}
                            onChange={(e) => onChange({ base_servings: Number(e.target.value) || 1 })}
                            className={`${ticketInput} font-mono`}
                        />
                    </Field>
                    <Field label="Difficulty">
                        <select
                            value={draft.difficulty ?? 'Easy'}
                            onChange={(e) => onChange({ difficulty: e.target.value })}
                            className={ticketInput}
                        >
                            {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </Field>
                </div>

                <Field label="Meal Type">
                    <select
                        value={draft.meal_type ?? 'Dinner'}
                        onChange={(e) => onChange({ meal_type: e.target.value })}
                        className={ticketInput}
                    >
                        {MEAL_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                </Field>

                <div className="flex flex-col gap-[10px]">
                    <span className="t-eyebrow text-inkDim">Ingredients</span>
                    {ingredients.map((ing, idx) => (
                        <div key={idx} className="flex gap-[8px] items-center">
                            <input
                                value={ing.quantity ?? ''}
                                onChange={(e) => updateIngredient(idx, { quantity: e.target.value === '' ? null : Number(e.target.value) })}
                                placeholder="qty"
                                className={`w-[56px] ${ticketInputSm} font-mono`}
                            />
                            <input
                                value={ing.unit ?? ''}
                                onChange={(e) => updateIngredient(idx, { unit: e.target.value || null })}
                                placeholder="unit"
                                className={`w-[64px] ${ticketInputSm}`}
                            />
                            <input
                                value={ing.name ?? ''}
                                onChange={(e) => updateIngredient(idx, { name: e.target.value })}
                                placeholder="ingredient"
                                className={`flex-1 ${ticketInputSm}`}
                            />
                            <button onClick={() => removeIngredient(idx)} className="text-inkDim hover:text-[var(--destructive)] p-[6px] transition-colors">
                                <Trash2 size={14} strokeWidth={1.5} />
                            </button>
                        </div>
                    ))}
                    <button onClick={addIngredient} className="flex items-center gap-1 text-grease font-body text-[13px] self-start mt-[4px]">
                        <Plus size={14} strokeWidth={1.5} /> Add ingredient
                    </button>
                </div>

                <div className="flex flex-col gap-[10px]">
                    <span className="t-eyebrow text-inkDim">Steps</span>
                    {steps.map((step, idx) => (
                        <div key={idx} className="flex gap-[8px] items-start">
                            <span className="font-mono text-[12px] text-inkDim mt-[10px] w-[16px]">{idx + 1}</span>
                            <textarea
                                value={step}
                                onChange={(e) => updateStep(idx, e.target.value)}
                                rows={2}
                                className={`flex-1 resize-none ${ticketInputSm}`}
                            />
                            <button onClick={() => removeStep(idx)} className="text-inkDim hover:text-[var(--destructive)] p-[6px] mt-[6px] transition-colors">
                                <Trash2 size={14} strokeWidth={1.5} />
                            </button>
                        </div>
                    ))}
                    <button onClick={addStep} className="flex items-center gap-1 text-grease font-body text-[13px] self-start mt-[4px]">
                        <Plus size={14} strokeWidth={1.5} /> Add step
                    </button>
                </div>

                {saveError && (
                    <p className="font-body text-[13px] text-[var(--destructive)] text-center">{saveError}</p>
                )}

                <Button variant="primary" onClick={onSave} disabled={refining} className="w-full disabled:opacity-40 disabled:cursor-not-allowed">
                    Looks Good — Save Recipe
                </Button>
            </TicketCard>
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
        <BoardCard style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span className="t-eyebrow text-chalkDim">
                Ask for changes
            </span>

            {chatLog.length > 0 && (
                <div className="flex flex-col gap-[10px] max-h-[180px] overflow-y-auto">
                    {chatLog.map((entry, idx) => (
                        <div key={idx} className="flex flex-col gap-[2px]">
                            <span className="font-body text-[13px] text-chalk">"{entry.instruction}"</span>
                            <span className="font-head italic text-[12px] text-grease">{entry.changeSummary}</span>
                        </div>
                    ))}
                </div>
            )}

            {refining && (
                <p className="font-head italic text-[13px] text-chalkDim animate-pulse">Applying that change...</p>
            )}

            <div className="flex gap-[8px]">
                <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                    placeholder="e.g. make it 4 servings, swap carrots for cucumbers"
                    disabled={refining}
                    className="input flex-1 disabled:opacity-50"
                />
                <IconButton
                    onClick={handleSend}
                    disabled={refining || !message.trim()}
                    className="disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Send"
                >
                    <Send size={15} strokeWidth={2} />
                </IconButton>
            </div>
        </BoardCard>
    );
}

function Field({ label, children }) {
    return (
        <div className="flex flex-col gap-[6px]">
            <span className="t-eyebrow text-inkDim">{label}</span>
            {children}
        </div>
    );
}
