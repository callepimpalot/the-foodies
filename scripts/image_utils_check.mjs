/**
 * Image-normalisation checks — `node scripts/image_utils_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/lib/imageUtils.js` is the single funnel every picture passes through on its way into the app —
 * camera, photo library, clipboard paste or a URL captured from a social post. Its header documents
 * the two production failure modes it exists to fix:
 *   1. a pasted/clipboard image can carry an empty or missing MIME type, which the Gemini proxy can
 *      hard-reject, so every image is re-encoded through canvas to always come out a labelled JPEG;
 *   2. full-resolution phone photos (several MB, HEIC on iOS) are downscaled so payload size and
 *      latency stay sane, and so formats Safari-only codecs produce are normalised away.
 * Measured, not assumed: `git grep -l -- "lib/imageUtils"` across every remote head (main + all 26 PR
 * heads) returns ZERO `scripts/*_check.mjs`. The module is a leaf — it imports nothing from the app —
 * so it needs no extensionless-import hook, unlike scripts/dish_curation_check.mjs. It ships live in
 * production and had no suite of its own.
 *
 * WHAT IT ASSERTS, AND WHY EACH THING MATTERS
 *   - the scale factor. `Math.min(1, maxDimension / max(w, h))` is the whole of the downscale policy,
 *     and the `Math.min(1, …)` is what stops a *small* image being blown up. Drop it and a 500 px
 *     photo becomes a 2000 px one — a 16× pixel cost for a worse picture. The longest edge is what the
 *     bound applies to (portrait and landscape alike), and the result is rounded to whole pixels
 *     because canvas dimensions are integers. Each of those is a separate assertion.
 *   - the output contract: always a `File` renamed `image.jpg` with `type: 'image/jpeg'`, and the
 *     encode quality passed through to `canvas.toBlob` (default 0.9, overridable per call).
 *   - the fallbacks, which are the reason the function never throws: an undecodable file returns the
 *     ORIGINAL file (the caller still gets something to upload — this is the HEIC-on-a-browser-with-no-
 *     codec path), and a canvas that yields `null` (an encoder OOM/tainted-canvas edge) does the same.
 *   - `fileToBase64`: the data-URL prefix is stripped so callers get a bare base64 payload, the MIME
 *     type is taken from the file falling back to `image/jpeg` (the empty-MIME-type paste case, again),
 *     and a read error rejects rather than resolving `undefined`.
 *   - `imageFileFromUrl`: every failure is a silent `null` — a non-OK response, a body that is not an
 *     image, or a thrown fetch — because "no picture for this capture" is a normal outcome, not an
 *     error the caller should have to catch. A success keeps the blob's own type and names the file
 *     `.png` only for PNG, `.jpg` otherwise.
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * This is a node-level logic check with the browser globals (`createImageBitmap`, `document`,
 * `FileReader`, `fetch`) stubbed. It proves the module's decisions given an encoder that behaves a
 * certain way. It says nothing about what a real browser canvas actually decodes — in particular
 * whether Safari really accepts a HEIC through `createImageBitmap` — and nothing about the bytes of
 * the re-encoded JPEG. The stubs are the contract; the codec is not exercised.
 *
 * NEGATIVE CONTROL (run it before trusting a clean result — every one of these must go red):
 *   cp -r src scripts <scratch>/ctl && cd <scratch>/ctl
 *   # 1. permit upscaling — the "never upscales" assertion fails
 *   sed -i 's/Math.min(1, maxDimension \/ Math.max(bitmap.width, bitmap.height))/maxDimension \/ Math.max(bitmap.width, bitmap.height)/' src/lib/imageUtils.js
 *   node scripts/image_utils_check.mjs
 *   # 2. stop reporting the MIME default — the empty-type assertion fails
 *   sed -i "s/file.type || 'image\/jpeg'/file.type/" src/lib/imageUtils.js
 *   # 3. drop the null-blob fallback — the encode-failure assertion fails
 *   sed -i 's/if (!blob) return file;//' src/lib/imageUtils.js
 *   # 4. stop png getting a .png name — the extension assertion fails
 *   sed -i "s/blob.type === 'image\/png' ? 'png' : 'jpg'/'jpg'/" src/lib/imageUtils.js
 * Each of the four was run against this suite on the branch and turns it red (see the PR body).
 *
 * Plain script, non-zero exit on failure — same shape as scripts/task07_check.mjs.
 */
