# FEATURE BRIEF: Recipe Discovery Swipe & Weekly Allocation
# Meal Buddy / The Foodies
# Purpose: Swipe-based recipe curation that feeds directly into the weekly plan
# Audience: Gemini CTO Gem + AG @engineer.md then @creator.md (sequential)
# Status: New feature — fully designed and data modelled

---

## WHAT WE ARE BUILDING

A two-phase meal planning flow living in the Discover tab. Phase 1 is a swipe
stack where the user curates a weekly shortlist from the recipe library — right
to keep, left to pass. Phase 2 is the weekly calendar in Planning HQ where
shortlisted recipes get assigned to specific days. The two phases are always
separate — the user never swipes and schedules simultaneously.

Reference FEATURE_planning_tab_overhaul.md for the Planning HQ side of this feature.
This brief covers the swipe and shortlist mechanics only.

---

## PHASE 1 — ENGINEER: SWIPE SESSION DATA LAYER

Reference DATA_MODELS.md for complete interfaces:
SwipeSession, WeeklyPlan, PlanSlot, RecipeSwipeState.

### Core Hook
```typescript
// useSwipeSession.ts
interface UseSwipeSessionReturn {
  swipeStack: Recipe[];           // Unseen recipes, shuffled
  activeSession: SwipeSession;
  shortlistCount: number;
  canShortlist: boolean;          // false when at cap (10)
  swipeRight: (recipeId: string) => void;   // Shortlist
  swipeLeft: (recipeId: string) => void;    // Pass
  getSwipeState: (recipeId: string) => RecipeSwipeState;
  isStackExhausted: boolean;      // true when all recipes seen
}
```

### Session Management
```typescript
const SHORTLIST_CAP = 10;
const WEEK_START_KEY = 'mb_swipe_session_active';

// Get Monday of current week as session key
const getCurrentWeekStart = (): string => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(now.setDate(diff)).toISOString().split('T')[0];
};

// Get or create session for current week
const getOrCreateSession = (): SwipeSession => {
  const existing = localStorage.getItem(WEEK_START_KEY);
  if (existing) {
    const parsed: SwipeSession = JSON.parse(existing);
    if (parsed.weekStartDate === getCurrentWeekStart()) return parsed;
    // Week has changed — archive old session
    archiveSession(parsed);
  }
  const newSession: SwipeSession = {
    id: crypto.randomUUID(),
    weekStartDate: getCurrentWeekStart(),
    createdAt: new Date().toISOString(),
    lockedAt: null,
    seenRecipeIds: [],
    shortlistedRecipeIds: [],
    passedRecipeIds: [],
  };
  localStorage.setItem(WEEK_START_KEY, JSON.stringify(newSession));
  return newSession;
};
```

### Swipe Actions
```typescript
const swipeRight = (recipeId: string) => {
  if (!canShortlist) return; // Guard at cap
  const updated = {
    ...session,
    seenRecipeIds: [...session.seenRecipeIds, recipeId],
    shortlistedRecipeIds: [...session.shortlistedRecipeIds, recipeId],
  };
  saveSession(updated);
};

const swipeLeft = (recipeId: string) => {
  const updated = {
    ...session,
    seenRecipeIds: [...session.seenRecipeIds, recipeId],
    passedRecipeIds: [...session.passedRecipeIds, recipeId],
  };
  saveSession(updated);
};
```

---

## PHASE 2 — CREATOR: SWIPE UI

### Entry Point in Discover Tab
Above the recipe grid, below the page header.
Visible only when the week is not yet locked.

```
CURATE YOUR WEEK                      [eyebrow — gold]
Ready to plan? Start swiping →        [DM Sans 400, 13px, --zinc-400]

[shortlist count if > 0]
3 recipes shortlisted                 [DM Mono 11px, --zinc-500]
```

Tapping enters swipe mode. If shortlist is at cap (10), entry point
instead shows "Shortlist full — go to Plan" linking to Planning HQ.

### Swipe Stack Container

Full-width card stack. Cards are stacked — top card fully visible,
next card peeking behind (scale 0.95, translateY 12px).

Stack height: 480px on standard mobile.
Stack width: full width minus 32px horizontal margin.

### Swipe Card Anatomy

```
┌─────────────────────────────────────┐
│                                     │
│   [Full bleed food image]           │
│   [.img-overlay-hero gradient]      │
│   [.img-glow cinematic side light]  │
│                                     │
│                                     │
│                                     │
│  Easy           20m                 │  ← DM Sans tags, bottom-left
│                                     │
│  Family Pasta Night                 │  ← Playfair Display 700, 24px, --zinc-50
│  600 kcal · 2 servings             │  ← DM Mono 12px, --zinc-400
└─────────────────────────────────────┘
```

Border-radius: --radius-xl (24px)
Shadow: --shadow-hero
Image fallback: zinc gradient + Playfair italic title centered — never a black box

**Recipe title never truncates.** If long, reduce font-size to 20px. Still no ellipsis.

### Swipe Interaction — Touch Handling

