// Merges ingredients from every recipe day in the plan into one checkable list.
// Leftover days are skipped — their ingredients were already counted on the source
// day — but they are still attributed back to that day via `source.leftoverDates`,
// so the Shop breakdown never looks like it silently lost a meal.
//
// Three deterministic layers, no npm dependency and no Gemini call (Shop has to work
// fast and offline, standing in a supermarket with bad signal):
//   1. canonicalName()  — normalise the wording so the same thing merges
//   2. toBaseUnit()     — normalise the measure so the numbers can actually be added
//   3. compound parts   — when two amounts genuinely can't be summed, keep BOTH
//                         ("2 cloves + 30g") instead of destroying the number
//
// The governing bias throughout: **under-merge, never over-merge.** A duplicate row
// is a mild annoyance. A wrong merge is an ingredient silently missing at cook time.

// Explicit .js extension so this module also loads under plain `node` for
// src/scripts/consolidation_check.js — Vite resolves it identically.
import { commonItems } from '../data/commonItems.js';

/* =========================================================
   LAYER 1 — canonicalName()
   ========================================================= */

// Stripped anywhere in the name. These describe what you do to an ingredient,
// not which ingredient it is.
export const PREPARATION_WORDS = [
    'diced', 'chopped', 'minced', 'fresh', 'freshly', 'finely', 'roughly', 'coarsely',
    'large', 'medium', 'small', 'ripe', 'boneless', 'skinless', 'sliced', 'grated',
    'shredded', 'crushed', 'peeled', 'trimmed', 'halved', 'quartered', 'cubed',
    'beaten', 'melted', 'softened', 'washed', 'rinsed', 'drained', 'thinly', 'thickly',
    'optional', 'extra', 'approx', 'about',
];

// Grammatical glue with no shopping meaning.
export const FILLER_WORDS = ['of', 'a', 'an', 'the', 'to', 'into', 'for', 'plus'];

// Measure nouns that leak into the *name* field ("garlic clove", "cloves garlic").
// Stripped only when something else is left behind, so a standalone "cloves" (the
// spice) survives. Deliberately excludes can/tin/jar/packet/bottle — a tinned
// tomato really is a different purchase from a fresh one.
export const MEASURE_WORDS = [
    'clove', 'sprig', 'head', 'bunch', 'stalk', 'slice', 'piece', 'pinch', 'dash',
    'handful', 'knob', 'sheet', 'cube', 'tsp', 'tbsp', 'cup', 'gram', 'kilo',
];

// Non-distinguishing on ANY ingredient.
export const GENERIC_QUALIFIERS = ['organic', 'free-range', 'freerange'];

// Leading qualifiers that are safe to drop, keyed by the exact head noun they
// precede. This is a whitelist ON PURPOSE — a blanket adjective-stripper would
// merge "red pepper" into "green pepper" and "sweet potato" into "potato", which
// is the exact failure this feature exists to avoid. `pepper` and `potato` are
// listed with empty arrays as a standing reminder not to add anything to them.
export const INTERCHANGEABLE_QUALIFIERS = {
    onion: ['yellow', 'white', 'brown', 'red', 'spanish'],
    sugar: ['white', 'granulated', 'caster', 'fine'],
    flour: ['plain', 'all-purpose', 'allpurpose'],
    salt: ['table', 'fine', 'sea', 'kosher'],
    egg: ['free-range'],
    pepper: [],
    potato: [],
    rice: [],
    bread: [],
    milk: [],
    chocolate: [],
};

// Words that end in `s` but are not plurals.
const NEVER_SINGULARISE = new Set([
    'molasses', 'asparagus', 'hummus', 'couscous', 'swiss', 'watercress', 'cress',
    'grass', 'bass', 'brussels', 'anise', 'as', 'is', 'its', 'this',
]);

const IRREGULAR_PLURALS = {
    leaves: 'leaf', loaves: 'loaf', halves: 'half', knives: 'knife',
    children: 'child', geese: 'goose', teeth: 'tooth', feet: 'foot',
};

