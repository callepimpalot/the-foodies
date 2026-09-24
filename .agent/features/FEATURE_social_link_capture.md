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
| `SOCIAL_INGEST_URL` | the **cloudflared tunnel URL** for the VPS (e.g. `https://<name>.trycloudflare.com`) — *not* the VPS IP |
| `SOCIAL_INGEST_TOKEN` | the token in `~/.hermes/recipe-ingest/.env` (rotate by regenerating there and updating Netlify) |

**Why not the VPS IP directly:** `http://<vps-ip>:8787` is reachable from a residential
connection but **silently dropped for datacenter ranges**. Netlify (AWS Lambda) and two
independent public cloud proxies all timed out while a residential-proxied browser got a clean
`200` — and the service log showed the request never arrived, so the TCP connection never
opened. That is an upstream anti-abuse filter, not something application code can fix. The fix
is an outbound-only Cloudflare tunnel: no inbound port involved, and TLS for free. Tunnel
restarts get a new random URL, which `run_tunnel.sh` syncs into this env var automatically.

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

## The post's own photo

A captured recipe now arrives with the source's picture already attached, because a recipe
without a photo is a half-finished record.

The pipeline gets it cheaply. `ingest.py` already had the post's thumbnail URL in its yt-dlp
metadata, so the fast path does **one plain HTTP GET** of it — no media download, no video
fetch — which measured **2.34 s end to end, unchanged** from before. Carousels keep every slide;
a reel or single post contributes its cover.

The app side deliberately does **not** store Instagram's image URL. Those CDN links are signed
and expire within days, and they block cross-origin canvas reads, which would break the
re-encode step. Instead:

```
ingest.py         saves out/<id>/img_01.jpg, reports cover_image
server.py         serves GET /image/<id>/img_01.jpg (+ CORS), returns an absolute
                  cover_image_url built from tunnel.url
fetch-recipe.js   passes it through as imageUrl (JSON-LD pages too, from schema.org image)
recipeExtraction  attaches it to the draft as capture_image_url — app metadata, like source_url
CaptureView       fetches it -> File -> the SAME dishPhoto slot a hand-picked photo uses
saveRecipe        uploads through the existing normalizeImage(1600px) -> Supabase Storage path
```

So the photo ends up as a normal `recipe-images` object in your own storage, resized and
compressed like any other. Nothing is hotlinked, and nothing depends on Instagram still serving
that URL tomorrow. A photo the user picks by hand always wins over the automatic one, a failed
fetch quietly leaves the "Add a photo" button in place, and `capture_image_url` is preserved
across a refine turn so asking for changes doesn't silently drop the picture.

## Known limitations

- **A non-recipe link produces a non-recipe draft.** Paste a woodworking post and Gemini will
  still fill the recipe schema — the extraction prompt is recipe-shaped and is told never to
  leave the title generic. The review screen is the guard: the draft is editable and
  discardable, nothing is saved without a tap. A "this isn't a recipe" pre-check is the
  obvious next improvement.
- **No transcript on this path** (v1). Reels whose recipe is *spoken only* will produce a thin
  draft from a thin caption. `deep:true` exists on the service and needs an out-of-band
  trigger (a queued job, not a request the function waits on).
- **The endpoint is HTTPS + bearer token** via the Cloudflare tunnel. Originally plain HTTP on
  the VPS IP, which turned out to be unreachable from cloud callers anyway (see Configuration).
  The image route (`GET /image/<post-id>/<file>`) is deliberately public — recipe photos, and
  the browser fetches them directly — but is strictly path-matched, so it can only ever serve
  files `ingest.py` itself wrote under `out/<post-id>/`. Traversal attempts verified 404.
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
