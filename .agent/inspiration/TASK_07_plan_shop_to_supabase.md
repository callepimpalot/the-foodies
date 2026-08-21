# TASK 07 — Move Plan + Shop into Supabase 🔑

| | |
|---|---|
| **Feature it improves** | Plan, Shop, Essentials |
| **Impact** | ★★★★★ |
| **Effort** | L (a full, focused session — possibly two) |
| **Horizon** | 🟡 NEXT |
| **Family-readiness** | 🔑 **This IS the enabler.** Nothing else unlocks two users |

---

## READ THIS ONE EVEN IF YOU DON'T BUILD IT YET

You said the near-term goal is: *onboard your wife, one family, "if one person plans, the other
shops."*

**That goal is not blocked by authentication. It's blocked by persistence.**

| Feature | Where its data lives today | Shareable? |
|---|---|---|
| Recipes | Supabase `recipes` table | ✅ already shared |
| Plan | `localStorage` `meal_buddy_plan` (`PlanContext.jsx:88`) | ❌ per-device |
| Shop | **not persisted at all** (`ShopView.jsx:11`, `DATA_MODELS.md` §4) | ❌ per-device |
| Essentials | `localStorage` (`InventoryContext.jsx:3-4`) | ❌ per-device |

If your wife installed the app tomorrow, she'd see the same 400 recipes and **a completely empty
plan**. She could build a week; you'd never see it. She could tick off a shopping list; you'd be
shopping from a different one. The core promise — *one plans, the other shops* — is precisely the
thing that doesn't work.

Interestingly, the Gemini report never surfaces this, because it assumes a cloud-backed multi-user
architecture from page one. It's the biggest gap between the report's world and your actual app.

## THE KEY INSIGHT — you don't need auth first

The instinct is "add login, then share data." That's backwards and much slower. You can get **two
real users sharing one plan** without any authentication at all:

1. Add a `household_id` (a UUID) generated once per device and kept in `localStorage`.
2. Every Plan / Shop / Essentials row in Supabase carries that `household_id`.
3. To join, your wife enters a short code (or opens a link) that sets her device's `household_id` to
   yours.

That's it. Two devices, one household, shared plan. **Auth (TASK_12) then becomes an upgrade** —
replacing the device-held id with a real account — rather than a prerequisite.

**The honest trade-off:** a `household_id` in `localStorage` is a bearer token. Anyone with the code
can read and write your meal plan. For a household of two, with no sensitive data and no public
discovery of codes, that's an acceptable risk — but it *is* a real one, and it's why TASK_12 exists.
Don't let this intermediate state become permanent.

## WHAT THE BEST DO

- **`[report only]`** The report's schema puts `user_id` foreign keys on `meal_plans`,
  `shopping_list` and `pantry_items` from the outset — every planning entity is user-scoped, never
  device-scoped. Directionally right, though it models individuals rather than households.
- **`[report only]`** Umami is singled out for "excellent collaborative family sharing" — a
  centralised, synced recipe book across family members — and it's one of the few unambiguous praise
  points in the whole competitor scan. Shared state is what people actually value.
- **`[verified]`** The standard Supabase multi-tenancy pattern is a **members table** joining users to
  tenants with a role, plus RLS policies filtering on the tenant id. Tenant id can be cached in the
  user's `app_metadata` so policies don't need an extra query. This maps cleanly onto your
  family/household model — and matches your described structure of *one family as parent, adults as
  children under it.*

## THE CHANGE

**Phase 1 — schema**
Three new tables, all carrying `household_id uuid not null`:
- `meal_plans` — `(household_id, date, kind, recipe_id, servings, leftover_of_date, note)`
  where `kind ∈ ('recipe','leftover','note')`, mirroring the existing `DayEntry` union
- `shopping_state` — checked-off keys + the plan fingerprint from TASK_01
- `essentials` — the `InventoryContext` item shape, plus the user-editable categories

Plus `households (id, name, join_code, created_at)`.

**Phase 2 — contexts**
Rewrite `PlanContext`, `ShopContext` (from TASK_01) and `InventoryContext` to read/write Supabase
while **keeping their existing public API identical.** Views must not change. This is the whole
reason TASK_01 insists on a context boundary.

**Phase 3 — offline resilience (non-negotiable)**
Keep `localStorage` as a write-through cache, not as the store of record:
- read from cache instantly on mount, then reconcile with Supabase
- queue writes when offline and flush on reconnect
- last-write-wins is fine for two people

This matters more here than in most apps: PROJECT.md documents that the Supabase free tier **pauses**
and becomes unreachable, and `useRecipes.js` already falls back to local JSON for exactly that
reason. A naive migration would make the Plan tab break in the same conditions the Recipes tab
already survives. **Do not regress that.**

**Phase 4 — join flow**
A minimal screen: show your household code, or enter someone else's. No accounts, no email.

## WHY DESIGNED THIS WAY

- **Why household_id rather than user_id?** Your described model is *family as the parent entity,
  adults as children under it.* Scoping data to the household directly means "she plans, I shop"
  works with zero extra joins, and TASK_12 adds users *inside* a household without re-shaping the
  planning tables. Scoping to `user_id` first would mean migrating twice.
