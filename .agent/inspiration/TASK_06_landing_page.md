# TASK 06 — Landing page (in-repo first, publish later)

| | |
|---|---|
| **Feature it improves** | — (new surface) |
| **Impact** | ★★★☆☆ (zero for daily use; high for the family-onboarding step) |
| **Effort** | M |
| **Horizon** | 🟢 NOW (build it), 🔵 LATER (publish it) |
| **Family-readiness** | ✅ Actively supports it — this becomes the invite surface |

---

## WHAT YOU ASKED FOR

> *"At some point I also want to have a landing page built out just real quick... first step would
> just be to have it in the folder so I can inspect it, and then later on we wanna publish it in
> front of the app."*

So: **build it into the repo, don't wire it into routing, don't deploy it.** You inspect, iterate,
and decide later whether it sits in front of the app.

## WHY THIS IS WORTH DOING NOW (not just because you asked)

It has a real job beyond marketing. Your stated next step is onboarding your wife, then another
family. Right now the app opens straight into a dashboard that assumes you already know what it is.
The moment a second person opens the URL, there is **nothing** that explains what this is or what to
do first.

A landing page is the natural home for that — and later, for the invite/join flow that TASK_12 needs.
Building it now means TASK_12 has somewhere to land.

## WHAT THE BEST DO

Deliberately thin section — this is a design task, not a competitive-feature task.

- **`[verified]`** Recipe-app landing pages converge on one pattern: a single strong product shot
  (the app on a phone), one sentence saying what it does, then the loop broken into 3–4 steps. Pestle
  and Umami both lead with the *capture* moment because that's the memorable hook.
- Your differentiator is not "AI meal planner" — the market is saturated with those. It's that this
  is a **personal** tool: your own 400-recipe library, your family's food, no accounts, no upsell.
  Lead with that.

## THE CHANGE

**Location:** `landing/index.html` — a standalone, self-contained static page at the repo root, **not**
inside `src/`. It must not be imported by the Vite app or touch `src/App.jsx`'s routing.

**Why standalone HTML rather than a React route?**
- You can open it directly in a browser to inspect it — no dev server, no build step
- Zero risk of breaking the running app
- Publishing later is a Netlify redirect/config change, not a refactor
- It has no state, no data, no interactivity beyond a link

**Content structure:**
1. **Hero** — the app name, one sentence, one call to action ("Open the app")
2. **The loop** — Capture → Plan → Shop → Cook as four steps, honest about what each does
3. **What it isn't** — no accounts, no subscription, no ads. This is the actual differentiator
4. **Footer** — quiet

**Visual direction:** The Chit Rail, straight from `DESIGN_SYSTEM.md` v3.0.
- `--board` `#14211B` chalkboard-green background, `--ticket` `#F1E7CC` kraft cards
- Zilla Slab headings, IBM Plex Sans body, IBM Plex Mono for every number
- Exactly **one** `--stamp` red element on the page (the CTA) — DESIGN_SYSTEM.md §2 is explicit that
  more than one stamp per screen is a bug
- No `rounded-full` except the stamp; radii from the `--r-*` scale
- No emoji in chrome
- Fonts: the app self-hosts via `@fontsource`, but a standalone HTML file can't import those — use a
  Google Fonts `<link>` here **with a real fallback stack**, and note the divergence in a comment

**Explicitly out of scope:** sign-up forms, email capture, analytics, deployment config.

## WHY DESIGNED THIS WAY

- **Why "what it isn't" as a section?** Because every competitor in the report monetises hard —
  Preplo's "expensive premium subscription", Mealime's walled garden, Umami's ongoing subscription.
  "No account, no subscription, your own recipes" is the one claim none of them can make. It's also
  simply true of your app, which makes it the easiest section to write honestly.
- **Why not build it in React?** Because the value you asked for is *inspecting it quickly*. A React
  route means running the dev server, and PROGRESS.md notes the Browser pane can't reach your dev
  server — so a file you can double-click is strictly better for review.
- **Why one CTA?** Same reason the design system allows one stamp per screen. A landing page with
  three competing buttons has no landing page.

## ACCEPTANCE CRITERIA

- [ ] `landing/index.html` opens correctly by double-clicking it — no server, no build
- [ ] Self-contained: one HTML file, inline CSS, no local asset dependencies, no JS framework
- [ ] Colours, radii and type match DESIGN_SYSTEM.md v3.0 tokens exactly (no invented values)
- [ ] Exactly one `--stamp` red element
- [ ] Every number renders in IBM Plex Mono
- [ ] Responsive: reads well at 375px and at desktop width; no horizontal scroll
- [ ] The Vite app is completely untouched — `git status` shows no changes under `src/`
- [ ] Nothing is deployed

## RISKS / EDGE CASES

- **Don't let it drift from the design system.** A landing page that looks like a different product
  than the app is worse than none. If a token doesn't exist for something, use the nearest one rather
  than inventing.
- Don't write marketing claims the app can't back. No "AI-powered" superlatives — describe the loop.
- Keep the copy in your voice, not startup voice.

---

## ▶ CLAUDE CODE PROMPT

```
Read .agent/inspiration/TASK_06_landing_page.md, then .agent/DESIGN_SYSTEM.md and
.agent/PROJECT.md.

Build a landing page for Meal Buddy as a single self-contained static file at
landing/index.html in the repo root.

HARD CONSTRAINTS:
- Do NOT touch anything under src/. Do NOT add a route. Do NOT modify src/App.jsx,
  vite config, or netlify config. `git status` must show no changes under src/.
- Do NOT deploy anything.
- One HTML file with inline CSS. No React, no build step, no local asset files.
  I must be able to double-click the file and see the finished page.

DESIGN - follow DESIGN_SYSTEM.md v3.0 "The Chit Rail" exactly, no invented values:
- Background --board #14211B, card surfaces --ticket #F1E7CC
- Zilla Slab for headings, IBM Plex Sans for body, IBM Plex Mono for EVERY number
- Since a standalone file can't use the app's @fontsource imports, load these via a
  Google Fonts <link> with a real fallback stack, and leave an HTML comment noting
  the divergence from the app
- EXACTLY ONE element may use --stamp red (#C1442C) - the single call to action.
  DESIGN_SYSTEM.md section 2 says more than one stamp per screen is a bug.
- Radii from the --r-* scale only. No rounded-full except the stamp.
- No emoji anywhere in the chrome.
- Lucide icons only if you use icons at all - inline the SVG, don't link a CDN.

CONTENT - four sections:
1. Hero: app name, one honest sentence, one CTA ("Open the app", linking to
   https://thefoodi.netlify.app)
2. The loop: Capture, Plan, Shop, Cook as four steps. Read PROJECT.md and describe
   what each stage ACTUALLY does today - do not describe features that don't exist.
3. "What it isn't": no accounts, no subscription, no ads, your own recipes. This is
   the real differentiator - every competitor monetises hard.
4. A quiet footer.

Write the copy plainly. No startup voice, no "AI-powered" superlatives, no claims
the app can't back.

Must be responsive - read well at 375px and at desktop, with no horizontal scroll.

When done, just tell me the file path so I can open it. Don't start a server.
```

## DECIDE

- [ ] **Approve** — standalone HTML in `landing/`
- [ ] **Approve, but** build it as a React route inside the app instead
- [ ] **Approve + publish** — also do the Netlify config to put it in front of the app now
