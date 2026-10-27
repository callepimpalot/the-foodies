/**
 * Week-plan-chat merge checks — `node scripts/use_week_plan_chat_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/hooks/useWeekPlanChat.js` is the React state machine behind the AI week planner: it takes
 * whatever Gemini returns for a turn and decides what the household's proposal actually becomes. That
 * decision is the app's least forgiving logic — every rule in `send()` exists because the model broke
 * it in practice — and until this file **nothing** asserted it. Measured, not assumed:
 * `git grep -l useWeekPlanChat` across every remote head (main + 37 PR heads) returns **zero**
 * `scripts/*_check.mjs`. `scripts/week_plan_chat_check.mjs` (PR #39) covers the module this hook
 * *delegates to* — `src/lib/weekPlanChat.js`, i.e. the prompt builder and the response parser — and
 * imports nothing from this file. The two are different halves: #39 pins what we send and how we read
 * the reply; this file pins what the hook does with the reply once it has it.
 *
 * THE FOUR RULES THIS PINS (each one is a documented regression, not a hypothetical):
 *   1. **The date set is fixed after the first turn.** `targetDates` is taken from the previous
 *      proposal whenever one exists, never from the model's reply — Gemini has, in practice, collapsed
 *      a whole week down to the single day the instruction mentioned.
 *   2. **A locked day is never taken from the model.** Locked days come back as the exact pre-turn
 *      object, so a whole-week instruction cannot silently discard a day the user protected.
 *   3. **A dropped date falls back to the pre-turn version.** A date the model simply omits keeps its
 *      old content rather than becoming an empty day — a dropped date must never mean lost data.
 *   4. **A library reference that is not in the shortlist degrades to an empty day.** With 400+
 *      recipes the model garbles ids; an unknown id used to surface as a dead-end "Unknown recipe" row.
 *
 * Plus the manual edits the empty-day sheet drives (`setDayAsLibraryRecipe` / `setDayAsLeftover` /
 * `setDayAsNote`), `toggleLock`, `swapDays` (lock follows the *content*, not the date slot),
 * `seedFromDishes` (Phase-1 curation → proposal), `setDayRecipeCustomization`, `addDay`, `reset`, and
 * the error/empty-instruction paths.
 *
 * HOW IT RUNS A HOOK WITH NO REACT
 * The hook imports only `useState`, so this file intercepts two module specifiers with
 * `registerHooks` — `react` and `../lib/weekPlanChat` — and supplies minimal stand-ins:
 *   - a tiny `useState` that re-renders synchronously, so the hook's closures see their own updates
 *     (see `mount()`), and
 *   - a `planWeek` that returns a queued canned reply, so each turn's model output is chosen by the
 *     test rather than by a network call. `planWeek` itself is covered by #39.
 * Everything else is the real module, loaded from disk.
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * Nothing is rendered and no effect is run — this hook has no effects. It says nothing about what the
 * model returns; only what the hook makes of what it returned.
 *
 * NEGATIVE CONTROL (run before trusting a clean result):
 *   cp -r src scripts <scratch>/ctl   # then edit <scratch>/ctl/src/hooks/useWeekPlanChat.js and
 *                                     # run THIS script from <scratch>/ctl
 * Verified red with: `previousByDate.size > 0 ? [...previousByDate.keys()] : [...nextByDate.keys()]`
 * forced to always take `nextByDate.keys()` (the date-set assertions fail); the locked-day branch
 * deleted (the locked-day assertion fails); `{ date, type: 'empty', locked: false }` replaced with
 * `next` (the unknown-library-id assertion fails); the lock-follows-content block removed from
 * `swapDays` (the swap-lock assertion fails).
 *
 * Plain script, non-zero exit on failure — same shape as scripts/task07_check.mjs.
 */
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REACT_STUB = `
export function useState(init) { return globalThis.__mbUseState(init); }
`;

