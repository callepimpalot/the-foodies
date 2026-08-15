# FEATURE BRIEF: AI Week Planner Chat
# Purpose: Plan a whole week of meals via natural-language conversation instead of tapping days one at a time
# Audience: Next session
# Status: NOT STARTED — requirements captured Aug 6, 2026; open questions resolved Aug 15, 2026 — ready to design/build

---

## WHAT WE ARE BUILDING

A second mode inside the Plan tab, alongside the existing tap-a-day manual calendar. In this mode, the user describes what they want in one message — e.g. *"I need 3 meals for next week, 2 leftover days, one dish with minced beef, one with chicken, one vegan"* — and the AI proposes a full week: which days get which dish, which days are leftovers of which other day. The user can then **lock** individual day-suggestions they like and ask the AI to change the rest, going back and forth (same spirit as the "sparring" refine-chat already built for Capture) until the whole week is right, then apply it to the actual plan.

## WHY THIS MATTERS

The user's own words: this is exactly how they already use a general-purpose LLM today — describe constraints once, get a full week back, negotiate specific slots. Doing it inside the app means the result can be applied directly to the real plan (and from there, Shop and Cook) instead of being copy-pasted in from somewhere else.

## PRIOR ART TO REUSE — DON'T REBUILD FROM SCRATCH

The Capture feature's refine-chat (`src/hooks/useRecipeCapture.js`'s `refine()`, `src/lib/recipeExtraction.js`'s `refineRecipe()`) already implements the core interaction pattern this needs: send the current state + a natural-language instruction to Gemini with a `responseSchema`, get back an updated state plus a one-line human summary, append to a visible chat log, repeat. The week-planner chat is the same pattern at a different granularity (a week of day-assignments instead of one recipe's fields) plus the new "lock" concept, which `refineRecipe` doesn't have yet — a locked day's assignment needs to be explicitly excluded from what the AI is allowed to change on the next turn.

## OPEN QUESTIONS — RESOLVED Aug 15, 2026

1. **Where do suggested dishes come from?** **Decision: hybrid, tagged by source.** The AI can suggest either an existing library recipe (`source: 'library'`) or an AI-invented dish not yet in the library (`source: 'generated'`), and every suggested day is visibly labeled with which kind it is — the user should always be able to tell "from your library" from "new idea" at a glance in the chat UI.
   - `library` suggestions: matched from the existing recipe set (400 base + user-captured) by the conversation's stated constraints, placed via a `recipeId` referencing a real `Recipe` already in Supabase/local fallback. Placeable immediately, no extra save step.
   - `generated` suggestions: the AI produces a full recipe draft in the same shape `recipeExtraction.js`'s `RECIPE_SCHEMA` already extracts to (title, description, cook_time_minutes, difficulty, kcal, base_servings, meal_type, ingredients, steps) — but it is **not** written to Supabase until the week is applied. On "Apply to Plan," each `generated` day gets saved via the same insert path `useRecipeCapture.js`'s `save()` uses (`is_personal: true`), then placed like any other recipe day. Reuse that save logic rather than duplicating it.
   - Build note: passing all 400+ full recipes to Gemini per turn is likely too large — plan to pass a condensed shortlist (`{id, title, meal_type, tags, kcal, difficulty}` per row, not full ingredients/steps) so the model can match against the library without blowing up the prompt.
2. **How does "lock" interact with leftover-days and notes?** **Decision: the AI can propose all three day-types** — recipe (library or generated), leftover-of-another-day, and free-text note — each independently lockable per row. A stated constraint like "2 leftover days" should turn into actual `leftoverOfDate` rows in the AI's proposal, not just a note for the user to resolve manually later.
3. **Does the chat see what's already on the calendar?** **Decision: fresh week, ask first.** Entering chat mode does not auto-lock existing manually-planned days as context. Instead, if the visible week already has any entries when chat mode is opened, show an explicit warning ("this may replace what's already planned") before starting the conversation. Nothing in `PlanContext` is touched until "Apply to Plan" is pressed, and only for the day-range actually covered by the finalized proposal (see Q4) — a day outside that range, planned or not, is left alone.
4. **How many days does one chat session plan?** **Decision: user can state a range in chat** (e.g. "just plan Tue–Thu"), defaulting to the full visible 7-day window if no range is stated. The proposal schema should carry its own list of dates rather than assuming all 7, so a partial-week proposal is a first-class result, not a special case.

## SUGGESTED SHAPE

- New toggle in `PlanView.jsx` header: "Manual" / "Chat Plan" (or similar).
- Opening Chat Plan mode: if any day in the visible week already has an entry in `weeklyPlan`, show a warning ("this may replace what's already planned for the week") before the composer appears.
- Chat mode renders a conversation: user's initial constraint message (may state a date range, e.g. "just Tue–Thu") → AI's proposed week (a compact row-per-day list covering only the dates in scope: day, dish/leftover/note, a **source badge** — "Library" or "New idea" — on recipe rows, a lock toggle per row) → user follow-up messages that adjust unlocked rows only → repeat → an explicit "Apply to Plan" action.
- Apply step: for each finalized day, `source: 'library'` rows call `setDayRecipe(date, recipe)` directly; `source: 'generated'` rows are first saved as a real `Recipe` via the same insert logic as `useRecipeCapture.js`'s `save()` (`is_personal: true`), then placed with `setDayRecipe`; `leftover` rows call `setDayLeftover`; `note` rows call `setDayNote`. One call per day, only for days in scope.
- New Gemini call in `src/lib/` (new file, e.g. `weekPlanChat.js`) mirroring `recipeExtraction.js`'s pattern: a schema for
  ```
  {
    days: [{
      date, type: 'recipe' | 'leftover' | 'note', locked,
      source?: 'library' | 'generated',        // when type === 'recipe'
      recipeId?: string,                        // when source === 'library'
      recipe?: { title, description, cook_time_minutes, difficulty, kcal, base_servings, meal_type, ingredients, steps }, // when source === 'generated'
      sourceDate?: string,                      // when type === 'leftover'
      note?: string,                            // when type === 'note'
    }],
    summary: string
  }
  ```
  A prompt that receives the conversation instruction + the current proposal + which rows are locked (excluded from change) + a condensed searchable library shortlist (`{id, title, meal_type, tags, kcal, difficulty}` per row — not the full 400 recipes with ingredients/steps, to keep the prompt small) + instructions for when to invent a `generated` dish instead of matching one.

## ACCEPTANCE CRITERIA

- [ ] User can enter chat mode from the Plan tab and describe a week (or a stated sub-range) in one message
- [ ] AI proposes days matching the stated constraints (meal count, leftover days, specific dish themes), covering only the dates in scope
- [ ] Each recipe suggestion is clearly labeled as "Library" or "New idea" (source badge)
- [ ] Each proposed day can be individually locked
- [ ] Follow-up messages only change unlocked days
- [ ] Locked days persist across multiple follow-up turns
- [ ] Entering chat mode with an already-partially-planned week shows a warning before the composer appears
- [ ] Applying the finalized week correctly writes to PlanContext (including saving `generated` days as real recipes first) and is immediately visible in the manual calendar view
- [ ] Applying only writes days that were actually in scope for that session — days outside a stated sub-range are left untouched
