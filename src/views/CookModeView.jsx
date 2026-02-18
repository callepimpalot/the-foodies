import React, { useState, useEffect } from 'react';
import { useView } from '../context/ViewContext';
import { ArrowLeft, Check, ChevronRight, ChevronLeft, Clock, Timer } from 'lucide-react';

export function CookModeView() {
    const { setCurrentView, VIEWS, viewData } = useView();
    const [activeStep, setActiveStep] = useState(0);

    useEffect(() => {
        console.log("🥘 CookModeView Received:", viewData);
    }, [viewData]);

    // Use passed recipe or fallback to a safety mock (or handle empty state)
    // Use passed recipe or fallback to a safety mock (or handle empty state)
    const recipe = viewData || {
        title: "Quick Cook Session",
        time: "N/A",
        // Fallback if viewData is null
        instructions: ["No recipe data loaded. Please return to dashboard and select a meal."]
    };

    // Normalize steps: Ensure they are an array of strings. 
    // Audit confirmed 'instructions' is the key in Supabase.
    let stepsToRender = [];
    if (Array.isArray(recipe.instructions) && recipe.instructions.length > 0) {
        stepsToRender = recipe.instructions;
    } else if (Array.isArray(recipe.steps) && recipe.steps.length > 0) {
        stepsToRender = recipe.steps;
    } else {
        // Zero-White-Screen Guard: Always provide at least one step
        stepsToRender = ["Cook and enjoy! (No detailed steps provided)"];
    }

    const progress = ((activeStep + 1) / stepsToRender.length) * 100;

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
                            // Finish logic
                            // The calorie parsing logic was moved here as a comment,
                            // If you intended to display this, please place it in the JSX return.
                            // console.log(`Calories: ${Number(recipe.calories) ? Math.round(Number(recipe.calories)) : '450'} kcal`);
                            setCurrentView(VIEWS.DASHBOARD);
                        }
                    }}
                    className={`flex-[2] p-6 rounded-3xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg ${activeStep === stepsToRender.length - 1
                        ? 'bg-zinc-100 text-zinc-900 hover:bg-white shadow-white/10' // Premium Finish Button, High Contrast
                        : 'bg-zinc-800 text-zinc-50 hover:bg-zinc-700 shadow-black/20' // Standard Next Button
                        }`}
                >
                    {activeStep === stepsToRender.length - 1 ? (
                        <>Finish Cooking <Check size={24} /></>
                    ) : (
                        <>Next Step <ChevronRight size={24} /></>
                    )}
                </button>
            </div>
        </div>
    );
}
