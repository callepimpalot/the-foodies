-- 20260927_archive_seeded_recipes.sql
-- Meal Buddy / The Foodies — remove the 400 bulk-imported Epicurious recipes from the app.
--
-- Owner decision, 2026-09-26, verbatim:
--   "I actually want the initial 400 removed from the app. I hate those recipes actually...
--    The app will grow with the user!"
-- This file is that decision, written as reviewable SQL.
--
-- ⚠️ THIS FILE HAS NEVER BEEN RUN. There were no database credentials in the environment it was
--    written in, by the owner's explicit instruction. Read it, run it against a database branch
--    first, then apply it deliberately. It is destructive and it is deliberately not applied.
--
-- WHAT IT DOES — all of it inside one transaction:
--   1. creates public.recipes_archive_20260927 (a full copy of the `recipes` shape) if absent
--   2. copies every row it is about to delete into that archive, skipping ids already archived
--   3. deletes exactly those rows from public.recipes
--   4. aborts the whole transaction if anything is not as expected — see the guards at the bottom
--   5. is safe to apply twice: a re-run archives nothing, deletes nothing and commits cleanly
--
-- WHAT IT DOES NOT DO
--   * It does not touch user-captured or AI-planned recipes. src/lib/saveRecipe.js always writes
--     `is_personal: true`, and the predicate requires `is_personal IS NOT TRUE`. The guard also
--     re-checks the archive for a personal row and raises before the delete runs.
--   * It does not drop, truncate or alter any table or column.
--   * It does not touch final_recipes.json, the offline fallback (38 recipes, a different set).
--   * It does not run itself.
--
-- HOW TO UNDO IT
--   supabase/rollback/20260927_restore_seeded_recipes.sql — kept OUT of supabase/migrations/ on
--   purpose. Everything in supabase/migrations/ is applied automatically by the CLI, in filename
--   order; a restore script must never be automatic.
--
-- WHY AN ARCHIVE TABLE RATHER THAN A `deleted_at` SOFT-DELETE FLAG
--   A flag would need every read path to filter on it. `recipes` is read directly from four places
--   (src/hooks/useRecipes.js, src/lib/recipeSearch.js, src/components/RecipeDetailSheet.jsx, the
--   week-planner chat), and one forgotten `.is('deleted_at', null)` puts the hated recipes back on
--   screen with no error to notice. The archive gives identical reversibility with zero app change:
--   the rows leave the only table the app reads, and they still exist on disk.
--
-- HOW TO RUN IT (operator notes)
--   Run it as the project owner — the Supabase SQL editor, or psql as the `postgres` role.
--   `recipes` has SELECT / INSERT / UPDATE policies for `public` and NO DELETE policy, so the anon
--   key used by the client bundle physically cannot delete a row: this deletion can only ever be a
--   deliberate, operator-driven act. Note also that RLS is not enforced for a table's owner, so a
--   policy is not what protects you here — the guards below are. Take a backup snapshot before
--   running it anyway; the archive is inside the same transaction, not a substitute for one.

begin;

-- 1 ── the archive. Shape only (`like`), no rows: the insert below is the one place rows are
--      selected into it, so "what was archived" and "what gets deleted" cannot drift apart.
create table if not exists public.recipes_archive_20260927
  (like public.recipes including all);

