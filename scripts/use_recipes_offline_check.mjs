/**
 * useRecipes offline-fallback checks — `node scripts/use_recipes_offline_check.mjs`
 *
 * WHY THIS EXISTS
 * `mapLocalRow()` in `src/hooks/useRecipes.js` is the only path a recipe takes when Supabase is
 * unconfigured or unreachable — a real, observed condition (a paused free-tier project, a phone on a
 * dead network). It read the *database's* column names (`cook_time_minutes`, `cookTimeMinutes`,
 * `cook_time`, `steps`) against a local file that uses none of them, so on the offline path every
 * recipe's `time`/`cook_time` was `null` and every `steps` was `[]`. Measured against the real
 * `final_recipes.json` at the base commit (`5047fd9`), **38/38 rows carry `cooking_time`** and
 * **38/38 carry `instructions`**, while **0/38** carry `cook_time`, `cookTimeMinutes`,
 * `cook_time_minutes` or `steps` — so this was 38 of 38 recipes, not an edge case.
 *
 * What the user saw: `RecipeCard` renders `recipe.time || recipe.cook_time || recipe.prep_time`
 * (a meta line with no cooking time) and `RecipeDetailSheet` renders `current.steps`
 * (`Array.isArray(current.steps) && current.steps.length > 0` → nothing). Cook mode reads
 * `recipe.instructions`, which the spread preserved, so it was unaffected — which is why the defect
 * survived: one of the three consumers kept working.
 *
 * WHAT IT PINS
 *   1. **Every real offline row carries its cooking time.** Loaded from the real 38-row
 *      `final_recipes.json`, not a fixture: for each row `time === cook_time === row.cooking_time`,
 *      non-null and non-empty. The suite refuses to pass vacuously — it first asserts the fixture
 *      itself still has rows carrying `cooking_time`, and that no row has been quietly reshaped.
 *   2. **Every real offline row carries its step list.** `steps` is a non-empty array equal to the
 *      row's `instructions`, and `instructions` survives the spread for cook mode.
 *   3. **The DB path is unchanged.** A Supabase row's numeric `cook_time_minutes` still becomes
 *      `"25m"` and its own `steps` column is still used verbatim — the fix must not re-route the
 *      online path through the local mapper's new fallbacks.
 *   4. **Precedence, on rows that carry both.** A local row with both `cook_time_minutes` and
 *      `cooking_time` formats the number (`"30m"`) rather than passing the string through; a local
 *      row with both `steps` and `instructions` uses `steps`. Only a row carrying both can make
 *      these observable — the same trap recorded for the servings precedence in #48.
 *   5. **`cooking_time` is never suffixed.** It is already display-ready (`"20m"`), so `"20mm"` is
 *      the failure this pins.
 *
 * HOW IT RUNS A HOOK WITH NO REACT
 * Same harness as `scripts/use_recipes_check.mjs` (#48): `registerHooks` intercepts `react`, the
 * `../lib/supabase` client and the JSON import; `useState` is backed by a persistent slot array that
 * re-renders synchronously and `useEffect` is recorded rather than run, so the mount fetch is driven
 * deliberately and no assertion races a floating promise. The hook itself is the real file from disk.
 * The one difference from #48: the JSON import resolves to the **real** `final_recipes.json`, so the
 * offline assertions are made against the shipping library rather than a stand-in. The library stub
 * URL carries a generation counter, which is how the precedence section swaps in synthetic rows and
 * re-imports the hook — a fixed stub URL would be served from Node's module cache.
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * Nothing is rendered — the claim about what `RecipeCard`/`RecipeDetailSheet` do with the mapped
 * object is read from their source, not executed. `final_recipes.json` is a *fallback*: once Supabase
 * is reachable this file is unused, and the real `@supabase/supabase-js` client is not exercised.
 *
 * NEGATIVE CONTROLS (run before trusting a clean result; each mutator asserts its anchor matches
 * exactly once, in a fresh copy of the layout that has its own `node_modules` symlink):
 *   - `cookText` reduced to `r?.cook_time ?? r?.time ?? null` (drop `cooking_time`)
 *     → the real-library section goes red.
 *   - `steps:` fallback reduced to `Array.isArray(r?.steps) ? r.steps : []` (drop `instructions`)
 *     → the real-library section goes red.
 *   - `timeValue` changed to `${cookText}m` when `cookMins == null` (the double-suffix bug)
 *     → the "never double-suffixed" assertion goes red.
 *   - the `cookMins != null ?` branch dropped so the string always wins
 *     → the numeric-precedence assertion goes red.
 *
 * Plain script, non-zero exit on failure — same shape as scripts/use_recipes_check.mjs.
 */
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_LIBRARY = join(HERE, '..', 'final_recipes.json');
const REAL_TEXT = readFileSync(REAL_LIBRARY, 'utf8');

