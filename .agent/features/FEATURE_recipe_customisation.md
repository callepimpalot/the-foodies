# FEATURE BRIEF: AI Recipe Customisation (Fork & Personalise)
# Meal Buddy / The Foodies
# Purpose: Let users customise any recipe with AI assistance and save a personal version
# Audience: Gemini CTO Gem + AG @engineer.md then @creator.md (sequential)
# Status: NOT STARTED

---

## WHAT WE ARE BUILDING

A feature that lets any user take any recipe in the library, describe how they
want it changed — in plain language — and have AI rewrite the recipe to match.
The result is saved as a personal fork: a new recipe in their collection that
references the original but lives independently.

The original recipe is never modified. The fork belongs to the user.
Forks can be used in planning, shopping, and Cook Mode exactly like any other recipe.

Examples of what users will say:
- "Make this dairy free"
- "I don't have pine nuts, swap for walnuts"
- "Add more protein, maybe double the chicken"
- "Cut the calories roughly in half"
- "My daughter is allergic to eggs, remove them"
- "Make this spicier"
- "Turn this into a meal prep version for 6 servings"

---

## WHY THIS IS DIFFERENTIATING

No mainstream meal planner does recipe customisation well. They either let you
edit ingredients manually (tedious) or offer nothing. An AI that understands
"make this dairy free" and rewrites every affected ingredient and step is
genuinely magical and immediately useful.

It also makes the app deeply personal over time — a user's fork collection
becomes their own customised cookbook that no other product has.

Connection to family profiles: if a family member has a nut allergy saved
in their profile, the app can proactively surface "Make this nut-free" as
a suggestion when that recipe is viewed. This is the long-term vision —
for now, implement smart suggestions based on recipe content only.

---

## USER FLOW

```
1. User views any recipe (detail screen)
2. Taps "Customise" button — subtle, below the primary Cook button
3. Customisation sheet slides up (full height bottom sheet)
4. Sheet shows:
   a. Recipe name and thumbnail at top (context anchor)
   b. Smart suggestion chips (4-5 based on recipe content)
   c. Free-text input: "Describe your change..."
   d. "Customise" CTA button
5. User taps a suggestion OR types their own request OR both
6. Loading state: "Rewriting your recipe..."
7. Preview screen shows the customised recipe:
   - Diff highlighted: changed ingredients in gold, removed in strikethrough
   - Updated steps shown in full
   - Fork name pre-filled as "[Original Name] — Customised" (editable)
8. User reviews — can go back and tweak the prompt if not right
9. User taps "Save to My Collection"
10. Fork saved to Supabase as a new Recipe record with isPersonal: true
11. Success: "Saved to your collection"
12. Fork immediately available in Discover tab (personal collection filter)
    and in Planning HQ shortlist
```

---

## SMART SUGGESTIONS — LOGIC

Analyse the recipe content to generate contextual suggestion chips.
These are generated client-side based on simple ingredient matching — no AI call needed.

```typescript
const generateSuggestions = (recipe: Recipe): string[] => {
  const suggestions: string[] = [];
  const ingredients = recipe.ingredients.map(i => i.name.toLowerCase()).join(' ');
  const fullText = `${ingredients} ${recipe.steps.join(' ')}`.toLowerCase();

  if (/milk|cream|butter|cheese|yogurt|ghee/.test(fullText))
    suggestions.push('Make it dairy free');

  if (/chicken|beef|pork|lamb|meat|bacon/.test(fullText))
    suggestions.push('Boost the protein');

  if (/pasta|rice|bread|flour|potato/.test(fullText))
    suggestions.push('Make it lower carb');

  if (/nut|walnut|almond|cashew|pecan|pine nut/.test(fullText))
    suggestions.push('Make it nut free');

  if (/egg/.test(fullText))
    suggestions.push('Make it egg free');

  if (recipe.kcal && recipe.kcal > 500)
    suggestions.push('Lighten it up');

  if (recipe.servings <= 2)
    suggestions.push('Scale up for meal prep');

  if (recipe.cookTimeMinutes > 30)
    suggestions.push('Make it quicker');

  // Always include as fallback
  suggestions.push('Make it spicier');

  return suggestions.slice(0, 5); // Max 5 chips
};
```

---

## PHASE 1 — ENGINEER: AI CUSTOMISATION PIPELINE

### The AI Prompt

Send to Gemini Vision API (same client already in the project).
Model: gemini-1.5-flash

```typescript
const buildCustomisationPrompt = (recipe: Recipe, userRequest: string): string => `
You are a professional chef and recipe editor. You will be given a recipe and
a customisation request. Rewrite the recipe to fulfil the request.