-- 2 ── archive, then delete. Both steps now live in ONE block, and that is a fix, not a tidy-up.
--      They used to be split: the insert ran outside the DO block, and guard C compared the
--      delete count against the *whole* archive. That made the header's "Idempotent" claim false.
--      A second application archives nothing new (the `not exists` is doing its job), so
--      guard C compared 0 deleted against the 400 rows already sitting in the archive and aborted
--      with 'deleted 0 rows but archived 400 rows'. Nothing was ever deleted by that abort — the
--      guards did their job — but a file documented as idempotent that goes red on a re-run is a
--      file an operator cannot trust with a delete.
--      With both steps in one block, the block can compare "rows archived by THIS application"
--      (get diagnostics row_count, taken straight after the insert) with "rows THIS application
--      deleted". On a re-run that is 0 = 0 and the file commits cleanly.
--
--      Idempotent: re-running this file archives nothing new and deletes nothing new.
do $$
declare
  archived_before integer;   -- rows already in the archive when this application started
  archived_count  integer;   -- rows archived BY THIS APPLICATION
  archived_total  integer;   -- archive size once the insert above has run
  deleted_count   integer;
  personal_count  integer;
  unknown_count   integer;   -- archived rows whose is_personal is NULL
  personal_live_before integer;   -- personal rows in public.recipes before the delete
  personal_live_after  integer;   -- ... and after it