```typescript
// Track drag state
let startX = 0;
let currentX = 0;
let isDragging = false;

const SWIPE_THRESHOLD = 80; // px — minimum distance to trigger swipe

onTouchStart: (e) => {
  startX = e.touches[0].clientX;
  isDragging = true;
}

onTouchMove: (e) => {
  if (!isDragging) return;
  currentX = e.touches[0].clientX - startX;
  // Apply transform in real-time — follows finger
  // card.style.transform = `translateX(${currentX}px) rotate(${currentX * 0.05}deg)`
  // Update tint opacity proportionally to drag distance
  // rightTint.style.opacity = Math.max(0, currentX / 150)
  // leftTint.style.opacity = Math.max(0, -currentX / 150)
}

onTouchEnd: () => {
  isDragging = false;
  if (currentX > SWIPE_THRESHOLD) triggerSwipeRight();
  else if (currentX < -SWIPE_THRESHOLD) triggerSwipeLeft();
  else resetCardPosition(); // Snap back if threshold not met
}
```

### Swipe Direction Tints
Subtle color bleed indicating direction — appears during drag, disappears after:

- Right swipe: rgba(74,222,128,0.12) — very faint green, not a bright success flash
- Left swipe: rgba(82,82,91,0.20) — subtle zinc darkening

Both are position:absolute overlays on the card, opacity controlled by drag distance.
Never show text labels like "YES" or "NOPE" — purely visual.

### Exit Animations
On confirmed swipe, card exits with CSS transition (not JS):

```css
.swipe-card.exit-right {
  transition: transform 300ms ease, opacity 200ms ease;
  transform: translateX(120%) rotate(8deg);
  opacity: 0;
}

.swipe-card.exit-left {
  transition: transform 300ms ease, opacity 200ms ease;
  transform: translateX(-120%) rotate(-8deg);
  opacity: 0;
}
```

Next card rises up as current exits — scale and translateY animate from peek
position to full position simultaneously.

### Counter
Top-right of swipe view: "3 / 10" in DM Mono 11px, --zinc-500.
Numerator = shortlisted count. Denominator = cap (10).
Understated — informational, not gamified.

### Stack Exhausted State
When all recipes have been seen:

```
[Playfair Display italic, 20px, --zinc-400, centered]
"You've seen everything."

[DM Sans 300, 14px, --zinc-500, centered]
"Ready to plan your week?"

[Primary pill button]
"Go to Planning HQ →"
```

### Shortlist Cap State
When shortlistedRecipeIds.length === 10, swipe mode ends automatically:

```
[Playfair Display italic, 20px, --zinc-400, centered]
"Shortlist full."

[DM Sans 300, 14px, --zinc-500, centered]
"You have 10 recipes ready to place."

[Primary pill button]
"Go to Planning HQ →"
```

### Exit Button
Small "Done" in top-left corner — DM Sans 400, --zinc-500, ghost style.
Always visible during swipe mode. Exits without clearing shortlist.

---

## FILE STRUCTURE

```
/src/
  components/
    Swipe/
      SwipeEntryPoint.tsx         ← Entry in Discover tab
      SwipeStack.tsx              ← Card stack container
      SwipeCard.tsx               ← Individual recipe card
      SwipeStackExhausted.tsx     ← All recipes seen state
      SwipeCapReached.tsx         ← Shortlist full state
  hooks/
    useSwipeSession.ts            ← Session management and swipe actions
```

---

## EDGE CASES

| Scenario | Handling |
|---|---|
| Recipe library empty | Do not show swipe entry point — show "Add recipes first" |
| All recipes previously passed | Stack exhausted immediately on entry — show exhausted state |
| User at cap tries to swipe right | swipeRight() returns early — no state change |
| Week changes mid-session | Detect on app open — archive old session, create fresh |
| Card drag released below threshold | Snap back to center with spring animation |
| Image fails to load on swipe card | zinc gradient fallback + Playfair italic title |
| User exits and re-enters swipe mode | Resume exactly where left off — seenRecipeIds excludes already-seen |
| Network offline | Swipe stack built from cached recipes — core mechanic works offline |

---

## ACCEPTANCE CRITERIA

- [ ] Swipe entry point visible in Discover tab when week not locked
- [ ] Tapping entry point enters swipe mode
- [ ] Swipe card renders with full bleed image, overlay, and glow
- [ ] Card follows finger during drag in real-time
- [ ] Direction tints appear during drag — faint, not garish
- [ ] Right swipe adds to shortlist, left swipe passes
- [ ] Exit animation fires correctly in both directions
- [ ] Next card rises smoothly as current card exits
- [ ] Counter updates correctly after each swipe
- [ ] Passed recipes do not reappear in stack this session
- [ ] Shortlist cap of 10 enforced — cannot exceed
- [ ] Cap reached state displays and links to Planning HQ
- [ ] Stack exhausted state displays and links to Planning HQ
- [ ] Session persists across app restarts and tab changes
- [ ] Week change auto-archives old session and creates fresh one
- [ ] Image fallback state renders correctly — no broken images
- [ ] Recipe title never truncates — scales down instead
- [ ] All transitions hardware-accelerated — no layout animations
- [ ] Works on mobile Chrome and Safari touch events
