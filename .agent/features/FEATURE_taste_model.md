# FEATURE BRIEF: Taste Model — Post-Meal Feedback Feeding AI Suggestions
# Purpose: Make the app's AI features actually know the user as a cook, not just react to whatever's typed in that moment
# Audience: Next session
# Status: NOT STARTED — brief written Aug 15, 2026, at user's request to make AI "more embedded in the general features"

---

## THE ASK, IN THE USER'S WORDS

"The AI needs to be more embedded in the general features... it needs to understand me as a cook and use the app, so ratings and feedback after meals, so when it suggests meals for the week it knows me." This is the "Taste model" line that's been sitting in PROJECT.md's Deferred/Vault list since the Feb 27 pivot — the user is now asking to promote it to an active brief.

---

## WHERE AI ALREADY LIVES IN THIS APP (context, not new work)

Worth naming so the gap is clear — AI is already embedded in two places:
- **Capture** (`recipeExtraction.js`): extracts a structured recipe from text/photos, then a "sparring" refine-chat lets the user negotiate it before saving.
- **AI Week Planner Chat** (`weekPlanChat.js`, built Aug 15, pending live verification — see `FEATURE_ai_week_planner_chat.md`): proposes a full week of meals from a natural-language constraint, mixing library recipes and freshly-generated ones, negotiated the same "sparring" way.

Both are stateless per-conversation — they know nothing about the user beyond what's typed in that exact message. Every one of the AI Week Planner Chat's proposals starts from zero. That's the actual gap: **the app has no memory of what the user has cooked, liked, or hated**, so "knows me" is currently impossible no matter how good the prompt is.

Two other places AI *could* eventually help but are explicitly **out of scope for this brief** (don't build now, just noting for future briefs): Shop (ingredient substitution suggestions), Home (proactive "you haven't made X in a while" surfacing). Keep this brief scoped to the feedback-capture + Week-Planner-Chat-uses-it loop — that's the smallest version that actually closes the "it knows me" gap the user described.

---

## WHAT WE ARE BUILDING

1. **A way to rate/leave feedback on a meal after cooking it.** The natural moment is the end of Cook Mode — "Finish Cooking" currently just navigates back to the Dashboard with nothing captured. That's the one and only capture point for v1 (rating a recipe you *didn't* cook via the app, e.g. from the Recipes tab browsing, is out of scope — keeps this from sprawling into a second feedback surface).
2. **A persistent history of that feedback**, separate from the `recipes` table itself (a recipe can be cooked many times with different outcomes each time — this is event history, not a mutation of the recipe row).
3. **Feeding a compact digest of that history into the AI Week Planner Chat's prompt** so its suggestions actually reflect what the user has liked and disliked, not just the stated constraint in that one message.

## WHAT WE ARE DELIBERATELY NOT BUILDING (v1 scope guard)

- No separate "taste profile" object that some background job periodically summarizes from raw feedback into structured preferences (favorite cuisines, spice tolerance, etc.). That's a real thing worth doing eventually, but it's a second AI call, a new sync/staleness problem, and there isn't enough feedback data yet after zero meals cooked to make a summarizer worth building. v1 just passes recent raw feedback (rating + note + recipe title/tags) directly into the Week Planner Chat's prompt as context — the same "give the model the data, let it reason" pattern already used for the library shortlist in that feature. Revisit a structured profile once there's a few months of real history to justify it.
- No feedback surface outside Cook Mode's finish flow.
- No changes to Capture or the recipe extraction/refine prompts — this brief is about planning suggestions specifically, since that's what the user described ("when it suggests meals for the week").

## OPEN QUESTIONS — DECIDE THESE FIRST

1. **What does the feedback prompt actually ask?** Options, not mutually exclusive:
   - A simple rating (👍/👎, or 1–5 stars, or a 3-way "loved it / it was fine / not again") — fast, always-answerable, good raw signal for "would I plan this again."
   - Free-text notes ("too salty," "kids didn't like the mushrooms," "great, double it next time") — richer, directly quotable by the AI, but easy to skip if it feels like a chore.
   - Recommendation: both, but make the rating the only required tap and the note field genuinely optional (placeholder text, no validation) — matches the "quick" feel of the rest of this app (Household Essentials is explicitly "no confirmation, single tap" elsewhere in the codebase; this should feel similarly light).