begin
  select count(*) into archived_before from public.recipes_archive_20260927;

  -- The target columns are NAMED, not positional. `insert into … select r.*` worked only because
  -- the archive was created as `(like public.recipes including all)` and the two shapes therefore
  -- matched at that instant. That stops being true the moment `recipes` gains a column: the archive
  -- is created once and its shape is frozen, so a positional select then has more expressions than
  -- the target has columns and the whole file fails with 42601 — before the delete, so nothing is
  -- lost, but the deletion can no longer be applied at all. FEATURE_family_households.md plans two
  -- such columns (`household_id`, `created_by_member_id`), and this is the same defect that was
  -- fixed in the undo (supabase/rollback/20260927_restore_seeded_recipes.sql) — a delete whose undo
  -- is width-proof while the delete is not is only half fixed.
  --
  -- The list is the 18 live `recipes` columns as documented in .agent/DATA_MODELS.md §1, verified
  -- column by column: id, title, description, image_url, cook_time_minutes, difficulty, kcal,
  -- base_servings, meal_type, tags, archetypes, ingredients, steps, is_personal, creator,
  -- source_url, step_ingredients, created_at. It is deliberately identical to the restore's list, so
  -- "what was archived" and "what the undo writes back" cannot drift apart. A column added to
  -- `recipes` later is simply not archived (and not restored), which is the correct behaviour for an
  -- undo of a point-in-time deletion.
  insert into public.recipes_archive_20260927
    (id, title, description, image_url, cook_time_minutes, difficulty, kcal, base_servings,
     meal_type, tags, archetypes, ingredients, steps, is_personal, creator, source_url,
     step_ingredients, created_at)
  select r.id, r.title, r.description, r.image_url, r.cook_time_minutes, r.difficulty, r.kcal,
         r.base_servings, r.meal_type, r.tags, r.archetypes, r.ingredients, r.steps, r.is_personal,
         r.creator, r.source_url, r.step_ingredients, r.created_at
  from public.recipes r
  where coalesce(r.is_personal, false) = false
    and not exists (
      select 1 from public.recipes_archive_20260927 a where a.id = r.id
    );
  get diagnostics archived_count = row_count;

  archived_total := archived_before + archived_count;

  -- Guard A — there must be something in the archive to justify a delete. Keyed off the total,
  -- not off this application's contribution: on a re-run nothing matches, and that is correct
  -- rather than a reason to stop.
  if archived_total = 0 then
    raise exception 'archive is empty: nothing matched the imported-library predicate, so the '
                    'predicate is wrong for this database. No rows deleted.';
  end if;
  -- Guard A2 — the blast radius, also measured on the archive as a whole so a re-run is held to
  -- the same ceiling as a first run.
  if archived_total > 450 then
    raise exception 'archive holds % rows, more than the 400 imported plus a small margin. '
                    'Stop and read the predicate before deleting. No rows deleted.', archived_total;
  end if;

  -- Guard B — a captured recipe must never be in the archive. This is the guard that makes the
  -- predicate safety argument above load-bearing rather than a comment.
  select count(*) into personal_count
  from public.recipes_archive_20260927 where is_personal is true;
  if personal_count > 0 then
    raise exception 'archive contains % personal (user-captured) row(s). Aborting before the '
                    'delete. No rows deleted.', personal_count;
  end if;

  -- Guard B2 — the one case where "seeded" and "captured" cannot be told apart. The predicate is
  -- `coalesce(is_personal, false) = false`, so a row with a NULL is_personal is archived and
  -- deleted, while guard B only ever looks for `is true`. The live table was measured on
  -- 2026-09-27 as exactly 400 false / 7 true / 0 null, so this guard costs nothing on the run it
  -- was written for. It exists for the run after that: a NULL means some write path that does not
  -- set the column has been at this table, and a row whose provenance is unknowable is not a row
  -- to delete on a predicate's say-so. Measured on the archive, like A, A2 and B, so a re-run is
  -- held to the same standard as a first run.
  select count(*) into unknown_count
  from public.recipes_archive_20260927 where is_personal is null;
  if unknown_count > 0 then
    raise exception 'archive holds % row(s) with a NULL is_personal. The predicate reads NULL as '
                    'non-personal, so these would be deleted with no evidence they belong to the '
                    'imported library. No rows deleted — decide what these rows are first.',
                    unknown_count;
  end if;

  -- 3 ── delete, guarded. Identical predicate to the archive insert above, asserted by
  --      scripts/recipe_deletion_check.mjs.
  --
  -- Guard D's before-count. Guard B only looks at the archive; nothing until now checked the live
  -- table. The predicate should make the delete incapable of touching a personal row — that is the
  -- whole safety argument — and this is the assertion that the argument held on the run that
  -- mattered. Counting here rather than in a follow-up query means a violation aborts the
  -- transaction instead of being noticed afterwards, by hand, from the file's own instructions.
  select count(*) into personal_live_before from public.recipes where is_personal is true;

  delete from public.recipes
  where coalesce(is_personal, false) = false;
  get diagnostics deleted_count = row_count;

  -- Guard D — a captured recipe must survive the delete, measured on the table the app actually
  -- reads. Cheap (one count on a few hundred rows) and it fails closed.
  select count(*) into personal_live_after from public.recipes where is_personal is true;
  if personal_live_after <> personal_live_before then
    raise exception 'public.recipes held % personal (user-captured) row(s) before the delete and % '
                    'after it. The predicate was supposed to make that impossible. Rolling back — '
                    'do not re-run this file until you know why.', personal_live_before,
                    personal_live_after;
  end if;

  -- Guard C — the delete must remove exactly the rows THIS APPLICATION archived, no more and no
  -- less. It also refuses one awkward case: a previously archived row that has reappeared in
  -- public.recipes. The insert skips it (already archived) while the delete still removes it, so
  -- the two counts disagree and the transaction rolls back for a human to look at, rather than
  -- quietly deleting it for a second time.
  if deleted_count <> archived_count then
    raise exception 'deleted % rows but this application archived % rows (the archive held % '
                    'before it ran). Rolling back.', deleted_count, archived_count, archived_before;
  end if;

  raise notice 'archived % new row(s) (archive now %), deleted % row(s) from public.recipes.',
               archived_count, archived_total, deleted_count;
end
$$;

-- The archive is not part of the product. Lock it down: RLS on with no policies, and no grants.
alter table public.recipes_archive_20260927 enable row level security;
revoke all on public.recipes_archive_20260927 from anon, authenticated;
comment on table public.recipes_archive_20260927 is
  'Rows removed from public.recipes by 20260927_archive_seeded_recipes.sql (the 400 bulk-imported '
  'Epicurious recipes). Restore with supabase/rollback/20260927_restore_seeded_recipes.sql.';

commit;

-- Verification to run immediately afterwards (read-only):
--
--   select count(*) from public.recipes;                        -- what the app now has
--   select count(*) from public.recipes_archive_20260927;       -- recoverable
--   select count(*) from public.recipes where is_personal is true;   -- captures, must be unchanged
--
-- If the count of `recipes` is not what you expected, roll back with the restore script rather
-- than reasoning about it.
