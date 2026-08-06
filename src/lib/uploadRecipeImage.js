import { supabase } from './supabase';
import { normalizeImage } from './imageUtils';

const BUCKET = 'recipe-images';

// Uploads a photo of a finished dish to Supabase Storage and returns its public URL.
// Used both when saving a newly captured recipe and when adding/replacing a photo later.
export async function uploadDishPhoto(file) {
    if (!supabase) {
        throw new Error('Supabase is not configured — cannot upload photo.');
    }

    const normalized = await normalizeImage(file, 1600, 0.85);
    const path = `${crypto.randomUUID()}.jpg`;

    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, normalized, { contentType: 'image/jpeg', upsert: false });

    if (uploadError) {
        if (uploadError.message?.toLowerCase().includes('bucket not found')) {
            throw new Error(`No "${BUCKET}" storage bucket exists in Supabase yet — create one (Storage → New bucket, name it "${BUCKET}", make it public) and try again.`);
        }
        throw new Error(`Could not upload photo: ${uploadError.message}`);
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
}
