---
id: task-11
title: Pantry Phase 1 - running low and use-it-up
model: sonnet
autonomous: true
priority: 4
depends_on: []
owns:
  - src/context/InventoryContext.jsx
  - src/components/Inventory.jsx
  - src/views/HomeView.jsx
  - .agent/DATA_MODELS.md
brief: TASK_11_pantry_real_inventory.md
gate:
  - npm run build
---
**PHASE 1 ONLY.** The owner explicitly chose the scoped experiment over the full inventory system.
Do NOT build quantities, unit conversion, or cook-time deduction. Respect that boundary — the
research in the brief shows pantry tracking is the most-abandoned feature in this category
precisely because of data-entry burden, so this is deliberately the minimum that still answers a
useful question.

Two optional fields only: `lowStock` (boolean) and `useByDate` (ISO date string or null). Existing
stored items must migrate without loss — both fields absent is valid.

Requirements from the brief that are easy to get wrong:
- One tap marks an item low; it flows to the shopping list through the EXISTING `flagged`
  mechanism. Do not build a parallel path.
- Setting a use-by date must take at most two taps. No heavy date-picker flow.
- On Home, surface items expiring within 3 days, soonest first, with a "find a recipe" action that
  filters the library by that ingredient. Reuse `src/lib/recipeSearch.js` — do not write a second
  search. If `task-10` is already in `done/`, reuse its word-boundary matcher so "salt" does not
  match "salted butter".
- **If nothing is expiring, render NOTHING.** No empty state, no placeholder. A Home screen that
  nags every launch is one he learns to ignore.

Update DATA_MODELS.md section 2 to match, and add a dated changelog row.

Do not regress the existing flag-to-shopping-list behaviour — verify it explicitly.
