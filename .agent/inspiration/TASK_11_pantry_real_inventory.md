# TASK 11 — Pantry with quantities + "use it up"

| | |
|---|---|
| **Feature it improves** | Pantry / Plan |
| **Impact** | ★★★★☆ (if you'd actually maintain it — see the warning) |
| **Effort** | L |
| **Horizon** | 🟡 NEXT (but do TASK_07 first) |
| **Family-readiness** | ⚠️ Build after TASK_07, or you'll build it twice |

---

## THE GAP

Household Essentials today is a flag-based grid: `{ id, name, emoji, category, flagged }`. `flagged`
means "put it on the shopping list." There's no quantity, no expiry, no notion of what you actually
have.

So the app can't answer the two questions that would genuinely change your week:
- *What do I have that's about to go off?*
- *What can I cook tonight without shopping?*

## ⚠️ READ THE COUNTER-EVIDENCE FIRST

This is the one task where the report's evidence argues **against** the report's own recommendation,
and that's the most useful thing in it.

- **`[report only]`** MealBoard has the deepest pantry inventory system of any competitor — quantities,
  unit conversion factors, the lot. The report's verdict: *"the manual data entry burden is immense,
  causing many users to **abandon the pantry feature entirely**."*
- **`[report only]`** Samsung Food (Whisk) *"falls short of executing a true closed-loop deduction
  system without heavy manual intervention."*
- **`[report only]`** The report's own solution — the "Autonomous Pantry Agent" with receipt OCR and
  fridge photos — exists **specifically because** manual pantry tracking is known to fail. It's not
  proposed as an enhancement; it's proposed as damage control for a feature nobody maintains.

**The honest read: pantry tracking is the most-abandoned feature in this entire product category.**
Building a faithful version of MealBoard's model would most likely produce a screen you stop updating
within three weeks, and then actively mistrust.

So the design question isn't "how do we track inventory well." It's **"what's the least tracking that
still answers a useful question."**

## THE CHANGE — deliberately scoped down

**Phase 1 — "running low" and "use it up", no quantities**

Add two optional fields to the existing item shape: `lowStock: boolean` and `useByDate: string | null`.

- One tap on the grid marks something low → it flows to the shopping list (mechanism already exists
  via `flagged`)
- Optionally set a use-by date on fresh items
- Home screen surfaces *"Spinach — use by Thursday"* with a one-tap "find a recipe" that filters the
  library by that ingredient

**That's it.** No quantities, no units, no deduction, no conversion factors. Two taps of input, and
it answers the food-waste question — which is the one with real money and real guilt attached.

**Phase 2 — only if Phase 1 survives a month of real use**

Quantities and cook-time deduction. Gate it behind honest self-assessment: *did I actually keep
Phase 1 up to date?* If no, stop — you've learned the same thing MealBoard's users did, at a fraction
of the cost.

**Explicitly not in scope:** receipt OCR (that's TASK_14 territory — heavy, and pointless if you
don't maintain the simple version first).

## WHY DESIGNED THIS WAY

- **Why expiry before quantity?** Because expiry has a *forcing function* — food visibly goes off,
  and you feel it. Quantity has none; nothing bad happens immediately when your count drifts from
  reality, so it drifts, and then the whole feature is lying to you. Expiry data self-corrects
  (the item leaves), quantity data self-destructs.
- **Why one-tap "low" instead of counts?** Because "am I running low on olive oil?" is a glance, and
  "how many ml of olive oil do I have?" requires picking up the bottle. The first you'll do; the
  second you won't. Match the input cost to the actual value of the answer.
- **Why phase it explicitly?** Because the report's evidence predicts failure. Phasing turns that
  into a cheap experiment instead of an expensive assumption. If Phase 1 doesn't stick, you've spent
  a session, not a month.
- **Why after TASK_07?** Because with two people, pantry state is inherently shared — you both use
  the same fridge. Building it device-local first guarantees rework.

## FAMILY-READINESS NOTE ⚠️

Of everything in this backlog, pantry is the feature that makes *least* sense as per-device data.
Two people, one kitchen, one set of groceries. If your wife marks milk as low and your phone doesn't
know, the feature is worse than nothing — it'll tell you confidently that you have milk. **Do
TASK_07 first.**

## ACCEPTANCE CRITERIA

- [ ] One tap marks an item low; it appears on the shopping list
- [ ] Optional use-by date, set in ≤2 taps
- [ ] Home screen surfaces items expiring within 3 days, sorted soonest first
- [ ] "Find a recipe" filters the library to recipes using that ingredient (reuse
      `src/lib/recipeSearch.js` — don't build a second search)
- [ ] Nothing expiring → the section renders nothing at all, not an empty state
- [ ] Existing Essentials data migrates without loss; new fields are optional
- [ ] Buying a flagged item clears the flag
- [ ] Existing flag→Shop behaviour is not regressed

## RISKS / EDGE CASES

- **The real risk is you stop using it.** Build Phase 1, use it for a month, then decide honestly.
  Don't build Phase 2 on the assumption you'll maintain it.
- Don't nag. An expiry section that shouts at you every time you open the app is a section you'll
  learn to ignore, and it'll poison the Home screen.
- Ingredient→recipe matching has the same substring traps as TASK_10 — reuse the same matcher.
- Adding fields to `InventoryContext` means updating `DATA_MODELS.md` §2, which is **already stale**
  (see TASK_05). Fix that first or the drift compounds.

---

## ▶ CLAUDE CODE PROMPT

```
Read .agent/inspiration/TASK_11_pantry_real_inventory.md, then CLAUDE.md,
.agent/DATA_MODELS.md and .agent/DESIGN_SYSTEM.md. Read
src/context/InventoryContext.jsx, src/components/Inventory.jsx and
src/lib/recipeSearch.js first.

Prerequisites: TASK_05 (DATA_MODELS section 2 is currently stale and describes
fields that no longer exist) and ideally TASK_07 (pantry state should be shared
between household members, not per-device).

Build PHASE 1 ONLY. Do not build quantities, units, or cook-time deduction.

Context for why: the research this came from shows pantry tracking is the
most-abandoned feature in meal-planning apps - MealBoard's users quit it because of
the manual data-entry burden. So this is deliberately the minimum tracking that
still answers a useful question. Respect that scope.

1. Extend the InventoryContext item shape with two OPTIONAL fields:
   lowStock (boolean) and useByDate (string | null, ISO date).
   Existing stored items must migrate without loss - both fields absent is valid.

2. In the Pantry grid: one tap marks an item low-stock, which flows to the shopping
   list through the existing `flagged` mechanism. Setting a use-by date must take at
   most two taps - don't build a heavy date picker flow.

3. On the Home screen, surface items expiring within 3 days, soonest first, with a
   "find a recipe" action that filters the recipe library to recipes using that
   ingredient. Reuse src/lib/recipeSearch.js - do not build a second search
   implementation. If TASK_10 exists, reuse its word-boundary ingredient matcher
   rather than substring matching ("salt" must not match "salted butter").

4. If nothing is expiring, render NOTHING - no empty state, no placeholder. This
   section must never nag; a Home screen that shouts every launch gets ignored.

5. Update .agent/DATA_MODELS.md section 2 to match, and add a changelog row.

Constraints: mandatory optional chaining, DESIGN_SYSTEM.md tokens only, Lucide icons
only, no emoji in UI chrome (emoji stay confined to pantry item DATA per
DESIGN_SYSTEM.md section 2), numbers in .t-mono.

Do not regress the existing flag-to-shopping-list behaviour - verify it explicitly.

Give me a hand-test checklist. Do not assume you can reach my dev server.
```

## DECIDE

- [ ] **Approve Phase 1 only** (recommended — treat it as an experiment)
- [ ] **Approve Phase 1 + 2** (against the evidence; say so knowingly)
- [ ] **Defer** — I don't want to maintain a pantry
