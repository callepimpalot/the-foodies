/**
 * Cook-feedback checks — `node scripts/cook_feedback_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/lib/cookFeedback.js` is the whole of TASK 15 / FEATURE_taste_model.md — the only writer to
 * `cook_feedback` and the only reader the week planner has for "what this household actually liked".
 * Measured, not assumed: `git grep -l -- "cookFeedback.js"` across main and all 28 remote heads, in
 * `scripts/*_check.mjs` only, returns nothing. The module had no suite.
 *
 * WHAT IT ASSERTS, AND WHY EACH THING MATTERS
 *   - `RATINGS` — the three taps the Cook screen offers, in the order it renders them, and the exact
 *     `value` strings the database column stores. Renaming a value silently orphans the history
 *     already written under the old one.
 *   - `FEEDBACK_WINDOW` — how much history the planner's prompt is given. Pinned because it is a
 *     deliberate cost/quality trade-off documented in the file, not an incidental default.
 *   - `canReceiveFeedback` — the gate that decides whether the rating UI appears at all. Recipes
 *     served from the bundled `final_recipes.json` fallback have ids like `local-4` and no row to
 *     hang feedback on, so this must reject anything that is not a real uuid — and an off-by-one in
 *     the pattern either hides the buttons on real recipes or offers them on unlinkable ones.
 *   - `saveFeedback`'s guards — the file's own header states the owner's decisions: the rating is the
 *     only required tap, a skip writes NO row, and an empty note is null rather than "". The two
 *     refusals (bad rating, bad recipe id) must happen *before* any request, so a rejected write
 *     cannot leave a half-row behind.
 *   - the row `saveFeedback` inserts — the column names, the trim-to-null note, and that
 *     `household_id`/`member_id` are sent explicitly (null today) because attribution cannot be
 *     recovered retroactively once the second adult is onboarded.
 *   - `recentCookFeedback`'s shape — the columns it asks for, newest-first ordering, the default
 *     limit, and its documented resilience: a paused free tier or a dropped connection costs the
 *     planner its memory, never its ability to plan, so a failure returns `[]` instead of throwing.
 *     The row-to-prompt mapping is asserted too (date sliced to the day, tags defaulted, a null note
 *     becoming `undefined`, and rows whose joined recipe vanished being dropped rather than offered
 *     to the model as a nameless dish).
 *
 * HOW THE MODULE IS LOADED, AND WHY IT IS NOT A CHEAT
 * `cookFeedback.js` imports `./supabase`, which reads `import.meta.env` — a Vite-injected global.
 * Measured in bare Node (v26.9.0): importing the module unredirected fails with
 * `TypeError: Cannot read properties of undefined (reading 'VITE_SUPABASE_URL')`. So this process
 * redirects that ONE specifier, via a resolve hook, to a small in-memory stand-in whose `supabase`
 * export is a live binding the test can point at a recording fake. Everything else about the module
 * under test is the real file, resolved from this script's own location — the assertions below run
 * the real `saveFeedback`, not a copy of its logic.
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * This is a node-level logic check. It renders nothing, exercises no React context, calls no real
 * Supabase and touches no database — the same scope note as every other script in this directory.
 * No assertion here says anything about whether Postgres accepts the row; that is
 * `scripts/task07_check.mjs` and the migration checks.
 *
 * NEGATIVE CONTROL (run it before trusting a clean result): copy `src` and `scripts` to a scratch
 * directory, break one thing in the copy's `src/lib/cookFeedback.js`, and re-run this file from
 * there. All five controls below were measured on 2026-10-12, each going red at the group it targets
 * and leaving the rest of the file running (the recording helpers return `[]`/`{}` rather than
 * throwing, so one broken invariant reports FAILs instead of aborting the run):
 *   - narrow `UUID_RE`'s first group to `{7}`        -> 57 ok / 17 FAIL  (the uuid gate and every
 *                                                       write that depends on it)
 *   - `note: note?.trim() || null` -> `note: note?.trim()`
 *                                                    -> 71 ok /  3 FAIL  (the blank-note assertions)
 *   - delete the `.filter(...)` requiring a joined title
 *                                                    -> 73 ok /  1 FAIL  (the orphaned-row assertion)
 *   - `.slice(0, 10)` -> `.slice(0, 8)` on cooked_at  -> 72 ok /  2 FAIL  (the date assertions)
 *   - `return []` in the catch -> `throw err`         -> 70 ok /  4 FAIL  (both failure paths)
 * A restored copy is green again (74 ok / 0 FAIL).
 *
 * Plain script, non-zero exit on failure — same shape as scripts/task07_check.mjs.
 */
