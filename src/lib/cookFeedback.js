// TASK 15 / FEATURE_taste_model.md — what the app remembers about how a meal went.
//
// Event history, deliberately NOT a field on the recipe: the same dish cooked three
// times can go three different ways, and averaging at write time throws away the
// signal ("usually good, one bad night") that makes the history worth having at all.
//
// The decisions here were made by the owner and recorded in the brief:
//   - a 3-way rating plus an OPTIONAL note; the rating is the only required tap
//   - skipping writes NO ROW — never a row with a null rating, which would get
//     counted as negative signal by anything that later reads this
//   - every cook is its own row, never overwritten or averaged
//   - the most recent ~20 entries feed the week planner

import { supabase } from './supabase';

export const RATINGS = [
    { value: 'loved', label: 'Loved it' },
    { value: 'fine', label: 'It was fine' },
    { value: 'not_again', label: 'Not again' },
];

const RATING_VALUES = new Set(RATINGS.map((r) => r.value));

// How much history the week planner sees. Enough to know the user, small enough that
// the prompt stays cheap. Revisit once there's real usage to learn from.
export const FEEDBACK_WINDOW = 20;

// The table's recipe_id is a real foreign key, so a row can only be written for a
// recipe that actually exists in Supabase. Recipes served from the local
// final_recipes.json fallback have no id at all — see useRecipes.js's mapLocalRow —
// and feedback on one could not be linked to anything the planner could read back.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function canReceiveFeedback(recipe) {
    return UUID_RE.test(String(recipe?.id ?? ''));
}

/**
 * Record one cook. Returns the inserted row.
 *
 * householdId and memberId are accepted and stored but nothing populates them yet —
 * the columns exist from the start because attribution cannot be recovered
 * retroactively, and "suggest meals we BOTH liked" needs them once a second adult is
 * onboarded (see FEATURE_family_households.md).
 */
export async function saveFeedback({ recipeId, rating, note, householdId = null, memberId = null }) {
    if (!supabase) {
        throw new Error('Not connected to your recipe library right now — this rating was not saved.');
    }
    if (!RATING_VALUES.has(rating)) {
        throw new Error('Pick how the meal went before saving.');
    }
    if (!UUID_RE.test(String(recipeId ?? ''))) {
        throw new Error("Couldn't tell which recipe this was — nothing was saved.");
    }

    const { data, error } = await supabase
        .from('cook_feedback')
        .insert({
            recipe_id: recipeId,
            rating,
            // An empty note is null, not "". Nothing downstream should have to tell
            // the difference between "no note" and "a note that says nothing".
            note: note?.trim() || null,
            household_id: householdId,
            member_id: memberId,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * The most recent cooks, newest first, condensed for a prompt.
 *
 * Returns [] rather than throwing when the history can't be read: a paused free tier
 * or a dropped connection should cost the planner its memory, never its ability to
 * plan. PROJECT.md documents the free tier pausing as a real, recurring condition.
 */
export async function recentCookFeedback(limit = FEEDBACK_WINDOW) {
    if (!supabase) return [];

    try {
        const { data, error } = await supabase
            .from('cook_feedback')
            .select('rating, note, cooked_at, recipes(title, tags)')
            .order('cooked_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        return (data ?? [])
            .filter((row) => !!row?.recipes?.title)
            .map((row) => ({
                title: row?.recipes?.title,
                tags: row?.recipes?.tags ?? [],
                rating: row?.rating,
                note: row?.note ?? undefined,
                // Date only — the planner cares about "recently" and "a while ago",
                // not what time on a Tuesday it was cooked.
                cooked_at: String(row?.cooked_at ?? '').slice(0, 10),
            }));
    } catch (err) {
        console.error('Could not read cook feedback history:', err);
        return [];
    }
}
