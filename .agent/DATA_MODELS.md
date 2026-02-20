# 📊 DATA_MODELS.md — Meal Buddy / The Foodies
# Version 1.0
# Source of Truth for all TypeScript interfaces, data shapes, and state models.
# All agents derive schema from this file. Never guess field names or types.

---

## GENERAL RULES

- All IDs are uuid strings, generated on creation
- All timestamps are ISO 8601 strings
- Optional chaining (`?.`) is mandatory on all data access in the UI layer
- Supabase is the source of truth once a table is live — no local mocks
- Special characters in string fields (names, titles) are stored raw, sanitized on render

---

## 1. RECIPE

The core content unit. Already exists in Supabase.

```typescript
interface Recipe {
  id: string;
  title: string;                              // Never truncate in UI — scale font instead
  imageUrl: string;                           // Always apply overlay gradient on render
  cookTimeMinutes: number;
  difficulty: "Easy" | "Medium" | "Hard";
  kcal: number;
  servings: number;
  mealType: "Breakfast" | "Lunch" | "Dinner";
  tags: string[];
  ingredients: Ingredient[];
  steps: string[];
  createdAt: string;
}

interface Ingredient {
  name: string;
  quantity: number | null;
  unit: string | null;                        // "g", "ml", "pieces", "tsp" etc
}
```

---

## 2. HOUSEHOLD ESSENTIALS

### EssentialCategory
User-defined grouping. e.g. Fridge, Pantry, Bathroom, Cleaning, Freezer.

```typescript
interface EssentialCategory {
  id: string;
  name: string;
  sortOrder: number;                          // Controls display order of categories
  createdAt: string;
}
```

### EssentialItem
One item within a category. Represents what the household always wants stocked.

```typescript
interface EssentialItem {
  id: string;
  name: string;                               // Raw string — sanitize on render, never innerHTML
  emoji: string;                              // e.g. "🥚"
  categoryId: string;                         // FK → EssentialCategory.id
  sortOrder: number;                          // Controls display order within category
  createdAt: string;
}
```

### EssentialCheckSession
One instance of the user running through their essentials check. Created when user opens the grid. Persists until shopping list is locked.

```typescript
interface EssentialCheckSession {
  id: string;
  createdAt: string;                          // When this check was started
  lockedAt: string | null;                    // Set when merged into shopping list
  flaggedItemIds: string[];                   // EssentialItem.id values user has flagged
}
```

### State Model
```typescript
type EssentialItemState = "neutral" | "flagged";  // Two states only, nothing else

// Derived — computed from active session
const isFlagged = (itemId: string, session: EssentialCheckSession): boolean =>
  session.flaggedItemIds.includes(itemId);

const flaggedCount = (session: EssentialCheckSession): number =>
  session.flaggedItemIds.length;
```

### Session Lifecycle
```
1. User opens essentials grid
   → Check for active CheckSession
   → If none: create new with empty flaggedItemIds[]
   → If exists: resume — show previously flagged items

2. User taps item
   → If NOT in flaggedItemIds → add (flag)
   → If IN flaggedItemIds → remove (unflag)
   → Instant toggle, no confirmation

3. User navigates away without shopping
   → Session persists exactly as-is

4. User locks shopping list
   → Flagged items merge into ShoppingList as HouseholdItems
   → Session.lockedAt = now
   → New empty session created for next week

5. User manually clears flags
   → flaggedItemIds = []
   → Session remains open
```

### Storage Keys
```
"mb_essential_categories"       // EssentialCategory[]
"mb_essential_items"            // EssentialItem[]
"mb_active_check_session"       // EssentialCheckSession (current)
"mb_archived_check_sessions"    // EssentialCheckSession[] (history)
```

---

## 3. RECIPE DISCOVERY — SWIPE & ALLOCATION

### SwipeSession
One weekly curation pass. Created when user enters swipe mode. Resets on lock.

```typescript
interface SwipeSession {
  id: string;
  weekStartDate: string;                      // ISO 8601 — Monday of current week
  createdAt: string;
  lockedAt: string | null;
  seenRecipeIds: string[];                    // All recipes shown, in order
  shortlistedRecipeIds: string[];             // Swiped right — max 10
  passedRecipeIds: string[];                  // Swiped left — excluded this session
}
```

### WeeklyPlan
Allocation of shortlisted recipes to specific days. One plan per week.

```typescript
interface WeeklyPlan {
  id: string;
  weekStartDate: string;                      // Matches SwipeSession.weekStartDate
  swipeSessionId: string;                     // FK → SwipeSession.id
  slots: PlanSlot[];
  isLocked: boolean;
  lockedAt: string | null;
  createdAt: string;
}
```

### PlanSlot
Single meal assignment — one recipe, one day, one meal type.

```typescript
interface PlanSlot {
  id: string;
  weeklyPlanId: string;                       // FK → WeeklyPlan.id
  recipeId: string;                           // FK → Recipe.id
  dayIndex: number;                           // 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
  mealType: "Breakfast" | "Lunch" | "Dinner";
  assignedAt: string;
}
```

