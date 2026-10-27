/**
 * Week-plan chat checks — `node scripts/week_plan_chat_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/lib/weekPlanChat.js` is the whole of the Plan step's conversation: it owns the system prompt,
 * the request schema the model answers in, the library-index round trip, and the date arithmetic
 * underneath every "plan the next few days" turn. It is called on every plan edit, live in production.
 *
 * Measured, not assumed: `git grep -l -- "weekPlanChat"` across main and all 29 remote heads, limited
 * to `scripts/`, returns NO `*_check.mjs` that exercises it. The single hit is a comment inside
 * `scripts/recipe_extraction_check.mjs` recording that `dishCuration.js` / `weekPlanChat.js` import the
 * extraction module and are themselves uncovered. This file closes that for `weekPlanChat.js`.
 *
 * WHAT IT ASSERTS, AND WHY EACH THING MATTERS
 *   - `addDaysToDateStr` — the module's own comment says it exists to avoid `new Date('YYYY-MM-DD')`
 *     being parsed as UTC midnight while `getDate()/setDate()` work in local time, which rolls the
 *     result back a calendar day in timezones behind UTC. So the month/year/leap boundaries are
 *     asserted, AND the pitfall itself is proved to be real by re-running the same call in a child
 *     process with `TZ=America/Los_Angeles`, where the naive form really does return the wrong day.
 *     Without that second half a green result here would be indistinguishable from a test that never
 *     left UTC.
 *   - the request `planWeek` sends to the Gemini proxy — model, and `maxOutputTokens: 8192` (the whole
 *     week's JSON has to fit; a lowered cap truncates the reply into invalid JSON). The config is
 *     compared structurally, because a stubbed `fetch` reads a *clone* — identity comparison on the
 *     schema would be false even when the right schema was sent.
 *   - `WEEK_PLAN_SCHEMA` as actually transmitted — `days` required, the `date/type/locked` triple
 *     required per day, the four `type` values and two `source` values the app switches on, and the
 *     nested recipe body. The app's day renderer branches on exactly those strings.
 *   - the prompt: the `{{UNIT_INSTRUCTION}}` placeholder must be *substituted*, never shipped — a
 *     model sent a literal placeholder writes a literal placeholder into the recipe it generates. Both
 *     unit systems are asserted, by stubbing `localStorage` (the preference the user toggles).
 *   - `toIndexedProposal`'s translation, which is what makes "copy this locked day through" cheap:
 *     a library-backed `recipeId` must leave as `libraryIndex` (the id `delete`d, not merely shadowed),
 *     an unmatched id must resolve to `null` rather than a wrong index, and every non-library entry
 *     must pass through byte-identical.
 *   - the reverse translation on the way out: `libraryIndex` back to a real `recipeId` by array
 *     lookup, and an out-of-range index to `recipeId: null` — the documented backstop that degrades to
 *     an empty day instead of "Unknown recipe".
 *   - the documented failure messages and guards: an empty instruction, an empty reply, and an error
 *     routed through `describeApiError` rather than rethrown raw.
 *   - the documented degradation: `cookHistory` is `[]` when the history cannot be read, and the real
 *     mapped history when it can. The planner is documented as forgetting rather than failing.
 *
 * HOW THE MODULE IS LOADED, AND WHY IT IS NOT A CHEAT
 * `weekPlanChat.js` imports `./cookFeedback` -> `./supabase`, which reads `import.meta.env`, a
 * Vite-injected global that does not exist in bare Node (`TypeError: Cannot read properties of
 * undefined (reading 'VITE_SUPABASE_URL')`). So this process redirects that ONE specifier, via a
 * resolve hook, to an in-memory stand-in exposing a live `supabase` binding plus `setClient()` — the
 * same technique `scripts/cook_feedback_check.mjs` uses. The app's extensionless relative imports are
 * resolved by the same hook. Everything else is the real file: the assertions run the real
 * `planWeek` / `addDaysToDateStr`, not a copy of their logic.
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * A node-level logic check with `globalThis.fetch` stubbed. It renders nothing, exercises no React
 * hook, calls no real Gemini and touches no database. It says nothing about whether the model obeys
 * the prompt — only that the prompt, schema and payload the app sends are the ones the app intends.
 *
 * NEGATIVE CONTROL (run before trusting a clean result; each must turn this suite red). Measured on
 * this branch, 2026-10-12: the suite is green at **95 ok / 0 FAIL, exit 0**, and each of the four
 * mutations below was applied to a fresh `cp -r src scripts` copy's `src/lib/weekPlanChat.js`:
 *   1. the response-side lookup `libraryShortlist?.[d.libraryIndex]?.id ?? null` -> `null`
 *                                                    -> 93 ok / 2 FAIL, exit 1 (the index round trip)
 *   2. drop the `.replace('{{UNIT_INSTRUCTION}}', unitSystemInstruction())` call
 *                                                    -> 91 ok / 4 FAIL, exit 1 (the placeholder ships)
 *   3. `if (d.type !== 'recipe' || d.source !== 'library') return d;` -> `return d;`
 *                                                    -> 89 ok / 6 FAIL, exit 1 (recipeId logged back)
 *   4. component-based dates -> `new Date(dateStr)` + `setDate`
 *                                                    -> 94 ok / 1 FAIL, exit 1 (only the TZ-pinned
 *                                                       child assertion can see this one — which is
 *                                                       exactly why that subprocess exists)
 * Each leaves the rest of the file running, so one broken invariant reports FAILs rather than
 * aborting the run.
 *
 * Plain script, non-zero exit on failure — same shape as scripts/task07_check.mjs.
 */
