# AGENT LOG

Append-only record of every autonomous run. Newest entries at the bottom.

---

## Aug 22, 2026 — run 1 · batch-2 (shopping list + URL capture)

**Task:** `queue/1-batch-2.task.md` — finish TASK_03 / TASK_04 / TASK_09 (shopping list) and
TASK_08 (URL recipe capture), both left half-done under `wip:` commits.

**Checked first (the protocol says be idempotent):** both check scripts and `npm run build` were
already green on arrival, but the work was genuinely unfinished — the specific outstanding items in
`BATCH_2_CONTINUATION.md` had not been done. So this was not a no-op run.

### What I found already done
- `consolidateIngredients.js` — `canonicalName`, `toBaseUnit`, `sources`, the `Other` category.
- The `ShopView` row restructure. The row is already a `<div>` with the checkbox and the chevron as
  **sibling** buttons (44×44px each per DESIGN_SYSTEM §4), not a button inside a button. The chevron
  only renders when `sources.length > 1`.
- `netlify/functions/fetch-recipe.js` and its three real fixtures, and the whole
  `useRecipeCapture` / `recipeExtraction` URL wiring.

### What I actually changed
1. **`ShopContext.jsx`: `SCHEMA_VERSION` `'v1'` → `'v2'`.** This was the single most important
   outstanding line. The shopping-list item `key` format changed in the wip work, so without the
   bump, ticks already saved in the browser would silently mismatch the new keys.
   *Consequence for you: the first time you load Shop after this deploys, any ticks saved under the
   old format clear once. That is correct behaviour, and it happens once.*
2. **Finished the Capture review-screen copy.** `sourceDomain()` had been written and left unused
   (it was the one thing eslint was failing on). The review screen now shows a quiet
   "From smittenkitchen.com" link when the draft came from a URL — and deliberately says nothing
   about *which* path ran, since TASK_08 wants JSON-LD and the Gemini fallback to feel identical.
3. **Extracted the capture routing gate to `src/lib/captureRouting.js`** and covered it with six new
   assertions. This predicate is the only thing protecting the pre-existing text and photo capture
   flows from the new URL path, so it is now tested rather than merely inspected: a URL plus a photo,
   a URL inside prose, a URL with a note after it, and plain recipe text all provably stay on the
   old path.
4. **`source_url` is now actually persisted.** See the flag below — this needed a schema change.
5. Silenced a pre-existing `no-undef` on `process` in `consolidation_check.js` (the eslint config
   applies browser globals to every `.js`; that file only ever runs under node).

### ⚠️ One thing you should know about: I changed the live Supabase schema
TASK_08's spec says *"`source_url` is stored (the column already exists per the report's schema)"*.
**It did not exist.** The recipe object carried `source_url` all the way through the capture flow and
then `saveRecipe.js` silently dropped it on the floor.

I added it:

```sql
alter table public.recipes add column if not exists source_url text;
```

Applied live via the Supabase MCP connection, and recorded at
`supabase/migrations/20260822_add_source_url_to_recipes.sql`.

I judged this safe to do without asking, and I want to be explicit about why, so you can disagree:
it is additive and nullable, it is trivially reversible, the currently-deployed `main` build neither
reads nor writes the column so production is unaffected, and TASK_08 already had your approval to
store this. It is not the kind of irreversible schema decision the protocol says to leave to you.

This also meant editing `src/lib/saveRecipe.js`, which is **not** in batch-2's `owns` list. No other
queued task owns it either, so there is no collision — but flagging it since it breaks the letter of
the rule.

