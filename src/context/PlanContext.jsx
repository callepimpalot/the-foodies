import { createContext, useContext, useState, useEffect } from 'react';

const PlanContext = createContext();

// Structure: { 'YYYY-MM-DD': { recipe, servings } | { leftoverOfDate } | { note } }
// A day holds at most one of: a recipe, a leftover reference to another day, or a free-text note.
export function PlanProvider({ children }) {
    const [weeklyPlan, setWeeklyPlan] = useState(() => {
        try {
            const saved = localStorage.getItem('meal_buddy_plan');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.error('Failed to parse weekly plan:', e);
            return {};
        }
    });

    const [isPlanConfirmed, setIsPlanConfirmed] = useState(() => {
        const saved = localStorage.getItem('meal_buddy_confirmed');
        return saved === 'true';
    });

    useEffect(() => {
        localStorage.setItem('meal_buddy_plan', JSON.stringify(weeklyPlan));
    }, [weeklyPlan]);

    useEffect(() => {
        localStorage.setItem('meal_buddy_confirmed', isPlanConfirmed);
    }, [isPlanConfirmed]);

    const setDayRecipe = (date, recipe) => {
        setWeeklyPlan(prev => ({
            ...prev,
            [date]: { recipe, servings: recipe.baseServings || 2 },
        }));
        setIsPlanConfirmed(false);
    };

    const setDayLeftover = (date, sourceDate) => {
        setWeeklyPlan(prev => ({
            ...prev,
            [date]: { leftoverOfDate: sourceDate },
        }));
        setIsPlanConfirmed(false);
    };

    const setDayNote = (date, note) => {
        setWeeklyPlan(prev => ({
            ...prev,
            [date]: { note },
        }));
        setIsPlanConfirmed(false);
    };

    const updateServings = (date, count) => {
        if (count < 1) return;
        setWeeklyPlan(prev => {
            const entry = prev[date];
            if (!entry?.recipe) return prev;
            return { ...prev, [date]: { ...entry, servings: count } };
        });
        setIsPlanConfirmed(false);
    };

    const clearDay = (date) => {
        setWeeklyPlan(prev => {
            const next = { ...prev };
            delete next[date];
            return next;
        });
        setIsPlanConfirmed(false);
    };

    const clearPlan = () => {
        setWeeklyPlan({});
        setIsPlanConfirmed(false);
    };

    const toggleConfirmation = () => setIsPlanConfirmed(prev => !prev);

    // Resolves what a day actually shows, following one level of leftover reference.
    const resolveDay = (date) => {
        const entry = weeklyPlan[date];
        if (!entry) return null;
        if (entry.leftoverOfDate) {
            const source = weeklyPlan[entry.leftoverOfDate];
            return source?.recipe
                ? { type: 'leftover', recipe: source.recipe, sourceDate: entry.leftoverOfDate }
                : { type: 'leftover', recipe: null, sourceDate: entry.leftoverOfDate };
        }
        if (entry.recipe) return { type: 'recipe', recipe: entry.recipe, servings: entry.servings };
        if (entry.note) return { type: 'note', note: entry.note };
        return null;
    };

    return (
        <PlanContext.Provider value={{
            weeklyPlan,
            isPlanConfirmed,
            setDayRecipe,
            setDayLeftover,
            setDayNote,
            updateServings,
            clearDay,
            clearPlan,
            toggleConfirmation,
            resolveDay,
        }}>
            {children}
        </PlanContext.Provider>
    );
}

export function usePlan() {
    const context = useContext(PlanContext);
    if (!context) {
        throw new Error('usePlan must be used within a PlanProvider');
    }
    return context;
}
