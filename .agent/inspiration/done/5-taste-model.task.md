---
id: task-15
title: Taste model - post-cook feedback feeding the week planner
model: sonnet
autonomous: true
priority: 5
depends_on: [task-10]
owns:
  - src/lib/cookFeedback.js
  - src/views/CookModeView.jsx
  - src/lib/weekPlanChat.js
  - .agent/features/FEATURE_taste_model.md
brief: TASK_15_taste_model.md
gate:
  - npm run build
---
The specification is `.agent/features/FEATURE_taste_model.md` — read it in full. Its four open
questions are now DECIDED by the owner (recorded in that file's DECISIONS section):

1. A 3-way rating (loved / fine / not again) plus an OPTIONAL free-text note. The rating is the
   only required tap; the note has no validation and is genuinely skippable.
2. Skippable in one tap, shown once, never nagged twice for the same meal.
3. Every cook stored as its own event row — never overwrite or average at write time.
4. The most recent ~20 entries fed into the week planner's prompt.

**PLUS a fifth decision the brief predates:** `cook_feedback` gets `household_id` and `member_id`
columns, both nullable, from the start. He is the only user today, but attribution is unrecoverable
retroactively, and it enables "suggest meals we both liked" once his wife is onboarded. Add them
even though nothing populates them yet.

Depends on `task-10` because both edit `src/views/CookModeView.jsx`. Do not start until task-10 is
in `done/`.

SUPABASE: this needs a new `cook_feedback` table. Use the Supabase MCP connection if available.
Enable RLS on it and run `get_advisors` afterwards to confirm clean. **Never alter or drop an
existing table** — this change is purely additive. If the MCP connection is unavailable, write the
migration SQL to `supabase/migrations/` instead, skip the live schema change, and say clearly in
AGENT_LOG.md that the table still needs creating by hand.

Acceptance criteria are in the brief. The one most likely to be got wrong: skipping the prompt must
write NO ROW at all, not a row with a null rating — a null must never be counted as negative signal.
