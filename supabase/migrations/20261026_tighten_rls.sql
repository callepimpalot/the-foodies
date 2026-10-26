-- ============================================================================
-- FAMILY HOUSEHOLDS — the tighten migration (migration Step 4, on its own)
-- ============================================================================
--
-- This is the step that restricts. It swaps every `to public` / `to anon` policy
-- for a `to authenticated` policy that resolves membership through auth.uid() +
-- is_household_member(), and it drops the TASK_07 `request_household_id()` header
-- path entirely. The client-supplied `x-household-id` stops meaning anything the
-- moment this file applies.
--
-- DO NOT APPLY THIS except as migration Step 4: only after
--   1. the additive schema (20261026_family_households_schema.sql) is applied,
--   2. Supabase Auth is configured (email provider + site URL), and
--   3. the owner has signed in and claimed the household (claim_household()).
-- Applying it earlier locks everyone out: every existing policy is anon/header,
-- and this file removes them.
--
-- The brief's rules, honoured here: Steps 1–3 add, step 4 restricts; take a
-- backup before step 4 (the free tier is not a backup); do not let the dual-read
-- path become permanent.
--
-- SAFE TO RUN TWICE? Yes — every policy is dropped before it is created.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- households — membership decides, the client never asserts
-- ---------------------------------------------------------------------------
drop policy if exists "household reads its own row" on public.households;
create policy "members read their households"
  on public.households for select
  to authenticated
  using (public.is_household_member(id));

drop policy if exists "household renames itself" on public.households;
create policy "members rename their household"
  on public.households for update
  to authenticated
  using (public.is_household_member(id))
  with check (public.is_household_member(id));

-- No INSERT policy: households are created by create_household_for_user(), which
-- also adds the caller as owner. No DELETE policy: deleting a household cascades
-- to every plan in it and should be a deliberate, audited RPC, not a policy.

-- ---------------------------------------------------------------------------
-- recipes — Q1 private captures. No global library (Q2 deleted it), so
-- `household_id is null` is DELIBERATELY not granted read. Re-add it only if a
-- shared library is ever reintroduced.
-- ---------------------------------------------------------------------------
drop policy if exists "Allow public read access" on public.recipes;
create policy "members read their household recipes"
  on public.recipes for select
  to authenticated
  using (household_id is not null and public.is_household_member(household_id));

drop policy if exists "Allow public inserts" on public.recipes;
create policy "members capture into their household"
  on public.recipes for insert
  to authenticated
  with check (household_id is not null and public.is_household_member(household_id));

drop policy if exists "Allow public updates" on public.recipes;
create policy "members edit their household recipes"
  on public.recipes for update
  to authenticated
  using (household_id is not null and public.is_household_member(household_id))
  with check (household_id is not null and public.is_household_member(household_id));