// ---------------------------------------------------------------------------
// module interception

const REACT_STUB = `
export function useState(init) { return globalThis.__mbUseState(init); }
export function useEffect(cb) { globalThis.__mbEffectSink.push(cb); }
`;

// A live binding: the test reassigns it through __setSupabase to reach the "not configured" path.
const SUPABASE_STUB = `
export let supabase = globalThis.__mbSupabase ?? null;
export function __setSupabase(value) { supabase = value; }
`;

// The library stub. Its URL carries a generation counter so a swap of `globalThis.__mbLocalRecipes`
// is not defeated by Node's module cache: bump the counter, re-import the hook, and both the stub and
// the hook are evaluated afresh. Default is the REAL offline library, read off disk.
let libGen = 0;
const libUrl = () => `mb:localRecipes${libGen}`;
const LIBRARY_STUB = () =>
    `export default (globalThis.__mbLocalRecipes ?? ${REAL_TEXT});\n`;

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === 'react') return { url: 'mb:react', format: 'module', shortCircuit: true };
        if (specifier === '../lib/supabase' || specifier === 'mb:supabase') {
            return { url: 'mb:supabase', format: 'module', shortCircuit: true };
        }
        if (specifier.endsWith('final_recipes.json')) {
            return { url: libUrl(), format: 'module', shortCircuit: true };
        }
        // The app's own imports are extensionless, which Vite resolves at build time and bare Node
        // does not — resolve them for this process only.
        if (specifier.startsWith('.') && !/\.[cm]?js$/.test(specifier)) {
            return nextResolve(`${specifier}.js`, context);
        }
        return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
        if (url === 'mb:react') return { format: 'module', source: REACT_STUB, shortCircuit: true };
        if (url === 'mb:supabase') return { format: 'module', source: SUPABASE_STUB, shortCircuit: true };
        if (url.startsWith('mb:localRecipes')) {
            return { format: 'module', source: LIBRARY_STUB(), shortCircuit: true };
        }
        return nextLoad(url, context);
    },
});

const realRows = JSON.parse(REAL_TEXT);

// ---------------------------------------------------------------------------
// fixtures for the paths the real library cannot exercise

const SYNTHETIC_ROWS = [
    { id: 's1', title: 'Both Time Keys', cook_time_minutes: 30, cooking_time: '99m' },
    { id: 's2', title: 'Both Step Keys', steps: ['from steps'], instructions: ['from instructions'] },
    { id: 's3', title: 'Neither Time Nor Steps' },
    { id: 's4', title: 'Blank Cooking Time', cooking_time: '' },
];

// A DB row: the online path must be untouched by the local mapper's new fallbacks.
const DB_ROWS = [
    { id: 'r1', title: 'DB Chili', cook_time_minutes: 25, base_servings: 4, steps: ['Simmer the beans.'] },
];

// ---------------------------------------------------------------------------
// the stub client

