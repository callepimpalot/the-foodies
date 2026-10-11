/**
 * Date + unit-preference checks — `node scripts/date_unit_helpers_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/lib/useByDates.js` and `src/lib/unitPreference.js` are the two app-logic modules that
 * every check script in this directory walked past. Measured, not assumed: `git grep` for either
 * module name across all 23 heads returns nothing under `scripts/` (only an archived feature doc
 * mentions `recipeImport`, a module no branch carries). Every other pure-logic module in
 * `src/lib/` is asserted somewhere — planRows (task07), stepIngredients (step_ingredients),
 * recipeSearch's creator grouping (creator_group), consolidateIngredients (consolidation),
 * the capture router (capture_routing) — so this file closes the last gap.
 *
 * Both modules sit on paths where a silent wrong answer costs the user something real:
 *
 *  - `daysUntil` / `expiringItems` decide whether the Home screen says anything at all about food
 *    about to go off. Off by one day and it either misses tonight's dinner or nags about food that
 *    is fine. The module's own header is explicit that it must stay quiet when there is nothing to
 *    say, so the empty and boundary cases are pinned here in both directions.
 *  - `isoInDays` and `daysUntil` are only correct together: they must both use *local* midnight, or
 *    the round trip drifts by a day for anyone not on UTC. That pairing is asserted directly.
 *  - `unitPreference.js` chooses the unit system that Capture extraction and the week planner ask
 *    Gemini for. `setUnitSystem` writes the preference under a literal storage key: renaming it
 *    silently reverts every existing user to metric, so the key itself is pinned.
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * This is a node-level logic check. It renders nothing, exercises no React context, calls no
 * Gemini and touches no database — the same scope note as every other script in this directory.
 * It also does not prove which components call these helpers; that is a grep, not a test.
 *
 * Plain script, non-zero exit on failure — same shape as scripts/task07_check.mjs.
 */
import {
    EXPIRY_HORIZON_DAYS,
    parseUseByDate,
    daysUntil,
    isoInDays,
    describeUseBy,
    expiringItems,
} from '../src/lib/useByDates.js';

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

/** Today at local midnight — computed here, independently of the module, for expected values. */
function localMidnight(offsetDays = 0) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offsetDays);
    return d;
}

console.log('\nuseByDates — parsing');

check('an unparseable date is null, not an Invalid Date', parseUseByDate('not-a-date'), null);
check('an empty string is null', parseUseByDate(''), null);
check('a missing date is null', parseUseByDate(undefined), null);
check('a null date is null', parseUseByDate(null), null);
check('a real ISO date parses to local midnight',
    parseUseByDate('2026-10-15')?.getHours(), 0);
check('...and to the 15th', parseUseByDate('2026-10-15')?.getDate(), 15);
check('a full timestamp is still accepted (the app stores plain dates)',
    parseUseByDate('2026-10-15') !== null, true);

console.log('\nuseByDates — day arithmetic');

check('daysUntil of an unusable date is null', daysUntil('nonsense'), null);
check('daysUntil of a missing date is null', daysUntil(undefined), null);
check('today is 0', daysUntil(isoInDays(0)), 0);
check('tomorrow is 1', daysUntil(isoInDays(1)), 1);
check('yesterday is -1', daysUntil(isoInDays(-1)), -1);
check('a week out is 7', daysUntil(isoInDays(7)), 7);
check('a week back is -7', daysUntil(isoInDays(-7)), -7);
check('the isoInDays/daysUntil round trip holds for every offset in a month',
    Array.from({ length: 31 }, (_, i) => daysUntil(isoInDays(i - 15))),
    Array.from({ length: 31 }, (_, i) => i - 15));

check('isoInDays(0) is today in the local calendar',
    isoInDays(0),
    `${localMidnight(0).getFullYear()}-${String(localMidnight(0).getMonth() + 1).padStart(2, '0')}-${String(localMidnight(0).getDate()).padStart(2, '0')}`);