// Applied to the fully-canonicalised string. Spelling variants only — never two
// genuinely different ingredients.
export const CANONICAL_ALIASES = {
    yoghurt: 'yogurt',
    chilli: 'chili',
    'chick pea': 'chickpea',
    'spring onion': 'scallion',
    'coriander leaf': 'cilantro',
};

function singulariseWord(word) {
    const w = word ?? '';
    if (IRREGULAR_PLURALS?.[w]) return IRREGULAR_PLURALS[w];
    if (w.length <= 3) return w;
    if (NEVER_SINGULARISE.has(w)) return w;
    if (/ies$/.test(w)) return `${w.slice(0, -3)}y`;
    if (/oes$/.test(w)) return w.slice(0, -2);
    if (/(ss|sh|ch|x|z)es$/.test(w)) return w.slice(0, -2);
    if (/(ss|us|is)$/.test(w)) return w;
    if (/s$/.test(w)) return w.slice(0, -1);
    return w;
}

/**
 * canonicalName('Yellow Onions, finely diced (about 200g)') -> 'onion'
 * Returns a lowercase merge key. Empty string when nothing meaningful is left.
 */
export function canonicalName(raw) {
    if (raw == null) return '';

    let text = String(raw).toLowerCase();
    text = text.replace(/\([^)]*\)/g, ' ');   // trailing / inline parentheticals
    text = text.split(',')?.[0] ?? '';        // "onion, diced" -> "onion"
    text = text.replace(/&/g, ' and ');
    text = text.replace(/[^a-z0-9\s-]/g, ' ');
    text = text.replace(/\b\d+([./]\d+)?\b/g, ' '); // stray amounts in the name field
    text = text.replace(/\s+/g, ' ').trim();
    if (!text) return '';

    let words = text.split(' ').filter(Boolean).map(singulariseWord);

    const drop = (list) => {
        const next = words.filter((w) => !list.includes(w));
        // never strip a name out of existence
        return next.length ? next : words;
    };

    words = drop(FILLER_WORDS);
    words = drop(PREPARATION_WORDS);
    if (words.length > 1) words = drop(MEASURE_WORDS);

    // Leading qualifiers, longest-prefix-first, repeated until nothing drops.
    let changed = true;
    while (changed && words.length > 1) {
        changed = false;
        const first = words?.[0] ?? '';
        const rest = words.slice(1).join(' ');
        const allowed = INTERCHANGEABLE_QUALIFIERS?.[rest] ?? null;
        if (GENERIC_QUALIFIERS.includes(first) || (Array.isArray(allowed) && allowed.includes(first))) {
            words = words.slice(1);
            changed = true;
        }
    }

    const canonical = words.join(' ').trim();
    return CANONICAL_ALIASES?.[canonical] ?? canonical;
}

/* =========================================================
   LAYER 2 — toBaseUnit()
   ========================================================= */

// Metric-kitchen conventions (tsp 5 / tbsp 15 / cup 240) rather than the US
// values — this is a European kitchen and the round numbers read better on a
// shopping list. Ambiguous imperial volumes (pint, quart, fl oz — UK and US
// differ) are deliberately absent: they fall through to the count class and get
// their own row rather than being summed wrongly.
export const VOLUME_UNITS_ML = {
    ml: 1, milliliter: 1, millilitre: 1, cc: 1,
    cl: 10, dl: 100,
    l: 1000, liter: 1000, litre: 1000,
    tsp: 5, teaspoon: 5,
    tbsp: 15, tbs: 15, tablespoon: 15,
    cup: 240,
};

export const MASS_UNITS_G = {
    g: 1, gram: 1, gr: 1, gm: 1,
    kg: 1000, kilogram: 1000, kilo: 1000,
    oz: 28.3495, ounce: 28.3495,
    lb: 453.592, pound: 453.592,
};

function normaliseUnit(unit) {
    if (unit == null) return null;
    const u = String(unit).toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
    if (!u) return null;
    // "cloves" -> "clove", "grams" -> "gram"
    const parts = u.split(' ').map(singulariseWord);
    return parts.join(' ');
}

