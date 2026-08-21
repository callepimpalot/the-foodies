import { useState } from 'react';
import { planWeek, addDaysToDateStr } from '../lib/weekPlanChat';

// status: idle -> planning -> ready
//                           \-> error (still keeps any existing proposal so the user can retry)
export function useWeekPlanChat(scopeDates) {
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState(null);
    const [days, setDays] = useState([]); // current proposal, one entry per planned date
    const [chatLog, setChatLog] = useState([]); // [{ instruction, summary }]
    const [lockedDates, setLockedDates] = useState(() => new Set());

    // lockedOverride lets a caller constrain which days the model is trusted for on this one turn,
    // without touching the persisted lockedDates state — used by sendSingleDay to guarantee only
    // one date can change, regardless of lockedDates' real current contents.
    const send = async (instruction, libraryShortlist, lockedOverride) => {
        if (!instruction?.trim()) return { ok: false, message: 'Describe what you want.' };
        setStatus('planning');
        setError(null);
        const effectiveLocked = lockedOverride ?? lockedDates;
        const previousByDate = new Map(days.map((d) => [d.date, d]));
        try {
            const { days: nextDays, summary } = await planWeek({
                instruction,
                scopeDates,
                currentProposal: days,
                libraryShortlist,
            });
            const nextByDate = new Map(nextDays.map((d) => [d.date, d]));

            // The date set is never trusted from the model on a follow-up turn — once a proposal
            // exists, its dates are fixed regardless of what Gemini returns (it has, in practice,
            // collapsed a whole week down to a single mentioned day). Only the very first turn lets
            // Gemini's response define the date set.
            const targetDates = previousByDate.size > 0 ? [...previousByDate.keys()] : [...nextByDate.keys()];

            // The model's "library" recipeId is never trusted either — with 400+ recipes in the
            // shortlist it can hallucinate or garble an id, which used to surface as a dead-end
            // "Unknown recipe" row that says "Couldn't find that recipe" when tapped. A reference
            // that isn't actually in what we gave it degrades to a clean empty day instead.
            const validLibraryIds = new Set((libraryShortlist ?? []).map((r) => r.id));

            const merged = targetDates
                .map((date) => {
                    // Days locked for this turn are never trusted from the model — always the
                    // exact pre-turn content, never whatever Gemini echoed back for it.
                    if (effectiveLocked.has(date) && previousByDate.has(date)) {
                        return previousByDate.get(date);
                    }
                    // Unlocked: use Gemini's version if it provided one for this date, otherwise
                    // fall back to the pre-turn version so a dropped date can never mean lost data.
                    const next = nextByDate.get(date);
                    if (!next) return previousByDate.get(date);
                    if (next.type === 'recipe' && next.source === 'library' && !validLibraryIds.has(next.recipeId)) {
                        return { date, type: 'empty', locked: false };
                    }
                    return { ...next, locked: lockedDates.has(date) };
                })
                .filter(Boolean);

            setDays(merged);
            setChatLog((prev) => [...prev, { instruction: instruction.trim(), summary }]);
            setStatus('ready');
            return { ok: true };
        } catch (err) {
            console.error('Week plan chat failed:', err);
            const message = err?.message || "Couldn't plan that — try rephrasing it.";
            setError(message);
            setStatus(days.length ? 'ready' : 'idle');
            return { ok: false, message };
        }
    };

    // Sends an instruction scoped to exactly one day — every other day is temporarily treated as
    // locked for this turn only (lockedDates itself is untouched), so the reply can only ever
    // change the target date no matter how the model interprets the instruction.
    const sendSingleDay = (date, instruction, libraryShortlist) => {
        const lockEverythingElse = new Set(days.map((d) => d.date).filter((d) => d !== date));
        return send(instruction, libraryShortlist, lockEverythingElse);
    };

    const toggleLock = (date) => {
        setLockedDates((prev) => {
            const next = new Set(prev);
            if (next.has(date)) next.delete(date);
            else next.add(date);
            return next;
        });
        setDays((prev) => prev.map((d) => (d.date === date ? { ...d, locked: !d.locked } : d)));
    };

    // Swaps two days' entire assignments (recipe/leftover/note, including lock state — the lock
    // follows the content being protected, not the physical date slot it started on).
    const swapDays = (dateA, dateB) => {
        if (dateA === dateB) return;
        setDays((prev) => {
            const a = prev.find((d) => d.date === dateA);
            const b = prev.find((d) => d.date === dateB);
            if (!a || !b) return prev;
            return prev.map((d) => {
                if (d.date === dateA) return { ...b, date: dateA };
                if (d.date === dateB) return { ...a, date: dateB };
                return d;
            });
        });
        setLockedDates((prev) => {
            const aWasLocked = prev.has(dateA);
            const bWasLocked = prev.has(dateB);
            const next = new Set(prev);
            if (bWasLocked) next.add(dateA); else next.delete(dateA);
            if (aWasLocked) next.add(dateB); else next.delete(dateB);
            return next;
        });
    };

    // Manually re-point a leftover day at a different prior recipe day.
    const setLeftoverSource = (date, sourceDate) => {
        setDays((prev) => prev.map((d) => (d.date === date ? { ...d, sourceDate } : d)));
    };

    // Manual single-day edits (from the empty-day action sheet) — each replaces the day's entry
    // wholesale rather than patching, so no stale fields survive a type change (e.g. an old
    // recipeId lingering after switching a day to a note).
    const setDayAsLibraryRecipe = (date, recipeId) => {
        setDays((prev) => prev.map((d) => (d.date === date ? { date, type: 'recipe', source: 'library', recipeId, locked: d.locked } : d)));
    };
    const setDayAsLeftover = (date, sourceDate) => {
        setDays((prev) => prev.map((d) => (d.date === date ? { date, type: 'leftover', sourceDate, locked: d.locked } : d)));
    };
    const setDayAsNote = (date, note) => {
        setDays((prev) => prev.map((d) => (d.date === date ? { date, type: 'note', note, locked: d.locked } : d)));
    };

    // Commits an inspected/refined recipe (servings adjusted, ingredients substituted, etc.) back
    // onto a specific day, then locks that day — the customization is per-week/per-day only (never
    // written back to the shared library recipe), and locking is what protects it from being
    // silently discarded if the user later sends another whole-week chat instruction.
    const setDayRecipeCustomization = (date, { recipe, servings }) => {
        setDays((prev) => prev.map((d) => {
            if (d.date !== date) return d;
            if (d.source === 'library') return { ...d, recipeOverride: recipe, servings, locked: true };
            if (d.source === 'generated') return { ...d, recipe, servings, locked: true };
            return d;
        }));
        setLockedDates((prev) => new Set(prev).add(date));
    };

    // Seeds the proposal from a curated pool of already-accepted dishes (Phase 1 of the planner)
    // instead of one big whole-week AI response — fills the given dates in order, one dish per date,
    // leaving any remaining dates as "empty" placeholders for leftovers/notes/manual picks via the
    // existing empty-day sheet. A dish that was modified during curation (has its own .recipe, even
    // if it started as a library pick) carries that edit through as a recipeOverride, exactly like
    // RecipeDaySheet's per-day customization already does.
    const seedFromDishes = (dishes, dates) => {
        const seeded = dates.map((date, i) => {
            const dish = dishes[i];
            if (!dish) return { date, type: 'empty', locked: false };
            if (dish.source === 'library') {
                return {
                    date, type: 'recipe', source: 'library', recipeId: dish.recipeId,
                    ...(dish.recipe ? { recipeOverride: dish.recipe } : {}),
                    locked: false,
                };
            }
            return { date, type: 'recipe', source: 'generated', recipe: dish.recipe, locked: false };
        });
        setDays(seeded);
        setStatus('ready');
    };

    // The date right after the latest one currently in the proposal — what "Add a day" would add.
    const lastDate = days.length > 0 ? days.reduce((max, d) => (d.date > max ? d.date : max), days[0].date) : null;
    const nextAddableDate = lastDate ? addDaysToDateStr(lastDate, 1) : null;

    // Extends the proposal by one day as an unplanned placeholder (type "empty") — drag another
    // day's content onto it (swapDays) to fill it, or ask the AI to plan it on the next turn.
    const addDay = () => {
        if (!nextAddableDate) return;
        setDays((prev) => (prev.some((d) => d.date === nextAddableDate)
            ? prev
            : [...prev, { date: nextAddableDate, type: 'empty', locked: false }]));
    };

    const reset = () => {
        setDays([]);
        setChatLog([]);
        setLockedDates(new Set());
        setError(null);
        setStatus('idle');
    };

    return {
        status, error, days, chatLog, send, sendSingleDay, toggleLock, swapDays,
        setLeftoverSource, setDayAsLibraryRecipe, setDayAsLeftover, setDayAsNote,
        setDayRecipeCustomization, seedFromDishes, addDay, nextAddableDate, reset,
    };
}
