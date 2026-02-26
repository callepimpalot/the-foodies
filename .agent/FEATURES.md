# 📋 FEATURES.md — Feature Brief Index
# Meal Buddy / The Foodies
# Master index of all feature briefs in the /.agent/features/ folder
# The CTO reads this to understand what has been designed vs what is backlog only

---

## HOW TO USE THIS FILE

Each feature below has a dedicated brief file in `/.agent/features/`.
Brief files are the complete design + data + build spec for that feature.
When ready to build a feature, the CTO reads the relevant brief and
generates the AG instruction from it — do not rebuild briefs from memory.

Status key:
- 🔴 NOT STARTED — brief exists, not yet built
- 🟡 IN PROGRESS — currently being built in AG
- 🟢 COMPLETE — shipped and live in the app
- 🔵 SEEDED — data/infrastructure work, not user-facing

---

## INFRASTRUCTURE

| Feature | Brief File | Status | Priority |
|---|---|---|---|
| Bulk Recipe Database Import | FEATURE_bulk_recipe_import.md | 🟡 IN PROGRESS | 🚨 Urgent |
| Authentication & Account System | FEATURE_auth_accounts.md | 🔴 NOT STARTED | 🚨 Urgent |

---

## CORE FEATURES

| Feature | Brief File | Status | Priority |
|---|---|---|---|
| Profile & Family Settings | FEATURE_profile_family_settings.md | 🔴 NOT STARTED | 🚨 High |
| Planning Tab Overhaul | FEATURE_planning_tab_overhaul.md | 🔴 NOT STARTED | 🚨 High |
| Shopping Consolidation Engine | FEATURE_shopping_consolidation.md | 🔴 NOT STARTED | 🚨 High |
| Household Essentials Grid | FEATURE_essentials_grid.md | 🔴 NOT STARTED | 🚨 High |
| Recipe Discovery Swipe | FEATURE_swipe_discovery.md | 🔴 NOT STARTED | High |
| Recipe Photo Import | FEATURE_recipe_photo_import.md | 🔴 NOT STARTED | High |
| AI Recipe Customisation (Fork) | FEATURE_recipe_customisation.md | 🔴 NOT STARTED | High |

---

## BACKLOG (no brief yet — ideas only)

These features are in PROJECT.md backlog but do not have brief files yet.
Do not build these without a brief. Ask the CEO to design them first.

| Feature | Notes |
|---|---|
| Cook Now Mode | Full-screen recipe view, large text, screen wake lock |
| Recipe Personalization | "Fork" a recipe to save a custom version |
| Leftover Management | Tag meals as generating leftovers, surface as Instant Meals |
| Smart Pantry Categories | Group pantry by type (Produce, Dairy etc) |
| AI Recipe Doctor | Chat API to modify recipes in real-time |
| AI Smart Planner | Auto-populate week based on constraints |
| Post-Cook Share Card | Social share asset — Strava for Food |
| Creator Subscriptions UI | Mockup subscribe button |
| Recipe Publishing | Users publish their forked recipes |
| Screen Wake Lock | Keep screen on during Cook Mode and Active Shopping |

---

## RECOMMENDED BUILD ORDER

Given current app state and the goal of making it usable daily as a family:

1. **Bulk Recipe Import** — app has nothing worth cooking from right now
2. **Authentication** — required before family sharing works across devices
3. **Profile & Family Settings** — depends on auth being live
4. **Planning Tab Overhaul** — current state is broken and unusable
5. **Household Essentials Grid** — simple, high daily value, standalone
6. **Shopping Consolidation Engine** — depends on Planning being solid
7. **Recipe Discovery Swipe** — depends on quality recipe database
8. **Recipe Photo Import** — personal library growth, compelling feature
9. **AI Recipe Customisation** — depends on auth (forks are user-scoped)

---

## BACKLOG (no brief yet — ideas only)

These features are in PROJECT.md backlog but do not have brief files yet.
Do not build these without a brief. Ask the CEO to design them first.

| Feature | Notes |
|---|---|
| Cook Now Mode | Full-screen recipe view, large text, screen wake lock |
| Leftover Management | Tag meals as generating leftovers, surface as Instant Meals |
| Smart Pantry Categories | Group pantry by type (Produce, Dairy etc) |
| AI Smart Planner | Auto-populate week based on constraints |
| Post-Cook Share Card | Social share asset — Strava for Food |
| Creator Subscriptions UI | Mockup subscribe button |
| Recipe Publishing | Users publish their forked recipes |
| Screen Wake Lock | Keep screen on during Cook Mode and Active Shopping |

---

## FEATURE BRIEF TEMPLATE

When designing a new feature, create a new file in `/.agent/features/`
following this structure:

```
# FEATURE BRIEF: [Feature Name]
# Purpose: [one sentence]
# Audience: Gemini CTO Gem + AG @[agent].md
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

Always add new briefs to the index table above when created.
Always update status when a feature moves to IN PROGRESS or COMPLETE.