/**
 * toBaseUnit(2, 'tbsp')   -> { quantity: 30, unit: 'ml',    measure: 'volume' }
 * toBaseUnit(1, 'kg')     -> { quantity: 1000, unit: 'g',   measure: 'mass' }
 * toBaseUnit(2, 'cloves') -> { quantity: 2, unit: 'clove',  measure: 'count' }
 * toBaseUnit(3, null)     -> { quantity: 3, unit: null,     measure: 'count' }
 *
 * Countable things are their own class and are NEVER converted into a mass.
 */
export function toBaseUnit(quantity, unit) {
    const u = normaliseUnit(unit);
    const q = typeof quantity === 'number' && Number.isFinite(quantity) ? quantity : null;

    if (u != null && VOLUME_UNITS_ML?.[u] != null) {
        return { quantity: q != null ? q * VOLUME_UNITS_ML[u] : null, unit: 'ml', measure: 'volume' };
    }
    if (u != null && MASS_UNITS_G?.[u] != null) {
        return { quantity: q != null ? q * MASS_UNITS_G[u] : null, unit: 'g', measure: 'mass' };
    }
    return { quantity: q, unit: u, measure: 'count' };
}

// Two amounts can only be added when they land in the same bucket. Volume and
// mass each collapse to one bucket; every distinct count unit keeps its own.
function measureBucket(base) {
    if (base?.measure === 'volume') return 'volume';
    if (base?.measure === 'mass') return 'mass';
    return `count:${base?.unit ?? ''}`;
}

/* =========================================================
   CATEGORISATION
   ========================================================= */

// 'Other' is last and is the fallback. An honest "I don't know" bucket at the end
// beats a confident wrong answer at the front — the old fallback was 'Produce',
// which filed cinnamon, honey, almonds and chocolate as vegetables in the first
// section of the list.
export const CATEGORY_ORDER = [
    'Produce', 'Meat & Fish', 'Dairy & Eggs', 'Bakery', 'Pantry', 'Herbs & Spices',
    'Frozen', 'Other',
];

export const FALLBACK_CATEGORY = 'Other';