### State Model
```typescript
type RecipeSwipeState = "unseen" | "shortlisted" | "passed";

const SHORTLIST_CAP = 10;

const getSwipeState = (recipeId: string, session: SwipeSession): RecipeSwipeState => {
  if (session.shortlistedRecipeIds.includes(recipeId)) return "shortlisted";
  if (session.passedRecipeIds.includes(recipeId)) return "passed";
  return "unseen";
};

const canShortlist = (session: SwipeSession): boolean =>
  session.shortlistedRecipeIds.length < SHORTLIST_CAP;

// Stack = all recipes not yet seen, shuffled
const getSwipeStack = (allRecipes: Recipe[], session: SwipeSession): Recipe[] =>
  allRecipes
    .filter(r => !session.seenRecipeIds.includes(r.id))
    .sort(() => Math.random() - 0.5);

// Unassigned = shortlisted but not yet placed on a day
const getUnassignedRecipes = (session: SwipeSession, plan: WeeklyPlan): string[] =>
  session.shortlistedRecipeIds.filter(
    id => !plan.slots.some(slot => slot.recipeId === id)
  );

// What's in a specific slot
const getSlotRecipe = (
  plan: WeeklyPlan,
  dayIndex: number,
  mealType: string
): PlanSlot | null =>
  plan.slots.find(s => s.dayIndex === dayIndex && s.mealType === mealType) ?? null;
```

### Allocation Constraints
```typescript
// One recipe per day per meal type
const isDaySlotTaken = (plan: WeeklyPlan, dayIndex: number, mealType: string): boolean =>
  plan.slots.some(s => s.dayIndex === dayIndex && s.mealType === mealType);

// A recipe can only appear once in the plan
const isRecipeAlreadyPlaced = (plan: WeeklyPlan, recipeId: string): boolean =>
  plan.slots.some(s => s.recipeId === recipeId);

const VALID_DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6];
const VALID_MEAL_TYPES = ["Breakfast", "Lunch", "Dinner"];
```

### Session Lifecycle
```
1. User taps "Curate This Week"
   → Check for active SwipeSession matching current weekStartDate
   → If none: create new SwipeSession + empty WeeklyPlan
   → If exists: resume — stack = unseen recipes only

2. User swipes right
   → Validate shortlistedRecipeIds.length < SHORTLIST_CAP
   → Add to shortlistedRecipeIds[] and seenRecipeIds[]
   → If at cap: exit swipe mode, show allocation nudge

3. User swipes left
   → Add to passedRecipeIds[] and seenRecipeIds[]
   → Do not re-show passed recipes this session

4. Stack exhausted
   → Show end state — "You've seen everything. Ready to plan?"
   → Do not loop passed recipes back

5. User allocates recipe to day (Phase 2)
   → Tap recipe → selectedRecipeId set (UI state only)
   → Tap day slot:
     - Empty slot → create PlanSlot
     - Filled slot → delete old PlanSlot, create new one
   → selectedRecipeId cleared

6. User removes recipe from slot
   → Delete PlanSlot from slots[]
   → Recipe returns to unassigned row
   → NOT removed from shortlistedRecipeIds

7. User locks the week
   → WeeklyPlan.isLocked = true, lockedAt = now
   → SwipeSession.lockedAt = now
   → Generate shopping list from locked plan slots
   → Archive session + plan
   → Create fresh empty session + plan for next week
```

### Storage Keys
```
"mb_swipe_session_active"       // SwipeSession (current week)
"mb_swipe_session_archive"      // SwipeSession[] (past weeks)
"mb_weekly_plan_active"         // WeeklyPlan (current week)
"mb_weekly_plan_archive"        // WeeklyPlan[] (past weeks)
```

---

## 4. SHOPPING LIST

### ShoppingListItem
Generated on week lock. Combines meal ingredients + household essentials.

```typescript
interface ShoppingListItem {
  id: string;
  name: string;
  emoji: string | null;
  categoryLabel: string;                      // "Produce", "Dairy", "Household" etc
  sourceType: "meal" | "household";
  sourcePlanSlotId: string | null;            // PlanSlot.id if meal-driven
  sourceSessionId: string | null;             // EssentialCheckSession.id if household
  sourceRecipeId: string | null;              // Recipe.id if meal-driven
  quantity: number | null;
  unit: string | null;
  checked: boolean;                           // false on creation
  checkedAt: string | null;                   // set when ticked in store
}
```

### Consolidation Rules
- Duplicate ingredients across multiple recipes are merged at generation time
- Combined quantities where units match (e.g. two recipes both need 200g chicken → one item at 400g)
- Household essentials always appear under "Household" categoryLabel
- Meal ingredients grouped by department: Produce, Dairy, Meat, Pantry, Bakery, Frozen
- List is static once locked — does not update if plan changes

### Storage Keys
```
"mb_shopping_list_active"       // ShoppingListItem[] (current locked list)
"mb_shopping_list_archive"      // ShoppingListItem[][] (past lists)
```

---

## 5. EDGE CASES — GLOBAL

These apply across all models:

| Scenario | Handling |
|---|---|
| Recipe imageUrl 404 | UI fallback — zinc gradient + Playfair italic title. Never mutate Recipe record. |
| Special chars in names (&, ', ") | Store raw. Sanitize on render via JSX. Never innerHTML. |
| Week changes mid-session | Compare weekStartDate to current Monday. Mismatch → archive old, create fresh. |
| User deletes flagged essential item | Remove from EssentialItem[]. Remove id from activeSession.flaggedItemIds[]. |
| Recipe un-shortlisted after placement | Remove from shortlistedRecipeIds[]. Also remove matching PlanSlot[]. |
| Swipe right at cap | Guard with canShortlist(). If at cap, treat as neutral. Never exceed 10. |
| Empty recipe library | Show prompt to add recipes. Do not enter swipe mode. |
| All essentials neutral | Valid state. Entry point shows "All good." Not an error. |
| Slot already filled on allocation | Replace: delete old PlanSlot, create new. No duplicates. |

---

## 6. CHANGELOG

| Date | Change |
|---|---|
| Feb 20 | v1.0 — Initial data models documented: Recipe, Essentials, Swipe, WeeklyPlan, ShoppingList |
