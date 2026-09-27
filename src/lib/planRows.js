// TASK_07 — mapping between the in-memory DayEntry union and meal_plans rows.
//
// Deliberately dependency-free and side-effect-free: it is the part of the
// migration that can be asserted without a database, and scripts/task07_check.mjs
// does exactly that with `node scripts/task07_check.mjs`.

export const PLAN_KINDS = ['recipe', 'leftover', 'note'];

/** A DayEntry -> a meal_plans row. Returns null for an entry with nothing in it. */
export function dayEntryToRow(dateStr, entry, householdId) {
    if (!dateStr || !entry || !householdId) return null;

    if (entry.leftoverOfDate) {
        return {
            household_id: householdId,
            plan_date: dateStr,
            kind: 'leftover',
            recipe_id: null,
            recipe_snapshot: null,
            servings: null,
            leftover_of_date: entry.leftoverOfDate,
            note: null,
        };
    }

    if (entry.recipe) {
        return {
            household_id: householdId,
            plan_date: dateStr,
            kind: 'recipe',
            recipe_id: entry.recipe?.id ?? null,
            // The whole object, as the context holds it. See the column comment in
            // the migration for why this is not a join.
            recipe_snapshot: entry.recipe,
            servings: entry.servings ?? entry.recipe?.baseServings ?? 2,
            leftover_of_date: null,
            note: null,
        };
    }

    if (entry.note) {
        return {
            household_id: householdId,
            plan_date: dateStr,
            kind: 'note',
            recipe_id: null,
            recipe_snapshot: null,
            servings: null,
            leftover_of_date: null,
            note: entry.note,
        };
    }

    return null;
}

/**
 * A meal_plans row -> a DayEntry, in the exact shape PlanContext already uses,
 * so `resolveDay()` and every view keep working untouched.
 *
 * Only the key the kind owns is set: `{ recipe: undefined }` and no `recipe` key
 * at all are the same to `resolveDay()`, but only one of them survives a
 * JSON round trip unchanged, and the day rows are compared by value when
 * diffing. Keeping the object minimal keeps that comparison honest.
 */
export function rowToDayEntry(row) {
    if (!row) return null;
    switch (row.kind) {
        case 'recipe':
            return { recipe: row.recipe_snapshot ?? null, servings: row.servings ?? 2 };
        case 'leftover':
            return { leftoverOfDate: row.leftover_of_date };
        case 'note':
            return { note: row.note };
        default:
            return null;
    }
}

/** The whole plan document -> rows. Days with nothing in them are skipped. */
export function planToRows(weeklyPlan, householdId) {
    return Object.keys(weeklyPlan ?? {})
        .sort()
        .map((date) => dayEntryToRow(date, weeklyPlan?.[date], householdId))
        .filter(Boolean);
}

/** Rows -> the whole plan document, keyed by date as PlanContext holds it. */
export function rowsToPlan(rows) {
    const plan = {};
    for (const row of rows ?? []) {
        const entry = rowToDayEntry(row);
        if (entry) plan[row.plan_date] = entry;
    }
    return plan;
}

/** Field-by-field comparison of two rows, ignoring updated_at. */
export function rowsMatch(a, b) {
    if (!a || !b) return a === b;
    return (
        a.plan_date === b.plan_date &&
        a.kind === b.kind &&
        a.recipe_id === b.recipe_id &&
        a.servings === b.servings &&
        a.leftover_of_date === b.leftover_of_date &&
        a.note === b.note &&
        JSON.stringify(a.recipe_snapshot ?? null) === JSON.stringify(b.recipe_snapshot ?? null)
    );
}

/**
 * What to send for a plan change.
 *
 * `deletes` is an explicit list of dates this client removed, NOT "every date
 * missing from the local plan". That distinction is the whole point: with two
 * phones editing, a client that deleted-and-replaced everything it couldn't see
 * would wipe the other person's evening. This client only ever deletes days it
 * itself cleared.
 *
 * @param {object} weeklyPlan       the local plan now
 * @param {string} householdId
 * @param {string[]} removedDates   dates cleared locally since the last save
 * @param {object[]} knownRows      the rows last seen (from the remote load)
 */
export function diffPlan({ weeklyPlan, householdId, removedDates = [], knownRows = [] }) {
    const next = planToRows(weeklyPlan, householdId);
    const known = new Map((knownRows ?? []).map((r) => [r.plan_date, r]));
    const removed = new Set(removedDates ?? []);

    const upserts = next.filter((row) => !rowsMatch(row, known.get(row.plan_date)));
    const deletes = Array.from(removed).filter((date) => !weeklyPlan?.[date]);

    return { upserts, deletes, rows: next };
}