// The hook's dependency on the real planner is replaced by a queue-driven stub. `addDaysToDateStr`
// keeps its real contract (YYYY-MM-DD in, +n days out, UTC) so the hook's own max-date computation is
// still exercised; the real implementation is asserted by scripts/week_plan_chat_check.mjs (#39).
const PLANNER_STUB = `
export function addDaysToDateStr(dateStr, n) {
    const [y, m, d] = String(dateStr).split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + n);
    const p = (x) => String(x).padStart(2, '0');
    return \`\${dt.getUTCFullYear()}-\${p(dt.getUTCMonth() + 1)}-\${p(dt.getUTCDate())}\`;
}
export async function planWeek(args) { return globalThis.__mbPlanWeek(args); }
`;

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === 'react') {
            return { url: 'mb:react', format: 'module', shortCircuit: true };
        }
        if (specifier === '../lib/weekPlanChat') {
            return { url: 'mb:weekPlanChat', format: 'module', shortCircuit: true };
        }
        // The app's own imports are extensionless (`../lib/weekPlanChat`), which Vite resolves at build
        // time and bare Node does not — resolve them for this process only.
        if (specifier.startsWith('.') && !/\.[cm]?js$/.test(specifier)) {
            return nextResolve(`${specifier}.js`, context);
        }
        return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
        if (url === 'mb:react') {
            return { format: 'module', source: REACT_STUB, shortCircuit: true };
        }
        if (url === 'mb:weekPlanChat') {
            return { format: 'module', source: PLANNER_STUB, shortCircuit: true };
        }
        return nextLoad(url, context);
    },
});

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK_PATH = join(HERE, '..', 'src', 'hooks', 'useWeekPlanChat.js');
readFileSync(HOOK_PATH, 'utf8'); // fail loudly here if the module moved

const mod = await import(HOOK_PATH);
const { useWeekPlanChat } = mod;

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

/**
 * Minimal hook host: gives `useState` a persistent slot array and re-renders synchronously on every
 * set, so the hook's closures are refreshed exactly as React would refresh them. `result` is always the
 * most recent render's return value.
 */
function mount(hookFn) {
    const states = [];
    let out;
    let cursor = 0;

    const stateHook = (init) => {
        const idx = cursor++;
        if (idx >= states.length) {
            states[idx] = typeof init === 'function' ? init() : init;
        }
        const set = (value) => {
            const next = typeof value === 'function' ? value(states[idx]) : value;
            if (Object.is(next, states[idx])) return;
            states[idx] = next;
            render();
        };
        return [states[idx], set];
    };

    // Re-bind on every render, not once: a second `mount()` in the same process would otherwise
    // steal the global and this hook's own re-renders would read the other harness's slots.
    const render = () => {
        cursor = 0;
        globalThis.__mbUseState = stateHook;
        out = hookFn();
    };

    render();
    return { get result() { return out; } };
}

/** A planner that hands out queued replies in order; an Error entry is thrown. Records its calls. */
function planner(...replies) {
    const queue = [...replies];
    const calls = [];
    globalThis.__mbPlanWeek = async (args) => {
        calls.push(args);
        if (!queue.length) throw new Error('planWeek stub: no reply queued');
        const reply = queue.shift();
        if (reply instanceof Error) throw reply;
        return reply;
    };
    return calls;
}

const D1 = '2026-10-14';
const D2 = '2026-10-15';
const D3 = '2026-10-16';
const SCOPE = [D1, D2, D3];
const SHORTLIST = [{ id: 'r1', title: 'White Chicken Chili' }, { id: 'r2', title: 'Spicy Peanut Noodles' }];

const libDay = (date, recipeId, extra = {}) => ({ date, type: 'recipe', source: 'library', recipeId, locked: false, ...extra });
const noteDay = (date, note) => ({ date, type: 'note', note, locked: false });
const emptyDay = (date) => ({ date, type: 'empty', locked: false });
const byDate = (days, date) => days.find((d) => d.date === date);

console.log('\nmodule surface');
check('the only export is useWeekPlanChat', Object.keys(mod).sort(), ['useWeekPlanChat']);
check('useWeekPlanChat is a function', typeof useWeekPlanChat, 'function');

// ---------------------------------------------------------------------------
console.log('\nturn 1 — the first turn lets the model define the date set');

let calls = planner({ days: [libDay(D1, 'r1'), noteDay(D2, 'takeaway'), emptyDay(D3)], summary: 'planned three days' });
let h = mount(() => useWeekPlanChat(SCOPE));
let r = await h.result.send('  plan my week  ', SHORTLIST);

