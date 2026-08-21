# TASK 02 — Screen stays awake in Cook Mode

| | |
|---|---|
| **Feature it improves** | Cook |
| **Impact** | ★★★★★ |
| **Effort** | XS (~30 minutes) |
| **Horizon** | 🟢 NOW |
| **Family-readiness** | ✅ No implications — pure device-local behaviour |

---

## THE GAP

`src/views/CookModeView.jsx` renders steps and a countdown timer, but does nothing to stop the phone
sleeping. Your device's auto-lock (30s or 1 min for most people) fires mid-recipe.

Your own design brief, verbatim from `DESIGN_SYSTEM.md:18`:

> *"One dad, a phone propped against a spice rack — a ticket rail earns its warmth by being useful first."*

A phone propped against a spice rack that blacks out every 30 seconds, and needs a greasy thumb or a
face-unlock at a bad angle to wake, is **failing that brief at the one moment the app exists for.**

This is the highest impact-to-effort ratio item in the entire backlog: roughly 25 lines of code.

## WHAT THE BEST DO

- **`[verified]`** The Screen Wake Lock API is now supported in **every** major browser — Chrome,
  Safari, Firefox — with global support above 94% as of May 2026. web.dev's own announcement post
  uses *following a baking recipe with your hands full of dough* as the motivating example. This is
  literally the API's poster use case.
- **`[verified]`** Safari on iOS/iPadOS has supported it since **16.4**. There was a long-standing
  WebKit bug where it did **not** work in installed Home Screen web apps — **fixed by Apple in iOS
  18.4**. Since your app is an installed PWA (PROJECT.md), this bug would have bitten you; it's now
  resolved, which is part of why this is worth doing *now* rather than a year ago.
- **`[report only]`** The report specifies wake-lock directly in its `<StepByStepCookMode />`
  component spec, alongside voice control.

## THE CHANGE

1. New hook `src/hooks/useWakeLock.js`:
   - requests `navigator.wakeLock.request('screen')` on mount
   - **re-acquires on `visibilitychange`** — the lock is auto-released whenever the tab is hidden and
     is *not* restored automatically. Skipping this is the single most common bug in wake-lock
     implementations.
   - releases on unmount
   - feature-detects and no-ops silently if unsupported
   - returns `{ isActive, isSupported }`
2. Call it from `CookModeView.jsx`.
3. Show a small, quiet indicator that the screen is being held awake — a Lucide icon + eyebrow label
   in the Cook Mode chrome. Not a toast, not a modal.

**Explicitly out of scope:** voice control ("Next Step"). The report bundles it in; it needs mic
permission, wake-word handling, and fails in a noisy kitchen. Different task, much worse ratio.

## WHY DESIGNED THIS WAY

- **Why automatic rather than a toggle?** There is exactly one reason to be on the Cook Mode screen.
  A toggle is a setting you'd have to find, and would forget. Cook Mode is already a deliberate
  `fixed inset-0` full-screen mode you enter on purpose — entering it *is* the consent.
- **Why show an indicator at all, if it's automatic?** Because a phone that mysteriously never sleeps
  is alarming, and because when it *silently fails* (unsupported browser, OS low-power mode) you want
  to know before you're elbow-deep in a recipe rather than after. The indicator is honest signalling,
  not decoration.
- **Why not `NoSleep.js`?** The classic workaround library plays a hidden looping video to defeat
  auto-lock. That was necessary in 2019. It burns battery, can hijack the media session, and is
  entirely unnecessary now that native support is >94%. Use the platform.

## ACCEPTANCE CRITERIA

- [ ] Enter Cook Mode on the phone, don't touch it for 3 minutes → screen stays on
- [ ] Leave Cook Mode → screen resumes normal auto-lock behaviour (verify — a leaked lock is a
      battery bug that's easy to miss)
- [ ] Switch to another app and back → lock is **re-acquired**, screen stays on again
- [ ] Indicator reflects real state, including the failure case
- [ ] No console errors on a browser without support
- [ ] Battery/low-power mode refusal is handled without crashing

## RISKS / EDGE CASES

- `wakeLock.request()` **rejects** if the document isn't visible or the device is in low-power mode.
  Must be wrapped in try/catch — an unhandled rejection here would surface as a crash.
- iOS Low Power Mode refuses the lock outright. Correct behaviour is to reflect that in the
  indicator, not to retry in a loop.
- Don't hold the lock outside Cook Mode. Verify the release actually fires on unmount.

---

## ▶ CLAUDE CODE PROMPT

```
Read .agent/inspiration/TASK_02_cook_mode_wake_lock.md, then CLAUDE.md and
.agent/DESIGN_SYSTEM.md before writing any code.

Keep the screen awake while the user is in Cook Mode, using the native Screen Wake
Lock API.

Create src/hooks/useWakeLock.js exporting useWakeLock(). It must:
- feature-detect 'wakeLock' in navigator and no-op silently if absent
- request navigator.wakeLock.request('screen') on mount, in a try/catch (it rejects
  on hidden documents and in low-power mode - that must not crash)
- add a 'visibilitychange' listener that RE-ACQUIRES the lock when the document
  becomes visible again. The lock is auto-released when the tab hides and is not
  restored automatically. This is the most commonly missed part - do not skip it.
- release the lock and remove all listeners on unmount
- return { isActive, isSupported }

Use it in src/views/CookModeView.jsx.

Add a small indicator in the Cook Mode chrome showing the screen is being held
awake - a Lucide icon plus a .t-eyebrow label. It must reflect real state: show
nothing (or a distinct inactive state) when isSupported is false or the request was
refused. Do not use a toast or a modal.

Do NOT implement voice control - explicitly out of scope for this task.

Constraints:
- No hardcoded colors or spacing - DESIGN_SYSTEM.md tokens only.
- No emoji in UI chrome (DESIGN_SYSTEM.md section 2, Forbidden).
- Lucide icons only, 18-20px, currentColor.
- Mandatory optional chaining on data access.

Note that CookModeView renders as `fixed inset-0` and therefore escapes App.jsx's
global padding container - it owns its own horizontal inset (DESIGN_SYSTEM.md
section 4).

When done, give me a hand-test checklist for my phone, including how to confirm the
lock is properly RELEASED when leaving Cook Mode (a leaked lock is a battery bug).
Do not assume you can reach my dev server.
```

## DECIDE

- [ ] **Approve** — build as specified
- [ ] **Approve + add voice control** (significantly larger; recommend splitting)
- [ ] **Defer**
