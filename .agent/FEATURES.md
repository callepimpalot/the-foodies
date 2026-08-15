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
| Plan | `src/views/PlanView.jsx` + `src/context/PlanContext.jsx` + `src/components/DayActionSheet.jsx` | One meal per day, leftover-day references, free-text day notes. Manual tap-to-place only — see the new AI Week Planner Chat brief below for the next evolution. |
| Shop | `src/views/ShopView.jsx` + `src/lib/consolidateIngredients.js` | Categorized, quantity-summed, checkable list from the locked plan. |
| Cook | `src/views/CookModeView.jsx` | Step-through view, servings stepper that scales ingredients, simple in-app countdown timer. |
| Household Essentials | `src/components/Inventory.jsx`, `PantryCheckSession.jsx` | Pre-existing, not touched this round. In-memory only — resets on reload (see DATA_MODELS.md). |

---

## ACTIVE BRIEFS (not yet built)

| Feature | Brief File | Status |
|---|---|---|
| AI Week Planner Chat | FEATURE_ai_week_planner_chat.md | 🔴 NOT STARTED — requirements captured, has open questions to resolve first |

---

## ARCHIVED BRIEFS (moved to /.agent/features/archive/)

These briefs do not reflect the current app and should not be built from directly — the ideas either shipped in a different shape (see SHIPPED table above) or are still deliberately out of scope (see PROJECT.md's Deferred/Vault list).

| Brief File | Status |
|---|---|
| FEATURE_bulk_recipe_import.md | COMPLETE — 400 recipes imported via Epicurious pipeline |
| FEATURE_auth_accounts.md | DEFERRED — solo use, no auth in v1 |
| FEATURE_profile_family_settings.md | DEFERRED — family sharing is post-MVP |
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
