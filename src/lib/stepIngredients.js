// TASK 10 — which ingredients does THIS step need?
//
// Two sources, in order of trust:
//   1. Explicit links stored with the recipe (`recipe.step_ingredients`, or indexes
//      carried on a step object). Newly captured recipes get these from the Gemini
//      schema — see recipeExtraction.js.
//   2. Otherwise, match ingredient names against the step text at runtime. This is
//      what the 400 imported recipes use, and it is deliberately generous.
//
// THE BIAS IS INTENTIONAL AND ASYMMETRIC. A missed ingredient means the user does not
// put it in the pan. An extra one is a glance. So when the two trade off, over-include.
// Concretely: a recipe with both "chicken breast" and "chicken stock" will surface both
// on a step that says "brown the chicken". That is the accepted cost of the spec's own
// requirement that "chicken breasts" in the list match "chicken" in the step.
//
// This feature is an ASSIST, never a replacement. CookModeView must keep the full
// ingredient list reachable at all times — if the match here is wrong, a hidden full
// list turns a small miss into being unable to cook the recipe.

import {
    canonicalName,
    normalizeIngredient,
    PREPARATION_WORDS,
    FILLER_WORDS,
    MEASURE_WORDS,
    GENERIC_QUALIFIERS,
// Explicit .js extension: this module is imported both by Vite and directly by
// node (src/scripts/step_ingredients_check.js), and node ESM will not guess it.
} from './consolidateIngredients.js';

// Words that carry no identity on their own. Matching on any of these would light up
// half the ingredient list on half the steps. Note what is NOT here: salt, oil, butter,
// water, sugar, stock — those are real ingredients and matching them is the job.
const STEP_STOPWORDS = new Set([
    ...PREPARATION_WORDS,
    ...FILLER_WORDS,
    ...MEASURE_WORDS,
    ...GENERIC_QUALIFIERS,
    'and', 'or', 'with', 'in', 'on', 'at', 'from', 'over', 'under', 'until',
    'then', 'add', 'stir', 'mix', 'cook', 'heat', 'pan', 'pot', 'bowl', 'dish',
    'more', 'some', 'any', 'all', 'each', 'both', 'other', 'rest', 'remaining',
    'reserved', 'above', 'below', 'side', 'top', 'bottom', 'well', 'together',
]);

// Below this length a token is noise, not a name.
const MIN_MATCH_LENGTH = 3;

/**
 * A step may be a plain string (the `text[]` column, which is what production
 * actually uses) or an object (the `jsonb` shape DATA_MODELS §1 allows for).
 * stepText('Chop the onion') -> 'Chop the onion'
 */
export function stepText(step) {
    if (step == null) return '';
    if (typeof step === 'string') return step;
    if (typeof step === 'number') return String(step);
    return String(step?.text ?? step?.step ?? step?.instruction ?? step?.name ?? '');
}

/**
 * Explicit ingredient indexes carried ON a step object, if any.
 * Returns null when the step carries no link array at all — which is the signal to
 * fall back to matching. An explicit empty array is honoured as "this step genuinely
 * uses no ingredients" and returns [].
 */
export function explicitStepIndexes(step) {
    if (step == null || typeof step !== 'object') return null;
    const raw = step?.ingredientIndexes ?? step?.ingredient_indexes ?? null;
    return Array.isArray(raw) ? sanitiseIndexes(raw) : null;
}

function sanitiseIndexes(raw) {
    if (!Array.isArray(raw)) return null;
    const seen = new Set();
    raw.forEach((value) => {
        // Number(null) and Number('') are both 0, so a null in a stored link array
        // would silently become "ingredient 0" — the first thing in the list, shown
        // on a step that never mentioned it. Reject the type before coercing.
        if (typeof value !== 'number' && typeof value !== 'string') return;
        if (typeof value === 'string' && !value.trim()) return;
        const n = Number(value);
        if (Number.isInteger(n) && n >= 0) seen.add(n);
    });
    return Array.from(seen).sort((a, b) => a - b);
}

function rawWords(text) {
    return String(text ?? '').toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean);
}

// Split a piece of text into canonicalised word tokens. Running each token through
// canonicalName() is what gets singular/plural and spelling variants for free:
// 'Onions,' -> 'onion', 'Tomatoes' -> 'tomato', 'Yoghurt' -> 'yogurt'.
function tokenise(text) {
    return rawWords(text).map((word) => canonicalName(word)).filter(Boolean);
}

// Every stem a word could plausibly reduce to. The shared singulariser has to commit
// to one reading of "-ies", and it picks "-y" — right for berries/berry, wrong for
// chillies/chilli. Rather than special-casing a spelling, keep BOTH readings on the
// step side and let either one match. Recall is the thing being optimised here.
function variantsOf(word) {
    const variants = new Set();
    const base = canonicalName(word);
    if (base) variants.add(base);
    if (/ies$/.test(word) && word.length > 4) {
        const alt = canonicalName(`${word.slice(0, -3)}i`);
        if (alt) variants.add(alt);
    }
    return variants;
}

