// scripts/stage1-validate.ts
// Stage 1 — Structural Validation
// Run with: npx tsx scripts/stage1-validate.ts

import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecipeRaw {
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

interface FailureRecord {
  title: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Validation helpers (all paths use optional chaining)
// ---------------------------------------------------------------------------

function validateRecipe(recipe: RecipeRaw): string | null {
  // Rule 1 — title is missing, null, or empty string
  const title = recipe?.title;
  if (title === undefined || title === null || (typeof title === 'string' && title.trim() === '')) {
    return 'title is missing, null, or empty';
  }
  if (typeof title !== 'string') {
    return 'title is not a string';
  }

  // Rule 2 — ingredients is missing, null, not an array, or has fewer than 3 items
  const ingredients = recipe?.ingredients;
  if (ingredients === undefined || ingredients === null) {
    return 'ingredients is missing or null';
  }
  if (!Array.isArray(ingredients)) {
    return 'ingredients is not an array';
  }
  if (ingredients.length < 3) {
    return `ingredients has fewer than 3 items (found ${ingredients.length})`;
  }

  // Rule 3 — directions is missing, null, not an array, or has fewer than 2 items
  const directions = recipe?.directions;
  if (directions === undefined || directions === null) {
    return 'directions is missing or null';
  }
  if (!Array.isArray(directions)) {
    return 'directions is not an array';
  }
  if (directions.length < 2) {
    return `directions has fewer than 2 items (found ${directions.length})`;
  }

  // Rule 4 — rating is missing, null, or not a number
  const rating = recipe?.rating;
  if (rating === undefined || rating === null || typeof rating !== 'number') {
    return 'rating is missing, null, or not a number';
  }

  // Rule 5 — any ingredient string is empty or shorter than 3 characters
  for (let i = 0; i < ingredients.length; i++) {
    const ing = ingredients[i];
    if (typeof ing !== 'string' || ing?.trim().length < 3) {
      return `ingredient at index ${i} is empty or shorter than 3 characters`;
    }
  }

  // Rule 6 — any direction string is empty or shorter than 10 characters
  for (let i = 0; i < directions.length; i++) {
    const dir = directions[i];
    if (typeof dir !== 'string' || dir?.trim().length < 10) {
      return `direction at index ${i} is empty or shorter than 10 characters`;
    }
  }

  return null; // passed
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve('data');
const INPUT_PATH = path.join(DATA_DIR, 'full_format_recipes.json');
const OUTPUT_PASSED = path.join(DATA_DIR, 'stage1-passed.json');
const OUTPUT_REPORT = path.join(DATA_DIR, 'stage1-report.txt');
const PROGRESS_INTERVAL = 1_000;

console.log('Stage 1 — Structural Validation starting…');
console.log(`Reading: ${INPUT_PATH}`);

const raw: RecipeRaw[] = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf-8'));

const passed: RecipeRaw[] = [];
const failed: FailureRecord[] = [];

for (let i = 0; i < raw.length; i++) {
  // Progress logging every 1,000 records
  if (i > 0 && i % PROGRESS_INTERVAL === 0) {
    console.log(`Processed ${i}/${raw.length}…`);
  }

  try {
    const recipe = raw[i];
    const reason = validateRecipe(recipe);

    if (reason === null) {
      passed.push(recipe);
    } else {
      const titleVal = recipe?.title;
      const titleStr =
        typeof titleVal === 'string' && titleVal.trim() !== ''
          ? titleVal.trim()
          : `(unnamed — index ${i})`;
      failed.push({ title: titleStr, reason });
    }
  } catch (err: unknown) {
    // Per-record crash safety — malformed records are rejected, never crash loop
    const errMsg = err instanceof Error ? err.message : String(err);
    failed.push({
      title: `(error at index ${i})`,
      reason: `unexpected error during validation: ${errMsg}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Write stage1-passed.json
// ---------------------------------------------------------------------------

fs.writeFileSync(OUTPUT_PASSED, JSON.stringify(passed, null, 2), 'utf-8');
console.log(`\nWrote ${passed.length} passing recipes → ${OUTPUT_PASSED}`);

// ---------------------------------------------------------------------------
// Group failures by reason category for the report
// ---------------------------------------------------------------------------

const reasonCounts = new Map<string, number>();

for (const f of failed) {
  // Normalise reason to a category label (strip dynamic index/count suffixes)
  const category = f.reason
    .replace(/\(found \d+\)/g, '(found N)')
    .replace(/at index \d+/g, 'at index N')
    .replace(/index \d+\)/g, 'index N)')
    .trim();

  reasonCounts.set(category, (reasonCounts.get(category) ?? 0) + 1);
}

// Sort categories by count descending
const sortedReasons = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]);

const breakdownLines = sortedReasons
  .map(([reason, count]) => `  [${count.toString().padStart(5)}]  ${reason}`)
  .join('\n');

// ---------------------------------------------------------------------------
// Build and write report
// ---------------------------------------------------------------------------

const sampleFailures = failed
  .slice(0, 10)
  .map((f) => `  - "${f.title}": ${f.reason}`)
  .join('\n');

const report = [
  'STAGE 1 — STRUCTURAL VALIDATION REPORT',
  '=======================================',
  `Total recipes processed : ${raw.length}`,
  `Passed                  : ${passed.length}`,
  `Failed                  : ${failed.length}`,
  `Pass rate               : ${((passed.length / raw.length) * 100).toFixed(2)}%`,
  '',
  'FAILURE BREAKDOWN (by reason category):',
  breakdownLines || '  (none)',
  '',
  'SAMPLE FAILURES (first 10):',
  sampleFailures || '  (none)',
].join('\n');

fs.writeFileSync(OUTPUT_REPORT, report, 'utf-8');

// ---------------------------------------------------------------------------
// Console summary
// ---------------------------------------------------------------------------

console.log('\n' + report);
console.log(`\nWrote report → ${OUTPUT_REPORT}`);
console.log('Stage 1 complete.');
