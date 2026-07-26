// Merges ingredients from every recipe day in the plan into one checkable list.
// Leftover days are skipped — their ingredients were already counted on the source day.
export function categoriseIngredient(name) {
    const n = (name || '').toLowerCase();
    if (/chicken|beef|pork|lamb|fish|salmon|tuna|shrimp|bacon|sausage/.test(n)) return 'Meat & Fish';
    if (/milk|cream|butter|cheese|yogurt|egg/.test(n)) return 'Dairy & Eggs';
    if (/bread|baguette|roll|wrap|tortilla/.test(n)) return 'Bakery';
    if (/frozen|ice cream/.test(n)) return 'Frozen';
    if (/pasta|rice|flour|sugar|oil|vinegar|sauce|stock|tin|can|jar|spaghetti/.test(n)) return 'Pantry';
    if (/herb|spice|pepper|salt|cumin|paprika|oregano|basil|thyme|parsley|garlic/.test(n)) return 'Herbs & Spices';
    return 'Produce';
}

export const CATEGORY_ORDER = [
    'Produce', 'Meat & Fish', 'Dairy & Eggs', 'Bakery', 'Pantry', 'Herbs & Spices', 'Frozen',
];

// Supabase rows use {name, quantity, unit}; the local final_recipes.json
// fallback uses the older {item, amount, unit} shape — accept either.
export function normalizeIngredient(ing) {
    if (typeof ing === 'string') return { name: ing, quantity: null, unit: null };

    const name = ing?.name ?? ing?.item ?? null;
    const unit = ing?.unit ?? null;
    const rawQuantity = ing?.quantity ?? ing?.amount ?? null;
    const quantity = typeof rawQuantity === 'number' ? rawQuantity : (parseFloat(rawQuantity) || null);

    return { name, quantity, unit };
}

export function getServingsRatio(recipe, servings) {
    const baseServings = recipe?.baseServings || 2;
    const actualServings = servings || baseServings;
    return baseServings > 0 ? actualServings / baseServings : 1;
}

export function buildShoppingList(weeklyPlan) {
    const items = new Map();

    Object.values(weeklyPlan).forEach((entry) => {
        const recipe = entry?.recipe;
        if (!recipe) return; // leftover references and notes don't add ingredients

        const ratio = getServingsRatio(recipe, entry.servings);

        (recipe.ingredients || []).forEach((rawIng) => {
            const { name, quantity, unit } = normalizeIngredient(rawIng);
            if (!name) return;

            const scaledQuantity = quantity != null ? quantity * ratio : null;
            const key = `${name.toLowerCase()}|${unit ?? ''}`;

            const existing = items.get(key);
            if (existing) {
                existing.quantity = existing.quantity != null && scaledQuantity != null
                    ? existing.quantity + scaledQuantity
                    : null;
            } else {
                items.set(key, {
                    key,
                    name,
                    unit,
                    quantity: scaledQuantity,
                    category: categoriseIngredient(name),
                });
            }
        });
    });

    return Array.from(items.values());
}
