# TASK 05 — Fix the dead "0 items available" counter (+ doc drift)

| | |
|---|---|
| **Feature it improves** | Pantry / Home |
| **Impact** | ★★☆☆☆ (small, but it's a live wrong number on your home screen) |
| **Effort** | XS (~20 minutes) |
| **Horizon** | 🟢 NOW |
| **Family-readiness** | ✅ No implications |

---

## THE GAP

This is a straight bug, found by audit rather than by the report.

```jsx
// src/views/HomeView.jsx:220
<span className="t-mono">{items.filter(i => i.inPantry).length}</span> items available
```

No item in `InventoryContext` has an `inPantry` field. The real item shape is:

```js
// src/context/InventoryContext.jsx:23-27
{ id, name, emoji, category, flagged }
```

`i.inPantry` is `undefined` for every item, so the filter always returns `[]`. **The Home screen has
permanently displayed "0 items available" since the Essentials grid was rebuilt.** A grep confirms
`inPantry` appears in exactly one place in the entire `src/` tree — this is orphaned code from the
pre-rebuild data model, not a feature that half-works.

### The same drift is in your docs

`DATA_MODELS.md` §2 describes Household Essentials as:

> *"**in-memory only, no persistence**. Resets to 5 hardcoded seed items on every page reload. This is
> real current behavior, not a bug being tracked — no localStorage or Supabase wiring exists."*

That is **no longer true.** `InventoryContext.jsx:3-4, 52-58` reads and writes `localStorage` under
`meal_buddy_essentials_items` and `meal_buddy_essentials_categories`. The documented item shape
(`quantity`, `targetQuantity`, `inPantry`, `isMaster`, `toBuy`) has also been fully replaced by the
five-field shape above.

Since CLAUDE.md instructs every session to trust `DATA_MODELS.md` for field names, this drift will
keep generating bugs exactly like the one above. Fixing the doc is the more valuable half of this task.

`PROJECT.md:14` carries a third stale claim — that Playfair Display / DM Sans aren't loaded.
DESIGN_SYSTEM.md v3.0 replaced those fonts entirely with Anton / Zilla Slab / IBM Plex, self-hosted
via `@fontsource`. Nothing is broken; the note should go.

## WHAT THE BEST DO

Not a competitive-inspiration task — no evidence section applies. It's on the list because it's a
visible wrong number, it costs 20 minutes, and it removes a live trap for future sessions.

## THE CHANGE

1. **Decide what the counter should say.** `flagged` means "on the shopping list", which is *not*
   "available". Options:
   - `items.length` → "N items tracked" (simplest, honest)
   - `items.filter(i => !i?.flagged).length` → "N stocked" (treats flagged = needs buying)
   - Remove the counter and show the category count instead

   **Recommendation: "N items tracked"** — the current data model has no concept of stock level, so
   any "available" phrasing is a claim the data can't support. Don't invent a truth the model
   doesn't hold. (TASK_11 is where "available" becomes meaningful.)
2. Apply the fix in `HomeView.jsx`.
3. **Rewrite `DATA_MODELS.md` §2** against the real `InventoryContext.jsx`: the five-field shape, the
   two localStorage keys, the user-editable categories list, and the fact that flagging is what feeds
   the Shop tab's Household section.
4. Delete the stale font note at `PROJECT.md:14`.
5. Grep for any other references to removed fields (`isMaster`, `toBuy`, `targetQuantity`) and
   confirm none remain.

## WHY DESIGNED THIS WAY

- **Why not just make `inPantry` work?** Because it would mean adding a field to carry a concept
  ("in stock" vs "not in stock") that the Essentials feature deliberately dropped when it was
  simplified to a flag-based grid (see commit `f4206f7`). Re-adding it here, on the Home screen,
  would resurrect a data model the app intentionally walked away from. If you want real stock
  tracking, that's TASK_11 — a deliberate decision, not a side effect of fixing a counter.
- **Why bundle the doc fix in?** Because the bug and the stale doc have the same root cause. Fixing
  only the symptom leaves the trap armed for the next session.

## ACCEPTANCE CRITERIA

- [ ] Home screen shows a correct, non-zero count reflecting real Essentials data
- [ ] Add an item in Pantry → the Home count increases
- [ ] `grep -rn "inPantry\|isMaster\|toBuy\|targetQuantity" src/` returns nothing
- [ ] `DATA_MODELS.md` §2 matches `InventoryContext.jsx` exactly — shape, keys, persistence
- [ ] `DATA_MODELS.md` changelog has a new dated row
- [ ] `PROJECT.md`'s stale font note is gone
- [ ] Number still renders in IBM Plex Mono (`.t-mono`) — DESIGN_SYSTEM.md's most-regressed rule

## RISKS / EDGE CASES

- Only genuine risk is picking a counter semantic that misleads differently. Match the label to what
  the data actually knows.

---

## ▶ CLAUDE CODE PROMPT

```
Read .agent/inspiration/TASK_05_pantry_counter_bug.md, then CLAUDE.md,
.agent/DATA_MODELS.md and .agent/DESIGN_SYSTEM.md.

Two related jobs: a live bug, and the stale documentation that caused it.

BUG:
src/views/HomeView.jsx line 220 renders
  items.filter(i => i.inPantry).length
but no item in src/context/InventoryContext.jsx has an `inPantry` field - the real
shape is { id, name, emoji, category, flagged }. So the Home screen has been
permanently showing "0 items available".

Fix it to show items.length with the label "items tracked". Do NOT re-add an
inPantry field: `flagged` means "needs buying", not "in stock", and the Essentials
feature deliberately dropped stock-level tracking when it became a flag-based grid.
Don't claim something the data model can't support.

Keep the number in .t-mono - DESIGN_SYSTEM.md requires every number to render in IBM
Plex Mono, and it's the most commonly regressed rule in this codebase.

Then grep src/ for inPantry, isMaster, toBuy and targetQuantity and remove any other
orphaned references from the old data model.

DOCS (the more important half):
1. Rewrite section 2 of .agent/DATA_MODELS.md to match InventoryContext.jsx as it
   actually is. It currently claims Household Essentials is "in-memory only, no
   persistence" and lists fields (quantity, targetQuantity, inPantry, isMaster,
   toBuy) that no longer exist. In reality it persists to localStorage under
   meal_buddy_essentials_items and meal_buddy_essentials_categories, the item shape
   is the five fields above, categories are user-editable, and `flagged` is what
   feeds the Shop tab's Household section. Read the file and document what's there -
   don't copy my summary.
2. Add a dated row to the DATA_MODELS.md changelog table.
3. Delete the stale note at .agent/PROJECT.md line 14 claiming Playfair Display and
   DM Sans aren't loaded. DESIGN_SYSTEM.md v3.0 replaced them with Anton, Zilla Slab
   and IBM Plex, self-hosted via @fontsource and imported in src/index.css. Verify
   that's true before deleting.

Then tell me how to verify the count by hand. Do not assume you can reach my dev
server.
```

## DECIDE

- [ ] **Approve** — "N items tracked"
- [ ] **Approve, but** use a different counter semantic (say which)
- [ ] **Approve docs only** — leave the counter, fix the drift
