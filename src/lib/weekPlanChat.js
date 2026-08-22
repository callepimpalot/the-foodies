import { GoogleGenAI } from '@google/genai';
import { RECIPE_SCHEMA, cleanJson, describeApiError } from './recipeExtraction';
import { unitSystemInstruction } from './unitPreference';
import { recentCookFeedback } from './cookFeedback';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

const DAY_SCHEMA = {
    type: 'object',
    properties: {
        date: { type: 'string' },
        type: { type: 'string', enum: ['recipe', 'leftover', 'note', 'empty'] },
        locked: { type: 'boolean' },
        source: { type: 'string', enum: ['library', 'generated'], nullable: true },
        libraryIndex: { type: 'integer', nullable: true },
        recipe: { ...RECIPE_SCHEMA, nullable: true },
        sourceDate: { type: 'string', nullable: true },
        note: { type: 'string', nullable: true },
    },
    required: ['date', 'type', 'locked'],
};

const WEEK_PLAN_SCHEMA = {
    type: 'object',
    properties: {
        days: { type: 'array', items: DAY_SCHEMA },
        summary: { type: 'string' },
    },
    required: ['days', 'summary'],
};

const PLAN_PROMPT = `You are helping plan a week of home-cooked meals via conversation, like sparring
with a meal-planning friend before committing to a real plan. You'll be given JSON data with:
- scopeDates: every date currently visible in the planner (YYYY-MM-DD), in order
- currentProposal: the plan as it stands so far (empty array on the very first turn) — each entry has a
  "locked" flag
- libraryShortlist: a condensed, 0-indexed array of the user's existing recipe library ({id, title,
  meal_type, tags, kcal, difficulty}) to match suggestions against — you'll reference an entry by its
  position in this array (see libraryIndex below), never by copying its id
- cookHistory: the user's most recent cooks, newest first ({title, tags, rating, note, cooked_at}),
  where rating is "loved" | "fine" | "not_again". May be empty — if it is, plan from the instruction
  alone and do not mention that you have no history.
- instruction: the user's latest message

There are two different modes depending on whether currentProposal is empty:

MODE 1 — FIRST TURN (currentProposal is an empty array): build a fresh proposal from scratch. If the
instruction names a specific subset of scopeDates (e.g. particular weekdays, or "just plan Tue-Thu"),
only include those dates in your response and leave the rest of scopeDates out entirely. Otherwise
include every date in scopeDates.

MODE 2 — FOLLOW-UP TURN (currentProposal already has entries): the set of dates in currentProposal is
now FIXED for the rest of the conversation. You MUST return exactly one entry for every date that
appears in currentProposal — never fewer, never more — regardless of what the instruction says. If the
instruction only mentions one specific day (e.g. "on Wednesday I actually just want a salad"), that
means "change what's on that day" — it does NOT mean "only respond with that day." Every other date
from currentProposal must still appear in your response, copied through unchanged unless the
instruction specifically affects it.

Rules (both modes):
- Never change an entry whose current "locked" value is true — copy it into your output byte-for-byte
  identical (including its date, type, and all fields). If the instruction asks to change a locked day,
  leave that day's entry unchanged in your response and mention in the summary that it's locked and
  can't be changed until unlocked.
- type "recipe": prefer source "library" — pick the best match from libraryShortlist for the stated
  constraint (protein, diet, cuisine, meal_type, etc.) and reference it via libraryIndex, the integer
  position of that entry in the libraryShortlist array (0 for the first entry, 1 for the second, etc.)
  — never invent an index, only use one that's actually within libraryShortlist's length. Only use
  source "generated" — inventing a brand-new dish with a
  full recipe body (title, description, cook_time_minutes, difficulty, kcal, base_servings, meal_type,
  ingredients, steps) — when nothing in the library reasonably fits, or the user explicitly asks for
  something new/different from their library. For any "generated" recipe's ingredients: {{UNIT_INSTRUCTION}}
- type "leftover": set sourceDate to another date in your response whose entry is type "recipe" — never
  point to a leftover or note day, and never to a date that isn't in your response.
- type "note": short free text, e.g. "eating out", "takeaway", "mum's house".
- type "empty" means the user manually added this date as a placeholder with nothing planned yet — it
  is not locked, so treat it like any other unlocked day: fill it in with a recipe/leftover/note if the
  instruction is clearly about that date or about filling out the week generally, otherwise leave it as
  type "empty", copied through unchanged, same as any other day the instruction doesn't address.
- summary: one short, human sentence describing what you did this turn, e.g. "Planned 5 dinners with
  two leftover days — one minced beef, one chicken, one vegan."

Using cookHistory (this is what makes you feel like you know this cook rather than a stranger):
- Prefer dishes rated "loved" when they fit the stated constraint. Don't force one in where it
  doesn't fit — a bad suggestion the user liked once is still a bad suggestion.
- Do NOT suggest anything rated "not_again" unless the user explicitly asks for that dish, or asks
  to give it another go. One bad night isn't a life sentence, so if the same dish also appears with
  a "loved" or "fine" rating, treat it as usually fine rather than banned.
- Treat the notes as real standing preferences, not one-off remarks. A note saying "too spicy for
  the kids" should quietly steer you away from similarly spicy dishes from then on, without the user
  having to say it again every week.
- Use the tags on rated dishes to generalise: several "loved" Thai dishes is a signal about Thai
  food, not only about those exact recipes.
- Vary the week. If something was cooked in the last few days, don't put it straight back on unless
  asked — "knowing them" includes knowing they don't want lasagne twice in one week.
- Never say out loud that you are reading their history, and never quote a rating back at them. Just
  make better suggestions. Mentioning it makes the app feel like it is watching them.`;

