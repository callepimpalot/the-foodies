# Meal Buddy — Repo Audit
**Date:** 2026-09-09 · **Scope:** full codebase + all documentation
**Bottom line:** the app code is healthy (~12k lines of clean React). The repo is carrying ~84 MB of unrelated/obsolete baggage and has one real security issue.

---

## Tier 0 — Delete (dead weight, biggest wins)

| Item | Size | Why |
|---|---|---|
| `data/full_format_recipes.json` | 35.2 MB | Recipe-import pipeline input. Already imported to Supabase (400 recipes live). |
| `data/stage1-passed.json` | 33.8 MB | Pipeline intermediate. Obsolete. |
| `data/stage2-passed.json` | 4.4 MB | Pipeline intermediate. Obsolete. |
| `data/stage3-final.json` | 831 KB | Pipeline final output. Obsolete (Supabase is source of truth). |
| **`Agents/` (entire dir, 344 files)** | 9.4 MB | A full generic **Claude Code skill library** (pptx/docx/pdf/xlsx OOXML schemas, 54 fonts, 29 images, skill-creator, mcp-builder, etc.). **Zero relation to this app** — it's agent-tooling that got committed. |

**~74 MB + 344 files gone** with no effect on the app.

Inside `Agents/`, also note the **duplicates**:
- `Agents/skills/pptx/` vs `Agents/skills/pptx - elo/` (a botched copy, space in the folder name)
- `Agents/skill-creator/` vs `Agents/skills/skill-creator/`

**Git note:** deleting these from the working tree doesn't shrink the *history* — the blobs stay in `.git`. To actually shrink clone size, run `git filter-repo` (or BFG) afterward. For a personal repo, delete + `.gitignore` is the 90% win; history rewrite is optional.

---

## Tier 1 — Documentation (your specific ask)

The `.agent/` docs are in *good* shape (maintained through Aug 22 — `DATA_MODELS.md` v2.0 even correctly says "plain JavaScript, NOT TypeScript"). The problem is a few stale/legacy files:

### Stale (rewrite)
- **`CLAUDE.md`** — the #1 problem. It's the entry-point file any AI reads first, and it's wrong: says **"TypeScript"** (the code is `.jsx`/`.js`, no `tsconfig`) and **"Current status (Feb 27) Mid-pivot, 5 features"** (the app is live in production since Aug). Directly contradicts `PROJECT.md` and `DATA_MODELS.md`. **Rewrite this first.**

