# 📊 DATA_MODELS.md — Meal Buddy / The Foodies
# Version 2.0
# Source of Truth for actual data shapes in the codebase — verified against real code, not aspirational.
# The app is plain JavaScript (.jsx/.js), NOT TypeScript, despite this file's earlier interface syntax.
# Interfaces below are written in TS-like shorthand for readability only.
# Sections renumbered 2026-10-02: old §5–§7 became §7–§9, to make room for §5 (the six TASK_07
# household tables) and §6 (cook_feedback). References to §1–§4 elsewhere are unaffected.

---

## GENERAL RULES

- All IDs are uuid strings, generated on creation (or by Supabase on insert)
- Timestamps are ISO 8601 strings
- Optional chaining (`?.`) is mandatory on all data access in the UI layer
- Supabase is the source of truth for recipes once reachable — falls back to local `final_recipes.json` when unreachable (see useRecipes.js)
- Plan, Shop and Household Essentials data **are** in Supabase — TASK_07 shipped that on 2026-09-29: `meal_plans`, `plan_state`, `shopping_state`, `essentials` and `essentials_categories`, all scoped to a household. localStorage is a **cache**, not the source of truth: `src/hooks/useSyncedDocument.js` paints from the cache synchronously and reconciles with Supabase afterwards, parking a failed write on disk until the browser is online. *Corrected 2026-10-02 — this line said the opposite ("NOT in Supabase … localStorage- or memory-only, per-device") for the week after TASK_07 went live, which is exactly the sentence that would send a fresh session off writing localStorage code for tables that already exist.* See §5.
- Two tables in the live schema have no household column: `recipes` (the shared library, §1) and `cook_feedback` (its `household_id` exists but nothing populates it yet — §6). Everything else is per household, and every request carries the household in an `x-household-id` header.

---

## 1. RECIPE

The core content unit. Lives in the Supabase `recipes` table.

### Real Supabase columns

Verified against the live database (last pass 2026-08-22, the one that added `source_url` and `step_ingredients`).

*Provenance corrected 2026-10-02.* This heading used to read *"verified from `scripts/import-to-supabase.ts` — no `.sql` schema files exist in the repo"*. Both halves of that are now false: `scripts/` holds three `*_check.mjs` text checks and nothing else (the one-shot `.ts` import pipeline was archived — `AUDIT.md`), and `supabase/migrations/` holds five `.sql` files plus `supabase/rollback/`. None of those **creates** `recipes` — they alter it, or copy its shape with `like` — so the list below still has no in-repo DDL to be checked against. The database remains the only authority for it.

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

Lives in `src/context/InventoryContext.jsx` (state, public API and the defaults below) and — since TASK_07 — in the Supabase tables `essentials` and `essentials_categories`, scoped to `household_id`. The two localStorage keys further down are the **cache** `useSyncedDocument` seeds from; every change is also pushed (debounced) to Supabase, so a second phone in the same household sees the same grid. Offline, the cache stays authoritative and the write is parked until the browser is online. Defaults to 5 seed items when the cache is empty **and** the remote has nothing. Manages a user-editable grid of pantry items and categories.

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
`src/lib/useByDates.js`. **Correction, 2026-10-02:** this used to say both were *"asserted by
`node src/scripts/pantry_check.js`"* — there is no `src/scripts/` directory in the repo and no such
script, so **nothing asserts either of them today**. The repo's checks are the `scripts/*_check.mjs`
text checks (SQL and file invariants; a runner for them lives on the unmerged `chore/checks-runner`
branch). No check reads `src/lib/pantryItems.js` or `src/lib/useByDates.js`.

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

`src/context/PlanContext.jsx` holds the public API and the in-memory shape below; **since TASK_07 the bytes live in Supabase** — one row per planned day in `meal_plans`, keyed `(household_id, plan_date)` and mapped by `src/lib/planRows.js`, plus `plan_state.confirmed` for the week lock. `meal_buddy_plan` and `meal_buddy_confirmed` are the cache keys `useSyncedDocument` seeds from, not the source of truth. Only days **this** client cleared are deleted remotely, so one phone clearing an evening cannot erase the other phone's.

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

Stored in Supabase as `shopping_state` — one row per household (`checked_keys jsonb`, `plan_fingerprint text`) — since TASK_07, 2026-09-29. The **list itself** is still computed fresh on every render of `ShopView` via `buildShoppingList(weeklyPlan)` in `src/lib/consolidateIngredients.js`; what is persisted is the ticked/un-ticked set, shared with every phone in the household, and the fingerprint records *which plan* those ticks belonged to so a rebuilt plan resets them instead of showing stale ticks. **Correction, 2026-10-02:** this section said *"Not persisted anywhere … an intentional POC simplification, not an oversight"* — accurate before TASK_07, false after it.

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

## 5. HOUSEHOLD AND THE SHARED TABLES (TASK_07, live since 2026-09-29)

Six tables, created by `supabase/migrations/20260926_task07_household_planning.sql` (the authority for
their exact shapes — this section is a map, not a replacement). All six have RLS enabled, and every
policy is scoped by `public.request_household_id()`, which reads the `x-household-id` request header.

| table | one row per | key columns | written by |
|---|---|---|---|
| `households` | household | `id uuid pk`, `name text`, `join_code text unique`, `created_at` | `src/lib/household.js` → RPC `create_household()` |
| `meal_plans` | planned day | `(household_id, plan_date)` pk, `kind`, `recipe_id`, `recipe_snapshot jsonb`, `servings`, `leftover_of_date`, `note`, `updated_at` | §3 |
| `plan_state` | household | `household_id` pk, `confirmed boolean`, `updated_at` | §3 (the week lock) |
| `shopping_state` | household | `household_id` pk, `checked_keys jsonb`, `plan_fingerprint text` | §4 |
| `essentials` | pantry item | `(household_id, item_id)` pk, `name`, `emoji`, `category`, `flagged`, `low_stock`, `use_by_date` | §2 |
| `essentials_categories` | pantry category | `(household_id, category_id)` pk, `name`, `position` | §2 |

