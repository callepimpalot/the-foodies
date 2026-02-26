# FEATURE BRIEF: Recipe Import From Photo or Screenshot
# Meal Buddy / The Foodies
# Purpose: Allow users to import any recipe by photographing it or screenshotting it
# Audience: Gemini CTO Gem + AG @engineer.md + @creator.md (sequential)

---

## WHAT WE ARE BUILDING

A user-facing feature that lets the user photograph a recipe (cookbook, handwritten card,
magazine page) or paste a screenshot (Instagram post, website, app) and have it
automatically extracted, structured, and saved to their Supabase recipe library.

The flow: User uploads image → AI vision model extracts recipe data → User reviews
and confirms → Recipe saves to Supabase with generated cinematic image.

This is a two-agent sequential build:
1. @engineer.md builds the extraction pipeline and Supabase write logic
2. @creator.md builds the UI — upload screen, review card, confirm flow

---

## WHY THIS MATTERS

This is the most compelling user-facing feature in the product. "Import any recipe
from a photo in seconds" is immediately understandable and desirable. It solves a
real pain point — recipes trapped in cookbooks, screenshots, and social media —
and it differentiates Meal Buddy from every generic meal planner.

It is also the mechanism by which the user grows their personal recipe library
beyond the seeded database, making the app genuinely personal over time.

---

## USER FLOW — COMPLETE

```
1. User opens Discover tab
2. Taps "Import Recipe" button (persistent, understated — not a banner)
3. Bottom sheet opens with two options:
   - "Take Photo" → opens camera
   - "Upload Screenshot" → opens photo library
4. User selects or captures image
5. Loading state: "Reading your recipe..." with subtle animation
6. AI extracts recipe data and returns structured JSON
7. Review screen shows extracted recipe:
   - Title (editable)
   - Cook time (editable)
   - Servings (editable)
   - Ingredients list (editable — can add/remove)
   - Steps list (editable — can add/remove)
8. User taps "Looks Good — Save Recipe"
9. App generates a cinematic placeholder image (see image generation below)
10. Recipe saves to Supabase
11. Success state: "Recipe added to your library"
12. User is returned to Discover tab — new recipe visible in grid
```

---

## PHASE 1 — ENGINEER: EXTRACTION PIPELINE

### Vision API — Gemini Vision (recommended for your stack)

Use Google Gemini Vision API since you're already in the Gemini ecosystem.
Model: `gemini-1.5-flash` (fast, cheap, handles images well)
Endpoint: Google AI Studio API
Key env variable: `VITE_GEMINI_API_KEY`

Alternative: Anthropic Claude vision API also works identically well.
Model: `claude-opus-4-6` or `claude-sonnet-4-6`
Key env variable: `VITE_ANTHROPIC_API_KEY`

Choose whichever API key you already have active. The prompt structure is the same.

### The Extraction Prompt

This prompt must be sent with the image to guarantee clean structured output:

```
You are a recipe extraction assistant. Extract the recipe from this image and
return ONLY a valid JSON object. No markdown. No explanation. No backticks.
Just the raw JSON object.

Return exactly this structure:
{
  "title": "string — the recipe name",
  "cookTimeMinutes": number — total time in minutes (prep + cook),
  "servings": number,
  "difficulty": "Easy" | "Medium" | "Hard",
  "mealType": "Breakfast" | "Lunch" | "Dinner",
  "kcal": number or null if not visible,
  "ingredients": [
    { "name": "string", "quantity": number or null, "unit": "string or null" }
  ],
  "steps": ["string", "string"]
}

Rules:
- If a field is not visible in the image, use a sensible default or null
- cookTimeMinutes: if only prep or cook is shown, use what is visible
- difficulty: derive from cook time — under 20min=Easy, 20-40min=Medium, over 40min=Hard
- steps: each step should be a complete sentence, not a fragment
- ingredients: name should be the clean ingredient name only, no quantities in name field
- Return ONLY the JSON. Any other text will break the parser.
```

### Parsing the Response

```typescript
const extractRecipeFromImage = async (base64Image: string, mimeType: string): Promise<Partial<Recipe>> => {
  // Using Gemini Vision
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: EXTRACTION_PROMPT },  // The prompt above
            { inline_data: { mime_type: mimeType, data: base64Image } }
          ]
        }]
      })
    }
  );

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Strip any accidental markdown fences
  const cleaned = rawText
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch {
    throw new Error('Failed to parse recipe from image. Please try again.');
  }
};
```