drop policy if exists "members delete their household recipes" on public.recipes;
create policy "members delete their household recipes"
  on public.recipes for delete
  to authenticated
  using (household_id is not null and public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- cook_feedback — household-scoped, and member_id must be the writer so one
-- member cannot steer the taste model as another.
-- ---------------------------------------------------------------------------
drop policy if exists "Allow public read access" on public.cook_feedback;
create policy "members read their household cook feedback"
  on public.cook_feedback for select
  to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "Allow public inserts" on public.cook_feedback;
create policy "members log a cook for their household"
  on public.cook_feedback for insert
  to authenticated
  with check (public.is_household_member(household_id) and member_id = auth.uid());

-- ---------------------------------------------------------------------------
-- The five TASK_07 tables — identical shape: household reads/writes its own,
-- now by membership instead of the presented header.
-- ---------------------------------------------------------------------------
drop policy if exists "household reads its own plan" on public.meal_plans;
create policy "household reads its own plan"
  on public.meal_plans for select
  to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "household writes its own plan" on public.meal_plans;
create policy "household writes its own plan"
  on public.meal_plans for insert
  to authenticated
  with check (public.is_household_member(household_id));

drop policy if exists "household updates its own plan" on public.meal_plans;
create policy "household updates its own plan"
  on public.meal_plans for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "household clears days from its own plan" on public.meal_plans;
create policy "household clears days from its own plan"
  on public.meal_plans for delete
  to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "household reads its own shopping state" on public.shopping_state;
create policy "household reads its own shopping state"
  on public.shopping_state for select
  to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "household writes its own shopping state" on public.shopping_state;
create policy "household writes its own shopping state"
  on public.shopping_state for insert
  to authenticated
  with check (public.is_household_member(household_id));

drop policy if exists "household updates its own shopping state" on public.shopping_state;
create policy "household updates its own shopping state"
  on public.shopping_state for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "household reads its own plan state" on public.plan_state;
create policy "household reads its own plan state"
  on public.plan_state for select
  to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "household writes its own plan state" on public.plan_state;
create policy "household writes its own plan state"
  on public.plan_state for insert
  to authenticated
  with check (public.is_household_member(household_id));

drop policy if exists "household updates its own plan state" on public.plan_state;
create policy "household updates its own plan state"
  on public.plan_state for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "household reads its own essentials" on public.essentials;
create policy "household reads its own essentials"
  on public.essentials for select
  to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "household writes its own essentials" on public.essentials;
create policy "household writes its own essentials"
  on public.essentials for insert
  to authenticated
  with check (public.is_household_member(household_id));

drop policy if exists "household updates its own essentials" on public.essentials;
create policy "household updates its own essentials"
  on public.essentials for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "household removes its own essentials" on public.essentials;
create policy "household removes its own essentials"
  on public.essentials for delete
  to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "household reads its own essential categories" on public.essentials_categories;
create policy "household reads its own essential categories"
  on public.essentials_categories for select
  to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "household writes its own essential categories" on public.essentials_categories;
create policy "household writes its own essential categories"
  on public.essentials_categories for insert
  to authenticated
  with check (public.is_household_member(household_id));

drop policy if exists "household updates its own essential categories" on public.essentials_categories;
create policy "household updates its own essential categories"
  on public.essentials_categories for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "household removes its own essential categories" on public.essentials_categories;
create policy "household removes its own essential categories"
  on public.essentials_categories for delete
  to authenticated
  using (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Drop the TASK_07 header path and close the anon role.
-- ---------------------------------------------------------------------------
-- The header stopped mattering the moment the policies above stopped reading it;
-- the function is dropped so nothing can reintroduce it by accident.
drop function if exists public.request_household_id();

-- With every policy now `to authenticated`, the anon role reads nothing for
-- these tables. The explicit revoke is belt-and-braces: it removes table-level
-- grants so a future, loosely-written policy cannot silently re-open the header
-- path to anon. Auth (sign up/in/out) is unaffected — it lives in the auth
-- schema, not here.
revoke all on public.households, public.household_members, public.household_invites,
  public.recipes, public.cook_feedback, public.meal_plans, public.shopping_state,
  public.plan_state, public.essentials, public.essentials_categories
  from anon;

-- The TASK_07 join-code path is the same bearer-token weakness, one function
-- deep: `create_household` lets an anonymous caller mint households and
-- `resolve_join_code` turns a guessed code into a household id. They are
-- superseded by create_household_for_user() (authenticated, adds the owner) and
-- create_invite()/accept_invite() (single-use, expiring). Close them to anon so
-- the legacy path cannot outlive this migration. They are left in place (not
-- dropped) so the client's legacy device path degrades to a local household
-- gracefully rather than erroring; drop them once that path is confirmed dead.
revoke execute on function public.create_household(text) from anon;
revoke execute on function public.resolve_join_code(text) from anon;

-- ============================================================================
-- Verify after applying: run get_advisors and confirm the security advisor is
-- clean. Then, from a real second account, prove the negatives through the anon
-- key (see scripts/family_households_check.mjs for the static assertions and the
-- PR description for the live checklist):
--   * no session -> every select returns []
--   * a session for household B -> zero of household A's rows
--   * INSERT with a forged household_id in the body that the caller is not a
--     member of -> refused by the database (WITH CHECK), not by the UI
-- ============================================================================