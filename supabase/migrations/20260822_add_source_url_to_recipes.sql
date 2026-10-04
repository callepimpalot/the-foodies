-- Applied live via the Supabase MCP connection on 2026-08-22 (batch-2 / TASK_08).
-- Kept here as the record; re-running it is a no-op.
--
-- TASK_08 assumed `recipes.source_url` already existed. It did not — the URL-capture
-- path carried source_url all the way to saveRecipe.js, which then dropped it.
-- Purely additive and nullable, so the currently-deployed build (which neither reads
-- nor writes this column) is unaffected.

-- One explicit transaction. A migration applied with `psql -f` autocommits every statement, so a
-- failure halfway through leaves half-built objects behind and the retry has to work around them.
-- The explicit begin;/commit; pair is inert where the runner already wraps the file in a
-- transaction (what the Supabase CLI does, and what 20260926_task07 and 20260927_archive already
-- do), and load-bearing where it does not. Verified statically only; no SQL engine is available.
begin;

alter table public.recipes
  add column if not exists source_url text;

comment on column public.recipes.source_url is
  'Origin URL when the recipe was captured from a link (TASK_08). Null for text/photo captures.';

commit;
