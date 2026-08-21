🚀 PROJECT: Meal Buddy (Master Record)
Last updated: Aug 6, 2026 — POC loop built and live in production.

🏛️ Manifest & Vision — CURRENT

**One-sentence vision:** A personal culinary companion for one dad who talks to AI about food, plans a few days ahead, and cooks with his phone in the kitchen.

**The loop the app serves — all four stages are built and live:**
1. Capture — paste text and/or attach one or more photos/screenshots (combined, not either/or) → AI extracts a structured recipe → conversational "Ask for changes" refinement loop before saving → save. Dish-photo-of-the-finished-meal upload exists in code but needs one more RLS policy before it's fully wired (see PROGRESS.md next steps).
2. Plan — one meal per day (simplified from an earlier 3-slot breakfast/lunch/dinner model). Tap a day → choose a recipe, mark it as leftovers from another day, or leave a free-text note. Gaps are fine.
3. Shop — consolidated, categorized, checkable shopping list generated from the locked plan. Handles both the live Supabase ingredient shape and the local-fallback shape.
4. Cook — step-by-step view with a servings stepper (scales ingredient quantities live) and a simple in-app countdown timer.

**Design soul:** The Chit Rail — a kitchen order ticket rail above a line cook's station. Dark chalkboard green, warm kraft paper, and rubber-stamp red accents. Self-hosted fonts via @fontsource (Anton, Zilla Slab, IBM Plex Sans/Mono) imported in src/index.css.

**Who it is built for:** One dad, solo use. No auth, no family sharing, no moonshots in v1.

---

🗃️ Deferred / Vault (not v1 — do not build without a new brief)

- Globe view of recipe library (visual universe of recipes by cuisine/origin)
- Family sharing and multi-user profiles
- Authentication / accounts
- Swipe-based recipe discovery
- Creator subscriptions
- Print-on-demand cookbooks
- Post-cook share cards ("Strava for Food")
- Recipe forking / customisation (AI rewrite of a saved recipe into a personal variant) — the Capture "Ask for changes" chat covers pre-save refinement; post-save forking is still deferred

---

📂 Project Status

**Current phase:** POC loop live in production at https://thefoodi.netlify.app — iterating on top of it.
**Source of truth files:** DESIGN_SYSTEM.md, DATA_MODELS.md (rewritten Aug 6 against the real schema — trust it over this file for data shapes), FEATURES.md, AGENTS.md (legacy Gemini CTO Gem framework — retired, see CLAUDE.md's workflow note)
**Deploy:** Netlify, auto-deploys from GitHub `main`. Requires `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GEMINI_API_KEY` set as Netlify environment variables (not secret-flagged — they're baked into the client bundle by design). The app is a PWA with a service worker; after any deploy, do a full close-and-reopen (not just refresh) before testing, or you may see a stale cached version.

---

🌱 Data

- Recipe database: 400 family recipes from Epicurious pipeline + user-captured recipes (`is_personal: true`, `tags: ['captured']`), live in Supabase.
- Local fallback: `final_recipes.json` at project root — used when Supabase is paused/unreachable. Uses an older ingredient shape (`{item, amount, unit}`) than the live schema (`{name, quantity, unit}`) — `src/lib/consolidateIngredients.js`'s `normalizeIngredient()` is the canonical way to handle both, reuse it rather than re-deriving.
- RLS on `recipes`: SELECT, INSERT, and UPDATE policies all exist (`to public`, unconditional). Dish-photo save-through (both at Capture time and edit-later from RecipeView) is fully working.
- Storage bucket `recipe-images`: exists, public, with an INSERT policy for the public role. No SELECT/UPDATE/DELETE policies on `storage.objects` yet — not blocking today's features (uploads always create new files, never overwrite), but would matter if photo cleanup/replacement-in-place is ever wanted.

---

🗂️ Active Feature Briefs

See FEATURES.md for the current index.

---

📖 History

See PROGRESS.md for the full Hall of Fame and historical context.
