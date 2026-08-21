# TASK 09 — "Why is this on my list?"

| | |
|---|---|
| **Feature it improves** | Shop |
| **Impact** | ★★★☆☆ |
| **Effort** | S–M |
| **Horizon** | 🟡 NEXT |
| **Family-readiness** | ✅ Becomes *more* valuable with two users |

---

## THE GAP

`buildShoppingList()` merges ingredients across every planned day and throws away where each one came
from. The output item is:

```js
// src/lib/consolidateIngredients.js:59-65
{ key, name, unit, quantity, category }
```

So the list says **"Onions — 3"** and nothing else. Standing in the shop you can't answer:

- Why do I need three? Is that right, or did something double-count?
- If I drop Thursday's curry, how many do I actually need?
- Is this for a meal I still intend to cook this week?

This matters most exactly when the number looks *wrong*. Right now, if consolidation produces a
surprising quantity, you have no way to check it short of opening the Plan tab and doing the
arithmetic yourself. That's also true when consolidation has a **bug** — which, given TASK_03 is
changing that logic, is worth being able to see.

## WHAT THE BEST DO

- **`[report only]`** This is the report's `<AggregatedListItem />` spec, and it's one of its
  sharpest UI observations: *"Displays the consolidated item (e.g. '3x Yellow Onions'). An expanding
  accordion chevron reveals the source references (e.g. '1 for Stew, 2 for Tacos') allowing the user
  to understand **why** a quantity is required."*
- **`[report only]`** It's positioned as the answer to the AnyList grievance — users don't just want
  correct aggregation, they want *legible* aggregation. Trust in a merged number requires being able
  to unpack it.
- The report is right that this is a competitive gap. It's also, for you specifically, a debugging
  tool for TASK_03.

## THE CHANGE

1. In `buildShoppingList()`, accumulate a `sources` array on each item as it merges:
   ```js
   sources: [{ recipeTitle, date, quantity, unit }]
   ```
2. In `ShopView`, add a chevron on any row with more than one source. Tapping expands a small
   breakdown inside the existing `.list-ticket` row structure.
3. Single-source items get **no** chevron — nothing to reveal, and adding one to every row is noise.

**Pairs naturally with TASK_03.** If you're rewriting consolidation anyway, threading `sources`
through costs almost nothing extra, and gives you a way to *see* whether the new merging logic is
behaving. Doing both in one session is more efficient than doing either alone.

## WHY DESIGNED THIS WAY

- **Why an accordion rather than always-visible?** Your shopping list is scanned one-handed while
  walking. Sub-text under every row would double the list's height and slow the primary task. The
  information is only wanted when a number looks surprising — make it available, not present.
- **Why only on multi-source rows?** A chevron that reveals "1 for Stew" when the row already says
  "1" is a broken promise. Chevron presence should itself carry information: *this number is a sum*.
- **Why include the date, not just the recipe?** Because with an extended plan you can have the same
  recipe on two days, and "2 for Stew" would be ambiguous where "Tue: 1, Fri: 1" isn't.

## FAMILY-READINESS NOTE

With two people this gets *better*, not harder. Once TASK_07 lands and your wife plans a meal you
didn't, "why is fish sauce on my list?" becomes a genuinely common question — and the accordion
answers it without a phone call. Consider adding *who* planned it once TASK_12 gives you user
identity.

## ACCEPTANCE CRITERIA

- [ ] An ingredient used by two recipes shows a chevron; tapping reveals both, with quantities
- [ ] Single-source items show no chevron
- [ ] The revealed quantities **sum to the displayed total** (this is the whole point — if they
      don't, that's a consolidation bug and you've just built the tool that found it)
- [ ] Scaled servings are reflected per source, not just in the total
- [ ] Expanded state doesn't break the checkbox tap target or trigger a check by accident
- [ ] Works with TASK_03's compound quantities (`"2 cloves + 30g"`)
- [ ] Household items (which have no recipe source) are unaffected

## RISKS / EDGE CASES

- **Tap-target collision is the main risk.** The whole row is currently a `<button>`
  (`ShopView.jsx:113`). Nesting an interactive chevron inside a button is invalid HTML and will
  misfire. Restructure the row rather than nesting.
- Keep the 44×44px minimum touch target (DESIGN_SYSTEM.md §4) for both the check and the chevron.
- Leftover days deliberately contribute no ingredients — make sure the breakdown doesn't imply
  otherwise by omitting them silently. If a source day is a leftover, either show it as such or
  attribute it to its source day.

---

## ▶ CLAUDE CODE PROMPT

```
Read .agent/inspiration/TASK_09_shopping_list_provenance.md, then CLAUDE.md,
.agent/DATA_MODELS.md and .agent/DESIGN_SYSTEM.md.

Make each consolidated shopping list item explain where it came from.

1. In src/lib/consolidateIngredients.js, have buildShoppingList() accumulate a
   `sources` array on each item as it merges:
     sources: [{ recipeTitle, date, quantity, unit }]
   Quantities must be the SCALED per-source amounts (after getServingsRatio), so
   that the sources always sum to the item's displayed total.

2. In src/views/ShopView.jsx, show an expand chevron ONLY on items with more than
   one source. Tapping it reveals a compact breakdown showing each source recipe,
   its day, and its quantity. Single-source items get no chevron - the chevron's
   presence should itself signal "this number is a sum".

IMPORTANT STRUCTURAL CONSTRAINT: the list row is currently a single <button>
(around ShopView.jsx:113). You cannot nest an interactive chevron inside a button -
it's invalid HTML and the taps will misfire. Restructure the row so the checkbox
and the chevron are sibling controls, each with a minimum 44x44px touch target per
DESIGN_SYSTEM.md section 4. Verify tapping the chevron does NOT toggle the checkbox.

Handle these cases:
- Leftover days contribute no ingredients by design. Don't silently omit them in a
  way that makes the breakdown look wrong - attribute them to their source day or
  label them.
- If TASK_03 has been done, the compound quantity format ("2 cloves + 30g") must
  still render correctly in both the total and the breakdown.
- Household essentials rows have no recipe source - leave them unchanged.

Use the existing .list-ticket / .list-row classes and Lucide icons. No emoji in
chrome. No hardcoded colors or spacing.

Give me a hand-test checklist, including a case where one recipe appears on two
different days. Do not assume you can reach my dev server.
```

## DECIDE

- [ ] **Approve** — and ideally bundle with TASK_03
- [ ] **Approve standalone**
- [ ] **Defer** — I trust the numbers
