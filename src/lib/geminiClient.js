// src/lib/geminiClient.js
//
// Client for the server-side Gemini proxy (netlify/functions/gemini.js).
// Replaces direct @google/genai use in the browser so the API key never ships
// in the client bundle. Takes the same { model, contents, config } shape the
// SDK's generateContent accepts, and resolves to the response text string.

export async function geminiGenerateContent({ model, contents, config }) {
    let response;
    try {
        response = await fetch('/.netlify/functions/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, contents, config }),
        });
    } catch {
        throw new Error("Couldn't reach the AI service. Check your connection and try again.");
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
        throw new Error(
            "The AI service isn't available here. If you're running `npm run dev`, use `netlify dev` so Netlify Functions are served locally."
        );
    }

    let body;
    try {
        body = await response.json();
    } catch {
        throw new Error("Couldn't read the AI response.");
    }

    if (!response.ok || body?.error) {
        // The HTTP status is attached rather than dropped. describeApiError() recognises a
        // rate limit by its code, and going through this proxy used to lose the status — so
        // a 429 arrived as an opaque string. With the provider behind a proxy, this is the
        // only place the real status can survive.
        const err = new Error(body?.error || `AI request failed (${response.status}).`);
        err.status = response.status;
        throw err;
    }

    return body.text;
}
