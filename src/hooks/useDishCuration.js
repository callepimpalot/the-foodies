import { useState } from 'react';
import { proposeDish, parseTargetCount } from '../lib/dishCuration';
import { refineRecipe } from '../lib/recipeExtraction';

// A dish's display title, whether it's a plain library reference or has since been edited
// ("recipe" present — either a generated dish, or a library dish with a modify-in-place override).
export function resolveDishTitle(dish, recipes) {
    if (!dish) return 'Unknown';
    if (dish.recipe) return dish.recipe.title ?? 'Untitled';
    if (dish.source === 'library') return recipes?.find((r) => r.id === dish.recipeId)?.title ?? 'Unknown recipe';
    return 'Untitled';
}

export function resolveDishTags(dish, recipes) {
    if (!dish) return [];
    if (dish.recipe) return Array.isArray(dish.recipe.tags) ? dish.recipe.tags : [];
    if (dish.source === 'library') return recipes?.find((r) => r.id === dish.recipeId)?.tags ?? [];
    return [];
}

// Phase 1 of the week-planner: curate a pool of dishes one at a time (Keep / Modify / Reject) before
// any of them are placed on specific days — placement is a separate, later step (useWeekPlanChat's
// seedFromDishes). Mirrors the "chef suggests one dish, you react" flow rather than one big
// whole-week response.
export function useDishCuration() {
    const [phase, setPhase] = useState('entry'); // entry -> count -> reviewing -> done
    const [constraints, setConstraints] = useState('');
    const [targetCount, setTargetCount] = useState(null);
    const [acceptedDishes, setAcceptedDishes] = useState([]);
    const [currentDish, setCurrentDish] = useState(null);
    const [rejectedForThisSlot, setRejectedForThisSlot] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const requestNextDish = async (libraryShortlist, recipes, rejectedOverride, options) => {
        setBusy(true);
        setError(null);
        try {
            const dish = await proposeDish({
                constraints,
                acceptedDishes: acceptedDishes.map((d) => ({ title: resolveDishTitle(d, recipes), tags: resolveDishTags(d, recipes) })),
                rejectedForThisSlot: rejectedOverride ?? rejectedForThisSlot,
                libraryShortlist,
                forceGenerated: options?.forceGenerated,
                customRequest: options?.customRequest,
            });
            setCurrentDish(dish);
            setPhase('reviewing');
        } catch (err) {
            console.error('Dish proposal failed:', err);
            setError(err?.message || "Couldn't come up with a dish — try again.");
        } finally {
            setBusy(false);
        }
    };

    // Kicks off curation from the opening message — straight into proposing if a count was stated,
    // otherwise asks for one first rather than guessing.
    const begin = async (openingMessage, libraryShortlist, recipes) => {
        const text = openingMessage.trim();
        setConstraints(text);
        const count = parseTargetCount(text);
        if (count) {
            setTargetCount(count);
            await requestNextDish(libraryShortlist, recipes);
        } else {
            setPhase('count');
        }
    };

    const confirmCount = async (n, libraryShortlist, recipes) => {
        setTargetCount(n);
        await requestNextDish(libraryShortlist, recipes);
    };

    const keep = async (libraryShortlist, recipes) => {
        const next = [...acceptedDishes, currentDish];
        setAcceptedDishes(next);
        setCurrentDish(null);
        setRejectedForThisSlot([]);
        if (next.length >= targetCount) {
            setPhase('done');
        } else {
            await requestNextDish(libraryShortlist, recipes, []);
        }
    };

    const reject = async (reason, libraryShortlist, recipes) => {
        const entry = { title: resolveDishTitle(currentDish, recipes), reason: reason ?? null };
        const nextRejected = [...rejectedForThisSlot, entry];
        setRejectedForThisSlot(nextRejected);
        setCurrentDish(null);
        await requestNextDish(libraryShortlist, recipes, nextRejected);
    };

    // Reject specifically because the library doesn't have it — skips library matching entirely for
    // the next proposal (a hard override in the prompt, not just a steering hint, since "prefer
    // library" is otherwise a strong default) and optionally carries what they actually want instead.
    const rejectForSomethingNew = async (customRequest, libraryShortlist, recipes) => {
        const entry = {
            title: resolveDishTitle(currentDish, recipes),
            reason: customRequest?.trim() ? `wants something different, not from the library: ${customRequest.trim()}` : 'wants something different, not from the library',
        };
        const nextRejected = [...rejectedForThisSlot, entry];
        setRejectedForThisSlot(nextRejected);
        setCurrentDish(null);
        await requestNextDish(libraryShortlist, recipes, nextRejected, { forceGenerated: true, customRequest });
    };

    // Targeted edit on the dish currently being reviewed ("beef instead of pork") — not a new
    // proposal, the same dish with one thing changed. A library dish is materialized to a full
    // recipe first (same pattern RecipeDaySheet uses) so refineRecipe has something to work with.
    const modify = async (instruction, recipes) => {
        if (!currentDish || !instruction?.trim()) return;
        setBusy(true);
        setError(null);
        try {
            const base = currentDish.recipe
                ?? recipes?.find((r) => r.id === currentDish.recipeId)
                ?? null;
            if (!base) throw new Error("Couldn't find that recipe to modify.");
            const { recipe } = await refineRecipe(base, instruction.trim());
            setCurrentDish({ ...currentDish, recipe });
        } catch (err) {
            console.error('Dish modify failed:', err);
            setError(err?.message || "Couldn't apply that change — try rephrasing it.");
        } finally {
            setBusy(false);
        }
    };

    const reset = () => {
        setPhase('entry');
        setConstraints('');
        setTargetCount(null);
        setAcceptedDishes([]);
        setCurrentDish(null);
        setRejectedForThisSlot([]);
        setBusy(false);
        setError(null);
    };

    return {
        phase, constraints, targetCount, acceptedDishes, currentDish, busy, error,
        begin, confirmCount, keep, reject, rejectForSomethingNew, modify, reset,
    };
}
