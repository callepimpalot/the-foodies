/**
 * TASK_07 checks — `node scripts/task07_check.mjs`
 *
 * Everything asserted here is the part of the Supabase move that can be checked
 * without a database: the DayEntry <-> meal_plans mapping (including the diff
 * that decides what gets deleted, which is where the data-loss risk lives) and the
 * cache/migration helpers. There is no test runner in this project and adding one
 * would be a new build step, so this is a plain script with a non-zero exit code
 * on failure — the same shape the old pantry_check.js had.
 *
 * What is NOT covered, and cannot be here: anything that needs a real Postgres —
 * the RLS policies, the RPCs, and whether the migration applies at all. Those are
 * in the PR description as the reviewer's checklist.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    dayEntryToRow,
    rowToDayEntry,
    planToRows,
    rowsToPlan,
    rowsMatch,
    diffPlan,
} = require('../src/lib/planRows.js');

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

const HID = '11111111-2222-3333-4444-555555555555';
const RECIPE = { id: 'rec-1', title: 'Thai Green Curry', baseServings: 4 };

console.log('\nDayEntry -> meal_plans row');

check('recipe day',
    dayEntryToRow('2026-09-26', { recipe: RECIPE, servings: 4 }, HID),
    {
        household_id: HID, plan_date: '2026-09-26', kind: 'recipe',
        recipe_id: 'rec-1', recipe_snapshot: RECIPE, servings: 4,
        leftover_of_date: null, note: null,
    });

check('recipe day with no explicit servings falls back to baseServings',
    dayEntryToRow('2026-09-26', { recipe: RECIPE }, HID).servings, 4);

check('leftover day',
    dayEntryToRow('2026-09-28', { leftoverOfDate: '2026-09-26' }, HID),
    {
        household_id: HID, plan_date: '2026-09-28', kind: 'leftover',
        recipe_id: null, recipe_snapshot: null, servings: null,
        leftover_of_date: '2026-09-26', note: null,
    });

check('note day',
    dayEntryToRow('2026-09-29', { note: "mum's house" }, HID),
    {
        household_id: HID, plan_date: '2026-09-29', kind: 'note',
        recipe_id: null, recipe_snapshot: null, servings: null,
        leftover_of_date: null, note: "mum's house",
    });

check('an empty entry produces no row rather than a malformed one',
    dayEntryToRow('2026-09-30', {}, HID), null);

check('a missing household produces no row (RLS would refuse it anyway)',
    dayEntryToRow('2026-09-30', { note: 'x' }, null), null);

console.log('\nmeal_plans row -> DayEntry');

check('round trip, all three kinds', (() => {
    const plan = {
        '2026-09-26': { recipe: RECIPE, servings: 4 },
        '2026-09-28': { leftoverOfDate: '2026-09-26' },
        '2026-09-29': { note: "mum's house" },
    };
    return rowsToPlan(planToRows(plan, HID));
})(), {
    '2026-09-26': { recipe: RECIPE, servings: 4 },
    '2026-09-28': { leftoverOfDate: '2026-09-26' },
    '2026-09-29': { note: "mum's house" },
});

check('an unknown kind is dropped rather than guessed at',
    rowToDayEntry({ kind: 'shopping', plan_date: '2026-09-30' }), null);

check('rows compare equal regardless of updated_at',
    rowsMatch({ plan_date: 'd', kind: 'note', note: 'x', updated_at: 1 },
        { plan_date: 'd', kind: 'note', note: 'x', updated_at: 2 }), true);

console.log('\ndiffPlan — what actually gets written and deleted');

const known = planToRows({
    '2026-09-26': { recipe: RECIPE, servings: 4 },
    '2026-09-27': { note: 'eating out' },
}, HID);

check('an untouched plan writes nothing at all',
    (() => {
        const { upserts, deletes } = diffPlan({
            weeklyPlan: {
                '2026-09-26': { recipe: RECIPE, servings: 4 },
                '2026-09-27': { note: 'eating out' },
            },
            householdId: HID, removedDates: [], knownRows: known,
        });
        return { upserts: upserts.length, deletes };
    })(), { upserts: 0, deletes: [] });

check('a changed day is upserted, and only that day',
    (() => {
        const { upserts } = diffPlan({
            weeklyPlan: {
                '2026-09-26': { recipe: RECIPE, servings: 6 },
                '2026-09-27': { note: 'eating out' },
            },
            householdId: HID, removedDates: [], knownRows: known,
        });
        return upserts.map((r) => [r.plan_date, r.servings]);
    })(), [['2026-09-26', 6]]);

check('a cleared day is deleted', (() => {
    const { deletes } = diffPlan({
        weeklyPlan: { '2026-09-26': { recipe: RECIPE, servings: 4 } },
        householdId: HID, removedDates: ['2026-09-27'], knownRows: known,
    });
    return deletes;
})(), ['2026-09-27']);

// The one that matters most: two adults, one plan. This client must not delete a
// day it simply never saw.
check('a day this client never had is NOT deleted', (() => {
    const { deletes } = diffPlan({
        weeklyPlan: { '2026-09-26': { recipe: RECIPE, servings: 4 } },
        householdId: HID, removedDates: [], knownRows: known,
    });
    return deletes;
})(), []);

check('a removal is ignored if the day came back', (() => {
    const { deletes } = diffPlan({
        weeklyPlan: {
            '2026-09-26': { recipe: RECIPE, servings: 4 },
            '2026-09-27': { note: 'eating out' },
        },
        householdId: HID, removedDates: ['2026-09-27'], knownRows: known,
    });
    return deletes;
})(), []);

console.log('\ndocumentCache — corrupt input, backups and the parked write');

const { readJson, writeJson, parkPending, readPending, clearPending, migrateLegacy, markMigrated, isMigrated } =
    require('../src/lib/documentCache.js');

function fakeStorage(seed = {}) {
    const map = new Map(Object.entries(seed));
    return {
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => map.set(k, String(v)),
        removeItem: (k) => map.delete(k),
        _dump: () => Object.fromEntries(map),
    };
}

check('a corrupt cache reads as empty, not as a crash',
    readJson(fakeStorage({ k: '{not json' }), 'k', 'fallback'), 'fallback');

check('a null cache value falls back',
    readJson(fakeStorage({ k: 'null' }), 'k', 'fallback'), 'fallback');

const roundTrip = fakeStorage();
writeJson(roundTrip, 'k', { plan: { d: { note: 'x' } }, list: [1, 2] });
check('write then read survives a round trip',
    readJson(roundTrip, 'k', null), { plan: { d: { note: 'x' } }, list: [1, 2] });

const parked = fakeStorage();
parkPending(parked, 'doc', { a: 1 });
check('a parked write is readable after a "reload"', readPending(parked, 'doc'), { a: 1 });
clearPending(parked, 'doc');
check('clearing the parked write leaves nothing behind', readPending(parked, 'doc'), null);

const legacy = fakeStorage({
    meal_buddy_plan: JSON.stringify({ '2026-09-26': { note: 'x' } }),
    meal_buddy_confirmed: 'true',
});
const result = migrateLegacy(legacy, {
    legacyKeys: ['meal_buddy_plan', 'meal_buddy_confirmed'],
    targetCacheKey: 'meal_buddy_plan_doc',
});
check('the legacy migration finds what is there', result.found, true);
check('it backs the old keys up before anything else',
    [legacy.getItem('meal_buddy_plan__backup_v1') != null,
        legacy.getItem('meal_buddy_confirmed__backup_v1') != null], [true, true]);
check('it does NOT delete the originals',
    [legacy.getItem('meal_buddy_plan') != null, legacy.getItem('meal_buddy_confirmed') != null], [true, true]);
check('it has not marked itself done before the save succeeds',
    isMigrated(legacy, 'meal_buddy_plan_doc'), false);
markMigrated(legacy, 'meal_buddy_plan_doc');
check('after a confirmed save it will not run again',
    migrateLegacy(legacy, {
        legacyKeys: ['meal_buddy_plan'],
        targetCacheKey: 'meal_buddy_plan_doc',
    }).alreadyDone, true);

console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
