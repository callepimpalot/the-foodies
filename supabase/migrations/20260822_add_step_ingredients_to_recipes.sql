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

alter table public.recipes
  add column if not exists step_ingredients jsonb;

comment on column public.recipes.step_ingredients is
  'TASK_10: array parallel to steps; each entry lists ingredient indexes used by that step. Null = fall back to runtime matching.';
