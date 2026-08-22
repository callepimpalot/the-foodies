# FEATURE BRIEF: Families & Households
# Meal Buddy / The Foodies
# Purpose: Turn the app from one dad on one device into a household of adults who share one plan, one list and one recipe book — safely.
# Audience: Whoever builds it (planning + execution in Claude Code). Mostly engineer-mandate work; one small creator-mandate surface (the join/onboarding screen).
# Status: **PROPOSAL — NOT APPROVED, NOT STARTED.** Six decisions below are the owner's and are deliberately left open.

> **Read this first.** `PROJECT.md` lists *Authentication / accounts* and *Family sharing and
> multi-user profiles* under **Deferred / Vault — do not build without a new brief**. This file is
> that brief, written from `TASK_12_family_households.md` so the idea can be reacted to instead of
> re-derived. It does **not** approve the build. Nothing here should be implemented until the six
> **UNDECIDED** questions have answers, because four of them change the schema, and schema is the
> expensive thing to get wrong.
>
> Written by an autonomous agent run on Aug 22, 2026. Every judgement call is marked as a
> recommendation, never as a decision.

---

## WHAT WE ARE BUILDING

A two-level model, exactly as described in TASK_12:

```
household  (the family — has a name, and the planning data belongs to it)
   └── household_members  (the adults, 1..n — each one a real Supabase Auth user)
          └── every planning row scoped by household_id
```

Concretely, five pieces of work:

1. **Supabase Auth** — real sessions replacing the device-held `household_id` that TASK_07
   introduces.
2. **`households` and `household_members` tables** — the membership join that every policy reads.
3. **An RLS rewrite on every table**, so access is decided by *membership the server can verify*
   rather than a value the client sent. This is the security-critical part and the real reason this
   task exists.
4. **An invite flow** a non-technical person can complete without anyone pasting a code into
   WhatsApp.
5. **A migration** that turns today's solo data into household #1 with nothing lost and no
   re-entry.

### A naming rule, and why it is in the brief

The original phrasing was *"one family as a parent user, then child users that would be the actual
grown-ups."* In the schema these are **members**. Never "child users", never "sub-users".

This is not pedantry. A future session reading `child_users` in a schema will reasonably conclude
the app has a kids-profile feature and build toward it. The word costs nothing to get right now and
is genuinely expensive to correct once it is in table names, RLS policies and API responses.

---

## WHY THIS MATTERS

**The benefit is not auth. The benefit is that one person plans and the other shops.**

That benefit is delivered by **TASK_07** (moving Plan/Shop/Essentials into Supabase behind a
device-held `household_id`), not by this brief. TASK_07 gets two phones onto one plan with no login
screen at all. It should ship first, and be lived with.

What this brief adds on top is the part TASK_07 explicitly flags and refuses to solve:

> *"A `household_id` in `localStorage` is a bearer token. Anyone with the code can read and write
> your meal plan… Don't let this intermediate state become permanent."*

So the honest framing of the value here is:

| | TASK_07 alone | + this brief |
|---|---|---|
| Two phones, one plan | ✅ | ✅ |
| Survives clearing browser data | ❌ code is gone, so is the household | ✅ log back in |
| Survives a new phone | ❌ re-enter the code | ✅ log back in |
| A third family can't read your plan | ⚠️ only because they don't know the code | ✅ enforced by the database |
| Onboarding your wife | paste a code | tap a link, set a password |
| "Suggest meals we *both* liked" | ❌ nothing knows who cooked | ✅ `member_id` is populated |

That last row is worth noticing. `cook_feedback` already has nullable `household_id` and `member_id`
columns, added ahead of need precisely because attribution is unrecoverable retroactively. Every day
this ships later is a day of cooking history that can never be attributed to a person. That is an
argument for not deferring this *indefinitely* — not an argument for doing it before TASK_07.

**And the risk is real in the other direction too.** Get RLS wrong and one family reads another
family's data. That is the single worst outcome available in this codebase, and it is why this is
worth doing slowly, with a brief, rather than as a side-effect of some other session.

