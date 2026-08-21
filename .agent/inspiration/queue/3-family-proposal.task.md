---
id: family-proposal
title: Write the family/household design proposal (document only, no code)
model: opus
autonomous: true
priority: 3
depends_on: []
owns:
  - .agent/features/FEATURE_family_households.md
brief: TASK_12_family_households.md
gate:
  - test -f .agent/features/FEATURE_family_households.md
---
**Write one markdown file. Touch no code whatsoever.** This task exists to turn the highest-value
item on the board from "needs a session with the owner" into "a proposal he can react to."

Read `TASK_12_family_households.md`, `TASK_07_plan_shop_to_supabase.md`, `.agent/PROJECT.md`,
`.agent/FEATURES.md` (including its brief template at the bottom), and the two archived briefs
`FEATURE_auth_accounts.md` and `FEATURE_profile_family_settings.md`.

Write `.agent/features/FEATURE_family_households.md` following the FEATURES.md template.

**You must not decide anything.** TASK_12 lists six open questions. For each one: lay out the
options, the real trade-offs, and your recommendation with reasoning — then mark it clearly as
**UNDECIDED — awaiting the owner**. He makes the call, not you. A proposal that quietly picks for
him is worse than no proposal, because he'd have to reverse-engineer what was assumed.

The model is: household (the family) → members (the adults) → all planning data scoped by
household_id. Use the word "members", never "child users" — that phrasing reads as a kids-profile
feature to anyone picking this up later.

Give particular care to:
- **The RLS rewrite.** The `recipes` table currently has unconditional `to public` policies. That
  is safe for one solo user and unsafe the moment a second family exists. Spell out the target
  policy for every table.
- **The migration** from TASK_07's device-held `household_id` (a bearer token in localStorage) to
  real Supabase Auth sessions, without data loss.
- **Onboarding a non-technical person** without pasting codes over WhatsApp.

Add the brief to the Active Briefs table in `.agent/FEATURES.md` — that is the one exception to
"touch no other file". Update the two archived briefs' status notes to point at it.

In `AGENT_LOG.md`, list the six questions plainly so he sees what needs deciding without opening
the brief.
