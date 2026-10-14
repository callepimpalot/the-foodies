/**
 * upload-recipe-image checks — `node scripts/upload_recipe_image_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/lib/uploadRecipeImage.js` exports exactly one function, `uploadDishPhoto(file)`: it normalizes
 * a photo, puts it in the `recipe-images` Supabase Storage bucket under a fresh uuid, and returns its
 * public URL. Two callers reach it — Capture's save path via `saveRecipe` (a newly captured recipe
 * with a photo) and the "add/replace a photo later" path on an existing recipe. The URL it returns is
 * what every photo in the app points at.
 *
 * WHAT WAS ALREADY COVERED, SAID PLAINLY — this suite is not the first to touch the module.
 * `scripts/save_recipe_check.mjs` (PR #41) reaches `uploadDishPhoto` *indirectly* through
 * `saveRecipe(file)` and already pins: the bucket name, a `uuid.jpg` object path (with `randomUUID`
 * stubbed), `{ contentType: 'image/jpeg', upsert: false }`, that the public URL of that exact path is
 * requested, and both documented failure messages. An earlier note in
 * `NEXT-CYCLE-BRIEF.md` claimed no `scripts/*_check.mjs` named this module; a `git grep -l -- "uploadRecipeImage"`
 * across all 35 remote heads shows that is not true — #41's script names it in its header and drives it.
 * So the claim is corrected here rather than repeated.
 *
 * WHAT THIS SUITE ADDS — the surface a `saveRecipe`-mediated call structurally cannot reach:
 *   - the module's OWN guard. `uploadDishPhoto` throws
 *     'Supabase is not configured — cannot upload photo.' when there is no client. #41 always has a
 *     client set by the time it reaches the photo path, so that message was unasserted by anything —
 *     and it is a message a user can see. Also: with no client, `normalizeImage` must not be called.
 *   - the normalization arguments. `normalizeImage(file, 1600, 0.85)` is called directly, so 1600 and
 *     0.85 are pinned here. #41 stubs nothing and relies on the canvas fallback, which returns the
 *     original file — it therefore cannot observe the arguments at all. If those two numbers drift,
 *     every upload silently changes size and quality with no test noticing. That is the main gap.
 *   - that the value uploaded is the *normalized result*, not the raw file. #41 asserts the opposite
 *     (the raw file), correctly, because in bare Node the re-encode falls back. Here `normalizeImage`
 *     is stubbed to return a sentinel, so the data flow itself is what gets tested.
 *   - path uniqueness across two calls — a fixed object name with `upsert: false` would make the
 *     second capture of the day fail against an existing object.
 *   - that a failed upload requests NO public URL (not merely that it inserts no row, which is #41's
 *     claim), and that the promise rejects with an `Error`, not a raw Supabase error object.
 *   - that the function's return value is exactly `data.publicUrl`.
 *
 * HOW THE MODULE IS LOADED, AND WHY IT IS NOT A CHEAT
 * `uploadRecipeImage.js` imports `./supabase` (reads `import.meta.env` — a Vite global absent in bare
 * Node) and `./imageUtils` (`normalizeImage` needs `createImageBitmap` + a canvas). Both are
 * redirected, via `registerHooks`, to in-memory stand-ins: `./supabase` to a live-binding stub (the
 * same technique `save_recipe_check.mjs`, `cook_feedback_check.mjs` and `household_check.mjs` use) and
 * `./imageUtils` to a recording fake. The module under test is the real file, unmodified. The app's
 * extensionless relative imports are resolved by the same hook.
 *
 * ONE CONCESSION, STATED PLAINLY: because `normalizeImage` is stubbed, the canvas re-encode itself is
 * NOT covered here — no assertion below claims it is. The stub is also why the 1600/0.85 pin is
 * possible at all.
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * A node-level logic check. It renders nothing, calls no real Supabase, touches no database and no
 * storage bucket. Nothing below says whether `recipe-images` exists, whether its policies admit the
 * upload, or whether the returned URL resolves — the module's own header is what documents the bucket
 * as something the owner must create.
 *
 * NEGATIVE CONTROL (run it before trusting a clean result): copy `src` and `scripts` to a scratch
 * directory, break one thing in the copy's `src/lib/uploadRecipeImage.js`, and re-run this file from
 * there. Controls measured on this branch, 2026-10-14, each mutating *logic* and not a comment, each
 * going red and leaving the rest of the file running (clean run: **31 ok / 0 FAIL, exit 0**; the
 * unmutated copy re-run from the scratch directory gives the identical 31/0 and exit 0):
 *   - `normalizeImage(file, 1600, 0.85)` -> `(file, 1200, 0.8)`       -> 29 ok / 2 FAIL, exit 1
 *   - `upsert: false` -> `upsert: true`                               -> 29 ok / 2 FAIL, exit 1
 *   - the `if (!supabase)` guard deleted                              -> 29 ok / 2 FAIL, exit 1
 *   - `return data.publicUrl;` -> `return path;`                      -> 30 ok / 1 FAIL, exit 1
 *   - `uploadError.message?.toLowerCase()` -> `uploadError.message`    -> 29 ok / 2 FAIL, exit 1
 * A restored copy is green again.
 *
 * Plain script, non-zero exit on failure — same shape as `scripts/task07_check.mjs`.
 */
