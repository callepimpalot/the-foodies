# TASK 10 — Per-step ingredients in Cook Mode

| | |
|---|---|
| **Feature it improves** | Cook |
| **Impact** | ★★★☆☆ |
| **Effort** | M |
| **Horizon** | 🟡 NEXT |
| **Family-readiness** | ✅ No implications |

---

## THE GAP

`CookModeView.jsx` shows the step list and a full ingredient list with a servings stepper. What it
can't do is tell you **which ingredients this step needs**.

So mid-recipe you're reading *"add the aromatics and cook until softened"* while scanning a list of
14 ingredients to work out which ones are the aromatics and how much of each. That's the moment the
app should be carrying the load and currently isn't.

This is a real gap, but it's honestly **second in line behind [TASK_02](TASK_02_cook_mode_wake_lock.md)**
— a screen that blacks out mid-step is a bigger problem than a step that doesn't scope its
ingredients. Do 02 first.

## WHAT THE BEST DO

- **`[report only]`** The report's `<StepByStepCookMode />` spec: *"Splits the screen: top half
  displays the current active step in massive typography, bottom half displays the specific
  ingredients required only for that step."*
- **`[report only]`** Its data model supports this directly — `recipes.instructions` is stored as
  *"an array of step objects, allowing attachment of specific ingredient IDs to specific steps."*
  That's the enabling design decision, and it's a good one.
- **`[report only]`** Note what it implies: **this is a capture-time problem, not a cook-time
  problem.** You can't reliably infer step↔ingredient links at render time. Either they're captured
  when the recipe is created, or you're guessing.

## THE GAP IN YOUR DATA (the real blocker)

Your `steps` column is `text[]` — plain strings (DATA_MODELS §1). There is **no link** between a step
and the ingredients it uses, and no field to put one in. Any implementation has to solve that first.

Three options, cheapest to best:

| Option | How | Cost | Quality |
|---|---|---|---|
| **A. Runtime string match** | Match ingredient names against the step text | Free, works on all 400 existing recipes | Fair. Misses "the aromatics", "the sauce", "reserved liquid" |
| **B. Capture-time linking** | Extend the Gemini schema to emit `ingredientIndexes` per step | One prompt change | Good. **Only applies to newly captured recipes** |
| **C. Backfill** | One-off Gemini pass over the 400 imported recipes | A batch script + API cost | Good everywhere, but a real migration |

**Recommendation: A now, B alongside it, C only if A proves annoying.** A gives you something on
every recipe immediately; B quietly improves quality going forward; the two compose — prefer stored
links, fall back to string matching.

## THE CHANGE

