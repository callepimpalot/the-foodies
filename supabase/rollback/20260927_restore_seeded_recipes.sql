-- 20260927_restore_seeded_recipes.sql
-- Meal Buddy / The Foodies — undo 20260927_archive_seeded_recipes.sql.
--
-- ⚠️ THIS FILE IS DELIBERATELY NOT IN supabase/migrations/. Everything in that directory is applied
--    automatically by the Supabase CLI, in filename order. A restore script must only ever run
--    because a human decided to run it.
--
-- What it restores: every row in public.recipes_archive_20260927 that is no longer in
-- public.recipes. Rows are inserted with their original id and every original column value, so
-- plans and cook feedback that referenced a recipe id by uuid resolve again afterwards.
--
-- What it will NOT overwrite: a recipe that has been edited (or a capture that now holds the same
-- id) since the deletion. `on conflict (id) do nothing` keeps the current row. If you want the
-- archived values to win, that is a different, deliberately-written statement — do not approximate
-- it here.

begin;

do $$
declare
  archived_count integer;
  missing_count  integer;
  restored_count integer;
begin
  select count(*) into archived_count from public.recipes_archive_20260927;
  if archived_count = 0 then
    raise exception 'archive is empty — nothing to restore. Did you run the restore against the '
                    'wrong project?';
  end if;

  select count(*) into missing_count
  from public.recipes_archive_20260927 a
  where not exists (select 1 from public.recipes r where r.id = a.id);

  insert into public.recipes
  select a.* from public.recipes_archive_20260927 a
  where not exists (select 1 from public.recipes r where r.id = a.id)
  on conflict (id) do nothing;
  get diagnostics restored_count = row_count;

  -- Guard: what was computed must equal what was done. `missing_count` is the set the insert was
  -- aimed at; `restored_count` is what the insert reports it actually restored. They can only
  -- differ if the two statements disagree about what "missing" means — and a silent difference
  -- would be a restore that leaves rows unfilled while printing a clean summary. Both statements
  -- are in this block, so the comparison is free.
  if restored_count <> missing_count then
    raise exception 'computed % missing row(s) but restored % — rolling back rather than leave the '
                    'restore half done.', missing_count, restored_count;
  end if;

  raise notice 'archive holds % rows; % were missing from recipes; % restored.',
    archived_count, missing_count, restored_count;
end
$$;

commit;

-- The archive table is intentionally left in place after a restore. It costs nothing, and it is
-- the only remaining copy of the rows if you restore by mistake. Drop it explicitly, by hand, if
-- you ever want it gone:
--
--   drop table public.recipes_archive_20260927;