import { registerHooks } from 'node:module';
import { execFileSync } from 'node:child_process';

// A live-binding stand-in for `./supabase`: exported as `let` so the module under test sees whatever
// the test points it at. `setClient(null)` is the "history cannot be read" case, exercised below.
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

const MODULE_URL = new URL('../src/lib/weekPlanChat.js', import.meta.url).href;

const { addDaysToDateStr, planWeek } = await import('../src/lib/weekPlanChat.js');
const { RECIPE_SCHEMA } = await import('../src/lib/recipeExtraction.js');
const { UNIT_SYSTEM_INSTRUCTIONS } = await import('../src/lib/unitPreference.js');
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

async function caught(fn) {
    try {
        const value = await fn();
        return { threw: false, message: null, value };
    } catch (err) {
        return { threw: true, message: err?.message ?? String(err), value: null };
    }
}

// ── the gemini-proxy fetch stub ─────────────────────────────────────────────────────────────────
// `fetchCalls` records what the app actually sent; `reply` produces the response. Both are reset at
// the top of every case, so no assertion can pass on a previous case's state.
let fetchCalls = [];
let reply = () => response({ text: '{"days":[],"summary":"ok"}' });

globalThis.fetch = async (url, opts) => {
    fetchCalls.push({ url, opts });
    return reply(url, opts);
};

function response({ status = 200, text = '', jsonThrows = false, body = undefined } = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (k) => (String(k).toLowerCase() === 'content-type' ? 'application/json' : null) },
        json: async () => {
            if (jsonThrows) throw new Error('not json');
            return body ?? { text };
        },
    };
}

function reset(responder) {
    fetchCalls = [];
    reply = responder ?? (() => response({ text: '{"days":[],"summary":"ok"}' }));
}

/** The JSON payload the app embedded after `DATA:` in the contents string, or null. */
function sentPayload() {
    const contents = JSON.parse(fetchCalls[0]?.opts?.body ?? 'null')?.contents ?? '';
    const at = String(contents).indexOf('DATA:');
    if (at < 0) return null;
    try {
        return JSON.parse(String(contents).slice(at + 5).trim());
    } catch {
        return null;
    }
}

function sentConfig() {
    return JSON.parse(fetchCalls[0]?.opts?.body ?? 'null')?.config ?? {};
}

const UUID = '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b';
const OTHER_UUID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const SHORTLIST = [
    { id: UUID, title: 'White Chicken Chili', meal_type: 'Dinner', tags: ['chicken'], kcal: 480, difficulty: 'Easy' },
    { id: OTHER_UUID, title: 'Quick Sweet Potato Burrito', meal_type: 'Lunch', tags: ['veg'], kcal: 400, difficulty: 'Easy' },
];

/** A recipe day as the app stores it: `recipeId`, never a library index. */
function storedLibraryDay(overrides = {}) {
    return {
        date: '2026-10-12',
        type: 'recipe',
        locked: false,
        source: 'library',
        recipeId: OTHER_UUID,
        ...overrides,
    };
}

