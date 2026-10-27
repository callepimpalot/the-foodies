🚀 PROJECT: Meal Buddy (Master Record)
Last updated: Oct 2, 2026 — the loop is live in production and the household schema under it is
shipped. The *status* claims in this file were re-derived from the repository on 2026-10-02; the
vision and premise paragraphs were already current and are unchanged.

🏛️ Manifest & Vision — CURRENT

**One-sentence vision:** A household's culinary companion — talk to AI about food, plan a few days ahead, and cook with your phone in the kitchen. (It began as a solo tool for one dad; since the 2026-09-26 direction change it is being built for whole households — see *Who it is built for* below.)

**The loop the app serves — all four stages are built and live:**
1. Capture — paste text and/or attach one or more photos/screenshots (combined, not either/or) → AI extracts a structured recipe → conversational "Ask for changes" refinement loop before saving → save. Dish-photo-of-the-finished-meal upload is shipped and working (`src/lib/uploadRecipeImage.js`, called from `src/lib/saveRecipe.js` at capture and `src/components/RecipeDetailSheet.jsx` on view/edit). An earlier revision of this bullet said it still needed an RLS policy before it was "fully wired"; `PROGRESS.md`'s next-steps block records it as "done and verified" and this file's own Data section agreed — the bullet was the stale one.
2. Plan — one meal per day (simplified from an earlier 3-slot breakfast/lunch/dinner model). Tap a day → choose a recipe, mark it as leftovers from another day, or leave a free-text note. Gaps are fine.
3. Shop — consolidated, categorized, checkable shopping list generated from the locked plan. Handles both the live Supabase ingredient shape and the local-fallback shape.
4. Cook — step-by-step view with a servings stepper (scales ingredient quantities live) and a simple in-app countdown timer.

**Design soul:** The Chit Rail — a kitchen order ticket rail above a line cook's station. Dark chalkboard green, warm kraft paper, and rubber-stamp red accents. Self-hosted fonts via @fontsource (Anton, Zilla Slab, IBM Plex Sans/Mono) imported in src/index.css.

**Who it is built for:** Started as one dad, solo. **Direction changed 2026-09-26** — it is now being
built out as a real multi-household app: family and a few friends first, with public sign-up possible
later, its own domain and landing page. The purpose includes gaining the experience of running a real
product. Captured recipes, accounts and household sharing are therefore **in scope**, not vaulted.

**Product premise (new):** this is treated as a small company's product, not a personal toy. That
reframes the open work: market/competitor/unit-economics questions are legitimate here now, and
"is it worth building" is no longer the default filter — "does it make the product viable" is.

---

🗃️ Deferred / Vault (not v1 — do not build without a new brief)

- Globe view of recipe library (visual universe of recipes by cuisine/origin)
- Swipe-based recipe discovery
- Creator subscriptions
- Print-on-demand cookbooks
- Post-cook share cards ("Strava for Food")
- Recipe forking / customisation (AI rewrite of a saved recipe into a personal variant) — the Capture "Ask for changes" chat covers pre-save refinement; post-save forking is still deferred

