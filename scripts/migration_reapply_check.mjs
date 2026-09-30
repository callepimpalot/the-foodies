/**
 * Migration re-apply checks — `node scripts/migration_reapply_check.mjs [file.sql ...]`
 *
 * WHY THIS EXISTS
 * A migration that cannot be applied twice is a migration that fails the first time someone
 * re-applies it. PostgreSQL has no `create policy if not exists`, no `create index if not exists`
 * equivalent for policies, and — below PG14 — no `create or replace trigger`, so a file full of
 * bare `create policy` / `create trigger` statements raises `42710 duplicate_object` on the second
 * application. Under the Supabase CLI, which wraps each migration in a transaction, that error
 * rolls the whole file back, so "re-run it to be sure" turns into a red, half-misleading failure.
 *
 * The mixed cases are what make this worth a script: `create table if not exists`,
 * `create or replace function` and `create index if not exists` *look* like they make a file
 * repeatable, and they do cover their own statement — while the policies and triggers beside them
 * do not. This script reports exactly that split.
 *
 * WHAT IT ACCEPTS AS IDEMPOTENT (both patterns exist in this repo)
 *   policies  — `drop policy if exists "<name>" on <table>;` earlier in the file, OR the create
 *               wrapped in a `do $$ ... if not exists (select 1 from pg_policies ...)` block
 *               (the pattern used by 20260822163401_create_cook_feedback.sql)
 *   triggers  — `create or replace trigger` (PG14+), `drop trigger if exists <name> on <table>;`
 *               earlier in the file, OR a `pg_trigger` guard block
 *   tables    — `create table if not exists`
 *   indexes   — `create [unique] index if not exists`
 *   columns   — `alter table ... add column if not exists`
 *   functions — `create or replace function`
 *
 * WHAT IT IS NOT
 * This is a text check. No SQL engine, parser or database is touched by it. A clean report means the
 * file's own statements do not collide on a second application; it does NOT mean the SQL applies,
 * and it says nothing about whether the migration is correct, safe or destructive.
 *
 * AND IT CANNOT TELL YOU ANYTHING ABOUT A FILE WITH NO DDL
 * A file that only deletes or updates rows — 20260927_archive_seeded_recipes.sql is one — declares
 * no `create`/`add` statement, so every check below inspects zero objects and the file collects the
 * same seven `ok` lines as a file that was genuinely read. That reports as `vacuous` here rather
 * than as a pass, because "7 ok" on an unread file is the shape of evidence this repository keeps
 * mistaking for evidence. Exit status is unchanged (0) so a caller iterating the directory does not
 * start failing on it; pass `--strict` to make a vacuous file non-zero. Non-zero exit on failure.
 *
 * Plain script, no dependencies — same shape as scripts/task07_check.mjs and
 * scripts/recipe_deletion_check.mjs. Point it at a file outside this checkout when the migration
 * itself lives on another branch: `node scripts/migration_reapply_check.mjs /path/to/other.sql`
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DEFAULT_DIR = join(ROOT, 'supabase/migrations');

let failures = 0;
let vacuous = 0;
const vacuousFiles = [];
const STRICT = process.argv.slice(2).includes('--strict');
function check(name, cond, detail = '') {
    if (cond) {
        console.log(`  ok   ${name}`);
    } else {
        failures += 1;
        console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ''}`);
    }
}

/** Files to check: explicit argv paths, else every .sql in supabase/migrations. */
function resolveTargets() {
    const argv = process.argv.slice(2).filter((a) => !a.startsWith('-'));
    if (argv.length > 0) return argv;
    try {
        return readdirSync(DEFAULT_DIR)
            .filter((f) => f.endsWith('.sql'))
            .sort()
            .map((f) => join(DEFAULT_DIR, f));
    } catch {
        return [];
    }
}

