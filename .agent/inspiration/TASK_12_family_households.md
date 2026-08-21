# TASK 12 — Families and real accounts

| | |
|---|---|
| **Feature it improves** | Everything (architectural) |
| **Impact** | ★★★★★ when it lands |
| **Effort** | XL |
| **Horizon** | 🔵 LATER |
| **Trigger to revisit** | When more than one household uses the app, or when the shared-plan bearer-code from TASK_07 stops feeling acceptable |

---

## ⚠️ PROCESS NOTE FIRST

`PROJECT.md` lists **Authentication / accounts** and **Family sharing and multi-user profiles** under
*"Deferred / Vault (not v1 — **do not build without a new brief**)"*, and
`FEATURE_auth_accounts.md` / `FEATURE_profile_family_settings.md` sit in the archive marked DEFERRED.

So this task is **not** approvable as-is. Approving it means: promote from the vault, write a proper
feature brief (FEATURES.md has the template), resolve the open questions below, *then* build. This
file is the input to that brief, not a substitute for it.

## THE MODEL YOU DESCRIBED

> *"One family as kind of a parent user, and then you would have child users that would be the actual
> grown-ups in that family — mum and dad, or whatever two persons having access to the app, but under
> one family. Because if one person plans, then the other person could shop."*

Then: a second family with its own two users, and eventually several families from your family and
friends.

That's a clean two-level model:

```
household (the "family")
   └── members (the adults, 1..n)
          └── all planning data scoped to household_id
```

Note the term collision worth avoiding in code: you said "child users" meaning *subordinate accounts*,
not children. Call them **members** in the schema, or someone (including a future Claude session)
will build a kids' profile feature by mistake.

## WHAT THE BEST DO

- **`[verified]`** The standard Supabase multi-tenancy pattern is exactly this: a **members table**
  joining users to tenants with a role, and RLS policies filtering every query on the tenant id.
  Tenant id can be cached in the user's `app_metadata` so policies don't need an extra lookup per
  query. Two ownership models coexist cleanly — user-owned rows keyed by `user_id`, household-owned
  rows keyed by `household_id`.
- **`[verified]`** Every table exposed through the Supabase API needs RLS enabled with real policies;
  this is the documented number-one cause of data leaks in Supabase apps. Relevant to you
  specifically: your `recipes` table currently has **unconditional `to public`** policies (PROJECT.md).
  That's fine for one solo user and **not** fine once other families exist.
- **`[report only]`** The report praises Umami for family sharing and a centralised synced recipe
  book — the one collaboration feature it singles out positively.

## WHAT THIS TASK ACTUALLY IS

If [TASK_07](TASK_07_plan_shop_to_supabase.md) is done, most of the hard data work is finished. This
task is then mainly:

1. **Supabase Auth** — email/password or magic link. Replace the device-held `household_id` with a
   real session.
2. **`household_members`** table — `(household_id, user_id, role, joined_at)`.
3. **Rewrite RLS** on every table to filter on household membership rather than trusting a client
   value. This is the security-critical part and the reason the intermediate state in TASK_07 must
   not become permanent.
4. **Tighten `recipes` RLS** — decide what's shared globally (the 400 imported) vs. per-household
   (`is_personal: true` captures). This decision is genuinely load-bearing; see open questions.
5. **Invite flow** — real invitations instead of a shared code.
6. **Migration** — your existing solo data becomes household #1 without loss.

## OPEN QUESTIONS (resolve before writing the brief)

1. **Are captured recipes private to a household, or shared with everyone?** You captured them; your
   friends' families might love them. But "shared by default" is very hard to walk back once other
   families are on it. *Recommendation: private by default, explicit share later.*
2. **Do the 400 imported recipes stay global?** Almost certainly yes — duplicating them per household
   is wasteful.
3. **Can a person belong to two households?** (Adult children, separated parents.) Cheap to allow in
   the schema now, expensive to retrofit.
4. **Roles at all, or are all members equal?** Equal is simpler and matches "mum and dad." Only add
   roles when someone needs to be restricted.
5. **What happens to a plan when a member leaves?** Household owns it, so nothing — but confirm
   that's what you want.
6. **Onboarding for a non-technical user.** Your wife should not need a household code pasted over
   WhatsApp. This is where [TASK_06](TASK_06_landing_page.md)'s landing page earns its place.

## WHY DEFER IT

- Auth delivers **nothing you can feel** on its own. TASK_07 gives you the actual benefit (shared
  plan) at a fraction of the cost.
- RLS design is much easier once you know the real access patterns — which you'll learn from
  running TASK_07 with two people for a while.
- It's the highest-risk change in the backlog: get RLS wrong and one family reads another's data.
  Worth doing slowly, with a brief, when it's actually needed.

## ▶ CLAUDE CODE PROMPT

```
This task is NOT ready to implement. It is vault-deferred in .agent/PROJECT.md and
requires a feature brief first.

If I've asked you to start it, do this instead of writing code:

Read .agent/inspiration/TASK_12_family_households.md, .agent/PROJECT.md,
.agent/FEATURES.md (including the brief template at the bottom),
.agent/features/archive/FEATURE_auth_accounts.md and
.agent/features/archive/FEATURE_profile_family_settings.md.

Then write .agent/features/FEATURE_family_households.md following the FEATURES.md
template, and ask me the six open questions listed in the task file one at a time -
do not guess my answers. Record my answers in the brief.

Model: household (family) -> household_members (the adults) -> all planning data
scoped by household_id. Use the term "members", never "child users" - that phrasing
would read as a kids-profile feature to a future session.

Pay particular attention in the brief to:
- The RLS rewrite. The recipes table currently has unconditional `to public`
  policies, which is safe for one solo user and unsafe once a second family exists.
  Spell out the target policy for every table.
- The migration path from TASK_07's device-held household_id (a bearer token in
  localStorage) to real Supabase Auth sessions, without data loss.
- Onboarding a non-technical person without pasting codes over WhatsApp.

Add the brief to the Active Briefs table in FEATURES.md and move the two archived
briefs' status notes to point at it.

Do not write any application code in this session.
```

## DECIDE

- [ ] **Approve writing the brief** (not the build)
- [ ] **Not yet** — revisit after living with TASK_07
