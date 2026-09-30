/**
 * Rollback-pairing checks — `node scripts/rollback_pairing_check.mjs`
 *
 * Meal Buddy / The Foodies. The archive migration in this repo deletes ~400 rows, and its own
 * header makes the point that the undo is the only thing standing between a mistyped count and
 * lost data. `recipe_deletion_check.mjs` asserts the two files agree with each other; nothing
 * asserted that a *destructive* migration ships an undo at all, or that the undo is kept out of
 * the directory a migration runner applies automatically.
 *
 * What this proves, from file text alone:
 *
 *   1. every migration that destroys rows (`delete from` / `truncate`) opens an explicit
 *      transaction, so a failure part-way through cannot leave a half-done delete;
 *   2. that migration names a rollback file, and the file it names exists in supabase/rollback/;
 *   3. that rollback names the migration back, so the pair is discoverable from either end;
 *   4. every rollback file states that it is deliberately outside supabase/migrations/ — the
 *      directory the Supabase CLI applies in filename order;
 *   5. no rollback file lives inside supabase/migrations/;
 *   6. a rollback that re-inserts rows does it with `on conflict`, so running the undo cannot
 *      overwrite a row the household has edited since.
 *
 * What it does NOT prove, and cannot: that the SQL executes, that the rollback restores the rows
 * byte-for-byte, or that either file's column list matches the live `recipes` shape. Those were
 * settled against the real database (the PR #8 evidence comment, and the rehearsal scripts in
 * `~/.hermes/recipe-ingest/rehearsal/`, plus the rollback-sealed run recorded in §6 of PICKUP.md).
 * **This script contacts no database.** A clean report here is a statement about the repository,
 * not about Postgres.
 *
 * Plain script, non-zero exit on failure — same shape as scripts/task07_check.mjs and
 * scripts/recipe_deletion_check.mjs.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIGRATIONS_DIR = join(ROOT, 'supabase/migrations');
const ROLLBACK_DIR = join(ROOT, 'supabase/rollback');

let failures = 0;
function check(name, cond, detail = '') {
    if (cond) {
        console.log(`  ok   ${name}`);
    } else {
        failures += 1;
        console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ''}`);
    }
}

function read(path) {
    try {
        return readFileSync(path, 'utf8');
    } catch {
        failures += 1;
        console.log(`  FAIL could not read ${path}`);
        return '';
    }
}

function sqlFiles(dir) {
    try {
        return readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    } catch {
        failures += 1;
        console.log(`  FAIL could not list ${dir}`);
        return [];
    }
}

/** Statements only: the archive migration's header *describes* not truncating, so raw text lies. */
function stripComments(sql) {
    return sql
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .map((line) => line.replace(/--.*$/, ''))
        .join('\n');
}

const DESTRUCTIVE = /\b(delete\s+from|truncate)\b/i;
const ROLLBACK_REFERENCE = /supabase\/rollback\/([A-Za-z0-9_.-]+\.sql)/g;
const MIGRATION_REFERENCE = /\b([0-9]{8}[A-Za-z0-9_-]*\.sql)\b/g;

const migrationNames = sqlFiles(MIGRATIONS_DIR);
const rollbackNames = sqlFiles(ROLLBACK_DIR);

console.log('Rollback pairing');

check(`both directories are populated (${migrationNames.length} migration(s), ${rollbackNames.length} rollback file(s))`,
    migrationNames.length > 0 && rollbackNames.length > 0);

check('no rollback file lives inside supabase/migrations/ (the CLI applies that directory)',
    migrationNames.every((f) => !/rollback|restore|undo/i.test(f)),
    migrationNames.filter((f) => /rollback|restore|undo/i.test(f)).join(', '));

const destructive = [];
for (const name of migrationNames) {
    const text = read(join(MIGRATIONS_DIR, name));
    if (!DESTRUCTIVE.test(stripComments(text))) continue;

    // Each failure below is attributed to the file it is about, so a red run names the migration.
    const label = name.replace(/\.sql$/, '');
    const statements = stripComments(text);
    const begin = statements.search(/\bbegin;/);
    const commit = statements.search(/\bcommit;/);
    const deleteAt = statements.search(DESTRUCTIVE);

    const referenced = [...text.matchAll(ROLLBACK_REFERENCE)].map((m) => m[1]);
    const named = [...new Set(referenced)];

    destructive.push({ name, statements, deleteAt, named });

    check(`${label}: a row-destroying migration opens an explicit transaction`,
        begin !== -1 && commit !== -1 && begin < deleteAt && deleteAt < commit,
        `begin=${begin} delete=${deleteAt} commit=${commit}`);

    check(`${label}: it names the rollback file that undoes it`,
        named.length === 1,
        `referenced under supabase/rollback/: ${named.length ? named.join(', ') : '(none)'}`);

    check(`${label}: every rollback file it names exists`,
        named.length > 0 && named.every((f) => rollbackNames.includes(f)),
        named.filter((f) => !rollbackNames.includes(f)).join(', '));
}

console.log(
    destructive.length === 0
        ? '  vacuous  no migration in this repository destroys rows, so checks 1–3 inspected nothing. NOT a pass, and not evidence of anything.'
        : `  read     ${destructive.length} destructive migration(s) inspected: ${destructive.map((d) => d.name).join(', ')}`
);

for (const name of rollbackNames) {
    const text = read(join(ROLLBACK_DIR, name));
    const targets = [...new Set([...text.matchAll(MIGRATION_REFERENCE)].map((m) => m[1]))]
        .filter((f) => migrationNames.includes(f));

    check(`${name}: names the migration it undoes, and that migration is in supabase/migrations/`,
        targets.length === 1,
        `matched: ${targets.length ? targets.join(', ') : '(none)'}`);

    check(`${name}: states that it is deliberately outside supabase/migrations/`,
        text.includes('supabase/migrations/'));

    const inserts = (stripComments(text).match(/\binsert\s+into\b/gi) ?? []).length;
    // Statements only: the file's own header contains the words "on conflict (id) do nothing" while
    // explaining what it will not overwrite, so a raw-text test passes on the documentation instead
    // of on the statement. Control F in the run notes caught exactly that.
    check(`${name}: re-inserts rows without overwriting what the household holds (on conflict, or no insert)`,
        inserts === 0 || /on\s+conflict/i.test(stripComments(text)),
        `${inserts} insert statement(s)`);
}

console.log('');
console.log(failures === 0
    ? `all checks passed — static file-text check only; no database was contacted, so a clean report does not mean the SQL applies.`
    : `${failures} check(s) FAILED — static file-text check only.`);
process.exit(failures === 0 ? 0 : 1);
