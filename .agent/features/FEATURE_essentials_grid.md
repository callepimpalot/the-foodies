# FEATURE BRIEF: Household Essentials Quick-Check Grid
# Meal Buddy / The Foodies
# Purpose: Pre-shop household essentials check — tap to flag items needing restocking
# Audience: Gemini CTO Gem + AG @engineer.md then @creator.md (sequential)
# Status: New feature — fully designed and data modelled

---

## WHAT WE ARE BUILDING

A pre-shop scanning tool that lives in the Shopping tab. The user maintains a list
of household staples grouped by category. Before each weekly shop, they open the
grid, scan with their eyes, and tap anything that needs restocking. Flagged items
stage quietly until the user decides to shop — then they merge into the locked
shopping list under a "Household" category.

This is NOT a pantry tracker. It does not track quantities or stock levels.
It is a 90-second weekly ritual that removes the mental load of remembering
what's running low around the house.

---

## THE CORE PHILOSOPHY

Two states only: neutral (fine) and flagged (need it).
No quantities. No stock levels. No sync required between taps.
The list itself is the source of truth — the user maintains it once
and scans it weekly forever.

---

## PHASE 1 — ENGINEER: DATA LAYER

### Data Model
Reference DATA_MODELS.md for complete interfaces.
Key types: EssentialCategory, EssentialItem, EssentialCheckSession.

### Storage Implementation
```typescript
// Keys
const STORAGE_KEYS = {
  categories: 'mb_essential_categories',
  items: 'mb_essential_items',
  activeSession: 'mb_active_check_session',
  archivedSessions: 'mb_archived_check_sessions',
};

// Load all essentials data
const loadEssentials = () => ({
  categories: JSON.parse(localStorage.getItem(STORAGE_KEYS.categories) ?? '[]'),
  items: JSON.parse(localStorage.getItem(STORAGE_KEYS.items) ?? '[]'),
});

// Get or create active session
const getOrCreateSession = (): EssentialCheckSession => {
  const existing = localStorage.getItem(STORAGE_KEYS.activeSession);
  if (existing) return JSON.parse(existing);
  const newSession: EssentialCheckSession = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    lockedAt: null,
    flaggedItemIds: [],
  };
  localStorage.setItem(STORAGE_KEYS.activeSession, JSON.stringify(newSession));
  return newSession;
};

// Toggle item flag
const toggleFlag = (itemId: string, session: EssentialCheckSession): EssentialCheckSession => {
  const flaggedItemIds = session.flaggedItemIds.includes(itemId)
    ? session.flaggedItemIds.filter(id => id !== itemId)
    : [...session.flaggedItemIds, itemId];
  const updated = { ...session, flaggedItemIds };
  localStorage.setItem(STORAGE_KEYS.activeSession, JSON.stringify(updated));
  return updated;
};
```

### Hook Interface
```typescript
// useEssentials.ts
interface UseEssentialsReturn {
  categories: EssentialCategory[];
  items: EssentialItem[];
  activeSession: EssentialCheckSession;
  flaggedCount: number;
  isFlagged: (itemId: string) => boolean;
  toggleFlag: (itemId: string) => void;
  addCategory: (name: string, emoji: string) => void;
  addItem: (categoryId: string, name: string, emoji: string) => void;
  deleteItem: (itemId: string) => void;
  clearFlags: () => void;
  mergeIntoShoppingList: () => ShoppingListItem[];
}
```

---

## PHASE 2 — CREATOR: UI COMPONENTS

### Entry Point in Shopping Tab
Always visible in Shopping tab regardless of lock state.
Positioned above the draft state / intelligence card.

```
HOUSEHOLD CHECK                       [eyebrow — DM Sans 600, 10px, gold]
3 items flagged · Tap to review  →    [DM Sans 400, 14px, --zinc-400]
```

If nothing flagged:
```
HOUSEHOLD CHECK                       [eyebrow]
All good · Tap to review         →    [DM Sans 400, 14px, --zinc-500]
```

Entire row is tappable. Opens essentials grid as bottom sheet.

### Essentials Grid Bottom Sheet

Full-height bottom sheet, --zinc-900 background, --radius-xl top corners.

**Header:**
```
Household Essentials              [Playfair Display 700, 22px, --zinc-50]
Tap anything you need to restock  [DM Sans 300, 13px, --zinc-400]

[X close button — top right, Lucide X, --zinc-500]
```

**Category sections:**
Each category renders as a labeled section with a 3-column grid of item cards.

```
FRIDGE                            [eyebrow — DM Sans 600, 10px, uppercase, --zinc-500]
┌──────┐  ┌──────┐  ┌──────┐
│  🥚  │  │  🥛  │  │  🧀  │
│ Eggs │  │ Milk │  │Cheese│    ← neutral state
└──────┘  └──────┘  └──────┘
┌──────┐
│  🧈  │
│Butter│                         ← flagged state (gold tint)
└──────┘

PANTRY
...
```

