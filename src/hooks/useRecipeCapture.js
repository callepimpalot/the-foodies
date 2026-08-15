import { useState } from 'react';
import { extractRecipe, refineRecipe } from '../lib/recipeExtraction';
import { saveRecipe } from '../lib/saveRecipe';

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

        setStatus('saving');
        setError(null);
        try {
            const data = await saveRecipe(draft, dishPhotoFile);
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
