🚀 PROJECT: Meal Buddy (Master Record)
Last updated: Feb 27, 2026 — Mid-pivot. See PROGRESS.md for current phase.

🏛️ Manifest & Vision — CURRENT

**One-sentence vision:** A personal culinary companion for one dad who talks to AI about food, plans a few days ahead, and cooks with his phone in the kitchen.

**The loop the app serves:**
1. Capture — every new recipe starts as an AI conversation (from scratch, from paste, from photo). Save a version.
2. Plan — drop meals on days. Mark leftover days (any day → any other day). Add day notes ("mum's house", "takeaway"). Gaps are fine.
3. Shop — consolidated list from planned days + flagged household essentials.
4. Cook — readable recipe view, servings scaling, OS-native timers, post-cook notes.
5. Iterate — next time you plan that recipe, AI chat opens pre-loaded with full version history and last notes. Save a new version. Branch sideways if you want.

**Design soul:** Cinematic Zinc — dark, moody, editorial. A digital culinary magazine that happens to be interactive.

**Who it is built for:** The CEO and his family. Solo use first. No auth, no family sharing, no moonshots in v1.

---

🗃️ Deferred / Vault (not v1 — do not build without a new brief)

- Globe view of recipe library (visual universe of recipes by cuisine/origin)
- Taste model (home screen editorial suggestions based on cooking history)
- Family sharing and multi-user profiles
- Authentication / accounts
- Swipe-based recipe discovery
- Creator subscriptions
- Print-on-demand cookbooks
- Post-cook share cards ("Strava for Food")
- AI Meal Negotiator (conversational meal suggestion based on inventory)

---

📂 Project Status

**Current phase:** Phase 3 — Simplification & Rebuild
**Active session:** Pre-session-1 (file reconciliation in progress)
**Next session goal:** Session 1 — The Great Simplification. Rewrite vision docs and generate new feature briefs.
**Agent system:** CTO Gem (Gemini), AG squad (@engineer, @creator)
**Source of truth files:** DESIGN_SYSTEM.md, DATA_MODELS.md (both pending update in session 1), FEATURES.md, AGENTS.md

---

🌱 Data

- Recipe database: 400 family recipes from Epicurious pipeline, live in Supabase (Feb 26, 2026)
- Local fallback: final_recipes.json at project root — used when Supabase is paused or unreachable
- Recipes tab resilient to Supabase free-tier pauses as of Feb 27

---

🗂️ Active Feature Briefs

See FEATURES.md for the current index. Two active briefs on disk:
- FEATURE_essentials_grid.md
- FEATURE_shopping_consolidation.md

Seven additional briefs archived on Feb 27 — see FEATURES.md for details.

---

📖 History

See PROGRESS.md for the full Hall of Fame and historical context. The pivot to the current simplified vision was decided on Feb 27 after a strategic CTO review.
