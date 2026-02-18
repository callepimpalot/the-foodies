import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useRecipes() {
    const [recipes, setRecipes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchRecipes() {
            if (!supabase) {
                console.error('Supabase client not initialized. Check .env configuration.');
                setError(new Error('Supabase client not initialized'));
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('recipes')
                    .select('*');

                if (error) throw error;

                console.log('✅ Supabase Connection Success:', data);

                // FALLBACK IMAGES (Nordic/clean aesthetic)
                const FALLBACKS = [
                    'https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=800',
                    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800',
                    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800',
                    'https://images.unsplash.com/photo-1493770348161-369560ae357d?auto=format&fit=crop&w=800'
                ];

                const mappedRecipes = data.map((r, idx) => {
                    const fallback = FALLBACKS[idx % FALLBACKS.length];
                    return {
                        ...r,
                        // Manual Patch: Backfill image_url if missing so standard components work
                        image_url: r.image_url || fallback,
                        // Also set 'image' for legacy support, but 'image_url' is the new standard
                        image: r.image_url || r.image || fallback
                    };
                });

                setRecipes(mappedRecipes);
            } catch (err) {
                console.error('Error fetching recipes:', err);
                if (err.code === 'PGRST205') {
                    console.error('🛑 TABLE NOT FOUND: The "recipes" table does not exist in your Supabase project.');
                }
                setError(err);
            } finally {
                setLoading(false);
            }
        }

        fetchRecipes();
    }, []);

    return { recipes, loading, error };
}