/** Strip `--` line comments and block comments so a file's own prose cannot match a statement regex. */
function stripComments(sql) {
    return sql
        .split('\n')
        .map((line) => line.replace(/--.*$/, ''))
        .join('\n')
        .replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Last index of `needle` before `before`, or -1. Used for "is the drop earlier in the file". */
function indexBefore(text, needle, before) {
    const i = text.lastIndexOf(needle.toLowerCase(), before);
    return i;
}

/** The text of the enclosing `do $$ ... $$;` block around an offset, lowercased, or ''. */
function enclosingDoBlock(text, offset) {
    const open = text.lastIndexOf('do $$', offset);
    if (open === -1) return '';
    const close = text.indexOf('$$;', open);
    if (close === -1 || close < offset) return '';
    return text.slice(open, close).toLowerCase();
}

const QUOTED = `(?:"([^"]+)"|([a-z0-9_]+))`;
const IDENT = `(?:"?([a-z0-9_.]+)"?)`;

const targets = resolveTargets();
if (targets.length === 0) {
    console.log('  FAIL no .sql files found (pass explicit paths, or run from a checkout with supabase/migrations/)');
    failures += 1;
}

for (const path of targets) {
    let raw;
    try {
        raw = readFileSync(path, 'utf8');
    } catch {
        failures += 1;
        console.log(`  FAIL could not read ${path}`);
        continue;
    }
    const sql = stripComments(raw);
    const low = sql.toLowerCase();
    const label = relative(ROOT, path).startsWith('..') ? path : relative(ROOT, path);
    console.log(`\n${label}`);

    // --- policies -------------------------------------------------------------------------------
    const policyRe = new RegExp(`create\\s+policy\\s+${QUOTED}\\s+on\\s+${IDENT}`, 'gi');
    let m;
    let policyCount = 0;
    const nonIdempotentPolicies = [];
    while ((m = policyRe.exec(low)) !== null) {
        policyCount += 1;
        const name = (m[1] ?? m[2] ?? '').toLowerCase();
        const table = (m[3] ?? '').toLowerCase();
        const dropAt = indexBefore(low, `drop policy if exists "${name}"`, m.index);
        const dropAtBare = indexBefore(low, `drop policy if exists ${name}`, m.index);
        const guarded = enclosingDoBlock(sql, m.index).includes('pg_policies')
            && /policyname\s*=\s*['"]/.test(enclosingDoBlock(sql, m.index));
        if (dropAt === -1 && dropAtBare === -1 && !guarded) {
            nonIdempotentPolicies.push(`"${name}" on ${table}`);
        }
    }
    check(
        `every create policy can be re-applied (${policyCount} policy/policies)`,
        nonIdempotentPolicies.length === 0,
        nonIdempotentPolicies.length === 0
            ? ''
            : `${nonIdempotentPolicies.length} without a preceding "drop policy if exists" and not inside a ` +
              `pg_policies guard: ${nonIdempotentPolicies.slice(0, 4).join(', ')}` +
              `${nonIdempotentPolicies.length > 4 ? `, +${nonIdempotentPolicies.length - 4} more` : ''}`,
    );

    // --- triggers -------------------------------------------------------------------------------
    const triggerRe = new RegExp(`create\\s+((?:or\\s+replace\\s+)?)trigger\\s+${IDENT}`, 'gi');
    let triggerCount = 0;
    const nonIdempotentTriggers = [];
    while ((m = triggerRe.exec(low)) !== null) {
        triggerCount += 1;
        const orReplace = (m[1] ?? '').trim().length > 0;
        const name = (m[2] ?? '').toLowerCase();
        if (orReplace) continue; // create or replace trigger — PG14+
        const dropAt = indexBefore(low, `drop trigger if exists ${name}`, m.index);
        const dropAtQuoted = indexBefore(low, `drop trigger if exists "${name}"`, m.index);
        const guarded = enclosingDoBlock(sql, m.index).includes('pg_trigger');
        if (dropAt === -1 && dropAtQuoted === -1 && !guarded) nonIdempotentTriggers.push(name);
    }
    check(
        `every create trigger can be re-applied (${triggerCount} trigger(s))`,
        nonIdempotentTriggers.length === 0,
        nonIdempotentTriggers.length === 0
            ? ''
            : `${nonIdempotentTriggers.length} bare create trigger without "drop trigger if exists" ` +
              `or "create or replace trigger": ${nonIdempotentTriggers.slice(0, 4).join(', ')}` +
              `${nonIdempotentTriggers.length > 4 ? `, +${nonIdempotentTriggers.length - 4} more` : ''}`,
    );

    // --- tables, indexes, columns, functions -----------------------------------------------------
    const tables = low.match(/\bcreate\s+table\b/g) ?? [];
    const tablesIdem = low.match(/\bcreate\s+table\s+if\s+not\s+exists\b/g) ?? [];
    check(`every create table is "if not exists" (${tables.length} table(s))`, tables.length === tablesIdem.length);

    const indexes = low.match(/\bcreate\s+(?:unique\s+)?index\b/g) ?? [];
    const indexesIdem = low.match(/\bcreate\s+(?:unique\s+)?index\s+(?:concurrently\s+)?if\s+not\s+exists\b/g) ?? [];
    check(`every create index is "if not exists" (${indexes.length} index/indexes)`, indexes.length === indexesIdem.length);

    const addCols = low.match(/\badd\s+column\b/g) ?? [];
    const addColsIdem = low.match(/\badd\s+column\s+if\s+not\s+exists\b/g) ?? [];
    check(`every add column is "if not exists" (${addCols.length} column(s))`, addCols.length === addColsIdem.length);

    const funcs = low.match(/\bcreate\s+(?:or\s+replace\s+)?function\b/g) ?? [];
    const funcsIdem = low.match(/\bcreate\s+or\s+replace\s+function\b/g) ?? [];
    check(`every create function is "or replace" (${funcs.length} function(s))`, funcs.length === funcsIdem.length);

    // --- the one thing that makes a whole-file re-run impossible ---------------------------------
    check(
        'file has no bare "create schema"/"create type" that would collide on re-run',
        !/\bcreate\s+(?:schema|type|extension)\b/.test(low),
        'create schema / create type / create extension have no IF NOT EXISTS form — guard them in a DO block',
    );

    // --- did any of the above actually read anything? --------------------------------------------
    // Without this, a file that declares no DDL collects seven `ok` lines for inspecting nothing —
    // the archive pair's rollback (drop-only) is exactly that file. Reporting it as a pass is how a
    // vacuous check gets quoted as evidence, so it is reported as `vacuous` instead.
    const inspected = policyCount + triggerCount + tables.length + indexes.length + addCols.length + funcs.length;
    if (inspected === 0) {
        vacuous += 1;
        vacuousFiles.push(label);
        console.log(
            '  vacuous  nothing to re-apply: this file declares no create/add statement, so every check ' +
                'above inspected 0 objects. NOT a pass, and not evidence of anything.',
        );
    } else {
        console.log(`  read     ${inspected} object declaration(s) inspected`);
    }
}

console.log(
    `\n${failures === 0 ? 'all checks passed' : `${failures} check(s) FAILED`}` +
        (vacuous > 0 ? ` · ${vacuous} vacuous (0 objects inspected): ${vacuousFiles.join(', ')}` : '') +
        ' — static file-text check only; no database was contacted, so a clean report does not mean ' +
        'the SQL applies.' +
        (vacuous > 0 && !STRICT ? ' Re-run with --strict to fail on a vacuous file.' : ''),
);
process.exit(failures === 0 && !(STRICT && vacuous > 0) ? 0 : 1);