1. `src/lib/stepIngredients.js` — `ingredientsForStep(step, ingredients)`:
   - if the step object carries explicit indexes, use them
   - otherwise match canonicalised ingredient names against the step text
   - **reuse `canonicalName()` from TASK_03** if it exists (`chicken breasts` in the list vs
     `chicken` in the step won't match raw)
2. Cook Mode renders the matched ingredients under the active step, with **live-scaled quantities**
   from the existing servings stepper.
3. Keep the full ingredient list reachable — a toggle or a section below. Never remove it.
4. Extend the capture schema in `recipeExtraction.js` to emit per-step ingredient indexes for new
   captures.

## WHY DESIGNED THIS WAY

- **Why not option C (backfill) first?** 400 Gemini calls, real cost, and a migration you'd have to
  verify. Do it only if A's misses genuinely irritate you in practice — you may find string matching
  covers most real recipes.
- **Why keep the full list visible?** Because per-step scoping is an *assist*, not a replacement. If
  the match is wrong or incomplete, hiding the full list turns a small miss into being unable to cook
  the recipe. Additive, never subtractive — that's the rule for any inferred feature.
- **Why not the report's "massive typography, split screen" literally?** Because your design system
  has a defined type scale and a specific point of view (`DESIGN_SYSTEM.md` §3), and Cook Mode
  already has a working layout with a timer and stepper. Take the *idea* (scope ingredients to the
  step), not the report's generic layout prescription.
- **Why bias toward showing too many rather than too few?** A missing ingredient means you don't put
  it in. An extra one is a glance. Asymmetric costs — tune the matcher to over-include.

## ACCEPTANCE CRITERIA

- [ ] Step mentioning `onion` and `garlic` surfaces exactly those, with quantities
- [ ] Quantities respect the servings stepper live
- [ ] Steps with no detectable ingredients ("preheat the oven to 200°C") show nothing — not an empty
      box, not "no ingredients"
- [ ] Full ingredient list still reachable at all times
- [ ] Plural/singular and prep-word variations match (`breasts`/`breast`, `diced onion`/`onion`)
- [ ] Both ingredient shapes handled (`normalizeIngredient()`)
- [ ] Newly captured recipes store per-step links; existing recipes fall back to matching
- [ ] No regression to the timer or servings stepper

## RISKS / EDGE CASES

- **Substring false positives:** `salt` matches inside `salted butter`; `oil` inside `olive oil`.
  Match on word boundaries, not bare `includes()`.
- Steps referring to earlier outputs ("add the sauce", "the reserved liquid") will never match. That's
  acceptable — show nothing rather than a wrong guess.
- Recipes with a single mega-step will surface everything, which is correct but useless. Harmless.
- If `steps` is stored as `jsonb` on some rows and `text[]` on others (DATA_MODELS §1 says
  `text[] | jsonb`), handle both.

---

## ▶ CLAUDE CODE PROMPT

```
Read .agent/inspiration/TASK_10_cook_mode_step_ingredients.md, then CLAUDE.md and
.agent/DATA_MODELS.md. Read src/views/CookModeView.jsx and
src/lib/recipeExtraction.js before starting.

Show only the relevant ingredients alongside each step in Cook Mode.

Do TASK_02 (wake lock) first if it isn't done - it's the bigger Cook Mode win.

1. Create src/lib/stepIngredients.js exporting
   ingredientsForStep(step, ingredients).
   - If the step carries explicit ingredient indexes, use them.
   - Otherwise fall back to matching ingredient names against the step text.
   - Match on WORD BOUNDARIES, not bare includes() - otherwise "salt" matches inside
     "salted butter" and "oil" inside "olive oil".
   - Reuse canonicalName() from src/lib/consolidateIngredients.js if TASK_03 has
     been done, so "chicken breasts" in the ingredient list matches "chicken" in the
     step text. If it doesn't exist yet, do minimal plural/prep-word normalisation
     inline.
   - Bias toward over-including. A missing ingredient means the user doesn't add it;
     an extra one is just a glance.
   - Handle steps stored as either text[] or jsonb, and both ingredient shapes via
     normalizeIngredient().

2. In CookModeView, render the matched ingredients under the active step with
   quantities that scale live from the existing servings stepper.
   - Steps with no matches render NOTHING - no empty box, no "no ingredients" label.
   - The full ingredient list must stay reachable at all times. This feature is
     additive, never subtractive - if the match is wrong, the user must still be
     able to cook.

3. Extend the Gemini responseSchema in src/lib/recipeExtraction.js so NEW captures
   emit per-step ingredient indexes. Existing recipes keep working via the fallback
   matcher. Do not break the existing extraction or the refine chat.

Do NOT do a backfill pass over the 400 existing recipes - out of scope for this task.

Constraints: DESIGN_SYSTEM.md type scale and tokens only (don't invent "massive
typography" - use the defined scale), numbers in .t-mono, Lucide icons only, no emoji
in chrome. CookModeView is `fixed inset-0` and owns its own horizontal inset.

Show me 5 real steps from my recipe library with what the matcher returns for each,
so I can judge the quality. Do not assume you can reach my dev server.
```

## DECIDE

- [ ] **Approve** — runtime matching + capture-time links
- [ ] **Approve + backfill** the 400 recipes too (adds cost and a migration)
- [ ] **Defer** — do TASK_02 first and see if that's enough
