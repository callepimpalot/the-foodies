import React, { useState } from 'react';
import { Lock, Unlock, Send, RotateCcw, StickyNote, Utensils, Sparkles, BookOpen, GripVertical, RefreshCw, Plus, X } from 'lucide-react';
import { usePlan } from '../context/PlanContext';
import { useRecipes } from '../hooks/useRecipes';
import { useWeekPlanChat } from '../hooks/useWeekPlanChat';
import { saveRecipe } from '../lib/saveRecipe';
import { RecipeSelector } from './RecipeSelector';
import { RecipeDaySheet } from './RecipeDaySheet';

// Normalizes a RECIPE_SCHEMA-shaped object (snake_case, from Gemini or a raw Supabase row) into
// the display shape the rest of the app expects (baseServings, image, guaranteed arrays) — the
// same aliasing useRecipes.js's mapRow() does for library rows, needed here for AI-generated and
// per-day-customized recipes that never go through that hook.
function toPlannableRecipe(recipeLike) {
    return {
        ...recipeLike,
        image: recipeLike.image_url ?? recipeLike.image ?? null,
        baseServings: recipeLike.base_servings ?? recipeLike.baseServings ?? 2,
        servings: recipeLike.base_servings ?? recipeLike.baseServings ?? 2,
        archetypes: Array.isArray(recipeLike.archetypes) ? recipeLike.archetypes : [],
        tags: Array.isArray(recipeLike.tags) ? recipeLike.tags : [],
        steps: Array.isArray(recipeLike.steps) ? recipeLike.steps : [],
        ingredients: Array.isArray(recipeLike.ingredients) ? recipeLike.ingredients : [],
    };
}

function buildScopeDates() {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d.toISOString().split('T')[0];
    });
}

