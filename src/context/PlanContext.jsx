import { createContext, useContext, useState, useEffect } from 'react';

const PlanContext = createContext();

export function PlanProvider({ children }) {
    // Structure: { 'YYYY-MM-DD': { breakfast: { recipe, servings }, ... } }
    const [weeklyPlan, setWeeklyPlan] = useState(() => {
        const saved = localStorage.getItem('meal_buddy_plan');
        return saved ? JSON.parse(saved) : {};
    });

    const [isPlanConfirmed, setIsPlanConfirmed] = useState(() => {
        const saved = localStorage.getItem('meal_buddy_confirmed');
        return saved === 'true';
    });

    // Persist to localStorage
    useEffect(() => {
        localStorage.setItem('meal_buddy_plan', JSON.stringify(weeklyPlan));
    }, [weeklyPlan]);

    useEffect(() => {
        localStorage.setItem('meal_buddy_confirmed', isPlanConfirmed);
    }, [isPlanConfirmed]);

    const addToPlan = (date, slot, recipe) => {
        setWeeklyPlan(prev => ({
            ...prev,
            [date]: {
                ...prev[date],
                [slot]: {
                    recipe,
                    servings: recipe.baseServings || 2
                }
            }
        }));
        setIsPlanConfirmed(false); // New plan additions unconfirm
    };

    const bulkUpdatePlan = (newPlanData) => {
        // newPlanData might be { date: { slot: Recipe } } OR { date: { slot: { recipe, servings } } }
        const formattedPlan = {};
        Object.entries(newPlanData).forEach(([date, slots]) => {
            formattedPlan[date] = {};
            Object.entries(slots).forEach(([slot, entry]) => {
                const recipe = entry.recipe || entry; // Support both formats
                formattedPlan[date][slot] = {
                    recipe,
                    servings: entry.servings || recipe.baseServings || 2
                };
            });
        });

        setWeeklyPlan(formattedPlan);
        setIsPlanConfirmed(false);
    };

    const updateServings = (date, slot, count) => {
        if (count < 1) return;
        setWeeklyPlan(prev => {
            const currentEntry = prev[date]?.[slot];
            if (!currentEntry) return prev;

            const recipe = currentEntry.recipe || currentEntry; // Handle migration

            return {
                ...prev,
                [date]: {
                    ...prev[date],
                    [slot]: {
                        recipe,
                        servings: count
                    }
                }
            };
        });
        setIsPlanConfirmed(false);
    };

    const toggleConfirmation = () => {
        setIsPlanConfirmed(!isPlanConfirmed);
    };

    const clearPlan = () => {
        setWeeklyPlan({});
        setIsPlanConfirmed(false);
    };

    const removeFromPlan = (date, slot) => {
        setWeeklyPlan(prev => {
            const newPlan = { ...prev };
            if (newPlan[date]) {
                delete newPlan[date][slot];
                if (Object.keys(newPlan[date]).length === 0) {
                    delete newPlan[date];
                }
            }
            return newPlan;
        });
        setIsPlanConfirmed(false);
    };

    return (
        <PlanContext.Provider value={{
            weeklyPlan,
            isPlanConfirmed,
            addToPlan,
            bulkUpdatePlan,
            updateServings,
            toggleConfirmation,
            clearPlan,
            removeFromPlan
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
