# TASK 01 — Shopping list survives a reload

| | |
|---|---|
| **Feature it improves** | Shop |
| **Impact** | ★★★★★ |
| **Effort** | S (~1 short session) |
| **Horizon** | 🟢 NOW |
| **Family-readiness** | ⚠️ Design for TASK_07 — see note at the bottom |

---

## THE GAP

Your checked-off state is component-local `useState` and is thrown away the moment `ShopView`
unmounts:

```js
// src/views/ShopView.jsx:11
const [checkedKeys, setCheckedKeys] = useState(() => new Set());
```

`DATA_MODELS.md` §4 confirms this is known and was called "an intentional POC simplification."

**Why that's not survivable in real use:** this app is an installed PWA on your phone. You are in a
shop, one-handed, ticking items. Anything that unmounts the view or evicts the tab wipes every tick:

- switching to another app to check a message (iOS aggressively evicts backgrounded PWA tabs)
- tapping any other nav item and coming back
- the phone locking and the PWA cold-starting on resume
- a Netlify deploy landing while you shop (PROJECT.md notes the service worker already causes
  stale-version confusion)

The failure lands at the exact moment of maximum cost — mid-shop, hands full, no way to recover
which of the 30 items you'd already put in the trolley. This is the single highest
frustration-per-line-of-code item in the codebase.

## WHAT THE BEST DO

- **`[verified]`** Every mainstream list app (AnyList, Bring!, Listonic) treats the checked state as
  *durable, synced* data, not view state. It's table stakes, not a feature — which is exactly why
  the report never mentions it: it only analyses features competitors *market*, and nobody markets
  "our list doesn't delete itself."
- **`[report only]`** The report's `<SwipeToPantryRow />` concept assumes a persistent
  `item.isPurchased` field on the list item — its own data model takes persistence for granted.

This is a gap the report structurally *couldn't* find. It came out of auditing your code.

## THE CHANGE

Persist the shopping list session to `localStorage`, keyed to the plan it was generated from.

1. New `src/context/ShopContext.jsx` (mirrors `PlanContext.jsx`'s existing localStorage pattern —
   copy that shape, don't invent a new one).
2. Persist `checkedKeys` as an array under `meal_buddy_shop_checked`.
3. Persist a `planFingerprint` — a cheap hash of the confirmed plan's recipe IDs + servings.
   **On mount, if the fingerprint differs from the current plan, clear the checks.** This is what
   stops stale ticks bleeding into next week's shop.
4. Move the `householdSnapshot` (`ShopView.jsx:15`) into the same context so it stops being
   re-snapshotted on every remount.
5. Add a quiet "Reset list" ghost button so you can always start the shop over deliberately.

## WHY DESIGNED THIS WAY

- **Why fingerprint rather than a date/week key?** Your plan is not week-bound — `PROGRESS.md` notes
  an "Add a day" feature that extends past the initial 7-day window. A date key would desync the
  moment you extend. The fingerprint tracks *what you're actually shopping for*.
- **Why clear on change rather than migrate ticks?** If you swap Tuesday's recipe mid-shop, the
  quantities on half your rows change. Silently keeping ticks against changed quantities is worse
  than an honest reset.
- **Why not Supabase now?** Because you can have this working today, and TASK_07 will move all three
  contexts at once — doing it piecemeal means two migrations. See below.

## FAMILY-READINESS NOTE ⚠️

When TASK_07 moves Plan + Shop to Supabase, this state has to move too — otherwise you and your wife
tick different copies of the same list, which is *worse than useless* in a shop (you'd both buy the
milk).

**So build it behind a context API, not by scattering `localStorage` calls through `ShopView`.**
If `ShopContext` exposes `{ checkedKeys, toggleChecked, resetList }`, TASK_07 swaps the storage layer
underneath and the view never changes. If you inline `localStorage` into the component, TASK_07
becomes a rewrite. This is the only design constraint that matters here.

## ACCEPTANCE CRITERIA

- [ ] Tick 3 items → hard-reload the page → the same 3 are still ticked
- [ ] Tick 3 items → navigate to Plan → back to Shop → still ticked
- [ ] Change a recipe in the plan → return to Shop → checks are cleared, not stale
- [ ] "Reset list" clears all checks and the persisted entry
- [ ] Household items and recipe items both persist
- [ ] `localStorage` unavailable (private mode) → app still works, just doesn't persist
- [ ] `ShopView` contains **zero** direct `localStorage` calls

## RISKS / EDGE CASES

- The `allChecked` "Shop complete" state (`ShopView.jsx:48`) now persists too — make sure it's
  reachable *out of* (via Reset), or a finished shop becomes a dead screen.
- Item `key` is `` `${name.toLowerCase()}|${unit}` `` — **TASK_03 changes that key format.** If you
  do 03 first, persisted checks from before will silently miss. Fingerprinting handles this if the
  fingerprint includes a schema version — add `v1` to it now.

---

## ▶ CLAUDE CODE PROMPT

```
Read .agent/inspiration/TASK_01_shopping_list_persistence.md, then CLAUDE.md,
.agent/DATA_MODELS.md and .agent/DESIGN_SYSTEM.md before writing any code.

Make the Shop tab's checked-off state survive reloads and navigation.

Create src/context/ShopContext.jsx following the exact localStorage pattern already
used in src/context/PlanContext.jsx (loader function with try/catch, useState
initialiser, useEffect that writes on change). Do not invent a different pattern.

It must expose: { checkedKeys, toggleChecked, resetList, householdSnapshot }.

Persist under keys `meal_buddy_shop_checked` and `meal_buddy_shop_fingerprint`.
The fingerprint is a stable string built from the schema version "v1" plus the
confirmed plan's recipe ids and servings. On mount, if the stored fingerprint
doesn't match the current plan's, clear the checks instead of restoring them.

Refactor src/views/ShopView.jsx to consume the context. ShopView must end up with
zero direct localStorage calls and no local useState for checked keys. Move the
householdSnapshot logic (currently ShopView.jsx:15) into the context too.

Add a "Reset list" button using the existing ghost Button variant from
src/components/ui/Button.jsx. Place it so it's reachable from the "Shop complete"
state as well, otherwise that state becomes a dead end.

Wire ShopProvider into the provider tree in src/App.jsx (or main.jsx — match where
PlanProvider is mounted).

Constraints:
- Mandatory optional chaining on all data access.
- No hardcoded colors/spacing — use DESIGN_SYSTEM.md tokens only.
- Wrap all localStorage access in try/catch so private mode degrades gracefully.

When done, tell me exactly how to verify it by hand in the browser — I'll test it
myself and report back. Do not assume you can reach my dev server.
```

## DECIDE

- [ ] **Approve** — build as specified
- [ ] **Approve, but** Supabase-backed straight away (pulls TASK_07 forward — bigger session)
- [ ] **Defer** — I don't shop with the phone in hand
