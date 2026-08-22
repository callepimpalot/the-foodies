import { supabase } from './supabase';
import { uploadDishPhoto } from './uploadRecipeImage';

// Inserts a recipe draft (from Capture extraction or AI Week Planner generation) into Supabase.
// Shared by useRecipeCapture.js's save() and the week-planner's apply-to-plan step.
export async function saveRecipe(draft, dishPhotoFile) {
    if (!supabase) {
        throw new Error('Supabase is not configured — cannot save.');
    }
    if (!draft?.title?.trim()) {
        throw new Error('Recipe needs a name before saving.');
    }

    let imageUrl = null;
    if (dishPhotoFile) {
        imageUrl = await uploadDishPhoto(dishPhotoFile);
    }

    const row = {
        title: draft.title.trim(),
        description: draft.description ?? null,
        creator: draft.creator?.trim() || null,
        image_url: imageUrl,
        cook_time_minutes: draft.cook_time_minutes ?? 30,
        difficulty: draft.difficulty ?? 'Easy',
        kcal: draft.kcal ?? null,
        base_servings: draft.base_servings ?? 2,
        meal_type: draft.meal_type ?? 'Dinner',
        // Only ever set by a URL capture (TASK_08) — text and photo captures
        // carry no origin link and store null, exactly as before.
        source_url: draft.source_url ?? null,
        tags: draft.tags ?? ['captured'],
        archetypes: [],
        ingredients: (draft.ingredients ?? []).map((i) => ({
            name: i.name,
            quantity: i.quantity ?? null,
            unit: i.unit ?? null,
        })),
        steps: draft.steps ?? [],
        // TASK_10 — per-step ingredient links, parallel to `steps`. Only newly captured
        // recipes have these; null means Cook Mode falls back to runtime matching.
        step_ingredients: draft.step_ingredients ?? null,
        is_personal: true,
        created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from('recipes')
        .insert(row)
        .select()
        .single();

    if (error) throw error;
    return data;
}
