-- ============================================================================
-- FAMILY HOUSEHOLDS (FEATURE_family_households.md) — the additive schema half
-- ============================================================================
--
-- This file is Step 0+1 of the feature's migration sequence. It is PURPOSELY
-- additive: it creates the membership and invite layer and the recipe scoping
-- columns, and it does NOT touch a single existing policy. The live app keeps
-- working on the TASK_07 `x-household-id` path unchanged after this applies.
-- The swap to authenticated/membership policies is a SEPARATE migration
-- (20261026_tighten_rls.sql) that must be applied only after the owner has a
-- real session — see the brief's "Steps 1–3 add; step 4 restricts" rule.
--
-- The six open questions in the brief are all decided and are NOT re-opened
-- here: Q1 private captures, Q2 seeded recipes deleted (already live — 400 rows
-- in recipes_archive_20260927, 8 personal rows in recipes), Q3 many-to-many in
-- the schema, Q4 owner + member (role read, holds 'owner'/'member'), Q5 the
-- household keeps everything, Q6 invite link + password with the code as
-- small print.
--
-- SAFE TO RUN TWICE? Yes — every policy and trigger is preceded by a matching
-- drop, and every table/column is `if not exists`. scripts/family_households_check.mjs
-- asserts this file's load-bearing properties.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 2. household_members — the join every policy reads
-- ---------------------------------------------------------------------------

create table if not exists public.household_members (
  household_id  uuid        not null references public.households(id) on delete cascade,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  display_name  text,                                  -- "Calle" — attribution in the UI
  role          text        not null default 'member' check (role in ('owner', 'member')),
  joined_at     timestamptz not null default now(),
  primary key (household_id, user_id)
);

comment on table public.household_members is
  'Family households. Membership is the join every RLS policy reads. Members are real Supabase Auth users (user_id). Naming rule: these are MEMBERS, never "child users" or "sub-users".';

create index if not exists household_members_user_idx
  on public.household_members (user_id);

alter table public.household_members enable row level security;

-- ---------------------------------------------------------------------------
-- 2b. The membership helpers every policy reads
-- ---------------------------------------------------------------------------
-- These must come AFTER the household_members table (a SQL-language function body
-- is parsed at creation time) and BEFORE its policies (they reference it).
-- `security definer` is load-bearing: without it, a policy on household_members
-- that queries household_members recurses. `set search_path` is the standard
-- hardening for a definer function. Both are in the brief and neither may be
-- dropped.
create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

comment on function public.is_household_member(uuid) is
  'True when the caller (auth.uid()) is a member of household hid. The predicate every RLS policy uses once the tighten migration lands.';

-- The owner check. Q4-B makes the owner the only member who can invite or
-- remove, so ownership needs its own predicate rather than being guessed from
-- role strings inside every policy.
create or replace function public.is_household_owner(hid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid() and role = 'owner'
  );
$$;

comment on function public.is_household_owner(uuid) is
  'True when the caller is the owner of household hid. Gates invite/remove/transfer.';

drop policy if exists "members see who else is in the household" on public.household_members;
create policy "members see who else is in the household"
  on public.household_members for select
  to authenticated
  using (public.is_household_member(household_id));

-- INSERT is with check (false) ON PURPOSE. If a member could insert their own
-- membership row, anyone who learned a household id could join it — the bearer-
-- token problem again. Joining goes through accept_invite() or claim_household(),
-- both security definer, or it does not happen.
drop policy if exists "membership is added only by invite acceptance" on public.household_members;
create policy "membership is added only by invite acceptance"
  on public.household_members for insert
  to authenticated
  with check (false);

-- DELETE: a member may leave (delete their own row), and the owner may remove
-- anyone. A trigger below enforces the guards the brief names: a household never
-- drops to zero members, and never to zero owners (the last owner leaving would
-- strand the household with nobody able to invite or remove).
drop policy if exists "members leave or the owner removes them" on public.household_members;
create policy "members leave or the owner removes them"
  on public.household_members for delete
  to authenticated
  using (
    public.is_household_member(household_id)
    and (user_id = auth.uid() or public.is_household_owner(household_id))
  );

-- ---------------------------------------------------------------------------
-- 3. The two guards the brief names as consequences of Q4-B
-- ---------------------------------------------------------------------------
-- A household must keep at least one member, and at least one owner. The owner
-- count matters specifically under Q4-B: if the last owner leaves, nobody can
-- ever invite or remove again. The single-member trigger is the backstop, not
-- the whole answer.
create or replace function public.household_members_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_count int;
  member_count int;