**Item card — neutral state:**
- Background: --zinc-800
- Border: 1px solid --zinc-700
- Border radius: --radius-sm (10px)
- Emoji: 20px, centered, margin-bottom 4px
- Name: DM Sans 400, 11px, --zinc-400, centered
- Padding: 10px 8px

**Item card — flagged state:**
- Background: rgba(201,169,110,0.08) [--gold-bg]
- Border: 1px solid rgba(201,169,110,0.3) [--gold-border]
- Name color: --gold (#c9a96e)
- Everything else identical

**Tap interaction:**
- Instant toggle on single tap
- scale(0.96) on active press, returns immediately
- No confirmation. No animation delay.
- Hardware-accelerated: transform only

**Footer:**
```
[Clear All — ghost button, left-aligned, DM Sans 400, --zinc-500]
[Done — primary pill button, right-aligned, full width on mobile]
```

Done button closes the bottom sheet.
If items are flagged, entry point in Shopping tab updates count immediately.

### Manage Mode (add/remove items)
A small "Edit" button in the sheet header (top left, ghost style).
Toggles manage mode which reveals:
- Delete button (Lucide Trash2, 14px) on each item card
- "Add Item" card in each category — tapping opens a simple input:
  - Emoji picker (simple text input accepting single emoji)
  - Item name input
  - "Add" confirm button
- "Add Category" option at the bottom of the sheet

Keep manage mode simple — this is not a primary workflow, it is setup/maintenance.

---

## EMPTY STATE

If the user has no categories or items set up yet:

```
[Playfair Display italic, 20px, --zinc-500, centered]
"Nothing here yet."

[DM Sans 300, 13px, --zinc-600, centered, max-width 260px]
"Add the things you always want
stocked at home."

[Primary button]
"Add your first category"
```

---

## DEFAULT SEED DATA (optional)

On first launch with empty essentials, optionally pre-populate with sensible
defaults the user can edit. Keep it minimal:

```typescript
const DEFAULT_CATEGORIES = [
  {
    name: 'Fridge',
    items: [
      { name: 'Milk', emoji: '🥛' },
      { name: 'Eggs', emoji: '🥚' },
      { name: 'Butter', emoji: '🧈' },
      { name: 'Cheese', emoji: '🧀' },
    ]
  },
  {
    name: 'Pantry',
    items: [
      { name: 'Olive Oil', emoji: '🫙' },
      { name: 'Pasta', emoji: '🍝' },
      { name: 'Rice', emoji: '🍚' },
      { name: 'Coffee', emoji: '☕' },
    ]
  },
  {
    name: 'Household',
    items: [
      { name: 'Washing up', emoji: '🧴' },
      { name: 'Bin bags', emoji: '🗑️' },
    ]
  },
];
```

---

## FILE STRUCTURE

```
/src/
  components/
    Essentials/
      HouseholdCheckEntry.tsx     ← Entry point row in Shopping tab
      EssentialsSheet.tsx         ← Full bottom sheet container
      EssentialsCategorySection.tsx ← Category label + 3-col grid
      EssentialItemCard.tsx       ← Single item, neutral + flagged states
      EssentialsManageMode.tsx    ← Add/remove items interface
      EssentialsEmptyState.tsx    ← First-time empty state
  hooks/
    useEssentials.ts              ← All data logic
```

---

## EDGE CASES

| Scenario | Handling |
|---|---|
| Empty categories list | Show empty state with "Add first category" CTA |
| Category with no items | Do not render category section — filter empty categories |
| All items neutral | Valid state — entry point shows "All good" |
| All items flagged | Valid — no cap on flagged items |
| User deletes flagged item | Remove from items[], remove from session.flaggedItemIds[] |
| Session older than 7 days | Auto-archive old session, create fresh one |
| Merge called with empty flaggedItemIds | Returns empty array — no household items added to list |
| Special characters in item names | Store raw, render via JSX only — never innerHTML |

---

## ACCEPTANCE CRITERIA

- [ ] Household Check entry point visible in Shopping tab always
- [ ] Entry point shows correct flagged count
- [ ] Bottom sheet opens on tap, closes on Done or backdrop tap
- [ ] Items render in 3-column grid grouped by category
- [ ] Neutral and flagged states visually distinct and correct
- [ ] Single tap toggles flag instantly with scale feedback
- [ ] Flagged state uses gold accent — zero teal
- [ ] Done closes sheet and updates entry point count
- [ ] Clear All resets all flags in current session
- [ ] Manage mode allows adding and removing items
- [ ] New items appear immediately without refresh
- [ ] Deleted items removed immediately
- [ ] Flagged items merge correctly into shopping list on week lock
- [ ] Session persists across app restarts
- [ ] Empty state shows correctly on first launch
- [ ] Works on mobile Chrome and Safari
