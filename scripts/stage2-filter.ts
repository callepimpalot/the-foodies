// scripts/stage2-filter.ts
// Stage 2 — Quality & Relevance Filtering (v2)
// Run with: npx tsx scripts/stage2-filter.ts

import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Recipe {
    title?: unknown;
    ingredients?: unknown;
    directions?: unknown;
    categories?: unknown;
    calories?: unknown;
    protein?: unknown;
    fat?: unknown;
    sodium?: unknown;
    rating?: unknown;
    date?: unknown;
    desc?: unknown;
    [key: string]: unknown;
}

type RejectionRule =
    | 'rating_too_low'
    | 'date_before_2000'
    | 'calories_too_low'
    | 'excluded_category'
    | 'too_many_ingredients'
    | 'excluded_title_keyword'
    | 'unexpected_error';

interface RejectionRecord {
    title: string;
    rule: RejectionRule;
    detail: string;
}

// ---------------------------------------------------------------------------
// Filter constants
// ---------------------------------------------------------------------------

const MIN_RATING = 3.5;
const MIN_YEAR = 2000;
const MIN_CALORIES = 150;     // only applied when calories is not null
const MAX_INGREDIENTS = 18;
const CANDIDATE_CAP = 2000;

const EXCLUDED_CATEGORIES = new Set<string>([
    'drink', 'drinks', 'cocktail', 'cocktails', 'beverage', 'beverages',
    'smoothie', 'juice', 'punch', 'mocktail', 'alcoholic', 'digestif',
    'aperitif', 'dessert', 'cake', 'cookie', 'cookies', 'brownie',
    'cupcake', 'frosting', 'candy', 'condiment', 'sauce', 'dip',
    'spread', 'dressing', 'marinade', 'salad dressing', 'stock', 'broth',
    'spice', 'rub', 'seasoning', 'preserved', 'garnish', 'topping',
    'crostini', 'side dish', 'appetizer', "hors d'oeuvre", 'amuse-bouche',
]);

const EXCLUDED_TITLE_KEYWORDS: string[] = [
    'cocktail', 'martini', 'margarita', 'punch', 'sangria', 'smoothie',
    'frosting', 'glaze', 'icing', 'candy', 'truffle', 'fudge', 'stock',
    'broth', 'rub', 'seasoning', 'preserved', 'pickle', 'jam', 'jelly',
    'compote', 'coulis', 'vinaigrette', 'dressing',
];

// ---------------------------------------------------------------------------
// Filter helpers — all data access via optional chaining
// ---------------------------------------------------------------------------

function applyFilters(recipe: Recipe): { rule: RejectionRule; detail: string } | null {
    // --- RATING FILTER ---
    const rating = recipe?.rating;
    if (typeof rating !== 'number' || rating < MIN_RATING) {
        return {
            rule: 'rating_too_low',
            detail: `rating ${typeof rating === 'number' ? rating : 'N/A'} < ${MIN_RATING}`,
        };
    }

    // --- DATE FILTER ---
    const date = recipe?.date;
    if (date !== undefined && date !== null && typeof date === 'string' && date.trim() !== '') {
        const year = new Date(date?.trim()).getFullYear();
        if (!isNaN(year) && year < MIN_YEAR) {
            return {
                rule: 'date_before_2000',
                detail: `date year ${year} is before ${MIN_YEAR}`,
            };
        }
    }

    // --- CALORIE FILTER (only applied when calories is not null) ---
    const calories = recipe?.calories;
    if (calories !== undefined && calories !== null && typeof calories === 'number') {
        if (calories < MIN_CALORIES) {
            return {
                rule: 'calories_too_low',
                detail: `calories ${calories} < ${MIN_CALORIES} (likely a component, not a meal)`,
            };
        }
    }

    // --- CATEGORY EXCLUSION ---
    const categories = recipe?.categories;
    if (Array.isArray(categories)) {
        for (const cat of categories) {
            const catLower = (typeof cat === 'string' ? cat?.toLowerCase() : '').trim();
            if (EXCLUDED_CATEGORIES.has(catLower)) {
                return {
                    rule: 'excluded_category',
                    detail: `category "${cat}" is in the exclusion list`,
                };
            }
        }
    }

    // --- COMPLEXITY FILTER ---
    const ingredients = recipe?.ingredients;
    if (Array.isArray(ingredients) && ingredients.length > MAX_INGREDIENTS) {
        return {
            rule: 'too_many_ingredients',
            detail: `${ingredients.length} ingredients exceeds limit of ${MAX_INGREDIENTS}`,
        };
    }

    // --- TITLE KEYWORD EXCLUSION ---
    const title = recipe?.title;
    if (typeof title === 'string') {
        const titleLower = title?.toLowerCase();
        for (const keyword of EXCLUDED_TITLE_KEYWORDS) {
            if (titleLower?.includes(keyword)) {
                return {
                    rule: 'excluded_title_keyword',
                    detail: `title contains excluded keyword "${keyword}"`,
                };
            }
        }
    }

    return null; // passed all filters
}

