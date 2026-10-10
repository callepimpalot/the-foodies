/**
 * Capture-routing checks — `node scripts/capture_routing_check.mjs`
 *
 * WHY THIS EXISTS
 * `src/lib/captureRouting.js` decides which capture path a composer submission takes:
 * a bare pasted link alone goes down the URL-fetch path, while everything else —
 * including a link with a photo attached, or a link sitting inside copied recipe prose
 * — falls through to the pre-existing text/photo extraction. The module's own header
 * says it was extracted out of `CaptureView.jsx` *so it can be asserted from a plain
 * node script*. Until this file, nothing asserted it.
 *
 * That gap matters because the failure is silent in both directions. Too loose a
 * predicate hijacks pasted recipe prose (or a photo of a dish) into a URL fetch that
 * returns nothing; too strict a one leaves a bare link in the text path, where the
 * model is asked to read a URL as though it were a recipe. Neither throws, both are
 * one regex edit away, and this predicate is the single gate in front of the capture
 * flows that already worked.
 *
 * WHAT IT ASSERTS
 *   1. `isBareUrl`    — the "is this the ONLY thing in the composer, and is it a link"
 *                       predicate, including the whitespace and newline edges.
 *   2. `isUrlCapture` — the routing decision itself: bare link AND no attached photo.
 *   3. wiring         — that `CaptureView.jsx` still routes on this predicate and
 *                       passes the live image count, so the module cannot be
 *                       correct-but-unused.
 *
 * WHAT IT IS NOT: a pure-function and file-text check. It does not build the app, run
 * the extraction, or touch the network, and a clean report says nothing about the
 * fetch path or the extraction itself. Non-zero exit on failure — same shape as
 * scripts/task07_check.mjs, scripts/recipe_deletion_check.mjs and
 * scripts/migration_reapply_check.mjs.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { isBareUrl, isUrlCapture } = require('../src/lib/captureRouting.js');

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CAPTURE_VIEW = join(ROOT, 'src/views/CaptureView.jsx');

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

console.log('\nisBareUrl — is the composer a single bare link and nothing else?');

check('a bare https link is a bare URL', isBareUrl('https://example.com/recipe'), true);
check('a bare http link is a bare URL', isBareUrl('http://example.com/recipe'), true);
check('a link with a query string and fragment is still one bare token',
    isBareUrl('https://example.com/r?id=7#step-2'), true);
check('a URL with a non-http scheme is not routed', isBareUrl('mailto:cook@example.com'), false);
check('ordinary prose is not a bare URL', isBareUrl('mix the flour and water'), false);
check('a link with prose around it on the same line is not a bare URL',
    isBareUrl('this looks good https://example.com/r try it'), false);
check('a link pasted above other text is not a bare URL (a newline is not \\S)',
    isBareUrl('https://example.com/r\nthen add salt'), false);
check('two space-separated links are not a single bare token',
    isBareUrl('https://a.example https://b.example'), false);
check('an empty string is not a bare URL', isBareUrl(''), false);
check('whitespace only is not a bare URL', isBareUrl('   '), false);
check('null and undefined do not throw', [isBareUrl(null), isBareUrl(undefined)], [false, false]);

console.log('\nisUrlCapture — the routing decision');

check('a bare link alone routes to the URL path',
    isUrlCapture({ text: 'https://example.com/r', imageCount: 0 }), true);
check('surrounding whitespace around a bare link still routes (the text is trimmed)',
    isUrlCapture({ text: '  https://example.com/r  ', imageCount: 0 }), true);
check('a bare link WITH a photo does NOT route — the photo path wins',
    isUrlCapture({ text: 'https://example.com/r', imageCount: 1 }), false);
check('a bare link with several photos does NOT route',
    isUrlCapture({ text: 'https://example.com/r', imageCount: 3 }), false);
check('a link inside prose does NOT route',
    isUrlCapture({ text: 'found this https://example.com/r looks great', imageCount: 0 }), false);
check('plain pasted recipe text does NOT route',
    isUrlCapture({ text: 'Boil 200g pasta, add sauce.', imageCount: 0 }), false);
check('photos with no text do NOT route', isUrlCapture({ text: '', imageCount: 2 }), false);
check('an empty composer does not route', isUrlCapture({}), false);
check('a called-with-no-arguments invocation does not crash and does not route',
    isUrlCapture(), false);
check('a link with a photo AND surrounding whitespace still does NOT route',
    isUrlCapture({ text: '   https://example.com/r   ', imageCount: 1 }), false);

console.log('\nwiring — CaptureView routes on this predicate, not on its own copy');

let view = '';
try {
    view = readFileSync(CAPTURE_VIEW, 'utf8');
} catch (err) {
    failures += 1;
    console.log(`  FAIL could not read ${CAPTURE_VIEW}: ${err.message}`);
}
const flatView = view.replace(/\s+/g, ' ');

check('CaptureView imports the predicate from src/lib/captureRouting',
    /import \{ isUrlCapture as routesToUrlCapture \} from '\.\.\/lib\/captureRouting'/.test(flatView), true);
check('CaptureView passes the trimmed text and the live image count to the predicate',
    /routesToUrlCapture\(\{ text: trimmedText, imageCount: images\.length \}\)/.test(flatView), true);
check('CaptureView has a branch that keys off the routing decision',
    /if \(isUrlCapture\) \{/.test(flatView), true);

console.log('');
if (failures > 0) {
    console.log(`${failures} check(s) FAILED`);
    process.exit(1);
}
console.log('all checks passed — pure-function and file-text only; the fetch path itself is not exercised.');
