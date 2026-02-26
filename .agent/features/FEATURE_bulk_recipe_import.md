# FEATURE BRIEF: Bulk Recipe Database Import
# Meal Buddy / The Foodies
# Purpose: Replace 40 test recipes with 200-300 quality curated recipes
# Audience: Gemini CTO Gem + AG @engineer.md

---

## WHAT WE ARE BUILDING

A one-time bulk import pipeline that populates the Supabase recipes table with
200-300 quality recipes via the Spoonacular API. This is not a user-facing feature —
it is a developer tool that runs once (or periodically) to seed and maintain the
recipe database. The output is a fully populated Supabase table that the existing
app UI reads from without any changes to the frontend.

---

## WHY THIS MATTERS

The app currently has ~40 low-quality test recipes. This makes daily use impossible
and means no feature can be properly tested against real data. This import must be
completed before any other feature work is meaningful. It is the single highest
priority infrastructure task.

---

## SPOONACULAR API — WHAT IT IS

Spoonacular is a recipe data API with 350,000+ recipes. It returns structured data
including ingredients, steps, nutrition, images, cook time, servings, and tags.

- Free tier: 150 points/day (each recipe fetch costs ~1-2 points)
- Paid: ~$29/month for 1,500 points/day
- Signup: https://spoonacular.com/food-api
- Auth: API key passed as query parameter `?apiKey=YOUR_KEY`
- Key env variable name: `VITE_SPOONACULAR_API_KEY`

---

## TARGET RECIPE CRITERIA

Filter imports to match the Meal Buddy vision — real food people actually cook:

```
maxReadyTime: 45           // Maximum 45 minutes cook time
number: 100                // Fetch 100 per request (maximum allowed)
addRecipeInformation: true // Returns full recipe data in one call
fillIngredients: true      // Returns structured ingredient list
instructionsRequired: true // Only recipes with proper steps
sort: popularity           // Most popular first
cuisine: [varied]          // Run multiple passes for variety
```

Run three separate requests with different cuisine filters:
1. No cuisine filter — general popular recipes
2. cuisine=italian,mediterranean
3. cuisine=asian,mexican,american

Target: 250-300 recipes total after deduplication.

---

## DATA MAPPING — SPOONACULAR → SUPABASE SCHEMA

Map Spoonacular response fields to the existing Supabase recipes table.
Reference DATA_MODELS.md for the canonical Recipe interface.

```typescript
// Spoonacular response → Recipe interface mapping
const mapSpoonacularToRecipe = (raw: any): Recipe => ({
  id: crypto.randomUUID(),                          // Generate new UUID — do not use Spoonacular ID
  title: raw.title,                                 // String — sanitize special chars before insert
  imageUrl: raw.image,                              // Spoonacular CDN URL — verify before insert
  cookTimeMinutes: raw.readyInMinutes ?? 30,        // Default 30 if missing
  difficulty: mapDifficulty(raw.readyInMinutes),    // Derived — see below
  kcal: Math.round(raw.nutrition?.nutrients
    ?.find((n: any) => n.name === 'Calories')
    ?.amount ?? 0),
  servings: raw.servings ?? 2,
  mealType: mapMealType(raw.dishTypes),             // Derived — see below
  tags: raw.cuisines ?? [],
  ingredients: raw.extendedIngredients?.map((i: any) => ({
    name: i.nameClean ?? i.name,
    quantity: i.amount ?? null,
    unit: i.unit ?? null,
  })) ?? [],
  steps: raw.analyzedInstructions?.[0]?.steps
    ?.map((s: any) => s.step) ?? [],
  createdAt: new Date().toISOString(),
});

// Difficulty derived from cook time
const mapDifficulty = (minutes: number): "Easy" | "Medium" | "Hard" => {
  if (minutes <= 20) return "Easy";
  if (minutes <= 40) return "Medium";
  return "Hard";
};

// MealType derived from Spoonacular dishTypes array
const mapMealType = (dishTypes: string[]): "Breakfast" | "Lunch" | "Dinner" => {
  if (!dishTypes?.length) return "Dinner";
  if (dishTypes.some(t => ["breakfast", "brunch", "morning meal"].includes(t.toLowerCase()))) return "Breakfast";
  if (dishTypes.some(t => ["lunch", "salad", "soup", "sandwich"].includes(t.toLowerCase()))) return "Lunch";
  return "Dinner";
};
```

---

## SPECIAL CHARACTER SANITIZATION