check('isoInDays returns a zero-padded YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(isoInDays(5)), true);
check('isoInDays crosses a month boundary correctly',
    daysUntil(isoInDays(31)) - daysUntil(isoInDays(30)), 1);

console.log('\nuseByDates — labels');

check('no date, no label', describeUseBy(null), '');
check('today', describeUseBy(isoInDays(0)), 'Today');
check('tomorrow', describeUseBy(isoInDays(1)), 'Tomorrow');
check('yesterday', describeUseBy(isoInDays(-1)), 'Yesterday');
check('further back counts the days', describeUseBy(isoInDays(-3)), '3 days ago');

const weekdayName = localMidnight(2).toLocaleDateString('en-US', { weekday: 'long' });
check('two days out is a weekday name', describeUseBy(isoInDays(2)), weekdayName);
check('...and not the month-day form', /^[A-Z][a-z]{2} \d{1,2}$/.test(describeUseBy(isoInDays(2))), false);

const daySix = localMidnight(6).toLocaleDateString('en-US', { weekday: 'long' });
check('six days out is still a weekday name (the horizon edge)', describeUseBy(isoInDays(6)), daySix);
check('seven days out switches to month-day', /^[A-Z][a-z]{2} \d{1,2}$/.test(describeUseBy(isoInDays(7))), true);
check('...and is no longer a weekday name', describeUseBy(isoInDays(7)) === daySix, false);

console.log('\nuseByDates — expiringItems');

check('the horizon is three days', EXPIRY_HORIZON_DAYS, 3);
check('no items is an empty list', expiringItems(undefined), []);
check('a null list is an empty list', expiringItems(null), []);

const apple = { id: 'a', name: 'Apple', useByDate: isoInDays(3) };
const banana = { id: 'b', name: 'Banana', useByDate: isoInDays(1) };
const cheese = { id: 'c', name: 'Cheese', useByDate: isoInDays(-4) };
const dough = { id: 'd', name: 'Dough', useByDate: isoInDays(4) };
const egg = { id: 'e', name: 'Egg' };
const fig = { id: 'f', name: 'Fig', useByDate: 'not-a-date' };
const inventory = [apple, banana, cheese, dough, egg, fig];

// The return shape is { item, days } — the caller renders the day count, so assert it too.
const surfaced = expiringItems(inventory);
check('the result carries each item with its day count',
    surfaced.map((e) => [e.item.id, e.days]),
    [['c', -4], ['b', 1], ['a', 3]]);
check('only items at or inside the horizon come back, soonest first',
    surfaced.map((e) => e.item.id), ['c', 'b', 'a']);
check('an item exactly on the horizon is included', surfaced.some((e) => e.item === apple), true);
check('an item one day beyond it is not', surfaced.some((e) => e.item === dough), false);
check('an item with no date is not surfaced', surfaced.some((e) => e.item === egg), false);
check('an item with a broken date is not surfaced', surfaced.some((e) => e.item === fig), false);
check('an already-past item is kept — that is the most waste-prone case',
    surfaced.some((e) => e.item === cheese), true);
check('the surfaced items are the caller\'s own objects, not copies',
    surfaced[0].item === cheese, true);
check('the input array is not reordered by the call',
    inventory.map((i) => i.id), ['a', 'b', 'c', 'd', 'e', 'f']);

check('a custom horizon of 0 keeps only today and the past',
    expiringItems(inventory, 0).map((e) => e.item.id), ['c']);
check('a custom horizon of 1 adds tomorrow',
    expiringItems(inventory, 1).map((e) => e.item.id), ['c', 'b']);

const sameDayB = { id: 'b2', name: 'Beans', useByDate: isoInDays(2) };
const sameDayA = { id: 'a2', name: 'Apricots', useByDate: isoInDays(2) };
check('a same-day tie breaks by name, not by input order',
    expiringItems([sameDayB, sameDayA]).map((e) => e.item.id), ['a2', 'b2']);
check('nothing to say is an empty list, not a placeholder row',
    expiringItems([dough, egg]), []);

console.log('\nunitPreference — the stored preference');

/** A localStorage stand-in shaped like the real one, recording the keys it is asked for. */
function fakeStorage(initial = {}, opts = {}) {
    const map = new Map(Object.entries(initial));
    return {
        map,
        getItem(k) {
            if (opts.throwOnGet) throw new Error('storage unavailable');
            return map.has(k) ? map.get(k) : null;
        },
        setItem(k, v) {
            if (opts.throwOnSet) throw new Error('storage unavailable');
            map.set(k, String(v));
        },
        removeItem(k) { map.delete(k); },
    };
}

async function withStorage(storage, fn) {
    const previous = globalThis.localStorage;
    globalThis.localStorage = storage;
    try {
        return await fn();
    } finally {
        if (previous === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previous;
    }
}

const { getUnitSystem, setUnitSystem, unitSystemInstruction, UNIT_SYSTEM_INSTRUCTIONS } =
    await import('../src/lib/unitPreference.js');

check('with nothing stored the default is metric',
    await withStorage(fakeStorage(), () => getUnitSystem()), 'metric');
check('an explicit imperial preference reads back',
    await withStorage(fakeStorage({ meal_buddy_unit_system: 'imperial' }), () => getUnitSystem()), 'imperial');
check('a value that is not exactly "imperial" falls back to metric',
    await withStorage(fakeStorage({ meal_buddy_unit_system: 'IMPERIAL' }), () => getUnitSystem()), 'metric');

const writeStore = fakeStorage();
check('setting imperial returns the new value',
    await withStorage(writeStore, () => setUnitSystem('imperial')), 'imperial');
check('...and persists it under the key existing users already have',
    [...writeStore.map.keys()], ['meal_buddy_unit_system']);
check('...so the next read agrees',
    await withStorage(writeStore, () => getUnitSystem()), 'imperial');

const junkStore = fakeStorage({ meal_buddy_unit_system: 'imperial' });
check('an unrecognised argument is coerced to metric, not stored as-is',
    await withStorage(junkStore, () => setUnitSystem('banana')), 'metric');
check('...and overwrites the junk rather than leaving it behind',
    junkStore.map.get('meal_buddy_unit_system'), 'metric');

check('a storage that throws on read still yields metric',
    await withStorage(fakeStorage({}, { throwOnGet: true }), () => getUnitSystem()), 'metric');
check('a storage that throws on write still returns the value it applied',
    await withStorage(fakeStorage({}, { throwOnSet: true }), () => setUnitSystem('imperial')), 'imperial');

console.log('\nunitPreference — the prompt instruction');

check('the instruction shown matches the stored preference',
    await withStorage(fakeStorage({ meal_buddy_unit_system: 'imperial' }), () => unitSystemInstruction()),
    UNIT_SYSTEM_INSTRUCTIONS.imperial);
check('metric and imperial instructions are different texts',
    UNIT_SYSTEM_INSTRUCTIONS.metric === UNIT_SYSTEM_INSTRUCTIONS.imperial, false);
check('the metric instruction names the metric units it wants',
    ['g', 'kg', 'ml', '°C'].every((u) => UNIT_SYSTEM_INSTRUCTIONS.metric.includes(u)), true);
check('the imperial instruction names the US units it wants',
    ['cups', 'tbsp', 'oz', '°F'].every((u) => UNIT_SYSTEM_INSTRUCTIONS.imperial.includes(u)), true);
check('both instructions ask for conversion of the other system',
    [UNIT_SYSTEM_INSTRUCTIONS.metric.includes('Convert'), UNIT_SYSTEM_INSTRUCTIONS.imperial.includes('Convert')],
    [true, true]);

console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
