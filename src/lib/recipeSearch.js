import { normalizeIngredient } from './consolidateIngredients';

// Each filter group holds a list of selectable options; every option carries its own
// match(recipe) predicate, so a group can mix tag-based options (meal type, diet, ...)
// with field-based ones (is_personal, creator) under one consistent model.
// A selection is identified by a composite key: `${groupId}:${optionId}`.

function tagOptions(tags) {
    return tags.map((tag) => ({ id: tag, label: tag, match: (r) => !!r?.tags?.includes(tag) }));
}

// Curated, human-meaningful subset of the real `tags` values live in Supabase.
// Verified against actual data (Aug 15): meal_type, difficulty, and archetypes
// are null/empty for 400 of 403 recipes — tags is the only taxonomy with real
// coverage, so filters are built from it, not from those other columns.
// Excludes source-attribution noise (e.g. "Bon Appétit") and long-tail
// ingredient tags that would make the filter sheet unusable.
export const FILTER_GROUPS = [
    {
        id: 'source',
        label: 'Source',
        options: [
            { id: 'my-recipes', label: 'My Recipes', match: (r) => !!r?.is_personal },
        ],
    },
    {
        id: 'mealType',
        label: 'Meal Type',
        options: tagOptions(['Dinner', 'Lunch', 'Breakfast']),
    },
    {
        id: 'diet',
        label: 'Diet & Allergies',
        options: tagOptions(['Vegetarian', 'Pescatarian', 'Dairy Free', 'Wheat/Gluten-Free', 'Kosher', 'Peanut Free', 'Soy Free', 'Tree Nut Free', 'No Sugar Added']),
    },
    {
        id: 'method',
        label: 'Method & Type',
        options: tagOptions(['Quick & Easy', 'Salad', 'Soup/Stew', 'Bake', 'Grill/Barbecue', 'Sauté', 'Roast', 'Side', 'Pasta']),
    },
    {
        id: 'season',
        label: 'Season',
        options: tagOptions(['Summer', 'Fall', 'Winter', 'Spring']),
    },
];

// Always-visible chips above the "More filters" sheet.
export const QUICK_FILTERS = [
    { key: 'source:my-recipes', label: 'My Recipes' },
    { key: 'mealType:Dinner', label: 'Dinner' },
    { key: 'mealType:Lunch', label: 'Lunch' },
    { key: 'mealType:Breakfast', label: 'Breakfast' },
    { key: 'diet:Vegetarian', label: 'Vegetarian' },
    { key: 'method:Quick & Easy', label: 'Quick & Easy' },
];

// Builds a "Creator" filter group from whatever creator names are actually present
// in the current recipe set — there's no fixed taxonomy here, it grows as recipes
// are captured with attribution. Returns null when no recipe has a creator yet, so
// the filter sheet can skip rendering an empty section.
export function buildCreatorGroup(recipes) {
    const counts = new Map();
    (recipes || []).forEach((r) => {
        const name = r?.creator?.trim();
        if (!name) return;
        counts.set(name, (counts.get(name) || 0) + 1);
    });
    if (counts.size === 0) return null;

    const options = [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name, count]) => ({
            id: name,
            label: `${name} (${count})`,
            match: (r) => r?.creator?.trim() === name,
        }));

    return { id: 'creator', label: 'Creator', options };
}

const ALL_CURATED_TAGS = FILTER_GROUPS
    .filter((group) => group.id !== 'source')
    .flatMap((group) => group.options.map((option) => option.id));

// Up to `max` recipe tags worth showing as chips on a card/detail view —
// filtered to the curated taxonomy so noise tags never surface in the UI.
export function getDisplayTags(recipe, max = 2) {
    const tags = recipe?.tags || [];
    return ALL_CURATED_TAGS.filter((tag) => tags.includes(tag)).slice(0, max);
}

function recipeSearchText(recipe) {
    const parts = [
        recipe?.title,
        recipe?.name,
        recipe?.creator,
        ...(recipe?.tags || []),
        ...(recipe?.ingredients || []).map((ing) => normalizeIngredient(ing).name),
    ];
    return parts.filter(Boolean).join(' ').toLowerCase();
}

function flattenGroups(groups) {
    const index = new Map();
    (groups || []).forEach((group) => {
        group.options.forEach((option) => {
            index.set(`${group.id}:${option.id}`, option);
        });
    });
    return index;
}

// Group-aware faceted filtering: selections within a group are OR'd
// (e.g. "Dinner" or "Lunch"), selections across groups are AND'd
// (e.g. (Dinner or Lunch) and Vegetarian and My Recipes).
// `groups` should be FILTER_GROUPS plus any dynamic groups (e.g. buildCreatorGroup's result).
export function filterRecipes(recipes, { query, activeKeys, groups } = {}) {
    const q = (query || '').trim().toLowerCase();
    const activeSet = new Set(activeKeys || []);
    const optionIndex = flattenGroups(groups && groups.length ? groups : FILTER_GROUPS);

    return (recipes || []).filter((recipe) => {
        if (activeSet.size > 0) {
            const selectedByGroup = new Map();
            activeSet.forEach((key) => {
                const option = optionIndex.get(key);
                if (!option) return;
                const groupId = key.slice(0, key.lastIndexOf(':'));
                if (!selectedByGroup.has(groupId)) selectedByGroup.set(groupId, []);
                selectedByGroup.get(groupId).push(option);
            });
            for (const options of selectedByGroup.values()) {
                if (!options.some((option) => option.match(recipe))) return false;
            }
        }

        if (!q) return true;
        return recipeSearchText(recipe).includes(q);
    });
}
