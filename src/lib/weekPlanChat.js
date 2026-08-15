import { GoogleGenAI } from '@google/genai';
import { RECIPE_SCHEMA, cleanJson, describeApiError } from './recipeExtraction';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

const DAY_SCHEMA = {
    type: 'object',
    properties: {
        date: { type: 'string' },
        type: { type: 'string', enum: ['recipe', 'leftover', 'note', 'empty'] },
        locked: { type: 'boolean' },
        source: { type: 'string', enum: ['library', 'generated'], nullable: true },
        recipeId: { type: 'string', nullable: true },
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
- libraryShortlist: a condensed list of the user's existing recipe library ({id, title, meal_type,
  tags, kcal, difficulty}) to match suggestions against
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
  constraint (protein, diet, cuisine, meal_type, etc.) and reference it via recipeId (must be an id that
  actually appears in libraryShortlist). Only use source "generated" — inventing a brand-new dish with a
  full recipe body (title, description, cook_time_minutes, difficulty, kcal, base_servings, meal_type,
  ingredients, steps) — when nothing in the library reasonably fits, or the user explicitly asks for
  something new/different from their library.
- type "leftover": set sourceDate to another date in your response whose entry is type "recipe" — never
  point to a leftover or note day, and never to a date that isn't in your response.
- type "note": short free text, e.g. "eating out", "takeaway", "mum's house".
- type "empty" means the user manually added this date as a placeholder with nothing planned yet — it
  is not locked, so treat it like any other unlocked day: fill it in with a recipe/leftover/note if the
  instruction is clearly about that date or about filling out the week generally, otherwise leave it as
  type "empty", copied through unchanged, same as any other day the instruction doesn't address.
- summary: one short, human sentence describing what you did this turn, e.g. "Planned 5 dinners with
  two leftover days — one minced beef, one chicken, one vegan."`;

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

    const payload = {
        scopeDates,
        currentProposal,
        libraryShortlist,
        instruction: instruction.trim(),
    };

    let response;
    try {
        response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${PLAN_PROMPT}\n\nDATA:\n${JSON.stringify(payload)}`,
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
    return { days: parsed.days ?? [], summary: parsed.summary ?? '' };
}
