# TASK 08 — Paste a recipe URL

| | |
|---|---|
| **Feature it improves** | Capture |
| **Impact** | ★★★★☆ |
| **Effort** | M |
| **Horizon** | 🟡 NEXT |
| **Family-readiness** | ✅ No implications |

---

## THE GAP

Capture today accepts **pasted text and/or photos**, sent together to Gemini
(`useRecipeCapture.js` → `recipeExtraction.js`). That's genuinely good — PROGRESS.md shows it was
built deliberately, with a refine-chat on top.

But there's no URL path. To save a recipe from a food blog you have to open it, select the text,
copy, switch app, paste — or screenshot it in pieces. Every one of those is a manual step for content
that, on most food blogs, is **already available as clean structured JSON**.

## WHAT THE BEST DO

- **`[report only]`** This is the report's "cascading ingestion pipeline" — its single best
  architectural idea. Try the cheapest, most deterministic method first; escalate only when it fails.
  Paprika built its whole product on JSON-LD scraping; Pestle uses on-device text models; Preplo
  escalates to cloud multimodal AI at "expensive premium subscription" cost.
- **`[report only]`** Most established food blogs publish `schema.org/Recipe` metadata as JSON-LD.
  Extracting it is *deterministic, instantaneous, and requires zero ML compute* — the report's words,
  and correct.
- **`[report only]`** The counter-evidence matters too: Paprika users report scrapers "fail
  catastrophically" when a site changes its formatting, omitting ingredient quantities. Pure scraping
  is brittle. **Which is exactly why it should be a fast path with a fallback, not a replacement.**

Your app is unusually well-placed here: you *already* have the AI fallback built. You're only adding
the cheap fast path in front of it.

## THE CHANGE

**A Netlify Function** (`netlify/functions/fetch-recipe.js`) — required, not optional. A browser can't
fetch an arbitrary food blog directly; CORS blocks it. You already deploy to Netlify, so this is
config you have rather than infrastructure you'd add.

Flow:
1. User pastes a URL into the existing Capture composer. Detect it's a URL.
2. Function fetches the page, extracts `<script type="application/ld+json">`, finds the `Recipe`
   node, maps it to your recipe shape.
3. **Success** → return structured recipe instantly, no Gemini call, no cost.
4. **Failure** (no JSON-LD, malformed, or missing ingredients) → fall back to passing the page's
   readable text to the **existing** Gemini extraction path.
5. Either way the user lands in the same review screen with the same "Ask for changes" refine chat.
   The UI shouldn't reveal which path ran, beyond maybe a subtle source note.

**Ingredient parsing is the catch.** JSON-LD gives `recipeIngredient` as an array of raw strings
(`"1 1/2 cups flour"`), but your schema wants `{name, quantity, unit}` (DATA_MODELS §1). **This is
where an npm parser earns its place** — `parse-ingredient` or `@jlucaspains/sharp-recipe-parser`
(**`[verified]`**, both actively maintained). Note this is the opposite conclusion from TASK_03,
where the data was already structured and a parser would have been pointless.

## WHY DESIGNED THIS WAY

- **Why bother, when Gemini already works?** Speed, cost and reliability. JSON-LD returns in ~200ms
  with exact quantities straight from the publisher. Gemini takes seconds, costs a call, and can
  hallucinate a quantity. When the structured data exists, using it is strictly better.
- **Why keep Gemini as fallback rather than choosing one?** Because the report's own evidence says
  scrapers break. A waterfall gets you the best case usually and the acceptable case always. Neither
  approach alone does that.
- **Why a Netlify Function rather than a CORS proxy?** A public proxy is a dependency you don't
  control, sends your browsing through a third party, and will eventually rate-limit you. The
  function is ~40 lines and runs on infrastructure you already pay nothing for.
- **Why not the report's Cloudflare Workers edge suggestion?** You have no Cloudflare account. It
  recommends that for global edge latency, which is irrelevant for one household.

## ACCEPTANCE CRITERIA

