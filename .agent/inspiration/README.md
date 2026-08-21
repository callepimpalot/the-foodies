# 🔎 INSPIRATION BACKLOG — Meal Buddy
# Source: Gemini deep-research report ("Architecting the Modern Meal Planning Ecosystem")
# + web verification + a full audit of the live codebase (Aug 21, 2026)

---

## HOW TO USE THIS

Each file is a **self-contained, decision-ready task**. Pick one when you have a session, read the
top block, decide yes/no, and if yes — paste the `▶ CLAUDE CODE PROMPT` at the bottom into a fresh
session. That prompt is written to be enough on its own.

Every task carries:
- **The gap** — what your app does today, with real `file:line` references (not guesses)
- **What the best do** — the competitor evidence, from the report *and* verified on the web
- **Why designed this way** — the reasoning, so you can disagree with it
- **Impact / Effort / Horizon** — so you can rank it against your own time
- **Family-readiness** — whether it survives the two-user future, or needs care now

---

## THE ONE THING TO UNDERSTAND FIRST

You said the near-term goal is: **onboard your wife, one family, "if one person plans, the other
shops."**

That goal is **not blocked by auth**. It is blocked by *persistence*:

| Feature | Where its data lives today | Shareable? |
|---|---|---|
| Recipes | Supabase `recipes` table | ✅ already shared |
| Plan | `localStorage` key `meal_buddy_plan` (`PlanContext.jsx`) | ❌ per-device |
| Shop | **not persisted at all** — recomputed each render (`ShopView.jsx:11`) | ❌ per-device |
| Essentials | `localStorage` (`InventoryContext.jsx:3-4`) | ❌ per-device |

So "she plans, I shop" is impossible today even if you both installed the app — you'd each see your
own separate plan. **[TASK_07](TASK_07_plan_shop_to_supabase.md) is the actual unlock**, and it's
worth reading early even if you don't build it yet, because it changes how you'd want TASK_01 done.

Auth/families ([TASK_12](TASK_12_family_households.md)) is the *later* layer on top of that.

---

## RANKED BACKLOG

### 🟢 TIER 1 — NOW (solo-use benefit, this week, no architecture required)

| # | Task | Feature | Impact | Effort | Family-ready? |
|---|---|---|---|---|---|
| [01](TASK_01_shopping_list_persistence.md) | **Shopping list survives a reload** | Shop | ★★★★★ | S | ⚠️ design for TASK_07 |
| [02](TASK_02_cook_mode_wake_lock.md) | **Screen stays awake in Cook Mode** | Cook | ★★★★★ | XS | ✅ |
| [03](TASK_03_ingredient_consolidation.md) | **Smarter ingredient merging** ("2 onions", not 3 rows) | Shop | ★★★★☆ | M | ✅ |
| [04](TASK_04_aisle_categorisation.md) | **Fix miscategorised items + custom aisle order** | Shop | ★★★★☆ | S | ⚠️ order is per-person |
| [05](TASK_05_pantry_counter_bug.md) | **Fix the dead "0 items available" counter** | Pantry | ★★☆☆☆ | XS | ✅ |
| [06](TASK_06_landing_page.md) | **Landing page** (in-repo first, publish later) | — | ★★★☆☆ | M | ✅ |

**Suggested first session:** 02 + 05 + 01 together — roughly one sitting, and 02 alone changes how the
app feels in the kitchen more than anything else on this list.

### 🟡 TIER 2 — NEXT (bigger wins; two of these unlock the family goal)

| # | Task | Feature | Impact | Effort | Family-ready? |
|---|---|---|---|---|---|
| [07](TASK_07_plan_shop_to_supabase.md) | **Move Plan + Shop into Supabase** ← the family unlock | Plan/Shop | ★★★★★ | L | 🔑 enabler |
| [08](TASK_08_url_capture_jsonld.md) | **Paste a recipe URL** (free/instant path before Gemini) | Capture | ★★★★☆ | M | ✅ |
| [09](TASK_09_shopping_list_provenance.md) | **"Why is this on my list?"** | Shop | ★★★☆☆ | S | ✅ |
| [10](TASK_10_cook_mode_step_ingredients.md) | **Per-step ingredients in Cook Mode** | Cook | ★★★☆☆ | M | ✅ |
| [11](TASK_11_pantry_real_inventory.md) | **Pantry with quantities + "use it up"** | Pantry | ★★★★☆ | L | ⚠️ do after 07 |

