import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { extractRecipe, refineRecipe } from '../lib/recipeExtraction';
import { uploadDishPhoto } from '../lib/uploadRecipeImage';

// status: idle -> extracting -> review -> saving -> saved
//                            \-> error (from extracting or saving)
export function useRecipeCapture() {
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState(null);
    const [draft, setDraft] = useState(null);
    const [chatLog, setChatLog] = useState([]); // [{ instruction, changeSummary }]
    const [refining, setRefining] = useState(false);

    const capture = async ({ text, images }) => {
        setStatus('extracting');
        setError(null);
        try {
            const result = await extractRecipe({ text, images });
            setDraft(result);
            setStatus('review');
        } catch (err) {
            console.error('Recipe extraction failed:', err);
            setError(err?.message || "We couldn't read that recipe clearly. Try adding more text, a clearer photo, or both.");
            setStatus('error');
        }
    };

    const refine = async (instruction) => {
        if (!draft || !instruction?.trim()) return;
        setRefining(true);
        setError(null);
        try {
            const { recipe, changeSummary } = await refineRecipe(draft, instruction);
            setDraft(recipe);
            setChatLog((prev) => [...prev, { instruction: instruction.trim(), changeSummary }]);
        } catch (err) {
            console.error('Recipe refine failed:', err);
            setError(err?.message || "Couldn't apply that change — try rephrasing it.");
        } finally {
            setRefining(false);
        }
    };

    const updateDraft = (patch) => {
        setDraft((prev) => ({ ...prev, ...patch }));
    };

    const save = async (dishPhotoFile) => {
        if (!draft) return null;
        if (!supabase) {
            setError('Supabase is not configured — cannot save.');
            return null;
        }
        if (!draft.title?.trim()) {
            setError('Recipe needs a name before saving.');
            return null;
        }

        setStatus('saving');
        setError(null);
        try {
            let imageUrl = null;
            if (dishPhotoFile) {
                imageUrl = await uploadDishPhoto(dishPhotoFile);
            }

            const row = {
                title: draft.title.trim(),
                description: draft.description ?? null,
                image_url: imageUrl,
                cook_time_minutes: draft.cook_time_minutes ?? 30,
                difficulty: draft.difficulty ?? 'Easy',
                kcal: draft.kcal ?? null,
                base_servings: draft.base_servings ?? 2,
                meal_type: draft.meal_type ?? 'Dinner',
                tags: ['captured'],
                archetypes: [],
                ingredients: (draft.ingredients ?? []).map((i) => ({
                    name: i.name,
                    quantity: i.quantity ?? null,
                    unit: i.unit ?? null,
                })),
                steps: draft.steps ?? [],
                is_personal: true,
                created_at: new Date().toISOString(),
            };

            const { data, error: insertError } = await supabase
                .from('recipes')
                .insert(row)
                .select()
                .single();

            if (insertError) throw insertError;

            setStatus('saved');
            return data;
        } catch (err) {
            console.error('Recipe save failed:', err);
            const isNetworkError = err?.message?.includes('Failed to fetch')
                || err?.message?.includes('NetworkError')
                || err?.message?.includes('ERR_NAME_NOT_RESOLVED');
            setError(isNetworkError
                ? "Can't reach your recipe library right now. Check your connection and try again."
                : (err?.message || 'Could not save this recipe. Please try again.'));
            setStatus('review');
            return null;
        }
    };

    const reset = () => {
        setDraft(null);
        setError(null);
        setStatus('idle');
        setChatLog([]);
    };

    return { status, error, draft, capture, updateDraft, save, reset, refine, refining, chatLog };
}
