# FEATURE BRIEF: AI Week Planner Chat
# Purpose: Plan a whole week of meals via natural-language conversation instead of tapping days one at a time
# Audience: Next session
# Status: SHIPPED & VERIFIED LIVE — requirements captured Aug 6, 2026; built and verified by the user in their own browser Aug 15, 2026 (this session's Browser pane could never reach the user's local dev server — an environment networking limitation, not a code issue — so all verification happened via the user testing directly and reporting back). Extended past the original scope with three rounds of user feedback during testing — see FILE STRUCTURE below for the full final shape.

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

## FILE STRUCTURE (final, as shipped Aug 15, 2026)

- `src/lib/recipeExtraction.js` — `RECIPE_SCHEMA`, `cleanJson`, `describeApiError` exported for reuse (were module-private). Also gained a `creator` field this session (unrelated feature, see FEATURES.md's Recipe Library entry).
- `src/lib/saveRecipe.js` — **new.** `saveRecipe(draft, dishPhotoFile)` extracted out of `useRecipeCapture.js`'s old inline insert logic, so Capture and the week planner's "generated" days share one save path.
- `src/hooks/useRecipeCapture.js` — refactored to call `saveRecipe()` instead of duplicating the insert.
- `src/lib/weekPlanChat.js` — **new.** `planWeek({ instruction, scopeDates, currentProposal, libraryShortlist })`, the Gemini call, plus `addDaysToDateStr()` (timezone-safe date-string arithmetic). Prompt explicitly distinguishes a first turn (may narrow to a stated date range) from a follow-up turn (the date set already in `currentProposal` is fixed — a follow-up mentioning one day must not collapse the rest of the response, a real bug hit during testing).
- `src/hooks/useWeekPlanChat.js` — **new.** Proposal state and every mutation: `send()`/`sendSingleDay()` (Gemini calls — locked-day content is never trusted from the model's response, only ever carried over from before the turn, regardless of what the model echoes back), `toggleLock()`, `swapDays()`, `setLeftoverSource()`, `setDayAsLibraryRecipe/Leftover/Note()` (manual single-day edits), `setDayRecipeCustomization()` (commits an inspected/refined recipe + servings onto one day and locks it), `addDay()`/`nextAddableDate`, `reset()`.
- `src/components/WeekPlanChat.jsx` — **new.** The chat UI: overwrite-warning gate, chat log, day-row list, composer, "Apply to Plan." Each day row: source badge (Library/New idea), a tap-to-swap grip handle (see note below), a lock toggle, and a dashed "Add a day" row to extend past the initial 7-day window. Tapping a `recipe` day opens `RecipeDaySheet`; tapping an `empty` day opens the in-file `DayEditSheet` (library pick / leftovers / single-day AI chat / note — mirrors `DayActionSheet.jsx`'s manual-calendar sheet).
- `src/components/RecipeDaySheet.jsx` — **new.** Inspect a day's actual recipe before committing: servings stepper, live-scaled ingredients, steps, and a refine-chat (reuses `refineRecipe()`) to substitute ingredients etc. "Lock In This Day" never touches the shared library recipe — it's a per-day, per-week-only copy, embedded by value into that day's proposal entry exactly like `PlanContext` already does for the real plan.
- `src/views/PlanView.jsx` — "Manual" / "Chat Plan" pill toggle in the header; renders `WeekPlanChat` in place of `WeeklyCalendar` in chat mode; "Lock This Week" / "Plan Locked" buttons only show in manual mode.

### Notable bugs hit and fixed during live testing
- **Locked-day content wasn't actually protected** — only the `locked` boolean was forced back client-side; the model's returned content for that date was still trusted. Fixed by carrying over the entire pre-turn day object for any locked date, never just patching the flag.
- **A follow-up mentioning one day collapsed the whole week** — the "narrow to a stated date range" rule (meant only for the first message) was being applied on every turn. Fixed with an explicit first-turn-vs-follow-up prompt distinction, plus a client-side guarantee that a follow-up's date set can never shrink from what it was before that turn.
- **Drag-and-drop didn't work on touch** — first attempt used the HTML5 Drag and Drop API, which is mouse-only and unsupported on iOS. Replaced with a tap-to-pick-up/tap-to-swap interaction (plain `onClick`, no gesture tracking).
- **The tap-to-swap "worked" on the first tap but never actually swapped** — `swapDays()` (a side effect) was called from inside a `setState` updater function; React.StrictMode (`main.jsx`) double-invokes updaters in dev to catch impurity, so it silently swapped then swapped back. Fixed by reading state directly instead of via the updater.

## ACCEPTANCE CRITERIA

- [x] User can enter chat mode from the Plan tab and describe a week (or a stated sub-range) in one message
- [x] AI proposes days matching the stated constraints (meal count, leftover days, specific dish themes), covering only the dates in scope
- [x] Each recipe suggestion is clearly labeled as "Library" or "New idea" (source badge)
- [x] Each proposed day can be individually locked
- [x] Follow-up messages only change unlocked days
- [x] Locked days persist across multiple follow-up turns
- [x] Entering chat mode with an already-partially-planned week shows a warning before the composer appears
- [x] Applying the finalized week correctly writes to PlanContext (including saving `generated` days as real recipes first) and is immediately visible in the manual calendar view
- [x] Applying only writes days that were actually in scope for that session — days outside a stated sub-range are left untouched
- [x] (added during testing) Days can be reordered via tap-to-swap; the proposal can be extended past 7 days; an empty day can be filled via library pick, leftover pick, a single-day AI chat, or a note; a recipe day can be inspected, have servings adjusted and ingredients substituted via chat, and locked in per-day without touching the shared library recipe