const daysReply = (days, summary = 'Planned a few dinners.') =>
    response({ text: JSON.stringify({ days, summary }) });

// ───────────────────────────────────────────────────────────────────────────────────────────────
console.log('\naddDaysToDateStr — the pure date arithmetic under every plan turn');

check('the next day', addDaysToDateStr('2026-10-12', 1), '2026-10-13');
check('the previous day', addDaysToDateStr('2026-10-12', -1), '2026-10-11');
check('zero days is the same date', addDaysToDateStr('2026-10-12', 0), '2026-10-12');
check('a week forward', addDaysToDateStr('2026-10-12', 7), '2026-10-19');
check('a month boundary', addDaysToDateStr('2026-10-31', 1), '2026-11-01');
check('a year boundary', addDaysToDateStr('2026-12-31', 1), '2027-01-01');
check('a leap day, in a leap year', addDaysToDateStr('2028-02-28', 1), '2028-02-29');
check('no Feb 29 in a non-leap year', addDaysToDateStr('2027-02-28', 1), '2027-03-01');
check('backwards across a year boundary', addDaysToDateStr('2027-01-01', -1), '2026-12-31');
check('the month is zero-padded', addDaysToDateStr('2026-08-31', 1), '2026-09-01');
check('the day is zero-padded', addDaysToDateStr('2026-01-01', 9), '2026-01-10');
check('a DST spring-forward in Europe/Copenhagen', addDaysToDateStr('2026-03-28', 1), '2026-03-29');
check('the day after that DST change', addDaysToDateStr('2026-03-29', 1), '2026-03-30');
check('a DST fall-back in Europe/Copenhagen', addDaysToDateStr('2026-10-24', 1), '2026-10-25');
check('the day after that DST change', addDaysToDateStr('2026-10-25', 1), '2026-10-26');