ORIGINAL RECIPE:
Title: ${recipe.title}
Cook time: ${recipe.cookTimeMinutes} minutes
Servings: ${recipe.servings}
Kcal: ${recipe.kcal}
Difficulty: ${recipe.difficulty}

Ingredients:
${recipe.ingredients.map(i =>
  `- ${i.quantity ?? ''} ${i.unit ?? ''} ${i.name}`.trim()
).join('\n')}

Steps:
${recipe.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

CUSTOMISATION REQUEST:
${userRequest}

RULES:
- Fulfil the request faithfully and completely
- If removing an ingredient, also remove or update any steps that reference it
- If adding protein, adjust quantities sensibly for the serving count
- Update the kcal estimate if the change meaningfully affects calories
- Update cookTimeMinutes if the change meaningfully affects time
- Keep the same serving count unless the request is specifically to scale
- Preserve the spirit and character of the original dish
- Do not add unnecessary complexity
- Return ONLY a valid JSON object. No markdown. No explanation. No backticks.

Return exactly this JSON structure:
{
  "title": "string — keep original title, do not append 'modified' or 'customised'",
  "cookTimeMinutes": number,
  "servings": number,
  "difficulty": "Easy" | "Medium" | "Hard",
  "kcal": number,
  "ingredients": [
    { "name": "string", "quantity": number | null, "unit": "string | null" }
  ],
  "steps": ["string"],
  "changedIngredientNames": ["string"],
  "removedIngredientNames": ["string"],
  "summaryOfChanges": "string — one sentence describing what changed"
}
`;
```

### Parsing and Validation

```typescript
interface CustomisationResult {
  title: string;
  cookTimeMinutes: number;
  servings: number;
  difficulty: "Easy" | "Medium" | "Hard";
  kcal: number;
  ingredients: Ingredient[];
  steps: string[];
  changedIngredientNames: string[];
  removedIngredientNames: string[];
  summaryOfChanges: string;
}

const parseCustomisationResult = (rawText: string): CustomisationResult => {
  const cleaned = rawText
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (!parsed.title || !Array.isArray(parsed.ingredients) || !Array.isArray(parsed.steps)) {
      throw new Error('Invalid response structure');
    }

    return {
      title: parsed.title,
      cookTimeMinutes: parsed.cookTimeMinutes ?? 30,
      servings: parsed.servings ?? 2,
      difficulty: parsed.difficulty ?? 'Easy',
      kcal: parsed.kcal ?? 0,
      ingredients: parsed.ingredients,
      steps: parsed.steps,
      changedIngredientNames: parsed.changedIngredientNames ?? [],
      removedIngredientNames: parsed.removedIngredientNames ?? [],
      summaryOfChanges: parsed.summaryOfChanges ?? 'Recipe customised',
    };
  } catch {
    throw new Error('Could not process that customisation. Please try rephrasing.');
  }
};
```

### Saving the Fork to Supabase

```typescript
interface RecipeFork extends Recipe {
  isPersonal: boolean;            // true for all forks
  originalRecipeId: string;       // FK → Recipe.id of the source
  customisationNote: string;      // What the user asked for
  summaryOfChanges: string;       // AI summary of what changed
  createdBy: string;              // UserProfile.id — scoped to user
}

const saveFork = async (
  original: Recipe,
  result: CustomisationResult,
  userRequest: string,
  forkName: string,
  userId: string
): Promise<string> => {
  const fork = {
    id: crypto.randomUUID(),
    title: sanitizeString(forkName),
    image_url: original.imageUrl,   // Inherit parent image
    cook_time_minutes: result.cookTimeMinutes,
    difficulty: result.difficulty,
    kcal: result.kcal,
    servings: result.servings,
    meal_type: original.mealType,
    tags: [...(original.tags ?? []), 'personal', 'customised'],
    ingredients: result.ingredients.map(i => ({
      ...i,
      name: sanitizeString(i.name),
    })),
    steps: result.steps,
    is_personal: true,
    original_recipe_id: original.id,
    customisation_note: sanitizeString(userRequest),
    summary_of_changes: result.summaryOfChanges,
    created_by: userId,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('recipes')
    .insert(fork)
    .select('id')
    .single();

  if (error) throw new Error(`Failed to save recipe: ${error.message}`);
  return data.id;
};
```

### Supabase Table — Additional Columns Required

Run this SQL in Supabase Dashboard → SQL Editor before building:

```sql
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS is_personal BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS original_recipe_id UUID REFERENCES public.recipes(id),
  ADD COLUMN IF NOT EXISTS customisation_note TEXT,
  ADD COLUMN IF NOT EXISTS summary_of_changes TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- RLS: personal recipes only visible to their creator
CREATE POLICY "Users can see their own personal recipes"
  ON public.recipes FOR SELECT
  USING (
    is_personal = FALSE OR created_by = auth.uid()
  );

CREATE POLICY "Users can create personal recipes"
  ON public.recipes FOR INSERT
  WITH CHECK (
    is_personal = FALSE OR created_by = auth.uid()
  );

CREATE POLICY "Users can delete their own personal recipes"
  ON public.recipes FOR DELETE
  USING (created_by = auth.uid());
```

### Hook Interface

```typescript
// hooks/useRecipeCustomisation.ts
interface UseRecipeCustomisationReturn {
  isLoading: boolean;
  error: string | null;
  result: CustomisationResult | null;
  suggestions: string[];
  customise: (recipe: Recipe, request: string) => Promise<void>;
  saveFork: (forkName: string) => Promise<string>;
  reset: () => void;
}
```

---

## PHASE 2 — CREATOR: UI COMPONENTS

### Entry Point — Recipe Detail Screen

Below the primary "Cook Now" button, add a secondary button:

```
[Cook Now — primary pill, full width, existing]

[Customise with AI — secondary pill, full width]
  Lucide Wand2 icon, 16px, 1.5px stroke, left of text
  DM Sans 500, 14px, --zinc-200
  Background: --zinc-800
  Border: 1px solid --zinc-700
```

### Customisation Bottom Sheet

Full-height bottom sheet. Background: --zinc-800. Top corners --radius-xl.

**Header:**
```
[Recipe thumbnail — 48px circle, left-aligned, with gradient overlay]
[Recipe title — Playfair Display 700, 16px, --zinc-50, next to thumbnail]
[Subtitle — DM Sans 300, 12px, --zinc-400]
"Describe how you'd like to change this"
```

**Suggestion chips:**
```
[Make it dairy free] [Boost the protein] [Make it lower carb] [Lighten it up]
```

Chip style — unselected:
- Background: --zinc-700
- Border: 1px solid --zinc-600
- Text: DM Sans 400, 12px, --zinc-400
- Border-radius: --radius-pill
- Padding: 8px 14px

Chip style — selected:
- Background: --gold-bg
- Border: 1px solid --gold-border
- Text: DM Sans 500, 12px, --gold

Multiple chips can be selected simultaneously.
Selected chips are concatenated into the request: "Make it dairy free. Boost the protein."

**Free text input:**
```
[Placeholder: "Or describe your own change..."]
[Background: --zinc-900]
[Border: 1px solid --zinc-700]
[Focus border: --zinc-500]
[Text: DM Sans 400, 14px, --zinc-200]
[Min-height: 80px, multiline]
[Border-radius: --radius-sm]
```

**CTA:**
```
[Customise — primary pill, full width]
[Playfair Display 700, 16px]
[Background: --zinc-50, text: --zinc-950]
[Disabled if no chips selected AND input is empty]
```

### Loading State

Replaces sheet content during AI call. Calm, not a spinner:

```
[Playfair Display italic, 18px, --zinc-400, centered]
"Rewriting your recipe..."

[DM Sans 300, 13px, --zinc-500, centered, margin-top: 8px]
"This takes about 10 seconds."

[Subtle pulsing opacity on the title text — 2s loop, 0.4 to 1]
```

### Preview Screen

Replaces the sheet after successful customisation. Full height.

**Header:**
```
[← Back — ghost button, top left, goes back to customisation sheet]

CUSTOMISED VERSION             [eyebrow — gold]
[Fork name input — editable, Playfair Display 700, 20px, --zinc-50]
  Pre-filled as original title. User can rename before saving.

[Summary pill — DM Sans 400, 12px, --zinc-400, --zinc-800 background]
  e.g. "Dairy substituted with oat milk alternatives"
```

**Ingredients diff:**
```
INGREDIENTS                    [eyebrow]

[Normal ingredient — unchanged]
  • 200g chicken breast         [DM Sans 400, 14px, --zinc-200]

[Changed ingredient — gold tint]
  • 200ml oat cream             [DM Sans 400, 14px, --gold]
  (was: 200ml double cream)     [DM Sans 300, 11px, --zinc-500, italic]

[Removed ingredient — strikethrough]
  • ~~Parmesan cheese~~          [DM Sans 400, 14px, --zinc-600, text-decoration: line-through]
```

**Steps:**
```
STEPS                          [eyebrow]
1. [step text — DM Sans 400, 14px, --zinc-200, line-height 1.6]
2. ...
```

**Footer CTAs:**
```
[Save to My Collection — primary pill, full width]
  Playfair Display 700, 16px, --zinc-50 background, --zinc-950 text

[Try a different change — ghost button, centered]
  DM Sans 400, 13px, --zinc-400
  Goes back to customisation sheet with previous prompt preserved
```

### Success State

Brief overlay after save — 2 seconds then auto-dismiss:

```
[Playfair Display italic, 20px, --zinc-50, centered]
"Saved to your collection."

[DM Sans 300, 13px, --zinc-400, centered]
"Find it in your personal recipes."
```

---

## PERSONAL COLLECTION IN DISCOVER TAB

Add a filter toggle at the top of the Discover tab:

```
[All Recipes]  [My Recipes]   ← two-segment toggle, --zinc-800 track
```

"My Recipes" shows only recipes where is_personal = true AND created_by = current user.
Includes a "FORK" badge on each card — small gold pill, top-right corner of card.

Fork badge:
- Text: "FORK" — DM Sans 600, 8px, uppercase, --gold
- Background: --gold-bg
- Border: 1px solid --gold-border
- Border-radius: --radius-pill
- Padding: 3px 8px
- Position: absolute, top: 8px, right: 8px

---

## DATA MODEL ADDITIONS

Add to DATA_MODELS.md after building:

```typescript
// Extension of Recipe interface for personal forks
interface RecipeFork extends Recipe {
  isPersonal: true;
  originalRecipeId: string;       // Source recipe
  customisationNote: string;      // What user asked for
  summaryOfChanges: string;       // AI one-line summary
  createdBy: string;              // UserProfile.id
}
```

---

## FILE STRUCTURE

```
/src/
  components/
    RecipeCustomisation/
      CustomiseButton.tsx           ← Entry point on recipe detail screen
      CustomisationSheet.tsx        ← Main sheet with chips + text input
      CustomisationLoading.tsx      ← Loading state during AI call
      CustomisationPreview.tsx      ← Diff view before saving
      IngredientDiffRow.tsx         ← Single ingredient: normal/changed/removed
      CustomisationSuccess.tsx      ← Post-save success overlay
      ForkBadge.tsx                 ← "FORK" badge for recipe cards
  hooks/
    useRecipeCustomisation.ts       ← All AI and save logic
  lib/
    customisationPrompt.ts          ← buildCustomisationPrompt()
    generateSuggestions.ts          ← Client-side suggestion logic
```

---

## EDGE CASES

| Scenario | Handling |
|---|---|
| AI returns invalid JSON | parseCustomisationResult throws → show "Try rephrasing your request" |
| User requests impossible change | AI handles gracefully — show whatever it returns, user reviews |
| User customises a fork (fork of a fork) | originalRecipeId points to the direct parent, not the root — allow unlimited depth |
| User tries to delete a shared recipe | Only allow deletion of is_personal = true recipes |
| Customisation produces empty ingredients | Validate before showing preview — show error if ingredients array empty |
| User closes sheet mid-customisation | Discard all state, no orphaned data |
| Long fork name | Truncate at 80 characters with sanitization |
| Special characters in AI output | Apply sanitizeString() to all text fields before display and save |
| Same user customises same recipe twice | Allow — creates two separate forks, no deduplication |
| Network fails during AI call | Show "No connection. Please try again." with retry button |
| Supabase save fails | Keep preview screen open — do not discard the result |

---

## ACCEPTANCE CRITERIA

- [ ] "Customise with AI" button visible on recipe detail screen
- [ ] Customisation sheet opens correctly
- [ ] Smart suggestion chips appear, relevant to recipe content
- [ ] Multiple chips can be selected simultaneously
- [ ] Free text input accepts custom requests
- [ ] CTA disabled when no chips selected and input empty
- [ ] Loading state appears during AI call — no frozen UI
- [ ] Preview screen shows changed, removed, and unchanged ingredients correctly
- [ ] Fork name is editable before saving
- [ ] Summary of changes displayed clearly
- [ ] Save button writes fork to Supabase with correct fields
- [ ] Fork appears in Discover → My Recipes tab immediately
- [ ] Fork badge visible on personal recipe cards
- [ ] Original recipe is unchanged after forking
- [ ] "Try a different change" returns to sheet with prompt preserved
- [ ] Success state shows briefly then dismisses
- [ ] All special characters handled — no display or save errors
- [ ] Works on mobile Chrome and Safari
- [ ] Zero teal in UI — gold accent only

---

## AG INVOCATION ORDER

### Step 1 — @engineer.md
- Run the Supabase SQL to add new columns (CEO does this manually first)
- Build useRecipeCustomisation hook
- Build customisationPrompt.ts and generateSuggestions.ts
- Build saveFork() logic with RLS-compatible Supabase writes
- Confirm fork saves and reads correctly before creator starts

### Step 2 — @creator.md
- Build all UI components
- Wire to useRecipeCustomisation hook from Step 1
- Apply full Zinc design system throughout
- Reference DESIGN_SYSTEM.md on disk for all values
