// TASK 11 Phase 1 — the "use it up" side of the pantry.
//
// Deliberately the smallest thing that answers a useful question. No quantities, no
// units, no deduction: the research behind TASK_11 shows pantry tracking is the
// most-abandoned feature in this category precisely because of data-entry burden, so
// expiry is tracked and nothing else. Expiry also self-corrects — the food leaves —
// where a quantity count silently drifts from reality and then lies to you.

// How far ahead the Home screen looks. Beyond this it is noise, not a prompt.
export const EXPIRY_HORIZON_DAYS = 3;

/** Today at local midnight, so day arithmetic isn't skewed by the clock time. */
function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

/** Local midnight for an ISO 'YYYY-MM-DD'. Returns null for anything unparseable. */
export function parseUseByDate(iso) {
    if (!iso) return null;
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d?.getTime?.()) ? null : d;
}

/**
 * Whole days from today. 0 = today, 1 = tomorrow, negative = already past.
 * Null when there is no usable date.
 */
export function daysUntil(iso) {
    const target = parseUseByDate(iso);
    if (!target) return null;
    return Math.round((target - startOfToday()) / 86400000);
}

/** ISO 'YYYY-MM-DD' for N days from today. Local, so it matches what daysUntil reads. */
export function isoInDays(offset) {
    const d = startOfToday();
    d.setDate(d.getDate() + offset);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * 'Today' / 'Tomorrow' / 'Thursday' / 'Yesterday' / '3 days ago'.
 * Named describeUseBy rather than useByLabel because anything starting with "use"
 * is treated as a React hook by the lint rules, and this is a plain function.
 */
export function describeUseBy(iso) {
    const days = daysUntil(iso);
    if (days == null) return '';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days === -1) return 'Yesterday';
    if (days < -1) return `${Math.abs(days)} days ago`;
    if (days <= 6) return parseUseByDate(iso)?.toLocaleDateString('en-US', { weekday: 'long' }) ?? '';
    return parseUseByDate(iso)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) ?? '';
}

/**
 * Items worth surfacing, soonest first. Anything already past its date is included —
 * that is the case with the most food waste attached to it.
 *
 * Returns [] when nothing qualifies, and the caller is expected to render NOTHING in
 * that case. A Home screen that nags on every launch is one you learn to ignore, and
 * this section is only worth having if it stays quiet when there is nothing to say.
 */
export function expiringItems(items, horizon = EXPIRY_HORIZON_DAYS) {
    return (items ?? [])
        .map((item) => ({ item, days: daysUntil(item?.useByDate) }))
        .filter((entry) => entry.days != null && entry.days <= horizon)
        .sort((a, b) => a.days - b.days || String(a.item?.name).localeCompare(String(b.item?.name)));
}
