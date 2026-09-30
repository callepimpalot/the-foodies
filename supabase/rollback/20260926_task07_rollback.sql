-- 20260926_task07_rollback.sql
-- Meal Buddy / The Foodies — undo supabase/migrations/20260926_task07_household_planning.sql.
--
-- ⚠️ THIS FILE HAS NEVER BEEN RUN, and it is deliberately NOT in supabase/migrations/. Everything in
--    that directory is applied automatically by the Supabase CLI, in filename order; a rollback must
--    only ever run because a human decided to run it. Same arrangement, and the same reason, as
--    supabase/rollback/20260927_restore_seeded_recipes.sql.
--
-- WHY IT EXISTS
--   The seeded-recipe deletion shipped with a rollback from the day it was written; the TASK_07
--   migration shipped without one. That is backwards. The deletion removes rows and is the easier of
--   the two to undo (the rows are archived). This one removes *whole tables*, and the rows in them —
--   a household's plan, its shopping ticks, its pantry — exist nowhere else. Without a written
--   rollback, "undo TASK_07" means someone improvising DDL on a live database while looking at a
--   513-line migration. This file is that rollback, written down before it is ever needed.
--
-- WHAT IT DROPS (all of it inside one transaction)
--   1. the six tables this migration creates — meal_plans, essentials, essentials_categories,
--      shopping_state, plan_state, then households
--   2. the four functions: create_household(text), resolve_join_code(text), request_household_id(),
--      touch_updated_at()
--   Nothing else in the database is touched. The three older migrations, public.recipes, and the
--   recipe archive are not referenced anywhere below.
--
-- THE GUARD, AND WHY IT IS THE WHOLE POINT
--   Dropping public.households cascades to every row that belongs to it. So this file refuses to
--   drop anything while any household exists — it aborts and tells you the row counts. That makes
--   the safe case (rolling back a migration that was applied and then never used, i.e. an empty
--   schema) a no-op that commits cleanly, and the dangerous case (rolling back a household that has
--   been living with real plans) a deliberate two-step: delete the rows you mean to lose first, then
--   run this. There is no force flag, on purpose — a flag is what gets set at 23:00 by someone who
--   has stopped reading.
--
-- ORDER AND `cascade`
--   The tables are dropped child-first by hand and `cascade` is deliberately NOT used: if some future
--   table references public.households without being listed here, the drop fails loudly instead of
--   quietly taking that table's rows with it. Policies and triggers are not dropped explicitly —
--   they belong to their table and go with it.
--
-- IDEMPOTENT
--   Every drop is `if exists`, and the guard treats a missing table as zero rows, so running this
--   against a database where the migration was never applied is a clean no-op rather than an error.

begin;

do $$
declare
  n_households  bigint := 0;
  n_plans       bigint := 0;
  n_essentials  bigint := 0;
  n_categories  bigint := 0;
  n_shopping    bigint := 0;
  n_plan_state  bigint := 0;
begin
  -- to_regclass() rather than a direct count: on a database where the migration was never applied
  -- every one of these tables is missing, and that must read as "empty", not as an error.
  if to_regclass('public.households')          is not null then execute 'select count(*) from public.households'          into n_households;  end if;
  if to_regclass('public.meal_plans')          is not null then execute 'select count(*) from public.meal_plans'          into n_plans;       end if;
  if to_regclass('public.essentials')          is not null then execute 'select count(*) from public.essentials'          into n_essentials;  end if;
  if to_regclass('public.essentials_categories') is not null then execute 'select count(*) from public.essentials_categories' into n_categories; end if;
  if to_regclass('public.shopping_state')      is not null then execute 'select count(*) from public.shopping_state'      into n_shopping;    end if;
  if to_regclass('public.plan_state')          is not null then execute 'select count(*) from public.plan_state'          into n_plan_state;  end if;

  if n_households + n_plans + n_essentials + n_categories + n_shopping + n_plan_state > 0 then
    raise exception
      'refusing to roll back TASK_07: the schema still holds data — % household(s), % meal plan row(s), '
      '% essential(s), % essential category/categories, % shopping state row(s), % plan state row(s). '
      'Dropping public.households cascades to all of it and none of it exists anywhere else. If you '
      'really mean to lose those rows, delete them deliberately first, then run this file again.',
      n_households, n_plans, n_essentials, n_categories, n_shopping, n_plan_state;
  end if;

  raise notice
    'TASK_07 schema is empty (% households). Dropping the six tables and the four functions.',
    n_households;
end
$$;

-- Child tables first — see the note about `cascade` in the header.
drop table if exists public.meal_plans;
drop table if exists public.essentials;
drop table if exists public.essentials_categories;
drop table if exists public.shopping_state;
drop table if exists public.plan_state;
drop table if exists public.households;

-- The functions last: the policies that referenced request_household_id() are gone with their
-- tables, so there is nothing left depending on it.
drop function if exists public.create_household(text);
drop function if exists public.resolve_join_code(text);
drop function if exists public.request_household_id();
drop function if exists public.touch_updated_at();

commit;

-- Verification to run immediately afterwards (read-only):
--
--   select to_regclass('public.households')          is null;   -- t
--   select to_regclass('public.meal_plans')          is null;   -- t
--   select to_regclass('public.essentials')          is null;   -- t
--   select to_regclass('public.essentials_categories') is null; -- t
--   select to_regclass('public.shopping_state')      is null;   -- t
--   select to_regclass('public.plan_state')          is null;   -- t
--   select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public'
--       and p.proname in ('create_household','resolve_join_code','request_household_id','touch_updated_at');
--                                                              -- 0
--
-- What a rollback does NOT do: restore the client state. A device that has a household id in
-- localStorage keeps it, and after this runs that id resolves to nothing — the app falls back to
-- its local/offline behaviour rather than erroring, which is the same path it takes when the
-- Supabase project is unreachable. Confirm on a device after rolling back, do not assume it.
