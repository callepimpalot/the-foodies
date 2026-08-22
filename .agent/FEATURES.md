# 📋 FEATURES.md — Feature Brief Index
# Meal Buddy
# Master index of feature briefs in /.agent/features/

---

## STATUS — Aug 6, 2026

The Capture → Plan → Shop → Cook loop is built and live in production. Most of what the Feb 27 pivot called "incoming briefs" is now shipped code, not a brief — see the table below.

---

## SHIPPED (no longer briefs — describes what's actually running)

| Loop stage | What shipped | Notes |
|---|---|---|
| Capture | `src/views/CaptureView.jsx` + `src/hooks/useRecipeCapture.js` + `src/lib/recipeExtraction.js` | Paste text and/or attach photos in one combined request. "Ask for changes" refine-chat before saving. Dish-photo-of-the-meal upload is built but needs an `UPDATE` RLS policy on `recipes` before it's fully usable — see PROGRESS.md. |
| Plan | `src/views/PlanView.jsx` + `src/context/PlanContext.jsx` + `src/components/DayActionSheet.jsx` | One meal per day, leftover-day references, free-text day notes. Manual tap-to-place mode, plus AI Chat Plan mode (see row below). |
| Plan — AI Week Planner Chat | `FEATURE_ai_week_planner_chat.md` — `src/lib/weekPlanChat.js`, `src/hooks/useWeekPlanChat.js`, `src/lib/dishCuration.js`, `src/hooks/useDishCuration.js`, `src/components/DishCurationFlow.jsx`, `src/components/WeekPlanChat.jsx`, `RecipeDaySheet.jsx` | Two phases: curate a pool of dishes one at a time (Keep/Modify/Reject, balanced against what's already accepted, "something outside the library" escape hatch), then place the curated pool onto specific days — photo-forward day cards (leftover days borrow their source's photo), lock/swap (dedicated swap icon + pickup shake, below the lock icon)/extend, inspect+refine a recipe before locking it in, icon-triggered composer sheet for follow-up changes, apply to the real plan. Verified live. (Aug 21) |
| Shop | `src/views/ShopView.jsx` + `src/lib/consolidateIngredients.js` | Categorized, quantity-summed, checkable list from the locked plan. |
| Cook | `src/views/CookModeView.jsx` | Step-through view, servings stepper that scales ingredients, simple in-app countdown timer. |
| Household Essentials | `src/components/Inventory.jsx`, `PantryCheckSession.jsx` | Pre-existing, not touched this round. In-memory only — resets on reload (see DATA_MODELS.md). |
| Recipe Library Search & Filter | `FEATURE_recipe_library_redesign.md` — `src/lib/recipeSearch.js`, `src/components/RecipeSearchBar.jsx`, `RecipeFilterSheet.jsx`, `FilterChip.jsx`, `RecipeView.jsx`, `RecipeCard.jsx` | Replaced the archetype filter pills (filtering on a field empty for 400/403 recipes) with search + tag-based filters (meal type, diet, method, season) built from the real `tags` column, plus a "My Recipes" filter (`is_personal`) and a dynamic Creator filter/attribution field (see addendum in the brief — new `creator` column, extraction prompt updated, manual field in Capture). No "Dessert" tag exists in the current library (only 1 recipe tagged "Frozen Dessert") — flagged for future recipe curation, not a UI gap. (Aug 15) |

---

## ACTIVE BRIEFS (not yet built)

| Feature | Brief File | Status |
|---|---|---|
| Taste Model — post-meal feedback feeding AI suggestions | FEATURE_taste_model.md | 🔴 NOT STARTED — promoted from PROJECT.md's Deferred/Vault at user's request; its open questions are now DECIDED (see the brief's DECISIONS section); queued for build (Aug 21, 2026) |
| Families & Households — two adults, one plan, real accounts | FEATURE_family_households.md | 🟠 PROPOSAL, NOT APPROVED — written from TASK_12 so it can be reacted to rather than re-derived. **Six decisions are open and are the owner's**; four of them change the schema, so none of this is buildable until they're answered. Depends on TASK_07 shipping first. (Aug 22, 2026) |

---

## CANDIDATE TASKS (not briefs — /.agent/inspiration/)

`/.agent/inspiration/` holds 15 ranked, decision-ready candidate tasks derived from a competitive
research report plus a full codebase audit (Aug 21, 2026). Start at
[`.agent/inspiration/README.md`](inspiration/README.md).

These are **not** feature briefs and are not approved work. Each carries evidence, an impact/effort
ranking, a NOW/NEXT/LATER horizon, a note on whether it survives the future two-user family model,
and a ready-to-paste prompt. A task that gets approved and is large enough to need one should still
get a proper brief in `/.agent/features/` first.

Two of them are documentation/bug fixes for drift found during that audit
(`TASK_05` — a dead counter in HomeView plus stale DATA_MODELS §2 and PROJECT.md notes).

---

## ARCHIVED BRIEFS (moved to /.agent/features/archive/)

These briefs do not reflect the current app and should not be built from directly — the ideas either shipped in a different shape (see SHIPPED table above) or are still deliberately out of scope (see PROJECT.md's Deferred/Vault list).

| Brief File | Status |
|---|---|
| FEATURE_bulk_recipe_import.md | COMPLETE — 400 recipes imported via Epicurious pipeline |
| FEATURE_auth_accounts.md | SUPERSEDED — the auth work it describes is now folded into `FEATURE_family_households.md` (Aug 22, 2026). Still deferred; build from the new brief, not this one. |
| FEATURE_profile_family_settings.md | SUPERSEDED in part — household/membership is now in `FEATURE_family_households.md` (Aug 22, 2026). Its per-member preferences and allergy-awareness ideas are deliberately NOT in that brief's scope and remain a good follow-up once households exist. |
| FEATURE_swipe_discovery.md | REMOVED — deleted from the codebase |
| FEATURE_recipe_customisation.md | PARTIALLY SHIPPED — pre-save refinement shipped as Capture's "Ask for changes" chat; post-save forking still deferred |
| FEATURE_recipe_photo_import.md | SHIPPED — folded into Capture |
| FEATURE_planning_tab_overhaul.md | SHIPPED — folded into the current PlanView rebuild |

---

## FEATURE BRIEF TEMPLATE

When designing a new feature, create a new file in /.agent/features/ following this structure:

```
# FEATURE BRIEF: [Feature Name]
# Purpose: [one sentence]
# Audience: [who's building it]
# Status: [NOT STARTED / IN PROGRESS / COMPLETE]

## WHAT WE ARE BUILDING
## WHY THIS MATTERS
## USER FLOW (if user-facing)
## OPEN QUESTIONS (if any need deciding before implementation)
## DATA MODEL REFERENCE
## FILE STRUCTURE
## EDGE CASES
## ACCEPTANCE CRITERIA
```

Always add new briefs to the active briefs table above when created. Move to archived when shipped or deliberately dropped.
