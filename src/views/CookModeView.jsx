import React, { useState, useEffect, useRef } from 'react';
import { useView } from '../context/ViewContext';
import { ArrowLeft, Check, ChevronRight, ChevronLeft, Minus, Plus, ListChecks, Timer as TimerIcon } from 'lucide-react';
import { normalizeIngredient, getServingsRatio } from '../lib/consolidateIngredients';
import { Button, IconButton } from '../components/ui/Button';
import { TicketCard } from '../components/ui/TicketCard';
import { Sheet } from '../components/ui/Sheet';

export function CookModeView() {
    const { setCurrentView, VIEWS, viewData } = useView();
    const [activeStep, setActiveStep] = useState(0);
    const [showIngredients, setShowIngredients] = useState(false);
    const [showTimer, setShowTimer] = useState(false);

    const recipe = viewData || {
        title: "Quick Cook Session",
        time: "N/A",
        instructions: ["No recipe data loaded. Please return to dashboard and select a meal."]
    };

    const [servings, setServings] = useState(recipe.baseServings || recipe.servings || 2);

    let stepsToRender = [];
    if (Array.isArray(recipe.instructions) && recipe.instructions.length > 0) {
        stepsToRender = recipe.instructions;
    } else if (Array.isArray(recipe.steps) && recipe.steps.length > 0) {
        stepsToRender = recipe.steps;
    } else {
        stepsToRender = ["Cook and enjoy! (No detailed steps provided)"];
    }

    const progress = ((activeStep + 1) / stepsToRender.length) * 100;
    const ratio = getServingsRatio(recipe, servings);
    const scaledIngredients = (recipe.ingredients || []).map(normalizeIngredient);
    const isLastStep = activeStep === stepsToRender.length - 1;

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
                        {stepsToRender[activeStep]}
                    </p>
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
                        } else {
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
        </div>
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
                    const scaledQty = ing.quantity != null ? Math.round(ing.quantity * ratio * 10) / 10 : null;
                    return (
                        <div key={idx} className="list-row">
                            <span className="flex-1 t-body text-ink">{ing.name}</span>
                            {scaledQty != null && (
                                <span className="t-mono text-xs text-inkDim">{scaledQty}{ing.unit ?? ''}</span>
                            )}
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