// Chat-driven alternative to tapping days one at a time — describe a week, the AI proposes
// day-by-day assignments (from the recipe library or newly invented), lock what's good, refine
// the rest, then write the finalized week into PlanContext in one go.
export function WeekPlanChat({ onApplied }) {
    const { weeklyPlan, setDayRecipe, setDayLeftover, setDayNote, updateServings } = usePlan();
    const { recipes } = useRecipes();
    const [scopeDates] = useState(buildScopeDates);
    const hasExisting = scopeDates.some((d) => weeklyPlan?.[d]);
    const [acknowledged, setAcknowledged] = useState(!hasExisting);
    const {
        status, error, days, chatLog, send, sendSingleDay, toggleLock, swapDays,
        setLeftoverSource, setDayAsLibraryRecipe, setDayAsLeftover, setDayAsNote,
        setDayRecipeCustomization, addDay, nextAddableDate, reset,
    } = useWeekPlanChat(scopeDates);
    const [message, setMessage] = useState('');
    const [applying, setApplying] = useState(false);
    const [applyError, setApplyError] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null); // date "picked up," awaiting a second tap to swap with
    const [editingDate, setEditingDate] = useState(null); // date whose empty-day action sheet is open
    const [inspectingDate, setInspectingDate] = useState(null); // date whose recipe detail sheet is open

    // Two-tap swap instead of a drag gesture — tap a day's handle to pick it up (tap it again to
    // cancel), then tap another day's handle to swap them. Plain onClick, so it works identically
    // on touch and mouse with no gesture-tracking edge cases.
    // Reads selectedDate directly rather than via a setState updater — React.StrictMode (see
    // main.jsx) double-invokes updater functions in dev to catch impure ones, which silently
    // swapped-then-swapped-back when swapDays (a side effect) lived inside the updater.
    const handleGripTap = (date) => {
        if (selectedDate === date) {
            setSelectedDate(null);
        } else if (selectedDate) {
            swapDays(selectedDate, date);
            setSelectedDate(null);
        } else {
            setSelectedDate(date);
        }
    };

    const libraryShortlist = (recipes ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        meal_type: r.meal_type,
        tags: r.tags,
        kcal: r.kcal,
        difficulty: r.difficulty,
    }));

    const handleSend = () => {
        if (!message.trim() || status === 'planning') return;
        send(message.trim(), libraryShortlist);
        setMessage('');
    };

    const handleRestart = () => {
        reset();
        setMessage('');
        setApplyError(null);
    };

    const handleApply = async () => {
        setApplying(true);
        setApplyError(null);
        try {
            for (const day of days) {
                if (day.type === 'recipe' && day.source === 'library') {
                    const raw = day.recipeOverride ?? recipes?.find((r) => r.id === day.recipeId);
                    if (raw) {
                        setDayRecipe(day.date, toPlannableRecipe(raw));
                        if (day.servings) updateServings(day.date, day.servings);
                    }
                } else if (day.type === 'recipe' && day.source === 'generated' && day.recipe) {
                    const saved = await saveRecipe({ ...day.recipe, tags: ['captured', 'ai-planned'] });
                    setDayRecipe(day.date, toPlannableRecipe(saved));
                    if (day.servings) updateServings(day.date, day.servings);
                } else if (day.type === 'leftover' && day.sourceDate) {
                    setDayLeftover(day.date, day.sourceDate);
                } else if (day.type === 'note') {
                    setDayNote(day.date, day.note ?? '');
                }
                // type === 'empty' — nothing planned, nothing to write.
            }
            reset();
            onApplied?.();
        } catch (err) {
            console.error('Applying week plan failed:', err);
            setApplyError(err?.message || 'Could not apply the plan — try again.');
        } finally {
            setApplying(false);
        }
    };

    if (!acknowledged) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-[16px] px-[24px] text-center">
                <p className="font-display italic text-[18px] text-[#e4e4e7]">
                    Some days this week are already planned.
                </p>
                <p className="font-sans text-[13px] text-[#71717a] max-w-[260px]">
                    Continuing may replace what's already on those days once you apply a chat plan.
                </p>
                <button
                    onClick={() => setAcknowledged(true)}
                    className="py-[12px] px-[24px] rounded-full bg-[#fafafa] text-[#09090b] font-display font-bold text-[14px] transition-transform active:scale-[0.98]"
                >
                    Continue anyway
                </button>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-[24px] flex flex-col gap-[16px] pb-[16px]">
                {chatLog.length === 0 && days.length === 0 && (
                    <p className="font-sans text-[13px] text-[#71717a]">
                        Describe your week — e.g. "3 meals, 2 leftover days, one with minced beef, one chicken, one vegan."
                    </p>
                )}

                {chatLog.map((entry, idx) => (
                    <div key={idx} className="flex flex-col gap-[2px]">
                        <span className="font-sans text-[13px] text-[#e4e4e7]">"{entry?.instruction}"</span>
                        <span className="font-sans text-[12px] text-[#c9a96e] italic">{entry?.summary}</span>
                    </div>
                ))}

                {status === 'planning' && (
                    <p className="font-display italic text-[14px] text-[#71717a] animate-pulse">Planning your week...</p>
                )}

                {error && <p className="font-sans text-[13px] text-[#ef4444]">{error}</p>}

                {days.length > 0 && (
                    <div className="flex flex-col gap-[8px] mt-[8px]">
                        <div className="flex items-center justify-between -mb-[2px]">
                            <p className="font-sans text-[11px] text-[#52525b]">
                                Tap a day's handle, then tap another to swap them.
                            </p>
                            <button
                                onClick={handleRestart}
                                className="flex items-center gap-1 text-[#71717a] hover:text-[#e4e4e7] font-sans text-[11px] shrink-0"
                            >
                                <RefreshCw size={11} strokeWidth={1.5} /> Start over
                            </button>
                        </div>
                        {days.map((day) => (
                            <DayRow
                                key={day.date}
                                day={day}
                                days={days}
                                recipes={recipes}
                                onToggleLock={() => toggleLock(day.date)}
                                onChangeSource={(sourceDate) => setLeftoverSource(day.date, sourceDate)}
                                onEditEmpty={() => setEditingDate(day.date)}
                                onInspectRecipe={() => setInspectingDate(day.date)}
                                isSelected={selectedDate === day.date}
                                onGripTap={() => handleGripTap(day.date)}
                            />
                        ))}
                        {nextAddableDate && (
                            <button
                                onClick={addDay}
                                className="w-full flex items-center justify-center gap-2 p-[12px] rounded-[12px] border border-dashed border-[#3f3f46] text-[#71717a] hover:text-[#e4e4e7] hover:border-[#52525b] transition-colors font-sans text-[13px]"
                            >
                                <Plus size={14} strokeWidth={1.5} />
                                Add {new Date(nextAddableDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="px-[24px] pt-[12px] pb-[16px] flex flex-col gap-[10px] border-t border-[#27272a]">
                <div className="flex gap-[8px]">
                    <input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                        placeholder={days.length === 0 ? 'Describe your week...' : 'Ask for changes to unlocked days...'}
                        disabled={status === 'planning'}
                        className="flex-1 bg-[#18181b] border border-[#27272a] rounded-[10px] p-[12px] font-sans text-[14px] text-[#e4e4e7] placeholder:text-[#52525b] focus:outline-none focus:border-[#71717a] disabled:opacity-50"
                    />
                    <button
                        onClick={handleSend}
                        disabled={status === 'planning' || !message.trim()}
                        className="px-[16px] rounded-[10px] bg-[#c9a96e] text-[#09090b] flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <Send size={16} strokeWidth={2} />
                    </button>
                </div>

                {applyError && <p className="font-sans text-[13px] text-[#ef4444] text-center">{applyError}</p>}

                {days.length > 0 && (
                    <button
                        onClick={handleApply}
                        disabled={applying}
                        className="w-full py-[14px] rounded-full bg-[#fafafa] text-[#09090b] font-display font-bold text-[15px] disabled:opacity-40 disabled:cursor-not-allowed transition-transform active:scale-[0.98]"
                    >
                        {applying ? 'Applying...' : 'Apply to Plan'}
                    </button>
                )}
            </div>

            {editingDate && (
                <DayEditSheet
                    date={editingDate}
                    days={days}
                    recipes={recipes}
                    onSetLibraryRecipe={(recipeId) => setDayAsLibraryRecipe(editingDate, recipeId)}
                    onSetLeftover={(sourceDate) => setDayAsLeftover(editingDate, sourceDate)}
                    onSetNote={(note) => setDayAsNote(editingDate, note)}
                    onSendChat={(instruction) => sendSingleDay(editingDate, instruction, libraryShortlist)}
                    onClose={() => setEditingDate(null)}
                />
            )}

            {inspectingDate && (
                <RecipeDaySheet
                    date={inspectingDate}
                    day={days.find((d) => d.date === inspectingDate)}
                    recipes={recipes}
                    onSave={({ recipe, servings }) => setDayRecipeCustomization(inspectingDate, { recipe, servings })}
                    onClose={() => setInspectingDate(null)}
                />
            )}
        </div>
    );
}

// Resolves what a day should display as its dish/note title — used both for the row itself and
// to show the actual dish name (not just a weekday) when a leftover day names its source.
function resolveDayTitle(day, recipes) {
    if (!day) return 'Unknown';
    if (day.type === 'recipe') {
        if (day.source === 'library') return day.recipeOverride?.title ?? recipes?.find((r) => r.id === day.recipeId)?.title ?? 'Unknown recipe';
        return day.recipe?.title ?? 'New idea';
    }
    if (day.type === 'note') return day.note || 'Note';
    return 'Unknown';
}

function DayRow({ day, days, recipes, onToggleLock, onChangeSource, onEditEmpty, onInspectRecipe, isSelected, onGripTap }) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const dayLabel = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    let title = null;
    let badge = null;
    let Icon = Utensils;
    const isLeftover = day.type === 'leftover';

    if (day.type === 'recipe') {
        Icon = Utensils;
        title = resolveDayTitle(day, recipes);
        badge = day.source === 'library'
            ? { label: 'Library', icon: BookOpen }
            : { label: 'New idea', icon: Sparkles };
    } else if (isLeftover) {
        Icon = RotateCcw;
        const sourceDay = days?.find((d) => d.date === day.sourceDate);
        const sourceLabel = day.sourceDate
            ? new Date(day.sourceDate).toLocaleDateString('en-US', { weekday: 'short' })
            : 'another day';
        title = sourceDay ? `Leftovers from ${sourceLabel} · ${resolveDayTitle(sourceDay, recipes)}` : `Leftovers from ${sourceLabel}`;
    } else if (day.type === 'note') {
        Icon = StickyNote;
        title = day.note;
    } else if (day.type === 'empty') {
        Icon = Plus;
        title = 'No meal planned';
    }

    // Only earlier recipe days can be a leftover's source — you can't have leftovers of a meal
    // that hasn't been cooked yet within this proposal.
    const sourceCandidates = isLeftover
        ? (days ?? []).filter((d) => d.type === 'recipe' && d.date < day.date)
        : [];
    const isEmpty = day.type === 'empty';
    const isRecipe = day.type === 'recipe';
    const isRowClickable = sourceCandidates.length > 0 || isEmpty || isRecipe;
    const handleRowClick = () => {
        if (sourceCandidates.length > 0) setPickerOpen((v) => !v);
        else if (isEmpty) onEditEmpty?.();
        else if (isRecipe) onInspectRecipe?.();
    };

    const borderClass = isSelected
        ? 'border border-[#c9a96e]'
        : day.type === 'empty'
            ? 'border border-dashed border-[#3f3f46]'
            : 'border border-[#27272a]';

    return (
        <div
            className={`relative flex items-center gap-[8px] p-[12px] rounded-[12px] bg-[#18181b] transition-[background-color,border-color] ${borderClass} ${isSelected ? 'bg-[rgba(201,169,110,0.06)]' : ''}`}
        >
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onGripTap(); }}
                className="shrink-0 self-stretch -my-[12px] -ml-[4px] w-[40px] flex items-center justify-center"
            >
                <GripVertical size={14} strokeWidth={1.5} className={isSelected ? 'text-[#c9a96e]' : 'text-[#3f3f46]'} />
            </button>
            <Icon size={16} strokeWidth={1.5} className="text-[#c9a96e] shrink-0" />
            <div
                className={`flex-1 min-w-0 flex flex-col gap-[2px] ${isRowClickable ? 'cursor-pointer' : ''}`}
                onClick={handleRowClick}
            >
                <span className="font-sans font-semibold text-[10px] uppercase text-[#71717a] tracking-[0.1em]">{dayLabel}</span>
                <div className="flex items-center gap-[8px]">
                    <span className="font-sans text-[13px] text-[#e4e4e7] truncate">{title}</span>
                    {badge && (
                        <span className="shrink-0 flex items-center gap-1 px-[6px] py-[2px] rounded-full bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.10)] text-[#a1a1aa] font-sans text-[9px] uppercase tracking-wide">
                            <badge.icon size={9} strokeWidth={2} /> {badge.label}
                        </span>
                    )}
                </div>
            </div>
            <button onClick={onToggleLock} className={day.locked ? 'text-[#c9a96e]' : 'text-[#52525b]'}>
                {day.locked ? <Lock size={16} strokeWidth={1.5} /> : <Unlock size={16} strokeWidth={1.5} />}
            </button>

            {pickerOpen && (
                <div className="absolute top-full left-[12px] right-[12px] mt-[4px] z-20 rounded-[10px] border border-[#3f3f46] bg-[#09090b] shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden">
                    {sourceCandidates.map((c) => (
                        <button
                            key={c.date}
                            onClick={(e) => { e.stopPropagation(); onChangeSource(c.date); setPickerOpen(false); }}
                            className="w-full text-left px-[12px] py-[10px] font-sans text-[13px] text-[#e4e4e7] hover:bg-[#18181b] border-b border-[#27272a] last:border-b-0"
                        >
                            {new Date(c.date).toLocaleDateString('en-US', { weekday: 'short' })} — {resolveDayTitle(c, recipes)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// Bottom sheet shown when tapping an empty day — lets the user place a library recipe, mark it as
// leftovers, ask the AI to plan just this one day, or leave a note. Mirrors DayActionSheet.jsx's
// manual-calendar sheet, plus the "ask the AI" option that's unique to chat mode.
function DayEditSheet({ date, days, recipes, onSetLibraryRecipe, onSetLeftover, onSetNote, onSendChat, onClose }) {
    const [step, setStep] = useState('choose'); // choose | library | leftover | chat | note
    const [noteText, setNoteText] = useState('');
    const [chatText, setChatText] = useState('');
    const [chatBusy, setChatBusy] = useState(false);
    const [chatError, setChatError] = useState(null);

    const dayLabel = new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const leftoverCandidates = (days ?? []).filter((d) => d.type === 'recipe' && d.date < date);

    if (step === 'library') {
        return (
            <RecipeSelector
                slot={dayLabel}
                onSelect={(recipe) => { onSetLibraryRecipe(recipe.id); onClose(); }}
                onClose={onClose}
            />
        );
    }

    const handleChatSubmit = async () => {
        if (!chatText.trim() || chatBusy) return;
        setChatBusy(true);
        setChatError(null);
        const result = await onSendChat(chatText.trim());
        setChatBusy(false);
        if (result?.ok) onClose();
        else setChatError(result?.message || "Couldn't apply that — try rephrasing it.");
    };

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
                        <SheetOption icon={BookOpen} label="Plan from library" onClick={() => setStep('library')} />
                        <SheetOption
                            icon={RotateCcw}
                            label="Leftovers from another day"
                            onClick={() => setStep('leftover')}
                            disabled={leftoverCandidates.length === 0}
                        />
                        <SheetOption icon={Sparkles} label="Ask the AI for this day" onClick={() => setStep('chat')} />
                        <SheetOption icon={StickyNote} label="Just a note (e.g. eating out)" onClick={() => setStep('note')} />
                    </div>
                )}

                {step === 'leftover' && (
                    <div className="flex flex-col gap-[8px]">
                        {leftoverCandidates.map((c) => (
                            <button
                                key={c.date}
                                onClick={() => { onSetLeftover(c.date); onClose(); }}
                                className="text-left p-[12px] rounded-[10px] bg-[#09090b] border border-[#27272a] hover:border-[#71717a] transition-colors"
                            >
                                <div className="font-sans font-medium text-[13px] text-[#e4e4e7]">
                                    {new Date(c.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                </div>
                                <div className="font-sans text-[12px] text-[#71717a]">{resolveDayTitle(c, recipes)}</div>
                            </button>
                        ))}
                    </div>
                )}

                {step === 'chat' && (
                    <div className="flex flex-col gap-[12px]">
                        <p className="font-sans text-[12px] text-[#71717a]">
                            Only this day will change — every other day stays exactly as it is.
                        </p>
                        <input
                            autoFocus
                            value={chatText}
                            onChange={(e) => setChatText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleChatSubmit(); }}
                            placeholder="e.g. add a spicy meal"
                            disabled={chatBusy}
                            className="w-full bg-[#09090b] border border-[#27272a] rounded-[10px] p-[12px] font-sans text-[14px] text-[#e4e4e7] placeholder:text-[#52525b] focus:outline-none focus:border-[#71717a] disabled:opacity-50"
                        />
                        {chatError && <p className="font-sans text-[13px] text-[#ef4444]">{chatError}</p>}
                        <button
                            disabled={!chatText.trim() || chatBusy}
                            onClick={handleChatSubmit}
                            className="w-full py-[14px] rounded-full bg-[#fafafa] text-[#09090b] font-display font-bold text-[15px] disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            {chatBusy ? 'Thinking...' : 'Plan This Day'}
                        </button>
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
                            onClick={() => { onSetNote(noteText.trim()); onClose(); }}
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
