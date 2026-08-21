---
id: batch-2
title: Finish shopping list merging/categorisation/provenance + URL recipe capture
model: opus
autonomous: true
priority: 1
depends_on: []
owns:
  - src/lib/consolidateIngredients.js
  - src/views/ShopView.jsx
  - src/context/ShopContext.jsx
  - src/lib/recipeExtraction.js
  - src/views/CaptureView.jsx
  - src/hooks/useRecipeCapture.js
  - netlify/functions/fetch-recipe.js
  - src/scripts/consolidation_check.js
  - src/scripts/checkJsonLdMapping.mjs
brief: BATCH_2_CONTINUATION.md
gate:
  - node src/scripts/consolidation_check.js
  - node src/scripts/checkJsonLdMapping.mjs
  - npm run build
---
Covers TASK_03, TASK_04, TASK_09 (shopping list) and TASK_08 (URL capture). Both were started
by earlier agents that hit a session limit; their partial work is committed under `wip:` commits
and the build passes, but neither is correct or verified yet.

Read BATCH_2_CONTINUATION.md — it names exactly what remains, including two things that are easy
to miss: the SCHEMA_VERSION bump to 'v2' in ShopContext.jsx, and the ShopView row restructure that
must not nest a button inside a button.

Opus specifically because of one judgment call: never over-merge ingredients. `red pepper` is not
`green pepper`; `sweet potato` is not `potato`. A duplicate row is a mild annoyance, but a wrong
merge means an ingredient silently missing when the user cooks. When unsure, do not merge.
