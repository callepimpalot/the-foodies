/**
 * Translating the app's Gemini-shaped AI request into an OpenRouter chat-completions
 * request, and the response back again.
 *
 * Why this exists
 * ---------------
 * Every AI call in the app goes through `netlify/functions/gemini.js`, which holds the
 * provider key server-side. The app speaks the `@google/genai` dialect — `contents` as a
 * string or an array of parts, and `config` carrying `responseSchema` for structured
 * output. Switching provider should not mean rewriting three call sites, so the proxy
 * translates instead and the client contract (`{ model, contents, config }` in, `{ text }`
 * out) is unchanged.
 *
 * Deliberately dependency-free and side-effect-free, like planRows.js: this is the part
 * that can be asserted without a network or a database, and
 * `scripts/openrouter_proxy_check.mjs` does exactly that.
 *
 * On `response_format`: the schema is sent as `json_schema`, NOT as `json_object`.
 * Measured 2026-10-26 against google/gemini-2.5-flash — with `json_object` alone the model
 * returned a shape missing `title`, `cook_time_minutes`, `base_servings`, `meal_type` and
 * `steps`, and emitted `difficulty: "medium"` in lower case, which is outside the schema's
 * enum. With `json_schema` every required key was present and the enums held. The schema is
 * the contract, so it is sent.
 *
 * `strict` is left false on purpose: the app's schema uses `nullable: true`, which is not
 * valid under OpenAI-style strict mode. It happened to be accepted by this model, but a
 * provider that enforces strict would reject the request outright, and a hard failure is a
 * worse outcome than a slightly looser guarantee.
 */

export const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/** What the app asks for, and what it gets. Kept as a map so the choice is in one place. */
export const OPENROUTER_DEFAULT_MODEL = 'google/gemini-2.5-flash';

const MODEL_MAP = {
    // The app's own model names -> OpenRouter's namespaced ids. Same models, different route.
    'gemini-2.5-flash': 'google/gemini-2.5-flash',
    'gemini-2.5-pro': 'google/gemini-2.5-pro',
    'gemini-2.0-flash': 'google/gemini-2.0-flash-001',
};

/**
 * A model name from the app -> an OpenRouter model id.
 *
 * An id that already carries a vendor prefix is passed through, so a future call site can
 * name an OpenRouter model directly without this map having to know about it.
 */
export function resolveModel(model) {
    if (!model || typeof model !== 'string') return OPENROUTER_DEFAULT_MODEL;
    if (model.includes('/')) return model;
    return MODEL_MAP[model] ?? OPENROUTER_DEFAULT_MODEL;
}

/**
 * `contents` -> OpenRouter messages.
 *
 * Accepts everything the three call sites actually send: a plain string (dishCuration,
 * weekPlanChat, refineRecipe), a flat array of parts (extractRecipe: a `{text}` part
 * followed by one `{inlineData}` part per image), and — defensively — a `{role, parts}`
 * turn, which is the SDK's other legal shape.
 *
 * Images become `image_url` data URIs. A single text part is flattened back to a plain
 * string, because a text-only request is the common case and an array-of-parts body is
 * noisier to read in a log.
 */
export function contentsToMessages(contents) {
    if (contents == null) return [];

    if (typeof contents === 'string') return [{ role: 'user', content: contents }];

    // A single turn object rather than a flat part list.
    if (!Array.isArray(contents) && Array.isArray(contents.parts)) {
        return [{ role: contents.role ?? 'user', content: partsToContent(contents.parts) }];
    }

    if (!Array.isArray(contents)) return [{ role: 'user', content: String(contents) }];

    // An array of turn objects, each with its own parts.
    if (contents.every((c) => c && Array.isArray(c.parts))) {
        return contents.map((c) => ({ role: c.role ?? 'user', content: partsToContent(c.parts) }));
    }

    return [{ role: 'user', content: partsToContent(contents) }];
}

function partsToContent(parts) {
    const out = [];
    for (const part of parts ?? []) {
        if (typeof part === 'string') { out.push({ type: 'text', text: part }); continue; }
        if (part?.text) { out.push({ type: 'text', text: part.text }); continue; }

        const inline = part?.inlineData ?? part?.inline_data;
        if (inline?.data) {
            const mime = inline.mimeType ?? inline.mime_type ?? 'image/png';
            out.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${inline.data}` } });
        }
        // Anything else is dropped rather than guessed at.
    }
    if (out.length === 1 && out[0].type === 'text') return out[0].text;
    return out;
}

/** The SDK's `config` -> the OpenRouter body's sampling/format fields. */
export function configToBodyFields(config = {}) {
    const out = {};

    if (config.maxOutputTokens) out.max_tokens = config.maxOutputTokens;
    if (typeof config.temperature === 'number') out.temperature = config.temperature;
    if (typeof config.topP === 'number') out.top_p = config.topP;

    if (config.responseSchema) {
        out.response_format = {
            type: 'json_schema',
            json_schema: { name: 'response', strict: false, schema: config.responseSchema },
        };
    } else if (config.responseMimeType === 'application/json') {
        // No schema to enforce — the best available is "please return JSON".
        out.response_format = { type: 'json_object' };
    }

    return out;
}

/** The SDK's `systemInstruction` -> a leading system message. String or `{parts}`. */
export function systemMessages(systemInstruction) {
    if (!systemInstruction) return [];
    const text = typeof systemInstruction === 'string'
        ? systemInstruction
        : (systemInstruction.parts ?? []).map((p) => p?.text ?? '').join('');
    return text ? [{ role: 'system', content: text }] : [];
}

/** Everything together: the app's request -> an OpenRouter request body. */
export function toOpenRouterBody({ model, contents, config } = {}) {
    return {
        model: resolveModel(model),
        messages: [...systemMessages(config?.systemInstruction), ...contentsToMessages(contents)],
        ...configToBodyFields(config),
    };
}

/**
 * An OpenRouter response -> the text the app expects.
 *
 * `content` is normally a string, but a provider may return an array of parts.
 */
export function textFromOpenRouterResponse(json) {
    const message = json?.choices?.[0]?.message;
    if (!message) return '';
    if (typeof message.content === 'string') return message.content;
    if (Array.isArray(message.content)) {
        return message.content.map((p) => (typeof p === 'string' ? p : p?.text ?? '')).join('');
    }
    return '';
}

/**
 * An OpenRouter error body -> something the app's error handler can actually read.
 *
 * `describeApiError()` in recipeExtraction.js recognises a rate limit by parsing the
 * message as JSON and looking for `error.code === 429` or `error.status ===
 * 'RESOURCE_EXHAUSTED'`. OpenRouter reports failures in that same nested shape, so the
 * nested object is passed through as JSON rather than flattened to a bare sentence —
 * that is what keeps "rate limit or quota reached" a friendly message instead of a wall
 * of provider text. The HTTP status is returned alongside it as a fallback signal.
 */
export function openRouterFailure(json, httpStatus) {
    const err = json?.error;
    const code = err?.code ?? httpStatus ?? null;
    const status = err?.status ?? null;

    const payload = { error: { code, status, message: err?.message ?? `OpenRouter request failed (${httpStatus}).` } };

    return { code, status, text: JSON.stringify(payload) };
}
