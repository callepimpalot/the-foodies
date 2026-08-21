# TASK 04 — Fix miscategorised items + custom aisle order

| | |
|---|---|
| **Feature it improves** | Shop |
| **Impact** | ★★★★☆ |
| **Effort** | S–M |
| **Horizon** | 🟢 NOW |
| **Family-readiness** | ⚠️ Aisle order is genuinely per-person — see note |

---

## THE GAP

Two distinct problems in one function.

**Problem 1 — the catch-all is wrong.** `categoriseIngredient()` ends with:

```js
// src/lib/consolidateIngredients.js:11
return 'Produce';
```

Anything the seven regexes don't match is declared a vegetable. Real examples from a normal week:

| Ingredient | Categorised as | Should be |
|---|---|---|
| `cinnamon` | Produce ❌ | Herbs & Spices |
| `chocolate` | Produce ❌ | Pantry |
| `honey` | Produce ❌ | Pantry |
| `almonds` | Produce ❌ | Pantry |
| `soy sauce` | Pantry ✅ (matches `sauce`) | Pantry |
| `tofu` | Produce ❌ | Pantry / Chilled |
| `lentils` | Produce ❌ | Pantry |

So your Produce section — the *first* section you walk to — is padded with things that live three
aisles away. The categorisation is actively misleading rather than merely incomplete.

**Problem 2 — the order is hardcoded to a shop you may not use.**

```js
// consolidateIngredients.js:14-16
export const CATEGORY_ORDER = ['Produce', 'Meat & Fish', 'Dairy & Eggs', 'Bakery',
                               'Pantry', 'Herbs & Spices', 'Frozen'];
```

That order is fixed at build time. If your actual supermarket puts bakery at the entrance and produce
at the back, the list fights you on every trip.

## WHAT THE BEST DO

- **`[verified]`** Shoppers using a list spend roughly **23 minutes less** in store than those
  without one, and lists organised **by category or store layout** complete shopping **up to 40%
  faster** than unorganised ones. There's a spending effect too — organised shoppers spend **15–20%
  less**, because they aren't wandering past impulse buys. Category ordering isn't cosmetic; it's the
  entire value of a digital list over a paper one.
- **`[verified]`** Bring! and AnyList both let users **reorder categories** to match their own
  supermarket's layout, and treat this as a headline feature. The consistent industry advice is to
  order by **category, not aisle number** — aisle numbers differ per store and change, categories
  don't.
- **`[report only]`** The report's `<AisleGroupContainer />` spec groups by "standard grocery store
  topology (Produce, Dairy, Meat, Center Aisle) to optimize the physical walking route" — but it
  assumes a fixed topology and never mentions letting the user reorder. Your competitors are ahead of
  the report here.

## THE CHANGE

**Part A — a real ingredient→category map (the bulk of the value)**
- Replace the regex cascade with a keyword→category lookup covering the common shop.
- Add the missing categories the current list lacks: **Frozen** exists, but there's no home for
  baking goods, tinned/dry goods vs. condiments, or chilled non-dairy (tofu, hummus).
- **Change the fallback from `Produce` to a real `Other` category, sorted last.** An honest "I don't
  know" bucket at the end of the list is strictly better than a confident wrong answer at the front.
- Reuse `src/data/commonItems.js` — it already carries category assignments for common groceries.
  Don't build a second, conflicting source of truth.

**Part B — user-reorderable category order**
- Persist a category order in the same context TASK_01 creates.
- A simple reorder UI (long-press drag, or plain up/down chevrons — chevrons are fine and much
  cheaper).
- Falls back to the current default when unset.

**Part A is most of the benefit. If the session is short, ship A and skip B.**

## WHY DESIGNED THIS WAY

- **Why `Other` last instead of guessing?** A wrong category costs a walk across the shop. An `Other`
  bucket costs a glance. And it makes the map's gaps *visible*, so it improves over time instead of
  silently rotting.
- **Why a keyword map rather than asking Gemini to categorise?** Same reasoning as TASK_03 — the Shop
  tab must work fast and offline. Also, categorisation is stable: onions are always produce. This is
  reference data, not a judgement call.
