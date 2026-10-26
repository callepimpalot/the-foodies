/**
 * Family-households checks — `node scripts/family_households_check.mjs`
 *
 * The security-critical properties of the two new migrations, asserted
 * statically from the SQL text (no database needed; the live RLS negatives are
 * rehearsed separately, since RLS cannot be proven without a real Postgres).
 * No test runner exists in this project, so this is a plain script with a
 * non-zero exit code on failure — the same shape as task07_check.mjs.
 *
 * The two files under test sit beside this script:
 *   ../supabase/migrations/20261026_family_households_schema.sql   (additive)
 *   ../supabase/migrations/20261026_tighten_rls.sql                (restricts)
 *
 * A previous checkscript in this repo passed on the file's own header comment
 * (the restore file's prose contained the very statement the assertion was
 * meant to find). So statement-level assertions run on the comment-stripped
 * text; assertions about the whole file / its headers run on the raw text.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(here, '..', 'supabase', 'migrations', '20261026_family_households_schema.sql');
const tightenPath = join(here, '..', 'supabase', 'migrations', '20261026_tighten_rls.sql');

const schemaRaw = readFileSync(schemaPath, 'utf8');
const tightenRaw = readFileSync(tightenPath, 'utf8');

function stripComments(sql) {
    // Full-line and trailing `--` comments only (these files use `--`, no block
    // comments). Cutting each line at the first `--` is safe because no string
    // literal in either file contains `--`.
    return sql
        .split('\n')
        .map((line) => line.split('--')[0])
        .join('\n');
}

const schema = stripComments(schemaRaw);
const tighten = stripComments(tightenRaw);

let failures = 0;
function ok(name) { console.log(`  ok   ${name}`); }
function bad(name, detail) {
    failures += 1;
    console.log(`  FAIL ${name}\n       ${detail}`);
}
function check(name, actual, expected) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) ok(name);
    else bad(name, `expected ${e}\n       actual   ${a}`);
}
function has(name, haystack, needle) {
    if (haystack.includes(needle)) ok(name);
    else bad(name, `missing: ${JSON.stringify(needle)}`);
}
function lacks(name, haystack, needle) {
    if (!haystack.includes(needle)) ok(name);
    else bad(name, `should be absent: ${JSON.stringify(needle)}`);
}

// Fetch a function/statement body: from its `create ...` header to its closing
// `$$;` (or `;` for non-dollar-quoted bodies). Returns the matched slice.
function grab(sql, startAt) {
    const i = sql.indexOf(startAt);
    if (i < 0) return null;
    const rest = sql.slice(i);
    const dollar = rest.indexOf('$$');
    if (dollar < 0) return rest;
    const close = rest.indexOf('$$', dollar + 2);
    return close < 0 ? rest : rest.slice(0, close + 2);
}

const DEFINER = 'security definer';
const SEARCH_PATH = 'set search_path = public';

console.log('\nmembership helpers — definer + pinned search_path');

for (const fn of ['public.is_household_member', 'public.is_household_owner']) {
    const body = grab(schema, `create or replace function ${fn}`);
    check(`${fn} is defined`, body !== null, true);
    if (body !== null) {
        has(`${fn} is security definer`, body, DEFINER);
        has(`${fn} pins search_path`, body, SEARCH_PATH);
    }
}

console.log('\nmembership policies — nobody self-joins, owner gates removal');

// The INSERT policy must be `with check (false)`: joining only happens through
// accept_invite()/claim_household(), never by a member writing their own row.
has('membership INSERT is with check (false)', schema, 'with check (false)');

const deletePolicy = grab(schema, 'create policy "members leave or the owner removes them"');
check('membership DELETE policy exists', deletePolicy !== null, true);
if (deletePolicy !== null) {
    has('a member may delete their OWN row', deletePolicy, 'user_id = auth.uid()');
    has('the owner may delete any row', deletePolicy, 'public.is_household_owner(household_id)');
}

console.log('\nmembership guards (Q4-B consequences)');

const guard = grab(schema, 'create or replace function public.household_members_guard');
check('household_members_guard is defined', guard !== null, true);
if (guard !== null) {
    has('guard is security definer', guard, DEFINER);
    has('guard refuses to strand the household (last member)',
        guard, 'A household must keep at least one member');
    has('guard refuses to strand ownership (last owner)',
        guard, 'The last owner cannot leave');
}
has('guard trigger fires before delete', schema, 'before delete on public.household_members');

console.log('\nRPCs — all definer, all owner-gated where the brief says');

// Eight functions must be security definer with a pinned search_path: the two
// predicates, the guard, and the five RPCs (create_invite,
// create_household_for_user, accept_invite, claim_household,
// transfer_ownership). Asserted per function, not by counting the keyword —
// the prose in a `comment on function ... is '... this is security definer ...'`
// would otherwise read as a ninth, self-satisfying hit.
for (const fn of [
    'public.is_household_member',
    'public.is_household_owner',
    'public.household_members_guard',
    'public.create_invite',
    'public.create_household_for_user',
    'public.accept_invite',
    'public.claim_household',
    'public.transfer_ownership',
]) {
    const body = grab(schema, `create or replace function ${fn}`);
    check(`${fn} is defined`, body !== null, true);
    if (body !== null) {
        has(`${fn} is security definer`, body, DEFINER);
        has(`${fn} pins search_path`, body, SEARCH_PATH);
    }
}

const invite = grab(schema, 'create or replace function public.create_invite');
has('create_invite refuses non-owners', invite, 'Only the household owner can invite');

const accept = grab(schema, 'create or replace function public.accept_invite');
has('accept_invite enforces single use', accept, 'accepted_at is not null');
has('accept_invite enforces expiry', accept, 'expires_at < now()');

const claim = grab(schema, 'create or replace function public.claim_household');
has('claim_household refuses an already-owned household',
    claim, 'This household already belongs to someone else');

const transfer = grab(schema, 'create or replace function public.transfer_ownership');
has('transfer_ownership requires the new owner to be a member',
    transfer, 'The new owner must already be a member');

console.log('\ntighten — membership decides, the client never asserts');

// recipes: captures are private by default (Q1); household_id NULL matches
// nothing for SELECT after this applies.
has('recipes SELECT requires a household (not the global library)',
    tighten, 'using (household_id is not null and public.is_household_member(household_id))');
has('recipes INSERT requires membership',
    tighten, 'with check (household_id is not null and public.is_household_member(household_id))');
// cook_feedback: member_id must be the writer, so one member cannot steer the
// taste model as another.
has('cook_feedback INSERT pins member_id to the writer',
    tighten, 'with check (public.is_household_member(household_id) and member_id = auth.uid())');

console.log('\ntighten — the header path and the anon role are closed');

has('request_household_id() is dropped', tighten, 'drop function if exists public.request_household_id()');

const TABLES = ['households', 'household_members', 'household_invites', 'recipes',
    'cook_feedback', 'meal_plans', 'shopping_state', 'plan_state', 'essentials',
    'essentials_categories'];
// The revoke must be read as ONE statement, not as "does the table name appear
// anywhere". A loose `has(tighten, 'public.plan_state')` also matches the
// `on public.plan_state` in that table's own policy definitions, so removing
// plan_state from the revoke list would still read green (the mutation control
// proved it). Slice the revoke statement and assert membership inside it.
const revokeStart = tighten.indexOf('revoke all on public.');
const revokeEnd = tighten.indexOf('from anon', revokeStart);
const revoke = revokeStart < 0 || revokeEnd < 0
    ? ''
    : tighten.slice(revokeStart, revokeEnd);
check('the table revoke targets anon', revoke !== '', true);
for (const t of TABLES) {
    has(`${t} is revoked from anon`, revoke, `public.${t}`);
}
has('create_household(text) is closed to anon',
    tighten, 'revoke execute on function public.create_household(text) from anon');
has('resolve_join_code(text) is closed to anon',
    tighten, 'revoke execute on function public.resolve_join_code(text) from anon');
// Every policy in the tighten file must be authenticated-only.
lacks('no `to anon` policy remains in tighten', tighten, 'to anon');
lacks('no `to public` policy remains in tighten', tighten, 'to public');

console.log('\nnaming rule — members, never child/sub users');

// The stripped SQL carries only real identifiers, so a `child_`/`sub_` strike
// here is an actual schema name, not a doc comment explaining the rule. The
// underscore forms are the only ones that can be real object names (a hyphen
// appears only in the table's own prose, not as an identifier).
lacks('no `child_user` object in either migration', schema + tighten, 'child_user');
lacks('no `sub_user` object in either migration', schema + tighten, 'sub_user');

console.log('\nidempotency — the "safe to run twice" claim');

// Every `create policy` must be preceded by a matching `drop policy if exists`.
function countOccurrences(haystack, needle) {
    return (haystack.match(new RegExp(needle, 'g')) || []).length;
}
for (const [label, sql] of [['schema', schema], ['tighten', tighten]]) {
    const creates = countOccurrences(sql, 'create policy');
    const drops = countOccurrences(sql, 'drop policy if exists');
    check(`${label}: every create policy has a drop (${creates} creates/${drops} drops)`,
        creates === drops, true);
}
// Tables and columns are `if not exists`.
has('household_members created as if-not-exists', schema, 'create table if not exists public.household_members');
has('recipes.household_id added as if-not-exists', schema, 'add column if not exists household_id');
has('recipes.created_by_member_id added as if-not-exists', schema, 'add column if not exists created_by_member_id');

console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);