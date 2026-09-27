import { createContext, useContext, useCallback } from 'react';
import { useHousehold } from './HouseholdContext';
import { useSyncedDocument } from '../hooks/useSyncedDocument';
import { supabase } from '../lib/supabase';
import { diffPlan, rowsToPlan } from '../lib/planRows';

const PlanContext = createContext();

// One document now, not two keys. `meal_buddy_plan` and `meal_buddy_confirmed`
// are still read once, by the migration, and copied to `*__backup_v1` before
// anything is sent anywhere. They are deliberately not deleted afterwards.
const CACHE_KEY = 'meal_buddy_plan_doc';
const LEGACY_KEYS = ['meal_buddy_plan', 'meal_buddy_confirmed'];

const EMPTY_DOC = { plan: {}, confirmed: false };

/**
 * TASK_07 — Plan, from localStorage to Supabase.
 *
 * The public API is IDENTICAL to before: `weeklyPlan`, `isPlanConfirmed`,
 * `setDayRecipe`, `setDayLeftover`, `setDayNote`, `updateServings`, `clearDay`,
 * `clearPlan`, `toggleConfirmation`, `resolveDay`. Not one view changed to make
 * this work, and if one has to, that is a finding, not a detail — TASK_07's whole
 * sequencing argument rests on this boundary holding.
 *
 * Storage is now:
 *   cache (synchronous)  ->  Supabase (reconciled after paint, written back debounced)
 *
 * See useSyncedDocument for the offline/queueing behaviour and the migration for
 * the schema and its RLS.
 *
 * On the diff: only days *this* client cleared are deleted remotely. "Delete
 * everything missing from my copy" would be indistinguishable from "the other
 * phone's evening was never there", and TASK_07's two-adults case makes that a
 * real data-loss bug rather than a theoretical one.
 */
export function PlanProvider({ children }) {
    const { id: householdId } = useHousehold();

    const loadRemote = useCallback(async () => {
        // Unconfigured or paused project: `offline` is the correct state, and
        // useSyncedDocument treats a thrown error as exactly that — the app stays
        // on the cache and nothing is lost. TASK_07's acceptance criteria call for
        // degrading the way the Recipes tab already does, not for an error screen.
        if (!supabase || !householdId) throw new Error('Supabase unavailable');

        const [planRes, stateRes] = await Promise.all([
            supabase.from('meal_plans').select('*').eq('household_id', householdId),
            supabase.from('plan_state').select('confirmed').eq('household_id', householdId).maybeSingle(),
        ]);
        if (planRes.error) throw planRes.error;
        if (stateRes.error && stateRes.status !== 406) throw stateRes.error;

        const rows = planRes.data ?? [];
        return {
            rows,
            value: {
                plan: rowsToPlan(rows),
                // A household with no plan_state row yet (first ever save) reads as
                // unconfirmed, which is the correct default, not an error.
                confirmed: stateRes.data?.confirmed === true,
            },
        };
    }, [householdId]);

    const saveRemote = useCallback(async (doc, { rows: knownRows = [], removed = [] } = {}) => {
        if (!supabase || !householdId) throw new Error('Supabase unavailable');

        const { upserts, deletes } = diffPlan({
            weeklyPlan: doc?.plan ?? {},
            householdId,
            removedDates: removed,
            knownRows,
        });

        if (upserts.length) {
            const { error } = await supabase
                .from('meal_plans')
                .upsert(upserts, { onConflict: 'household_id,plan_date' });
            if (error) throw error;
        }

        if (deletes.length) {
            const { error } = await supabase
                .from('meal_plans')
                .delete()
                .eq('household_id', householdId)
                .in('plan_date', deletes);
            if (error) throw error;
        }

        const { error: stateError } = await supabase
            .from('plan_state')
            .upsert(
                { household_id: householdId, confirmed: doc?.confirmed === true },
                { onConflict: 'household_id' }
            );
        if (stateError) throw stateError;
    }, [householdId]);

    // `rowsRef` is deliberately not taken from the hook: the diff needs the rows the
    // *last save* knew about, and useSyncedDocument hands those back through
    // saveRemote's second argument. Reading a ref here would race with a save in
    // flight.
    const { value, update, status } = useSyncedDocument({
        cacheKey: CACHE_KEY,
        householdId,
        loadRemote,
        saveRemote,
        fallback: EMPTY_DOC,
        legacyKeys: LEGACY_KEYS,
        fromLegacy: (legacy) => ({
            plan: legacy?.['meal_buddy_plan'] ?? {},
            confirmed: legacy?.['meal_buddy_confirmed'] === true,
        }),
    });

    const weeklyPlan = value?.plan ?? {};
    const isPlanConfirmed = value?.confirmed === true;

    // Every mutation is `update` with a reducer, so the in-memory shape and the
    // persisted document can never drift apart.
    const setDayRecipe = (date, recipe) => {
        update((doc) => ({
            ...doc,
            plan: { ...doc.plan, [date]: { recipe, servings: recipe?.baseServings || 2 } },
            // Editing the plan un-confirms it, exactly as before: the shopping list
            // that was locked is no longer the list this plan produces.
            confirmed: false,
        }));
    };

    const setDayLeftover = (date, sourceDate) => {
        update((doc) => ({
            ...doc,
            plan: { ...doc.plan, [date]: { leftoverOfDate: sourceDate } },
            confirmed: false,
        }));
    };

    const setDayNote = (date, note) => {
        update((doc) => ({
            ...doc,
            plan: { ...doc.plan, [date]: { note } },
            confirmed: false,
        }));
    };

    const updateServings = (date, count) => {
        if (count < 1) return;
        update((doc) => {
            const entry = doc.plan?.[date];
            if (!entry?.recipe) return doc;
            return {
                ...doc,
                plan: { ...doc.plan, [date]: { ...entry, servings: count } },
                confirmed: false,
            };
        });
    };

    const clearDay = (date) => {
        update((doc) => {
            const next = { ...doc.plan };
            delete next[date];
            return { ...doc, plan: next, confirmed: false };
        }, { removed: [date] });
    };

    const clearPlan = () => {
        // Every currently-known date is explicitly removed, so a cleared week is
        // actually cleared remotely rather than merely absent locally.
        const dates = Object.keys(weeklyPlan);
        update({ plan: {}, confirmed: false }, { removed: dates });
    };

    const toggleConfirmation = () => {
        update((doc) => ({ ...doc, confirmed: !doc.confirmed }));
    };

    // Resolves what a day actually shows, following one level of leftover
    // reference. Unchanged in behaviour, and unchanged in signature — this is the
    // function every view calls.
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

    // A plain object, reconstructed per render — exactly what this provider did
    // before. Memoising it would be a behaviour change hiding in a refactor, and
    // the staleness it risks (clearPlan closes over weeklyPlan) is not worth the
    // object churn it saves.
    const api = {
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
        // TASK_07 addition, additive only: the sync state, for the household screen.
        syncStatus: status,
    };

    return (
        <PlanContext.Provider value={api}>
            {children}
        </PlanContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePlan() {
    const context = useContext(PlanContext);
    if (!context) {
        throw new Error('usePlan must be used within a PlanProvider');
    }
    return context;
}