### 🔵 TIER 3 — LATER (real ideas, wrong time — revisit when the trigger fires)

| # | Task | Trigger to revisit | Impact when it lands | Effort |
|---|---|---|---|---|
| [12](TASK_12_family_households.md) | **Families and real accounts** | When you actually onboard your wife | ★★★★★ | XL |
| [13](TASK_13_semantic_recipe_search.md) | **Semantic recipe search** | When library search starts failing you | ★★★☆☆ | L |
| [14](TASK_14_social_video_capture.md) | **Capture from Instagram / TikTok** | When you're screenshotting Reels often | ★★★★☆ | XL |
| [15](TASK_15_taste_model.md) | **Taste model** | Existing brief — answer its open questions | ★★★☆☆ | L |

**Note on 12 and 15:** both are *conversations* before they're builds. TASK_12 needs a feature brief
written (it's vault-deferred in PROJECT.md). TASK_15 already has a brief and needs five questions
answered. Neither should start as a coding session.

---

## WHAT I DELIBERATELY DID *NOT* TURN INTO A TASK

Being explicit so you know these were considered and rejected, not missed:

- **React Native / Expo rewrite** — the report mandates it. Your app is React + Vite + PWA and is
  already installed on your phone. A rewrite buys you native share-sheet integration and costs you
  the entire codebase. Not worth it for one dad. Revisit only if share-sheet capture becomes the
  main way you save recipes (see TASK_14).
- **Python FastAPI + Celery + Redis backend** — the report's architecture. You have Supabase + Netlify
  and no server to run. Where a task genuinely needs server-side work (TASK_08, TASK_14), I've
  specified a **Netlify Function**, which you already have the infrastructure for.
- **Kroger / Instacart / Walmart grocery APIs** — US-only retail integrations. The report leans on
  these heavily for its "budget optimization" feature. Not applicable to you.
- **Fonts not loaded** — PROJECT.md flags Playfair/DM Sans as a known gap. **This is stale.**
  DESIGN_SYSTEM.md v3.0 replaced them with Anton/Zilla Slab/IBM Plex, self-hosted via `@fontsource`
  and imported in `src/index.css`. Nothing to fix. (PROJECT.md line 14 should be corrected — it's
  rolled into TASK_05, which already touches doc drift.)
- **Macro/calorie tracking rings** — the report's `<MacroProgressRings />`. Nothing in your vision
  doc suggests you want a nutrition tracker, and it implies per-person daily logging, which is a
  different app. Left out on purpose.

---

## EVIDENCE QUALITY — READ THIS BEFORE TRUSTING THE REPORT

The Gemini report is a genuinely useful competitive scan, but calibrate it:

- **It is directionally strong, specifically weak.** Its competitor grievances (Paprika's brittle
  scrapers, MealBoard's data-entry abandonment, AnyList's aggregation failures) are consistent and
  match what you can verify. Its *architecture* recommendations are generic startup boilerplate
  written without knowledge of your stack.
- **Its citations are mostly Reddit threads, App Store reviews, and vendor marketing pages** — including
  competitor comparison pages (`preplo.app/vs/pestle`) which are marketing, not neutral analysis.
- **It was written for a funded startup building a market product.** You are one dad building for
  himself and, soon, his wife. Every "monetization", "affiliate revenue", and "scalability" argument
  in it is noise for you.
- Where I've added independent web verification, it's marked **`[verified]`** in the task file.
  Where a claim rests only on the report, it's marked **`[report only]`**.

---

*Generated Aug 21, 2026. Codebase audited at commit `6f85546`.*