function client(handler) {
    const calls = [];
    return {
        calls,
        from(table) {
            calls.push({ table });
            return {
                select(cols) {
                    calls.push({ table, cols });
                    return handler();
                },
            };
        },
    };
}

const okRows = (rows) => client(async () => ({ data: rows, error: null }));
const throwsWith = (message) => client(async () => { throw new Error(message); });

const supabaseStub = await import('mb:supabase');

// ---------------------------------------------------------------------------
// harness

function mount(hookFn) {
    const states = [];
    let out;
    let cursor = 0;
    const effects = [];

    const stateHook = (init) => {
        const idx = cursor++;
        if (idx >= states.length) states[idx] = typeof init === 'function' ? init() : init;
        const set = (value) => {
            const next = typeof value === 'function' ? value(states[idx]) : value;
            if (Object.is(next, states[idx])) return;
            states[idx] = next;
            render();
        };
        return [states[idx], set];
    };

    const render = () => {
        cursor = 0;
        globalThis.__mbUseState = stateHook;
        globalThis.__mbEffectSink = [];
        out = hookFn();
        effects.push(...globalThis.__mbEffectSink);
    };

    render();
    return {
        get result() { return out; },
        async runMountEffects() {
            const pending = effects.splice(0, effects.length);
            for (const effect of pending) effect();
            await flush();
        },
        pendingEffectCount() { return effects.length; },
    };
}

const flush = async () => { for (let i = 0; i < 6; i += 1) await new Promise((r) => setImmediate(r)); };

const HOOK_PATH = join(HERE, '..', 'src', 'hooks', 'useRecipes.js');

/** Import the hook with a cache-busting query so a library swap is actually re-read. */
async function loadHook() {
    const m = await import(`${HOOK_PATH}?gen=${libGen}`);
    return m.useRecipes;
}

async function mountWith(value, hookFn) {
    supabaseStub.__setSupabase(value);
    const h = mount(hookFn);
    const effectCount = h.pendingEffectCount();
    await h.runMountEffects();
    return { h, effectCount };
}

globalThis.__mbLocalRecipes = undefined; // → the real library
let useRecipes = await loadHook();

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

// ---------------------------------------------------------------------------
console.log('\nmodule surface');
check('the only export is useRecipes', typeof useRecipes, 'function');

// ---------------------------------------------------------------------------
console.log('\nthe real offline library still has the shape this suite assumes (vacuous-result guard)');
check('final_recipes.json still carries 38 rows', realRows.length, 38);
check('every row still carries cooking_time',
    realRows.filter((r) => 'cooking_time' in r).length, realRows.length);
check('every row still carries instructions',
    realRows.filter((r) => 'instructions' in r).length, realRows.length);
check('no row has grown a cook_time/cookTimeMinutes/cook_time_minutes key',
    realRows.filter((r) => 'cook_time' in r || 'cookTimeMinutes' in r || 'cook_time_minutes' in r).length, 0);
check('no row has grown a steps key', realRows.filter((r) => 'steps' in r).length, 0);
check('every cooking_time is a non-empty display string',
    realRows.every((r) => typeof r.cooking_time === 'string' && r.cooking_time.length > 0), true);
check('every instructions value is a non-empty array',
    realRows.every((r) => Array.isArray(r.instructions) && r.instructions.length > 0), true);

