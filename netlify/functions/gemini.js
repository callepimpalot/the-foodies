// netlify/functions/gemini.js
//
// Server-side proxy for Gemini. The Gemini API key must NOT live in the client
// bundle (anyone can extract a VITE_* var from the deployed JS), so every
// generateContent call goes through this function, which holds GEMINI_API_KEY
// as a server-side Netlify env var.
//
// The client (src/lib/geminiClient.js) POSTs { model, contents, config } and
// gets back { text } — the same shape the @google/genai SDK returns, minus the
// key. `contents` may be a string OR an array of parts including inlineData
// (base64) for image extraction, and `config` carries responseSchema for
// structured output; both are forwarded to the SDK unchanged.

import { GoogleGenAI } from '@google/genai';

const API_KEY = process.env.GEMINI_API_KEY;
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

function jsonResponse(status, payload) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

export default async (req) => {
    if (req.method !== 'POST') {
        return jsonResponse(405, { error: 'Use POST with a JSON body.' });
    }

    if (!ai) {
        return jsonResponse(500, {
            error: 'Gemini is not configured on the server (missing GEMINI_API_KEY).',
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

    try {
        const response = await ai.models.generateContent({ model, contents, config });
        return jsonResponse(200, { text: response.text ?? '' });
    } catch (err) {
        return jsonResponse(500, { error: err?.message ?? String(err) });
    }
};
