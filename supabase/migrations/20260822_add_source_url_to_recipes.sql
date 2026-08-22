-- Applied live via the Supabase MCP connection on 2026-08-22 (batch-2 / TASK_08).
-- Kept here as the record; re-running it is a no-op.
--
-- TASK_08 assumed `recipes.source_url` already existed. It did not — the URL-capture
-- path carried source_url all the way to saveRecipe.js, which then dropped it.
-- Purely additive and nullable, so the currently-deployed build (which neither reads
-- nor writes this column) is unaffected.

alter table public.recipes
  add column if not exists source_url text;

comment on column public.recipes.source_url is
  'Origin URL when the recipe was captured from a link (TASK_08). Null for text/photo captures.';
