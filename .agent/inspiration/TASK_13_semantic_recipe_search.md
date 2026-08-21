# TASK 13 — Semantic recipe search

| | |
|---|---|
| **Feature it improves** | Library / Plan |
| **Impact** | ★★★☆☆ |
| **Effort** | L |
| **Horizon** | 🔵 LATER |
| **Trigger to revisit** | When you catch yourself failing to find a recipe you know is in the library, more than occasionally |

---

## THE GAP

`src/lib/recipeSearch.js` plus tag filters (meal type, diet, method, season, My Recipes, Creator) is
keyword matching. It shipped Aug 15 and, per FEATURES.md, replaced a filter that was broken for
400/403 recipes — so it's a recent, deliberate improvement, not neglected code.

What keyword search can't do is answer:

- *"something warming for a cold night"*
- *"what can I make with chicken, slightly old spinach, and rice?"*
- *"a light dinner that isn't pasta again"*

None of those words appear in the recipes. With 400+ recipes, the library is now big enough that
you can't remember what's in it, which is exactly the point where keyword search starts failing.

## WHAT THE BEST DO

- **`[report only]`** The report puts `embedding VECTOR(1536)` directly on its `recipes` table and
  describes the flow precisely: *"When a user asks the AI Chef 'What can I make with chicken,
  slightly old spinach, and rice?', the backend embeds the query and performs a cosine similarity
  search against the vector embeddings of the user's saved recipes to return instant, context-aware
  results that bypass strict keyword matching limitations."*
- **`[report only]`** It also argues vector search is the right answer for **pantry matching** —
  that exact-match relational lookups fail when matching free-text recipe ingredients against general
  pantry items. That's the same machinery serving two features.
- **`[verified]`** Supabase supports `pgvector` natively as an extension, so this needs no new
  infrastructure — contrary to the report's suggestion of Weaviate or Pinecone, which would be an
  entire additional service for one household.

## THE CHANGE

1. Enable `pgvector` on your existing Supabase project.
2. Add `embedding vector(768)` to `recipes` (768 matches Gemini's text-embedding model; the report's
   1536 is OpenAI's dimension — you use Gemini, so don't copy the number).
3. Backfill embeddings for all 400+ recipes via a one-off script (`src/scripts/` already has a
   pattern for batch jobs like this).
4. Generate an embedding on capture, in `saveRecipe.js`.
5. A Postgres RPC doing cosine similarity, called from a new search path.
6. **Keep keyword search as the default.** Semantic becomes an additional mode or a fallback when
   keyword returns nothing.

## WHY DEFER IT

- **You just built the search.** It landed Aug 15 and fixed a genuinely broken filter. Give it time
  to prove whether it's actually insufficient before replacing it — the honest answer might be that
  it's fine.
- **The AI Week Planner already covers much of this.** `weekPlanChat.js` + `dishCuration.js` take a
  natural-language constraint and propose meals from the library. That's the "warming dinner"
  use case, already shipped, via a different mechanism. Semantic search would partly duplicate it.
- **Backfill has a real cost** — 400+ embedding calls, plus keeping them fresh on every edit.
- It's an enabler for pantry matching (TASK_11 Phase 2), but that's deferred too. Doing this before
  its consumers exist is building infrastructure on spec.

## WHY IT'S STILL WORTH KEEPING ON THE LIST

Because if you do eventually build TASK_11 Phase 2 *and* find the library hard to search, the same
`pgvector` work serves both, and the cost/benefit flips. The trigger is real usage friction, not
appetite.

## ACCEPTANCE CRITERIA (when it happens)

- [ ] "something warming" returns plausibly warming dishes
- [ ] Ingredient-list queries return recipes using most of those ingredients
- [ ] Keyword search still works and stays the default path
- [ ] Newly captured recipes are searchable immediately
- [ ] Supabase unreachable → falls back to local keyword search without crashing (matching the
      existing `useRecipes.js` resilience pattern)
- [ ] Embedding backfill is idempotent and re-runnable

## RISKS

- Embeddings drift out of sync when a recipe is edited — needs a regeneration hook.
- Semantic search returns *something* for every query, including nonsense. Needs a similarity
  threshold, or it will confidently return irrelevant recipes rather than admitting no match.
- Don't let it silently replace keyword search; users expect exact-title lookup to work exactly.

## ▶ CLAUDE CODE PROMPT

```
Read .agent/inspiration/TASK_13_semantic_recipe_search.md, CLAUDE.md and
.agent/DATA_MODELS.md. Read src/lib/recipeSearch.js, src/lib/weekPlanChat.js and
src/hooks/useRecipes.js first.

Before writing code, tell me honestly whether this is worth building given that
weekPlanChat.js already handles natural-language meal requests over the library. If
it substantially overlaps, say so and recommend not building it.

If I confirm, add semantic search using pgvector on the existing Supabase project.
Do NOT add Weaviate or Pinecone - the research doc that inspired this recommends
them, but that's an extra service for a one-household app.

1. Enable the pgvector extension via the Supabase MCP connection.
2. Add an embedding column to recipes. Use dimension 768 for Gemini's text embedding
   model - do NOT use 1536, that's OpenAI's dimension and this app uses Gemini.
3. Write a one-off idempotent, re-runnable backfill script in src/scripts/ following
   the pattern of the existing scripts there. Show me the cost estimate before
   running it.
4. Generate an embedding on capture in src/lib/saveRecipe.js, and regenerate it when
   a recipe is edited - stale embeddings are the main failure mode here.
5. Add a Postgres RPC doing cosine similarity, and call it from a new search path.
6. Apply a similarity threshold. Semantic search returns something for every query,
   including nonsense - it must be able to return no results rather than confidently
   returning irrelevant recipes.

CRITICAL: keyword search stays the DEFAULT. Semantic is an additional mode or a
fallback when keyword returns nothing. Exact-title lookup must keep working exactly.
And preserve the existing offline resilience - if Supabase is unreachable, fall back
to local keyword search over final_recipes.json without crashing, matching how
useRecipes.js already behaves.

Enable RLS on anything new and run get_advisors afterwards.
```

## DECIDE

- [ ] **Not yet** — recommended; revisit when search actually fails you
- [ ] **Approve** — build it
