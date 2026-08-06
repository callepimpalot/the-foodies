import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import localRecipes from '../../final_recipes.json';

// FALLBACK IMAGES (Nordic/clean aesthetic)
const FALLBACKS = [
    'https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1493770348161-369560ae357d?auto=format&fit=crop&w=800'
];

/**
 * Maps a raw Supabase row (snake_case) to the shape the UI components expect.
 * DB schema (from import-to-supabase.ts):
 *   cook_time_minutes → cookTime (displayed on card)
 *   base_servings     → servings
 *   image_url         → image_url (kept as-is, also exposed as image for legacy)
 */
function mapRow(r, idx, localOverride = []) {
    const fallback = FALLBACKS[idx % FALLBACKS.length];
    const localMatch = localOverride.find(local => local?.title === r?.title);
    const resolvedImageUrl = localMatch?.image_url || r?.image_url || fallback;

    return {
        ...r,
        // Image — unified field
        image_url: resolvedImageUrl,
        image: resolvedImageUrl,
        // cook_time_minutes → aliases expected by RecipeCard / RecipeView
        cook_time: r?.cook_time_minutes != null ? `${r.cook_time_minutes}m` : null,
        time: r?.cook_time_minutes != null ? `${r.cook_time_minutes}m` : null,
        // base_servings → aliases expected by RecipeView
        servings: r?.base_servings ?? r?.servings ?? null,
        baseServings: r?.base_servings ?? r?.servings ?? null,
        // archetypes — ensure array (never undefined)
        archetypes: Array.isArray(r?.archetypes) ? r.archetypes : [],
        // tags — ensure array
        tags: Array.isArray(r?.tags) ? r.tags : [],
        // steps — ensure array
        steps: Array.isArray(r?.steps) ? r.steps : [],
        // ingredients — ensure array
        ingredients: Array.isArray(r?.ingredients) ? r.ingredients : [],
    };
}

/**
 * Maps a local final_recipes.json entry to the same UI shape.
 * Local file uses camelCase / different field names.
 */
function mapLocalRow(r, idx) {
    const fallback = FALLBACKS[idx % FALLBACKS.length];
    const resolvedImageUrl = r?.image_url || r?.image || fallback;
    const cookMins = r?.cook_time_minutes ?? r?.cookTimeMinutes ?? null;

    return {
        ...r,
        image_url: resolvedImageUrl,
        image: resolvedImageUrl,
        cook_time: cookMins != null ? `${cookMins}m` : r?.cook_time ?? r?.time ?? null,
        time: cookMins != null ? `${cookMins}m` : r?.cook_time ?? r?.time ?? null,
        servings: r?.servings ?? r?.base_servings ?? r?.baseServings ?? null,
        baseServings: r?.servings ?? r?.base_servings ?? r?.baseServings ?? null,
        archetypes: Array.isArray(r?.archetypes) ? r.archetypes : [],
        tags: Array.isArray(r?.tags) ? r.tags : [],
        steps: Array.isArray(r?.steps) ? r.steps : [],
        ingredients: Array.isArray(r?.ingredients) ? r.ingredients : [],
    };
}

export function useRecipes() {
    const [recipes, setRecipes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchRecipes = async () => {
        // ── Guard: Supabase client not initialised ──────────────────────
        if (!supabase) {
            console.warn('⚠️ Supabase not configured — loading from local JSON fallback.');
            const mapped = (localRecipes || []).map(mapLocalRow);
            setRecipes(mapped);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            const { data, error: fetchError } = await supabase
                .from('recipes')
                .select('*');

            if (fetchError) throw fetchError;

            console.log(`✅ Supabase: loaded ${data?.length ?? 0} recipes`);

            const localOverride = localRecipes || [];
            const mapped = (data || []).map((r, idx) => mapRow(r, idx, localOverride));
            setRecipes(mapped);
            setError(null);

        } catch (err) {
            const isNetworkError = err?.message?.includes('Failed to fetch')
                || err?.message?.includes('NetworkError')
                || err?.message?.includes('ERR_NAME_NOT_RESOLVED');

            if (isNetworkError) {
                // Supabase is unreachable (paused project, offline, etc.)
                // Graceful degradation: serve local JSON so the tab stays usable.
                console.warn('🔌 Supabase unreachable — falling back to local recipe library.');
                const mapped = (localRecipes || []).map(mapLocalRow);
                if (mapped.length > 0) {
                    setRecipes(mapped);
                    setError(null); // Not an error the user needs to see
                    return;
                }
            }

            // Genuine DB error (schema mismatch, RLS, etc.) — surface it
            console.error('❌ Error fetching recipes:', err?.message ?? err);
            if (err?.code === 'PGRST205') {
                console.error('🛑 TABLE NOT FOUND: "recipes" table missing from Supabase project.');
            }
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecipes();
    }, []);

    return { recipes, loading, error, refetch: fetchRecipes };
}