`meal_plans.kind` is constrained to `'recipe' | 'leftover' | 'note'` — the one-meal-per-day model in §3,
now enforced by the database as well as by the UI. `leftover_of_date` may not be its own `plan_date`.

**There is no login.** A `household_id` in localStorage *is* the credential; it goes out in an
`x-household-id` header, and `resolve_join_code()` is callable by anyone holding the anon key that ships
in the public bundle. The join code is the only protection. That is deliberate and documented — the auth
build (TASK_12, `.agent/features/FEATURE_family_households.md`) is what replaces it. Worth knowing before
public sign-up; not a defect in TASK_07.

---

## 6. COOK FEEDBACK (taste model)

`src/lib/cookFeedback.js` → the `cook_feedback` table, created by
`supabase/migrations/20260822163401_create_cook_feedback.sql`. Seven columns, written when a cook is
finished off: `recipe_id`, `rating`, `note`, plus `household_id uuid` and a member id that
**exist but are never populated** — the code accepts them and stores `null`, on purpose, until a second
adult is onboarded (`FEATURE_family_households.md` specifies the membership-scoped replacement). The
table is read back to personalise the Week Planner chat. This section was missing entirely until
2026-10-02, which is why it is listed in the changelog rather than silently inserted.

---

## 7. NAVIGATION

No router — `src/context/ViewContext.jsx` holds `currentView` (a `VIEWS` enum value from `src/utils/constants.js`) and an ad-hoc `viewData` payload channel. `src/App.jsx` does a `switch(currentView)`.

```
VIEWS = { DASHBOARD, PLAN, RECIPES, SHOP, PANTRY, CAPTURE, COOK_MODE }
```

---

## 8. REMOVED MODELS (do not resurrect without a new brief)

The following data models existed in v1.0 of this file but describe features that were archived in the Feb 27 pivot and have since been deleted from the codebase entirely: `EssentialCheckSession` (session-based essentials — replaced by the stateless model in §2), `SwipeSession`, `PlanSlot`/multi-meal-type `WeeklyPlan`, `ShoppingListItem` with `sourceType`/`sourcePlanSlotId` provenance tracking, `RecipeFork`/`isPersonal` customisation lineage, `UserProfile`, `FamilyGroup`. None of these have any code in the current app. (TASK_07's household model in §5 is **not** a resurrection of `FamilyGroup`: it is a join code with no auth, no membership table and no per-member attribution — see §5 and `FEATURE_family_households.md`.)

---

## 9. CHANGELOG

| Date | Change |
|---|---|
| Oct 2 | **TASK_07 caught up with.** Four statements in this file contradicted the code that went live on 2026-09-29, and are corrected rather than quietly reworded: the General Rules line *"Plan, Shop, and Household Essentials data are NOT in Supabase"*; §2 *"lives entirely in InventoryContext — localStorage-backed"* (it queries `essentials` / `essentials_categories`); §3 *"localStorage-backed"* (it queries `meal_plans` / `plan_state`); §4 *"Not persisted anywhere"* (it queries `shopping_state`). Two new sections: **§5** maps the six TASK_07 tables (shapes from the migration, which is the authority) and states the no-login security model; **§6** documents `cook_feedback`, which was in the live schema and named nowhere in this file. Also corrected: §1's provenance line claimed the columns came from `scripts/import-to-supabase.ts` and that *"no .sql schema files exist in the repo"* — the `.ts` pipeline is gone and five `.sql` migrations exist; and §2 claimed `src/lib/pantryItems.js` / `useByDates.js` were *"asserted by `node src/scripts/pantry_check.js`"*, a path that does not exist — **nothing** asserts them. Sections §5–§7 renumbered to §7–§9 to make room. `scripts/data_models_coverage_check.mjs` now fails when the app queries a table this file does not name. |
| Aug 22 | §2 — `InventoryItem` gains two OPTIONAL fields, `lowStock?: boolean` and `useByDate?: string \| null` (TASK_11 Phase 1). Existing stored items need no migration; both absent is valid. Documented how `lowStock` reaches the shopping list through the existing `flagged` mechanism rather than a parallel path, and flagged the two fields as candidates for collapsing if nothing else ever writes to the list. §1 — the live `recipes` table gained two nullable columns this same day: `source_url text` (TASK_08, the origin link on a URL capture) and `step_ingredients jsonb` (TASK_10, per-step ingredient indexes, parallel to `steps` because `steps` is `text[]` and cannot carry them inline). |
| Aug 21 | §2 rewritten — Essentials now persist to localStorage (meal_buddy_essentials_items, meal_buddy_essentials_categories), not in-memory. Item shape is now { id, name, emoji, category, flagged } (removed quantity, targetQuantity, inPantry, isMaster, toBuy). Categories are user-editable. Removed stale inPantry-based Home screen counter bug and updated all docs to match actual code. |
| Jul 26 | v2.0 — Full rewrite against actual code. Documented real Supabase columns, the local-fallback ingredient shape mismatch, in-memory-only Essentials, the new one-meal-per-day Plan model, and the non-persisted Shop model. Removed all models for deleted features (swipe, family, auth, customisation). |
| Feb 20 | v1.0 — Initial data models documented: Recipe, Essentials, Swipe, WeeklyPlan, ShoppingList (superseded — described a Supabase-backed design that was never built) |
