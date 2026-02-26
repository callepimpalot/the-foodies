🚀 PROJECT: The Foodies / Meal Buddy (Master Record)
Last updated: Feb 22, 2026 — Major planning and infrastructure session

🏛️ Manifest & Vision
Vision: The premier culinary orchestrator for modern life.
Core Value: Transforming food management through high-fidelity, frictionless orchestration. An app people look forward to opening — not a utility, a product.
Soul: A digital culinary magazine that happens to be interactive. Every screen should feel like flipping through a premium coffee-table cookbook in a dark room.
Strategic Pillars:

AI Kitchen Intelligence: Meal Negotiator, Recipe Import from photos, AI Recipe Customisation (fork and personalise any recipe)
Strava for Food: "Culinary Proof of Work" — Performance Overlays, Family Kudos, Streaks
Creator Substack Model: Subscription Collections & Grocery Affiliate Revenue
Physical Ecosystem: Interactive E-Cookbooks & Print-on-Demand (POD)


📂 Agent Log (Status)
Current Phase: Phase 2 — Feature Build Sprint
Active Focus: Bulk Recipe Import → Auth → Profile & Family → Planning Overhaul
Status: v1.1 — Planning HQ Rebuilt. Pivoting Recipe Sourcing for TOS Compliance.
Agent System: CTO Gem v3.1 (file-driven, dynamic squad). AG squad: @engineer + @creator.
Source of Truth Files: DESIGN_SYSTEM.md v2.0 · DATA_MODELS.md v1.0 · FEATURES.md v1.0 · AGENTS.md v2.0

🗂️ Feature Registry
All features have detailed build briefs in /.agent/features/
Reference FEATURES.md for the full index and recommended build order.
🚨 Infrastructure (Build First)
FeatureBriefPriorityBulk Recipe Database ImportFEATURE_bulk_recipe_import.md🚨 UrgentAuthentication & Account SystemFEATURE_auth_accounts.md🚨 Urgent
🏃 Core Feature Sprint
FeatureBriefPriorityProfile & Family SettingsFEATURE_profile_family_settings.md🚨 HighPlanning Tab OverhaulFEATURE_planning_tab_overhaul.md🚨 HighShopping Consolidation EngineFEATURE_shopping_consolidation.md🚨 HighHousehold Essentials GridFEATURE_essentials_grid.md� HighRecipe Discovery SwipeFEATURE_swipe_discovery.mdHighRecipe Photo ImportFEATURE_recipe_photo_import.mdHighAI Recipe Customisation (Fork)FEATURE_recipe_customisation.mdHigh
❄️ Icebox (No brief yet — do not build without one)

Cook Now Mode — full-screen recipe view, large text, screen wake lock
Leftover Management — tag meals as generating leftovers
Smart Pantry Categories — group by type (Produce, Dairy etc)
AI Smart Planner — auto-populate week based on constraints
Post-Cook Share Card — social share asset, Strava for Food
Creator Subscriptions UI
Recipe Publishing — users publish forked recipes
AI Meal Negotiator — conversational meal suggestion based on inventory


🚨 Critical Bugs & Repairs

 Planning Tab Visual Chaos: Complete redesign required. AG prompt ready in AG_prompt_planning_ui_fix.md
 Recipe Library Restoration: Recipes tab currently empty — restore connection to Supabase data
 Ampersand Bug: Sanitize special characters in all recipe titles to prevent PowerShell/script crashes
 Teal Accent Removal: Replace all teal/cyan accent colors with --gold (#c9a96e) throughout app
 App Background: Switch to --zinc-950 (#09090b) globally — currently light grey in places
 Typography Implementation: Apply Playfair Display + DM Sans throughout (import already added to CSS)
 Fix React Child Object Error in Detail Popups. (Patched Feb 13)


🏆 HALL OF FAME (Completed)

 Design System v2.0 — Full Documentation: Complete Zinc palette, typography system, component patterns, spacing scale, animation rules all documented in DESIGN_SYSTEM.md. (Feb 22)
 DATA_MODELS.md v1.0 — Created: All TypeScript interfaces documented: Recipe, EssentialItem, EssentialCheckSession, SwipeSession, WeeklyPlan, PlanSlot, ShoppingListItem. (Feb 22)
 FEATURES.md — Created: Full feature index with 9 complete build briefs and recommended build order. (Feb 22)
 CTO Gem v3.1 — Rebuilt: File-driven, dynamic squad, zero hardcoded values, solo founder optimised. (Feb 22)
 AGENTS.md v2.0 — Rebuilt: Full lifecycle protocol, evaluation triggers, creation/retirement process, changelog. (Feb 22)
 mealbuddy-design-system.css — Created: Complete CSS custom properties file ready to import. (Feb 22)
 9 Feature Briefs — Written: Full design + data + build specs for all core features. (Feb 22)
 Google Stitch Prompts — Created: Open-ended and full creative direction versions for UI exploration. (Feb 22)
 Global Asset Audit: Verified 50+ recipe URLs; identified 14 dead (404) Unsplash links. (Feb 18)
 Asset Hydration: 14/14 Cinematic Zinc recipe images generated and mapped. (Feb 18)
 v1.0 Launch: Full PWA integration, Supabase production sync, and mobile install verified. (Feb 18)
 Cook Mode Logic: Step-by-step instruction rendering and calorie parsing. (Feb 14)
 Professional Dual-Agent Infrastructure: Deployed @creator and @engineer specialist model. (Feb 14)
 Full Recipe Master Array (38 Recipes): Restored and consolidated. (Feb 13)
 Supabase Database Migration: Migrated legacy and new recipes. (Feb 13)
 Recipe Grid UI Optimization: Magazine-style 2-column compact cards. (Feb 13)
 Home Screen Design: LOCKED. (Feb 12)
 Production Launch: Deployed to Netlify via GitHub. (Feb 12)
 Mobile Stability: Fixed jumping dock with 100dvh and GPU transform. (Feb 10)
 Design System v1.0: Migrated from theme.css to Tailwind Zinc palette. (Feb 10)
