# FEATURE BRIEF: AI Week Planner Chat
# Purpose: Plan a whole week of meals via natural-language conversation instead of tapping days one at a time
# Audience: Next session
# Status: NOT STARTED — requirements captured Aug 6, 2026, not yet designed in detail

---

## WHAT WE ARE BUILDING

A second mode inside the Plan tab, alongside the existing tap-a-day manual calendar. In this mode, the user describes what they want in one message — e.g. *"I need 3 meals for next week, 2 leftover days, one dish with minced beef, one with chicken, one vegan"* — and the AI proposes a full week: which days get which dish, which days are leftovers of which other day. The user can then **lock** individual day-suggestions they like and ask the AI to change the rest, going back and forth (same spirit as the "sparring" refine-chat already built for Capture) until the whole week is right, then apply it to the actual plan.

## WHY THIS MATTERS

The user's own words: this is exactly how they already use a general-purpose LLM today — describe constraints once, get a full week back, negotiate specific slots. Doing it inside the app means the result can be applied directly to the real plan (and from there, Shop and Cook) instead of being copy-pasted in from somewhere else.

## PRIOR ART TO REUSE — DON'T REBUILD FROM SCRATCH

The Capture feature's refine-chat (`src/hooks/useRecipeCapture.js`'s `refine()`, `src/lib/recipeExtraction.js`'s `refineRecipe()`) already implements the core interaction pattern this needs: send the current state + a natural-language instruction to Gemini with a `responseSchema`, get back an updated state plus a one-line human summary, append to a visible chat log, repeat. The week-planner chat is the same pattern at a different granularity (a week of day-assignments instead of one recipe's fields) plus the new "lock" concept, which `refineRecipe` doesn't have yet — a locked day's assignment needs to be explicitly excluded from what the AI is allowed to change on the next turn.

## OPEN QUESTIONS — DECIDE THESE FIRST, BEFORE WRITING CODE

1. **Where do suggested dishes come from?** Two real options:
   - (a) The AI picks from the user's existing recipe library (400 base recipes + their own captured ones) — matches by dish type/protein/diet. Pro: instantly plannable, no extra save step. Con: limited to what's already in the library; "minced beef" or "vegan" filtering has to be inferred from tags/ingredients that may not be reliably tagged today.
   - (b) The AI invents fresh dish ideas not yet in the library, and only becomes a real `Recipe` (via the Capture save pipeline) once the user finalizes the week. Pro: matches "what would you cook" the way a general LLM chat does. Con: more moving parts — a suggested dish needs a lightweight preview shape before it's a full structured recipe, and applying the plan means capturing N new recipes, not just placing existing ones.
   - Recommendation: start with (a) — search/filter the existing library by the conversation's stated constraints — since it's a much smaller build and the library already has 400+ recipes to draw from. (b) can be a fast-follow once (a) is proven.
2. **How does "lock" interact with leftover-days and notes?** The current one-meal-per-day model (`src/context/PlanContext.jsx`) already supports `{recipe, servings}` | `{leftoverOfDate}` | `{note}` per day. A locked day in the chat-planner should presumably map to one of these three, excluded from the next AI turn's proposal — worth explicitly deciding whether notes/leftovers can be part of what the AI proposes itself (e.g. "leftovers Tuesday" from a stated constraint) or whether those stay manual-only for now.
3. **Does the chat see what's already on the calendar?** If the user has already manually planned Monday before entering chat mode, should the AI treat that as fixed context (like an auto-lock) or does entering chat mode imply planning a fresh week that may overwrite existing entries? Needs an explicit answer before the first version ships, since silently overwriting a manually-placed meal would be a bad surprise.
4. **How many days does one chat session plan?** Always the visible 7-day window, or does the user state a range in chat too ("just plan Tue–Thu")?

## SUGGESTED SHAPE (subject to the open questions above)

- New toggle in `PlanView.jsx` header: "Manual" / "Chat Plan" (or similar).
- Chat mode renders a conversation: user's initial constraint message → AI's proposed week (a compact 7-row list: day, dish/leftover/note, a lock toggle per row) → user follow-up messages that adjust unlocked rows → repeat → an explicit "Apply to Plan" action that writes the finalized week into `PlanContext` via `setDayRecipe`/`setDayLeftover`/`setDayNote`, one call per day.
- New Gemini call in `src/lib/` (new file, e.g. `weekPlanChat.js`) mirroring `recipeExtraction.js`'s pattern: a schema for `{ days: [{ date, type: 'recipe'|'leftover'|'note', recipeId?, sourceDate?, note?, locked }] }`, a prompt that receives the conversation instruction + the current proposal + which rows are locked + (pending open question #1) either the searchable recipe library or freeform generation instructions.

## ACCEPTANCE CRITERIA (draft — refine once the open questions are settled)

- [ ] User can enter chat mode from the Plan tab and describe a week in one message
- [ ] AI proposes a full week matching the stated constraints (meal count, leftover days, specific dish themes)
- [ ] Each proposed day can be individually locked
- [ ] Follow-up messages only change unlocked days
- [ ] Locked days persist across multiple follow-up turns
- [ ] Applying the finalized week correctly writes to PlanContext and is immediately visible in the manual calendar view
- [ ] Does not silently clobber days the user had already manually planned before entering chat mode (per open question #3's resolution)
