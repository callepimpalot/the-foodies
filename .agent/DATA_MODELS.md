# 📊 DATA_MODELS.md — Meal Buddy / The Foodies
# Version 2.0
# Source of Truth for actual data shapes in the codebase — verified against real code, not aspirational.
# The app is plain JavaScript (.jsx/.js), NOT TypeScript, despite this file's earlier interface syntax.
# Interfaces below are written in TS-like shorthand for readability only.

---

## GENERAL RULES

- All IDs are uuid strings, generated on creation (or by Supabase on insert)
- Timestamps are ISO 8601 strings
- Optional chaining (`?.`) is mandatory on all data access in the UI layer
- Supabase is the source of truth for recipes once reachable — falls back to local `final_recipes.json` when unreachable (see useRecipes.js)
- Plan, Shop, and Household Essentials data are NOT in Supabase — they are localStorage- or memory-only, per-device (see each section below)

---

## 1. RECIPE

The core content unit. Lives in the Supabase `recipes` table.

### Real Supabase columns (verified from scripts/import-to-supabase.ts — no .sql schema files exist in the repo)

```
id                  uuid
title               text
description         text | null
image_url           text | null        — mostly null for the 400 bulk-imported recipes; hydrated later or left to fall back to a gradient placeholder in the UI
cook_time_minutes   integer
difficulty          text               — free text, typically "Easy" | "Medium" | "Hard" but NOT a DB-enforced enum
kcal                integer | null
base_servings       integer
meal_type           text               — typically "Breakfast" | "Lunch" | "Dinner"
tags                text[]
archetypes          text[]             — legacy persona-filter tags, mostly empty on bulk-imported rows
ingredients         jsonb              — array of { name: string, quantity: number | null, unit: string | null }
steps               text[]             — verified against the live database Aug 22. Earlier versions of this file said "text[] | jsonb"; it is text[], which is why per-step ingredient links needed their own column rather than living on the step objects TASK_10 assumed.
is_personal         boolean            — true for user-captured recipes (see Capture, below). NOT documented in the old v1.0 of this file.
creator             text | null        — free-text attribution ("@handle", "Half Baked Harvest"), never guessed
source_url          text | null        — TASK_08 (Aug 22). Origin link when the recipe was captured from a URL; null for text/photo captures.
step_ingredients    jsonb | null       — TASK_10 (Aug 22). Array PARALLEL to `steps`; each entry an array of 0-based indexes into `ingredients`, e.g. [[0,2],[],[1,3]]. Null on all pre-existing rows, which fall back to the runtime matcher in src/lib/stepIngredients.js. No backfill was done.
created_at          timestamptz
```

### Local fallback shape — `final_recipes.json` (repo root, 38 recipes)

Used by `src/hooks/useRecipes.js` when Supabase is unreachable (paused free-tier project, offline, etc.) — this is a REAL, currently-observed condition, not a hypothetical. The local file uses different field names and an older ingredient shape:

```
cooking_time / cook_time_minutes   (inconsistent across entries)
ingredients: [{ item: string, amount: string, unit: string }]   — NOT {name, quantity, unit}
```

`useRecipes.js`'s `mapRow()`/`mapLocalRow()` normalize `cook_time`, `servings`, `image_url` for **display** purposes, but do **not** normalize the `ingredients` array shape. Any code that reads `ingredients[].name` must also check `ingredients[].item` (see `src/lib/consolidateIngredients.js`'s `normalizeIngredient()` for the canonical way to handle both shapes — reuse it, don't reimplement).

### Captured recipes (via the Capture tab)

Written by `src/hooks/useRecipeCapture.js` → `src/lib/recipeExtraction.js` (Gemini `responseSchema` extraction). Captured rows always set:
- `is_personal: true`
- `tags: ['captured']`
- `image_url: null` (no image generation step in this pass — relies on the existing gradient-fallback rendering)
- `ingredients` in the canonical `{name, quantity, unit}` shape (matches the live Supabase shape, not the legacy local-JSON shape)

---

## 2. HOUSEHOLD ESSENTIALS (Pantry tab)

Lives entirely in `src/context/InventoryContext.jsx` — **localStorage-backed, persists across page reloads**. Manages a user-editable grid of pantry items and categories. Defaults to 5 seed items if localStorage is empty or corrupted.

### Persistence

Two localStorage keys, defined in `src/context/InventoryContext.jsx:3-4`:

```
meal_buddy_essentials_items       → array of InventoryItem
meal_buddy_essentials_categories  → array of Category
```

Both are auto-saved on any state change via `useEffect` hooks (lines 52-58).

### Data shapes