- **Why chevrons over drag-and-drop?** You reorder categories roughly once, ever. Drag-and-drop on
  mobile is fiddly to build and easy to trigger accidentally. Spend the effort on Part A.
- **Why reuse `commonItems.js`?** It already exists with emoji + category per item for the Pantry's
  quick-add. Two divergent category maps in one codebase is a guaranteed future inconsistency.

## FAMILY-READINESS NOTE ⚠️

Aisle order is one of the few things that is genuinely **personal, not shared** — you and your wife
might shop at different supermarkets. When TASK_12 lands, category *order* should stay per-user even
though the *list* becomes shared. Worth storing it under a user-scoped key from the start rather than
alongside the shared list data.

## ACCEPTANCE CRITERIA

- [ ] `cinnamon` → Herbs & Spices; `honey`, `almonds`, `lentils`, `chocolate` → Pantry
- [ ] An unrecognised ingredient → `Other`, rendered **last**, never Produce
- [ ] No category renders as an empty section
- [ ] `commonItems.js` categories and shopping categories don't contradict each other
- [ ] (Part B) Reordering persists across reload and drives actual render order
- [ ] Existing categorisation of common items doesn't regress — spot-check 20 real ingredients from
      your actual recipe library, not invented ones

## RISKS / EDGE CASES

- Order of evaluation matters: `chicken stock` should be Pantry, not Meat & Fish. The current regex
  cascade gets this **wrong** (`chicken` matches first). Test it explicitly.
- Same trap: `coconut milk` → Pantry, not Dairy. `garlic bread` → Bakery, not Herbs & Spices.
- Run this **after** TASK_03 if you're doing both, so categorisation runs on canonicalised names.

---

## ▶ CLAUDE CODE PROMPT

```
Read .agent/inspiration/TASK_04_aisle_categorisation.md, then CLAUDE.md,
.agent/DATA_MODELS.md and .agent/DESIGN_SYSTEM.md before writing any code.

Fix shopping-list categorisation in src/lib/consolidateIngredients.js.

PART A (required):
Replace the regex cascade in categoriseIngredient() with a keyword-to-category
lookup map covering a normal supermarket shop.

The most important change: the fallback currently returns 'Produce', so every
unrecognised ingredient (cinnamon, honey, almonds, lentils, chocolate, tofu) is
listed as a vegetable in the first section of the list. Add an 'Other' category,
sort it LAST in CATEGORY_ORDER, and make it the fallback.

Reuse the category assignments already in src/data/commonItems.js rather than
inventing a second, conflicting map. If the two disagree, reconcile them and say
which you changed.

Watch out for substring collisions that the current code gets wrong:
- "chicken stock" must be Pantry, not Meat & Fish
- "coconut milk" must be Pantry, not Dairy & Eggs
- "garlic bread" must be Bakery, not Herbs & Spices
Order your matching so more specific phrases win over single-word matches.

PART B (do only if Part A is complete and verified):
Let the user reorder categories to match their own supermarket. Persist the order
(reuse the ShopContext from TASK_01 if it exists; otherwise localStorage with the
same try/catch pattern as src/context/PlanContext.jsx). Use simple up/down chevron
buttons, NOT drag-and-drop. Fall back to the default order when unset.
Store it under a user-scoped key - aisle order stays personal even when the list
later becomes shared between family members.

Write a runnable check that asserts categorisation for at least 25 ingredients,
including every collision case above and the Other fallback. Follow the pattern of
the existing scripts in src/scripts/.

Then run it against the REAL ingredient names in the app's recipe library (query
Supabase, or read final_recipes.json) and show me the 20 most common ingredients
that land in 'Other', so I can decide what to add to the map.

Constraints: no hardcoded design values, DESIGN_SYSTEM.md tokens only, Lucide icons
only, no emoji in UI chrome.

Do not assume you can reach my dev server - give me a hand-test checklist.
```

## DECIDE

- [ ] **Approve Part A only** (recommended — most of the value, short session)
- [ ] **Approve A + B**
- [ ] **Defer**
