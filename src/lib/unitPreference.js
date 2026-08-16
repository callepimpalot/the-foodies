const STORAGE_KEY = 'meal_buddy_unit_system';

// Persisted user preference for which unit system new AI-produced ingredient lists should use —
// Capture extraction/refinement and the week planner's AI-generated dishes. Read fresh on every
// call rather than cached, so a toggle takes effect immediately on the next request.
export function getUnitSystem() {
    try {
        return localStorage.getItem(STORAGE_KEY) === 'imperial' ? 'imperial' : 'metric';
    } catch {
        return 'metric';
    }
}

export function setUnitSystem(value) {
    const next = value === 'imperial' ? 'imperial' : 'metric';
    try {
        localStorage.setItem(STORAGE_KEY, next);
    } catch {
        // localStorage unavailable — preference just won't persist across reloads this session
    }
    return next;
}

export const UNIT_SYSTEM_INSTRUCTIONS = {
    metric: 'Use metric units only for every quantity — grams (g) or kilograms (kg) for weight, millilitres (ml) or litres (l) for volume, °C for temperature. Convert any imperial units the source uses (cups, tbsp, tsp, oz, lb, °F, etc.) into their metric equivalents.',
    imperial: 'Use US customary units for every quantity — cups, tablespoons (tbsp), teaspoons (tsp), ounces (oz), pounds (lb), °F for temperature. Convert any metric units the source uses (g, kg, ml, l, °C, etc.) into their imperial equivalents.',
};

export function unitSystemInstruction() {
    return UNIT_SYSTEM_INSTRUCTIONS[getUnitSystem()];
}