// The step's vocabulary, widened by the variants above.
function stepVocabulary(text) {
    const vocab = new Set();
    rawWords(text).forEach((word) => variantsOf(word).forEach((v) => vocab.add(v)));
    return vocab;
}

// The words that, if seen in a step, mean this ingredient is involved. Built from the
// canonical name AND the raw name, so nothing that survives one but not the other is
// lost. 'Boneless Skinless Chicken Breasts' contributes chicken + breast (canonical)
// as well as boneless + skinless (raw, harmless — they never appear in step text).
function matchWordsFor(name) {
    const words = new Set([
        ...tokenise(canonicalName(name)),
        ...tokenise(name),
    ]);
    return Array.from(words).filter(
        (word) => word.length >= MIN_MATCH_LENGTH && !STEP_STOPWORDS.has(word) && !/^\d+$/.test(word)
    );
}

// True when `phrase` appears as a run of consecutive tokens in `tokens`. Used so a
// full canonical phrase ("sweet potato") is recognised as a unit, not only word by word.
function containsPhrase(tokens, phrase) {
    if (!phrase.length || phrase.length > tokens.length) return false;
    for (let i = 0; i <= tokens.length - phrase.length; i += 1) {
        if (phrase.every((word, j) => tokens[i + j] === word)) return true;
    }
    return false;
}

/**
 * The core matcher. Returns the indexes (into `ingredients`) mentioned by this step.
 *
 * Word-boundary matching throughout — the whole reason this tokenises rather than
 * calling includes(). `includes()` would match "salt" inside "salted butter" and "oil"
 * inside "olive oil"; tokens do not, because "salted" and "salt" are different tokens.
 */
export function matchIngredientIndexes(step, ingredients) {
    const text = stepText(step);
    const tokens = tokenise(text);
    if (!tokens.length) return [];

    const tokenSet = stepVocabulary(text);
    const matched = [];

    (ingredients ?? []).forEach((raw, index) => {
        const { name } = normalizeIngredient(raw);
        if (!name) return;

        const canonicalWords = tokenise(canonicalName(name));
        if (canonicalWords.length > 1 && containsPhrase(tokens, canonicalWords)) {
            matched.push(index);
            return;
        }

        const words = matchWordsFor(name);
        if (words.some((word) => tokenSet.has(word))) matched.push(index);
    });

    return matched;
}

/**
 * ingredientsForStep(step, ingredients) -> [{ index, name, quantity, unit }]
 *
 * Explicit links win; otherwise the runtime matcher. Always returns ingredients in the
 * recipe's own order, so the same item sits in the same relative place on every step.
 * An empty array means "render nothing" — never an empty box, never a
 * "no ingredients" label (TASK_10 acceptance criteria).
 */
export function ingredientsForStep(step, ingredients, storedIndexes = null) {
    const list = Array.isArray(ingredients) ? ingredients : [];
    if (!list.length) return [];

    const explicit = sanitiseIndexes(storedIndexes) ?? explicitStepIndexes(step);
    const indexes = explicit ?? matchIngredientIndexes(step, list);

    return indexes
        .filter((i) => i < list.length)
        .map((i) => ({ index: i, ...normalizeIngredient(list[i]) }))
        .filter((ing) => !!ing?.name);
}

/**
 * Resolve every step of a recipe in one pass, so a view can render step N without
 * re-deriving the whole thing on each render.
 *
 * Reads stored links from `recipe.step_ingredients` — a jsonb array parallel to
 * `steps`, each entry an array of ingredient indexes. That column is where newly
 * captured recipes put their links; `steps` itself is `text[]` in Supabase and so
 * cannot carry them inline.
 */
export function buildStepIngredients(recipe, steps) {
    const list = recipe?.ingredients ?? [];
    const stored = Array.isArray(recipe?.step_ingredients) ? recipe.step_ingredients : null;

    return (steps ?? []).map((step, i) => ingredientsForStep(step, list, stored?.[i] ?? null));
}

/**
 * Validate a draft's `step_ingredients` against the draft it arrived with, dropping it
 * wholesale if the two don't line up.
 *
 * A wrong step→ingredient link is worse than none, because Cook Mode shows it with
 * full confidence — and the runtime matcher is a perfectly good fallback. The case
 * this really exists for is the refine chat: the model can remove an ingredient and
 * leave the indexes pointing at whatever moved up into its place.
 */
export function withValidStepIngredients(recipe) {
    if (!recipe) return recipe;

    const steps = Array.isArray(recipe?.steps) ? recipe.steps : [];
    const count = Array.isArray(recipe?.ingredients) ? recipe.ingredients.length : 0;
    const raw = recipe?.step_ingredients;
    const clean = { ...recipe };

    // One entry per step or nothing at all — a mismatched length means every link
    // after the missing one is off by one, which is worse than having none.
    if (!count || !steps.length || !Array.isArray(raw) || raw.length !== steps.length) {
        delete clean.step_ingredients;
        return clean;
    }

    clean.step_ingredients = raw.map((entry) => sanitiseIndexes(entry)?.filter((i) => i < count) ?? []);
    return clean;
}
