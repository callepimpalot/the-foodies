# Meal Buddy — Project Context

## What this is
A personal culinary companion for one dad who talks to AI to capture recipes, plans a few days ahead, and cooks with his phone in the kitchen. Solo use v1 — no auth, no family sharing, no moonshots.

The loop: Capture → Plan → Shop → Cook → Iterate.

## Stack
React 19 + Vite 7 + **JavaScript (`.jsx`/`.js`)** + Tailwind CSS 3 + Supabase. Deployed to Netlify (auto-deploys from `main`). PWA via `vite-plugin-pwa`. Icons/fonts self-hosted via `@fontsource`.

Note: the codebase is **plain JavaScript, not TypeScript** — there is no `tsconfig.json` and no `.ts` files in the app. Any doc that says "TypeScript" is stale; trust this file.

## Source of truth — read before any work
- `.agent/PROJECT.md` — vision, current status, deferred/vault ideas
- `.agent/DESIGN_SYSTEM.md` — all colors, type, spacing ("The Chit Rail"; never hardcode values)
- `.agent/DATA_MODELS.md` — all data shapes, verified against the real Supabase schema (never guess field names)
- `.agent/FEATURES.md` — feature brief index + shipped/active/archived status
- `.agent/PROGRESS.md` — history, Hall of Fame, current sprint

## Standards
- Mandatory optional chaining (`?.`) on all data access
- No `any` types — write JSDoc types (the code is JS, not TS)
- Supabase is the source of truth once a table is live — `final_recipes.json` is only the offline fallback (older ingredient shape; reuse `consolidateIngredients.js` `normalizeIngredient()` to handle both shapes)
- No hardcoded colors, fonts, or spacing — always reference `DESIGN_SYSTEM.md` tokens
- Netlify env vars (set in Netlify, not committed): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GEMINI_API_KEY`

## Current status (Aug 2026)
The Capture → Plan → Shop → Cook loop is **built and live in production** at https://thefoodi.netlify.app. See `.agent/FEATURES.md` for what shipped and what's next.

## Known issue
`VITE_GEMINI_API_KEY` is currently used client-side (baked into the bundle by Vite) — it's exposed to anyone who inspects the deployed JS. Planned fix: route Gemini calls through a Netlify function (see `AUDIT.md`).
