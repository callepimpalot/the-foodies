-- ============================================================================
-- TASK_07 — Plan / Shop / Essentials move into Supabase, scoped by household
-- ============================================================================
--
-- Effort: L. This file is the schema half; src/context/*.jsx is the code half.
--
-- WHAT THIS DOES
--   Adds the four tables TASK_07 asks for (households, meal_plans,
--   shopping_state, essentials) plus essentials_categories, which the brief
--   folds into "essentials — the item shape, plus the user-editable categories".
--   Every table has RLS enabled in this same migration, as required: a table
--   created without RLS is readable by anyone holding the anon key from the
--   moment it exists.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--   No authentication. No auth.users FK. No household_members table. Those are
--   FEATURE_family_households.md (TASK_12) and they are the point of this file
--   existing first: two phones on one plan is felt benefit, and it costs a
--   fraction of the auth build.
--
-- ---------------------------------------------------------------------------
-- THE SECURITY MODEL, STATED PLAINLY — READ BEFORE REVIEWING THE POLICIES
-- ---------------------------------------------------------------------------
--   There is no login in this task, so the database has nothing to authenticate
--   a caller with. A household_id in localStorage IS the credential, exactly as
--   TASK_07 says: whoever has it can read and write that household's plan.
--
--   What the policies below do is make that credential *explicit* rather than
--   implicit. The client sends its household id in an `x-household-id` header;
--   `request_household_id()` reads it out of the request; every policy compares
--   it to the row's household_id. The consequences, honestly:
--
--     PREVENTED   a bare `select *` with the anon key returns nothing — there is
--                 no header, so request_household_id() is NULL, and
--                 `household_id = NULL` is never true. The recipes table's
--                 `using (true)` firehose is not repeated here.
--     PREVENTED   writing into a household you did not present. The insert/update
--                 checks are `= request_household_id()`, so you can only write
--                 rows for the id you are already holding.
--     PREVENTED   a malformed or absent header fails closed (the helper returns
--                 NULL rather than raising, so a bad header denies rather than
--                 500s).
--     NOT PREVENTED  someone who *knows or guesses* another household's id can
--                 present it as their own header and read that household's data.
--                 That is the bearer-token weakness, and it is the reason
--                 TASK_12 exists. Nothing in SQL can fix it without an identity,
--                 and inventing a half-identity (an IP check, a shared secret in
--                 the client bundle) would be security theatre.
--
--   So: this is strictly tighter than today's `to public using (true)`, and it
--   is strictly looser than authenticated RLS. Do not let it become permanent —
--   the swap is written out at the bottom of this file.
--
-- SAFE TO RUN? It is purely additive: six new tables, their policies, two
-- helper functions and two RPCs. Nothing existing is altered or dropped. No
-- data is touched. It has NOT been run (there are no credentials available to
-- this session) — apply it in a branch of the database and run get_advisors
-- before trusting it.
--
-- SAFE TO RUN TWICE? Yes, and that is what the `drop policy if exists` /
-- `drop trigger if exists` lines are for. PostgreSQL has no
-- `create policy if not exists`, so a bare `create policy` raises 42710 on a
-- second application — and the Supabase CLI wraps a migration in a transaction,
-- so that error rolls the whole file back and "just re-run it" turns red. Every
-- policy and trigger below is therefore preceded by a matching drop, which is a
-- no-op on a first application. scripts/migration_reapply_check.mjs asserts
-- this; it is a static file-text check and does not prove the SQL executes.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------

-- The caller's claimed household, taken from the `x-household-id` request
-- header that src/lib/supabase.js attaches to every PostgREST request.
--
-- Returns NULL when the header is absent (server-side calls, psql, the service
-- role), when the headers GUC isn't set, or when the value is not a uuid. Every
-- policy compares against this, and `x = NULL` is never true, so all of those
-- cases DENY rather than erroring. Failing closed matters here: a malformed
-- header from a client must not read as "unrestricted".
create or replace function public.request_household_id()
returns uuid
language plpgsql
stable
as $$
declare
  raw text;
begin
  begin
    raw := current_setting('request.headers', true)::json ->> 'x-household-id';
  exception when others then
    -- No headers GUC (direct SQL), or the setting is not JSON.
    return null;
  end;

  if raw is null or btrim(raw) = '' then
    return null;
  end if;

  begin
    return raw::uuid;
  exception when others then
    -- Malformed id: treat as "no household presented", which denies.
    return null;
  end;
end;
$$;

comment on function public.request_household_id() is
  'TASK_07 interim: the household id the client presented in x-household-id. NULL = nothing presented, and every policy denies on NULL. Replaced by auth.uid() + membership in TASK_12.';

-- Keep updated_at honest without every caller remembering to set it.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. households
-- ---------------------------------------------------------------------------

create table if not exists public.households (
  id          uuid primary key,
  name        text        not null default 'Our household',
  -- The code a second phone types in. Deliberately short and unambiguous, and
  -- deliberately NOT the household id: the id is the bearer token, and putting
  -- it in a screen someone reads aloud is how tokens leak.
  join_code   text        not null unique,
  created_at  timestamptz not null default now()
);

comment on table public.households is
  'TASK_07. The family. Planning rows belong to it, not to a device.';

alter table public.households enable row level security;

drop policy if exists "household reads its own row" on public.households;
create policy "household reads its own row"
  on public.households for select
  to anon, authenticated
  using (id = public.request_household_id());

drop policy if exists "household renames itself" on public.households;
create policy "household renames itself"
  on public.households for update
  to anon, authenticated
  using (id = public.request_household_id())
  with check (id = public.request_household_id());

-- No INSERT policy on purpose: households are created by create_household(),
-- which is the only place a join code is generated. Letting a client insert its
-- own row would let it choose a code, including someone else's.
-- No DELETE policy: deleting a household cascades to every plan in it, and that
-- should be a deliberate, audited action (TASK_12), not a policy.

-- ---------------------------------------------------------------------------
-- 3. meal_plans — one row per day, mirroring the DayEntry union
-- ---------------------------------------------------------------------------

create table if not exists public.meal_plans (
  household_id      uuid        not null references public.households(id) on delete cascade,
  plan_date         date        not null,
  -- Mirrors DATA_MODELS.md §3 exactly: a day holds at most one of these three.
  kind              text        not null check (kind in ('recipe', 'leftover', 'note')),
  recipe_id         uuid        references public.recipes(id) on delete set null,
  -- The whole recipe object the context already holds. Reason it exists rather
  -- than joining on recipe_id: the day entry carries a full recipe today, and
  -- keeping a snapshot means a planned meal still renders from cache if the
  -- recipe row is later edited or deleted. A join would also make the Plan tab
  -- depend on the recipes table being reachable, which it is not when the free
  -- tier pauses.
  recipe_snapshot   jsonb,
  servings          integer     check (servings is null or servings > 0),
  leftover_of_date  date,
  note              text,
  updated_at        timestamptz not null default now(),
  primary key (household_id, plan_date),
  -- TASK_07's "half-written day" risk, closed in the schema rather than in the
  -- client: you cannot save a `recipe` day with no servings, a `leftover` day
  -- with no source date, or a `note` day with no text. Without this, last-write-
  -- wins between two phones can produce exactly the incoherent row TASK_07 warns
  -- about, and nothing downstream could tell.
  constraint meal_plans_payload_matches_kind check (
    (kind = 'recipe'   and servings is not null) or
    (kind = 'leftover' and leftover_of_date is not null) or
    (kind = 'note'     and note is not null)
  ),
  constraint meal_plans_leftover_not_self check (
    leftover_of_date is null or leftover_of_date <> plan_date
  )
);

create index if not exists meal_plans_household_date_idx
  on public.meal_plans (household_id, plan_date);

drop trigger if exists meal_plans_touch on public.meal_plans;
create trigger meal_plans_touch
  before update on public.meal_plans
  for each row execute function public.touch_updated_at();

alter table public.meal_plans enable row level security;

drop policy if exists "household reads its own plan" on public.meal_plans;
create policy "household reads its own plan"
  on public.meal_plans for select
  to anon, authenticated
  using (household_id = public.request_household_id());

drop policy if exists "household writes its own plan" on public.meal_plans;
create policy "household writes its own plan"
  on public.meal_plans for insert
  to anon, authenticated
  with check (household_id = public.request_household_id());

drop policy if exists "household updates its own plan" on public.meal_plans;
create policy "household updates its own plan"
  on public.meal_plans for update
  to anon, authenticated
  using (household_id = public.request_household_id())
  with check (household_id = public.request_household_id());

drop policy if exists "household clears days from its own plan" on public.meal_plans;
create policy "household clears days from its own plan"
  on public.meal_plans for delete
  to anon, authenticated
  using (household_id = public.request_household_id());

-- ---------------------------------------------------------------------------
-- 4. shopping_state — one row per household
-- ---------------------------------------------------------------------------

create table if not exists public.shopping_state (
  household_id      uuid primary key references public.households(id) on delete cascade,
  -- The ticked-off item keys, as an array. TASK_01's shape, kept as JSON so a
  -- change to the item `key` format (TASK_03) doesn't need a migration.
  checked_keys      jsonb       not null default '[]'::jsonb,
  -- The confirmed plan's fingerprint, also TASK_01. When it doesn't match the
  -- plan the client just built, the checks are stale and reset — that decision
  -- stays on the client, where the plan is, and the value is only carried here
  -- so the second phone agrees about it.
  plan_fingerprint  text        not null default '',
  updated_at        timestamptz not null default now(),

  constraint shopping_state_checked_keys_is_array
    check (jsonb_typeof(checked_keys) = 'array')
);

drop trigger if exists shopping_state_touch on public.shopping_state;
create trigger shopping_state_touch
  before update on public.shopping_state
  for each row execute function public.touch_updated_at();

alter table public.shopping_state enable row level security;

drop policy if exists "household reads its own shopping state" on public.shopping_state;
create policy "household reads its own shopping state"
  on public.shopping_state for select
  to anon, authenticated
  using (household_id = public.request_household_id());

drop policy if exists "household writes its own shopping state" on public.shopping_state;
create policy "household writes its own shopping state"
  on public.shopping_state for insert
  to anon, authenticated
  with check (household_id = public.request_household_id());

drop policy if exists "household updates its own shopping state" on public.shopping_state;
create policy "household updates its own shopping state"
  on public.shopping_state for update
  to anon, authenticated
  using (household_id = public.request_household_id())
  with check (household_id = public.request_household_id());

-- No delete policy: there is nothing to delete — the row is the household's
-- shopping state for as long as the household exists, and resetting the list is
-- an update with an empty array (ShopContext.resetList does exactly that).

-- ---------------------------------------------------------------------------
-- 5. essentials — the pantry items, and their user-editable categories
-- ---------------------------------------------------------------------------

create table if not exists public.essentials (
  household_id  uuid        not null references public.households(id) on delete cascade,
  -- The client-generated uuid the InventoryItem already carries. Kept as the
  -- key so an item's identity survives a round trip and a second phone can
  -- reference the same item.
  item_id       text        not null,
  name          text        not null,
  emoji         text,
  -- A category id, free text on purpose: categories are user-editable rows in
  -- essentials_categories, so an FK here would mean deleting a category had to
  -- re-point every item. InventoryContext already re-points them to 'other',
  -- and that behaviour is preserved rather than re-implemented in SQL.
  category      text        not null default 'other',
  flagged       boolean     not null default false,
  -- TASK_11 Phase 1. Both optional; the app reads them with ?.
  low_stock     boolean     not null default false,
  use_by_date   date,
  updated_at    timestamptz not null default now(),
  primary key (household_id, item_id)
);

drop trigger if exists essentials_touch on public.essentials;
create trigger essentials_touch
  before update on public.essentials
  for each row execute function public.touch_updated_at();

alter table public.essentials enable row level security;

drop policy if exists "household reads its own essentials" on public.essentials;
create policy "household reads its own essentials"
  on public.essentials for select
  to anon, authenticated
  using (household_id = public.request_household_id());

drop policy if exists "household writes its own essentials" on public.essentials;
create policy "household writes its own essentials"
  on public.essentials for insert
  to anon, authenticated
  with check (household_id = public.request_household_id());

drop policy if exists "household updates its own essentials" on public.essentials;
create policy "household updates its own essentials"
  on public.essentials for update
  to anon, authenticated
  using (household_id = public.request_household_id())
  with check (household_id = public.request_household_id());

drop policy if exists "household removes its own essentials" on public.essentials;
create policy "household removes its own essentials"
  on public.essentials for delete
  to anon, authenticated
  using (household_id = public.request_household_id());

create table if not exists public.essentials_categories (
  household_id  uuid        not null references public.households(id) on delete cascade,
  category_id   text        not null,
  name          text        not null,
  position      integer     not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (household_id, category_id)
);

drop trigger if exists essentials_categories_touch on public.essentials_categories;
create trigger essentials_categories_touch
  before update on public.essentials_categories
  for each row execute function public.touch_updated_at();

alter table public.essentials_categories enable row level security;

drop policy if exists "household reads its own essential categories" on public.essentials_categories;
create policy "household reads its own essential categories"
  on public.essentials_categories for select
  to anon, authenticated
  using (household_id = public.request_household_id());

drop policy if exists "household writes its own essential categories" on public.essentials_categories;
create policy "household writes its own essential categories"
  on public.essentials_categories for insert
  to anon, authenticated
  with check (household_id = public.request_household_id());

drop policy if exists "household updates its own essential categories" on public.essentials_categories;
create policy "household updates its own essential categories"
  on public.essentials_categories for update
  to anon, authenticated
  using (household_id = public.request_household_id())
  with check (household_id = public.request_household_id());

drop policy if exists "household removes its own essential categories" on public.essentials_categories;
create policy "household removes its own essential categories"
  on public.essentials_categories for delete
  to anon, authenticated
  using (household_id = public.request_household_id());

-- ---------------------------------------------------------------------------
-- 5. plan_state — one row per household
-- ---------------------------------------------------------------------------
-- `isPlanConfirmed` has lived in localStorage next to the plan since the
-- one-meal-per-day simplification, and the Shop tab is gated on it. It needs a
-- row of its own rather than a column somewhere: it is plan state, not shopping
-- state, and it is the flag the second phone has to agree about for TASK_07's
-- "confirm on A, see the same locked list on B" to actually work.

create table if not exists public.plan_state (
  household_id  uuid primary key references public.households(id) on delete cascade,
  confirmed     boolean     not null default false,
  updated_at    timestamptz not null default now()
);

drop trigger if exists plan_state_touch on public.plan_state;
create trigger plan_state_touch
  before update on public.plan_state
  for each row execute function public.touch_updated_at();

alter table public.plan_state enable row level security;

drop policy if exists "household reads its own plan state" on public.plan_state;
create policy "household reads its own plan state"
  on public.plan_state for select
  to anon, authenticated
  using (household_id = public.request_household_id());

drop policy if exists "household writes its own plan state" on public.plan_state;
create policy "household writes its own plan state"
  on public.plan_state for insert
  to anon, authenticated
  with check (household_id = public.request_household_id());

drop policy if exists "household updates its own plan state" on public.plan_state;
create policy "household updates its own plan state"
  on public.plan_state for update
  to anon, authenticated
  using (household_id = public.request_household_id())
  with check (household_id = public.request_household_id());

-- ---------------------------------------------------------------------------
-- 6. The join flow — two RPCs, no accounts
-- ---------------------------------------------------------------------------
-- Both are SECURITY DEFINER because the caller is not yet (and, in this task,
-- never is) a member: an invitee cannot read the households table to find the
-- row their code points at. search_path is pinned — the standard hardening for a
-- definer function, and dropping it is how definer functions get hijacked.

-- Creates a household and its join code. The code alphabet excludes 0/O/1/I/L/S/5
-- so it survives being read aloud and typed on a phone, which is the entire
-- reason a code exists as the fallback path.
create or replace function public.create_household(p_name text default null)
returns table (id uuid, join_code text, name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id   uuid := gen_random_uuid();
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code     text;
  attempts int := 0;
begin
  loop
    code := '';
    for _ in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;

    begin
      insert into public.households (id, name, join_code)
      values (new_id, coalesce(nullif(btrim(p_name), ''), 'Our household'), code);
      exit;                                   -- inserted, done
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts >= 8 then
        raise exception 'could not allocate a unique join code after % attempts', attempts;
      end if;
    end;
  end loop;

  return query select new_id, code, (select h.name from public.households h where h.id = new_id);
end;
$$;

comment on function public.create_household(text) is
  'TASK_07. Creates a household and returns its id + join code. The client stores the id and presents it in x-household-id from then on.';

-- Turns a typed code into the household id the joining device should adopt.
-- Returns NULL for an unknown code rather than raising, so a typo is a message
-- in the UI and not an error in the console. It deliberately returns nothing
-- else — not the household name, not its contents — so the only thing a guessed
-- code reveals is a uuid.
create or replace function public.resolve_join_code(p_code text)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select h.id
  from public.households h
  where h.join_code = upper(btrim(p_code));
$$;

comment on function public.resolve_join_code(text) is
  'TASK_07. Join code -> household id, or NULL. Anyone holding the anon key can call this; codes are the only protection, which is a TASK_12 item.';

-- ---------------------------------------------------------------------------
-- 7. THE SWAP, WHEN TASK_12 LANDS
-- ---------------------------------------------------------------------------
-- Every policy above keeps its shape and loses one clause. With a members table
-- and a session:
--
--   create or replace function public.is_household_member(hid uuid) ...
--     (see FEATURE_family_households.md for the security-definer body)
--
--   alter policy "household reads its own plan" on public.meal_plans
--     to authenticated
--     using (public.is_household_member(household_id));
--
--   ... and the same for each of the other policies, plus:
--   drop function public.request_household_id();
--
-- Two things to keep while doing it:
--   1. Revoke the anon role's access in the same migration. Until it is revoked,
--      the header path still works, and TASK_07's "don't let the intermediate
--      state become permanent" is exactly about that.
--   2. Backfill households into households + household_members (create_household
--      already gives you the id and name to migrate), rather than recreating
--      them — the plan rows hang off those ids.