- [ ] Pasting a URL from a major food blog produces a correct recipe with quantities
- [ ] A page with no JSON-LD falls back to Gemini and still produces a recipe
- [ ] A 404 / non-recipe / paywalled page gives a clear error, not a crash or a hallucinated recipe
- [ ] Ingredients land in the canonical `{name, quantity, unit}` shape
- [ ] Fractions parse correctly — `1 1/2`, `½`, `1.5` all work
- [ ] The existing text + photo capture paths are **completely unaffected**
- [ ] The refine chat works identically on a URL-captured draft
- [ ] `source_url` is stored (the column already exists per the report's schema and your Capture flow)
- [ ] Function handles a slow/hanging site with a timeout

## RISKS / EDGE CASES

- Some sites return JSON-LD with `@graph` arrays or multiple Recipe nodes — handle both.
- `recipeYield` is wildly inconsistent (`"4"`, `"4 servings"`, `"Serves 4-6"`). Parse defensively and
  fall back to your default rather than storing nonsense in `base_servings`.
- `recipeInstructions` may be strings, `HowToStep` objects, or nested `HowToSection`s.
- Don't let a fetch failure block the composer — the user should be able to fall back to pasting text.
- Netlify Functions have a 10s default timeout; set a shorter fetch timeout inside it.

---

## ▶ CLAUDE CODE PROMPT

```
Read .agent/inspiration/TASK_08_url_capture_jsonld.md, then CLAUDE.md and
.agent/DATA_MODELS.md. Also read src/lib/recipeExtraction.js and
src/hooks/useRecipeCapture.js so the new path matches the existing one.

Add URL capture to the Capture tab, as a fast deterministic path IN FRONT of the
existing Gemini extraction - not as a replacement.

1. Create netlify/functions/fetch-recipe.js. It takes a URL, fetches the page
   server-side (a browser can't - CORS), and extracts
   <script type="application/ld+json">. Find the schema.org Recipe node, handling
   both bare objects and @graph arrays and multiple Recipe nodes. Set a fetch
   timeout well under Netlify's 10s function limit.

2. Map the JSON-LD to the app's recipe shape from DATA_MODELS.md section 1. Parse
   defensively:
   - recipeIngredient is an array of raw strings like "1 1/2 cups flour" but the app
     needs {name, quantity, unit}. Use an npm parser for this - parse-ingredient or
     @jlucaspains/sharp-recipe-parser. Handle "1 1/2", unicode fractions like "½",
     and decimals.
   - recipeInstructions may be plain strings, HowToStep objects, or nested
     HowToSection objects.
   - recipeYield is inconsistent ("4", "4 servings", "Serves 4-6") - parse what you
     can and fall back to the app default rather than storing nonsense.
   - Store source_url.

3. If JSON-LD is missing, malformed, or yields no ingredients, FALL BACK to the
   existing Gemini extraction path by passing the page's readable text to it. Do not
   duplicate that logic - reuse src/lib/recipeExtraction.js.

4. In the Capture composer, detect that pasted content is a URL and route it through
   this flow. The user must land in the SAME review screen with the SAME "Ask for
   changes" refine chat as today.

5. The existing text-paste and photo-attach paths must be completely unaffected.
   Verify that explicitly.

Errors must be honest: a 404, paywall, or non-recipe page shows a clear message. It
must never produce a hallucinated recipe from a failed fetch.

Constraints: mandatory optional chaining, no hardcoded design values,
DESIGN_SYSTEM.md tokens only, reuse src/components/ui/ primitives.

Tell me how to test locally (I have the Netlify CLI or can deploy to a branch) and
give me 3 real recipe URLs you verified against. Do not assume you can reach my dev
server.
```

## DECIDE

- [ ] **Approve** — JSON-LD fast path + Gemini fallback
- [ ] **Approve, but** skip JSON-LD, just send page text to Gemini (simpler, slower, costs a call
      every time)
- [ ] **Defer** — I capture from photos and text, not links