// Leaf module: no extensionless relative imports, so it is imported directly (the same rule that
// lets scripts/pantry_items_check.mjs and date_unit_helpers_check.mjs skip the resolution hook).

let failures = 0;
function check(name, actual, expected) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
        console.log(`  ok   ${name}`);
    } else {
        failures += 1;
        console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
    }
}

async function caught(fn) {
    try {
        const value = await fn();
        return { threw: false, message: null, value };
    } catch (err) {
        return { threw: true, message: err?.message ?? String(err), value: null };
    }
}

// ── the browser globals the module reaches for, made controllable ───────────────────────────────
// Reset between cases so an assertion can never pass because of state a previous case left behind.
let bitmapThrows = false;
let bmWidth = 4000;
let bmHeight = 3000;
let bitmapClosed = false;
let canvasCount = 0;
let lastCanvas = null;
let toBlobArgs = null;
let blobReply = { size: 1234 };
let createdFiles = [];

globalThis.createImageBitmap = async () => {
    if (bitmapThrows) throw new Error('unsupported image');
    bitmapClosed = false;
    return { width: bmWidth, height: bmHeight, close() { bitmapClosed = true; } };
};

globalThis.document = {
    createElement(tag) {
        canvasCount += 1;
        lastCanvas = {
            tag,
            width: 0,
            height: 0,
            getContext: () => ({ drawImage() {} }),
            toBlob(cb, type, quality) {
                toBlobArgs = { type, quality };
                cb(blobReply);
            },
        };
        return lastCanvas;
    },
};

globalThis.File = class File {
    constructor(parts, name, opts) {
        this.parts = parts;
        this.name = name;
        this.type = opts?.type;
        createdFiles.push(this);
    }
};

// FileReader stand-in: `frResult` is what `readAsDataURL` will have put on `.result` by the time
// `onload` fires; `frError` flips it to the failure path.
let frResult = 'data:image/png;base64,AAAB';
let frError = false;
globalThis.FileReader = class FileReader {
    readAsDataURL() {
        if (frError) { setTimeout(() => this.onerror(), 0); return; }
        this.result = frResult;
        setTimeout(() => this.onload(), 0);
    }
};

// fetch stand-in for imageFileFromUrl.
let fetchThrows = false;
let fetchOk = true;
let fetchBlob = { type: 'image/png', size: 10 };
globalThis.fetch = async () => {
    if (fetchThrows) throw new Error('offline');
    return { ok: fetchOk, blob: async () => fetchBlob };
};

const { normalizeImage, fileToBase64, imageFileFromUrl } = await import('../src/lib/imageUtils.js');

console.log('\nnormalizeImage — the downscale policy');

bitmapThrows = false; blobReply = { size: 99 };
bmWidth = 4000; bmHeight = 3000;
let out = await normalizeImage({ name: 'hi.jpg' });
check('a 4000×3000 photo is scaled so its longest edge is the default 2000', [lastCanvas.width, lastCanvas.height], [2000, 1500]);
check('the default is 2000, not a smaller guess', lastCanvas.height, 1500);

bmWidth = 500; bmHeight = 400;
await normalizeImage({ name: 'small.jpg' });
check('a 500×400 image is NOT upscaled (min(1, …) holds the scale at 1)', [lastCanvas.width, lastCanvas.height], [500, 400]);

bmWidth = 3000; bmHeight = 4000;
await normalizeImage({ name: 'portrait.jpg' });
check('a portrait image is bounded on its HEIGHT, the longest edge', [lastCanvas.width, lastCanvas.height], [1500, 2000]);

bmWidth = 4000; bmHeight = 3000;
await normalizeImage({ name: 'a.jpg' }, 1000);
check('a caller-supplied maxDimension is honoured', [lastCanvas.width, lastCanvas.height], [1000, 750]);

bmWidth = 1234; bmHeight = 1000;
await normalizeImage({ name: 'b.jpg' }, 1000);
check('dimensions are rounded to whole pixels (1234 scale 0.810… → 810, not 810.37)', lastCanvas.height, 810);

bmWidth = 4000; bmHeight = 3000;
bitmapClosed = false;
canvasCount = 0;
await normalizeImage({ name: 'c.jpg' });
check('the bitmap is closed after drawing (decoder handles are released)', bitmapClosed, true);
check('exactly one canvas is created per call', canvasCount, 1);

console.log('\nnormalizeImage — the output contract');