```
InventoryItem {
  id: string                    // uuid, generated on creation (crypto.randomUUID())
  name: string
  emoji: string                 // single emoji character from user selection or commonItems defaults
  category: string              // id of one of the user-editable categories (see below)
  flagged: boolean              // true = item is on the shopping list (feeds Shop tab's "Household" section)

  // --- TASK_11 Phase 1 (Aug 22). BOTH OPTIONAL — an item stored before this shipped
  // --- has neither, and that is a valid item. Read them with `?.`; never assume present.
  lowStock?: boolean            // "I'm running low." Set by the one tap on the Pantry grid,
                                //   which ALSO sets `flagged` — see below.
  useByDate?: string | null     // ISO 'YYYY-MM-DD', or null. Feeds the Home "Use it up" section.
}
```

**`lowStock` vs `flagged` — why both, and how they relate.** `flagged` is the shopping-list
transport and is unchanged. `lowStock` is the pantry state. The Pantry grid's one tap sets
`lowStock` and mirrors it onto `flagged`, deliberately reusing the existing route to the list rather
than building a second one. Un-flagging (ticking the item off in Shop, or tapping it again in
Pantry) clears both — you have it now.

They therefore track each other today, since the grid tap is the only way to flag. The distinction
is kept because the two mean different things and will diverge as soon as anything else can add to
the list. **If that never happens, they are worth collapsing into one field** — noted so a future
session doesn't preserve a redundancy out of caution.

Phase 1 is **deliberately** two optional fields and nothing else: no quantities, no units, no
cook-time deduction. See `TASK_11_pantry_real_inventory.md` for the evidence behind that scoping —
pantry tracking is the most-abandoned feature in this product category, and the input cost is why.

The transitions live as pure functions in `src/lib/pantryItems.js` and the date logic in
`src/lib/useByDates.js`, both asserted by `node src/scripts/pantry_check.js`.

```
Category {
  id: string                    // lowercase slug, auto-derived from name (e.g., "Fruit & Veg" → "fruit-veg")
  name: string                  // user-editable display name
}
```

### Default state

When localStorage keys are empty or missing, `loadItems()` and `loadCategories()` (lines 30-46) return hardcoded defaults:

**DEFAULT_CATEGORIES** (lines 8-20): produce, protein, dairy, grains, frozen, canned, snacks, beverages, condiments, household, other

**DEFAULT_ITEMS** (lines 22-28): 5 seed items (Milk, Eggs, Bread, Coffee, Dish Soap) with appropriate emojis and categories

### User actions

- **Add item**: `addItem(nameOrItem, category)` accepts either a plain string (defaults to category `'other'`, emoji `'📦'`) or an object shape matching `{ name, category, emoji }` (e.g., from `src/data/commonItems.js`). Rejects duplicates (case-insensitive name match).
- **Remove item**: `removeItem(id)` deletes permanently
- **Toggle flag**: `toggleFlag(id)` flips the `flagged` boolean for shopping-list inclusion. Called by ShopView when an item is ticked off. Un-flagging also clears `lowStock`.
- **Toggle low stock**: `toggleLowStock(id)` — what the Pantry grid's one tap calls. Flips `lowStock` and mirrors it onto `flagged`, so it reaches the shopping list through the existing mechanism.
- **Set use-by date**: `setUseByDate(id, isoDate)` — ISO `'YYYY-MM-DD'`, or anything falsy to clear. Two taps in the UI (item → preset); no calendar picker.
- **Clear all flags**: `clearFlags()` resets all items to `flagged: false, lowStock: false`
- **Add category**: `addCategory(name)` creates a new user-defined category (auto-derives id from name)
- **Remove category**: `removeCategory(id)` deletes a category, reassigning any items in it to `'other'`

### Relationship to Shop tab

Items with `flagged: true` feed the Shop tab's "Household" section via `ShopContext`. The Shop tab's consolidation reads this array directly; flagging is what triggers inclusion, not a separate "buying" state. `lowStock` is **not** read by Shop — it reaches the list only by setting `flagged`, which is the point.

### Relationship to the Home tab

`expiringItems()` (`src/lib/useByDates.js`) surfaces items whose `useByDate` falls within
`EXPIRY_HORIZON_DAYS` (3), soonest first, overdue items included. When nothing qualifies the Home
section renders **nothing at all** — no empty state, no placeholder. That is a requirement, not an
oversight: a section that nags on every launch is one you learn to ignore.

---

## 3. WEEKLY PLAN (Plan tab)

`src/context/PlanContext.jsx` — localStorage-backed, keys `meal_buddy_plan` and `meal_buddy_confirmed`.