import { registerHooks } from 'node:module';

// A live-binding stand-in for `./supabase`: `let` so the module under test sees whatever the test
// points it at. `setClient(null)` is the "not configured" case, exercised below.
const SUPABASE_STUB_URL = 'data:text/javascript,' + encodeURIComponent([
    'export let supabase = null;',
    'export function setClient(client) { supabase = client; }',
].join('\n'));

// A recording stand-in for `./imageUtils`. `next` is what `normalizeImage` will resolve to; `calls`
// records every `(file, width, quality)` triple so the pin on 1600/0.85 is a measurement, not an
// assumption.
const IMAGE_UTILS_STUB_URL = 'data:text/javascript,' + encodeURIComponent([
    'export const calls = [];',
    'export let next = null;',
    'export function setNext(value) { next = value; }',
    'export function resetCalls() { calls.length = 0; }',
    'export function normalizeImage(file, width, quality) {',
    '    calls.push([file, width, quality]);',
    '    return Promise.resolve(next);',
    '}',
].join('\n'));

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === './supabase' || specifier === './supabase.js') {
            return { url: SUPABASE_STUB_URL, shortCircuit: true };
        }
        if (specifier === './imageUtils' || specifier === './imageUtils.js') {
            return { url: IMAGE_UTILS_STUB_URL, shortCircuit: true };
        }
        // The app's own imports are extensionless; Vite resolves them, bare Node does not.
        if (specifier.startsWith('.') && !/\.[cm]?js$/.test(specifier)) {
            return nextResolve(`${specifier}.js`, context);
        }
        return nextResolve(specifier, context);
    },
});

const { uploadDishPhoto } = await import('../src/lib/uploadRecipeImage.js');
const { setClient } = await import(SUPABASE_STUB_URL);
const imageUtils = await import(IMAGE_UTILS_STUB_URL);

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

/** Await a call and report whether it threw, plus the message and value. */
async function caught(fn) {
    try {
        const value = await fn();
        return { threw: false, message: null, value };
    } catch (err) {
        return { threw: true, message: err?.message ?? String(err), value: null, error: err };
    }
}

// ── a recording stand-in for the Supabase client ─────────────────────────────────────────────────
// Only the one surface uploadDishPhoto touches: `storage.from(bucket).upload()/.getPublicUrl()`.
let bucketCalls = [];
let uploadCalls = [];
let uploadReply = { error: null };
let publicUrlCalls = [];
let publicUrl = 'https://example.supabase.co/storage/v1/object/public/recipe-images/x.jpg';

function resetClient() {
    bucketCalls = [];
    uploadCalls = [];
    uploadReply = { error: null };
    publicUrlCalls = [];
    publicUrl = 'https://example.supabase.co/storage/v1/object/public/recipe-images/x.jpg';
}

const fakeClient = {
    storage: {
        from(bucket) {
            bucketCalls.push(bucket);
            return {
                upload(path, file, options) {
                    uploadCalls.push([bucket, path, file, options]);
                    return Promise.resolve(uploadReply);
                },
                getPublicUrl(path) {
                    publicUrlCalls.push(path);
                    return { data: { publicUrl } };
                },
            };
        },
    },
};

const BUCKET = 'recipe-images';
const UUID_JPG = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;
const fakeFile = new File([new Uint8Array([1, 2, 3])], 'dish.png', { type: 'image/png' });
const NORMALIZED = { __normalized: true, for: 'dish.png' };

/** Point every fake at a fresh, successful state. */
function resetAll() {
    resetClient();
    imageUtils.resetCalls();
    imageUtils.setNext(NORMALIZED);
}

// ── the module's own guard, which must fire before anything else ─────────────────────────────────
console.log('\nuploadDishPhoto — the not-configured guard');
resetAll();
setClient(null);
let result = await caught(() => uploadDishPhoto(fakeFile));
check('no Supabase client -> it throws', result.threw, true);
check('no Supabase client -> the documented message',
    result.message, 'Supabase is not configured — cannot upload photo.');
check('no Supabase client -> it throws an Error', result.error instanceof Error, true);
check('no Supabase client -> the file is never normalized (the guard fires first)',
    imageUtils.calls.length, 0);
