// Every image is re-encoded through canvas before use, regardless of source (camera, photo library,
// or clipboard paste) or original format. This fixes two real failure modes:
// 1. Pasted/clipboard images can carry an empty or missing MIME type, which APIs can hard-reject.
//    Canvas re-encoding always produces a correctly-labeled JPEG.
// 2. Full-resolution phone photos (several MB, HEIC on iOS) are downscaled to a sane size, which cuts
//    payload size/latency and sidesteps formats that may not be accepted elsewhere — Safari can decode
//    HEIC via createImageBitmap using the OS codec, so this doubles as HEIC support on the platform
//    most likely to produce HEIC files. If decoding fails for any reason, the original file is
//    returned as a fallback rather than blocking the caller entirely.
export async function normalizeImage(file, maxDimension = 2000, quality = 0.9) {
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close?.();

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (!blob) return file;
        return new File([blob], 'image.jpg', { type: 'image/jpeg' });
    } catch (err) {
        console.warn('Image normalization failed, using original file:', err);
        return file;
    }
}

export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            resolve({ base64: result.split(',')[1], mimeType: file.type || 'image/jpeg' });
        };
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
    });
}
