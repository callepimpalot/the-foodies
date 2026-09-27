# Meal Buddy — Project Context

## What this is
A culinary companion for a household: talk to AI to capture recipes, plan a few days ahead, and cook with your phone in the kitchen.

**Direction changed 2026-09-26 — this file previously said "Solo use v1 — no auth, no family sharing, no moonshots." That is no longer the premise.** The app is being built out as a real multi-household product: family and a few friends first, public sign-up possible later, with its own domain and landing page. **Auth, accounts and household sharing are IN SCOPE.** The six schema decisions are settled in `.agent/features/FEATURE_family_households.md` (all six recorded, with the owner's override that the seeded recipes are deleted rather than kept).

**Consequence for any agent working here:** do not treat auth, sharing or "moonshots" as out of bounds, and do not cite this file's older wording as a reason to refuse that work. If a doc contradicts this paragraph, this paragraph wins — except that `.agent/DESIGN_SYSTEM.md` and `.agent/DATA_MODELS.md` still win on their own subjects.

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
- Netlify env vars (set in Netlify, not committed): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (client) + `GEMINI_API_KEY` (server, for the Gemini proxy function) + `SOCIAL_INGEST_URL` and `SOCIAL_INGEST_TOKEN` (server, for reading social post captions — see `.agent/features/FEATURE_social_link_capture.md`; the social branch is inert until both are set)

## Current status (Aug 2026)
The Capture → Plan → Shop → Cook loop is **built and live in production** at https://thefoodi.netlify.app. See `.agent/FEATURES.md` for what shipped and what's next.

## Gemini
All Gemini calls go through the Netlify function `netlify/functions/gemini.js` (server-side, holds `GEMINI_API_KEY`). The client (`src/lib/geminiClient.js`) POSTs to `/.netlify/functions/gemini`. The key never ships in the client bundle.