// Curated keyword/phrase map. Multi-word phrases always beat single words (see
// pickCategory), which is how "chicken stock" lands in Pantry rather than Meat.
export const CATEGORY_KEYWORDS = {
    'Produce': [
        'onion', 'scallion', 'shallot', 'leek', 'garlic', 'potato', 'sweet potato',
        'carrot', 'celery', 'cucumber', 'tomato', 'lettuce', 'spinach', 'kale',
        'cabbage', 'broccoli', 'cauliflower', 'courgette', 'zucchini', 'aubergine',
        'eggplant', 'mushroom', 'bell pepper',
        'red pepper', 'green pepper', 'yellow pepper', 'chili', 'jalapeno',
        'green bean', 'asparagus', 'white asparagus', 'avocado', 'apple', 'banana',
        'orange', 'lemon', 'lime', 'strawberry', 'raspberry', 'blueberry',
        'blackberry', 'cranberry', 'grape', 'pear', 'peach', 'apricot', 'nectarine',
        'plum', 'cherry', 'mango', 'pineapple', 'melon', 'kiwi', 'rhubarb', 'fig',
        'beetroot', 'radish', 'turnip', 'parsnip', 'squash', 'pumpkin', 'ginger',
        'brussels sprout', 'sprout', 'rocket', 'arugula', 'salad', 'watercress',
        'bean sprout', 'sweetcorn', 'corn on the cob', 'crispy salad',
    ],
    'Meat & Fish': [
        'chicken', 'chicken breast', 'chicken thigh', 'chicken wing', 'beef',
        'ground beef', 'minced beef', 'mince', 'minced pork', 'steak', 'beef steak',
        'pork', 'pork belly', 'pork roast', 'lamb', 'bacon', 'sausage', 'red sausage',
        'ham', 'turkey', 'duck', 'veal', 'brisket', 'liver', 'meatball', 'chorizo',
        'salami', 'pepperoni', 'frankfurter', 'salmon', 'smoked salmon',
        'salmon fillet', 'cod', 'cod fillet', 'haddock', 'plaice', 'herring',
        'pickled herring', 'mackerel', 'trout', 'prawn', 'shrimp', 'crab', 'lobster',
        'mussel', 'squid', 'fish', 'roast beef',
    ],
    'Dairy & Eggs': [
        'milk', 'buttermilk', 'cream', 'sour cream', 'double cream', 'heavy cream',
        'whipping cream', 'creme fraiche', 'butter', 'cheese', 'cheddar cheese',
        'mozzarella', 'parmesan', 'feta', 'feta cheese', 'goat cheese', 'cream cheese',
        'brie', 'halloumi', 'ricotta', 'mascarpone', 'yogurt', 'skyr', 'quark',
        'egg', 'custard',
    ],
    'Bakery': [
        'bread', 'rye bread', 'garlic bread', 'sourdough', 'baguette', 'roll', 'bun',
        'burger bun', 'wrap', 'tortilla', 'corn tortilla', 'pita', 'naan', 'croissant',
        'bagel', 'brioche', 'crumpet', 'pizza dough', 'pastry dough', 'puff pastry',
        'filo pastry', 'tart shell', 'danish pastry',
    ],
    'Pantry': [
        'rice', 'brown rice', 'pasta', 'spaghetti', 'noodle', 'quinoa', 'couscous',
        'barley', 'pearl barley', 'oat', 'flour', 'breadcrumb', 'sugar', 'brown sugar',
        'icing sugar', 'honey', 'syrup', 'maple syrup', 'oil', 'olive oil',
        'vegetable oil', 'sunflower oil', 'sesame oil', 'vinegar', 'balsamic vinegar',
        'soy sauce', 'fish sauce', 'oyster sauce', 'tomato sauce', 'tomato paste',
        'tomato puree', 'passata', 'cream sauce', 'white sauce', 'ketchup',
        'mayonnaise', 'mustard', 'dijon mustard', 'remoulade', 'dressing',
        'honey vinaigrette', 'vinaigrette', 'pickle', 'olive', 'kalamata olive',
        'caper', 'gherkin', 'stock', 'broth', 'bouillon', 'chicken stock',
        'beef stock', 'vegetable stock', 'fish stock', 'stock cube', 'tin', 'tinned',
        'can', 'canned', 'canned tuna', 'tinned tuna', 'jar', 'bean', 'black bean',
        'kidney bean', 'baked bean', 'chickpea', 'lentil', 'split pea', 'nut',
        'almond', 'almond milk', 'walnut', 'cashew', 'peanut', 'peanut butter',
        'pistachio', 'hazelnut', 'pecan', 'seed', 'sesame', 'chia', 'raisin',
        'sultana', 'chocolate', 'dark chocolate', 'cocoa', 'cocoa powder',
        'baking powder', 'baking soda', 'bicarbonate of soda', 'yeast', 'gelatin',
        'gelatine', 'cornstarch', 'cornflour', 'coconut milk', 'coconut cream',
        'coconut flake', 'desiccated coconut', 'curry paste', 'green curry paste',
        'red curry paste', 'harissa', 'tahini', 'hummus', 'tofu', 'jam', 'marmalade',
        'cracker', 'crisp', 'cereal', 'granola', 'tea', 'coffee', 'juice', 'beer',
        'dark beer', 'wine', 'cordial', 'elderflower cordial', 'bamboo shoot',
        'water chestnut', 'crispy onion', 'pesto', 'salsa', 'chutney', 'relish',
        'sauce', 'paste', 'vanilla', 'vanilla extract', 'sun-dried tomato',
    ],
    'Herbs & Spices': [
        'salt', 'pepper', 'black pepper', 'white pepper', 'peppercorn', 'red pepper flake',
        'chili flake', 'chili powder', 'cumin', 'paprika', 'smoked paprika', 'oregano',
        'basil', 'thyme', 'rosemary', 'sage', 'parsley', 'coriander', 'cilantro',
        'dill', 'chive', 'mint', 'tarragon', 'bay leaf', 'cinnamon', 'nutmeg', 'clove',
        'cardamom', 'turmeric', 'ground ginger', 'saffron', 'curry powder', 'cayenne',
        'allspice', 'star anise', 'fennel seed', 'mustard seed', 'garlic powder',
        'onion powder', 'herb', 'spice', 'seasoning', 'powder', 'salt and pepper',
    ],
    'Frozen': [
        'frozen', 'ice cream', 'frozen pea', 'frozen berry', 'sorbet', 'gelato', 'ice',
    ],
};