### Image to Base64 Conversion

```typescript
const imageToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
};
```

### Sanitization Before Save

Apply the same sanitization as the bulk import — special characters in title
and ingredient names must be cleaned before Supabase write:

```typescript
const sanitizeString = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
};
```

### Supabase Write

```typescript
const saveImportedRecipe = async (recipe: Partial<Recipe>): Promise<string> => {
  const newRecipe = {
    id: crypto.randomUUID(),
    title: sanitizeString(recipe.title ?? 'Imported Recipe'),
    image_url: null,                    // Set after image generation step
    cook_time_minutes: recipe.cookTimeMinutes ?? 30,
    difficulty: recipe.difficulty ?? 'Easy',
    kcal: recipe.kcal ?? null,
    servings: recipe.servings ?? 2,
    meal_type: recipe.mealType ?? 'Dinner',
    tags: ['imported'],                 // Tag for filtering later
    ingredients: recipe.ingredients?.map(i => ({
      ...i,
      name: sanitizeString(i.name),
    })) ?? [],
    steps: recipe.steps ?? [],
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('recipes')
    .insert(newRecipe)
    .select('id')
    .single();

  if (error) throw new Error(`Failed to save recipe: ${error.message}`);
  return data.id;
};
```

---

## PHASE 1B — IMAGE GENERATION FOR IMPORTED RECIPES

Imported recipes have no image. Generate a placeholder using the recipe title
as prompt to maintain the Cinematic Zinc aesthetic across all recipes.

Use the same image generation pipeline already established in the project
(from the Asset Hydration work in PROGRESS.md).

Prompt template for generated images:
```
Cinematic food photography of [RECIPE TITLE]. Dark moody restaurant atmosphere.
Single side-light. Rich shadows. Premium plating on dark slate. No text.
Photorealistic. 4:5 aspect ratio.
```

Store generated image to Supabase Storage bucket `recipe-images`.
Update the recipe row with the public image_url after generation.

This step can happen asynchronously after the recipe is saved —
the UI fallback handles the interim state gracefully.

---

## PHASE 2 — CREATOR: UI COMPONENTS

### Design System Rules (from DESIGN_SYSTEM.md)
- Background: --zinc-950 everywhere
- Cards: --zinc-900 background, --zinc-700 border
- Import button: ghost style, DM Sans 500, subtle — not a primary CTA
- Bottom sheet: --zinc-800 background, --radius-xl top corners only
- Loading state: Playfair Display italic, --zinc-500, centered
- Review card: --zinc-900 background, full content editable
- Success state: calm, minimal — not celebratory
- All transitions: transform and opacity only

### Import Entry Point
Location: Discover tab, below the page header, above the recipe grid.
Style: Small understated card, --zinc-900 background, --zinc-700 border.
Text: "Import a recipe" in DM Sans 400, --zinc-500.
Icon: Lucide `Upload` icon, 20px, 1.5px stroke, --zinc-500.
Do NOT make this a prominent CTA — it should feel like a secondary utility.

### Upload Bottom Sheet
Triggered by tapping the import entry point.
Two options presented as clean list items:
- Lucide `Camera` icon + "Take a photo"
- Lucide `Image` icon + "Choose from library"

Both use standard HTML file input with appropriate accept and capture attributes:
```html
<!-- Camera -->
<input type="file" accept="image/*" capture="environment" />

<!-- Library -->
<input type="file" accept="image/jpeg,image/png,image/webp,image/heic" />
```

### Loading State
Full-screen overlay on the Discover tab (not a separate page).
Centered content:
- Playfair Display italic, 20px, --zinc-400: "Reading your recipe..."
- Subtle pulsing opacity animation on the text (opacity 0.4 → 1 → 0.4, 2s loop)
- No spinner — typographic animation only, consistent with Zinc aesthetic

### Review Screen
Displayed after successful extraction. Full page view (not a modal).
Shows all extracted fields as editable inputs styled to match the design system.

```
[Recipe Title — large, editable, Playfair Display 700]

Cook Time    Servings    Difficulty
[editable]   [editable]  [dropdown]

INGREDIENTS
[editable list — tap to edit each item, swipe to delete]
[+ Add ingredient]

STEPS
[numbered list — tap to edit each step]
[+ Add step]

[Save Recipe — primary CTA button, full width pill]
[Start Over — ghost button]
```

