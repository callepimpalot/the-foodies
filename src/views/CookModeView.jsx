import React, { useState, useEffect, useRef } from 'react';
import { useView } from '../context/ViewContext';
import { ArrowLeft, Check, ChevronRight, ChevronLeft, Minus, Plus, ListChecks, Timer as TimerIcon, X } from 'lucide-react';
import { normalizeIngredient, getServingsRatio } from '../lib/consolidateIngredients';

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

    return (
        <div className="fixed inset-0 z-50 bg-zinc-950/90 backdrop-blur-xl text-zinc-50 flex flex-col h-[100dvh]">
            {/* Header / Progress */}
            <div className="fixed top-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-10">
                <button
                    onClick={() => setCurrentView(VIEWS.DASHBOARD)}
                    className="p-3 bg-zinc-900/50 backdrop-blur-md rounded-full text-zinc-400 hover:text-white transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
                <div className="flex flex-col items-end">
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Step {activeStep + 1} of {stepsToRender.length}</span>
                    <h3 className="text-sm font-bold tracking-tight">{recipe.title}</h3>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="absolute top-0 left-0 h-1 bg-zinc-800 w-full">
                <div
                    className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Utility row: servings + ingredients + timer */}
            <div className="fixed top-[76px] left-0 right-0 px-6 flex items-center justify-between gap-3 z-10">
                <div className="flex items-center gap-2 bg-zinc-900/70 backdrop-blur-md rounded-full px-3 py-1.5">
                    <button onClick={() => setServings(s => Math.max(1, s - 1))} className="text-zinc-400 hover:text-white p-1">
                        <Minus size={14} strokeWidth={2} />
                    </button>
                    <span className="text-xs font-bold text-zinc-200 w-[70px] text-center">{servings} servings</span>
                    <button onClick={() => setServings(s => Math.min(20, s + 1))} className="text-zinc-400 hover:text-white p-1">
                        <Plus size={14} strokeWidth={2} />
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowIngredients(true)}
                        className="p-2.5 bg-zinc-900/70 backdrop-blur-md rounded-full text-zinc-400 hover:text-white"
                    >
                        <ListChecks size={16} strokeWidth={1.75} />
                    </button>
                    <button
                        onClick={() => setShowTimer(true)}
                        className="p-2.5 bg-zinc-900/70 backdrop-blur-md rounded-full text-zinc-400 hover:text-white"
                    >
                        <TimerIcon size={16} strokeWidth={1.75} />
                    </button>
                </div>
            </div>

            {/* Main Content - Centered Text */}
            <div className="flex-1 flex items-center justify-center p-8 relative">
                <div className="max-w-2xl w-full animate-fade-in-up text-center">
                    <h1 className="text-5xl md:text-6xl font-bold leading-tight tracking-tight mb-8 text-zinc-50">
                        {stepsToRender[activeStep]}
                    </h1>
                </div>
            </div>

            {/* Controls - Thumb Friendly Bottom Bar */}
            <div className="p-6 pb-12 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800/50 flex gap-4 items-center justify-between">
                <button
                    disabled={activeStep === 0}
                    onClick={() => setActiveStep(p => Math.max(0, p - 1))}
                    className={`flex-1 p-6 rounded-3xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-95 ${activeStep === 0
                        ? 'bg-zinc-900 text-zinc-600 opacity-50'
                        : 'bg-zinc-900 text-zinc-50 hover:bg-zinc-800'
                        }`}
                >
                    <ChevronLeft size={24} /> Back
                </button>

                <button
                    onClick={() => {
                        if (activeStep < stepsToRender.length - 1) {
                            setActiveStep(p => p + 1);
                        } else {
                            setCurrentView(VIEWS.DASHBOARD);
                        }
                    }}
                    className={`flex-[2] p-6 rounded-3xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg ${activeStep === stepsToRender.length - 1
                        ? 'bg-zinc-100 text-zinc-900 hover:bg-white shadow-white/10'
                        : 'bg-zinc-800 text-zinc-50 hover:bg-zinc-700 shadow-black/20'
                        }`}
                >
                    {activeStep === stepsToRender.length - 1 ? (
                        <>Finish Cooking <Check size={24} /></>
                    ) : (
                        <>Next Step <ChevronRight size={24} /></>
                    )}
                </button>
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
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full max-w-[500px] max-h-[70vh] overflow-y-auto bg-zinc-900 border-t border-zinc-800 rounded-t-[24px] p-6 pb-10 flex flex-col gap-3"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-zinc-50">Ingredients</h3>
                    <button onClick={onClose} className="text-zinc-500"><X size={20} /></button>
                </div>
                {ingredients.length === 0 && (
                    <p className="text-zinc-500 text-sm">No ingredients listed for this recipe.</p>
                )}
                {ingredients.map((ing, idx) => {
                    const scaledQty = ing.quantity != null ? Math.round(ing.quantity * ratio * 10) / 10 : null;
                    return (
                        <div key={idx} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                            <span className="text-zinc-200 text-sm">{ing.name}</span>
                            {scaledQty != null && (
                                <span className="text-zinc-500 text-xs font-mono">{scaledQty}{ing.unit ?? ''}</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
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
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full max-w-[500px] bg-zinc-900 border-t border-zinc-800 rounded-t-[24px] p-6 pb-10 flex flex-col items-center gap-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between w-full">
                    <h3 className="text-lg font-bold text-zinc-50">Timer</h3>
                    <button onClick={onClose} className="text-zinc-500"><X size={20} /></button>
                </div>

                {totalSeconds == null ? (
                    <div className="flex gap-3 flex-wrap justify-center">
                        {TIMER_PRESETS.map((m) => (
                            <button
                                key={m}
                                onClick={() => start(m)}
                                className="px-5 py-3 rounded-full bg-zinc-800 text-zinc-200 font-bold text-sm hover:bg-zinc-700"
                            >
                                {m} min
                            </button>
                        ))}
                    </div>
                ) : (
                    <>
                        <div className={`text-6xl font-black tabular-nums ${isDone ? 'text-emerald-400' : 'text-zinc-50'}`}>
                            {mm}:{ss}
                        </div>
                        {isDone ? (
                            <p className="text-emerald-400 font-bold text-sm">Time's up!</p>
                        ) : null}
                        <button
                            onClick={cancel}
                            className="px-6 py-3 rounded-full bg-zinc-800 text-zinc-400 font-medium text-sm hover:bg-zinc-700"
                        >
                            Cancel
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
