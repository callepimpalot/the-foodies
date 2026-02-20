# 🍏 Project Roadmap: Meal Buddy
winget install --id Google.Antigravity --force" (as a adminstrator in CMD) to upgrade AG


## 🚨 Critical Bugs & Repairs (High Priority)
- [x] **The "Ampersand" Loop Fix:** Refactor generation scripts to handle special characters (e.g., &) in recipe titles to prevent PowerShell execution loops.
- [x] **Fix React Child Object Error in Detail Popups and Home View Mapping.** (Patched Feb 13)
- [x] **Recipe Library Restoration:** Investigated empty Recipes tab. Rebuilt asset hydration pipeline to restore visual library mapping, including Playfair visual fallbacks for 404s.
- [ ] **Planning Tab Overhaul:** Complete redesign required to fix alignment, scaling, and visual "chaos".


### 🏃 Current Sprint (Active Polish)
- [ ] **Task C: Design System 2.0 Overhaul:** Complete aesthetic refresh and documentation.
- [x] **Asset Hydration:** Generated 14 Cinematic Zinc AI assets and restored broken placeholders (14/14 Complete).

## 🛠 Product Backlog (Open Tasks)

### 🎨 Visual & UI Upgrades
- [ ] **Pantry Card Icon:** Replace the "childish" cardboard box emoji with a professional, Zinc-style icon.
- [ ] **Global Style Alignment:** Re-evaluate app-wide fonts and colors to match the superior aesthetic found in the Recipes tab.
- [ ] **Thumb-Friendly Targets:** Optimize all buttons in "Active Shopping" and "Cook" modes for one-handed thumb use.
- [ ] **Typography Polish:** Apply `tracking-tight` and `font-bold` to Hero titles (e.g., Margherita Pizza).
- [ ] **Carousel Indicators:** Add navigation dots below the 24H meal carousel.
- [ ] **Smart Overlays:** Ensure date badges ("Tomorrow", "Feb 12") appear on all carousel cards.

### 🧠 New Features & Logic
- [ ] **Profile Depth:** Surface and make editable the "hidden" background configurations (settings/user data) when clicking the user icon.
- [ ] **Recipe Personalization:** Enable the ability to "fork" recipes to save customized versions based on allergies or personal preferences.
- [ ] **Leftover Management:** Build logic to tag meals as "Generating Leftovers" so they appear as selectable "Instant Meal" options for later in the week.
- [ ] **Shopping Consolidation Engine:** Create a workflow to "Lock" planned meals and generate a static shopping snapshot.
- [ ] **Shopping Intelligence Card:** Design a pop-up summarizing the list source (Meals included, person count, and last pantry check date).
- [ ] **Family Settings:** Create a simple input/onboarding to save the `familyName` to state.
- [ ] **Smart Pantry Categories:** Logic to group items by type (Produce, Dairy, etc.).

## ❄️ Utility & "Next Level" UX (Icebox)
- [ ] **Mockup Subscribe button:** Design the UI for creator subscriptions.
- [ ] **Research POD API:** Investigate print-on-demand services for cookbooks.
- [ ] **Design Post-Cook share card:** Create the social share asset for 'Strava for Food'.
- [ ] **Cook Now Mode:** Dedicated full-screen recipe view with large, high-readability text.
- [ ] **Screen Wake Lock (Cook & Shop):** Implement a "Keep Screen On" toggle using the Wake Lock API for both Active Shopping and Cook modes.
- [ ] **AI Recipe Doctor:** Integrate a chat API to modify and update recipe data in real-time through conversation.
- [ ] **AI Smart Planner:** Use AI to auto-populate weekly meals based on specific constraints (e.g., "<30 mins cook time, high protein").
- [ ] **Recipe Publishing:** Add functionality for users to publish their customized personal recipes.
- [ ] "Empty State" design for the Pantry (Notion-style minimalism).
- [ ] Hardware-accelerated transitions for "Pantry Detail" slide-up views.

## 🔮 Future Sprint
- [ ] **Implementation of Archetype Filter Pills:** Filter recipes by archetype (Family, Training, etc.).
- [ ] **Development of the AI Meal Negotiator Logic:** Conversational AI to suggest meals based on inventory and vibe.

## 🏆 HALL OF FAME
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
> * **Resume Asset Hydration:** Target the 13 remaining recipes in BROKEN_LINKS_REPORT.md.
> * **Execution Strategy:** Use the "Local-First Assembly Line"—generate all 13 images to a local /assets/recipe-refresh/ folder first to decouple AI generation from database write-locks.
> * **Scripting Safety:** Ensure all recipe titles are escaped/sanitized to handle special characters like & to prevent command-line crashes.