// ---------------------------------------------------------------------------
// Deduplication helpers
// ---------------------------------------------------------------------------

function getCaloriesValue(recipe: Recipe): number | null {
    const c = recipe?.calories;
    return typeof c === 'number' ? c : null;
}

function getRatingValue(recipe: Recipe): number {
    const r = recipe?.rating;
    return typeof r === 'number' ? r : 0;
}

/**
 * Distance from 500 kcal — used as tiebreaker when ratings are equal.
 * Null calories get a large penalty so recipes with data are preferred.
 */
function calorieDistanceFrom500(recipe: Recipe): number {
    const cal = getCaloriesValue(recipe);
    return cal !== null ? Math.abs(cal - 500) : 999_999;
}

function deduplicateByTitle(recipes: Recipe[]): { deduped: Recipe[]; removedCount: number } {
    const seen = new Map<string, Recipe>();

    for (const recipe of recipes) {
        const titleVal = recipe?.title;
        const titleKey =
            typeof titleVal === 'string' ? titleVal?.toLowerCase().trim() : '';

        if (!seen.has(titleKey)) {
            seen.set(titleKey, recipe);
        } else {
            const existing = seen.get(titleKey)!;
            const existingRating = getRatingValue(existing);
            const newRating = getRatingValue(recipe);

            if (newRating > existingRating) {
                // New record has a higher rating — replace
                seen.set(titleKey, recipe);
            } else if (newRating === existingRating) {
                // Equal rating — prefer the one closest to 500 kcal
                if (calorieDistanceFrom500(recipe) < calorieDistanceFrom500(existing)) {
                    seen.set(titleKey, recipe);
                }
            }
            // Otherwise keep existing
        }
    }

    const deduped = [...seen.values()];
    return { deduped, removedCount: recipes.length - deduped.length };
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

function isMealCalorie(cal: number | null): boolean {
    return cal !== null && cal >= 300 && cal <= 800;
}

function sortRecipes(recipes: Recipe[]): Recipe[] {
    return [...recipes].sort((a, b) => {
        const aRating = getRatingValue(a);
        const bRating = getRatingValue(b);

        // Primary: rating descending
        if (bRating !== aRating) return bRating - aRating;

        // Secondary: is it in meal calorie range (300–800)?
        const aMeal = isMealCalorie(getCaloriesValue(a)) ? 1 : 0;
        const bMeal = isMealCalorie(getCaloriesValue(b)) ? 1 : 0;
        if (bMeal !== aMeal) return bMeal - aMeal;

        // Tertiary: calories ascending
        const aCal = getCaloriesValue(a) ?? 999;
        const bCal = getCaloriesValue(b) ?? 999;
        return aCal - bCal;
    });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve('data');
const INPUT_PATH = path.join(DATA_DIR, 'stage1-passed.json');
const OUTPUT_PASSED = path.join(DATA_DIR, 'stage2-passed.json');
const OUTPUT_REPORT = path.join(DATA_DIR, 'stage2-report.txt');
const PROGRESS_INTERVAL = 500;

console.log('Stage 2 — Quality & Relevance Filtering (v2) starting…');
console.log(`Reading: ${INPUT_PATH}`);

const raw: Recipe[] = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf-8'));
console.log(`Loaded ${raw.length} records from stage1-passed.json\n`);

const passed: Recipe[] = [];
const rejected: RejectionRecord[] = [];

const ruleCounts: Record<RejectionRule, number> = {
    rating_too_low: 0,
    date_before_2000: 0,
    calories_too_low: 0,
    excluded_category: 0,
    too_many_ingredients: 0,
    excluded_title_keyword: 0,
    unexpected_error: 0,
};

// ---------------------------------------------------------------------------
// Filter loop
// ---------------------------------------------------------------------------

for (let i = 0; i < raw.length; i++) {
    if (i > 0 && i % PROGRESS_INTERVAL === 0) {
        console.log(`Processed ${i}/${raw.length}…`);
    }

    try {
        const recipe = raw[i];
        const rejection = applyFilters(recipe);

        if (rejection === null) {
            passed.push(recipe);
        } else {
            const titleVal = recipe?.title;
            const titleStr =
                typeof titleVal === 'string' && titleVal.trim() !== ''
                    ? titleVal.trim()
                    : `(unnamed — index ${i})`;

            rejected.push({ title: titleStr, rule: rejection.rule, detail: rejection.detail });
            ruleCounts[rejection.rule] += 1;
        }
    } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        rejected.push({
            title: `(error at index ${i})`,
            rule: 'unexpected_error',
            detail: `unexpected error: ${errMsg}`,
        });
        ruleCounts['unexpected_error'] += 1;
    }
}

console.log(`\nFilter pass complete. ${passed.length} passed, ${rejected.length} rejected.`);

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

const { deduped, removedCount } = deduplicateByTitle(passed);
console.log(`Deduplication removed ${removedCount} duplicate titles. ${deduped.length} remain.`);

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

const sorted = sortRecipes(deduped);

// ---------------------------------------------------------------------------
// Apply top-2000 cap
// ---------------------------------------------------------------------------

const trimmedCount = Math.max(0, sorted.length - CANDIDATE_CAP);
const finalPassed = sorted.slice(0, CANDIDATE_CAP);

// ---------------------------------------------------------------------------
// Write stage2-passed.json
// ---------------------------------------------------------------------------

fs.writeFileSync(OUTPUT_PASSED, JSON.stringify(finalPassed, null, 2), 'utf-8');
console.log(`Wrote ${finalPassed.length} recipes → ${OUTPUT_PASSED}`);

// ---------------------------------------------------------------------------
// Build report
// ---------------------------------------------------------------------------

function displayTitle(recipe: Recipe, idx: number): string {
    const t = recipe?.title;
    return typeof t === 'string' && t.trim() !== '' ? t.trim() : `(unnamed — index ${idx})`;
}

function displayRating(recipe: Recipe): string {
    const r = recipe?.rating;
    return typeof r === 'number' ? r.toFixed(1) : 'N/A';
}

function displayCalories(recipe: Recipe): string {
    const c = recipe?.calories;
    return typeof c === 'number' ? `${c} kcal` : 'null';
}

const top20Lines = finalPassed
    .slice(0, 20)
    .map(
        (r, i) =>
            `  ${String(i + 1).padStart(2)}. [${displayRating(r)} ★ | ${displayCalories(r)}] ${displayTitle(r, i)}`,
    )
    .join('\n');

const bottom10Start = Math.max(0, finalPassed.length - 10);
const bottom10Lines = finalPassed
    .slice(bottom10Start)
    .map(
        (r, i) =>
            `  ${String(bottom10Start + i + 1).padStart(4)}. [${displayRating(r)} ★ | ${displayCalories(r)}] ${displayTitle(r, bottom10Start + i)}`,
    )
    .join('\n');

const ruleLabels: Record<RejectionRule, string> = {
    rating_too_low: `rating < ${MIN_RATING}`,
    date_before_2000: `date year < ${MIN_YEAR}`,
    calories_too_low: `calories < ${MIN_CALORIES} (non-null)`,
    excluded_category: 'excluded category tag',
    too_many_ingredients: `ingredients > ${MAX_INGREDIENTS}`,
    excluded_title_keyword: 'excluded title keyword',
    unexpected_error: 'unexpected error (malformed record)',
};

const breakdownLines = (Object.entries(ruleCounts) as [RejectionRule, number][])
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([rule, count]) => `  [${String(count).padStart(5)}]  ${ruleLabels[rule]}`)
    .join('\n');

const report = [
    'STAGE 2 — QUALITY & RELEVANCE FILTER REPORT (v2)',
    '=================================================',
    `Total input (from stage1-passed)   : ${raw.length}`,
    `Passed filters                     : ${passed.length}`,
    `Rejected                           : ${rejected.length}`,
    `Duplicates removed                 : ${removedCount}`,
    `After dedup                        : ${deduped.length}`,
    `Trimmed by top-${CANDIDATE_CAP} cap            : ${trimmedCount}`,
    `Final candidate pool               : ${finalPassed.length}`,
    '',
    'REJECTION BREAKDOWN (by rule, first-fail):',
    breakdownLines || '  (none)',
    '',
    'TOP 20 PASSING RECIPES (rating ↓ → meal-cal range ↓ → calories ↑):',
    top20Lines || '  (none)',
    '',
    'BOTTOM 10 PASSING RECIPES (lowest ranked that still made the cut):',
    bottom10Lines || '  (none)',
].join('\n');

fs.writeFileSync(OUTPUT_REPORT, report, 'utf-8');

console.log('\n' + report);
console.log(`\nWrote report → ${OUTPUT_REPORT}`);
console.log('Stage 2 complete.');
