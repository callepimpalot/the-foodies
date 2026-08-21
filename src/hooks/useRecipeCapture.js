import { useState } from 'react';
import { extractRecipe, refineRecipe, extractRecipeFromUrl } from '../lib/recipeExtraction';
import { saveRecipe } from '../lib/saveRecipe';

// status: idle -> extracting -> review -> saving -> saved
//                            \-> error (from extracting or saving)
export function useRecipeCapture() {
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState(null);
    const [draft, setDraft] = useState(null);
    const [chatLog, setChatLog] = useState([]); // [{ instruction, changeSummary }]
    const [refining, setRefining] = useState(false);

    // Text/photo capture (existing) is unaffected: pass { text, images } exactly as before and
    // this takes the exact same extractRecipe() branch it always has. Passing { url } instead
    // routes through the JSON-LD-first fast path (TASK_08) — same status machine, same review
    // screen either way.
    const capture = async ({ text, images, url }) => {
        setStatus('extracting');
        setError(null);
        try {
            const result = url ? await extractRecipeFromUrl(url) : await extractRecipe({ text, images });
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
            // Gemini's refine schema doesn't carry source_url (it's app metadata, not something
            // we want an AI model trying to fill in for text/photo captures) — preserve it across
            // the refine turn instead of losing it when the draft gets replaced.
            setDraft({ ...recipe, source_url: draft?.source_url ?? recipe?.source_url });
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