check('send reports ok', r, { ok: true });
check('three days adopted from the model', h.result.days.length, 3);
check('the library day kept its id', byDate(h.result.days, D1).recipeId, 'r1');
check('status is ready', h.result.status, 'ready');
check('the instruction was trimmed into the log', h.result.chatLog, [{ instruction: 'plan my week', summary: 'planned three days' }]);
check('planWeek got the scope dates', calls[0].scopeDates, SCOPE);
check('planWeek got an empty currentProposal on turn 1', calls[0].currentProposal, []);
check('planWeek got the shortlist', calls[0].libraryShortlist, SHORTLIST);

// ---------------------------------------------------------------------------
console.log('\nan empty instruction is refused without calling the model');

calls = planner({ days: [], summary: 'never' });
h = mount(() => useWeekPlanChat(SCOPE));
r = await h.result.send('   ', SHORTLIST);
check('refused with a message', r, { ok: false, message: 'Describe what you want.' });
check('planWeek was not called', calls.length, 0);
check('status stayed idle', h.result.status, 'idle');

// ---------------------------------------------------------------------------
console.log('\nturn 2 — date set fixed, locked day kept, dropped date preserved');

// Turn 1: three days.
planner({ days: [libDay(D1, 'r1'), noteDay(D2, 'takeaway'), emptyDay(D3)], summary: 'first' });
h = mount(() => useWeekPlanChat(SCOPE));
await h.result.send('plan my week', SHORTLIST);

// The user locks Wednesday.
h.result.toggleLock(D2);
check('toggleLock set the day flag', byDate(h.result.days, D2).locked, true);
const turn1 = JSON.parse(JSON.stringify(h.result.days)); // the exact pre-turn-2 objects

// Turn 2: the model collapses the week to one day and changes it — all three rules at once.
calls = planner({ days: [noteDay(D1, 'soup')], summary: 'changed wednesday' });
await h.result.send('on Wednesday just a salad', SHORTLIST);

check('the proposal still has three days', h.result.days.map((d) => d.date), [D1, D2, D3]);
check('the model-defined date set was NOT adopted', h.result.days.length, 3);
check('the unlocked day took the model change', byDate(h.result.days, D1), { date: D1, type: 'note', note: 'soup', locked: false });
check('the locked day is the exact pre-turn object', byDate(h.result.days, D2), turn1[1]);
check('the dropped date kept its pre-turn content', byDate(h.result.days, D3), turn1[2]);
check('the follow-up got the previous proposal as currentProposal', calls[0].currentProposal.length, 3);

// ---------------------------------------------------------------------------
console.log('\na library id that is not in the shortlist degrades to an empty day');

calls = planner({ days: [libDay(D1, 'ghost-id')], summary: 'x' });
await h.result.send('something', SHORTLIST);
check('unknown library id became an empty day', byDate(h.result.days, D1), { date: D1, type: 'empty', locked: false });

calls = planner({ days: [libDay(D3, 'r2')], summary: 'x' });
await h.result.send('something', SHORTLIST);
check('a valid library id is kept', byDate(h.result.days, D3), { date: D3, type: 'recipe', source: 'library', recipeId: 'r2', locked: false });

calls = planner({ days: [{ date: D1, type: 'recipe', source: 'generated', recipeId: 'whatever', locked: false }], summary: 'x' });
await h.result.send('something', SHORTLIST);
check('a generated recipe is kept regardless of id', byDate(h.result.days, D1).source, 'generated');

// ---------------------------------------------------------------------------
console.log('\nsendSingleDay — every other day is locked for that turn only');

h = mount(() => useWeekPlanChat(SCOPE));
planner({ days: [libDay(D1, 'r1'), noteDay(D2, 'a'), emptyDay(D3)], summary: 'first' });
await h.result.send('plan', SHORTLIST);
const beforeSingle = JSON.parse(JSON.stringify(h.result.days));

calls = planner({ days: [noteDay(D1, 'salad'), noteDay(D2, 'model meddling'), noteDay(D3, 'model meddling')], summary: 'one day' });
await h.result.sendSingleDay(D1, 'salad on wednesday', SHORTLIST);
check('only the target day changed', byDate(h.result.days, D1), { date: D1, type: 'note', note: 'salad', locked: false });
check('a non-target day is untouched', byDate(h.result.days, D2), beforeSingle[1]);
check('another non-target day is untouched', byDate(h.result.days, D3), beforeSingle[2]);
check('the override locked the other two for the turn only', h.result.days.filter((d) => d.locked).length, 0);

