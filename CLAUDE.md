# Meal Buddy — Project Context

## What this is
A personal culinary companion for one dad who talks to AI to capture recipes,
plans a few days ahead, and cooks with his phone in the kitchen. Solo use v1 —
no auth, no family sharing, no moonshots.

The loop: Capture → Plan → Shop → Cook → Iterate.

## Source of truth — read before any work
- .agent/PROJECT.md — vision, current status, deferred/vault ideas
- .agent/DESIGN_SYSTEM.md — all colors, type, spacing (never hardcode values)
- .agent/DATA_MODELS.md — all interfaces (never guess field names) — ⚠️ stale as of Feb 27, pending rewrite in Session 1
- .agent/FEATURES.md — feature brief index and status
- .agent/PROGRESS.md — history, Hall of Fame, current sprint
- .agent/AGENTS.md — legacy agent framework, see workflow note below

## Stack
React + Vite + TypeScript + Tailwind CSS + Supabase. No Next.js. Deployed to Netlify.

## Standards
- Mandatory optional chaining (?.) on all data access
- No `any` types
- Supabase is source of truth once a table is live — no local mocks, except final_recipes.json as an offline fallback (see PROGRESS.md, Feb 27 entry)
- No hardcoded colors, fonts, or spacing — always reference DESIGN_SYSTEM.md tokens

## Workflow note
This project previously used a Gemini "CTO Gem" for planning and Antigravity for execution, with @creator.md/@engineer.md persona files as a manual relay between them. That relay is retired. You now do both planning and execution directly, in this tool.

When a task is primarily visual/UI, think from the @creator.md mandate (bold, characterful, zero AI slop, strict DESIGN_SYSTEM.md adherence). When a task is primarily logic/data/backend, think from the @engineer.md mandate (stability, zero crashes, data integrity). Both files remain in .agent/ for reference — read them when relevant, don't treat them as separate agents to invoke.

## Current status (Feb 27)
Mid-pivot. Scope simplified from 9 features to 5. Two active feature briefs exist:
- .agent/features/FEATURE_essentials_grid.md
- .agent/features/FEATURE_shopping_consolidation.md

Four more briefs are pending, to be written in "Session 1 — The Great Simplification": recipe_lifecycle, week_planner, cook_mode, taste_model. Do not build any of these without a brief existing first.
