# 🍏 Project Roadmap: Meal Buddy

## 🔄 PIVOT — Feb 27: The Great Simplification in progress

Vision re-centered on the real loop. 7 feature briefs archived. Scope reduced from 9 features to a target of 5.

**Status of this file:** Hall of Fame is complete and canonical. Everything above it is being rewritten in session 1.

**Active briefs on disk:** essentials_grid, shopping_consolidation
**Incoming briefs (session 1):** recipe_lifecycle, week_planner, cook_mode, taste_model
**See PROJECT.md for the current vision. See FEATURES.md for the current brief index.**

"winget install --id Google.Antigravity --force" (as a adminstrator in CMD) to upgrade AG


## 🚨 Critical Bugs (Fix Before New Features)
- [x] **Recipe Library Empty:** Fixed Feb 27 — mapRow() normalisation layer + graceful fallback to final_recipes.json
- [ ] **Teal Accent Removal:** Global find-and-replace — all teal/cyan to --gold (#c9a96e). Will be addressed as screens are rebuilt in session 2+.
- [ ] **Light Background Fix:** App background must be --zinc-950 (#09090b) globally — still light grey in places. Will be addressed in session 2+ code pruning.
- [ ] **Typography:** Playfair Display + DM Sans not yet applied — CSS file imported, components need updating. Will be addressed in session 2+ code pruning.
- [~] **Planning Tab Visual Chaos:** No longer a bug to fix — the Planning tab is being fully replaced by FEATURE_week_planner.md in session 1+.
- [~] **Ampersand Bug:** No longer active — recipe import pipeline sanitizes titles. Legacy scripts archived.


### 🏃 Current Sprint (The Great Simplification)
- [x] **Task D: Epicurious Local Ingestion** — COMPLETE. 400 recipes in Supabase (Feb 26)
- [x] **Task E: Planning HQ Redesign** — SUPERSEDED. Planning tab being replaced entirely in session 1+.
- [~] **Task F: Auth Infrastructure** — DEFERRED. Auth is not required for v1 (solo use). Archived.
- [ ] **Session 1 — The Great Simplification:** Rewrite PROJECT.md vision, DATA_MODELS.md schema, generate 4 new feature briefs (recipe_lifecycle, week_planner, cook_mode, taste_model). Scheduled for next CTO session.

## 🛠 Product Backlog

The previous backlog was tied to the old vision (swipe discovery, family profiles, creator subscriptions etc). It has been cleared.

The new backlog will be generated in session 1 alongside the new feature briefs. Until then, the two active briefs on disk are the only approved work:
- FEATURE_essentials_grid.md
- FEATURE_shopping_consolidation.md

Vault items (deferred, no brief) live in PROJECT.md under "Deferred / Vault".

## 🏆 HALL OF FAME
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
> Next CTO session: Execute "Session 1 — The Great Simplification." Generate rewritten PROJECT.md vision, updated DATA_MODELS.md schema (with ingredient IDs + {0001} interpolation pattern + recipe lineage fields), and four new feature briefs: recipe_lifecycle, week_planner, cook_mode, taste_model. CEO will upload all current files at the start of the session.