**One meal per day** (not three meal-type slots — this was simplified from an earlier breakfast/lunch/dinner model to match the "drop meals on days" vision in PROJECT.md).

```
weeklyPlan: {
  [dateStr: 'YYYY-MM-DD']: DayEntry
}

DayEntry =
  | { recipe: Recipe, servings: number }        // a meal is planned
  | { leftoverOfDate: 'YYYY-MM-DD' }              // this day reuses another day's meal
  | { note: string }                              // free text, e.g. "eating out", "mum's house"
```

A day holds **at most one** of the three — never combined. `resolveDay(date)` (exposed by `usePlan()`) follows one level of leftover reference and returns a normalized `{ type: 'recipe' | 'leftover' | 'note', ... }` shape for display — use it instead of reading `weeklyPlan` directly in views.

`isPlanConfirmed` (boolean, also localStorage-persisted) gates the Shop tab — the shopping list is only computed once the week is "locked."

---

## 4. SHOPPING LIST (Shop tab)

**Not persisted anywhere.** Computed fresh on every render of `ShopView` via `buildShoppingList(weeklyPlan)` in `src/lib/consolidateIngredients.js`. Checked/unchecked state is local component state (`useState`) — it resets if you navigate away and back, or reload the page. This is an intentional POC simplification, not an oversight.

```
buildShoppingList(weeklyPlan) → ShoppingItem[]

ShoppingItem {
  key: string              // `${name.toLowerCase()}|${unit ?? ''}` — used for dedup and React keys
  name: string
  unit: string | null
  quantity: number | null   // null when quantities can't be summed (e.g. mismatched or missing units)
  category: string          // one of CATEGORY_ORDER, derived by categoriseIngredient(name)
}
```

Only days with a `recipe` entry contribute ingredients — `leftover` and `note` days are skipped (a leftover day's ingredients were already counted on its source day). Quantities are scaled by `servings / recipe.baseServings` via `getServingsRatio()`.

`CATEGORY_ORDER`: Produce, Meat & Fish, Dairy & Eggs, Bakery, Pantry, Herbs & Spices, Frozen.

---

## 5. NAVIGATION

No router — `src/context/ViewContext.jsx` holds `currentView` (a `VIEWS` enum value from `src/utils/constants.js`) and an ad-hoc `viewData` payload channel. `src/App.jsx` does a `switch(currentView)`.

```
VIEWS = { DASHBOARD, PLAN, RECIPES, SHOP, PANTRY, CAPTURE, COOK_MODE }
```

---

## 6. REMOVED MODELS (do not resurrect without a new brief)

The following data models existed in v1.0 of this file but describe features that were archived in the Feb 27 pivot and have since been deleted from the codebase entirely: `EssentialCheckSession` (session-based essentials — replaced by the stateless model in §2), `SwipeSession`, `PlanSlot`/multi-meal-type `WeeklyPlan`, `ShoppingListItem` with `sourceType`/`sourcePlanSlotId` provenance tracking, `RecipeFork`/`isPersonal` customisation lineage, `UserProfile`, `FamilyGroup`. None of these have any code in the current app.

---

## 7. CHANGELOG

| Date | Change |
|---|---|
| Aug 22 | §2 — `InventoryItem` gains two OPTIONAL fields, `lowStock?: boolean` and `useByDate?: string \| null` (TASK_11 Phase 1). Existing stored items need no migration; both absent is valid. Documented how `lowStock` reaches the shopping list through the existing `flagged` mechanism rather than a parallel path, and flagged the two fields as candidates for collapsing if nothing else ever writes to the list. §1 — the live `recipes` table gained two nullable columns this same day: `source_url text` (TASK_08, the origin link on a URL capture) and `step_ingredients jsonb` (TASK_10, per-step ingredient indexes, parallel to `steps` because `steps` is `text[]` and cannot carry them inline). |
| Aug 21 | §2 rewritten — Essentials now persist to localStorage (meal_buddy_essentials_items, meal_buddy_essentials_categories), not in-memory. Item shape is now { id, name, emoji, category, flagged } (removed quantity, targetQuantity, inPantry, isMaster, toBuy). Categories are user-editable. Removed stale inPantry-based Home screen counter bug and updated all docs to match actual code. |
| Jul 26 | v2.0 — Full rewrite against actual code. Documented real Supabase columns, the local-fallback ingredient shape mismatch, in-memory-only Essentials, the new one-meal-per-day Plan model, and the non-persisted Shop model. Removed all models for deleted features (swipe, family, auth, customisation). |
| Feb 20 | v1.0 — Initial data models documented: Recipe, Essentials, Swipe, WeeklyPlan, ShoppingList (superseded — described a Supabase-backed design that was never built) |