Inputs use --zinc-800 background, --zinc-700 border, --zinc-200 text.
Labels use DM Sans 600, 10px, uppercase, --zinc-500 (eyebrow style).

### Error States
If extraction fails (bad image, unreadable text, API error):
- Do not show a technical error message
- Show: "We couldn't read that recipe clearly. Try a cleaner photo or better lighting."
- Offer retry option
- Playfair Display italic for the message, DM Sans for the button

### Success State
After save, brief overlay:
- Playfair Display italic: "Recipe saved to your library"
- Auto-dismiss after 2 seconds
- Return user to Discover tab — new recipe visible in grid

---

## DATA MODEL REFERENCE

Reference DATA_MODELS.md for the canonical Recipe and Ingredient interfaces.
The extraction output must conform to these interfaces exactly before Supabase write.

Key validation before save:
- title must be non-empty string
- ingredients must be an array (even if empty)
- steps must be an array (even if empty)
- mealType must be exactly "Breakfast" | "Lunch" | "Dinner"
- difficulty must be exactly "Easy" | "Medium" | "Hard"

---

## FILE STRUCTURE

```
/src/
  components/
    RecipeImport/
      RecipeImportButton.tsx      ← Entry point in Discover tab
      RecipeImportSheet.tsx       ← Bottom sheet with camera/library options
      RecipeReviewScreen.tsx      ← Full page review and edit
      RecipeImportSuccess.tsx     ← Success overlay
  hooks/
    useRecipeImport.ts            ← All extraction and save logic
  lib/
    recipeExtraction.ts           ← Vision API call and parsing
    sanitize.ts                   ← String sanitization (reusable)
```

---

## EDGE CASES TO HANDLE

| Scenario | Handling |
|---|---|
| Image too dark or blurry | Extraction returns partial data — show review screen with empty fields, let user fill in manually |
| Recipe not detected in image | Return friendly error: "We couldn't find a recipe here. Try a clearer photo." |
| API timeout or failure | Retry once automatically, then show error with retry button |
| User submits with empty title | Validate before save — highlight title field, "Recipe needs a name" |
| Duplicate recipe title | Warn user but allow save — do not block (user may want variations) |
| HEIC image format (iPhone default) | Accept and convert — most modern browsers handle HEIC via file input |
| Very long ingredient list (20+ items) | Render in scrollable container, do not truncate |
| Steps extracted as one block | Split on sentence-ending punctuation before render |
| Special characters in extracted text | Apply sanitizeString() to all string fields before display AND before save |
| User cancels mid-flow | Discard all state, return to Discover tab cleanly — no orphaned data |
| Supabase write fails | Show error, keep review screen open so user doesn't lose their data |

---

## ACCEPTANCE CRITERIA — HOW TO KNOW IT'S DONE

- [ ] Import button visible in Discover tab — understated, not dominant
- [ ] Bottom sheet opens on tap with camera and library options
- [ ] Camera option opens device camera on mobile
- [ ] Library option opens photo picker on mobile
- [ ] Loading state displays during extraction — no frozen UI
- [ ] Review screen populates with extracted data after successful read
- [ ] All fields on review screen are editable before saving
- [ ] Save button writes recipe to Supabase recipes table
- [ ] New recipe appears in Discover tab grid immediately after save
- [ ] Error states display friendly messages — no raw API errors shown to user
- [ ] Special characters render correctly in all fields
- [ ] Works on mobile Chrome and Safari (primary target)
- [ ] No crashes on bad image input

---

## AGENT INVOCATION ORDER

### Step 1 — Invoke @engineer.md
Build the extraction pipeline, Supabase write logic, useRecipeImport hook,
recipeExtraction.ts, and sanitize.ts. No UI work yet.
Engineer confirms: extraction works end-to-end, recipe saves to Supabase correctly.

### Step 2 — Invoke @creator.md
Build all UI components: RecipeImportButton, RecipeImportSheet,
RecipeReviewScreen, RecipeImportSuccess. Wire to the useRecipeImport hook
built by engineer. Apply full Zinc design system throughout.

Do not run both agents simultaneously — creator depends on engineer's hook being complete.