// ---------------------------------------------------------------------------
console.log('\nswapDays — the lock follows the content, not the date slot');

h = mount(() => useWeekPlanChat(SCOPE));
planner({ days: [libDay(D1, 'r1'), noteDay(D2, 'a'), emptyDay(D3)], summary: 'first' });
await h.result.send('plan', SHORTLIST);
h.result.toggleLock(D1); // lock Monday's content
const beforeSwap = JSON.parse(JSON.stringify(h.result.days));
h.result.swapDays(D1, D3);

check('the date slot kept its position', h.result.days.map((d) => d.date), [D1, D2, D3]);
check('D3 now carries D1 content under the D3 date', byDate(h.result.days, D3), { ...beforeSwap[0], date: D3 });
check('D1 now carries D3 content under the D1 date', byDate(h.result.days, D1), { ...beforeSwap[2], date: D1 });
check('the lock travelled with the content to D3', byDate(h.result.days, D3).locked, true);
check('D1 is no longer locked', byDate(h.result.days, D1).locked, false);
check('swapping a day with itself is a no-op', (() => { const b = JSON.stringify(h.result.days); h.result.swapDays(D2, D2); return JSON.stringify(h.result.days) === b; })(), true);

// The lock that travelled is the *persisted* one, so the next whole-week turn must protect D3 and be
// free to change D1 — this is what makes the lockedDates move observable, not just the day flag.
calls = planner({ days: [noteDay(D1, 'model changed this'), noteDay(D3, 'model changed this too')], summary: 'next' });
await h.result.send('change the week', SHORTLIST);
check('the moved lock protects D3 on the next turn', byDate(h.result.days, D3), { ...beforeSwap[0], date: D3 });
check('D1, now unlocked, takes the model change', byDate(h.result.days, D1), { date: D1, type: 'note', note: 'model changed this', locked: false });

// ---------------------------------------------------------------------------
console.log('\nseedFromDishes — Phase-1 curation becomes a proposal');

h = mount(() => useWeekPlanChat(SCOPE));
planner();
h.result.seedFromDishes([
    { source: 'library', recipeId: 'r1' },
    { source: 'library', recipeId: 'r2', recipe: { title: 'Edited Noodles' } },
], [D1, D2, D3]);
check('one entry per date, in order', h.result.days.map((d) => d.date), [D1, D2, D3]);
check('a plain library dish', byDate(h.result.days, D1), libDay(D1, 'r1'));
check('a modified library dish carries a recipeOverride', byDate(h.result.days, D2), { date: D2, type: 'recipe', source: 'library', recipeId: 'r2', recipeOverride: { title: 'Edited Noodles' }, locked: false });
check('a date with no dish left is an empty placeholder', byDate(h.result.days, D3), emptyDay(D3));
check('seeding moves the phase to ready', h.result.status, 'ready');
check('nothing seeded was locked', h.result.days.every((d) => d.locked === false), true);

h = mount(() => useWeekPlanChat(SCOPE));
h.result.seedFromDishes([{ source: 'generated', recipe: { title: 'Invented' } }], [D1]);
check('a generated dish keeps its recipe', byDate(h.result.days, D1), { date: D1, type: 'recipe', source: 'generated', recipe: { title: 'Invented' }, locked: false });

// ---------------------------------------------------------------------------
console.log('\nmanual day edits replace the day wholesale');

h = mount(() => useWeekPlanChat(SCOPE));
planner({ days: [libDay(D1, 'r1'), noteDay(D2, 'a'), emptyDay(D3)], summary: 'first' });
await h.result.send('plan', SHORTLIST);
h.result.toggleLock(D1);

h.result.setDayAsLibraryRecipe(D1, 'r2');
check('a recipe day replaced wholesale keeps the lock', byDate(h.result.days, D1), { date: D1, type: 'recipe', source: 'library', recipeId: 'r2', locked: true });
h.result.setDayAsNote(D1, 'takeaway');
check('switching to a note drops the stale recipeId', byDate(h.result.days, D1), { date: D1, type: 'note', note: 'takeaway', locked: true });
h.result.setDayAsLeftover(D1, D2);
check('switching to a leftover drops the stale note', byDate(h.result.days, D1), { date: D1, type: 'leftover', sourceDate: D2, locked: true });
h.result.setLeftoverSource(D1, D3);
check('a leftover can be re-pointed', byDate(h.result.days, D1).sourceDate, D3);

