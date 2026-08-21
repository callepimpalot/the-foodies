# TASK 03 — Smarter ingredient merging

| | |
|---|---|
| **Feature it improves** | Shop |
| **Impact** | ★★★★☆ |
| **Effort** | M (~one full session) |
| **Horizon** | 🟢 NOW |
| **Family-readiness** | ✅ Pure logic in a lib file — no storage implications |

---

## THE GAP

Your consolidation key is a raw lowercased string plus the unit:

```js
// src/lib/consolidateIngredients.js:51
const key = `${name.toLowerCase()}|${unit ?? ''}`;
```

That means every one of these produces a **separate row** on your shopping list:

| Recipe A says | Recipe B says | Today's result |
|---|---|---|
| `yellow onion` | `onion` | 2 rows |
| `onion` (2, no unit) | `onion` (1 `medium`) | 2 rows |
| `garlic clove` | `cloves garlic` | 2 rows |
| `chicken breast` | `chicken breasts` | 2 rows |
| `olive oil` (2 `tbsp`) | `olive oil` (60 `ml`) | 2 rows |

And there's a second, quieter failure. When units *don't* match, the code sets quantity to `null`:

```js
// consolidateIngredients.js:55-57
existing.quantity = existing.quantity != null && scaledQuantity != null
    ? existing.quantity + scaledQuantity
    : null;
```

`null` renders as **no quantity at all** (`ShopView.jsx:127`). So a merge collision doesn't just fail
to add up — it *silently deletes the number*, and you're standing in the shop looking at a row that
just says "Olive oil" with no idea how much you need.

## WHAT THE BEST DO

- **`[report only]`** This is the report's single most consistent competitor finding. AnyList
  "frequently fails to aggregate quantities accurately depending on how an ingredient was arbitrarily
  named in the source recipe." Mealie's own October 2024 user survey has users explicitly asking for
  prompts to **merge similar ingredients intelligently** rather than aggregating blindly. Two
  independent products, same complaint — this is the hard problem of the category, and nobody has
  fully solved it.
- **`[report only]`** The report's answer is a Named Entity Recognition model (TASTEset-trained) plus
  a density conversion matrix, mapping raw strings to canonical ingredient IDs.
- **`[verified]`** The report recommends Python (`ingredient-parser`, spaCy) — **unusable in your
  React+Vite browser app.** There are, however, mature JS equivalents on npm:
  `parse-ingredient`, `@jlucaspains/sharp-recipe-parser`, `recipe-ingredient-parser-v3`, and
  `@recipecloudapp/ingredient-parser`. This is the key adaptation the report couldn't make for you.

## THE CHANGE

**Three layers, cheapest first. Do not jump to the AI layer.**

**Layer 1 — Normalise the name (deterministic, no dependency)**
Build `canonicalName(raw)` in `consolidateIngredients.js`:
- strip preparation words: `diced`, `chopped`, `minced`, `fresh`, `finely`, `roughly`, `large`,
  `medium`, `small`, `ripe`, `boneless`, `skinless`
- strip a trailing parenthetical: `onion (about 200g)` → `onion`
- singularise simple plurals (`breasts` → `breast`, `cloves` → `clove`, `tomatoes` → `tomato`)
- drop leading colour/variety qualifiers for a defined list only (`yellow`, `red`, `white`, `brown`
  onion; `green`/`red` pepper stays distinct — see Risks)

**Layer 2 — Normalise the unit (deterministic)**
Convert to a base unit before summing: volume → ml, mass → g. Cover `tsp/tbsp/cup/ml/l/g/kg/oz/lb`.
Keep countable items (`clove`, `whole`, no unit) in their own class — never convert a count to a mass.

**Layer 3 — Never destroy a number**
Replace the `null`-on-collision behaviour. If two entries genuinely can't be summed (2 cloves + 30g
garlic), keep **both** as a compound display: `"2 cloves + 30g"`. Showing both is always better than
showing neither.

## WHY DESIGNED THIS WAY

- **Why not go straight to Gemini/AI?** You already pay a Gemini call on capture. Adding an AI call
  to *every shopping list build* makes the Shop tab slow, costly, and offline-hostile — and Shop is
  the one tab you use in a shop with bad signal. Deterministic rules handle ~80% of real collisions
  at zero latency. If you later want the last 20%, do it **once at capture time** (normalise into the
  stored recipe) rather than on every list render.
- **Why a curated qualifier list instead of stripping all adjectives?** Because `red onion` and
  `yellow onion` are interchangeable in a trolley, but `red pepper` and `green pepper` are not, and
  `sweet potato` is not a potato. A blanket adjective-stripper creates *wrong* merges, which are far
  worse than duplicate rows — a duplicate row is a mild annoyance; a wrong merge means you don't buy
  something.
- **Why compound display over picking a winner?** Because you cannot know which is right without
  knowing the ingredient's density, and guessing wrong silently is the exact failure mode you're
  fixing.
