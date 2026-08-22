-- RECORD, NOT THE ORIGINAL. The cook_feedback table was applied to the live database
-- earlier on 2026-08-22 (Supabase migration history: 20260822163401_create_cook_feedback
-- and 20260822163417_index_cook_feedback_recipe_id), before the run that wrote this file,
-- and no migration file existed in the repo for it.
--
-- The statements below were reconstructed from the live schema and verified against it
-- column by column on 2026-08-22: 7 columns, RLS enabled, 2 policies, household_id and
-- member_id both nullable, rating NOT NULL. Written idempotently, so re-running is safe
-- and a fresh environment can be built from the repo alone.
--
-- Spec: .agent/features/FEATURE_taste_model.md (TASK_15).

create table if not exists public.cook_feedback (
  id           uuid primary key default gen_random_uuid(),
  recipe_id    uuid references public.recipes(id) on delete cascade,
  -- A small enum, not a 1-5 scale: it keeps prompt-building simple and it is the
  -- decision the owner made. NOT NULL is load-bearing — skipping the prompt must write
  -- no row at all, never a row with a null rating that later reads as negative signal.
  rating       text not null check (rating in ('loved', 'fine', 'not_again')),
  note         text,
  cooked_at    timestamptz not null default now(),
  -- Nullable and unpopulated today. They exist from the start because attribution
  -- cannot be recovered retroactively, and "suggest meals we BOTH liked" needs them
  -- once a second adult is onboarded. See .agent/features/FEATURE_family_households.md.
  household_id uuid,
  member_id    uuid
);

create index if not exists cook_feedback_recipe_id_idx
  on public.cook_feedback (recipe_id);

alter table public.cook_feedback enable row level security;

-- Matches the rest of this solo-use app. FEATURE_family_households.md specifies the
-- membership-scoped replacements for when a second household exists; until then these
-- are the same posture as the recipes table.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cook_feedback'
      and policyname = 'Allow public read access'
  ) then
    create policy "Allow public read access" on public.cook_feedback
      for select to public using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cook_feedback'
      and policyname = 'Allow public inserts'
  ) then
    create policy "Allow public inserts" on public.cook_feedback
      for insert to public with check (true);
  end if;
end $$;

-- No UPDATE or DELETE policy by design: feedback is write-once. Correcting a rating
-- means cooking it again and rating it again, which is also more honest data.