// The reason the helper exists at all: in a timezone behind UTC the naive form rolls back a day.
// Re-run both forms in a child process pinned to that timezone, so this assertion is not vacuous
// merely because this run happens to be in UTC.
{
    const childCode = `
import { registerHooks } from 'node:module';
registerHooks({ resolve(s, c, n) {
  if (s === './supabase') return { url: ${JSON.stringify(SUPABASE_STUB_URL)}, shortCircuit: true };
  if (s.startsWith('.') && !/\\.[cm]?js$/.test(s)) return n(s + '.js', c);
  return n(s, c);
} });
const { addDaysToDateStr } = await import(${JSON.stringify(MODULE_URL)});
const pad = (v) => String(v).padStart(2, '0');
const fmtLocal = (dt) => dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
const [ny, nm, nd] = '2026-10-12'.split('-').map(Number);
const fromComponents = new Date(ny, nm - 1, nd);
fromComponents.setDate(fromComponents.getDate() + 1);
// The pitfall the helper's comment names: parse the ISO string directly, then shift and format locally.
const fromIsoString = new Date('2026-10-12');
fromIsoString.setDate(fromIsoString.getDate() + 1);
console.log(JSON.stringify({
  correct: addDaysToDateStr('2026-10-12', 1),
  fromComponents: fmtLocal(fromComponents),
  pitfall: fmtLocal(fromIsoString),
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
}));
`;
    let child = { ok: false };
    try {
        const raw = execFileSync(process.execPath, ['--input-type=module', '-e', childCode], {
            env: { ...process.env, TZ: 'America/Los_Angeles' },
            encoding: 'utf8',
        });
        child = { ok: true, ...JSON.parse(raw) };
    } catch (err) {
        child = { ok: false, error: String(err?.message ?? err) };
    }
    check('the child process really ran in a UTC-8 timezone', child.tz, 'America/Los_Angeles');
    check('the helper is still correct a day later in that timezone', child.correct, '2026-10-13');
    check('...as is the same arithmetic built from date components', child.fromComponents, '2026-10-13');
    check('...where parsing the ISO string directly really does land a day short (the pitfall is real)', child.pitfall, '2026-10-12');
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
console.log('\nthe request planWeek sends to the proxy');

setClient(null);
reset();
await caught(() => planWeek({ instruction: 'plan Mon-Thu', scopeDates: ['2026-10-12'], currentProposal: [], libraryShortlist: SHORTLIST }));

check('exactly one request per call (no hidden retry)', fetchCalls.length, 1);
check('it posts to the Gemini proxy path', fetchCalls[0]?.url, '/.netlify/functions/gemini');
check('...with method POST', fetchCalls[0]?.opts?.method, 'POST');
check('the body carries model, contents and config — nothing else', Object.keys(JSON.parse(fetchCalls[0]?.opts?.body ?? 'null') ?? {}).sort(), ['config', 'contents', 'model']);
check('the model is gemini-2.5-flash', JSON.parse(fetchCalls[0]?.opts?.body ?? 'null')?.model, 'gemini-2.5-flash');
check('maxOutputTokens stays at 8192 — a week of JSON has to fit', sentConfig()?.maxOutputTokens, 8192);
check('the reply is requested as JSON', sentConfig()?.responseMimeType, 'application/json');

console.log('\nWEEK_PLAN_SCHEMA — the shape the model must answer in');

const schema = sentConfig()?.responseSchema ?? {};
check('the object requires days and summary', schema?.required, ['days', 'summary']);
check('days is an array', schema?.properties?.days?.type, 'array');
check('...of day objects', schema?.properties?.days?.items?.type, 'object');
check('each day requires date, type and locked', schema?.properties?.days?.items?.required, ['date', 'type', 'locked']);
check('the four day types the renderer switches on', schema?.properties?.days?.items?.properties?.type?.enum, ['recipe', 'leftover', 'note', 'empty']);
check('...and no fifth type has crept in', schema?.properties?.days?.items?.properties?.type?.enum?.length, 4);
check('source is library-or-generated', schema?.properties?.days?.items?.properties?.source?.enum, ['library', 'generated']);
check('source is nullable (a note/leftover day has none)', schema?.properties?.days?.items?.properties?.source?.nullable, true);
check('libraryIndex is an integer', schema?.properties?.days?.items?.properties?.libraryIndex?.type, 'integer');
check('...and nullable, for days that are not library picks', schema?.properties?.days?.items?.properties?.libraryIndex?.nullable, true);
check('a locked flag is a boolean', schema?.properties?.days?.items?.properties?.locked?.type, 'boolean');
check('sourceDate exists for leftover days', schema?.properties?.days?.items?.properties?.sourceDate?.type, 'string');
// Structural, not identity: a stubbed fetch reads a clone, so `===` on the nested schema is always false.
check('the nested recipe body is RECIPE_SCHEMA, nullable', JSON.stringify(schema?.properties?.days?.items?.properties?.recipe), JSON.stringify({ ...RECIPE_SCHEMA, nullable: true }));
check('...still carrying the real recipe properties', schema?.properties?.days?.items?.properties?.recipe?.properties?.title?.type, RECIPE_SCHEMA?.properties?.title?.type);
check('the summary is a string', schema?.properties?.summary?.type, 'string');

console.log('\nthe prompt — the placeholder must never ship, and the unit preference must');

reset();
await caught(() => planWeek({ instruction: 'plan the week', scopeDates: ['2026-10-12'], currentProposal: [], libraryShortlist: SHORTLIST }));
const defaultPrompt = String(JSON.parse(fetchCalls[0]?.opts?.body ?? 'null')?.contents ?? '');
check('the {{UNIT_INSTRUCTION}} placeholder is gone', defaultPrompt.includes('{{UNIT_INSTRUCTION}}'), false);
check('...replaced by the metric instruction (no stored preference)', defaultPrompt.includes(UNIT_SYSTEM_INSTRUCTIONS.metric), true);
check('the planner prompt is there too', defaultPrompt.startsWith('You are helping plan a week of home-cooked meals'), true);
check('the payload is appended under a DATA: marker, once', defaultPrompt.split('DATA:').length - 1, 1);
check('...after the prompt', defaultPrompt.indexOf('DATA:') > defaultPrompt.indexOf('summary: one short'), true);

const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
globalThis.localStorage = { getItem: (k) => (k === 'meal_buddy_unit_system' ? 'imperial' : null), setItem: () => {} };
reset();
await caught(() => planWeek({ instruction: 'plan the week', scopeDates: ['2026-10-12'], currentProposal: [], libraryShortlist: SHORTLIST }));
const imperialPrompt = String(JSON.parse(fetchCalls[0]?.opts?.body ?? 'null')?.contents ?? '');
check('an imperial preference swaps the substituted instruction', imperialPrompt.includes(UNIT_SYSTEM_INSTRUCTIONS.imperial), true);
check('...and the metric one no longer appears', imperialPrompt.includes(UNIT_SYSTEM_INSTRUCTIONS.metric), false);
check('the placeholder is still absent in imperial', imperialPrompt.includes('{{UNIT_INSTRUCTION}}'), false);
if (localStorageDescriptor) Object.defineProperty(globalThis, 'localStorage', localStorageDescriptor);
else delete globalThis.localStorage;

console.log('\nthe payload — what the model is actually shown');

reset();
await caught(() => planWeek({ instruction: '  plan the week  ', scopeDates: ['2026-10-12', '2026-10-13'], currentProposal: [], libraryShortlist: SHORTLIST }));
const payload = sentPayload() ?? {};
check('the payload has exactly the five documented keys', Object.keys(payload).sort(), ['cookHistory', 'currentProposal', 'instruction', 'libraryShortlist', 'scopeDates']);
check('scopeDates is passed through in order', payload?.scopeDates, ['2026-10-12', '2026-10-13']);
check('the instruction is trimmed', payload?.instruction, 'plan the week');
check('the library shortlist is passed through', JSON.stringify(payload?.libraryShortlist), JSON.stringify(SHORTLIST));
check('an empty proposal stays an empty array', payload?.currentProposal, []);

console.log('\ntoIndexedProposal — recipeId out, libraryIndex in');

reset();
await caught(() => planWeek({
    instruction: 'change Wednesday',
    scopeDates: ['2026-10-12'],
    currentProposal: [storedLibraryDay()],
    libraryShortlist: SHORTLIST,
}));
check('a matched library day leaves as its index', payloadFromLast()?.[0]?.libraryIndex, 1);
check('...with recipeId gone from the payload', 'recipeId' in (payloadFromLast()?.[0] ?? {}), false);
check('...and every other field preserved', (() => { const d = { ...payloadFromLast()?.[0] }; delete d.libraryIndex; return d; })(), { date: '2026-10-12', type: 'recipe', locked: false, source: 'library' });

function payloadFromLast() {
    const contents = String(JSON.parse(fetchCalls[0]?.opts?.body ?? 'null')?.contents ?? '');
    const at = contents.indexOf('DATA:');
    try {
        return JSON.parse(contents.slice(at + 5).trim())?.currentProposal;
    } catch {
        return null;
    }
}

reset();
await caught(() => planWeek({
    instruction: 'change Wednesday',
    scopeDates: ['2026-10-12'],
    currentProposal: [storedLibraryDay({ recipeId: 'local-1712345678901' })],
    libraryShortlist: SHORTLIST,
}));
check('an id that is not in the shortlist resolves to null, not a wrong index', payloadFromLast()?.[0]?.libraryIndex, null);
check('...and the unknown id is still not echoed back', 'recipeId' in (payloadFromLast()?.[0] ?? {}), false);

reset();
await caught(() => planWeek({
    instruction: 'keep it',
    scopeDates: ['2026-10-12'],
    currentProposal: [
        { date: '2026-10-12', type: 'recipe', locked: true, source: 'generated', recipe: { title: 'Ad-hoc pie' } },
        { date: '2026-10-13', type: 'leftover', locked: false, sourceDate: '2026-10-12' },
        { date: '2026-10-14', type: 'note', locked: false, note: 'eating out' },
        { date: '2026-10-15', type: 'empty', locked: false },
    ],
    libraryShortlist: SHORTLIST,
}));
check('a generated recipe day passes through untouched', payloadFromLast()?.[0], { date: '2026-10-12', type: 'recipe', locked: true, source: 'generated', recipe: { title: 'Ad-hoc pie' } });
check('a leftover day passes through untouched', payloadFromLast()?.[1], { date: '2026-10-13', type: 'leftover', locked: false, sourceDate: '2026-10-12' });
check('a note day passes through untouched', payloadFromLast()?.[2], { date: '2026-10-14', type: 'note', locked: false, note: 'eating out' });
check('an empty day passes through untouched', payloadFromLast()?.[3], { date: '2026-10-15', type: 'empty', locked: false });
check('a library day with no shortlist at all is null, not a crash', (await (async () => {
    reset();
    await caught(() => planWeek({ instruction: 'x', scopeDates: ['2026-10-12'], currentProposal: [storedLibraryDay()] }));
    return payloadFromLast()?.[0]?.libraryIndex;
})()), null);

console.log('\nthe cook history the planner is given');

reset();
await caught(() => planWeek({ instruction: 'plan the week', scopeDates: ['2026-10-12'], currentProposal: [], libraryShortlist: SHORTLIST }));
const noHistory = sentPayload() ?? {};
check('with no readable history the planner gets [] (it forgets, it still plans)', noHistory?.cookHistory, []);

// A recording stand-in for the Supabase client, shaped enough for recentCookFeedback's query.
let sbCalls = [];
let sbReply = { data: null, error: null };
const sbChain = {
    from(table) { sbCalls.push(['from', table]); return sbChain; },
    select(columns) { sbCalls.push(['select', columns]); return sbChain; },
    order(column, opts) { sbCalls.push(['order', column, opts]); return sbChain; },
    limit(n) { sbCalls.push(['limit', n]); return sbChain; },
    then(onOk, onErr) { return Promise.resolve(sbReply).then(onOk, onErr); },
};
setClient(sbChain);
sbReply = {
    data: [
        { rating: 'loved', note: 'great', cooked_at: '2026-10-11T18:20:00Z', recipes: { title: 'Chili', tags: ['mexican'] } },
        { rating: 'fine', note: null, cooked_at: '2026-10-04T18:20:00Z', recipes: { title: 'Pasta', tags: null } },
        { rating: 'not_again', note: null, cooked_at: '2026-10-01T18:20:00Z', recipes: null },
    ],
    error: null,
};
reset();
await caught(() => planWeek({ instruction: 'plan the week', scopeDates: ['2026-10-12'], currentProposal: [], libraryShortlist: SHORTLIST }));
const withHistory = sentPayload() ?? {};
check('a readable history reaches the prompt', withHistory?.cookHistory?.length, 2);
check('...as the columns the prompt documents', Object.keys(withHistory?.cookHistory?.[0] ?? {}).sort(), ['cooked_at', 'note', 'rating', 'tags', 'title']);
check('...newest first, date-only', withHistory?.cookHistory?.[0], { title: 'Chili', tags: ['mexican'], rating: 'loved', note: 'great', cooked_at: '2026-10-11' });
check('...a null note is omitted rather than sent as null', 'note' in (withHistory?.cookHistory?.[1] ?? {}), false);
check('...a recipe-less row is dropped', withHistory?.cookHistory?.some((h) => h?.title === undefined), false);
check('the query is the documented one', sbCalls.filter((c) => c[0] === 'limit')[0]?.[1], 20);
setClient(null);

console.log('\nthe response — libraryIndex back to a real recipeId');

async function planWithReply(days, summary) {
    reset(() => daysReply(days, summary));
    return caught(() => planWeek({ instruction: 'plan the week', scopeDates: ['2026-10-12', '2026-10-13'], currentProposal: [], libraryShortlist: SHORTLIST }));
}

let result = await planWithReply([{ date: '2026-10-12', type: 'recipe', locked: false, source: 'library', libraryIndex: 0 }]);
check('a library day comes back with a real recipeId', result?.value?.days?.[0]?.recipeId, UUID);
check('...and the index is left in place for the caller', result?.value?.days?.[0]?.libraryIndex, 0);
check('...with the day\'s other fields intact', result?.value?.days?.[0]?.date, '2026-10-12');
check('the summary is returned as given', result?.value?.summary, 'Planned a few dinners.');

result = await planWithReply([{ date: '2026-10-12', type: 'recipe', locked: false, source: 'library', libraryIndex: 5 }]);
check('an out-of-range index degrades to recipeId null, not a crash', result?.value?.days?.[0]?.recipeId, null);

result = await planWithReply([{ date: '2026-10-12', type: 'recipe', locked: false, source: 'library', libraryIndex: 1 }], '');
check('the second shortlist entry resolves to its own id', result?.value?.days?.[0]?.recipeId, OTHER_UUID);
check('a missing summary becomes an empty string, never undefined', result?.value?.summary, '');

result = await planWithReply([
    { date: '2026-10-13', type: 'leftover', locked: false, sourceDate: '2026-10-12' },
    { date: '2026-10-12', type: 'recipe', locked: false, source: 'generated', recipe: { title: 'Ad-hoc pie' } },
    { date: '2026-10-14', type: 'note', locked: false, note: 'takeaway' },
]);
check('a generated day is not given a recipeId', 'recipeId' in (result?.value?.days?.[1] ?? {}), false);
check('a leftover day is not given a recipeId', 'recipeId' in (result?.value?.days?.[0] ?? {}), false);
check('a note day is not given a recipeId', 'recipeId' in (result?.value?.days?.[2] ?? {}), false);
check('day order is preserved', result?.value?.days?.map((d) => d?.date), ['2026-10-13', '2026-10-12', '2026-10-14']);

reset(() => daysReply([], 'nothing to plan'));
result = await caught(() => planWeek({ instruction: 'plan', scopeDates: ['2026-10-12'], currentProposal: [], libraryShortlist: SHORTLIST }));
check('no days is an empty array, not a crash', result?.value?.days, []);

reset(() => response({ text: '```json\n{"days":[{"date":"2026-10-12","type":"note","locked":false}],"summary":"fenced"}\n```' }));
result = await caught(() => planWeek({ instruction: 'plan', scopeDates: ['2026-10-12'], currentProposal: [], libraryShortlist: SHORTLIST }));
check('a reply wrapped in a markdown fence is still parsed', result?.value?.summary, 'fenced');

reset(() => response({ text: '   ' }));
result = await caught(() => planWeek({ instruction: 'plan', scopeDates: ['2026-10-12'], currentProposal: [], libraryShortlist: SHORTLIST }));
check('an empty reply is reported', result?.threw, true);
check('...with the module\'s own message', result?.message, 'The AI returned an empty response.');

reset(() => response({ text: 'not json at all' }));
result = await caught(() => planWeek({ instruction: 'plan', scopeDates: ['2026-10-12'], currentProposal: [], libraryShortlist: SHORTLIST }));
check('a malformed reply throws rather than resolving', result?.threw, true);

console.log('\nthe guards and the error path');

reset(() => daysReply([]));
result = await caught(() => planWeek({ instruction: '   ', scopeDates: [], currentProposal: [], libraryShortlist: [] }));
check('a blank instruction is refused', result?.threw, true);
check('...with the module\'s own message', result?.message, 'Describe the week you want.');
check('...before any request is made', fetchCalls.length, 0);

reset(() => daysReply([]));
result = await caught(() => planWeek({ scopeDates: [], currentProposal: [], libraryShortlist: [] }));
check('a missing instruction is refused too', result?.message, 'Describe the week you want.');

reset(() => { throw new Error('ECONNREFUSED'); });
result = await caught(() => planWeek({ instruction: 'plan', scopeDates: ['2026-10-12'], currentProposal: [], libraryShortlist: SHORTLIST }));
check('a thrown fetch is caught and re-described, not propagated raw', result?.threw, true);
check('...keeping the client\'s user-facing message', result?.message, "Couldn't reach the AI service. Check your connection and try again.");

reset(() => response({ body: { error: JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED', code: 429 } }) } }));
result = await caught(() => planWeek({ instruction: 'plan', scopeDates: ['2026-10-12'], currentProposal: [], libraryShortlist: SHORTLIST }));
check('a proxy-reported quota error is translated by describeApiError', result?.message, 'The AI is rate limited or out of quota — wait a minute and try again.');

reset(() => response({ body: { error: '{"error":{"status":"INVALID_ARGUMENT"}}' } }));
result = await caught(() => planWeek({ instruction: 'plan', scopeDates: ['2026-10-12'], currentProposal: [], libraryShortlist: SHORTLIST }));
check('an INVALID_ARGUMENT is translated too', String(result?.message ?? '').startsWith('The AI rejected the request'), true);

// ───────────────────────────────────────────────────────────────────────────────────────────────
console.log('');
if (failures) {
    console.log(`${failures} FAILED`);
    process.exit(1);
}
console.log('all checks passed');