- **Why not an npm parser library?** Your ingredients are **already structured** — Supabase stores
  `{name, quantity, unit}` (DATA_MODELS §1). Those libraries parse *unstructured* strings like
  `"1 1/2 cups flour"`, which is a problem you solved at capture time. Pulling one in would mean
  re-stringifying your data to re-parse it. **Skip the dependency.** (They become relevant in
  TASK_08, where URL-scraped ingredients arrive as raw strings.)

## ACCEPTANCE CRITERIA

- [ ] `yellow onion` + `onion` → one row
- [ ] `2 cloves garlic` + `3 cloves garlic` → `5 cloves garlic`
- [ ] `2 tbsp olive oil` + `60 ml olive oil` → one row, correctly summed to ml
- [ ] `chicken breast` + `chicken breasts` → one row
- [ ] `red pepper` and `green pepper` stay **separate** (guard against over-merging)
- [ ] `sweet potato` and `potato` stay **separate**
- [ ] A genuinely unmergeable pair shows `"2 cloves + 30g"` — never a blank quantity
- [ ] Both ingredient shapes still work: Supabase `{name, quantity, unit}` and local-fallback
      `{item, amount, unit}` (reuse the existing `normalizeIngredient()` — don't reimplement)
- [ ] Display still shows the *original* recipe wording somewhere legible, so a canonical name never
      leaves you unable to tell what the recipe actually wanted

## RISKS / EDGE CASES

- **Over-merging is worse than under-merging.** Bias every ambiguous call toward keeping rows
  separate. A wrong merge = a missing ingredient at cook time.
- Changing the item `key` format **breaks TASK_01's persisted checks.** Bump the fingerprint schema
  version (`v1` → `v2`) as part of this task if TASK_01 is already built.
- `categoriseIngredient()` runs on the name — verify it still categorises correctly *after*
  canonicalisation (`chicken breast` → `chicken` must still hit the Meat regex). Related: TASK_04.
- Unit conversion tables are a classic source of silent errors. Unit-test the conversion function
  directly rather than only testing through the UI.

---

## ▶ CLAUDE CODE PROMPT

```
Read .agent/inspiration/TASK_03_ingredient_consolidation.md, then CLAUDE.md and
.agent/DATA_MODELS.md before writing any code.

Improve shopping-list consolidation in src/lib/consolidateIngredients.js so that
differently-worded versions of the same ingredient merge into one row.

Do NOT add an npm dependency and do NOT call Gemini. The ingredients are already
structured as {name, quantity, unit} - this is deterministic string and unit work.

Implement three things in src/lib/consolidateIngredients.js:

1. canonicalName(raw) - exported. Lowercases, strips preparation words (diced,
   chopped, minced, fresh, finely, roughly, large, medium, small, ripe, boneless,
   skinless), strips trailing parentheticals, singularises simple plurals, and
   strips ONLY a curated list of interchangeable qualifiers.
   CRITICAL: bias toward NOT merging. "red pepper" and "green pepper" must stay
   separate. "sweet potato" and "potato" must stay separate. A wrong merge means a
   missing ingredient at cook time, which is much worse than a duplicate row.
   Put the qualifier lists in clearly-named exported consts so they're easy to tune.

2. toBaseUnit(quantity, unit) - exported. Converts volume to ml and mass to g,
   covering tsp/tbsp/cup/ml/l/g/kg/oz/lb. Countable units (clove, whole, slice, or
   no unit at all) are their own class and must NEVER be converted into a mass.

3. Change buildShoppingList so a merge collision never destroys the number. Today
   line ~55 sets quantity to null when units don't match, and null renders as a
   blank quantity in ShopView - so the user sees an item with no amount. Instead,
   keep both parts and expose them for a compound display like "2 cloves + 30g".

Keep using the existing normalizeIngredient() for the dual ingredient shapes
(Supabase {name,quantity,unit} vs local final_recipes.json {item,amount,unit}) -
reuse it, do not reimplement it.

Preserve the original recipe wording on the item object so the UI can still show
what the recipe actually asked for. Update src/views/ShopView.jsx to render the
compound quantity case and to not regress the existing display.

Verify categoriseIngredient() still works on canonicalised names (e.g. "chicken
breast" must still match the Meat & Fish regex).

Write plain unit tests for canonicalName and toBaseUnit covering every case in the
task file's acceptance criteria, including the must-NOT-merge cases. If the repo has
no test runner, put them in a runnable node script under src/scripts/ following the
pattern of the existing audit scripts there.

Constraints: no `any`, mandatory optional chaining, no hardcoded design values.

Tell me how to verify by hand afterwards. Do not assume you can reach my dev server.
```

## DECIDE

- [ ] **Approve** — deterministic, no dependency
- [ ] **Approve, but** normalise once at capture time via Gemini instead (slower to build, better
      long-term data quality)
- [ ] **Defer** — duplicates don't bother me in practice