// `commonItems.js` is the Pantry tab's quick-add data and already carries a
// category per item. Reuse it rather than growing a second, contradicting source
// of truth — but its slugs are Pantry-tab buckets, not supermarket aisles, so
// they need mapping across.
const PANTRY_SLUG_TO_SHOP_CATEGORY = {
    produce: 'Produce',
    protein: 'Meat & Fish',
    dairy: 'Dairy & Eggs',
    grains: 'Pantry',
    canned: 'Pantry',
    condiments: 'Pantry',
    beverages: 'Pantry',
    snacks: 'Pantry',
    frozen: 'Frozen',
    household: 'Other',
    other: 'Other',
};

// The one genuine disagreement between commonItems.js and the aisle map:
// commonItems files Bread under `grains` (correct for a pantry cupboard, wrong
// for a supermarket walk). Overridden here; commonItems.js itself is untouched.
export const COMMON_ITEM_OVERRIDES = { bread: 'Bakery' };

function buildCategoryPatterns() {
    const byPattern = new Map();

    // commonItems first, curated map second — curated wins, and any disagreement
    // is recorded so the check script can surface it rather than hiding it.
    const conflicts = [];

    commonItems?.forEach((group) => {
        group?.items?.forEach((item) => {
            const canonical = canonicalName(item?.name);
            if (!canonical) return;
            const mapped = COMMON_ITEM_OVERRIDES?.[canonical]
                ?? PANTRY_SLUG_TO_SHOP_CATEGORY?.[item?.category]
                ?? FALLBACK_CATEGORY;
            byPattern.set(canonical, mapped);
        });
    });

    Object.entries(CATEGORY_KEYWORDS).forEach(([category, patterns]) => {
        patterns?.forEach((pattern) => {
            if (!pattern) return;
            const existing = byPattern.get(pattern);
            if (existing && existing !== category) {
                conflicts.push({ pattern, commonItems: existing, shop: category });
            }
            byPattern.set(pattern, category);
        });
    });

    const compiled = Array.from(byPattern.entries()).map(([pattern, category]) => ({
        pattern,
        category,
        words: pattern.split(' ').length,
        length: pattern.length,
        regex: new RegExp(`(^|\\s)${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\s)`),
    }));

    return { compiled, conflicts };
}

const { compiled: CATEGORY_PATTERNS, conflicts: CATEGORY_CONFLICTS } = buildCategoryPatterns();

// Exported so the check script can report reconciliation rather than bury it.
export const COMMON_ITEM_CATEGORY_CONFLICTS = CATEGORY_CONFLICTS;

/**
 * categoriseIngredient('chicken stock') -> 'Pantry'  (not Meat & Fish)
 * Unrecognised names return 'Other', which sorts last.
 *
 * Matching is whole-word (so "egg" never matches "eggplant") and the winner is
 * the most specific match: most words first, then longest, then latest in the
 * string — which is why phrases like "coconut milk" beat "milk".
 */
export function categoriseIngredient(name) {
    const canonical = canonicalName(name);
    if (!canonical) return FALLBACK_CATEGORY;

    let best = null;
    CATEGORY_PATTERNS.forEach((entry) => {
        const match = entry.regex.exec(canonical);
        if (!match) return;
        const index = match.index;
        if (
            best === null
            || entry.words > best.words
            || (entry.words === best.words && entry.length > best.length)
            || (entry.words === best.words && entry.length === best.length && index > best.index)
        ) {
            best = { ...entry, index };
        }
    });

    return best?.category ?? FALLBACK_CATEGORY;
}

/* =========================================================
   SHARED HELPERS (unchanged public contract)
   ========================================================= */

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

/* =========================================================
   LAYER 3 — display formatting that never loses a number
   ========================================================= */

const TIGHT_UNITS = new Set(['g', 'ml']);

function roundQuantity(value) {
    if (value == null) return null;
    return Math.round(value * 10) / 10;
}

