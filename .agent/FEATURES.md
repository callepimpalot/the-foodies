# 📋 FEATURES.md — Feature Brief Index
# Meal Buddy
# Master index of feature briefs in /.agent/features/

---

## ⚠️ STATUS — FEB 27

The project is mid-pivot. A strategic simplification has reduced scope from 9 features to a target of 5. Seven feature briefs were archived on Feb 27. New briefs and an updated recommended build order will be generated in the next CTO session ("Session 1 — The Great Simplification").

Until then, use this file as a directory of what exists on disk today — not as a roadmap.

---

## ACTIVE BRIEFS (still valid, will survive the rewrite)

| Feature | Brief File | Status |
|---|---|---|
| Household Essentials Grid | FEATURE_essentials_grid.md | 🔴 NOT STARTED |
| Shopping Consolidation Engine | FEATURE_shopping_consolidation.md | 🔴 NOT STARTED |

---

## ARCHIVED BRIEFS (moved to /.agent/features/archive/ on Feb 27)

These briefs do not reflect the current vision. Do NOT reference them for new work.

| Brief File | Reason for Archive |
|---|---|
| FEATURE_bulk_recipe_import.md | COMPLETE — 400 recipes imported via Epicurious pipeline (Feb 26) |
| FEATURE_auth_accounts.md | DEFERRED — solo use, auth not required for v1 |
| FEATURE_profile_family_settings.md | DEFERRED — family sharing is post-MVP |
| FEATURE_swipe_discovery.md | REMOVED — user arrives with recipes in mind, not browsing |
| FEATURE_recipe_customisation.md | COLLAPSED — merging into FEATURE_recipe_lifecycle.md (session 1) |
| FEATURE_recipe_photo_import.md | COLLAPSED — merging into FEATURE_recipe_lifecycle.md (session 1) |
| FEATURE_planning_tab_overhaul.md | OBSOLETE — being replaced by FEATURE_week_planner.md (session 1) |

---

## INCOMING BRIEFS (to be written in session 1)

These do not exist yet. Do NOT attempt to build from them.

- FEATURE_recipe_lifecycle.md — AI-chat capture, recipe versioning, branching
- FEATURE_week_planner.md — simple day-by-day planner with leftover slots and day notes
- FEATURE_cook_mode.md — readable recipe view with servings scaling and embedded OS timers
- FEATURE_taste_model.md — home screen editorial suggestions (future sprint, not urgent)

---

## FEATURE BRIEF TEMPLATE

When designing a new feature, create a new file in /.agent/features/ following this structure:

```
# FEATURE BRIEF: [Feature Name]
# Purpose: [one sentence]
# Audience: CTO + AG @[agent].md
# Status: [NOT STARTED / IN PROGRESS / COMPLETE]

## WHAT WE ARE BUILDING
## WHY THIS MATTERS
## USER FLOW (if user-facing)
## PHASE 1 — ENGINEER: [data/logic spec]
## PHASE 2 — CREATOR: [UI spec] (if applicable)
## DATA MODEL REFERENCE
## FILE STRUCTURE
## EDGE CASES
## ACCEPTANCE CRITERIA
## AG INVOCATION ORDER
```

Always add new briefs to the active briefs table above when created. Always update status when a feature moves to IN PROGRESS or COMPLETE.
