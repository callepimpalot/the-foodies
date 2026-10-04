-- Applied live via the Supabase MCP connection on 2026-08-22 (task-10 / TASK_10).
-- Kept here as the record; re-running it is a no-op.
--
-- TASK_10 assumed a step could carry its own ingredient indexes, which DATA_MODELS §1
-- allows for (`text[] | jsonb`). In this database `recipes.steps` is `text[]`, so it
-- cannot. The links live in a parallel jsonb column instead — additive, and it avoids
-- retyping a column that 403 existing rows and every reader depend on.
--
-- Shape: [[0,2],[],[1,3], ...] — one entry per step, each an array of 0-based indexes
-- into the row's `ingredients`. Nullable and unpopulated for existing recipes, which
-- fall back to the runtime matcher in src/lib/stepIngredients.js. No backfill: TASK_10
-- puts that explicitly out of scope.

-- One explicit transaction. A migration applied with `psql -f` autocommits every statement, so a
-- failure halfway through leaves half-built objects behind and the retry has to work around them.
-- The explicit begin;/commit; pair is inert where the runner already wraps the file in a
-- transaction (what the Supabase CLI does, and what 20260926_task07 and 20260927_archive already
-- do), and load-bearing where it does not. Verified statically only; no SQL engine is available.
begin;

alter table public.recipes
  add column if not exists step_ingredients jsonb;

comment on column public.recipes.step_ingredients is
  'TASK_10: array parallel to steps; each entry lists ingredient indexes used by that step. Null = fall back to runtime matching.';

commit;
