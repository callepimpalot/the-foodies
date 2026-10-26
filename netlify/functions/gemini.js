// netlify/functions/gemini.js
//
// Server-side AI proxy. The provider key must NOT live in the client bundle (anyone can
// extract a VITE_* var from the deployed JS), so every model call goes through this
// function, which holds the key as a server-side Netlify env var.
//
// The client (src/lib/geminiClient.js) POSTs { model, contents, config } and gets back
// { text } — the same shape the @google/genai SDK returns, minus the key. `contents` may
// be a string OR an array of parts including inlineData (base64) for image extraction,
// and `config` carries responseSchema for structured output.
//
// The filename still says "gemini" because it is the path the client already calls and
// renaming it would be a needless endpoint change. What it actually does now is route to
// whichever provider is configured, in this order:
//
//   1. OPENROUTER_API_KEY  -> OpenRouter     (preferred; see below)
//   2. GEMINI_API_KEY      -> Gemini direct  (kept as the fallback)
//
// Why OpenRouter is preferred: the app was hitting Gemini's free-tier quota ("Gemini rate
// limit or quota reached") during ordinary use, which makes the Capture tab unusable at
// exactly the moment it is wanted. OpenRouter bills against its own balance with no such
// ceiling. It also runs the same model — google/gemini-2.5-flash — so the prompt and the
// JSON schema, both tuned against Gemini, keep behaving the same way.
//
// The fallback is deliberate rather than incidental: this file is deployed by Netlify on
// merge, and the env var is added by hand in the Netlify UI. Until that happens the app
// must keep working, so Gemini stays wired up behind the OpenRouter branch instead of
// being deleted in the same change.

import { GoogleGenAI } from '@google/genai';
import {
    OPENROUTER_ENDPOINT,
    openRouterFailure,
    textFromOpenRouterResponse,
    toOpenRouterBody,
} from '../../src/lib/openRouterRequest.js';

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const gemini = GEMINI_KEY ? new GoogleGenAI({ apiKey: GEMINI_KEY }) : null;

function jsonResponse(status, payload) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

async function viaOpenRouter({ model, contents, config }) {
    let res;
    try {
        res = await fetch(OPENROUTER_ENDPOINT, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${OPENROUTER_KEY}`,
                'Content-Type': 'application/json',
                // OpenRouter uses these for attribution on its dashboard. Harmless, and
                // they make the app's traffic identifiable in the usage log.
                'HTTP-Referer': 'https://thefoodi.netlify.app',
                'X-Title': 'Meal Buddy',
            },
            body: JSON.stringify(toOpenRouterBody({ model, contents, config })),
        });
    } catch (err) {
        // A transport failure, not a provider rejection. 502 rather than 500: the fault
        // is upstream, and the distinction is worth keeping in the status.
        return jsonResponse(502, { error: `Could not reach OpenRouter: ${err?.message ?? err}` });
    }

    let json;
    try {
        json = await res.json();
    } catch {
        return jsonResponse(502, { error: `OpenRouter returned a non-JSON response (${res.status}).` });
    }

    if (!res.ok || json?.error) {
        // The nested error object goes back as JSON so the app's describeApiError() can
        // still recognise a 429 and say "rate limit" in plain words.
        const failure = openRouterFailure(json, res.status);
        return jsonResponse(res.status >= 400 ? res.status : 502, { error: failure.text });
    }

    return jsonResponse(200, { text: textFromOpenRouterResponse(json) });
}

async function viaGemini({ model, contents, config }) {
    try {
        const response = await gemini.models.generateContent({ model, contents, config });
        return jsonResponse(200, { text: response.text ?? '' });
    } catch (err) {
        return jsonResponse(500, { error: err?.message ?? String(err) });
    }
}

export default async (req) => {
    if (req.method !== 'POST') {
        return jsonResponse(405, { error: 'Use POST with a JSON body.' });
    }

    if (!OPENROUTER_KEY && !gemini) {
        return jsonResponse(500, {
            error: 'No AI provider is configured on the server. Set OPENROUTER_API_KEY '
                + '(preferred) or GEMINI_API_KEY in the Netlify environment.',
        });
    }

    let body;
    try {
        body = await req.json();
    } catch {
        return jsonResponse(400, { error: 'Invalid JSON body.' });
    }

    const { model, contents, config } = body ?? {};
    if (!model || contents == null) {
        return jsonResponse(400, { error: 'model and contents are required.' });
    }

    return OPENROUTER_KEY
        ? viaOpenRouter({ model, contents, config })
        : viaGemini({ model, contents, config });
};
