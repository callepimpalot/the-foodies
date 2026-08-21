# TASK 15 — Taste model (existing brief — what the research adds)

| | |
|---|---|
| **Feature it improves** | Cook → Plan (closes the loop) |
| **Impact** | ★★★☆☆ |
| **Effort** | L |
| **Horizon** | 🔵 LATER (but it's your only Active Brief — it's closer than the others) |
| **Family-readiness** | ⚠️ **The report changes nothing here. Your family plan changes a lot** |

---

## THIS ONE ALREADY HAS A BRIEF

`.agent/features/FEATURE_taste_model.md` exists, is well-scoped, and is the **only** entry in
FEATURES.md's Active Briefs table. It already covers: a feedback prompt at the end of Cook Mode, a
`cook_feedback` event table, and feeding a digest into `weekPlanChat.js`. It has four open questions
with recommendations attached.

**This file is not a replacement for that brief.** It records what the competitive research adds, and
one thing the brief couldn't have anticipated.

## WHAT THE RESEARCH ADDS

Honestly: **less than you'd hope.**

- **`[report only]`** The closest competitor parallel is **Peel's "Suggested Plans"**, which
  *"analyses the user's historical cooking patterns to proactively suggest templates based on past
  behavior, rather than forcing manual creation or relying on static presets."* That validates the
  brief's core premise — behavioural history beating static preference settings — but adds no
  mechanism the brief doesn't already have.
- **`[report only]`** **DishBinder** logs meals via a photo of the plate. Interesting friction
  reduction, but it's aimed at macro tracking, which you've deliberately not built.
- **`[report only]`** The report's own "personalization" ideas are mostly dietary-constraint
  adaptation (keto/vegan substitution), which is a *different* feature — rewriting recipes to fit
  rules, not learning what you like.

**Verdict: your existing brief is ahead of the report on this feature.** Its "store every event
separately, pass raw feedback to the model, don't build a summarizer yet" reasoning is better than
anything the report proposes. No changes recommended from the research.

## ⚠️ WHAT THE BRIEF *DOESN'T* ACCOUNT FOR — the family plan

The brief was written Aug 15, before you described onboarding your wife. That materially changes
open question 3.

`cook_feedback` as specified has **no member attribution**:

```sql
create table public.cook_feedback (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references public.recipes(id) on delete cascade,
  rating text not null,
  note text,
  cooked_at timestamptz not null default now()
);
```

With two people this becomes ambiguous in a way that actively degrades the feature:

- You rate a dish `loved`, your wife rates it `not_again`. The AI sees contradictory signal on the
  same recipe and has no way to reconcile it — so it either flip-flops or averages into mush.
- *"Too spicy for the kids"* and *"needs more heat"* are both true, from different people. Fed to the
  model without attribution, they cancel out.
- The Week Planner can't do the genuinely useful thing: **find meals you both like.**

**Recommendation:** add `household_id` and `member_id` to `cook_feedback` from the start, even while
you're the only user. Two nullable columns cost nothing now and prevent a migration over data whose
attribution is unrecoverable after the fact — once a year of unattributed ratings exists, you can
never work out who gave them.

This also upgrades the feature: *"suggest meals where both of us rated it well"* is a better product
than *"suggest meals that were rated well"*, and it's only possible if you capture attribution from
day one.

## ALSO WORTH RECONSIDERING

- **Open question 4** (how much history to feed the prompt): with two raters, ~20 entries becomes ~10
  per person, which is thin. Consider scoping the window per-member rather than globally.
- **The brief's Cook Mode timing is right**, and it pairs naturally with
  [TASK_02](TASK_02_cook_mode_wake_lock.md) — if you're already touching `CookModeView` for wake lock,
  the finish-flow change lands in the same file.

## WHY IT'S STILL LATER, NOT NOW

- It needs cooking history to be worth anything. On day one it does literally nothing, and it can't
  demonstrate value until you've cooked and rated a dozen meals.
- Its consumer is `weekPlanChat.js`, which was verified working only on Aug 21 — very recent. Let the
  planner settle before changing what feeds it.
- The four open questions need your decisions first, exactly as the brief says.

## THE ACTUAL NEXT STEP

Not "build it." It's: **answer the brief's four open questions, plus the attribution question above**,
and update the brief. That's a short conversation, not a session.

## ▶ CLAUDE CODE PROMPT

```
Read .agent/features/FEATURE_taste_model.md in full, then
.agent/inspiration/TASK_15_taste_model.md, then CLAUDE.md and
.agent/DATA_MODELS.md.

Do NOT implement anything yet. The brief has four open questions that need my
decisions first.

Ask me the brief's four open questions one at a time, with your recommendation for
each, and wait for my answer. Do not guess or assume.

Then ask a fifth question the brief predates: I plan to add my wife as a second user
in the same household soon. The cook_feedback table as specified has no member
attribution, so two people's contradictory ratings on the same recipe would be
indistinguishable, and "too spicy for the kids" vs "needs more heat" would cancel
out. Should we add household_id and member_id columns now, nullable, even though I'm
currently the only user?

Explain the trade-off honestly: two nullable columns cost nothing today, and
attribution is unrecoverable retroactively - once there's a year of unattributed
ratings you can never work out who gave them. It also enables "suggest meals we BOTH
liked", which is a better feature than "suggest meals that were liked".

Record all my answers in FEATURE_taste_model.md, update the suggested data model and
acceptance criteria to match, and mark the open questions resolved with the date.

Do not write application code in this session.
```

## DECIDE

- [ ] **Answer the open questions** (recommended next step — a conversation, not a build)
- [ ] **Build it** as briefed, with attribution columns added
- [ ] **Leave it** until there's cooking history to learn from
