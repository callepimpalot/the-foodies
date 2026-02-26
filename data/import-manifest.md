# Import Manifest — Meal Buddy Recipe Database

## Import 1 — Feb 26, 2026
**Source:** Epicurious full_format_recipes.json (20,130 recipes)
**Output:** 400 recipes inserted to Supabase

### Pipeline Config

**Stage 1 — Structural validation**
- Title must exist and be non-empty
- Ingredients array minimum 3 items
- Directions array minimum 2 items
- Rating must exist and be a number
- No ingredient string under 3 chars
- No direction string under 10 chars

**Stage 2 — Rules filter**
- Rating minimum: 3.5
- Date minimum: 2000
- Calories minimum: 150 (if not null)
- Ingredients maximum: 18
- Excluded categories: drink, cocktail, beverage, smoothie, dessert, cake, cookie, candy, condiment, sauce, dip, spread, stock, broth, spice, rub, seasoning, preserved, garnish, appetizer
- Excluded title keywords: cocktail, martini, smoothie, frosting, candy, stock, broth, rub, seasoning, preserved, pickle, jam, vinaigrette
- Deduplicated by title (kept highest rated)
- Sorted by rating DESC, meal-range calories first
- Top 2000 taken forward

**Stage 3 — Gemini AI scoring**
- Model: gemini-2.5-flash
- Batch size: 10
- Scored on: practicality, modernity, family-friendliness (1-5)
- Formula: (practicality + modernity + (family * 1.5)) / 3.5
- Minimum combined score: 3.8
- Top 400 taken forward

**Stage 4 — Supabase import**
- 400 inserted, 0 skipped, 0 failed
- image_url: null (images pending Unsplash script)

### Excluded Recipe Titles (for dedup on future imports)
— Auto-generate from stage3-final.json titles —
