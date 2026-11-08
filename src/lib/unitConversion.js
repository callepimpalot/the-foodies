// Deterministic metric <-> imperial conversion for ingredient measurements.
//
// WHY THIS IS CODE AND NOT A PROMPT
// ---------------------------------
// Until this module existed, `refineRecipe` asked the model, in prose, to "use metric units
// for every quantity". Doing arithmetic + reformatting in prose is the trigger for two
// measured defects on the live provider (google/gemini-2.5-flash via OpenRouter, driven with
// the app's real REFINE_PROMPT + REFINE_SCHEMA against a real production recipe row):
//
//   * the model returns a bare `unit` with the `quantity` field gone — e.g. a row that was
//     `{name:'Peanut butter', quantity:0.5, unit:'cup'}` comes back `{name:'Peanut butter',
//     unit:'g'}`. 9 of 10 ingredients lost their measurement. That is silent data destruction.
//   * it crams name + number into the `unit` string — `{name:'Pork mince', unit:'g  Pork
//     mince  250'}` with no `quantity`. This one is caused by the proxy sending
//     `response_format.json_schema.strict = false` (see openRouterRequest.js: the app schema
//     uses `nullable: true`, so nothing enforces the shape).
//
// Converting units is deterministic arithmetic. It belongs here — one function, unit-testable
// with no network and no model, driven directly by `scripts/refine_contract_check.mjs`.
//
// Deliberately dependency-free and side-effect-free, like planRows.js / weekWindow.js.

// The units the app actually emits, mapped to their measurement family and their size in that
// family's base unit (g for mass, ml for volume). Factors are the standard US-customary /
// metric definitions, so a round trip A -> B -> A returns the original quantity.
const UNITS = {
    g:    { family: 'mass',   factor: 1 },
    kg:   { family: 'mass',   factor: 1000 },
    oz:   { family: 'mass',   factor: 28.349523125 },
    lb:   { family: 'mass',   factor: 453.59237 },
    ml:   { family: 'volume', factor: 1 },
    l:    { family: 'volume', factor: 1000 },
    tsp:  { family: 'volume', factor: 4.92892159375 },
    tbsp: { family: 'volume', factor: 14.78676478125 },
    cup:  { family: 'volume', factor: 236.5882365 },
};

// Units that COUNT things rather than measure them. A clove is a clove and a stalk is a stalk,
// so they carry no conversion in either direction and pass through untouched. Anything NOT in
// UNITS also passes through untouched: guessing at an unknown unit is exactly how a measurement
// gets destroyed, which is the defect this module exists to stop.
const COUNT_UNITS = new Set([
    'clove', 'cloves', 'stalk', 'stalks', 'pinch', 'pinches', 'slice', 'slices',
    'can', 'cans', 'packet', 'packets', 'sprig', 'sprigs', 'piece', 'pieces',
    'handful', 'handfuls', 'bunch', 'bunches', 'sheet', 'sheets', 'dash', 'dashes',
]);

// A bare unit token never carries digits and is never a sentence. Cap the length so a stuffed
// unit ("g  Pork mince  250", "g, diced or minced (…)") is rejected rather than treated as a unit.
export const MAX_UNIT_LENGTH = 12;

export const UNIT_SYSTEMS = ['metric', 'imperial'];

/** Lowercase/trim a unit. Returns null for a non-string or an empty string. */
export function canonicalUnit(unit) {
    if (typeof unit !== 'string') return null;
    const u = unit.trim().toLowerCase();
    return u || null;
}

export function isConvertibleUnit(unit) {
    const u = canonicalUnit(unit);
    return !!u && Object.prototype.hasOwnProperty.call(UNITS, u);
}

export function isCountUnit(unit) {
    const u = canonicalUnit(unit);
    return !!u && COUNT_UNITS.has(u);
}

export function unitFamily(unit) {
    const u = canonicalUnit(unit);
    return u && UNITS[u] ? UNITS[u].family : null;
}

function toBase(quantity, unit) {
    const spec = UNITS[canonicalUnit(unit)];
    if (!spec) return null;
    return { family: spec.family, value: quantity * spec.factor };
}

// Pick the target-system unit a base measurement should display in. Thresholds are the natural
// cooking breakpoints: 1 lb / 1 oz for mass; 1 cup / 1 tbsp for volume; 1 l / 1 kg for metric.
function displayUnit(family, baseValue, targetSystem) {
    const magnitude = Math.abs(baseValue);
    if (targetSystem === 'imperial') {
        if (family === 'mass') return magnitude >= UNITS.lb.factor ? 'lb' : 'oz';
        return magnitude >= UNITS.cup.factor ? 'cup'
             : magnitude >= UNITS.tbsp.factor ? 'tbsp' : 'tsp';
    }
    if (family === 'mass') return magnitude >= 1000 ? 'kg' : 'g';
    return magnitude >= 1000 ? 'l' : 'ml';
}

// Two decimals, but never round a small non-zero value to 0 (0.01 tsp must not become 0).
function roundQuantity(value) {
    if (!Number.isFinite(value)) return value;
    const rounded = Math.round(value * 100) / 100;
    return rounded === 0 && value !== 0 ? Number(value.toPrecision(2)) : rounded;
}

/**
 * convertIngredient({ name, quantity, unit }, targetSystem) -> a NEW ingredient object.
 *
 * `targetSystem` is 'metric' or 'imperial' (anything else is treated as metric, the app's default).
 *
 * - countable units (cloves, stalks, pinch, …) and unknown units pass through with the quantity
 *   untouched — a conversion is NEVER allowed to drop a measurement.
 * - a missing/non-numeric quantity passes through with its unit untouched (a "pinch" has no number).
 * - a convertible unit is converted via the base unit, so converting A -> B -> A returns the
 *   original quantity, within rounding.
 */
export function convertIngredient(ingredient, targetSystem) {
    const ing = ingredient ?? {};
    const system = targetSystem === 'imperial' ? 'imperial' : 'metric';
    const out = { name: ing.name, quantity: ing.quantity, unit: ing.unit };

    const qty = ing.quantity;
    if (typeof qty !== 'number' || !Number.isFinite(qty)) return out;

    const spec = UNITS[canonicalUnit(ing.unit)];
    if (!spec) return out; // countable or unknown — never guess

    const base = toBase(qty, ing.unit);
    const target = displayUnit(spec.family, base.value, system);
    out.unit = target;
    out.quantity = roundQuantity(base.value / UNITS[target].factor);
    return out;
}

/** Convert a whole ingredient list in one pass. */
export function convertIngredients(ingredients, targetSystem) {
    return (Array.isArray(ingredients) ? ingredients : []).map((i) => convertIngredient(i, targetSystem));
}

/**
 * Deterministic temperature conversion. Returns null for a non-numeric value. `toUnit` is
 * 'c' / '°c' / 'celsius' or 'f' / '°f' / 'fahrenheit'.
 */
export function convertTemperature(value, toUnit) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    const target = canonicalUnit(toUnit);
    if (target === 'f' || target === '°f' || target === 'fahrenheit') return roundQuantity(value * 9 / 5 + 32);
    if (target === 'c' || target === '°c' || target === 'celsius') return roundQuantity((value - 32) * 5 / 9);
    return value;
}
