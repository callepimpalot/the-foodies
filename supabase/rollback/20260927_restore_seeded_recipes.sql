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

  -- The target columns are NAMED, not positional. `insert into public.recipes select a.* from …`
  -- worked only because the archive was created as `(like public.recipes including all)` and the
  -- two column orders therefore matched. That stops being true the moment `recipes` gains a column:
  -- FEATURE_family_households.md plans two (`household_id`, `created_by_member_id`), and after
  -- either one the select has fewer expressions than the target has columns, so the undo fails
  -- with 42601 exactly when it is needed. Naming the columns makes the restore independent of the
  -- table's width; a column added to `recipes` later is simply not written by the undo (and if it
  -- was added NOT NULL with no default, the insert fails loudly rather than half-restoring).
  -- The column list must stay equal to the archive's shape — the archive is never re-created.
  insert into public.recipes
    (id, title, description, image_url, cook_time_minutes, difficulty, kcal, base_servings,
     meal_type, tags, archetypes, ingredients, steps, is_personal, creator, source_url,
     step_ingredients, created_at)
  select
     a.id, a.title, a.description, a.image_url, a.cook_time_minutes, a.difficulty, a.kcal,
     a.base_servings, a.meal_type, a.tags, a.archetypes, a.ingredients, a.steps, a.is_personal,
     a.creator, a.source_url, a.step_ingredients, a.created_at
  from public.recipes_archive_20260927 a
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