2. **Is the prompt mandatory or skippable?** Given this is a solo dad cooking on a weeknight, a mandatory modal blocking "Finish Cooking" would get annoying fast and train the user to dismiss it without thinking, which produces bad data. Recommendation: show it once, make skipping one tap away, never nag about a specific meal twice.
3. **Does feedback attach to the specific plan-day/leftover event, or just the recipe in general?** E.g. if "Grilled Chicken Tacos" is cooked three times over two months with three different ratings, does the AI see three separate data points (better signal, e.g. "usually liked, one bad night") or just the latest/an average (simpler)? Recommendation: store every event separately (it's cheap, one row each) — let the prompt-building logic decide later how to condense them, rather than losing information at write time.
4. **How far back / how much history gets fed into the Week Planner Chat prompt?** All of it is likely wasteful once history grows past a few dozen entries. Recommendation: most recent ~20 feedback entries, or last 90 days, whichever is smaller — revisit once real usage shows what's actually useful.

## SUGGESTED DATA MODEL

New Supabase table — separate from `recipes`, since this is event history, not a recipe field:

```sql
create table public.cook_feedback (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references public.recipes(id) on delete cascade,
  rating text not null,              -- e.g. 'loved' | 'fine' | 'not_again' — keep it a small enum, not a 1-5 scale, to keep AI prompt-building simple
  note text,                         -- optional free text
  cooked_at timestamptz not null default now()
);

alter table public.cook_feedback enable row level security;
create policy "Allow public read access" on public.cook_feedback for select to public using (true);
create policy "Allow public inserts" on public.cook_feedback for insert to public with check (true);
```

No UPDATE/DELETE policy needed for v1 — feedback is write-once (if the user wants to correct a mistaken rating, re-cooking and re-rating is fine; don't build an edit UI for this yet).

## SUGGESTED SHAPE

- **Cook Mode**: after "Finish Cooking" is tapped on the last step, replace the immediate navigate-to-Dashboard with a lightweight feedback sheet (rating buttons + optional note field + a visible "Skip" that's just as easy to tap as rating). Whatever happens, then navigate to Dashboard as before.
- **New `src/lib/cookFeedback.js`**: `saveFeedback(recipeId, rating, note)` — a plain insert into `cook_feedback`, following the same error-handling shape as `saveRecipe.js`/`recipeExtraction.js` (friendly messages, not raw Supabase errors).
- **AI Week Planner Chat prompt update** (`src/lib/weekPlanChat.js`): alongside the existing condensed library shortlist, pass a condensed feedback digest — `{recipe_title, rating, note, cooked_at}` for the most recent ~20 entries (see open question 4) — and add explicit prompt instructions: prefer `loved` recipes when they fit the stated constraints, avoid suggesting `not_again` recipes unless the user explicitly asks for them again, and use notes as real signal (e.g. a note saying "too spicy for the kids" should discourage suggesting similarly spicy dishes without the user having to restate that every single week).

## ACCEPTANCE CRITERIA

- [ ] Finishing a cook session shows a feedback prompt (rating + optional note), skippable in one tap
- [ ] Rating a meal writes a row to `cook_feedback` linked to the correct recipe
- [ ] Skipping writes nothing (not a silent "no rating" row — literally no row, so it doesn't get counted as negative signal)
- [ ] The AI Week Planner Chat's proposals visibly change based on feedback history — e.g. after marking a dish `not_again`, asking for "something like [that dish]" doesn't just re-suggest it
- [ ] A recipe cooked and rated multiple times contributes multiple entries, not just the latest
- [ ] No feedback prompt appears for recipes viewed but never cooked (Recipes tab browsing, Add to Plan without cooking, etc.)
