import React, { useState, useRef, useEffect } from 'react';
import { Lock, Unlock, RotateCcw, StickyNote, Utensils, Sparkles, BookOpen, ArrowLeftRight, RefreshCw, Plus, MessageSquarePlus, Mic } from 'lucide-react';
import { usePlan } from '../context/PlanContext';
import { useRecipes } from '../hooks/useRecipes';
import { useWeekPlanChat } from '../hooks/useWeekPlanChat';
import { useDishCuration } from '../hooks/useDishCuration';
import { saveRecipe } from '../lib/saveRecipe';
import { RecipeSelector } from './RecipeSelector';
import { RecipeDaySheet } from './RecipeDaySheet';
import { DishCurationFlow } from './DishCurationFlow';
import { Sheet } from './ui/Sheet';
import { Button } from './ui/Button';

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

// Feature-detected once at module load — Safari desktop has no implementation at all, so the mic
// button only renders where dictation can actually work rather than showing a dead control.
const SpeechRecognitionCtor = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

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
export function WeekPlanChat({ onApplied, onProposalChange }) {
    const { weeklyPlan, setDayRecipe, setDayLeftover, setDayNote, updateServings } = usePlan();
    const { recipes } = useRecipes();
    const [scopeDates] = useState(buildScopeDates);
    const hasExisting = scopeDates.some((d) => weeklyPlan?.[d]);
    const [acknowledged, setAcknowledged] = useState(!hasExisting);
    const {
        status, error, days, chatLog, send, sendSingleDay, toggleLock, swapDays,
        setLeftoverSource, setDayAsLibraryRecipe, setDayAsLeftover, setDayAsNote,
        setDayRecipeCustomization, seedFromDishes, addDay, nextAddableDate, reset,
    } = useWeekPlanChat(scopeDates);
    const curation = useDishCuration();
    const seededRef = useRef(false);
    const [message, setMessage] = useState('');
    const [applying, setApplying] = useState(false);
    const [applyError, setApplyError] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null); // date "picked up," awaiting a second tap to swap with
    const [editingDate, setEditingDate] = useState(null); // date whose empty-day action sheet is open
    const [inspectingDate, setInspectingDate] = useState(null); // date whose recipe detail sheet is open
    const [isRecording, setIsRecording] = useState(false);
    const [showFullHistory, setShowFullHistory] = useState(false);
    const [showComposerSheet, setShowComposerSheet] = useState(false);
    const recognitionRef = useRef(null);
    const textareaRef = useRef(null);

    // Stop any in-flight dictation if the user navigates away mid-recording.
    useEffect(() => () => recognitionRef.current?.stop(), []);

    // Lets PlanView shrink its own static header once a proposal exists — on a phone, a big fixed
    // title plus a full chat transcript plus the composer left almost no room for the day list
    // itself, the thing actually being planned.
    useEffect(() => {
        onProposalChange?.(days.length > 0);
    }, [days.length, onProposalChange]);

    // Hands the curated dish pool (Phase 1) off to the existing placement machinery (Phase 2) the
    // moment curation finishes — guarded by a ref, not just "phase === 'done'", because seedFromDishes
    // isn't memoized and would otherwise re-run (wiping out any swap/lock/edit already made in
    // placement) on every unrelated re-render while phase stays 'done'.
    useEffect(() => {
        if (curation.phase === 'done' && !seededRef.current) {
            seededRef.current = true;
            seedFromDishes(curation.acceptedDishes, scopeDates);
        }
    }, [curation.phase, curation.acceptedDishes, scopeDates, seedFromDishes]);

    // Auto-grows with what's typed or dictated instead of a fixed 3-row box that's either cramped
    // for a full week's description or wastes space when there's nothing in it yet.
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [message]);

    // Talk the week in instead of typing it — dictates into whatever's already in the field rather
    // than replacing it, so a mic tap can top up a partially-typed message. Interim (not-yet-final)
    // results are shown live so the field doesn't sit blank while speaking.
    const handleMicClick = () => {
        if (!SpeechRecognitionCtor) return;
        if (isRecording) {
            recognitionRef.current?.stop();
            return;
        }
        const recognition = new SpeechRecognitionCtor();
        recognition.lang = 'en-US';
        recognition.interimResults = true;
        recognition.continuous = true;
        const base = message.trim() ? `${message.trim()} ` : '';
        let finalTranscript = base;
        recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) finalTranscript += `${transcript} `;
                else interim += transcript;
            }
            setMessage((finalTranscript + interim).trim());
        };
        recognition.onerror = () => setIsRecording(false);
        recognition.onend = () => setIsRecording(false);
        recognitionRef.current = recognition;
        recognition.start();
        setIsRecording(true);
    };

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
        setShowComposerSheet(false);
    };

    const handleRestart = () => {
        reset();
        curation.reset();
        seededRef.current = false;
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
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
                <p className="t-heading-sm italic" style={{ color: 'var(--chalk)' }}>
                    Some days this week are already planned.
                </p>
                <p className="t-body" style={{ color: 'var(--chalk-dim)', maxWidth: '260px' }}>
                    Continuing may replace what's already on those days once you apply a chat plan.
                </p>
                <Button variant="primary" onClick={() => setAcknowledged(true)}>
                    Continue anyway
                </Button>
            </div>
        );
    }

    if (curation.phase !== 'done') {
        return <DishCurationFlow curation={curation} recipes={recipes} libraryShortlist={libraryShortlist} />;
    }

    // Once a proposal exists, only the latest exchange is shown by default — re-reading a growing
    // transcript isn't the point once there are days to actually look at and act on; the full
    // history is one tap away instead of permanently eating space above the thing being planned.
    const visibleChatLog = days.length > 0 && !showFullHistory ? chatLog.slice(-1) : chatLog;
    const hiddenHistoryCount = days.length > 0 && !showFullHistory ? chatLog.length - visibleChatLog.length : 0;

    return (
        <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 relative min-h-0">
            <div className="h-full overflow-y-auto flex flex-col gap-4 pb-4">
                {hiddenHistoryCount > 0 && (
                    <button
                        onClick={() => setShowFullHistory(true)}
                        className="self-start transition-colors"
                        style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--f-body)', fontSize: '11px' }}
                    >
                        Show {hiddenHistoryCount} earlier {hiddenHistoryCount === 1 ? 'change' : 'changes'}
                    </button>
                )}

                {visibleChatLog.map((entry, idx) => (
                    <div key={idx} className="flex flex-col gap-[2px]">
                        <span className="t-body" style={{ color: 'var(--chalk)' }}>"{entry?.instruction}"</span>
                        <span className="t-body italic" style={{ color: 'var(--grease)', fontSize: '12px' }}>{entry?.summary}</span>
                    </div>
                ))}

                {status === 'planning' && (
                    <p className="t-body italic animate-pulse" style={{ color: 'var(--chalk-dim)' }}>Planning your week...</p>
                )}

                {error && <p className="t-body" style={{ color: 'var(--destructive)', fontSize: '13px' }}>{error}</p>}

                {days.length > 0 && (
                    <div className="flex flex-col gap-2 mt-2">
                        <div className="flex items-center justify-between -mb-[2px]">
                            <p className="t-body" style={{ color: 'var(--chalk-dim)', fontSize: '11px' }}>
                                Tap a day's swap icon, then tap another to swap them.
                            </p>
                            <button
                                onClick={handleRestart}
                                className="flex items-center gap-1 transition-colors shrink-0"
                                style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--f-body)', fontSize: '11px' }}
                            >
                                <RefreshCw size={11} strokeWidth={1.5} /> Start over
                            </button>
                        </div>

                        <div className="flex flex-col gap-3">
                            {days.map((day) => (
                                <DayCard
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
                        </div>

                        {nextAddableDate && (
                            <button
                                onClick={addDay}
                                className="w-full flex items-center justify-center gap-2 p-3 rounded-md border border-dashed border-line transition-colors"
                                style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--f-body)', fontSize: '13px' }}
                            >
                                <Plus size={14} strokeWidth={1.5} />
                                Add {new Date(nextAddableDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Signals "scroll for more" instead of the list looking like it just stops mid-row —
                a purely-static-height container gave no visual cue that content continued below. */}
            <div
                className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
                style={{ background: 'linear-gradient(to bottom, transparent, var(--board))' }}
            />
            </div>

            <div className="pt-3 pb-4 flex flex-col gap-[10px] border-t border-line">
                {applyError && <p className="t-body text-center" style={{ color: 'var(--destructive)', fontSize: '13px' }}>{applyError}</p>}

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setShowComposerSheet(true)}
                        aria-label="Ask for changes"
                        className="flex items-center justify-center shrink-0 transition-colors"
                        style={{ width: '52px', height: '52px', borderRadius: 'var(--r-sm)', background: 'var(--board-2)', border: '1px solid var(--line)', color: 'var(--grease)' }}
                    >
                        <MessageSquarePlus size={20} strokeWidth={1.5} />
                    </button>
                    {days.length > 0 && (
                        <Button
                            variant="primary"
                            onClick={handleApply}
                            disabled={applying}
                            className="flex-1 disabled:opacity-40 disabled:cursor-not-allowed transition-transform active:scale-[0.98]"
                        >
                            {applying ? 'Applying...' : 'Apply to Plan'}
                        </Button>
                    )}
                </div>
            </div>

            {showComposerSheet && (
                <Sheet title="Ask for changes" onClose={() => { setShowComposerSheet(false); if (isRecording) recognitionRef.current?.stop(); }} surface="board">
                    <div className="flex flex-col gap-3">
                        <p className="t-body" style={{ color: 'var(--chalk-dim)', fontSize: '12px' }}>
                            Only unlocked days will change.
                        </p>
                        <div className="relative">
                            <textarea
                                ref={textareaRef}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder="Ask for changes to unlocked days..."
                                disabled={status === 'planning'}
                                rows={3}
                                autoFocus
                                className="input w-full resize-none disabled:opacity-50"
                                style={{
                                    maxHeight: '160px',
                                    overflowY: 'auto',
                                    paddingRight: SpeechRecognitionCtor ? '56px' : undefined,
                                }}
                            />
                            {SpeechRecognitionCtor && (
                                <button
                                    type="button"
                                    onClick={handleMicClick}
                                    disabled={status === 'planning'}
                                    aria-label={isRecording ? 'Stop dictation' : 'Dictate your week'}
                                    className="absolute right-[6px] bottom-[6px] w-[44px] h-[44px] rounded-sm flex items-center justify-center transition-colors disabled:opacity-30"
                                    style={{
                                        background: isRecording ? 'var(--stamp)' : 'var(--board-2)',
                                        color: isRecording ? 'var(--ticket)' : 'var(--chalk-dim)',
                                    }}
                                >
                                    <Mic size={18} strokeWidth={1.5} className={isRecording ? 'animate-pulse' : ''} />
                                </button>
                            )}
                        </div>

                        {isRecording && (
                            <p className="t-body italic" style={{ color: 'var(--stamp)', fontSize: '12px' }}>
                                Listening — tap the mic again to stop.
                            </p>
                        )}

                        {error && <p className="t-body" style={{ color: 'var(--destructive)', fontSize: '13px' }}>{error}</p>}

                        <Button
                            variant="primary"
                            onClick={handleSend}
                            disabled={status === 'planning' || !message.trim()}
                            className="w-full disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            {status === 'planning' ? 'Thinking...' : 'Send'}
                        </Button>
                    </div>
                </Sheet>
            )}

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

// A day's hero photo — library recipes always have one (real upload or a deterministic Unsplash
// fallback, per useRecipes.js's mapRow), AI-generated dishes usually don't since there's no image
// generation step, and a leftover day borrows its source day's photo so it visually reads as
// "the same dish, again" rather than a blank slot.
function resolveDayImage(day, days, recipes) {
    if (!day) return null;
    if (day.type === 'recipe') {
        if (day.source === 'library') return day.recipeOverride?.image_url ?? recipes?.find((r) => r.id === day.recipeId)?.image_url ?? null;
        return day.recipe?.image_url ?? null;
    }
    if (day.type === 'leftover') {
        const sourceDay = days?.find((d) => d.date === day.sourceDate);
        return sourceDay ? resolveDayImage(sourceDay, days, recipes) : null;
    }
    return null;
}

// Each day is its own photo-forward card — the hero image fills the top of the card with the
// title on a gradient scrim (RecipeCard.jsx's pattern), rather than a text-only row, so a planned
// week reads as a set of dishes worth looking forward to rather than a list of labels. Lock sits
// above the swap-pickup icon in a fixed top-right stack; tapping swap "picks up" the card (a
// shake animation makes that state legible) awaiting a second tap on another day to complete it.
function DayCard({ day, days, recipes, onToggleLock, onChangeSource, onEditEmpty, onInspectRecipe, isSelected, onGripTap }) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const [imageError, setImageError] = useState(false);
    const dayLabel = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    let title = null;
    let badge = null;
    let FallbackIcon = Utensils;
    const isLeftover = day.type === 'leftover';
    const isEmpty = day.type === 'empty';
    const isRecipe = day.type === 'recipe';

    if (isRecipe) {
        FallbackIcon = Utensils;
        title = resolveDayTitle(day, recipes);
        badge = day.source === 'library'
            ? { label: 'Library', icon: BookOpen }
            : { label: 'New idea', icon: Sparkles };
    } else if (isLeftover) {
        FallbackIcon = RotateCcw;
        const sourceDay = days?.find((d) => d.date === day.sourceDate);
        const sourceLabel = day.sourceDate
            ? new Date(day.sourceDate).toLocaleDateString('en-US', { weekday: 'short' })
            : 'another day';
        title = sourceDay ? resolveDayTitle(sourceDay, recipes) : `Leftovers from ${sourceLabel}`;
        badge = { label: `Leftovers · ${sourceLabel}`, icon: RotateCcw };
    } else if (day.type === 'note') {
        FallbackIcon = StickyNote;
        title = day.note || 'Note';
    } else if (isEmpty) {
        FallbackIcon = Plus;
        title = 'No meal planned';
    }

    const image = resolveDayImage(day, days, recipes);
    const hasImage = !isEmpty && !!image && !imageError;

    // Only earlier recipe days can be a leftover's source — you can't have leftovers of a meal
    // that hasn't been cooked yet within this proposal.
    const sourceCandidates = isLeftover
        ? (days ?? []).filter((d) => d.type === 'recipe' && d.date < day.date)
        : [];
    const isCardClickable = sourceCandidates.length > 0 || isEmpty || isRecipe;
    const handleCardClick = () => {
        if (sourceCandidates.length > 0) setPickerOpen((v) => !v);
        else if (isEmpty) onEditEmpty?.();
        else if (isRecipe) onInspectRecipe?.();
    };

    return (
        <div
            className={isSelected ? 'shake-pending' : ''}
            style={{
                borderRadius: 'var(--r-lg)',
                overflow: 'hidden',
                border: `1px solid ${isSelected ? 'var(--grease)' : 'var(--line)'}`,
                background: 'var(--board-2)',
            }}
        >
            <div
                className={`relative w-full ${isCardClickable ? 'cursor-pointer' : ''}`}
                style={{ aspectRatio: '16/9' }}
                onClick={handleCardClick}
            >
                {hasImage ? (
                    <>
                        <img
                            src={image}
                            alt={title}
                            onError={() => setImageError(true)}
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div
                            className="absolute inset-0"
                            style={{ background: 'linear-gradient(to top, rgba(20,33,27,0.85), transparent 55%)' }}
                        />
                    </>
                ) : (
                    <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                            background: isEmpty
                                ? 'var(--board-2)'
                                : 'linear-gradient(160deg, var(--board-2), var(--board))',
                            border: isEmpty ? '1px dashed var(--line)' : 'none',
                        }}
                    >
                        <FallbackIcon size={28} strokeWidth={1.5} style={{ color: 'var(--chalk-dim)', opacity: isEmpty ? 0.6 : 0.5 }} />
                    </div>
                )}

                {/* Day label, top-left */}
                <span
                    className="t-eyebrow absolute top-3 left-3"
                    style={{
                        padding: '4px 9px',
                        borderRadius: 'var(--r-xs)',
                        background: 'rgba(20,33,27,0.65)',
                        border: '1px solid var(--line)',
                        color: 'var(--chalk)',
                    }}
                >
                    {dayLabel}
                </span>

                {/* Lock (top) + swap-pickup (below it), top-right — fixed-size icon stack regardless
                    of card width or photo content. */}
                <div className="absolute top-3 right-3 flex flex-col items-center gap-[6px]">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
                        aria-label={day.locked ? 'Unlock this day' : 'Lock this day'}
                        className="flex items-center justify-center shrink-0"
                        style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: 'rgba(20,33,27,0.65)', border: '1px solid var(--line)',
                            color: day.locked ? 'var(--done)' : 'var(--chalk)',
                        }}
                    >
                        {day.locked ? <Lock size={14} strokeWidth={1.5} /> : <Unlock size={14} strokeWidth={1.5} />}
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onGripTap(); }}
                        aria-label={isSelected ? 'Cancel swap' : 'Pick up to swap with another day'}
                        className="flex items-center justify-center shrink-0"
                        style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: isSelected ? 'var(--grease)' : 'rgba(20,33,27,0.65)',
                            border: '1px solid var(--line)',
                            color: isSelected ? 'var(--board)' : 'var(--chalk)',
                        }}
                    >
                        <ArrowLeftRight size={14} strokeWidth={1.5} />
                    </button>
                </div>

                {/* Title (+ badge above it), bottom, on the scrim — never truncated, wraps instead. */}
                <div className="absolute bottom-3 left-3 right-3 flex flex-col gap-1">
                    {badge && (
                        <span
                            className="t-eyebrow self-start"
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '3px 8px',
                                borderRadius: 'var(--r-xs)',
                                background: 'rgba(20,33,27,0.65)',
                                border: '1px solid var(--line)',
                                color: 'var(--chalk)',
                            }}
                        >
                            <badge.icon size={9} strokeWidth={2} /> {badge.label}
                        </span>
                    )}
                    <h3
                        className="t-heading-sm leading-tight"
                        style={{ color: 'var(--chalk)', fontStyle: isEmpty ? 'italic' : 'normal' }}
                    >
                        {title}
                    </h3>
                </div>
            </div>

            {pickerOpen && (
                <div
                    className="overflow-hidden"
                    style={{ borderTop: '1px solid var(--line)', background: 'var(--board)' }}
                >
                    {sourceCandidates.map((c) => (
                        <button
                            key={c.date}
                            onClick={(e) => { e.stopPropagation(); onChangeSource(c.date); setPickerOpen(false); }}
                            className="w-full text-left px-3 py-[10px] t-body border-b last:border-b-0"
                            style={{ color: 'var(--chalk)', borderColor: 'var(--line)' }}
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
        <Sheet title={dayLabel} onClose={onClose} surface="board">
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
                <div className="flex flex-col gap-2">
                    {leftoverCandidates.map((c) => (
                        <button
                            key={c.date}
                            onClick={() => { onSetLeftover(c.date); onClose(); }}
                            className="text-left p-3 rounded-md bg-board border border-line hover:border-chalkDim transition-colors"
                        >
                            <div className="t-body" style={{ color: 'var(--chalk)' }}>
                                {new Date(c.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                            </div>
                            <div className="t-body" style={{ color: 'var(--chalk-dim)', fontSize: '12px' }}>{resolveDayTitle(c, recipes)}</div>
                        </button>
                    ))}
                </div>
            )}

            {step === 'chat' && (
                <div className="flex flex-col gap-3">
                    <p className="t-body" style={{ color: 'var(--chalk-dim)', fontSize: '12px' }}>
                        Only this day will change — every other day stays exactly as it is.
                    </p>
                    <input
                        autoFocus
                        value={chatText}
                        onChange={(e) => setChatText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleChatSubmit(); }}
                        placeholder="e.g. add a spicy meal"
                        disabled={chatBusy}
                        className="input w-full disabled:opacity-50"
                    />
                    {chatError && <p className="t-body" style={{ color: 'var(--destructive)', fontSize: '13px' }}>{chatError}</p>}
                    <Button
                        variant="primary"
                        disabled={!chatText.trim() || chatBusy}
                        onClick={handleChatSubmit}
                        className="w-full disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        {chatBusy ? 'Thinking...' : 'Plan This Day'}
                    </Button>
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
                        onClick={() => { onSetNote(noteText.trim()); onClose(); }}
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