// ---------------------------------------------------------------------------
console.log('\nsupabase unconfigured — every real offline row keeps its cooking time and steps');
{
    const { h, effectCount } = await mountWith(null, useRecipes);
    const mapped = h.result.recipes;

    check('mount registers exactly one effect (the initial fetch)', effectCount, 1);
    check('the whole offline library is served', mapped.length, realRows.length);
    check('no error is reported for an unconfigured client', h.result.error, null);
    check('loading is false once settled', h.result.loading, false);
    check('rows keep their order and titles',
        mapped.every((r, i) => r.title === realRows[i].title), true);

    const times = mapped.map((r) => r.time);
    check('no row has a null time any more', times.filter((t) => t == null).length, 0);
    check('no row has a null cook_time any more', mapped.filter((r) => r.cook_time == null).length, 0);
    check("every time equals the row's own cooking_time",
        mapped.every((r, i) => r.time === realRows[i].cooking_time), true);
    check('cook_time mirrors time on every row', mapped.every((r) => r.cook_time === r.time), true);
    check('no time was double-suffixed with "m"',
        times.filter((t) => typeof t === 'string' && t.endsWith('mm')).length, 0);
    check("the first row's time is its literal cooking_time",
        [mapped[0].title, times[0]], [realRows[0].title, realRows[0].cooking_time]);

    const stepLengths = mapped.map((r) => (Array.isArray(r.steps) ? r.steps.length : -1));
    check('no row has an empty steps array any more', stepLengths.filter((n) => n === 0).length, 0);
    check('every steps array equals the row\'s own instructions',
        mapped.every((r, i) => JSON.stringify(r.steps) === JSON.stringify(realRows[i].instructions)), true);
    check('instructions survive the spread for cook mode',
        mapped.every((r, i) => JSON.stringify(r.instructions) === JSON.stringify(realRows[i].instructions)), true);
    check('the raw rows still carry their other columns',
        [mapped[0].calories, mapped[0].difficulty], [realRows[0].calories, realRows[0].difficulty]);
    check('servings still comes from base_servings on a local row',
        [mapped[0].servings, mapped[0].baseServings],
        [realRows[0].base_servings, realRows[0].base_servings]);
    check('a local image_url is still used', mapped[0].image_url, realRows[0].image_url);
}

// ---------------------------------------------------------------------------
console.log('\nsupabase unreachable — the same library, still silent, still complete');
{
    const { h } = await mountWith(throwsWith('Failed to fetch'), useRecipes);
    check('the offline library is served', h.result.recipes.length, realRows.length);
    check('an unreachable project is not an error the user sees', h.result.error, null);
    check('no row lost its time on the unreachable path',
        h.result.recipes.filter((r) => r.time == null).length, 0);
    check('no row lost its steps on the unreachable path',
        h.result.recipes.filter((r) => !Array.isArray(r.steps) || r.steps.length === 0).length, 0);
}

// ---------------------------------------------------------------------------
console.log('\nthe online path is unchanged');
{
    const c = okRows(DB_ROWS);
    const { h } = await mountWith(c, useRecipes);
    const [r1] = h.result.recipes;
    check('the DB mapper still runs (one row)', h.result.recipes.length, 1);
    check('cook_time_minutes still becomes "25m"', [r1.time, r1.cook_time], ['25m', '25m']);
    check("the DB row's own steps column is still used verbatim", r1.steps, ['Simmer the beans.']);
    check('the query is recipes/*', c.calls, [{ table: 'recipes' }, { table: 'recipes', cols: '*' }]);
}

// ---------------------------------------------------------------------------
console.log('\nprecedence — only a row carrying both keys can show it');
{
    globalThis.__mbLocalRecipes = SYNTHETIC_ROWS;
    libGen += 1;
    useRecipes = await loadHook();

    const { h } = await mountWith(null, useRecipes);
    const [s1, s2, s3, s4] = h.result.recipes;

    check('the synthetic library is the one being read', h.result.recipes.length, 4);
    check('a numeric cook_time_minutes beats a cooking_time string', [s1.time, s1.cook_time], ['30m', '30m']);
    check('a local steps array beats instructions', s2.steps, ['from steps']);
    check('instructions still survive alongside steps', s2.instructions, ['from instructions']);
    check('a row with neither key gets null, not "nullm"', [s3.time, s3.cook_time], [null, null]);
    check('a row with neither key gets [] for steps', s3.steps, []);
    check('an empty-string cooking_time is passed through as-is', s4.time, '');
}

// ---------------------------------------------------------------------------
console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