import { registerHooks } from 'node:module';

// A live-binding stand-in for `./supabase`. `supabase` is exported as `let` so the module under test
// sees every reassignment the test makes through `setClient`.
const SUPABASE_STUB_URL = 'data:text/javascript,' + encodeURIComponent([
    'export let supabase = null;',
    'export function setClient(client) { supabase = client; }',
    'export function setHouseholdHeader() { return false; }',
].join('\n'));

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === './supabase' || specifier === './supabase.js') {
            return { url: SUPABASE_STUB_URL, shortCircuit: true };
        }
        // The app's own imports are extensionless; Vite resolves them, bare Node does not.
        if (specifier.startsWith('.') && !/\.[cm]?js$/.test(specifier)) {
            return nextResolve(`${specifier}.js`, context);
        }
        return nextResolve(specifier, context);
    },
});

const { RATINGS, FEEDBACK_WINDOW, canReceiveFeedback, saveFeedback, recentCookFeedback } =
    await import('../src/lib/cookFeedback.js');
const { setClient } = await import(SUPABASE_STUB_URL);

let failures = 0;
function check(name, actual, expected) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
        console.log(`  ok   ${name}`);
    } else {
        failures += 1;
        console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
    }
}

/** Await a call and report whether it threw, plus the message and value. */
async function caught(fn) {
    try {
        const value = await fn();
        return { threw: false, message: null, value };
    } catch (err) {
        return { threw: true, message: err?.message ?? String(err), value: null };
    }
}

const UUID = '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b';

/** A recorded call by index, or [] — so a broken upstream guard reports FAILs, not a TypeError. */
function call(i) {
    return calls[i] ?? [];
}

/** The row handed to insert(), or {} — same reason. */
function insertedRow() {
    return (calls.find((c) => c[0] === 'insert') ?? [null, {}])[1] ?? {};
}

// ── a recording stand-in for the Supabase client ────────────────────────────────────────────────
// Every call is recorded so the *query the module builds* can be asserted, not just its result.
let calls = [];
let reply = { data: null, error: null };
let rejectWith = null;

function reset() {
    calls = [];
    reply = { data: null, error: null };
    rejectWith = null;
}

function respond() {
    if (rejectWith) return Promise.reject(rejectWith);
    return Promise.resolve({ data: reply.data, error: reply.error });
}

const chain = {
    from(table) { calls.push(['from', table]); return chain; },
    select(columns) { calls.push(['select', columns]); return chain; },
    order(column, opts) { calls.push(['order', column, opts]); return chain; },
    limit(n) { calls.push(['limit', n]); return chain; },
    insert(row) { calls.push(['insert', row]); return chain; },
    single() { calls.push(['single']); return respond(); },
    // The chain is awaited at its last link, so it has to be thenable.
    then(onOk, onErr) { return respond().then(onOk, onErr); },
};

setClient(chain);

// `recentCookFeedback` logs a failed read; keep the run's output readable, and record that it did.
let logged = [];
const realError = console.error;
console.error = (...args) => { logged.push(args.map(String).join(' ')); };

console.log('\nRATINGS — the three taps, and the values the column stores');

check('there are exactly three ratings', RATINGS.length, 3);
check('the values are the three the column stores', RATINGS.map((r) => r.value), ['loved', 'fine', 'not_again']);
check('the labels are the ones the Cook screen shows', RATINGS.map((r) => r.label), ['Loved it', 'It was fine', 'Not again']);
check('"loved" is offered first', RATINGS[0].value, 'loved');
check('every rating carries both fields', RATINGS.every((r) => typeof r.value === 'string' && typeof r.label === 'string'), true);

console.log('\nFEEDBACK_WINDOW — how much history reaches the planner prompt');

check('the window is 20 entries', FEEDBACK_WINDOW, 20);

console.log('\ncanReceiveFeedback — the gate on the rating UI');

check('a real recipe uuid may receive feedback', canReceiveFeedback({ id: UUID }), true);
check('the pattern accepts uppercase hex', canReceiveFeedback({ id: UUID.toUpperCase() }), true);
check('a local fallback id may not (no row to link to)', canReceiveFeedback({ id: 'local-1712345678901' }), false);
check('a bare uuid without dashes may not', canReceiveFeedback({ id: '3f2a1b4c5d6e4f708a9b0c1d2e3f4a5b' }), false);
check('a uuid one character short may not', canReceiveFeedback({ id: UUID.slice(0, -1) }), false);
check('a recipe with no id may not', canReceiveFeedback({}), false);
check('a null id may not', canReceiveFeedback({ id: null }), false);
check('a missing recipe may not', canReceiveFeedback(null), false);
check('an undefined recipe may not', canReceiveFeedback(undefined), false);
check('a numeric id may not', canReceiveFeedback({ id: 12345 }), false);

