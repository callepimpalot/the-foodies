import { RECIPES } from '../data/recipes';

// Calculates a "Match Score" for a recipe based on inventory
// Returns { score: number, missing: string[] }
export function calculateMatch(recipe, inventory) {
    const missing = recipe.ingredients.filter(ing => !inventory.includes(ing));
    const hasCount = recipe.ingredients.length - missing.length;
    const score = hasCount / recipe.ingredients.length; // 0 to 1
    return { score, missing };
}

export function generateJackpot(archetypeId, inventory, strictMode = false) {
    // 1. Filter by Archetype (loosely - if a recipe matches the vibe)
    let candidates = RECIPES.filter(r => r.archetypes.includes(archetypeId));

    // If no direct matches, fallback to all recipes (fallback mode)
    if (candidates.length === 0) candidates = RECIPES;

    // 2. Score by Inventory
    const scored = candidates.map(r => {
        const { score, missing } = calculateMatch(r, inventory);
        return { ...r, score, missing };
    });

    // 3. Filter based on Mode
    let pool;
    if (strictMode) {
        // Pantry Only: strictly 100% match
        pool = scored.filter(r => r.score === 1);
    } else {
        // Shopping Mode: Prioritize high matches, but allow others
        const highMatch = scored.filter(r => r.score >= 0.5);
        pool = highMatch.length > 0 ? highMatch : scored;
    }

    // Return null if no matches in strict mode
    if (pool.length === 0) return null;

    // 4. Pick Random Winner
    const winner = pool[Math.floor(Math.random() * pool.length)];
    return winner;
}
