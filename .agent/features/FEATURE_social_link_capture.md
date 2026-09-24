# FEATURE — Social link capture (Instagram / TikTok / YouTube Shorts)

**Status:** SHIPPED (Sep 24, 2026) — code deployed, **inert until two Netlify env vars are set** (see Configuration).

## The gap this closes

Capture could already take pasted text, photos, and a *recipe-blog URL* (TASK_08, the JSON-LD
fast path). It could not take a social post, which is where the recipes actually show up in
practice: someone shares an Instagram reel, and the app has nothing to do with it.

A social post is a different shape of problem from a recipe blog:

- No `schema.org/Recipe` JSON-LD to read.
- The HTML is a login shell — `r.jina.ai` returns a 403 abuse block, `?__a=1` returns 400,
  and the page body is empty to any anonymous fetch.
- The *caption*, however, very often contains the entire recipe — quantities, steps, servings,
  macros — because that is how the poster shares it.

So the payload was never locked behind the video. It was locked behind the caption.

## What shipped

A third branch in `netlify/functions/fetch-recipe.js`, taken **before** the page fetch:

```
CaptureView (unchanged)
  -> useRecipeCapture.capture({ url })            (unchanged)
  -> extractRecipeFromUrl(url)                    (unchanged)
  -> /.netlify/functions/fetch-recipe?url=…       (new branch)
       host is instagram/tiktok/youtube AND SOCIAL_INGEST_URL + SOCIAL_INGEST_TOKEN set?
         yes -> POST {url, deep:false} to the social-ingest service
                -> { source:'fallback', pageText, pageTitle, source_url, via:'social' }
         no  -> fall through to the existing page fetch, exactly as before
  -> extractRecipe({ text: pageText })            (unchanged — the SAME Gemini path)
  -> review screen -> refine chat -> saveRecipe   (unchanged)
```

**The client needed zero changes.** The social branch deliberately returns the *same response
shape* the generic page fallback already returns (`source: 'fallback'` + `pageText`), so
`extractRecipeFromUrl` reuses its existing `extractRecipe({ text })` path and the existing
review/refine/save flow. No new schema, no new screen, no second AI integration.

`buildSocialText()` prepends a provenance line — `Captured from a social post by <creator>
(<url>).` — before `CAPTION:` and `SPOKEN TRANSCRIPT:` blocks. That is not decoration: the
extraction prompt already knows to treat a poster's `@handle` as the `creator` field and to
ignore social-media chrome, so naming the source is what makes that existing rule fire.

### The service it calls

`netlify/functions/` runs on Netlify, which **cannot run `yt-dlp`, `ffmpeg`, or a Whisper
model** — no binaries, and Instagram blocks datacenter IPs anyway. So the fetch lives on the
VPS at `~/.hermes/recipe-ingest/`, behind a small token-protected HTTP wrapper (`server.py`):

- `POST /ingest` `{url, deep}` with `Authorization: Bearer <token>`
- `deep:false` → metadata + caption only, **measured 2.1–2.9 s** — fits a serverless timeout
- `deep:true` → adds media download + local Whisper transcription, **measured 16.2 s** — too
  slow for a Netlify Function, so transcription is deliberately *not* on this path
- single-flight lock + 6 s minimum spacing, because Instagram throttles per IP and the window
  is shared with every other Instagram call on that box

## Configuration

Two Netlify env vars, **set in Netlify, never committed** (same rule as `GEMINI_API_KEY`):

| Var | Value |
|---|---|
| `SOCIAL_INGEST_URL` | `http://179.198.208.153:8787` |
| `SOCIAL_INGEST_TOKEN` | the token in `~/.hermes/recipe-ingest/.env` (rotate by regenerating there and updating Netlify) |

**Until both are set the branch never runs** and behaviour is byte-for-byte what it was
before, so this deploy cannot break the existing capture flow.

## Verification (Sep 24, 2026)

A throwaway harness (`node`) imported the **real exported handler** and called it against the
live service — 16/16 checks passed:

- `isSocialPostUrl` true for reel/post/TikTok URLs; **false for a food blog**; false for
  `instagram.com.evil.example` (subdomain-spoof case)
- `buildSocialText` carries creator, caption and transcript
- live request returned 200, `source: 'fallback'`, `via: 'social'`, and a `pageText`
  containing the real recipe text — **3.3 s end to end**, inside the 10 s function limit
- `socialIngestConfigured()` false with the URL unset (the inert path)

Three real posts were read during development: a recipe reel (1,486-char caption containing a
complete recipe), an 11-slide carousel, and a single image post with a Danish caption.

## Known limitations

- **A non-recipe link produces a non-recipe draft.** Paste a woodworking post and Gemini will
  still fill the recipe schema — the extraction prompt is recipe-shaped and is told never to
  leave the title generic. The review screen is the guard: the draft is editable and
  discardable, nothing is saved without a tap. A "this isn't a recipe" pre-check is the
  obvious next improvement.
- **No transcript on this path** (v1). Reels whose recipe is *spoken only* will produce a thin
  draft from a thin caption. `deep:true` exists on the service and needs an out-of-band
  trigger (a queued job, not a request the function waits on).
- **The endpoint is plain HTTP**, protected only by a 256-bit bearer token. Acceptable because
  it triggers a scrape of a public URL and returns public content — but a TLS tunnel
  (`cloudflared`) would be strictly better if this ever carries anything private.
- **Single point of failure:** if the VPS is down or the service isn't running, the branch
  returns a clear 502 with a "paste the recipe text instead" fallback. Nothing else in the app
  is affected.
- **Durability — resolved, but worth knowing how.** The service runs under systemd as a user
  unit (`~/.config/systemd/user/social-ingest.service`, `Restart=always`), not as a
  process spawned by an agent session. That matters: the first version *was* session-spawned and
  died whenever the session was reset, which reads as a flaky feature rather than a lifecycle bug.
  `Linger=yes` is enabled for the user, so it starts at boot with no login — the same mechanism
  that keeps `hermes-gateway.service` alive. Verified: `kill -9` on the main PID → serving again
  within 12 s. A Hermes cron watchdog (`~/.hermes/scripts/social_ingest_watchdog.sh`, every
  15 min) stays silent when healthy, restarts the unit if it's down, and reports only when it had
  to act — so a failure is never silent. Not reboot-tested (that would mean rebooting the VPS);
  the mechanism is the same one the gateway already relies on.