---

## USER FLOW

### Flow A — the existing solo user (him), on migration day

1. Opens the app after the update. Everything looks normal; the plan, the list and the essentials
   are all still there.
2. A single prompt: *"Meal Buddy now saves your plan to your account so you can share it. Set a
   password to keep it."* Email + password.
3. On first sign-in his existing device-held household becomes a real household with him as its
   first member. **Nothing is re-entered, nothing is lost.**
4. If he dismisses the prompt, the app keeps working exactly as before. See *Edge cases*.

### Flow B — onboarding a second adult (her), the flow this stands or falls on

This is the flow TASK_12 singles out, and the one most likely to be built badly. The failure mode is
a screen that says "Enter your household code" — because that means he has to find the code, get it
to her, and she has to type it correctly, on a phone, probably while he is not standing next to her.

The proposed flow removes every one of those steps:

1. **He** opens Profile → *Invite someone* → taps **Share**. The OS share sheet opens. He sends her
   a link over whatever they already use.
2. **She** taps the link. It opens the app if installed, or the landing page (TASK_06) if not, with
   an install prompt that returns her to the same link.
3. The invite is already in the URL. She sees: *"Calle invited you to The Foodies. Choose a
   password."* No code, no household name to type, no decisions.
4. She is in. The plan he built is on her screen.

Design notes that matter for it to actually work:
- **The link carries a single-use token**, not the household id. A household id in a URL is the
  bearer-token problem again, wearing a nicer coat.
- **The token expires** (7 days is a reasonable default) and can be revoked from Profile.
- **Never show a code as the primary path.** A copyable fallback code is fine as small print for the
  case where links get mangled — but if a code is on screen with equal weight, that is the path
  people will take, and it is the path that fails.
- She should not have to know what a household is. She is joining *him*, not administering a tenant.

### Flow C — everyday use, once both are in

Unchanged from today. That is the point: the whole feature should be invisible after onboarding.
He plans on the sofa; she opens Shop in the supermarket and sees the list he locked.

---

## OPEN QUESTIONS

**All six are the owner's. None is answered here.** Each has options, the real trade-off, and a
recommendation with reasoning. A proposal that quietly picks would be worse than no proposal,
because the assumption would then have to be reverse-engineered out of the code later.

Answer inline under each, or in `.agent/inspiration/DECISIONS_NEEDED.md`.

---

### Q1 — Are captured recipes private to a household, or visible to everyone?

The 400 imported recipes are a separate question (Q2). This is about the ones captured in-app —
`is_personal: true`, `tags: ['captured']`.

| Option | What it means | Trade-off |
|---|---|---|
| **A. Private by default** | A captured recipe belongs to the household that captured it. Sharing is a later, explicit feature. | Safe and reversible. Costs a "share this" feature later if wanted. Friends' families see nothing of yours until you decide. |
| **B. Public by default** | Every capture joins a common pool all households see. | Feels generous and makes the library grow. **Effectively irreversible**: once other families have built plans on your recipes, retracting them breaks their saved plans. Also means anything captured — a half-finished note, a family recipe you didn't mean to publish — is visible. |
| **C. Per-recipe toggle at capture time** | The user picks each time. | Most flexible, most friction. Adds a decision to every single capture, which is the moment you least want one. |

**Recommendation: A — private by default.** This is asymmetric-risk reasoning rather than a
preference. Going private → public later is a migration anyone can run. Going public → private later
is a conversation with every family who used your recipes. When one direction is cheap to reverse
and the other is not, take the cheap one and let real demand pull you the other way.

> **UNDECIDED — awaiting the owner**
> ANSWER:

---

### Q2 — Do the 400 imported recipes stay global?

| Option | Trade-off |
|---|---|
| **A. Global, read-only, owned by nobody** | One copy, every household reads it. Simple, cheap, no duplication. An edit by one household would affect everyone — so edits must fork into a household copy. |
| **B. Copied per household on creation** | Each household gets its own 400 rows and can edit freely. 400 rows × N households of duplicated data, and an improvement to the base library never reaches anyone who already joined. |