/** formatMeasure(2, 'clove') -> '2 cloves'; formatMeasure(30, 'g') -> '30g' */
export function formatMeasure(quantity, unit) {
    const q = roundQuantity(quantity);
    if (q == null) return '';
    if (!unit) return `${q}`;
    if (TIGHT_UNITS.has(unit)) return `${q}${unit}`;
    const plural = q !== 1 && !/s$/.test(unit) ? `${unit}s` : unit;
    return `${q} ${plural}`;
}

/**
 * The compound display. Two cloves of garlic and 30g of garlic can't be added,
 * so the row reads "2 cloves + 30g" — showing both is always better than the old
 * behaviour, which set the quantity to null and rendered a blank amount.
 */
export function formatItemQuantity(item) {
    const parts = (item?.parts ?? []).filter((p) => p?.quantity != null);
    if (!parts.length) return '';
    return parts.map((p) => formatMeasure(p?.quantity, p?.unit)).join(' + ');
}

/* =========================================================
   buildShoppingList()
   ========================================================= */

function addPart(item, base) {
    const bucket = measureBucket(base);
    let part = item.parts.find((p) => p?.bucket === bucket);
    if (!part) {
        part = { bucket, unit: base?.unit ?? null, measure: base?.measure ?? 'count', quantity: null };
        item.parts.push(part);
    }
    if (base?.quantity != null) {
        part.quantity = (part.quantity ?? 0) + base.quantity;
    } else {
        item.hasUnquantified = true;
    }
}

export function buildShoppingList(weeklyPlan) {
    const plan = weeklyPlan ?? {};
    const dates = Object.keys(plan).sort();

    // Leftover days contribute no ingredients by design (they were already bought
    // for the source day). Map them back so the breakdown can say so out loud.
    const leftoversBySource = {};
    dates.forEach((date) => {
        const sourceDate = plan?.[date]?.leftoverOfDate;
        if (!sourceDate) return;
        (leftoversBySource[sourceDate] ??= []).push(date);
    });

    const items = new Map();

    dates.forEach((date) => {
        const entry = plan?.[date];
        const recipe = entry?.recipe;
        if (!recipe) return; // leftover references and notes don't add ingredients

        const ratio = getServingsRatio(recipe, entry?.servings);

        (recipe?.ingredients ?? []).forEach((rawIng) => {
            const { name, quantity, unit } = normalizeIngredient(rawIng);
            if (!name) return;

            const displayName = String(name).replace(/\s+/g, ' ').trim();
            const canonical = canonicalName(name);
            if (!canonical) return;

            const scaledQuantity = quantity != null ? quantity * ratio : null;
            const base = toBaseUnit(scaledQuantity, unit);
            const key = `recipe|${canonical}`;

            let item = items.get(key);
            if (!item) {
                item = {
                    key,
                    canonicalName: canonical,
                    name: displayName,        // the original recipe wording, kept legible
                    variants: [],             // every distinct wording that merged in here
                    unit: null,
                    quantity: null,
                    quantityLabel: '',
                    isCompound: false,
                    hasUnquantified: false,
                    parts: [],
                    category: categoriseIngredient(canonical),
                    sources: [],
                };
                items.set(key, item);
            }

            if (!item.variants.includes(displayName)) item.variants.push(displayName);
            addPart(item, base);

            item.sources.push({
                recipeTitle: recipe?.title ?? 'Untitled recipe',
                date,
                name: displayName,
                quantity: base?.quantity ?? null,
                unit: base?.unit ?? null,
                measure: base?.measure ?? 'count',
                // days that eat this meal again as leftovers — attributed here, not dropped
                leftoverDates: leftoversBySource?.[date] ?? [],
            });
        });
    });

    return Array.from(items.values()).map((item) => {
        const quantified = item.parts.filter((p) => p?.quantity != null);
        return {
            ...item,
            quantityLabel: formatItemQuantity(item),
            isCompound: quantified.length > 1,
            // Back-compat scalars: only meaningful when there is exactly one part.
            quantity: quantified.length === 1 ? roundQuantity(quantified?.[0]?.quantity) : null,
            unit: quantified.length === 1 ? (quantified?.[0]?.unit ?? null) : null,
        };
    });
}