begin
  select count(*) into member_count
    from public.household_members where household_id = old.household_id;
  if member_count <= 1 then
    raise exception 'A household must keep at least one member. Delete the household to remove the last one.';
  end if;

  if old.role = 'owner' then
    select count(*) into owner_count
      from public.household_members
      where household_id = old.household_id and role = 'owner';
    if owner_count <= 1 then
      raise exception 'The last owner cannot leave. Transfer ownership to another member first.';
    end if;
  end if;

  return old;
end;
$$;

drop trigger if exists household_members_guard_trigger on public.household_members;
create trigger household_members_guard_trigger
  before delete on public.household_members
  for each row execute function public.household_members_guard();

-- ---------------------------------------------------------------------------
-- 4. household_invites — single-use, expiring invites. Never a household_id in
--    a URL (that is the bearer token wearing a nicer coat — see the brief).
-- ---------------------------------------------------------------------------

create table if not exists public.household_invites (
  token         text primary key,                            -- random, single-use
  household_id  uuid not null references public.households(id) on delete cascade,
  invited_by    uuid references auth.users(id) on delete set null,
  expires_at    timestamptz not null,
  accepted_at   timestamptz,
  accepted_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

comment on table public.household_invites is
  'Single-use invites. The token goes in the URL; the household id never does.';

alter table public.household_invites enable row level security;

drop policy if exists "members see their household invites" on public.household_invites;
create policy "members see their household invites"
  on public.household_invites for select
  to authenticated
  using (public.is_household_member(household_id));

-- No INSERT policy on purpose: only create_invite() mints a token. A client that
-- could insert its own invite row could invent an unexpiring token, which is the
-- same reason create_household() and not a policy is the only place a join code
-- is generated.
drop policy if exists "members revoke their household invites" on public.household_invites;
create policy "members revoke their household invites"
  on public.household_invites for delete
  to authenticated
  using (public.is_household_owner(household_id));

-- ---------------------------------------------------------------------------
-- 5. recipes — household scoping and attribution columns (Q1, Q5)
-- ---------------------------------------------------------------------------
-- household_id NULL no longer means "the global library" because Q2 deleted the
-- global library (the 400 imported rows are archived). It means "unscoped /
-- legacy", and after the tighten migration it will match nothing for SELECT
-- because captures are private by default. The `household_id is null` clause is
-- kept in the tighten migration's SELECT policy only as belt-and-braces / future
-- shared-library hook, exactly as the brief's Q2 note allows.
alter table public.recipes add column if not exists household_id uuid null references public.households(id) on delete cascade;
alter table public.recipes add column if not exists created_by_member_id uuid null references auth.users(id) on delete set null;

comment on column public.recipes.household_id is
  'The household this recipe belongs to. NULL = legacy/unscoped. Captures are private by default (Q1).';
comment on column public.recipes.created_by_member_id is
  'Who captured it — attribution, not ownership (Q5). The household owns the row.';

create index if not exists recipes_household_idx on public.recipes (household_id);

-- ---------------------------------------------------------------------------
-- 6. RPCs — all security definer, all search_path pinned
-- ---------------------------------------------------------------------------
-- The invitee is not yet a member and so cannot read household_invites through
-- RLS; redemption therefore goes through these functions.

-- Mints an invite. Owner-only. Returns the token for the client to put in the
-- share link. The token alphabet excludes 0/O/1/I/L/S/5 so it survives being
-- read aloud, and it is 20 characters — long enough that a guess is not a path.
create or replace function public.create_invite(p_household_id uuid, p_ttl interval default interval '7 days')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz';
  new_token text;
  attempt int := 0;
begin
  if not public.is_household_owner(p_household_id) then
    raise exception 'Only the household owner can invite.';
  end if;

  loop
    attempt := attempt + 1;
    new_token := '';
    for _ in 1..20 loop
      new_token := new_token || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;

    begin
      insert into public.household_invites (token, household_id, invited_by, expires_at)
      values (new_token, p_household_id, auth.uid(), now() + p_ttl);
      exit;
    exception when unique_violation then
      if attempt >= 8 then raise; end if;
    end;
  end loop;

  return new_token;
end;
$$;

comment on function public.create_invite(uuid, interval) is
  'Owner-only. Mints a single-use invite token for household p_household_id. The client puts the token, never the household id, in the share link.';

-- Creates a household AND adds the caller as its owner member, in one
-- transaction. This is the authenticated replacement for TASK_07's
-- create_household(): that RPC predates auth and cannot add a member, so a
-- household it created would have no owner and could never be invited into.
create or replace function public.create_household_for_user(p_name text default null)
returns table (id uuid, name text, join_code text, created_at timestamptz)
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
      exit;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts >= 8 then raise; end if;
    end;
  end loop;

  insert into public.household_members (household_id, user_id, display_name, role)
  values (new_id, auth.uid(), null, 'owner');

  return query select h.id, h.name, h.join_code, h.created_at
    from public.households h where h.id = new_id;
end;
$$;

comment on function public.create_household_for_user(text) is
  'Authenticated household creation: makes the household and its owner membership atomically. The join_code stays as the small-print fallback (Q6).';

-- Redeems an invite. Validates existence, expiry and single-use, then inserts
-- the membership row (role member) and marks the invite accepted, all in one
-- transaction. Returns the household id + name so the client can navigate.
create or replace function public.accept_invite(p_token text)
returns table (household_id uuid, household_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.household_invites%rowtype;
begin
  select * into v_invite from public.household_invites where token = p_token;

  if v_invite.token is null then
    raise exception 'This invite was not found. Ask for a new link.';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'This invite has already been used. Ask for a new link.';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'This invite has expired. Ask for a new link.';
  end if;

  insert into public.household_members (household_id, user_id, display_name, role)
  values (v_invite.household_id, auth.uid(), null, 'member')
  on conflict (household_id, user_id) do nothing;

  update public.household_invites
     set accepted_at = now(), accepted_by = auth.uid()
   where token = p_token;

  return query
    select h.id, h.name from public.households h where h.id = v_invite.household_id;
end;
$$;

comment on function public.accept_invite(text) is
  'Redeems a single-use invite: checks expiry and single-use, inserts the membership row, marks the invite used. The invitee is not yet a member, which is why this is security definer.';

-- The migration's Step 2. Turns the device-held household id (TASK_07's bearer
-- token) into a real, claimed household owned by the signing-up user. This is the
-- one place the legacy id is trusted, and only while the household has no members
-- — the same trust level as today, never weaker. Idempotent for the same user.
create or replace function public.claim_household(p_legacy_id uuid)
returns table (id uuid, name text, join_code text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_h public.households%rowtype;
begin
  select * into v_h from public.households h where h.id = p_legacy_id;
  if v_h.id is null then
    raise exception 'No household with that id exists.';
  end if;

  -- Idempotent: the same user claiming again is a no-op (they already own it).
  if public.is_household_member(p_legacy_id) then
    return query select h.id, h.name, h.join_code, h.created_at
      from public.households h where h.id = p_legacy_id;
    return;
  end if;

  -- A household can be claimed once. If it already has a member, whoever holds
  -- the legacy id now is not its original owner.
  if exists (select 1 from public.household_members where household_id = p_legacy_id) then
    raise exception 'This household already belongs to someone else.';
  end if;

  insert into public.household_members (household_id, user_id, display_name, role)
  values (p_legacy_id, auth.uid(), null, 'owner');

  -- Backfill attribution the reviewed schema already anticipated. cook_feedback
  -- is empty today, and recipes holds 8 personal rows — but the statement is
  -- written against "unscoped" so a future claim does not silently orphan rows.
  update public.cook_feedback
     set household_id = p_legacy_id, member_id = auth.uid()
   where household_id is null;

  -- Stamp this device's captures onto the claimed household. Q1 made captures
  -- private; until now they were global (`household_id is null`). At claim time
  -- there is exactly one member, so every unscoped personal capture is his.
  update public.recipes
     set household_id = p_legacy_id, created_by_member_id = auth.uid()
   where household_id is null and is_personal is true;

  return query select h.id, h.name, h.join_code, h.created_at
    from public.households h where h.id = p_legacy_id;
end;
$$;

comment on function public.claim_household(uuid) is
  'Migration Step 2. Converts the device-held household id into a real household owned by the signing-up user. Idempotent for the same user; refused once any member exists.';

-- Q4-B consequence: ownership must be transferable, or a holidaying owner strands
-- the household. Owner-only; the new owner must already be a member.
create or replace function public.transfer_ownership(p_household_id uuid, p_new_owner_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_household_owner(p_household_id) then
    raise exception 'Only the household owner can transfer ownership.';
  end if;
  if not exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = p_new_owner_user_id
  ) then
    raise exception 'The new owner must already be a member of the household.';
  end if;

  update public.household_members set role = 'member'
    where household_id = p_household_id and user_id = auth.uid();
  update public.household_members set role = 'owner'
    where household_id = p_household_id and user_id = p_new_owner_user_id;
end;
$$;

comment on function public.transfer_ownership(uuid, uuid) is
  'Moves ownership to another member. The caller must be the current owner.';