console.log('\nsaveFeedback — the guards, checked before any request is made');

setClient(null);
reset();
let out = await caught(() => saveFeedback({ recipeId: UUID, rating: 'loved' }));
check('with no Supabase client it refuses', out.threw, true);
check('...saying the rating was not saved', out.message, 'Not connected to your recipe library right now — this rating was not saved.');

setClient(chain);
reset();
out = await caught(() => saveFeedback({ recipeId: UUID, rating: 'skip' }));
check('an unknown rating is refused', out.threw, true);
check('...with the "pick how it went" message', out.message, 'Pick how the meal went before saving.');
check('a refused rating issues no request at all', calls, []);

reset();
out = await caught(() => saveFeedback({ recipeId: UUID, rating: 'loved ' }));
check('a rating with stray whitespace is not accepted as "loved"', out.threw, true);

reset();
out = await caught(() => saveFeedback({ recipeId: UUID, rating: 'Loved' }));
check('the rating is case-sensitive', out.threw, true);

reset();
out = await caught(() => saveFeedback({ recipeId: UUID, rating: null }));
check('a missing rating is refused', out.threw, true);
check('...and no request is made for it either', calls, []);

reset();
out = await caught(() => saveFeedback({ recipeId: 'local-1712345678901', rating: 'loved' }));
check('a local fallback recipe id is refused', out.threw, true);
check('...with the "could not tell which recipe" message', out.message, "Couldn't tell which recipe this was — nothing was saved.");
check('...and still issues no request', calls, []);

reset();
out = await caught(() => saveFeedback({ recipeId: null, rating: 'loved' }));
check('a missing recipe id is refused before any request', [out.threw, calls.length], [true, 0]);

setClient(null);
reset();
out = await caught(() => saveFeedback({ recipeId: null, rating: 'nonsense' }));
check('offline is reported before the rating is judged', out.message, 'Not connected to your recipe library right now — this rating was not saved.');

console.log('\nsaveFeedback — the row it inserts');

setClient(chain);
reset();
reply = { data: { id: 'row-1', rating: 'loved' }, error: null };
out = await caught(() => saveFeedback({ recipeId: UUID, rating: 'loved', note: '  the kids asked for it again  ' }));
check('it writes to the cook_feedback table', call(0), ['from', 'cook_feedback']);
check('it inserts', call(1)[0], 'insert');
check('it asks for the inserted row back', calls.map((c) => c[0]).join(','), 'from,insert,select,single');
check('the recipe id is sent as recipe_id', insertedRow().recipe_id, UUID);
check('the rating is sent as rating', insertedRow().rating, 'loved');
check('the note is trimmed before it is stored', insertedRow().note, 'the kids asked for it again');
check('with no household given, household_id is an explicit null', insertedRow().household_id, null);
check('with no member given, member_id is an explicit null', insertedRow().member_id, null);
check('the inserted row is what is returned', out.value?.id, 'row-1');

reset();
reply = { data: { id: 'row-2' }, error: null };
await caught(() => saveFeedback({ recipeId: UUID, rating: 'fine', note: '   ' }));
check('a whitespace-only note is null, not ""', insertedRow().note, null);

reset();
reply = { data: { id: 'row-3' }, error: null };
await caught(() => saveFeedback({ recipeId: UUID, rating: 'not_again' }));
check('an absent note is null', insertedRow().note, null);

reset();
reply = { data: { id: 'row-4', raing: 'typo' }, error: null };
await caught(() => saveFeedback({ recipeId: UUID, rating: 'loved', note: '', householdId: 'hh-1', memberId: 'm-1' }));
check('a given household_id is passed through', insertedRow().household_id, 'hh-1');
check('a given member_id is passed through', insertedRow().member_id, 'm-1');
check('an empty-string note is still null', insertedRow().note, null);

reset();
reply = { data: null, error: { message: 'new row violates row-level security policy' } };
out = await caught(() => saveFeedback({ recipeId: UUID, rating: 'loved' }));
check('a database error is re-thrown, not swallowed', out.threw, true);
check('...carrying the database message', out.message, 'new row violates row-level security policy');