**Promoted out of the vault (2026-09-26) — these now have briefs:**
- **Authentication / accounts + Family sharing and multi-user profiles** → `FEATURE_family_households.md`.
  Premise approved; **all six schema decisions were settled on 2026-09-26** and the brief records every
  answer inline under each question (`.agent/features/FEATURE_family_households.md`, "DECISIONS
  RECORDED — 2026-09-26"), merged as PR #7. The build itself has not started. An earlier revision of
  this line said the six decisions were "still unanswered and remain the owner's" — they are answered.
- **Landing page / public face + domain** → `.agent/inspiration/TASK_06_landing_page.md`.
- The prerequisite for both is **`TASK_07_plan_shop_to_supabase.md`** — Plan/Shop/Essentials moved into
  Supabase. The family brief states plainly that it should ship first and be lived with, because it
  delivers the real benefit (two phones, one plan) with no login screen at all. **That prerequisite has
  shipped:** `supabase/migrations/20260926_task07_household_planning.sql` is in the repository, PR #6
  merged to `main` on 2026-09-29, and the app on `main` (`src/context/HouseholdContext.jsx`,
  `src/lib/household.js`, `src/context/PlanContext.jsx`) reads and writes those tables. The family
  gate — ship it, then live with it — is satisfied; auth/accounts is the next unblocked piece, not a
  blocked one.

---

📂 Project Status

**Current phase:** POC loop live in production at https://thefoodi.netlify.app — iterating on top of it.
**Source of truth files:** CLAUDE.md (read first — it carries the direction note and the stack), DESIGN_SYSTEM.md, DATA_MODELS.md (rewritten Aug 6 against the real schema — trust it over this file for data shapes), FEATURES.md, PROGRESS.md (canonical history), and this file for vision. (An earlier revision of this line pointed at `AGENTS.md`, described as a legacy Gemini "CTO Gem" framework with a note in CLAUDE.md. `AGENTS.md` is not in the repository and CLAUDE.md carries no such note, so the pointer was dangling; it is removed.)
**Deploy:** Netlify, auto-deploys from GitHub `main`. Requires `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` set as Netlify environment variables (not secret-flagged — they are
necessarily in the client bundle). **Server-side secrets** (`GEMINI_API_KEY`, `SOCIAL_INGEST_URL`,
`SOCIAL_INGEST_TOKEN`) live in Netlify env vars too but are **never** exposed to the client — all
Gemini traffic goes through `netlify/functions/gemini.js`. The app is a PWA with a service worker;
after any deploy, do a full close-and-reopen (not just refresh) before testing, or you may see a
stale cached version.

> **Corrected 2026-09-26.** Earlier revisions of this file stated that `VITE_GEMINI_API_KEY` was
> "baked into the client bundle by design". That was true once and is **no longer**: commit
> `b32e44a` moved Gemini calls server-side to stop leaking the key, and no `VITE_GEMINI_API_KEY`
> remains in the client. Treat the client bundle as containing **no secrets**.

---

🌱 Data

- Recipe database: **user-captured recipes only.** The ~400 bulk-imported Epicurious rows were archived
  and then **deleted from `recipes` on 2026-09-29** by the owner's decision —
  `supabase/migrations/20260927_archive_seeded_recipes.sql`, whose own header records the applied
  result (`recipes` 408 → 8; the 400 rows now sit in `recipes_archive_20260927`, RLS on, no grants).
  The undo is `supabase/rollback/20260927_restore_seeded_recipes.sql`, kept outside `migrations/` on
  purpose so a migration runner cannot execute it by accident. **An earlier revision of this bullet
  said the 400 imported recipes were "live in Supabase" — they are archived, not live.** Captured rows
  are written with `is_personal: true` and `tags: ['captured']` (`src/lib/saveRecipe.js`).
- Local fallback: `final_recipes.json` at project root — used when Supabase is paused/unreachable. Uses an older ingredient shape (`{item, amount, unit}`) than the live schema (`{name, quantity, unit}`) — `src/lib/consolidateIngredients.js`'s `normalizeIngredient()` is the canonical way to handle both, reuse it rather than re-deriving.
- RLS on `recipes`: SELECT, INSERT, and UPDATE policies all exist (`to public`, unconditional). There is **no DELETE policy** — which is why the seeded-recipe deletion above had to be run as the project owner and not through the client path the app ships (the migration's header records that constraint). Dish-photo save-through (both at Capture time and edit-later from RecipeView) is fully working.
- Storage bucket `recipe-images`: exists, public, with an INSERT policy for the public role. No SELECT/UPDATE/DELETE policies on `storage.objects` yet — not blocking today's features (uploads always create new files, never overwrite), but would matter if photo cleanup/replacement-in-place is ever wanted.

> **Status claims re-derived 2026-10-02, against `origin/main` at `5047fd9`.** Six claims in this file
> had gone stale and are corrected above: the vision sentence (still "for one dad"), the
> recipe-database line (the 400 imported rows are archived, not live —
> `supabase/migrations/20260927_archive_seeded_recipes.sql`), the dish-photo bullet (shipped, not
> RLS-blocked), the household line (all six decisions answered 2026-09-26, not open), the TASK_07
> prerequisite (shipped, PR #6 merged 2026-09-29), and a dangling `AGENTS.md` pointer (that file is not
> in the repository). Nothing here was taken from memory: the migration file headers,
> `src/lib/saveRecipe.js`, `src/lib/uploadRecipeImage.js`, the feature brief and the merged-PR metadata
> were each read. The premise paragraph itself needed no change — it was corrected on 2026-09-26.

---

🗂️ Active Feature Briefs

See FEATURES.md for the current index.

---

📖 History

See PROGRESS.md for the full Hall of Fame and historical context.
