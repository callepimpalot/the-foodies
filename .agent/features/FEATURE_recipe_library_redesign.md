# FEATURE BRIEF: Recipe Library Redesign
# Purpose: Make the Recipes ("Meals") tab searchable and filterable so it's fast to find a recipe, instead of scrolling a flat grid.
# Audience: Solo dad user, browsing on his phone in the kitchen or planning ahead
# Status: COMPLETE

## WHAT WE ARE BUILDING
Replaced the decorative, non-functional "Digital Culinary Magazine" header and the archetype filter pills (which filtered on a field that's empty for 400 of 403 recipes) with:
- A persistent search bar matching recipe title, tags, and ingredient names
- Quick filter chips (Dinner, Lunch, Breakfast, Vegetarian, Quick & Easy) always visible
- A "More filters" bottom sheet grouping the full curated tag taxonomy: Meal Type, Diet & Allergies, Method & Type, Season
- A live result count and "Clear all" affordance
- A typographic empty state when a search/filter combination has no matches
- Recipe cards now show up to 2 relevant tag chips, since 0 of 403 recipes currently have a photo
- Removed a hardcoded fake "Macros: Clean" stat from the recipe detail sheet; replaced with a real Difficulty stat when present
- Also cleaned up two unrelated leftover bugs found while editing this file: a stray literal "Drum" text node rendering above the detail image, and a "Capture Active" label printed on every ingredient row of every recipe regardless of context

## WHY THIS MATTERS
User feedback: "its too difficult to navigate... i find it overwhelming and you cant search by anything." A direct database check (Aug 15) confirmed the existing archetype-pill filter was filtering against essentially empty data — `meal_type`, `difficulty`, and `archetypes` are null/empty for 400 of the 403 recipes (only the 3 personally-captured recipes have them set). The `tags` column, by contrast, has real coverage (Dinner: 116, Vegetarian: 131, Quick & Easy: 179, etc.) but was never surfaced anywhere in the UI before this change.

## USER FLOW
1. Open Recipes tab ("Meals" in bottom nav) — sees a search bar, quick filter chips, and the full grid with a live count
2. Types in search box → grid filters instantly by title/tags/ingredients, count updates
3. Taps a quick chip (e.g. "Dinner") → grid narrows, chip highlights gold
4. Taps "Filters" → bottom sheet opens with all tag groups; multi-select within and across groups; "Show results" closes the sheet
5. If a combination has no matches → typographic empty state with a "Clear all filters" button
6. Taps a card → existing detail bottom sheet opens (unchanged flow: Add to Plan / Cook Now)

## DATA MODEL REFERENCE
No schema changes. Uses the existing `tags text[]` column on `recipes` (see DATA_MODELS.md). Filtering and search are entirely client-side over the already-fetched `recipes` array from `useRecipes()` — no new Supabase queries.

## FILE STRUCTURE
- `src/lib/recipeSearch.js` — curated `FILTER_GROUPS`/`QUICK_FILTERS` taxonomy, `filterRecipes()` (group-aware faceted search: OR within a group, AND across groups), `getDisplayTags()`
- `src/components/RecipeSearchBar.jsx` — search input
- `src/components/FilterChip.jsx` — reusable chip button (active/inactive)
- `src/components/RecipeFilterSheet.jsx` — "More filters" bottom sheet
- `src/components/RecipeCard.jsx` — added tag chips, aligned corner radius to `--radius-md` per DESIGN_SYSTEM.md
- `src/views/RecipeView.jsx` — new header, search, quick chips, filter sheet wiring, empty state, removed fake macros stat

## EDGE CASES
- No search/filter active → shows all recipes, count reads "N recipes to explore"
- Search text with no tag/ingredient/title match anywhere → empty state
- A recipe with no curated tags (e.g. a freshly captured one, which only gets `tags: ['captured']`) → shows 0 chips on its card, which is expected and not an error
- Local-JSON fallback recipes (when Supabase is paused) also have a `tags` array normalized to `[]` by `useRecipes.js`, so search/filter degrade gracefully to title/ingredient-only matching

## ACCEPTANCE CRITERIA
- [x] Can search by recipe name
- [x] Can search by ingredient
- [x] Can filter by meal type (Dinner/Lunch/Breakfast)
- [x] Can filter by diet/allergy tags
- [x] Multiple filters combine sensibly (OR within a category, AND across categories)
- [x] Empty state never looks broken
- [x] No new Supabase columns or queries required

---

## ADDENDUM (Aug 15) — "My Recipes" filter + Creator attribution
User follow-up: wanted to filter down to just what they've personally captured, and — since Capture already lets you paste screenshots (often from Instagram/TikTok/blogs) — wanted the source person/account attributed on the recipe, both so it displays and so it's filterable ("if I realise I'm often cooking from X person that would get me to check their recent activities").

**What changed:**
- Added a `creator text null` column to `recipes` (Supabase migration `add_recipe_creator`) — the one schema change in this whole feature
- `src/lib/recipeExtraction.js`: `RECIPE_SCHEMA` gained a nullable `creator` field; the extraction prompt now actively looks for a poster's @handle, blog/publication name, or chef/cookbook byline — this required rewording the pre-existing "ignore social-media chrome" rule, which would otherwise have told Gemini to discard the exact usernames the creator field needs. Flows through `refineRecipe()` for free since it reuses `RECIPE_SCHEMA`.
- `src/views/CaptureView.jsx`: added a manual "Creator (optional)" input in the review form, right after Title — so attribution doesn't depend entirely on the AI guessing right
- `src/lib/saveRecipe.js`: writes `creator` to the row (shared by both Capture and the AI Week Planner's generated-dish save path)
- `src/lib/recipeSearch.js`: filter architecture generalized from "tag-string options" to "option + match(recipe) predicate" so non-tag facets fit the same model:
  - New `source` group with a `My Recipes` option matching `recipe.is_personal` (added to `QUICK_FILTERS` too, since it's a primary way to browse)
  - New `buildCreatorGroup(recipes)` builds a **dynamic** Creator group from whatever creator names actually exist in the current recipe set (sorted by frequency, each option labeled `Name (count)`) — returns `null` when nobody has a creator yet, so the sheet doesn't show an empty section
- `RecipeCard.jsx` and the detail sheet in `RecipeView.jsx` both show a small "by {creator}" caption when present

**Known limitation:** creator names are matched by exact trimmed string only — no case-folding or fuzzy merge, so "Jamie Oliver" typed once as "jamie oliver" would appear as a second, separate filter option. Acceptable for v1 solo use; revisit if it becomes annoying in practice.

**Verified:** production build + lint clean; filter/search logic (group AND/OR semantics, creator group builder, search matching on creator name) verified with a standalone script exercising `filterRecipes`/`buildCreatorGroup` directly. Not a live browser check — the Browser pane was unreachable this session (see PROGRESS.md).
