# FEATURE BRIEF: Shopping Consolidation Engine
# Meal Buddy / The Foodies
# Purpose: Generate a locked static shopping list from the confirmed weekly meal plan
# Audience: Gemini CTO Gem + AG @engineer.md then @creator.md (sequential)
# Status: High Priority backlog item

---

## WHAT WE ARE BUILDING

The Shopping tab's core feature. When the user locks their weekly plan, the app
generates a consolidated, categorised shopping list combining meal ingredients
and flagged household essentials. The list is static — it does not change once
generated. Users tick items off as they shop.

This is the feature that replaces HelloFresh. The user plans meals, locks the
week, walks into any supermarket with this list, and spends a fraction of what
a meal kit service charges.

---

## TWO INPUT SOURCES

### Source 1 — Meal Ingredients
Derived from locked WeeklyPlan slots → each PlanSlot → Recipe.ingredients.
Ingredients from multiple recipes are merged and deduplicated.
Same ingredient appearing in two recipes = one line item with combined quantity.

### Source 2 — Household Essentials
Derived from active EssentialCheckSession.flaggedItemIds.
These are items the user flagged as needing restocking before the shop.
They appear as a separate "Household" category at the bottom of the list.

Reference DATA_MODELS.md for ShoppingListItem interface and consolidation rules.

---

## GENERATION LOGIC

```typescript
const generateShoppingList = async (
  weeklyPlan: WeeklyPlan,
  checkSession: EssentialCheckSession,
  allRecipes: Recipe[],
  allEssentials: EssentialItem[]
): Promise<ShoppingListItem[]> => {

  const items: ShoppingListItem[] = [];

  // Step 1 — Extract ingredients from each locked plan slot
  for (const slot of weeklyPlan.slots) {
    const recipe = allRecipes.find(r => r.id === slot.recipeId);
    if (!recipe) continue;

    for (const ingredient of recipe.ingredients ?? []) {
      const existing = items.find(
        i => i.sourceType === 'meal' &&
        i.name.toLowerCase() === ingredient.name.toLowerCase() &&
        i.unit === ingredient.unit
      );

      if (existing) {
        // Merge quantities if units match
        if (existing.quantity !== null && ingredient.quantity !== null) {
          existing.quantity += ingredient.quantity;
        }
      } else {
        items.push({
          id: crypto.randomUUID(),
          name: ingredient.name,
          emoji: null,
          categoryLabel: categoriseIngredient(ingredient.name), // see below
          sourceType: 'meal',
          sourcePlanSlotId: slot.id,
          sourceRecipeId: slot.recipeId,
          sourceSessionId: null,
          quantity: ingredient.quantity ?? null,
          unit: ingredient.unit ?? null,
          checked: false,
          checkedAt: null,
        });
      }
    }
  }

  // Step 2 — Add flagged household essentials
  for (const itemId of checkSession.flaggedItemIds) {
    const essential = allEssentials.find(e => e.id === itemId);
    if (!essential) continue;

    items.push({
      id: crypto.randomUUID(),
      name: essential.name,
      emoji: essential.emoji,
      categoryLabel: 'Household',
      sourceType: 'household',
      sourcePlanSlotId: null,
      sourceRecipeId: null,
      sourceSessionId: checkSession.id,
      quantity: null,
      unit: null,
      checked: false,
      checkedAt: null,
    });
  }

  return items;
};
```

### Ingredient Categorisation
Map common ingredients to supermarket departments:

```typescript
const categoriseIngredient = (name: string): string => {
  const n = name.toLowerCase();
  if (/chicken|beef|pork|lamb|fish|salmon|tuna|shrimp|bacon|sausage/.test(n)) return 'Meat & Fish';
  if (/milk|cream|butter|cheese|yogurt|egg/.test(n)) return 'Dairy & Eggs';
  if (/bread|baguette|roll|wrap|tortilla/.test(n)) return 'Bakery';
  if (/frozen|ice cream/.test(n)) return 'Frozen';
  if (/pasta|rice|flour|sugar|oil|vinegar|sauce|stock|tin|can|jar/.test(n)) return 'Pantry';
  if (/herb|spice|pepper|salt|cumin|paprika|oregano|basil|thyme/.test(n)) return 'Herbs & Spices';
  return 'Produce'; // Default — fruits, vegetables, fresh items
};
```

Category display order in the UI:
1. Produce
2. Meat & Fish
3. Dairy & Eggs
4. Bakery
5. Pantry
6. Herbs & Spices
7. Frozen
8. Household

---

## INTELLIGENCE CARD

At the top of the Shopping tab, before the list, show a summary card:

```
┌─────────────────────────────────────┐
│  THIS WEEK'S SHOP                   │
│                                     │
│  5 meals  ·  2 people               │
│  34 items  ·  8 categories          │
│  Essentials checked Feb 22          │
│                                     │
│  Generated Sunday 22 Feb, 19:08     │
└─────────────────────────────────────┘
```