// Pure date-string arithmetic — avoids the timezone pitfall of `new Date('YYYY-MM-DD')` being parsed
// as UTC midnight while getDate()/setDate() operate in local time, which can roll the result back a
// calendar day in timezones behind UTC.
export function addDaysToDateStr(dateStr, n) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + n);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// currentProposal is stored (and used elsewhere in the app) with recipeId — translate to the same
// index space the model is asked to respond in, so "copy this locked/unchanged day through" doesn't
// require the model to echo a raw id back either.
function toIndexedProposal(currentProposal, libraryShortlist) {
    return (currentProposal ?? []).map((d) => {
        if (d.type !== 'recipe' || d.source !== 'library') return d;
        const libraryIndex = (libraryShortlist ?? []).findIndex((r) => r.id === d.recipeId);
        const { recipeId: _recipeId, ...rest } = d;
        return { ...rest, libraryIndex: libraryIndex >= 0 ? libraryIndex : null };
    });
}

function assertConfigured() {
    if (!ai) {
        throw new Error('Week planner chat is not configured — missing VITE_GEMINI_API_KEY.');
    }
}

// Sends the current proposal + a natural-language instruction to Gemini and returns the updated
// proposal. Used for both the first message (currentProposal: []) and every follow-up turn — locked
// days are passed through unchanged per PLAN_PROMPT's rules.
export async function planWeek({ instruction, scopeDates, currentProposal, libraryShortlist }) {
    assertConfigured();
    if (!instruction?.trim()) {
        throw new Error('Describe the week you want.');
    }

    // Fetched here rather than passed in, so every existing caller picks up the taste
    // model without changing its call. recentCookFeedback() never throws — it returns
    // [] if the history can't be read, and the planner degrades to exactly the
    // behaviour it had before this feature: it forgets, but it still plans.
    const cookHistory = await recentCookFeedback();

    const payload = {
        scopeDates,
        currentProposal: toIndexedProposal(currentProposal, libraryShortlist),
        libraryShortlist,
        cookHistory,
        instruction: instruction.trim(),
    };

    const planPrompt = PLAN_PROMPT.replace('{{UNIT_INSTRUCTION}}', unitSystemInstruction());
    let response;
    try {
        response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${planPrompt}\n\nDATA:\n${JSON.stringify(payload)}`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: WEEK_PLAN_SCHEMA,
                maxOutputTokens: 8192,
            },
        });
    } catch (err) {
        throw describeApiError(err);
    }

    const raw = cleanJson(response.text);
    if (!raw) throw new Error('Gemini returned an empty response.');
    const parsed = JSON.parse(raw);

    // Translate the model's libraryIndex back into a real recipeId by direct array lookup —
    // correct by construction, unlike asking the model to reproduce a 36-character id from memory.
    // An out-of-range index resolves to recipeId: null, which useWeekPlanChat.js's own validation
    // catches as a final backstop and degrades to an empty day rather than a broken "Unknown recipe."
    const days = (parsed.days ?? []).map((d) => {
        if (d.type === 'recipe' && d.source === 'library') {
            return { ...d, recipeId: libraryShortlist?.[d.libraryIndex]?.id ?? null };
        }
        return d;
    });

    return { days, summary: parsed.summary ?? '' };
}
