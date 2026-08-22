import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useView } from '../context/ViewContext';
import { ArrowLeft, Check, ChevronRight, ChevronLeft, Minus, Plus, ListChecks, Timer as TimerIcon, Zap, ZapOff } from 'lucide-react';
import { normalizeIngredient, getServingsRatio, formatMeasure } from '../lib/consolidateIngredients';
import { buildStepIngredients, stepText } from '../lib/stepIngredients';
import { RATINGS, saveFeedback, canReceiveFeedback } from '../lib/cookFeedback';
import { Button, IconButton } from '../components/ui/Button';
import { TicketCard } from '../components/ui/TicketCard';
import { Sheet } from '../components/ui/Sheet';
import { useWakeLock } from '../hooks/useWakeLock';

export function CookModeView() {
    const { setCurrentView, VIEWS, viewData } = useView();
    const [activeStep, setActiveStep] = useState(0);
    const [showIngredients, setShowIngredients] = useState(false);
    const [showTimer, setShowTimer] = useState(false);
    // Shown once at the end of a cook, then never again for this session — whether it
    // was answered or skipped. A prompt that reappears trains you to dismiss it, which
    // produces worse data than no prompt at all.
    const [showFeedback, setShowFeedback] = useState(false);
    const [feedbackDone, setFeedbackDone] = useState(false);
    const { isActive: isWakeLockActive, isSupported: isWakeLockSupported } = useWakeLock();

    // Memoised because the fallback is an object literal: without this it is a new
    // object on every render, and the step-ingredient resolution below would re-run
    // on every timer tick.
    const recipe = useMemo(() => viewData || {
        title: "Quick Cook Session",
        time: "N/A",
        instructions: ["No recipe data loaded. Please return to dashboard and select a meal."]
    }, [viewData]);

    const [servings, setServings] = useState(recipe.baseServings || recipe.servings || 2);

    const stepsToRender = useMemo(() => {
        if (Array.isArray(recipe.instructions) && recipe.instructions.length > 0) return recipe.instructions;
        if (Array.isArray(recipe.steps) && recipe.steps.length > 0) return recipe.steps;
        return ["Cook and enjoy! (No detailed steps provided)"];
    }, [recipe]);

    const progress = ((activeStep + 1) / stepsToRender.length) * 100;
    const ratio = getServingsRatio(recipe, servings);
    const scaledIngredients = (recipe.ingredients || []).map(normalizeIngredient);
    const isLastStep = activeStep === stepsToRender.length - 1;

    // Which ingredients each step needs (TASK_10). Resolved once for the whole recipe
    // rather than per render, since it does not depend on the servings stepper — only
    // the displayed quantities do.
    const stepIngredients = useMemo(
        () => buildStepIngredients(recipe, stepsToRender),
        [recipe, stepsToRender]
    );
    const activeStepIngredients = stepIngredients?.[activeStep] ?? [];

    return (
        <div className="fixed inset-0 z-50 bg-board text-chalk flex flex-col h-[100dvh]">
            {/* Progress Bar */}
            <div className="fixed top-0 left-0 right-0 h-1 bg-line z-20">
                <div
                    className="h-full bg-grease transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Header */}
            <div className="fixed top-0 left-0 right-0 pt-6 px-6 pb-16 flex justify-between items-start bg-gradient-to-b from-board via-board/80 to-transparent z-10">
                <IconButton onClick={() => setCurrentView(VIEWS.DASHBOARD)} aria-label="Back to dashboard">
                    <ArrowLeft size={20} strokeWidth={1.75} />
                </IconButton>
                <div className="flex flex-col items-end gap-1">
                    <span className="t-eyebrow text-chalkDim">Step {activeStep + 1} of {stepsToRender.length}</span>
                    <h3 className="t-heading-sm text-chalk text-right">{recipe.title}</h3>
                    <div
                        className={`flex items-center gap-1.5 ${isWakeLockActive ? 'text-chalk' : 'text-chalkDim'}`}
                        title={
                            !isWakeLockSupported
                                ? 'Wake lock not supported on this browser'
                                : isWakeLockActive
                                    ? 'Screen is being held awake'
                                    : 'Wake lock unavailable right now'
                        }
                    >
                        <span className="t-eyebrow">
                            {isWakeLockActive ? 'Screen awake' : 'Screen may sleep'}
                        </span>
                        {isWakeLockActive ? (
                            <Zap size={14} strokeWidth={1.75} />
                        ) : (
                            <ZapOff size={14} strokeWidth={1.75} />
                        )}
                    </div>
                </div>
            </div>

            {/* Utility row: servings + ingredients + timer */}
            <div className="fixed top-[84px] left-0 right-0 px-6 flex items-center justify-between gap-3 z-10">
                <div className="flex items-center gap-2 bg-board2 border border-line rounded-sm px-3 py-1.5">
                    <button
                        onClick={() => setServings((s) => Math.max(1, s - 1))}
                        className="text-chalkDim hover:text-chalk p-1"
                        aria-label="Decrease servings"
                    >
                        <Minus size={14} strokeWidth={2} />
                    </button>
                    <span className="text-xs text-chalk w-[74px] text-center">
                        <span className="t-mono">{servings}</span> servings
                    </span>
                    <button
                        onClick={() => setServings((s) => Math.min(20, s + 1))}
                        className="text-chalkDim hover:text-chalk p-1"
                        aria-label="Increase servings"
                    >
                        <Plus size={14} strokeWidth={2} />
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <IconButton onClick={() => setShowIngredients(true)} aria-label="Show ingredients">
                        <ListChecks size={16} strokeWidth={1.75} />
                    </IconButton>
                    <IconButton onClick={() => setShowTimer(true)} aria-label="Show timer">
                        <TimerIcon size={16} strokeWidth={1.75} />
                    </IconButton>
                </div>
            </div>

            {/* Main Content — current step on a ticket card */}
            <div className="flex-1 flex items-center justify-center px-6 pt-[160px] pb-[168px]">
                <TicketCard
                    torn
                    eyebrow={`Step ${activeStep + 1} of ${stepsToRender.length}`}
                    className="w-full max-w-2xl text-center animate-fade-in"
                >
                    <p className="font-head font-bold text-ink text-[26px] md:text-[34px] leading-snug">
                        {stepText(stepsToRender[activeStep])}
                    </p>

                    {/* What this step needs (TASK_10). An ASSIST, never a replacement —
                        the full list stays one tap away behind the list icon above, so a
                        wrong or partial match is a glance, not a blocked recipe. A step
                        with no matches renders nothing at all: no empty box, no label. */}
                    {activeStepIngredients.length > 0 && (
                        <div className="mt-5 pt-5 border-t border-dashed border-ticketShadow">
                            <span className="t-eyebrow text-inkDim">For this step</span>
                            <ul className="mt-3 flex flex-wrap justify-center gap-2">
                                {activeStepIngredients.map((ing) => {
                                    const amount = ing?.quantity != null
                                        ? formatMeasure(ing.quantity * ratio, ing.unit)
                                        : '';
                                    return (
                                        <li
                                            key={ing.index}
                                            className="flex items-baseline gap-2 rounded-xs bg-ticket2 px-3 py-2"
                                        >
                                            <span className="t-body text-ink">{ing.name}</span>
                                            {amount && (
                                                <span className="t-mono text-xs text-inkDim">{amount}</span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </TicketCard>
            </div>

            {/* Controls — thumb-friendly bottom bar */}
            <div
                className="fixed bottom-0 left-0 right-0 p-6 bg-board2 border-t border-line flex gap-4 items-center justify-between z-10"
                style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}
            >
                <Button
                    variant="secondary"
                    disabled={activeStep === 0}
                    onClick={() => setActiveStep((p) => Math.max(0, p - 1))}
                    className={`flex-1 flex items-center justify-center gap-2 ${activeStep === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                    <ChevronLeft size={20} strokeWidth={1.75} /> Back
                </Button>

                <Button
                    variant="primary"
                    onClick={() => {
                        if (!isLastStep) {
                            setActiveStep((p) => p + 1);
                        } else if (!feedbackDone && canReceiveFeedback(recipe)) {
                            setShowFeedback(true);
                        } else {
                            // Already rated or skipped, or a recipe with no Supabase row to
                            // attach feedback to (the local final_recipes.json fallback has no
                            // ids) — finish exactly as Cook Mode always did.
                            setCurrentView(VIEWS.DASHBOARD);
                        }
                    }}
                    className="flex-[2] flex items-center justify-center gap-2"
                >
                    {isLastStep ? (
                        <>Finish Cooking <Check size={20} strokeWidth={1.75} /></>
                    ) : (
                        <>Next Step <ChevronRight size={20} strokeWidth={1.75} /></>
                    )}
                </Button>
            </div>

            {showIngredients && (
                <IngredientsSheet
                    ingredients={scaledIngredients}
                    ratio={ratio}
                    onClose={() => setShowIngredients(false)}
                />
            )}

            {showTimer && <TimerSheet onClose={() => setShowTimer(false)} />}

            {showFeedback && (
                <CookFeedbackSheet
                    recipe={recipe}
                    onDone={() => {
                        setFeedbackDone(true);
                        setShowFeedback(false);
                        setCurrentView(VIEWS.DASHBOARD);
                    }}
                />
            )}
        </div>
    );
}

// The one capture point for the taste model. Rating is the only required tap; the note
// is genuinely optional, with no validation.
//
// SKIPPING WRITES NOTHING. Not a row with a null rating — literally no row. A null
// would eventually get read as a signal, and "I couldn't be bothered tonight" is not
// the same as "I didn't like it".
function CookFeedbackSheet({ recipe, onDone }) {
    const [rating, setRating] = useState(null);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const submit = async (chosen) => {
        setSaving(true);
        setError(null);
        try {
            await saveFeedback({ recipeId: recipe?.id, rating: chosen, note });
            onDone();
        } catch (err) {
            console.error('Could not save cook feedback:', err);
            setError(err?.message || "Couldn't save that rating. Your meal still counts.");
            setSaving(false);
        }
    };

    return (
        <Sheet onClose={onDone} title="How was it?" surface="ticket">
            <div className="flex flex-col gap-4 pb-2">
                <p className="t-body text-inkDim">{recipe?.title}</p>

                <div className="flex flex-col gap-2">
                    {RATINGS.map((option) => (
                        <Button
                            key={option.value}
                            variant={rating === option.value ? 'primary' : 'secondary'}
                            disabled={saving}
                            onClick={() => { setRating(option.value); submit(option.value); }}
                            className="w-full disabled:opacity-40"
                        >
                            {option.label}
                        </Button>
                    ))}
                </div>

                <div className="flex flex-col gap-2">
                    <span className="t-eyebrow text-inkDim">Anything to remember? (optional)</span>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        placeholder="e.g. too salty, kids picked out the mushrooms, double it next time"
                        className="w-full resize-none bg-ticket2 border border-ticketShadow rounded-sm p-3 font-body text-sm text-ink placeholder:text-inkDim focus:outline-none focus:border-stamp"
                    />
                    <p className="t-body text-inkDim text-xs">
                        Write the note first if you want it saved — tapping a rating saves straight away.
                    </p>
                </div>

                {error && <p className="t-body text-[var(--destructive)]">{error}</p>}

                {/* Skipping is exactly as easy as rating, and costs one tap. */}
                <Button variant="ghost" onClick={onDone} disabled={saving} className="w-full">
                    Skip
                </Button>
            </div>
        </Sheet>
    );
}

function IngredientsSheet({ ingredients, ratio, onClose }) {
    return (
        <Sheet onClose={onClose} title="Ingredients" surface="ticket">
            <div className="flex flex-col">
                {ingredients.length === 0 && (
                    <p className="t-body italic text-inkDim text-center py-4">No ingredients listed for this recipe.</p>
                )}
                {ingredients.map((ing, idx) => {
                    // formatMeasure rather than hand-rolled rounding, so the sheet and the
                    // per-step chips read identically ("3 cloves", not "3cloves").
                    const amount = ing.quantity != null ? formatMeasure(ing.quantity * ratio, ing.unit) : '';
                    return (
                        <div key={idx} className="list-row">
                            <span className="flex-1 t-body text-ink">{ing.name}</span>
                            {amount && <span className="t-mono text-xs text-inkDim">{amount}</span>}
                        </div>
                    );
                })}
            </div>
        </Sheet>
    );
}

const TIMER_PRESETS = [1, 5, 10, 15];

function TimerSheet({ onClose }) {
    const [totalSeconds, setTotalSeconds] = useState(null);
    const [remaining, setRemaining] = useState(0);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (totalSeconds == null) return;
        intervalRef.current = setInterval(() => {
            setRemaining((r) => {
                if (r <= 1) {
                    clearInterval(intervalRef.current);
                    return 0;
                }
                return r - 1;
            });
        }, 1000);
        return () => clearInterval(intervalRef.current);
    }, [totalSeconds]);

    const start = (minutes) => {
        setTotalSeconds(minutes * 60);
        setRemaining(minutes * 60);
    };

    const cancel = () => {
        clearInterval(intervalRef.current);
        setTotalSeconds(null);
        setRemaining(0);
    };

    const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
    const ss = String(remaining % 60).padStart(2, '0');
    const isDone = totalSeconds != null && remaining === 0;

    return (
        <Sheet onClose={onClose} title="Timer" surface="ticket">
            <div className="flex flex-col items-center gap-6 py-2">
                {totalSeconds == null ? (
                    <div className="flex gap-3 flex-wrap justify-center">
                        {TIMER_PRESETS.map((m) => (
                            <button
                                key={m}
                                onClick={() => start(m)}
                                className="px-5 py-3 rounded-sm bg-ticket2 text-ink font-semibold text-sm hover:bg-ticketShadow transition-colors"
                            >
                                <span className="t-mono">{m}</span> min
                            </button>
                        ))}
                    </div>
                ) : (
                    <>
                        <div className={`t-mono text-6xl font-bold ${isDone ? 'text-done' : 'text-ink'}`}>
                            {mm}:{ss}
                        </div>
                        {isDone ? (
                            <p className="t-label text-done">Time's up!</p>
                        ) : null}
                        <button
                            onClick={cancel}
                            className="t-label text-inkDim hover:text-ink px-6 py-3"
                        >
                            Cancel
                        </button>
                    </>
                )}
            </div>
        </Sheet>
    );
}