- **Why keep the context API stable?** Because `PlanContext`'s `resolveDay()` is consumed across
  PlanView, HomeView, ShopView and the AI week-planner. Changing storage *and* API at once turns a
  contained migration into an app-wide refactor with no safe checkpoint.
- **Why write-through cache instead of Supabase-only?** Because the Shop tab is used in a supermarket
  — frequently the worst signal in your week — and the Plan tab must survive a paused free tier.
  Offline-first isn't gold-plating here; it's matching a condition PROJECT.md documents as real and
  recurring.
- **Why not do TASK_12's full auth now?** Because auth is a large, fiddly surface (email flows,
  session handling, RLS rewrites) that delivers *nothing you can feel* until data is shared. Share
  the data first, get the benefit, then secure it.

## ACCEPTANCE CRITERIA

- [ ] Plan built on device A appears on device B in the same household
- [ ] Confirming the plan on A shows the same locked shopping list on B
- [ ] Ticking an item on A reflects on B (a refresh is acceptable; realtime is not required)
- [ ] Essentials flags shared across devices
- [ ] **Airplane mode: Plan and Shop still render from cache and remain usable**
- [ ] Edits made offline sync when connectivity returns
- [ ] Supabase paused/unreachable → app degrades exactly as the Recipes tab already does, no crash
- [ ] Existing localStorage plan is **migrated**, not discarded, on first run
- [ ] No view component changed its context API calls
- [ ] RLS enabled on all three new tables; `get_advisors` security check clean

## RISKS / EDGE CASES

- **The migration path is the risky part.** A user with an existing `meal_buddy_plan` must not lose
  it. Do the migration once, guarded by a flag, and keep a backup copy of the old key.
- Two people editing the same day simultaneously — last-write-wins, but make sure it doesn't produce
  a *half*-written day (a `recipe` kind with a `note` payload).
- Current RLS on `recipes` is `to public`, unconditional. New tables must **not** copy that blindly —
  filter on `household_id` at minimum, or any household can read every other household's plan.
- Don't start this in a short session. It's the one task here that's genuinely hard to leave half-done.

---

## ▶ CLAUDE CODE PROMPT

```
Read .agent/inspiration/TASK_07_plan_shop_to_supabase.md, then CLAUDE.md,
.agent/DATA_MODELS.md, .agent/PROJECT.md and .agent/PROGRESS.md.

This is a large task. Before writing any code, read the three context files
(src/context/PlanContext.jsx, src/context/InventoryContext.jsx, and ShopContext if
TASK_01 has been done) plus src/hooks/useRecipes.js, and give me a written migration
plan to approve. Do not start implementing until I approve the plan.

GOAL: move Plan, Shop and Essentials state from localStorage into Supabase so that
two devices in the same household share one plan and one shopping list. Do this
WITHOUT adding authentication.

APPROACH:
- Add a household_id (uuid) generated once per device and stored in localStorage.
- New Supabase tables, all scoped by household_id: households, meal_plans,
  shopping_state, essentials. Model meal_plans on the existing DayEntry union in
  DATA_MODELS.md section 3 (kind = recipe | leftover | note) - do not invent a
  different shape.
- Use the Supabase MCP connection to apply migrations and verify, as was done for
  the RLS work described in PROGRESS.md.

CRITICAL CONSTRAINTS:

1. The public API of each context must NOT change. Views (PlanView, HomeView,
   ShopView, the AI week planner) must keep working untouched. resolveDay() and
   friends keep their exact signatures. Swap the storage layer underneath only.

2. Offline resilience must NOT regress. PROJECT.md documents that the Supabase free
   tier pauses and becomes unreachable, and useRecipes.js already falls back
   gracefully. Keep localStorage as a write-through cache: read cache instantly on
   mount, reconcile with Supabase after, queue writes while offline, flush on
   reconnect. The Shop tab is used in supermarkets with bad signal - it must work
   offline. Last-write-wins is acceptable for two users.

3. Migrate the user's existing localStorage plan (meal_buddy_plan,
   meal_buddy_confirmed) into Supabase on first run. Guard it with a flag so it runs
   once, and keep a backup of the old keys. Losing my current plan is unacceptable.

4. RLS: enable it on every new table and filter on household_id. Do NOT copy the
   unconditional `to public` policy used on the recipes table - that would let any
   household read every other household's data. Run get_advisors afterwards and show
   me it's clean.

5. Add a minimal join flow: a screen showing my household code, and a field to enter
   someone else's. No accounts, no email. Use DESIGN_SYSTEM.md tokens and the shared
   Sheet/Button primitives in src/components/ui/.

Note the security trade-off explicitly in the code comments: household_id in
localStorage is a bearer token, acceptable for a two-person household, to be
replaced by real auth later.

Update .agent/DATA_MODELS.md to describe the new shapes when done, and add a
changelog row.

Give me a hand-test checklist covering the two-device case and airplane mode. Do not
assume you can reach my dev server.
```

## DECIDE

- [ ] **Approve** — household_id now, auth later (recommended)
- [ ] **Approve, but** do full auth (TASK_12) in the same pass — much bigger
- [ ] **Defer** — not onboarding anyone yet
