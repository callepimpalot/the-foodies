# FEATURE BRIEF: Planning Tab Overhaul
# Meal Buddy / The Foodies
# Purpose: Redesign Planning HQ from current "chaos" state to calm weekly calendar
# Audience: Gemini CTO Gem + AG @creator.md (UI-led, engineer support if needed)
# Status: High Priority — listed as critical in PROGRESS.md

---

## WHAT WE ARE BUILDING

A complete redesign of the Planning HQ tab. The current implementation has
alignment issues, scaling problems, and visual chaos. This overhaul replaces it
with the calm, editorial weekly calendar described in the feature design sessions —
horizontal scrolling day cards, meal slot allocation, and integration with the
swipe shortlist system.

This is primarily a @creator.md task. @engineer.md is only needed if the
underlying data fetching or state management is broken.

---

## CURRENT PROBLEMS (from PROGRESS.md audit)

- Day cards misaligned and inconsistently scaled
- Visual "chaos" — no clear hierarchy between days and meal slots
- Breakfast/Lunch/Dinner slots all equally prominent — creates noise
- No connection to shortlisted recipes from swipe flow
- Red X remove button uses wrong accent color (should not be red in default state)
- Teal border on selected items violates Zinc design system — must be replaced with gold

---

## TARGET DESIGN

### Page Header
```
Planning HQ                    [DM Sans 300, --zinc-500, subtitle]
Curate your culinary week      [Playfair Display 900, --zinc-50]
```

### Weekly Calendar — Horizontal Scroll Row
Seven day cards displayed as a horizontal scroll row.
Current day is visually distinguished — slightly brighter border (--zinc-500).
Past days are visually dimmed — --zinc-700 text, --zinc-800 background.

**Day Card anatomy:**
```
FRI          [DM Sans 600, 10px, uppercase, --zinc-500]
20           [Playfair Display 900, 28px, --zinc-200]

[Dinner slot — primary, always visible]
[Lunch slot — secondary, collapsed by default]
[Breakfast slot — tertiary, collapsed by default]
```

### Meal Slot States

**Empty (default):**
- Dashed border: 1px dashed --zinc-700
- Label: "+ Dinner" in DM Sans 500, 11px, --zinc-600
- Tap to open recipe picker or accept shortlisted recipe

**Selected (tap-to-place active):**
- Solid border: 1px solid --gold
- Background: --gold-bg
- Label color: --gold
- This state means "I am ready to receive a recipe"

**Filled:**
- Recipe thumbnail image with gradient overlay
- Recipe title: Playfair Display 700, 11px, --cream, bottom-left
- Remove button: Lucide X icon, 16px, --zinc-500 (NOT red unless actively pressed)
- On press of X: icon turns --destructive, one more tap to confirm remove

**Collapsed meal types (Lunch, Breakfast):**
- Single line: "+ Lunch" or "+ Breakfast" in DM Sans 400, 10px, --zinc-700
- Tap to expand into full slot
- Does not take up meaningful space when collapsed

### Shortlist Integration
If the user has shortlisted recipes from the swipe flow, a horizontal row of
compact recipe cards appears between the page header and the day cards:

```
YOUR SHORTLIST  [eyebrow label, --gold]
[recipe card] [recipe card] [recipe card] ...   [horizontal scroll]
```

Each shortlist card:
- Small thumbnail with overlay
- Recipe title: Playfair Display 700, 12px, --cream
- Tap to select → card gets gold border → tap a day slot to place it

Unassigned shortlist recipes persist here until placed or week is locked.
If shortlist is empty, this section does not render.

### Lock Week Button
Appears at bottom of screen, always visible, full width pill:
- Text: "Lock This Week" — Playfair Display 700, 16px
- Background: --zinc-50, text: --zinc-950
- Only active when at least one meal slot is filled
- Disabled state: --zinc-800 background, --zinc-600 text, non-interactive
- On tap: confirmation bottom sheet → "Lock week and generate shopping list?"
  → Confirm → triggers shopping list generation → navigates to Shopping tab

---

## DESIGN SYSTEM RULES

Reference DESIGN_SYSTEM.md for all values. Key rules for this component:

- Background: --zinc-950 everywhere
- Day cards: --zinc-900 background, --zinc-700 border, --radius-lg
- Selected state accent: --gold only — remove all teal/cyan
- Meal slot remove button: --zinc-500 default, --destructive only on confirm press
- Horizontal scroll: no visible scrollbar, scroll-snap on day cards
- All transitions: transform and opacity only — no layout animations
- Touch targets: 44x44px minimum on all interactive elements
- One-handed use: Lock button bottom-anchored, thumb reachable

---

## DATA REQUIREMENTS

The planning tab reads from WeeklyPlan and SwipeSession.
Reference DATA_MODELS.md for complete interfaces.

Key reads:
```typescript
// Active week plan
const { data: weeklyPlan } = await supabase
  .from('weekly_plans')
  .select('*, slots(*)')
  .eq('is_locked', false)
  .single();

// Active swipe session shortlist
const activeSession = JSON.parse(
  localStorage.getItem('mb_swipe_session_active') ?? '{}'
);
const shortlistedIds = activeSession?.shortlistedRecipeIds ?? [];

// Fetch shortlisted recipe details
const { data: shortlistedRecipes } = await supabase
  .from('recipes')
  .select('id, title, image_url')
  .in('id', shortlistedIds);
```

---

## FILE STRUCTURE

```
/src/
  views/
    PlanningView.tsx              ← Main view, replace existing
  components/
    Planning/
      WeekCalendar.tsx            ← Seven day cards, horizontal scroll
      DayCard.tsx                 ← Single day with meal slots
      MealSlot.tsx                ← Individual slot (empty/selected/filled)
      ShortlistRow.tsx            ← Horizontal shortlist recipe row
      LockWeekButton.tsx          ← Bottom CTA with confirmation sheet
      LockConfirmSheet.tsx        ← Confirmation bottom sheet
```

---

## EDGE CASES

| Scenario | Handling |
|---|---|
| No shortlisted recipes | ShortlistRow does not render — no empty state shown |
| All 7 days filled | Lock button becomes fully active, shortlist row dims |
| Week already locked | Show read-only view of the locked plan with "Unlock Week" ghost button |
| Recipe image fails | Filled slot shows zinc gradient + recipe title, no broken image |
| User places recipe then removes it | Slot returns to empty state, recipe returns to shortlist row |
| Shortlist recipe placed on two days | Prevent — isRecipeAlreadyPlaced() check before placement |

---

## ACCEPTANCE CRITERIA

- [ ] Planning HQ tab renders without visual chaos
- [ ] Seven day cards display in horizontal scroll row
- [ ] Current day visually distinguished from others
- [ ] Dinner slot always visible, Lunch and Breakfast collapsed by default
- [ ] Empty, selected, and filled slot states render correctly
- [ ] Gold accent used for selected state — zero teal anywhere
- [ ] Shortlist row appears when shortlisted recipes exist
- [ ] Tap recipe in shortlist → tap day slot → recipe placed correctly
- [ ] Remove button is zinc by default, destructive only on confirm
- [ ] Lock Week button active only when at least one slot is filled
- [ ] Lock confirmation sheet works correctly
- [ ] All touch targets minimum 44x44px
- [ ] No layout shift or jumping on scroll
- [ ] Works correctly on mobile Chrome and Safari
