🚀 PROJECT: The Foodies / Meal Buddy (Master Record)
Last updated: Feb 26, 2026 — Recipe import pipeline complete, 400 recipes in Supabase

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


🌱 Data
Recipe database: 400 family recipes from Epicurious pipeline — live in Supabase (Feb 26, 2026)
Recipe import history and exclusion list: see data/import-manifest.md


🚨 Critical Bugs & Repairs

 Planning Tab Visual Chaos: Complete redesign required. AG prompt ready in AG_prompt_planning_ui_fix.md
 Recipe Library Restoration: Recipes tab currently empty — restore connection to Supabase data
 Ampersand Bug: Sanitize special characters in all recipe titles to prevent PowerShell/script crashes
 Teal Accent Removal: Replace all teal/cyan accent colors with --gold (#c9a96e) throughout app
 App Background: Switch to --zinc-950 (#09090b) globally — currently light grey in places
 Typography Implementation: Apply Playfair Display + DM Sans throughout (import already added to CSS)
 Fix React Child Object Error in Detail Popups. (Patched Feb 13)


See PROGRESS.md for full history of completed work.
