# Meal Buddy

A culinary companion for a household: capture recipes by talking to AI, plan a few days ahead,
shop from one consolidated list, and cook with the phone in the kitchen.

The loop: **Capture → Plan → Shop → Cook → Iterate.**

Live: **https://thefoodi.netlify.app** (owned by `callepimpalot/the-foodies`, auto-deploys from `main`).

## Direction

The app is being built out as a **multi-household product** — family and friends first, public
sign-up possible later. Auth, accounts and household sharing are **in scope**. Any doc (or comment)
that still says "solo use, no auth, no moonshots" is stale; the precedence note in `CLAUDE.md` wins.

## Stack

- **React 19 + Vite 7** — plain **JavaScript**, `.jsx`/`.js`. There is no `tsconfig.json` and no
  `.ts` files; component props and data access are documented with JSDoc, not types.
- **Tailwind CSS 3** — all colors, type and spacing come from `.agent/DESIGN_SYSTEM.md` ("The Chit
  Rail"). Never hardcode a token value.
- **Supabase** — the source of truth once a table is live. `final_recipes.json` is only the offline
  fallback (older ingredient shape; `consolidateIngredients.js` `normalizeIngredient()` handles both).
- **Netlify** — hosting plus the server-side functions in `netlify/functions/`.
- **PWA** via `vite-plugin-pwa` — after a deploy, close and reopen the app rather than refreshing, or
  you will test a cached build.

## Read these before changing anything

| File | Subject |
|---|---|
| `CLAUDE.md` | stack, standards and the current direction — read first |
| `.agent/PROJECT.md` | vision, current status, deferred/vault ideas |
| `.agent/DESIGN_SYSTEM.md` | every color, font and spacing token |
| `.agent/DATA_MODELS.md` | data shapes, verified against the live schema |
| `.agent/FEATURES.md` | feature brief index + shipped/active/archived status |
| `.agent/PROGRESS.md` | history, Hall of Fame, current sprint |

`landing/index.html` is deliberately **unrouted**: it is not part of the Vite build and has no route
in the app. Do not wire it in without being asked.

## Local development

```bash
npm install
npm run dev        # vite dev server
npm run build      # vite build
npm run preview    # serve the built bundle
npm run lint       # eslint .
```

There is no unit-test runner. Correctness of the SQL and of the migrations is asserted by the static
check scripts under `scripts/` (`node scripts/<name>.mjs`); they read file text, they do not execute
SQL, so a pass is a structure claim rather than a database claim.

## Environment variables

Client-side (visible in the bundle, by design — the anon key is meant to be public):

```
VITE_SUPABASE_URL=…
VITE_SUPABASE_ANON_KEY=…
```

Server-side only, set in Netlify and **never** in the client bundle:

| Variable | Used by |
|---|---|
| `GEMINI_API_KEY` | `netlify/functions/gemini.js` — the proxy every Gemini call goes through |
| `SOCIAL_INGEST_URL` | `netlify/functions/fetch-recipe.js` — caption/transcript for social links |
| `SOCIAL_INGEST_TOKEN` | same; the social branch is inert until both are set |

See `.env.example` for the local template.

## Working on this repo

- **Branch per piece** (`feat/…`, `chore/…`, `docs/…`) and open a PR — `main` deploys to production
  the moment it merges, so nothing lands without review.
- **Stage files by explicit path.** `PICKUP.md`, `MORNING-BRIEF.md`, `OVERNIGHT-BRIEF.md` and
  `landing/status.html` are agent working artifacts and must not be committed.
- **Migrations:** never apply a destructive one to production without an explicit go-ahead. Database
  branching is unavailable on the current plan; rehearse instead with a `ROLLBACK`-sealed run.