This is a known project bug (the "Ampersand Loop"). Before any recipe title or
ingredient name is written to Supabase, sanitize it:

```typescript
const sanitizeString = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
};

// Apply to title and all ingredient names before Supabase insert
recipe.title = sanitizeString(recipe.title);
recipe.ingredients = recipe.ingredients.map(i => ({
  ...i,
  name: sanitizeString(i.name),
}));
```

---

## IMAGE VALIDATION

Before inserting, validate that the imageUrl actually returns a 200 response.
Spoonacular images occasionally return 404. If validation fails, set imageUrl to
null — the UI fallback in DESIGN_SYSTEM.md handles null images gracefully.

```typescript
const validateImageUrl = async (url: string): Promise<string | null> => {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok ? url : null;
  } catch {
    return null;
  }
};
```

---

## DEDUPLICATION

Before inserting each recipe, check for an existing recipe with the same title
(case-insensitive) in Supabase. If a match exists, skip the insert.

```typescript
const isDuplicate = async (title: string): Promise<boolean> => {
  const { data } = await supabase
    .from('recipes')
    .select('id')
    .ilike('title', title.trim())
    .limit(1);
  return (data?.length ?? 0) > 0;
};
```

---

## THE IMPORT SCRIPT — STRUCTURE

Build this as a standalone Node.js script in `/scripts/importRecipes.ts`.
It runs from the terminal with `npx tsx scripts/importRecipes.ts`.
It does NOT run in the browser. It does NOT modify any React components.

```
/scripts/
  importRecipes.ts      ← the main script
  .env.local            ← VITE_SPOONACULAR_API_KEY and Supabase credentials
```

### Script flow:
```
1. Load env variables
2. Define three fetch batches (general, italian/mediterranean, asian/mexican/american)
3. For each batch:
   a. Fetch from Spoonacular API with criteria above
   b. Map each result to Recipe interface
   c. Sanitize all string fields
   d. Validate image URL
   e. Check for duplicate in Supabase
   f. Insert if not duplicate
   g. Log result: "✓ Inserted: [title]" or "⊘ Skipped: [title] (duplicate)"
4. Log final summary: "Import complete. X inserted, Y skipped, Z failed."
```

### Rate limiting:
Add 500ms delay between each individual recipe insert to avoid Supabase rate limits:
```typescript
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
// Call after each insert: await delay(500);
```

---

## SUPABASE TABLE REQUIREMENTS

Verify the recipes table has these columns before running the script.
If any are missing, add them via Supabase dashboard → Table Editor:

| Column | Type | Nullable |
|---|---|---|
| id | uuid | No |
| title | text | No |
| image_url | text | Yes |
| cook_time_minutes | int4 | Yes |
| difficulty | text | Yes |
| kcal | int4 | Yes |
| servings | int4 | Yes |
| meal_type | text | Yes |
| tags | text[] | Yes |
| ingredients | jsonb | Yes |
| steps | text[] | Yes |
| created_at | timestamptz | No |

Note: Supabase uses snake_case column names. The mapping script must convert
camelCase interface fields to snake_case for insert.

---

## EXISTING TEST RECIPES

Before running the import, archive the existing 40 test recipes:
```sql
-- Run in Supabase SQL editor first
UPDATE recipes SET tags = array_append(tags, 'test-data') WHERE created_at < '2026-01-01';
```
This tags them without deleting — you can filter them out of the UI or delete later
once the import is confirmed successful.

---

## ACCEPTANCE CRITERIA — HOW TO KNOW IT'S DONE

- [ ] Script runs without crashing from terminal
- [ ] 200+ recipes successfully inserted into Supabase recipes table
- [ ] Zero recipes with null or empty titles
- [ ] Zero duplicate titles in the database
- [ ] Recipes tab in the app displays the new recipes correctly
- [ ] At least one recipe from each meal type (Breakfast, Lunch, Dinner) present
- [ ] All special characters (& ' " < >) render correctly in the UI
- [ ] Images load correctly for at least 80% of imported recipes
- [ ] Fallback state displays correctly for recipes with null imageUrl

---

## AG INVOCATION

This is purely a data/logic task. Invoke @engineer.md.

Single agent mode — no UI changes required.

Remind AG:
- Stack is TypeScript + React + Vite + Supabase (NO Next.js)
- Script runs in Node.js via `npx tsx`, not in the browser
- All Supabase credentials use VITE_ prefix
- Mandatory optional chaining on all data access
- Do not modify any existing React components
- Do not touch the frontend until import is confirmed successful