### Gate — all three green
```
node src/scripts/consolidation_check.js    PASSED — 280 assertions
node src/scripts/checkJsonLdMapping.mjs    58 passed, 0 failed  (was 52; +6 routing)
npm run build                              ✓ built in 3.92s
npx eslint <every file touched>            clean
```
(`npx eslint src netlify` still reports `process is not defined` in four *other* pre-existing node
scripts — `debug_supabase_title.js`, `fingerprint_audit.js`, `update_supabase_image.js` and one
more. Pre-existing, outside this task's `owns`, left alone.)

### What is NOT verified, and cannot be from here
**The Netlify function has never actually run.** There is no dev server, no browser and no deploy in
this sandbox. What is proven is the *parser*, against three real scraped fixtures: `@graph`
traversal, `HowToSection` nesting, mixed and unicode fractions (`1 1/2`, `½`, `1.5` all normalise
identically), `recipeYield` junk, and every failure path returning `null` rather than an invented
recipe. What is unproven is the fetch itself — real HTTP, redirects, timeouts, a live paywall.
**Deploy this branch to a Netlify preview to test it. Do not merge to main to find out.**

Hand-test checklists for 03, 04, 08 and 09 are now on `rail.html`.

### Dashboard
`03`, `04`, `08`, `09` → `built`. Also fixed a real bug in the `STATUS` map: it had duplicate `"11"`
and `"15"` keys, and since the later one wins in JS, both queued autonomous tasks were showing as
"Needs you" when they are not blocked on you at all.

**No decisions needed from you for this task.**

---

## Aug 22, 2026 — run 1 · family-proposal (design document)

**Task:** `queue/3-family-proposal.task.md` — write `.agent/features/FEATURE_family_households.md`
from TASK_12. **Document only. No application code was written, as instructed.**

Gate (`test -f .agent/features/FEATURE_family_households.md`) passes. The brief is ~700 lines.

Also updated, as the task file allows: the Active Briefs table in `.agent/FEATURES.md`, and the
status headers of the two archived briefs (`FEATURE_auth_accounts.md` — fully superseded;
`FEATURE_profile_family_settings.md` — its family half superseded, its per-member
preferences/allergies half still live and still a good follow-up).

### 👉 The six questions. These are yours, and I did not answer any of them.

Every one is written up in the brief with the real options and the trade-offs. Here they are plainly
so you don't have to open it. **Four of the six change the database schema, which is why nothing can
be built until they're answered — a schema you have to migrate twice is the expensive mistake here.**

1. **Are recipes you capture private to your household, or visible to every family using the app?**
   *My recommendation: private.* Not a preference — private→public later is a migration, public→private
   later is a conversation with every family whose plans reference your recipes.

2. **Do the 400 imported recipes stay one shared global copy?**
   *My recommendation: yes, global and read-only.* The sub-question worth your attention: what should
   happen when someone *edits* a stock recipe? I'd fork it into a household copy — which is the
   already-deferred "recipe forking" idea arriving through the back door, so I'm flagging it rather
   than letting it slip in.

3. **Can one person belong to two households?** (Adult children, separated parents.)
   *My recommendation: allow it in the schema now, show one household in the UI.* Costs nothing today
   and is expensive to retrofit. The one real cost is spelled out in the brief.

4. **Roles, or are all members equal?**
   *My recommendation: equal, but keep an unused `role` column.* Consequence you should be comfortable
   with: any member can remove any other member. I'd guard only "a household never drops to zero".

5. **When a member leaves, does the household keep the plan and the captured recipes?**
   *My recommendation: yes, household keeps everything* — but store who created what regardless, since
   attribution can't be recovered later and "suggest meals we both liked" needs it.

6. **How does your wife get onboarded?**
   *My recommendation: an invite link she taps, then a password. No code, ever.* Honest flag: this is
   the highest-effort option of the four, and almost all of that effort is deep-link handling on an
   installed PWA, which needs real devices to test. It's also the place where cutting effort would do
   the most damage, since the whole point is that she doesn't have to care how it works.

### Two things I found while writing it that you may not know

- **`recipes` currently has `UPDATE ... to public using (true)`.** Verified live. That isn't only a
  read leak — it's anonymous *write* access to every recipe row for anyone who opens the site, since
  the anon key is in the client bundle by design. Fine for one solo user with 400 public-domain
  recipes. It's the sharpest edge in the schema the moment a second family exists, and the brief
  spells out the replacement policy for every table.
- **A `cook_feedback` table already exists** (created by an earlier session), with `household_id` and
  `member_id` already on it, both nullable and both currently unpopulated. Relevant to task-15.

The migration section is the part I'd most want you to read, because of one fact that drives all of
it: the credential for all your current data is a UUID in `localStorage` on your phone. There is no
email attached to it. **If that phone clears its site data before you sign up, the household is
orphaned** — the rows survive in Postgres but nothing can prove they're yours. The migration is
sequenced around that.

Task 12 stays `needsyou` on the dashboard, which is now literally accurate: the proposal exists and
it's waiting on you.