bmWidth = 4000; bmHeight = 3000; blobReply = { size: 1234 };
createdFiles = [];
const encoded = await normalizeImage({ name: 'original.heic', type: 'image/heic' });
check('the result is a File, not the raw blob', encoded instanceof globalThis.File, true);
check('...renamed image.jpg regardless of the source name', encoded.name, 'image.jpg');
check('...and typed image/jpeg regardless of the source type', encoded.type, 'image/jpeg');
check('...wrapping the canvas blob, not the original file', encoded.parts[0], blobReply);
check('the default encode quality is 0.9', toBlobArgs.quality, 0.9);
check('the encode always asks for image/jpeg', toBlobArgs.type, 'image/jpeg');

await normalizeImage({ name: 'q.jpg' }, 2000, 0.5);
check('a caller-supplied quality is passed through', toBlobArgs.quality, 0.5);

console.log('\nnormalizeImage — the fallbacks (why it never throws)');

bmWidth = 4000; bmHeight = 3000;
bitmapThrows = true;
const original = { name: 'broken.heic', type: 'image/heic' };
const fellBack = await normalizeImage(original);
check('an undecodable file returns the ORIGINAL file, not null', fellBack, original);
check('...without throwing', fellBack.name, 'broken.heic');

bitmapThrows = false;
blobReply = null;
const encodeFailed = await normalizeImage(original);
check('a canvas that yields no blob returns the ORIGINAL file', encodeFailed, original);

blobReply = { size: 99 };

console.log('\nfileToBase64 — what reaches the Gemini proxy');

frError = false;
frResult = 'data:image/png;base64,SGVsbG8=';
let b64 = await caught(() => fileToBase64({ type: 'image/png' }));
check('the data-URL prefix is stripped, leaving bare base64', b64.value.base64, 'SGVsbG8=');
check('the MIME type is taken from the file', b64.value.mimeType, 'image/png');

frResult = 'data:image/jpeg;base64,QUJD';
b64 = await caught(() => fileToBase64({ type: '' }));
check('an empty file type falls back to image/jpeg (the clipboard-paste case)', b64.value.mimeType, 'image/jpeg');

b64 = await caught(() => fileToBase64({}));
check('a missing file type falls back to image/jpeg too', b64.value.mimeType, 'image/jpeg');
check('the payload is still returned when the type is missing', b64.value.base64, 'QUJD');

frError = true;
b64 = await caught(() => fileToBase64({ type: 'image/png' }));
check('a read error REJECTS rather than resolving undefined', b64.threw, true);
check('...with the documented message', b64.message, 'Failed to read image file');
frError = false;

console.log('\nimageFileFromUrl — every failure is a silent null');

fetchThrows = false; fetchOk = false; fetchBlob = { type: 'image/png' };
check('a non-OK response yields null', await imageFileFromUrl('https://x/a.jpg'), null);

fetchOk = true; fetchBlob = { type: 'text/html', size: 5 };
check('a body that is not an image yields null', await imageFileFromUrl('https://x/page'), null);

fetchBlob = { type: 'application/octet-stream' };
check('a binary-but-not-image body yields null', await imageFileFromUrl('https://x/f'), null);

fetchThrows = true;
check('a thrown fetch yields null, not a rejected promise', await imageFileFromUrl('https://x/a.jpg'), null);

fetchThrows = false; fetchOk = true;
createdFiles = [];
fetchBlob = { type: 'image/png', size: 42 };
let fromUrl = await imageFileFromUrl('https://x/shot.png');
check('a PNG body becomes a File named captured.png', fromUrl?.name, 'captured.png');
check('...carrying the blob\'s own type through', fromUrl?.type, 'image/png');

fetchBlob = { type: 'image/jpeg', size: 42 };
fromUrl = await imageFileFromUrl('https://x/shot.jpg');
check('a non-PNG image becomes captured.jpg', fromUrl?.name, 'captured.jpg');
check('...and keeps its own type', fromUrl?.type, 'image/jpeg');

fetchBlob = { type: 'image/webp', size: 42 };
fromUrl = await imageFileFromUrl('https://x/shot.webp');
check('an unfamiliar image type is not refused — only named .jpg', [fromUrl?.name, fromUrl?.type], ['captured.jpg', 'image/webp']);

// ───────────────────────────────────────────────────────────────────────────────────────────────
console.log('');
if (failures) {
    console.log(`${failures} FAILED`);
    process.exit(1);
}
console.log('all checks passed');
