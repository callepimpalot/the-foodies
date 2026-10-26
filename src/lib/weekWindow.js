/**
 * The visible week — one definition, shared by the Plan tab and the Shop tab.
 *
 * Why this file exists
 * -------------------
 * The two tabs used to answer "which days are we talking about?" differently, and
 * the difference was invisible:
 *
 *   Plan tab  (WeeklyCalendar)      generated today + the next 6 days, inline.
 *   Shop tab  (ShopView)            called buildShoppingList(weeklyPlan) — the
 *                                   WHOLE plan document, every date in it.
 *
 * The plan document is keyed by date and accumulates: `setDayRecipe` writes
 * `plan[date] = …` and nothing ever removes a date that has gone by. So after a
 * few weeks of planning, `weeklyPlan` holds every meal ever planned while the Plan
 * tab shows only the current seven days. The Shop tab therefore listed ingredients
 * for meals the user could no longer see — the plan said one thing, the list said
 * another, and nothing on screen explained the gap.
 *
 * Two views computing the same window separately is what allowed them to drift. The
 * fix is not to filter the list harder; it is to have one answer. Both views now ask
 * this module.
 *
 * Behaviour note: the window is a rolling seven days starting today, which is
 * exactly what WeeklyCalendar already did — so the Plan tab is unchanged by this
 * refactor and only the Shop tab's contents change. Whether the product wants a
 * rolling window or a fixed Monday–Sunday week is a separate decision; if it changes,
 * it changes here, once, and both tabs follow.
 */

export const WEEK_LENGTH_DAYS = 7;

/** A Date -> the `YYYY-MM-DD` string the plan document is keyed by. */
export function toDateStr(date) {
    return date.toISOString().split('T')[0];
}

/**
 * The seven days the Plan tab shows, as objects, in order.
 *
 * The Date objects are kept alongside the strings on purpose: the day name and day
 * number are formatted from the local Date, and re-deriving them by parsing `dateStr`
 * back would read it as UTC and shift the day by one in any non-UTC timezone.
 */
export function visibleWeekDays(base = new Date()) {
    return Array.from({ length: WEEK_LENGTH_DAYS }, (_, i) => {
        const d = new Date(base);
        d.setDate(d.getDate() + i);
        return {
            date: d,
            dateStr: toDateStr(d),
            dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
            dayNum: d.getDate(),
        };
    });
}

/** Just the date strings of the visible week — the keys of the plan document. */
export function visibleWeekDates(base = new Date()) {
    return visibleWeekDays(base).map((day) => day.dateStr);
}

/** Is this plan date inside the visible week? */
export function isInVisibleWeek(dateStr, base = new Date()) {
    return visibleWeekDates(base).includes(dateStr);
}

/**
 * The plan document reduced to the visible week.
 *
 * Everything outside the window is dropped rather than deleted — the stored plan is
 * untouched, and a date that falls back into a later window (there is no such thing
 * today, but the window is a function of `base`) is still there to be read.
 *
 * Entries are passed through by reference, so a leftover day and the source day it
 * points at are filtered by the same rule and cannot disagree.
 */
export function planInVisibleWeek(weeklyPlan, base = new Date()) {
    const window = new Set(visibleWeekDates(base));
    const scoped = {};
    for (const [date, entry] of Object.entries(weeklyPlan ?? {})) {
        if (window.has(date)) scoped[date] = entry;
    }
    return scoped;
}