Design: --zinc-900 background, --zinc-700 border, --radius-lg.
Title: Playfair Display 700, --zinc-50.
Stats: DM Mono 12px, --zinc-400.
Timestamp: DM Sans 300, 11px, --zinc-500.

---

## SHOPPING LIST UI

### Category Section
```
PRODUCE                          [eyebrow label — DM Sans 600, 10px, uppercase, --zinc-500]
─────────────────────────────
□  Chicken breast    400g        [unchecked item]
□  Cherry tomatoes              [unchecked, no quantity]
✓  Garlic            3 cloves   [checked — strikethrough, --zinc-600 text]
```

### Item Row
- Checkbox: 22px circle, --zinc-700 border by default
- Checked state: --success fill, checkmark, item text strikethrough
- Item name: DM Sans 400, 14px, --zinc-200 (unchecked) or --zinc-600 (checked)
- Quantity + unit: DM Mono 12px, --zinc-500, right-aligned
- Emoji (household items only): shown left of name
- Tap anywhere on row to toggle checked state
- Minimum touch target: 44px height

### Checked Item Behaviour
Checked items stay in place — do not move to bottom.
The user is walking through a store aisle by aisle. Reordering creates confusion.
Checked items simply dim in place. Category grouping is preserved.

### Active Shopping Mode
A persistent "Shopping Mode" toggle at top of tab.
When active:
- Screen wake lock enabled (prevents screen sleeping mid-shop)
- Font sizes increase 20% for easier reading at arm's length
- Checked items collapse after 3 seconds to reduce visual noise
- Exit shopping mode on tab change or explicit toggle off

---

## DRAFT MODE (before lock)

When no week is locked yet, the Shopping tab shows:

```
[Playfair Display italic, --zinc-500, centered]
"Your plan is still in draft."

[DM Sans 300, --zinc-600, centered, max-width 280px]
"Confirm your week in the Plan tab to lock
in your meals and generate your list."

[Ghost button]
"Go to Plan →"
```

No emoji icons. No shopping cart illustration. Clean typographic empty state.

---

## HOUSEHOLD ESSENTIALS ENTRY POINT

Above the draft state / intelligence card, always show:

```
HOUSEHOLD CHECK                 [eyebrow]
3 items flagged · Tap to review [DM Sans 400, --zinc-400]    [chevron right]
```

OR if none flagged:
```
HOUSEHOLD CHECK                 [eyebrow]
All good · Tap to review        [DM Sans 400, --zinc-500]    [chevron right]
```

Tapping opens the Essentials Grid as a bottom sheet.
This entry point is always visible regardless of lock state.

---

## POST-SHOP SYNC

When all items in a category are checked, the category header dims.
When ALL items across the entire list are checked, show:

```
[Playfair Display italic, 20px, --zinc-400, centered]
"Shop complete."

[DM Sans 300, 14px, --zinc-500, centered]
"Great week ahead."

[Ghost button]
"Archive this list"
```

Archiving: set ShoppingList to archived state in storage.
Create fresh empty state for next week.
Do NOT auto-archive — user must confirm.

---

## STORAGE

```typescript
// Save generated list
localStorage.setItem('mb_shopping_list_active', JSON.stringify(items));

// Archive on completion
const archive = JSON.parse(localStorage.getItem('mb_shopping_list_archive') ?? '[]');
archive.push({ items, archivedAt: new Date().toISOString() });
localStorage.setItem('mb_shopping_list_archive', JSON.stringify(archive));
localStorage.removeItem('mb_shopping_list_active');
```

---

## FILE STRUCTURE

```
/src/
  views/
    ShoppingView.tsx              ← Main view, replace existing
  components/
    Shopping/
      IntelligenceCard.tsx        ← Summary card at top
      ShoppingCategorySection.tsx ← Category header + item list
      ShoppingItemRow.tsx         ← Single item with checkbox
      HouseholdCheckEntry.tsx     ← Always-visible essentials entry point
      ShopCompleteState.tsx       ← All items checked state
      DraftModeState.tsx          ← Pre-lock empty state
  hooks/
    useShoppingList.ts            ← Generation, toggle, archive logic
  lib/
    consolidateIngredients.ts     ← Merge and categorise logic
```

---

## ACCEPTANCE CRITERIA

- [ ] Shopping tab shows draft state correctly when no week is locked
- [ ] Locking week triggers list generation automatically
- [ ] Intelligence card shows correct meal count, item count, person count
- [ ] Items correctly grouped by category in display order
- [ ] Duplicate ingredients merged with combined quantities
- [ ] Household flagged items appear in Household category
- [ ] Tapping item row toggles checked state
- [ ] Checked items show strikethrough and dimmed text
- [ ] Checked items stay in position — no reordering
- [ ] Shopping Mode increases font size and enables screen wake lock
- [ ] Household check entry point always visible
- [ ] Shop complete state appears when all items checked
- [ ] Archive works correctly — clears active list
- [ ] All touch targets minimum 44px
- [ ] No teal anywhere — gold accent only for active states
- [ ] Works on mobile Chrome and Safari