check('no Supabase client -> no bucket was touched', [bucketCalls.length, uploadCalls.length], [0, 0]);

// ── the normalization call: the numbers nothing else pins ────────────────────────────────────────
console.log('\nuploadDishPhoto — the normalization arguments');
setClient(fakeClient);
resetAll();
await caught(() => uploadDishPhoto(fakeFile));
check('normalizeImage is called exactly once', imageUtils.calls.length, 1);
check('it is handed the caller\'s file', imageUtils.calls[0]?.[0] === fakeFile, true);
check('the max dimension is 1600', imageUtils.calls[0]?.[1], 1600);
check('the JPEG quality is 0.85', imageUtils.calls[0]?.[2], 0.85);
check('the NORMALIZED result is what gets uploaded, not the raw file',
    uploadCalls[0]?.[2] === NORMALIZED, true);
check('the raw file is not what gets uploaded', uploadCalls[0]?.[2] === fakeFile, false);

// ── where it lands, and under what name ──────────────────────────────────────────────────────────
console.log('\nuploadDishPhoto — bucket, object path and upload options');
resetAll();
result = await caught(() => uploadDishPhoto(fakeFile));
check('it succeeded', result.threw, false);
// `.from(BUCKET)` is called twice: once for the upload, once for the URL lookup. Both must name the
// same bucket — a mismatch would return the public URL of an object in a different bucket.
check('the bucket is recipe-images on both the upload and the URL lookup',
    bucketCalls, [BUCKET, BUCKET]);
check('the object path is a uuid.jpg', UUID_JPG.test(uploadCalls[0]?.[1] ?? ''), true);
check('the upload is declared image/jpeg',
    uploadCalls[0]?.[3], { contentType: 'image/jpeg', upsert: false });
check('upsert is off (a re-capture of the same photo must not overwrite another object)',
    uploadCalls[0]?.[3]?.upsert, false);
check('the upload happens once', uploadCalls.length, 1);

// ── the return value, and the URL lookup for that exact path ─────────────────────────────────────
console.log('\nuploadDishPhoto — the returned public URL');
check('getPublicUrl is asked for the path that was uploaded',
    publicUrlCalls, [uploadCalls[0][1]]);
check('the returned value is exactly data.publicUrl', result.value, publicUrl);

// ── two captures must not collide on one object name ─────────────────────────────────────────────
console.log('\nuploadDishPhoto — path uniqueness across calls');
resetAll();
const first = await caught(() => uploadDishPhoto(fakeFile));
const second = await caught(() => uploadDishPhoto(fakeFile));
check('both calls succeeded', [first.threw, second.threw], [false, false]);
check('the two object paths differ',
    uploadCalls[0][1] !== uploadCalls[1][1], true);
check('both paths match the uuid.jpg shape',
    [UUID_JPG.test(uploadCalls[0][1]), UUID_JPG.test(uploadCalls[1][1])], [true, true]);

// ── the two documented failure messages, mapped from the Storage error ───────────────────────────
console.log('\nuploadDishPhoto — upload failures are mapped to messages a user can act on');

const MISSING_BUCKET = 'No "recipe-images" storage bucket exists in Supabase yet — create one '
    + '(Storage → New bucket, name it "recipe-images", make it public) and try again.';

resetAll();
uploadReply = { error: { message: 'bucket not found' } };
result = await caught(() => uploadDishPhoto(fakeFile));
check('a missing bucket is reported, not thrown raw', result.threw, true);
check('the missing-bucket message names the bucket and the fix', result.message, MISSING_BUCKET);
check('a failed upload requests no public URL', publicUrlCalls, []);

resetAll();
uploadReply = { error: { message: 'Bucket Not Found' } };
result = await caught(() => uploadDishPhoto(fakeFile));
check('the bucket-not-found match is case-insensitive (the API\'s own casing varies)',
    result.message, MISSING_BUCKET);

resetAll();
uploadReply = { error: { message: 'Payload too large' } };
result = await caught(() => uploadDishPhoto(fakeFile));
check('any other upload error is prefixed for the user',
    result.message, 'Could not upload photo: Payload too large');
check('the prefix is applied to the API\'s own text, verbatim, without a "bucket" match',
    result.message.includes('Payload too large'), true);
check('a failed upload requests no public URL', publicUrlCalls, []);

resetAll();
uploadReply = { error: {} };
result = await caught(() => uploadDishPhoto(fakeFile));
check('an error object with no message still maps to a user-visible string',
    result.message, 'Could not upload photo: undefined');
check('and it throws rather than resolving to a URL', result.value, null);

// ────────────────────────────────────────────────────────────────────────────────────────────────
setClient(null);
console.log('');
if (failures) {
    console.log(`${failures} FAILED`);
    process.exit(1);
}
console.log('all checks passed');
