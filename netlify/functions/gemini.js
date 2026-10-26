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
// whichever provider can serve the request, in this order:
//
//   1. OPENROUTER_API_KEY -> OpenRouter      (preferred)
//   2. GEMINI_API_KEY     -> Gemini direct   (the fallback)
//
// Why OpenRouter is preferred: the app was hitting Gemini's free-tier quota ("Gemini rate
// limit or quota reached") during ordinary use, which makes the Capture tab unusable at
// exactly the moment it is wanted. OpenRouter bills against its own balance with no such
// ceiling. It also runs the same model — google/gemini-2.5-flash — so the prompt and the
// JSON schema, both tuned against Gemini, keep behaving the same way.
//
// Why the fallback fires on FAILURE and not merely on absence — this is the part that was
// learned the hard way. The first version of this file fell back only when
// OPENROUTER_API_KEY was missing. On the first production deploy the variable turned out to
// be *present but holding a value OpenRouter rejected*, so every call took the OpenRouter
// branch and returned 401 and the app was worse off than before the change. Being
// configured is not the same as being usable, so the rule is now: if OpenRouter cannot
// serve the request for reasons that are about OpenRouter rather than about the request,
// try Gemini. See shouldFallBackToGemini() for the exact status list.
//
// Every successful response names the provider that served it, in a `provider` field. The
// client only reads `text`, so this is additive — and it means the live behaviour can be
// seen from outside, which it could not be before.

import { GoogleGenAI } from '@google/genai';
import {
    OPENROUTER_ENDPOINT,
    openRouterFailure,
    shouldFallBackToGemini,
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

/** Returns { ok, status, payload } rather than a Response, so the caller can fall back. */
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
        // A transport failure, not a provider rejection. 502: the fault is upstream.
        return { ok: false, status: 502, code: null,
                 payload: { error: `Could not reach OpenRouter: ${err?.message ?? err}` } };
    }

    let json;
    try {
        json = await res.json();
    } catch {
        return { ok: false, status: 502, code: null,
                 payload: { error: `OpenRouter returned a non-JSON response (${res.status}).` } };
    }

    if (!res.ok || json?.error) {
        // The nested error object goes back as JSON so the app's describeApiError() can
        // still recognise a 429 and say "rate limit" in plain words.
        const failure = openRouterFailure(json, res.status);
        return { ok: false, status: res.status >= 400 ? res.status : 502, code: failure.code,
                 payload: { error: failure.text } };
    }

    return { ok: true, status: 200,
             payload: { text: textFromOpenRouterResponse(json), provider: 'openrouter' } };
}

async function viaGemini({ model, contents, config }) {
    try {
        const response = await gemini.models.generateContent({ model, contents, config });
        return { ok: true, status: 200,
                 payload: { text: response.text ?? '', provider: 'gemini' } };
    } catch (err) {
        return { ok: false, status: 500, code: err?.status ?? null,
                 payload: { error: err?.message ?? String(err) } };
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

    // OpenRouter not configured: Gemini is the only provider.
    if (!OPENROUTER_KEY) {
        const only = await viaGemini({ model, contents, config });
        return jsonResponse(only.status, only.payload);
    }

    const primary = await viaOpenRouter({ model, contents, config });
    if (primary.ok) return jsonResponse(primary.status, primary.payload);

    // The configured provider could not serve it. If the failure is about OpenRouter
    // rather than about the request, and Gemini is available, use it — a wrong or expired
    // key should degrade the app, not break it.
    if (gemini && shouldFallBackToGemini(primary.status, primary.code)) {
        const fallback = await viaGemini({ model, contents, config });
        if (fallback.ok) {
            // Say that a fallback happened, so it is visible rather than silent.
            return jsonResponse(fallback.status, { ...fallback.payload, fellBack: true });
        }
    }

    // Nothing could serve it. Report the ORIGINAL failure: that is the one describing the
    // provider the app is actually configured to use, and so the one worth acting on.
    return jsonResponse(primary.status, primary.payload);
};
