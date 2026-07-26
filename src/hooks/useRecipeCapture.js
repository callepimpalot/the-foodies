import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { extractRecipeFromText, extractRecipeFromImage } from '../lib/recipeExtraction';

// status: idle -> extracting -> review -> saving -> saved
//                            \-> error (from extracting or saving)
export function useRecipeCapture() {
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState(null);
    const [draft, setDraft] = useState(null);

    const captureFromText = async (text) => {
        if (!text?.trim()) return;
        setStatus('extracting');
        setError(null);
        try {
            const result = await extractRecipeFromText(text);
            setDraft(result);
            setStatus('review');
        } catch (err) {
            console.error('Recipe text extraction failed:', err);
            setError("We couldn't read that recipe clearly. Try pasting the full text, or a clearer photo.");
            setStatus('error');
        }
    };

    const captureFromImage = async (file) => {
        setStatus('extracting');
        setError(null);
        try {
            const result = await extractRecipeFromImage(file);
            setDraft(result);
            setStatus('review');
        } catch (err) {
            console.error('Recipe image extraction failed:', err);
            setError("We couldn't read that recipe clearly. Try a cleaner photo or better lighting.");
            setStatus('error');
        }
    };

    const updateDraft = (patch) => {
        setDraft((prev) => ({ ...prev, ...patch }));
    };

    const save = async () => {
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
            const row = {
                title: draft.title.trim(),
                description: draft.description ?? null,
                image_url: null,
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
                : 'Could not save this recipe. Please try again.');
            setStatus('review');
            return null;
        }
    };

    const reset = () => {
        setDraft(null);
        setError(null);
        setStatus('idle');
    };

    return { status, error, draft, captureFromText, captureFromImage, updateDraft, save, reset };
}
