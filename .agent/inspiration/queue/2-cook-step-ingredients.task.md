---
id: task-10
title: Per-step ingredients in Cook Mode
model: sonnet
autonomous: true
priority: 3
depends_on: [batch-2]
owns:
  - src/lib/stepIngredients.js
  - src/views/CookModeView.jsx
  - src/lib/recipeExtraction.js
brief: TASK_10_cook_mode_step_ingredients.md
gate:
  - node src/scripts/step_ingredients_check.js
  - npm run build
---
Follow TASK_10_cook_mode_step_ingredients.md exactly, including its acceptance criteria.

Depends on batch-2 because both edit `src/lib/recipeExtraction.js`. Do not start until
`batch-2.task.md` is in `done/`.

Two traps the spec calls out and that are easy to get wrong:

1. **Match on word boundaries, not `includes()`.** Otherwise "salt" matches inside "salted butter"
   and "oil" inside "olive oil". Reuse `canonicalName()` from `consolidateIngredients.js` — batch-2
   will have added it — so "chicken breasts" in the ingredient list matches "chicken" in the step.

2. **This feature is additive, never subtractive.** The full ingredient list must stay reachable at
   all times. If the match is wrong or incomplete, hiding the full list turns a small miss into
   being unable to cook the recipe. Steps with no matches render nothing at all — no empty box,
   no "no ingredients" label.

Bias toward over-including. A missing ingredient means the user doesn't add it; an extra one is a
glance.

Do NOT backfill the 400 existing recipes — explicitly out of scope. Existing recipes use the
runtime matcher; only newly captured ones get stored per-step links.

You must write `src/scripts/step_ingredients_check.js` yourself (it does not exist yet) — follow
the pattern of the other scripts in that folder. Include the word-boundary cases above.
