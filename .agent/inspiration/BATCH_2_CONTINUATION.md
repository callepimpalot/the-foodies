# BATCH 2 — CONTINUATION BRIEF (for the scheduled cloud agent)

Two tasks were started on `feat/tier-1-batch` and left unfinished when the agents
hit a session limit. Their partial work is committed under two `wip:` commits.
The build passes, but neither task is correct or verified yet.

**Your job: finish them, prove they work, commit and push. Nothing else.**

---

## GROUND RULES

- Work only on `feat/tier-1-batch`. **Never commit to `main`. Never merge. Never open a PR.**
  Netlify auto-deploys from `main`, so merging would push untested code to production.
- **Push your work** to `feat/tier-1-batch` when done — otherwise it dies with your sandbox.
- Read these first, in order: `CLAUDE.md`, `.agent/DATA_MODELS.md`, `.agent/DESIGN_SYSTEM.md`.
- The task files in `.agent/inspiration/` are the specification. Follow them, including
  their ACCEPTANCE CRITERIA sections. Do not invent scope beyond them.
- There is no dev server and no browser here. Do not try to run one. Verify via check
  scripts, `npx eslint`, and `npm run build`.
- `VITE_*` env vars are absent in this environment. `npm run build` still succeeds; ignore
  warnings about missing keys.

## BE IDEMPOTENT

This routine fires repeatedly. **Before doing any work, inspect the current state:** run both
check scripts and `npm run build`. If everything already passes and `rail.html` already shows
both tasks as `built`, do NOT redo the work — append a dated line to `.agent/inspiration/AGENT_LOG.md`
recording that you found it complete, commit, push, and stop.

---

## ITEM A — shopping list (TASK_03 + TASK_04 + TASK_09)

Spec: `TASK_03_ingredient_consolidation.md`, `TASK_04_aisle_categorisation.md`,
`TASK_09_shopping_list_provenance.md`.

Already written in `src/lib/consolidateIngredients.js`: `canonicalName`, `toBaseUnit`,
a `sources` array, and an `Other` category. Outstanding:

1. **`src/context/ShopContext.jsx` line 7 still reads `SCHEMA_VERSION = 'v1'`. It MUST become `'v2'`.**
   The shopping-list item `key` format changed; without this bump, checks already persisted in
   users' browsers silently mismatch. Change *only* that line in that file.
2. **The `ShopView` row restructure was mid-edit.** The list row is currently a single `<button>`.
   You cannot nest an interactive chevron inside a button — invalid HTML, and taps misfire. Make
   the checkbox and the chevron **sibling** controls, each with a 44×44px minimum touch target
   (DESIGN_SYSTEM.md §4). Verify tapping the chevron does not toggle the checkbox.
3. Chevron appears **only** on items with more than one source, so its presence itself means
   "this number is a sum."
4. Run `src/scripts/consolidation_check.js` to green.

**The judgment that matters most:** bias every ambiguous call toward NOT merging.
`red pepper` ≠ `green pepper`. `sweet potato` ≠ `potato`. A duplicate row is a mild annoyance;
a wrong merge means an ingredient silently missing when the user cooks.

**Required assertions in the check script:**
- Every must-NOT-merge case in the task files.
- Substring collisions: `chicken stock` → Pantry (not Meat), `coconut milk` → Pantry (not Dairy),
  `garlic bread` → Bakery (not Herbs).
- An unrecognised ingredient → `Other`, sorted last, never `Produce`.
- **For every consolidated item, its `sources` sum to its displayed total.** If this fails you have
  found a bug in the merge logic — fix the logic, not the assertion.
- A unit collision must never render a blank quantity. Compound display (`"2 cloves + 30g"`).

## ITEM B — URL recipe capture (TASK_08)

Spec: `TASK_08_url_capture_jsonld.md`.

Already written: `netlify/functions/fetch-recipe.js`, an ingredient-parser dependency, and three
real fixtures in `src/scripts/fixtures/`. Outstanding:

1. Capture UI copy was mid-edit in `src/views/CaptureView.jsx` / `src/hooks/useRecipeCapture.js`.
   Finish it coherently.
2. Run `src/scripts/checkJsonLdMapping.mjs` to green against all three fixtures.
3. Confirm the existing **text-paste and photo-attach capture paths are completely unaffected**,
   and that a URL capture lands in the same review screen with the same "Ask for changes" refine chat.
4. A failed fetch (404, paywall, non-recipe page) must surface an honest error. It must **never**
   produce a hallucinated recipe.

This cannot be verified end-to-end without a deploy. Prove the *parser* via the fixtures; say
plainly in your report that the function itself remains untested in a real Netlify runtime.

---

## BEFORE YOU STOP

- Both check scripts green.
- `npx eslint` clean on every file you touched.
- `npm run build` passes.
- Update the `STATUS` map near the top of the `<script>` in `.agent/inspiration/rail.html`:
  move each finished task from `"running"` to `"built"`. If a task is still incomplete, leave it
  `"running"` — do not claim work you did not finish.
- Add hand-test entries for tasks 03, 04, 08 and 09 to that file's `TESTS` object — the checks only
  a human at a real device can perform. Follow the existing entries' shape and tone.
- Write what you did, what you verified, and anything you could not finish, to
  `.agent/inspiration/AGENT_LOG.md` (create it if absent; append, never overwrite).
- Commit with clear messages and **push to `feat/tier-1-batch`**.

If you run out of budget mid-change, commit what you have with a `wip:` prefix and a message
naming exactly what remains, then push. A later run will continue from there.
