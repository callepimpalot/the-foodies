# 🍏 Project Roadmap: Meal Buddy

## ✅ POC LOOP SHIPPED — Aug 6, 2026

The Great Simplification's goal (Capture → Plan → Shop → Cook, one meal per day, no swipe/family/auth cruft) is built and live in production at https://thefoodi.netlify.app. See FEATURES.md for what shipped vs. what's still a brief, and PROJECT.md for current vision/status.

**Status of this file:** Hall of Fame below is canonical history. Read top-to-bottom, newest first.

## 🛠 Product Backlog

- **AI Week Planner Chat** (`FEATURE_ai_week_planner_chat.md`) — next planned feature. Open questions resolved Aug 15 — ready to design/build.
- **Playfair Display / DM Sans typography** — flagged as a standalone fix, not yet done. The whole app currently renders in Geist Sans; `font-display` is used everywhere as a Tailwind class but isn't wired to anything real.

Vault items (deliberately out of scope, no brief) live in PROJECT.md under "Deferred / Vault".

## 🏆 HALL OF FAME
- [x] **Dish photo save-through unblocked:** added the missing RLS `UPDATE` policy on `recipes` (`to public`, `USING (true)`, `WITH CHECK (true)`) directly via the Supabase MCP connection, once it was available. Verified through the real UI, not just a direct query — used RecipeView's "Add Photo" button on a live recipe, confirmed the upload + `image_url` update round-tripped correctly, then reverted the test change. `get_advisors` security check clean after the change. Both the Capture-time and edit-later dish-photo paths are now fully unblocked. (Aug 15)
- [x] **Infra debugging marathon — three separate deploy blockers found and fixed:** (1) Netlify build was missing `VITE_GEMINI_API_KEY` entirely — Vite bakes `VITE_` vars in at build time, and the local `.env` (correctly configured) never reaches Netlify's build since it's gitignored. (2) Once added, the value itself was wrong (`VITE_GEMINI_API_KEY=...` had been pasted including the variable name, not just the key) — Google returned `API_KEY_INVALID`. (3) A stale PWA service worker repeatedly masked the real error state between fixes, making resolved issues look unresolved until a full close-reopen or manual `unregister()` + cache clear. Also found and fixed missing Supabase RLS policies (`INSERT` on `recipes`, `INSERT` on the `recipe-images` storage bucket) — the 400 bulk-imported recipes went in via a service-role key that bypasses RLS, so client-side inserts had never actually been exercised until this session. (Aug 6)
- [x] **Verified full Capture → Save → View loop end-to-end for the first time:** captured a recipe from pasted text, saved it, confirmed it survives a full page reload (genuinely in Supabase, not cached client state), confirmed it displays correctly back in Recipes. Found and fixed a real bug in passing: the recipe detail view only read the legacy local-fallback ingredient field name (`amount`), never the live Supabase field (`quantity`) — every captured recipe's ingredients were displaying with blank quantities. (Aug 6)
- [x] **Capture: combined text+image input, fixed silent paste failure:** root cause of "can't paste text" was that pasting a copied screenshot into the old plain `<textarea>` did nothing visible — a textarea can't render image clipboard data. Rebuilt Capture into one composer: paste a screenshot (Ctrl/Cmd+V), attach multiple photos, and/or type text, then extract once — everything goes to Gemini together instead of forcing text-OR-one-photo. (Aug 6)
- [x] **Fixed real image-extraction bug — "Unsupported MIME type" on pasted screenshots:** clipboard-pasted images can carry an empty/missing MIME type, which Gemini's API hard-rejects. Every image is now re-encoded through canvas before sending (`src/lib/imageUtils.js`'s `normalizeImage`), regardless of source or original format — always produces a correctly-labeled JPEG, downscales oversized phone photos, and lets Safari decode HEIC natively via the OS codec. Also stopped masking every extraction failure behind one generic error message — real API errors (rate limit, bad key, rejected request) now surface with their actual cause. (Aug 6)
- [x] **Added conversational refinement to Capture:** an "Ask for changes" chat on the review screen re-sends the current draft + a follow-up instruction ("make it 4 servings", "swap carrots for cucumbers") to Gemini and applies the update in place, logging what changed. Verified two chained refinements compose correctly. This pattern is the reusable basis for the planned AI Week Planner Chat. (Aug 6)
- [x] **Rebuilt the app around the Capture → Plan → Shop → Cook loop, deleted the archived-feature debris:** removed the family/profile system, Jackpot slot-machine picker, AutoPopulate, the orphaned photo-import stub, and dead swipe-discovery leftovers (15 files). Fixed the teal-vs-gold accent bug at its root. Built Capture from scratch (paste/photo → Gemini structured extraction → review/edit → save). Simplified Plan from a 3-slot breakfast/lunch/dinner model to one meal per day with leftover-day references and free-text notes. Rebuilt Shop, which was actually crashing the app on a confirmed plan (an ingredient object was being rendered directly as a React child) — now a categorized, quantity-summed, checkable list. Extended Cook mode with a servings stepper and a simple countdown timer. Rewrote DATA_MODELS.md against the real schema instead of the stale aspirational one. (Aug 6)
- [x] **Recipes Tab Resilience:** Diagnosed "Error loading recipes" as a Supabase free-tier pause (ERR_NAME_NOT_RESOLVED), not a schema bug. Added mapRow() normalisation layer to handle snake_case → camelCase aliasing, plus graceful fallback to local final_recipes.json when Supabase is unreachable. Two latent schema mismatches (cook_time_minutes, base_servings) fixed in passing. Tab now works offline or when Supabase is paused. (Feb 27)
- [x] **The Great Simplification — Phase 1:** Archived 7 feature briefs. Scope reduced from 9 features to a target of 5. Project files synced to reflect current reality. Ready for session 1 full vision rewrite. (Feb 27)
- [x] **Recipe Import Pipeline — Full 4-Stage Build:** 20,130 raw Epicurious recipes → 400 AI-curated family recipes in Supabase. Stages: structural validation (15,600 passed), rules filter + dedup (2,000 candidates), Gemini AI scoring (400 selected), Supabase import (400 inserted, 0 failed). (Feb 26)
- [x] **Supabase Schema Redesign:** Dropped legacy dummy-data schema. Rebuilt recipes table with correct types — integers as integers, TEXT[] arrays, JSONB ingredients. Aligned with DATA_MODELS.md. (Feb 26)
- [x] **Gemini SDK Migration:** Switched from raw fetch to @google/genai SDK with structured output (responseMimeType + responseSchema). Eliminated all JSON parsing failures. (Feb 26)
- [x] **Model Switch — Gemini 3 Flash → 2.5 Flash:** Removed 12s thinking overhead per request. Stage 3 runtime dropped from ~3.5 hours to ~30 minutes. (Feb 26)
- [x] **The "Ampersand" Loop Fix:** Refactor generation scripts to handle special characters (e.g., &) in recipe titles to prevent PowerShell execution loops. (Feb 22)
- [x] **Fix React Child Object Error in Detail Popups and Home View Mapping.** (Feb 22)
- [x] **Recipe Library Restoration:** Investigated empty Recipes tab. Rebuilt asset hydration pipeline to restore visual library mapping, including Playfair visual fallbacks for 404s. (Feb 22)
- [x] Asset Hydration 2.0: Successfully generated and mapped 14 Cinematic Zinc assets using kebab-case pathing and a React Hook override layer. (Feb 20)
- [x] The Ampersand Fix: Eliminated PowerShell execution loops by implementing raw string sanitization for recipe titles. (Feb 20)
- [x] **Global Asset Audit:** Verified 50+ recipe URLs; identified 14 dead (404) Unsplash links. (Feb 18)
- [x] **Asset Hydration Proof-of-Concept:** Successfully generated and mapped "High-Protein Chicken & Broccoli" asset. (Feb 18)
- [x] **v1.0 Launch:** Full PWA integration, Supabase production sync, and mobile install verified. (Feb 18)
- [x] **Street Taco Logic:** Implemented successfully.
- [x] **Hero ID Sync:** Fixed JIT bridge in HomeView to ensure full recipe data reaches Cook Mode. (Feb 14)
- [x] **Cook Mode Logic:** Implemented step-by-step instruction rendering and calorie parsing. (Feb 14)
- [x] **Cook Mode & Hero Data Bridge:** Fixed "Cook Now" data hydration, resolved ID mismatches, and enabled step-by-step instructions. (Feb 14)
- [x] **Emergency Crash Rescue:** Resolved critical syntax error in HomeView loop logic. (Feb 14)
- [x] **Professional Dual-Agent Infrastructure:** Deployed "Elite Dual-Specialist" model (@creator & @engineer). (Feb 14)
- [x] **Orchestration Layer Implementation:** Established SQUAD.md, SQUAD_ORCHESTRATION.md, and updated CTO_PERSONA.md. (Feb 14)
- [x] **Full Recipe Master Array Generation (38 Recipes):** Restored and consolidated all recipe data. (Feb 13)
- [x] **Supabase Database Migration:** Successfully migrated legacy and new recipes to Supabase. (Feb 13)
- [x] **Recipe Grid UI Optimization (2-Column Compact):** Implemented magazine-style compact cards with 2-column grid. (Feb 13)
- [x] **Strategic Audit:** Completed comprehensive audit and roadmap session. (Feb 12)
- [x] **Header & Hero Refinements:** Tightened vertical spacing, anchored dock, and refined optical alignment. (Feb 12)
- [x] **Premium Polish:** Replaced Pantry emoji with custom Lucide icon, softened dock shadow, and cinematic Hero badge placement. (Feb 12)
- [x] **Layered Header & Sticky Nav:** Implemented full-bleed immersive hero with fixed frosted header, safe-area aware layout, and refined typography. (Feb 12)
- [x] **Home Screen Design:** LOCKED. Completed final "Premium Polish" and Fixed Header architecture. (Feb 12)
- [x] **UI Polish:** Applied header mask, refined vertical rhythm, and overlaid Hero tags for a cleaner look. (Feb 12)
- [x] **Home Screen Design:** LOCKED. Final UI Snaps & Alignment perfected (20px gaps, scroll-snap). (Feb 12)
- [x] **Header Spacing:** Reduces top padding so "Good Afternoon" sits ~24px from screen top. (Feb 12)
- [x] **Icon Purge:** Removed Bell icon, moved User icon to Header (size 20, stroke 1.5). (Feb 12)
- [x] **Family Subtitle Layout:** Updated to "The Foodies Family Orchestrator" with proper styling. (Feb 12)
- [x] **Bell Icon Audit:** Removed Home screen bell as it had no purpose. (Feb 12)
- [x] **Repository Setup:** initialized git, configured .gitignore, and pushed to GitHub. (Feb 12)
- [x] **Production Launch:** Site successfully deployed to Netlify via GitHub. (Feb 12)
- [x] **Mobile Stability:** Fixed "jumping dock" using 100dvh and GPU transform. (Feb 10)
- [x] **Hero Carousel:** Refactored static image into a 3-meal swipeable carousel. (Feb 10)
- [x] **Design System:** Successfully migrated from theme.css to Tailwind Zinc palette. (Feb 10)
- [x] **Task Automation:** AG assigned as Autonomous Project Lead for PROGRESS.md management. (Feb 10)
- [x] **Reorganize PROGRESS.md:** Initial structure setup (Self-verified). (Feb 10)

## 📝 NEXT AGENT INSTRUCTIONS
> Dish photo save-through is done and verified (INSERT/UPDATE/read all confirmed working through the real UI, not just direct queries). A Supabase MCP connection is now available directly in this tool — future schema/RLS/storage changes can be applied and verified in the same session instead of relayed through the dashboard.
>
> **Next up: build the AI Week Planner Chat** — see `.agent/features/FEATURE_ai_week_planner_chat.md`. Open questions are marked resolved as of Aug 15 — check the brief for the actual answers before assuming anything. The Capture "Ask for changes" refine-chat (`useRecipeCapture.js`'s `refine()`, `recipeExtraction.js`'s `refineRecipe()`) is the pattern to reuse, not rebuild from scratch.
>
> Read CLAUDE.md, then this file, then FEATURES.md and DATA_MODELS.md before starting.
