// Which capture path a composer submission takes (TASK_08).
//
// Extracted out of CaptureView.jsx purely so it can be asserted from a plain node
// script — this predicate is the single gate protecting the pre-existing text and
// photo capture flows, so a silent regression here is the expensive one.

// A single pasted token that's a bare http(s) URL — nothing else on the line.
// Deliberately strict (no surrounding text, no whitespace, no newlines) so this only
// fires when the user pastes just a link, not when a URL happens to appear inside a
// block of recipe text they copied off a blog.
const BARE_URL_RE = /^https?:\/\/\S+$/i;

export function isBareUrl(value) {
    return BARE_URL_RE.test(value ?? '');
}

// Route to the URL path only when a bare link is the ONLY thing in the composer.
// Any attached photo, or any prose around the link, falls straight through to the
// existing extractRecipe({ text, images }) path completely unchanged.
export function isUrlCapture({ text, imageCount = 0 } = {}) {
    return imageCount === 0 && isBareUrl(text?.trim());
}