**Recommendation: A — global and read-only**, with `household_id IS NULL` meaning "belongs to the
library, not to a family". TASK_12 already calls this out as "almost certainly yes" and it is hard
to argue with: the alternative duplicates a 400-row table per family for a benefit (editing a
stock recipe in place) that recipe forking would serve better anyway.

The part actually worth deciding is what happens when someone **edits** a global recipe. Recommend:
the edit forks it into a household-owned copy, leaving the global one untouched. That is the
already-deferred "recipe forking" idea arriving through the back door — flagging it so it is a
choice rather than a surprise.

> **UNDECIDED — awaiting the owner**
> ANSWER:

---

### Q3 — Can one person belong to two households?

Adult children cooking for their own place and their parents'. Separated parents with a child moving
between homes. Someone helping a relative plan meals.

| Option | Trade-off |
|---|---|
| **A. Allow it in the schema now, expose one household in the UI** | `household_members` is already a join table, so many-to-many costs nothing today. The UI ships with an implicit "your household" and grows a switcher only when someone needs it. |
| **B. One household per person, enforced** | Marginally simpler policies (a single `household_id` can be cached in the user's `app_metadata`, saving a lookup per query). Retrofitting many-to-many later means rewriting every policy and every query that assumed one. |
| **C. Allow it and build the switcher now** | Complete, but builds UI for a user who does not exist yet, and adds "which household am I in?" to every screen. |

**Recommendation: A.** The schema shape is the expensive, irreversible half; the switcher is cheap
UI whenever it is needed. TASK_12's own note applies — *"cheap to allow in the schema now, expensive
to retrofit"*.

The cost of A is specific and worth stating plainly: it rules out the `app_metadata` caching trick,
because a member no longer has *one* household id to cache. Policies do a membership lookup instead.
That is one indexed lookup on a table with single-digit rows — irrelevant at this scale, but it is
the reason B exists as an option.

> **UNDECIDED — awaiting the owner**
> ANSWER:

---

### Q4 — Roles, or are all members equal?

| Option | Trade-off |
|---|---|
| **A. All members equal** | Matches "mum and dad". Anyone can plan, shop, invite, capture. No permission checks to write, no permission UI, no way to get locked out of your own household. |
| **B. Owner + member** | Only the owner invites and removes people. Protects against a member removing the owner. Adds a permission concept to every mutating path, and creates the "the owner is on holiday and nobody can invite the new person" problem. |
| **C. Full roles (owner / adult / view-only)** | Anticipates teenagers and guests. Substantial surface for a household of two. |

**Recommendation: A — equal members**, but **keep a `role` column** on `household_members`
defaulting to `'member'`, unread for now. The column costs nothing and means adding roles later is a
backfill rather than a migration. TASK_12 puts it well: *"Only add roles when someone needs to be
restricted."*

One consequence to be comfortable with under A: **any member can remove any other member**,
including the last one. Recommend a single guard — a household must always keep at least one member
— rather than a role system.

> **UNDECIDED — awaiting the owner**
> ANSWER:

---

### Q5 — What happens to the plan when a member leaves?

TASK_12 says the household owns it, so nothing happens, and asks for confirmation.

| Option | Trade-off |
|---|---|
| **A. Household keeps everything** | Plans, lists, essentials, captured recipes and cook feedback all stay. Departure is just a membership row deleted. Consistent with "the household owns the data". |
| **B. The leaver takes their captures with them** | Feels fairer if the household dissolves. Means captured recipes need a *creator member* as well as an owning household, and raises the question of what happens to a plan that references a recipe that just walked out. |

**Recommendation: A — household keeps everything.** It matches the model, it is what "the family
cookbook" means, and it avoids plans breaking because a recipe left.

But keep `created_by_member_id` on captured recipes and on `cook_feedback` regardless, for two
reasons that are not about ownership: attribution is unrecoverable retroactively, and *"suggest
meals we both liked"* needs it. Note this is **attribution, not ownership** — the household still
owns the row.

> **UNDECIDED — awaiting the owner**
> ANSWER:

---

### Q6 — How does a non-technical person get onboarded?

Flow B above is the proposal. The question is whether it is the right one.

| Option | Trade-off |
|---|---|
| **A. Invite link + password** (Flow B) | Fewest steps, nothing to type but a password. Needs a landing page (TASK_06 exists) and deep-link handling on a PWA, which is the fiddly part. |
| **B. Magic link — no password at all** | Nothing to remember, and she cannot get the password wrong. Every sign-in needs email access on the device, which is friction *forever* rather than once, and it is confusing on a shared computer. |
| **C. Household code typed into the app** | Simplest to build. **This is the flow TASK_12 explicitly names as the thing to avoid.** It means he has to find a code and get it to her, and she has to type it correctly. |
| **D. Social sign-in (Google/Apple)** | Genuinely one tap on a phone. Adds provider config, and both archived briefs list it as explicitly out of scope. |

**Recommendation: A, with C as unadvertised small print.** A is the flow that respects her time; the
code fallback exists only for when a link gets mangled by a messaging app, and should never be the
visually obvious path.

Worth flagging honestly: **A is the highest-effort option here**, and most of that effort is
deep-link handling on an installed PWA, which is genuinely finicky and hard to test without real
devices. If effort has to be cut somewhere in this task, this is the place where cutting is most
tempting and most damaging — the whole point is that she does not have to care how it works.

> **UNDECIDED — awaiting the owner**
> ANSWER:

---

## DATA MODEL REFERENCE

> `.agent/DATA_MODELS.md` is the source of truth for existing shapes. Nothing below is built.
> Shapes marked *(TASK_07)* are introduced by that task, not this one.

### New tables

```sql
-- The family.
households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                    -- "The Foodies"
  created_at  timestamptz not null default now()
)

-- Membership. The join every RLS policy reads.
household_members (
  household_id  uuid not null references households(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  display_name  text,                           -- "Calle" — for attribution in the UI
  role          text not null default 'member', -- reserved; unread until Q4 says otherwise
  joined_at     timestamptz not null default now(),
  primary key (household_id, user_id)
)

-- Single-use invites. Never put a household_id in a URL.
household_invites (
  token         text primary key,               -- random, single-use
  household_id  uuid not null references households(id) on delete cascade,
  invited_by    uuid references auth.users(id) on delete set null,
  expires_at    timestamptz not null,
  accepted_at   timestamptz,
  accepted_by   uuid references auth.users(id) on delete set null
)
```

A composite primary key on `household_members` gives the many-to-many of **Q3-A** for free and makes
double-joining impossible. If Q3 is answered B, add a unique constraint on `user_id` — the shape
does not otherwise change, which is the point.

### Changes to existing tables

| Table | Change | Note |
|---|---|---|
| `recipes` | add `household_id uuid null` | `NULL` = the global library (Q2). Non-null = a household's capture (Q1). |
| `recipes` | add `created_by_member_id uuid null` | Attribution only, not ownership (Q5). |
| `cook_feedback` | **already has** `household_id`, `member_id` | Both nullable, both currently unpopulated. Backfill to household #1 on migration. |
| `meal_plans` *(TASK_07)* | `household_id` becomes a real FK | TASK_07 creates it as a bare uuid. |
| `shopping_state` *(TASK_07)* | same | |
| `essentials` *(TASK_07)* | same | |

`recipes.source_url` (added Aug 22) is unaffected.

### The membership helper every policy uses

```sql
create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
security definer          -- reads household_members without recursing into its own policy
stable
set search_path = public
as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;
```

`security definer` is load-bearing, not incidental: without it, a policy on `household_members` that
queries `household_members` recurses. `set search_path` is the standard hardening for a definer
function and should not be dropped.

---

## THE RLS REWRITE

**This is the security-critical part of the whole task.** TASK_12 asks for the target policy on
every table, so here they are.

### Where things stand today (verified live, Aug 22, 2026)

| Table | RLS | Policies |
|---|---|---|
| `public.recipes` | enabled | SELECT `to public` `using (true)`; INSERT `to public` `with check (true)`; UPDATE `to public` `using (true) with check (true)`. **No DELETE policy.** |
| `public.cook_feedback` | enabled | SELECT `to public` `using (true)`; INSERT `to public` `with check (true)`. |
| `storage.objects` | enabled | INSERT only, `bucket_id = 'recipe-images'`. No SELECT/UPDATE/DELETE. |

Read `to public` as *"anyone holding the anon key"* — and the anon key is baked into the client
bundle by design (PROJECT.md). So today, **anyone who opens the site can read and modify every
recipe row.** For one solo user with 400 public domain recipes and no personal data, that is a
defensible trade. The moment a second family exists it is not, and `UPDATE … using (true)` is the
sharpest edge: it is not just a read leak, it is anonymous write access to everyone's data.

### Target policies

The pattern throughout: **membership decides, the client never asserts.** Every policy resolves
through `auth.uid()` and `is_household_member()`. No policy trusts a `household_id` sent by the
client — that is precisely the TASK_07 bearer-token weakness this task exists to close.

#### `households`
```sql
alter table households enable row level security;

create policy "members read their households" on households
  for select to authenticated using (is_household_member(id));

create policy "authenticated users create a household" on households
  for insert to authenticated with check (true);
  -- creator is added to household_members in the same transaction

create policy "members rename their household" on households
  for update to authenticated
  using (is_household_member(id)) with check (is_household_member(id));

-- No DELETE policy. Deleting a household cascades to every plan in it;
-- if it is ever needed, it should be a deliberate, audited RPC, not a policy.
```

#### `household_members`
```sql
alter table household_members enable row level security;

create policy "members see who else is in the household" on household_members
  for select to authenticated using (is_household_member(household_id));

create policy "members are added by invite acceptance only" on household_members
  for insert to authenticated with check (false);
  -- inserts happen exclusively inside the accept_invite() RPC (security definer)

create policy "members can leave, or remove another member" on household_members
  for delete to authenticated using (is_household_member(household_id));
  -- a trigger enforces "a household never drops to zero members"
```

`with check (false)` on INSERT is deliberate. If members could insert their own membership rows,
anyone who learned a household id could join it — the bearer-token problem again. Joining goes
through one audited function or it is not safe.

#### `recipes`
This is the table where Q1 and Q2 land, so it is written for the recommended answers (private
captures, global library) and flagged as such.

```sql
-- SELECT: the global library, plus your own household's captures.
create policy "read global library and own household recipes" on recipes
  for select to authenticated
  using (household_id is null or is_household_member(household_id));

-- INSERT: only into a household you belong to. Cannot create global rows.
create policy "capture into your own household" on recipes
  for insert to authenticated
  with check (household_id is not null and is_household_member(household_id));

-- UPDATE: your household's rows only. The global 400 become read-only.
create policy "edit your own household recipes" on recipes
  for update to authenticated
  using (household_id is not null and is_household_member(household_id))
  with check (household_id is not null and is_household_member(household_id));

create policy "delete your own household recipes" on recipes
  for delete to authenticated
  using (household_id is not null and is_household_member(household_id));
```

If **Q1 = B (public captures)**, the SELECT `using` clause relaxes to `true` and INSERT/UPDATE/DELETE
stay exactly as written. If **Q2 = B (per-household copies)**, `household_id is null` disappears
entirely and the migration copies 400 rows per household. The policies are shaped so either answer
is a clause change, not a redesign.

#### `cook_feedback`
```sql
create policy "read your household's cook feedback" on cook_feedback
  for select to authenticated using (is_household_member(household_id));

create policy "log a cook for your household" on cook_feedback
  for insert to authenticated
  with check (is_household_member(household_id) and member_id = auth.uid());
```

`member_id = auth.uid()` stops one member logging feedback as another. Since the taste model feeds
the week planner, a member who could write as someone else could steer what the household is
offered — a small thing, but free to prevent.

#### `meal_plans`, `shopping_state`, `essentials` *(TASK_07's tables)*
All three take the identical shape:
```sql
create policy "household reads its own <table>" on <table>
  for select to authenticated using (is_household_member(household_id));

create policy "household writes its own <table>" on <table>
  for insert to authenticated with check (is_household_member(household_id));

create policy "household updates its own <table>" on <table>
  for update to authenticated
  using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy "household deletes its own <table>" on <table>
  for delete to authenticated using (is_household_member(household_id));
```

#### `household_invites`
```sql
create policy "members see their household's invites" on household_invites
  for select to authenticated using (is_household_member(household_id));

create policy "members create invites for their household" on household_invites
  for insert to authenticated with check (is_household_member(household_id));

create policy "members revoke their household's invites" on household_invites
  for delete to authenticated using (is_household_member(household_id));
```

The invitee is not yet a member and so **cannot read this table** — correctly. Redemption goes
through `accept_invite(token)`, a `security definer` RPC that validates the token, checks expiry and
`accepted_at`, inserts the membership row and marks the invite used, all in one transaction.

#### `storage.objects` (bucket `recipe-images`)
Currently INSERT-only, which is why uploads always create new files and never overwrite. Under
households:
- **SELECT** — the bucket is public and dish photos are referenced by URL from recipe rows. Simplest
  correct thing is to keep it public-read and accept that a photo URL is guessable-if-leaked, which
  is the same posture as today. Tightening this means signed URLs and a rewrite of every image
  render path — worth noting as a follow-up, not folding into this task.
- **UPDATE / DELETE** — still none. Photo cleanup and replace-in-place remain unbuilt (PROJECT.md
  already flags this), and adding delete without an ownership check would be a strictly worse
  position than having no policy at all.

### The `anon` role after this lands

Once every policy above is `to authenticated`, the anon role can read nothing. Consider whether the
**landing page** (TASK_06) needs to show real recipes to a logged-out visitor. If it does, add one
narrow policy — `for select to anon using (household_id is null)` — rather than loosening anything
else. Deciding this at build time is far cheaper than discovering it when the landing page renders
empty.

### The rule that keeps this safe

**Enable RLS on every new table at creation, in the same migration.** A table created without RLS is
readable by anyone with the anon key from the moment it exists. TASK_12 cites this as the documented
number-one cause of Supabase data leaks, and `get_advisors` should be run after every schema change
in this task and come back clean before the change is called done.

---

## THE MIGRATION

Turning today's data — and TASK_07's device-held `household_id` — into real households without loss.

**The hard part is not the SQL. It is that the "credential" for the current data is a UUID in a
`localStorage` key on his phone.** There is no email attached to it, no password, nothing the server
can use to recognise him later. If that phone clears its site data before he signs up, the household
is orphaned: the rows are still in Postgres, but nothing on Earth can prove they are his.

That single fact drives the whole sequence.

### Sequence

**Step 0 — Preconditions.** TASK_07 has shipped and has been in real use. `households` /
`household_members` / `household_invites` exist with RLS enabled. Auth is configured but no screen
forces it yet.

**Step 1 — Dual-read, before anything is enforced.** Deploy a build where every query accepts
*either* a valid session *or* the legacy device-held `household_id`. Nothing breaks; nobody is asked
to do anything. This is the safety net that makes every later step reversible.

**Step 2 — Claim.** The signed-out app still holds the device `household_id` in `localStorage`. On
sign-up it sends that id along with the new session, and a `security definer`
`claim_household(legacy_id)` RPC:
- verifies the household exists and has **no members yet** (an unclaimed household can be claimed
  once, by whoever holds the id — the same trust level as today, not weaker);
- inserts `household_members(household_id, auth.uid())`;
- backfills `cook_feedback.household_id` and `member_id` for that household's rows;
- stamps `recipes.household_id` on rows with `is_personal = true` **that were captured on this
  device**;
- returns the household so the client can drop the legacy key.

Idempotent: a second call by the same user is a no-op, and by a different user it fails because the
household now has a member.

**Step 3 — Backfill the global library.** `update recipes set household_id = null where is_personal
is not true` — the 400 imported recipes become the global library (Q2-A). Under Q2-B this step
copies them per household instead. **This is the step that changes if Q2 changes**, which is why Q2
should be answered before the migration is written rather than during.

**Step 4 — Tighten.** Only once he has a real session and can log in on a second device: swap every
`to public` policy for the `to authenticated` set above, in one migration, and drop the legacy path.
Run `get_advisors` and confirm clean.

**Step 5 — Invite her.** Flow B. Her join is now an ordinary invite, not a migration.

### Rules

- **Steps 1–3 add; step 4 restricts.** Nothing is destructive until a session exists that can reach
  the data. If step 4 is wrong, it reverts by restoring the old policies — the rows are untouched.
- **Never delete the legacy `localStorage` key until the claim returns success.** It is the only
  proof of ownership that exists.
- **Take a backup before step 4.** It is the only step that can lock him out of his own data, and
  the free tier's guarantees are not a backup strategy.
- **Do not let step 1 become permanent.** A dual-read path that accepts a client-supplied
  `household_id` is exactly the hole this task closes. It should carry a dated comment and be
  removed in step 4.

---

## FILE STRUCTURE

Illustrative, not prescriptive — laid out so the size of the change is visible.

```
supabase/migrations/
  ..._households_and_members.sql        tables + is_household_member() + RLS on the new tables
  ..._household_scoping.sql             household_id / created_by_member_id on recipes
  ..._invite_rpcs.sql                   accept_invite(), claim_household()
  ..._tighten_rls.sql                   migration step 4 — the to-public swap, on its own

src/context/
  AuthContext.jsx                       NEW — session, sign in/up/out, current member
  HouseholdContext.jsx                  NEW — current household, members, invites
  PlanContext.jsx                       TASK_07's Supabase reads move from device id to session
  ShopContext.jsx                       same
  InventoryContext.jsx                  same

src/views/
  AuthView.jsx                          NEW — sign in / sign up / reset
  JoinView.jsx                          NEW — invite landing (the one creator-mandate screen)
  ProfileView.jsx                       household name, members, invite + revoke, sign out

src/lib/
  households.js                         NEW — invite creation/acceptance, claim, member queries

landing/index.html                      TASK_06 — must handle /join?token=… for the not-installed case
```

**The context boundary is what makes this affordable.** TASK_07 insists Plan/Shop/Inventory keep
their public API identical while their storage changes. If that holds, this task changes *how those
contexts authenticate* and touches no view — the same reason TASK_07 gives, applied one layer up. If
that boundary was not respected in TASK_07, this becomes an app-wide refactor and the estimate below
is wrong.

---

## EDGE CASES

| Case | Expected behaviour |
|---|---|
| **He never signs up** | The app keeps working on the legacy path. Step 4 cannot run until he has. Do not force it; do prompt on a schedule that is easy to dismiss. |
| **He clears site data before claiming** | The household is orphaned and unrecoverable through the app. **This is the single worst outcome in the migration** and the reason step 2 should come soon after step 1, not months later. Worth an explicit "keep this device signed in" note in the sign-up prompt. |
| **Invite link opened by the wrong person** | They land on a normal join screen and could join. Mitigations: single-use, 7-day expiry, revocable, and members are visible in Profile so an unexpected join is noticed. Do not send invite links through channels that are not already trusted. |
| **Invite opened on a device without the app** | Landing page (TASK_06) → install → return to the same token. This is the fiddly part of Q6-A and needs testing on both iOS and Android. |
| **Invite reused after acceptance** | `accepted_at` is set; `accept_invite()` rejects with "this invite has already been used". Never silently join a second time. |
| **Both edit the plan at once** | Last-write-wins, as TASK_07 specifies. For two adults this is fine; do not build CRDTs. |
| **Offline** | TASK_07's write-through cache still applies. **The session must be readable offline** — Supabase persists it in `localStorage` by default; do not disable that, or the Shop tab dies in a supermarket basement, which is the exact condition it exists for. |
| **Supabase free tier pauses** | `useRecipes.js` already falls back to `final_recipes.json`. Auth failures must be treated as *unreachable*, not *signed out* — signing the user out because the project paused would be a bad, confusing bug. |
| **Last member tries to leave** | Blocked by trigger: a household always keeps ≥1 member. Offer "delete the household" as a separate, confirmed action. |
| **A member removes the other member** | Allowed under Q4-A. Visible in Profile. Accepted consequence of equal members. |
| **Signed out with data in the cache** | Clear cached household data on sign-out. Otherwise the next person to open the app on that device sees the previous household's plan. |
| **A recipe references a deleted household** | `on delete cascade` from `households` removes its recipes. Plans in *other* households never reference them (they could not read them), so nothing dangles. |

---

## ACCEPTANCE CRITERIA

Functional:
- [ ] He signs up and his existing plan, shopping list, essentials and captured recipes are all still there — nothing re-entered
- [ ] He signs in on a second device and sees the same household
- [ ] She receives a link, taps it, sets a password, and is in the household — **no code typed at any point**
- [ ] A plan built by him appears for her; a list he locks is the list she shops
- [ ] `cook_feedback` rows written after this carry both `household_id` and `member_id`
- [ ] Sign-out clears cached household data from the device
- [ ] Airplane mode: Plan and Shop still render from cache and stay usable while signed in

Security — **each of these must be tested by actually trying it, not by reading the policy**:
- [ ] A second household is created and **cannot read household #1's** plan, shopping state, essentials, captured recipes or cook feedback
- [ ] A raw `supabase.from('meal_plans').select('*')` with a *valid session for household B* returns **zero** of household A's rows
- [ ] A client passing a **household_id it is not a member of** is rejected by the database, not merely by the UI
- [ ] The anon key alone (no session) can no longer read `recipes`, or read/write anything else
- [ ] An expired invite and an already-accepted invite are both rejected
- [ ] A member cannot insert a `household_members` row directly, only via `accept_invite()`
- [ ] `get_advisors` (security) returns clean after every migration in this task

Non-regression:
- [ ] No view file needed changing to make auth work (if one did, the TASK_07 context boundary leaked — say so rather than papering over it)
- [ ] The 400 global recipes are readable by every household and writable by none

---

## EFFORT & SEQUENCING

**XL — assume several focused sessions, not one.** The distribution is uneven and worth knowing
before starting:

| Piece | Effort | Note |
|---|---|---|
| Tables + `is_household_member()` + policies | M | Mechanical once the questions are answered |
| Auth screens + session plumbing | M | Well-trodden; Supabase Auth does most of it |
| Invite + deep link + PWA install return | **L** | The genuinely fiddly part. Needs real devices |
| Migration steps 1–4 | **L** | Most of the risk. Reversible only if done in this order |
| Testing the security criteria properly | M | Needs a real second account, not a mocked one |

**Do not start this before TASK_07 has shipped and been lived with.** Not process for its own sake:
RLS design is much easier once the real access patterns are known, and TASK_07 delivers the entire
felt benefit at a fraction of the cost. This task's job is to make that benefit durable and safe —
which is only worth paying for once the benefit is real.

---

## REFERENCES

- `.agent/inspiration/TASK_12_family_households.md` — the source task
- `.agent/inspiration/TASK_07_plan_shop_to_supabase.md` — the prerequisite; the device-held `household_id` this migrates away from
- `.agent/inspiration/TASK_06_landing_page.md` — where the invite link lands when the app is not installed
- `.agent/features/archive/FEATURE_auth_accounts.md` — earlier auth brief, superseded by this one
- `.agent/features/archive/FEATURE_profile_family_settings.md` — earlier family brief; its per-member preferences and allergy-awareness ideas are **not** in scope here and remain a good follow-up once households exist
- `.agent/PROJECT.md` — the Deferred/Vault list this is promoted from; the RLS notes
- `.agent/DATA_MODELS.md` — source of truth for existing shapes