// ---------------------------------------------------------------------------
console.log('\nsetDayRecipeCustomization — per-day edit, then locked');

h = mount(() => useWeekPlanChat(SCOPE));
planner({ days: [libDay(D1, 'r1'), emptyDay(D2), { date: D3, type: 'recipe', source: 'generated', recipe: { title: 'Gen' }, locked: false }], summary: 'first' });
await h.result.send('plan', SHORTLIST);

h.result.setDayRecipeCustomization(D1, { recipe: { title: 'Custom Chili' }, servings: 4 });
check('a library day gains a recipeOverride and servings', byDate(h.result.days, D1), { date: D1, type: 'recipe', source: 'library', recipeId: 'r1', locked: true, recipeOverride: { title: 'Custom Chili' }, servings: 4 });
h.result.setDayRecipeCustomization(D3, { recipe: { title: 'Custom Gen' }, servings: 6 });
check('a generated day has its recipe replaced', byDate(h.result.days, D3), { date: D3, type: 'recipe', source: 'generated', recipe: { title: 'Custom Gen' }, locked: true, servings: 6 });
check('an empty day is left alone', byDate(h.result.days, D2), emptyDay(D2));

// ---------------------------------------------------------------------------
console.log('\naddDay / nextAddableDate');

h = mount(() => useWeekPlanChat(SCOPE));
planner({ days: [libDay(D1, 'r1'), noteDay(D2, 'a'), emptyDay(D3)], summary: 'first' });
await h.result.send('plan', SHORTLIST);
check('nextAddableDate is one day after the latest date', h.result.nextAddableDate, '2026-10-17');
h.result.addDay();
check('addDay appends one empty placeholder', h.result.days.map((d) => d.date), [D1, D2, D3, '2026-10-17']);
check('the placeholder is empty and unlocked', byDate(h.result.days, '2026-10-17'), emptyDay('2026-10-17'));
h.result.addDay();
check('addDay extends by one more day each call', h.result.days.map((d) => d.date), [D1, D2, D3, '2026-10-17', '2026-10-18']);
check('the guard is against a duplicate, not against extending', h.result.days.length, 5);

const hEmpty = mount(() => useWeekPlanChat(SCOPE));
check('nextAddableDate is null with no proposal', hEmpty.result.nextAddableDate, null);
hEmpty.result.addDay();
check('addDay on an empty proposal does nothing', hEmpty.result.days.length, 0);

// ---------------------------------------------------------------------------
console.log('\nerror path');

h = mount(() => useWeekPlanChat(SCOPE));
planner({ days: [libDay(D1, 'r1')], summary: 'first' });
await h.result.send('plan', SHORTLIST);
calls = planner(new Error('boom'));
r = await h.result.send('again', SHORTLIST);
check('a failed turn reports the message', r, { ok: false, message: 'boom' });
check('the error is exposed in state', h.result.error, 'boom');
check('an existing proposal keeps status ready', h.result.status, 'ready');
check('the proposal survived the failure', h.result.days.length, 1);
check('a failed turn adds nothing to the log', h.result.chatLog.length, 1);

const hFresh = mount(() => useWeekPlanChat(SCOPE));
planner(new Error('boom'));
await hFresh.result.send('plan', SHORTLIST);
check('with no proposal a failure falls back to idle', hFresh.result.status, 'idle');
check('a failure without a message gets a human one', (await (async () => { const hh = mount(() => useWeekPlanChat(SCOPE)); planner(new Error()); return (await hh.result.send('plan', SHORTLIST)).message; })()), "Couldn't plan that — try rephrasing it.");

// ---------------------------------------------------------------------------
console.log('\nreset');

h.result.toggleLock(D1);
h.result.reset();
check('reset clears the proposal', h.result.days, []);
check('reset clears the log', h.result.chatLog, []);
check('reset clears the error', h.result.error, null);
check('reset returns to idle', h.result.status, 'idle');

// A lock must not survive a reset — the next proposal starts with nothing protected.
planner({ days: [libDay(D1, 'r1')], summary: 'after reset' });
await h.result.send('plan', SHORTLIST);
check('a lock does not survive reset', byDate(h.result.days, D1).locked, false);

// ---------------------------------------------------------------------------
console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
