# TASK 14 — Capture from Instagram / TikTok

| | |
|---|---|
| **Feature it improves** | Capture |
| **Impact** | ★★★★☆ if you actually save recipes from social video |
| **Effort** | XL |
| **Horizon** | 🔵 LATER |
| **Trigger to revisit** | When you notice yourself screenshotting Reels to get them into the app |

---

## THE GAP

Capture takes text and photos. To save a recipe from an Instagram Reel today you'd screenshot the
caption — which works, and is probably why this hasn't hurt yet.

## WHAT THE BEST DO

This is the report's **strongest** section, and the place where it's most clearly describing a real
market shift rather than generic architecture advice.

- **`[report only]`** *"The shift toward short-form video content on platforms like Instagram and
  TikTok has fundamentally altered recipe discovery, rendering traditional web-scraping architectures
  obsolete."* Directionally, this is the report's central thesis.
- **`[report only]`** **Pestle** runs an **on-device** ML model extracting recipe data from Instagram
  and TikTok in under 100ms, via share-sheet integration. Users praise the speed and privacy. But its
  extraction is *text-only* — it reads the caption. **If a video demonstrates a recipe without a
  written caption, Pestle fails entirely.**
- **`[report only]`** **Preplo** solves exactly that with cloud multimodal AI that "watches" the
  video — keyframes plus a Whisper audio transcript into a multimodal LLM. Users report it works, and
  that it's slow and requires an expensive subscription.
- **`[report only]`** **Umami** takes the middle road: cross-platform imports plus OCR for
  handwritten recipe cards.

The strategic read: **caption-first is cheap and covers most cases; video-watching is expensive and
covers the rest.** Same waterfall logic as TASK_08.

## WHY THIS IS XL FOR YOU SPECIFICALLY

The competitors doing this well are **native apps**. That's not incidental:

1. **Share-sheet integration is the whole UX.** Pestle's advantage is that you tap Share → Pestle
   from inside Instagram. A PWA can register as a share target via the Web Share Target API, but
   support is Android/Chrome-only in practice — **iOS does not support it.** If you're on iPhone, the
   single best part of this feature is unavailable.
2. **Downloading the video server-side is the hard part.** Instagram and TikTok actively work against
   automated fetching — auth walls, rate limits, rotating URLs, and terms of service that prohibit
   it. Tools that do this break constantly. This is not a "write a Netlify Function" problem; it's an
   ongoing maintenance burden.
3. **Multimodal video costs real money.** Keyframes + audio transcription + a large context call, per
   recipe.
4. **Netlify Functions time out at 10s** (26s max on some plans). Downloading and analysing a
   60-second video will not fit. You'd need background functions or a queue — which is precisely why
   the report reaches for Celery + Redis.

## IF YOU DID BUILD IT — the cheap 80%

**Don't start with video.** Start with what Pestle actually does:

1. Paste an Instagram/TikTok **URL**.
2. A Netlify Function fetches the page's **Open Graph / oEmbed metadata** — usually including the
   caption text and a thumbnail. No video download, no auth, no ToS grey area.
3. Caption text → the **existing** Gemini extraction path. Thumbnail → `image_url`.
4. If the caption has no recipe, say so honestly: *"Couldn't find a recipe in this post's caption —
   try screenshotting the recipe instead."*

That's a session or two of work, reuses everything you have, and covers the majority of real
recipe posts (creators generally *do* write the recipe in the caption — that's why Pestle's
text-only approach succeeded commercially). **Video-watching is a separate, much larger task that
should only follow if step 4 fires often.**

## WHY DEFER EVEN THE CHEAP VERSION

- Screenshotting a caption already works, and your Capture flow explicitly handles multiple photos
  plus text in one request (built Aug 6, deliberately).
- The marginal gain is a handful of taps.
- Platform metadata endpoints change without notice — this is code that rots.

## ACCEPTANCE CRITERIA (for the cheap version, if built)

- [ ] Pasting an Instagram or TikTok URL extracts a recipe when the caption contains one
- [ ] Thumbnail saved as `image_url`
- [ ] `source_url` preserved for attribution
- [ ] Caption without a recipe → honest error suggesting the screenshot path, never a hallucination
- [ ] Private/deleted/age-gated post → clear error, no crash
- [ ] Existing text and photo capture paths untouched
- [ ] Refine chat works on the result

## ▶ CLAUDE CODE PROMPT

```
Read .agent/inspiration/TASK_14_social_video_capture.md, then CLAUDE.md and
.agent/DATA_MODELS.md. Read src/lib/recipeExtraction.js and
src/hooks/useRecipeCapture.js.

Build ONLY the caption-based version. Do NOT download or analyse video - that's a
separate, much larger task with real ToS, cost and timeout problems.

Prerequisite: TASK_08 (URL capture) should be done first - this extends the same
Netlify Function and the same fallback-to-Gemini path. Reuse it, don't fork it.

1. Extend netlify/functions/fetch-recipe.js to detect Instagram and TikTok URLs and,
   for those, fetch the post's Open Graph / oEmbed metadata rather than looking for
   JSON-LD. Extract the caption text and the thumbnail URL. Do not attempt to
   download the video.

2. Pass the caption text to the EXISTING Gemini extraction path in
   src/lib/recipeExtraction.js. Save the thumbnail as image_url and the post URL as
   source_url.

3. If the caption contains no recipe, return an honest error telling me to
   screenshot the recipe instead. It must NEVER hallucinate a recipe from a caption
   that doesn't contain one. Handle private, deleted and age-gated posts with a
   clear message, not a crash.

4. The existing text-paste and photo-attach capture paths must be completely
   untouched. Verify explicitly.

Be upfront with me about reliability: these metadata endpoints change without
notice. Add a comment at the top of the handler saying so, and make the failure mode
degrade to the honest error rather than breaking Capture entirely.

Test against 3 real public recipe posts and show me the results. Do not assume you
can reach my dev server.
```

## DECIDE

- [ ] **Not yet** — recommended; screenshots already work
- [ ] **Approve the caption version** (needs TASK_08 first)
- [ ] **Approve full video analysis** — significant cost and ongoing maintenance