console.log('\nrecentCookFeedback — what it asks for');

setClient(chain);
reset();
reply = { data: [], error: null };
out = await caught(() => recentCookFeedback());
check('it reads from cook_feedback', call(0), ['from', 'cook_feedback']);
check('it selects the rating, note, cooked_at and the joined recipe', call(1), ['select', 'rating, note, cooked_at, recipes(title, tags)']);
check('it orders by cooked_at descending, newest first', call(2), ['order', 'cooked_at', { ascending: false }]);
check('the default limit is FEEDBACK_WINDOW', call(3), ['limit', 20]);
check('an empty history is an empty array', out.value, []);
check('...and is not an error', out.threw, false);

reset();
reply = { data: [], error: null };
await caught(() => recentCookFeedback(5));
check('an explicit limit is honoured', call(3), ['limit', 5]);

reset();
reply = { data: [], error: null };
await caught(() => recentCookFeedback(undefined));
check('an undefined limit falls back to the window', call(3), ['limit', 20]);

console.log('\nrecentCookFeedback — the rows it hands the planner');

reset();
reply = {
    data: [
        { rating: 'loved', note: 'great', cooked_at: '2026-10-11T18:42:11.000Z', recipes: { title: 'Spicy Peanut Noodles', tags: ['noodles', 'quick'] } },
        { rating: 'fine', note: null, cooked_at: '2026-10-04T11:02:00.000Z', recipes: { title: 'White Chicken Chili' } },
    ],
    error: null,
};
out = await caught(() => recentCookFeedback());
check('every readable row is returned', out.value?.length, 2);
check('the title comes from the joined recipe', out.value?.[0]?.title, 'Spicy Peanut Noodles');
check('the tags are passed through', out.value?.[0]?.tags, ['noodles', 'quick']);
check('the rating is passed through', out.value?.[0]?.rating, 'loved');
check('the note is passed through', out.value?.[0]?.note, 'great');
check('cooked_at is sliced to the day the planner reasons about', out.value?.[0]?.cooked_at, '2026-10-11');
check('a missing tag list becomes an empty array, not undefined', out.value?.[1]?.tags, []);
check('a null note becomes undefined, so "no note" is absence', [out.value?.[1]?.note, JSON.stringify(out.value?.[1]?.note)], [undefined, undefined]);
check('the newest row is the first row', out.value?.[0]?.cooked_at > out.value?.[1]?.cooked_at, true);

reset();
reply = {
    data: [
        { rating: 'loved', note: null, cooked_at: '2026-10-11T18:42:11.000Z', recipes: { title: 'Kept' } },
        { rating: 'loved', note: null, cooked_at: '2026-10-10T18:42:11.000Z', recipes: null },
        { rating: 'loved', note: null, cooked_at: '2026-10-09T18:42:11.000Z', recipes: { title: '' } },
        { rating: 'loved', note: null, cooked_at: '2026-10-08T18:42:11.000Z' },
    ],
    error: null,
};
out = await caught(() => recentCookFeedback());
check('a row whose recipe has vanished is dropped, not offered nameless', out.value?.length, 1);
check('...and the row that survives is the named one', out.value?.[0]?.title, 'Kept');

reset();
reply = { data: null, error: null };
out = await caught(() => recentCookFeedback());
check('a null history from the client is an empty array, not a crash', [out.threw, out.value], [false, []]);

reset();
reply = { data: null, error: { message: 'relation "cook_feedback" does not exist' } };
out = await caught(() => recentCookFeedback());
check('a query error does not throw', out.threw, false);
check('...it costs the planner its memory and returns []', out.value, []);
check('...and it is logged, not silent', logged.length > 0, true);
check('...naming cook feedback history', logged.join(' ').includes('Could not read cook feedback history'), true);

reset();
rejectWith = new Error('fetch failed');
logged = [];
out = await caught(() => recentCookFeedback());
check('an unreachable backend (the paused free tier) does not throw either', out.threw, false);
check('...and still yields an empty history', out.value, []);

setClient(null);
reset();
logged = [];
out = await caught(() => recentCookFeedback());
check('with no Supabase client there is no history and no request', [out.value, calls], [[], []]);
check('...and nothing is logged, because an unconfigured backend is not a failure', logged.length, 0);

console.error = realError;

// ───────────────────────────────────────────────────────────────────────────────────────────────
console.log('');
if (failures) {
    console.log(`${failures} FAILED`);
    process.exit(1);
}
console.log('all checks passed');