### Redundant / retired (delete or archive)
- **`.agent/AGENTS.md`** (5.6 KB) — "legacy Gemini CTO Gem framework — retired", per `CLAUDE.md` *and* `PROJECT.md` line 36. Its own siblings declare it dead. Archive it.
- **`Agents/AGENTS.md`** (4.3 KB) — a *second* AGENTS.md (Claude Code's convention). Goes away with the `Agents/` dir anyway.
- **`.agent/@creator.md` + `.agent/@engineer.md`** — persona files for the retired CTO-Gem/Antigravity relay. Both still say "TypeScript" (wrong). CLAUDE.md says "keep for reference" — but they're stale; either fix or archive.

### Process cruft in `.agent/inspiration/` (archive)
- `AGENT_LOG.md`, `QUEUE_PROTOCOL.md`, `DECISIONS_NEEDED.md`, `BATCH_2_CONTINUATION.md` — these are session-process artifacts, not durable knowledge. The 15 `TASK_*.md` files + `README.md` + `done/*` are the actual reference material — keep those.

### Design folder (archive)
- `design/` — `home.png`, `recipies.png`, `recipies 1.png` (note the "recipies" typo), `README.md`, `system.md`. Old mockups, superseded by `.agent/DESIGN_SYSTEM.md` ("The Chit Rail" is fully specced there).

### Keep (correct + load-bearing)
- `PROJECT.md`, `DATA_MODELS.md` v2.0, `DESIGN_SYSTEM.md`, `FEATURES.md`, `PROGRESS.md`, `data/import-manifest.md`, the active feature briefs, and the 15 `TASK_*.md` candidate tasks.

---

## Tier 2 — Orphaned / legacy code

| Item | Why |
|---|---|
| `test_app.py` (3.6 KB) | Python test in a JS project. Orphaned — it's the *only* "test" and it doesn't run in this stack. Delete. |
| `initial_state.png` (242 KB), `shopping_list.png` (201 KB) | Old screenshots at repo root. Delete. |
| `src/scripts/*.js` (~11 one-off audit/debug scripts) | `audit_recipe.js`, `fingerprint_audit.js`, `debug_supabase_title.js`, `consolidation_check.js`, `pantry_check.js`, `step_ingredients_check.js`, `strict_null_audit.js`, `target_audit.js`, `validate_image_urls.js`, `update_supabase_image.js`, `image_audit_tool.js`. Ad-hoc tooling, already served their purpose. Archive or delete. |
| `scripts/*.ts` (7 files) | The recipe-import pipeline (stage1/2/3, `import-to-supabase.ts`). One-shot, already ran. Archive (keep only if you'll re-import). |
| `public/images/recipes/*.png` (9) vs `public/assets/recipe-refresh/*.png` (12) | Two recipe image sets. The `recipe-refresh` set looks like the replacement — verify which is referenced and delete the dead one. |

**Keep:** `final_recipes.json` (47 KB — it's the local fallback, referenced by `useRecipes.js` when Supabase is paused), `.claude/` (Claude Code config).

---

## Security (2 findings)

1. **`VITE_GEMINI_API_KEY` is baked into the client bundle** — `weekPlanChat.js` calls Gemini from the browser, and `VITE_` vars are inlined into the public JS. Anyone can extract the key from the deployed bundle. `PROJECT.md` even acknowledges this ("baked into the client bundle by design") — but it's a genuine leak. **Fix:** route Gemini calls through a Netlify function (server-side), like the existing `netlify/functions/fetch-recipe.js`.
2. **25 npm vulnerabilities (1 critical)** — all in **dev/build** dependencies (`vite`, `ws`, `workbox-build`, `yaml`), *not* runtime app code. These are dev-server path-traversal/memory issues, not holes in your deployed app. **Fix:** `npm audit fix` + bump `vite` to ≥ 7.3.4.

---

## Stack drift (for the "scale" goal)

The docs say TypeScript; the code is JavaScript. **Pick one:**
- **Adopt TypeScript** (right call for a growing codebase) — gradual migration: add `tsconfig.json`, convert `src/lib/*` first (they're already "TS-like" per DATA_MODELS.md), then components.
- **Or fix the docs** to say JavaScript and keep moving fast.

Recommendation: adopt TS gradually, but it's a migration — don't let it block features.

---

## Lint (65 errors)

Mostly in the `Agents/` junk (goes away) + a handful of app files (`src/lib/supabase.js`, `PlanContext.jsx`, `ArchetypeContext.jsx`, `RecipeSelector.jsx`, the `src/scripts/*.js` one-offs). Trimming Tier 0/2 removes most of them; the ~4 real app-file errors are trivial to fix.

---

## Suggested execution order

1. **Rewrite `CLAUDE.md`** to match reality (JS, live-in-prod status). *5 min, unblocks every future agent.*
2. **Delete `Agents/` + `data/stage*.json` + `full_format_recipes.json`** (add to `.gitignore`). *The 74 MB + 344 files.*
3. **Archive** `.agent/AGENTS.md`, `@creator/@engineer`, `design/`, the inspiration process-cruft, and the Tier-2 orphans.
4. **Fix the Gemini key leak** (Netlify function proxy). *The one real security fix.*
5. **`npm audit fix` + bump vite.**

All of this is cleanly doable as one `chore/repo-cleanup` branch + PR (reversible via git history), which fits the existing pipeline.
