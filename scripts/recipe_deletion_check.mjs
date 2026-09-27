/**
 * Recipe-deletion checks — `node scripts/recipe_deletion_check.mjs`
 *
 * The deletion of the 400 bulk-imported recipes is destructive-adjacent and it is never applied in
 * this repo's overnight environment (no credentials, by the owner's instruction), so the only
 * thing that can actually be verified here is the SQL's own structure: that the archive and the
 * delete cannot drift apart, that a captured recipe cannot slip through, and that the file is
 * undoable. That is what this script asserts — statically, on the file text.
 *
 * What is NOT covered, and cannot be: whether the SQL applies, whether the predicate matches the
 * right rows in the live project, and whether Postgres accepts the DO blocks. Those need a real
 * database and are the reviewer's checklist in the PR description.
 *
 * Plain script, non-zero exit on failure — same shape as scripts/task07_check.mjs.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIGRATION = join(ROOT, 'supabase/migrations/20260927_archive_seeded_recipes.sql');
const RESTORE = join(ROOT, 'supabase/rollback/20260927_restore_seeded_recipes.sql');
const PREDICATE = 'coalesce(is_personal, false) = false';

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
        console.log(`  FAIL could read ${path}`);
        return '';
    }
}

// Strip row aliases so `coalesce(r.is_personal, false) = false` and
// `coalesce(is_personal, false) = false` compare equal — they are the same predicate, and the
// point of the check is that the two statements use the same one, not that they are character-identical.
function normalizePredicate(sql) {
    return sql.replace(/\s+/g, ' ').replace(/\b([a-z])\./gi, '');
}

const migration = read(MIGRATION);
const restore = read(RESTORE);

// Statement checks run against the SQL with `--` comments removed. Several of the properties worth
// asserting ("no truncate", "does not touch final_recipes.json") are also things the file's own
// header says it does *not* do, so checking the raw text would fail on its own documentation.
function stripComments(sql) {
    return sql
        .split('\n')
        .map((line) => line.replace(/--.*$/, ''))
        .join('\n');
}
const sql = stripComments(migration);
const flat = normalizePredicate(sql);

console.log('Archive-then-delete migration');

// ── the transaction ───────────────────────────────────────────────────────────────────────────
check('migration opens a transaction', /\bbegin;/.test(sql));
check('migration commits exactly once', (sql.match(/\bcommit;/g) ?? []).length === 1);
check('begin comes before commit',
    sql.search(/\bbegin;/) !== -1 && sql.search(/\bbegin;/) < sql.search(/\bcommit;/));

// ── nothing may drop, truncate or alter the live table ────────────────────────────────────────
check('no truncate anywhere', !/\btruncate\b/i.test(sql));
check('no drop table anywhere', !/\bdrop\s+table\b/i.test(sql));
check('does not alter public.recipes',
    !/alter\s+table\s+(public\.)?recipes\b(?!_)/i.test(sql));
check('does not touch final_recipes.json', !/final_recipes/i.test(sql));

// ── the predicate, used once by the archive and once by the delete ────────────────────────────
const predicateHits = flat.split(PREDICATE).length - 1;
check('the imported-library predicate appears exactly twice (archive insert + delete)',
    predicateHits === 2, `found ${predicateHits}`);
check('predicate excludes anything marked personal', PREDICATE.includes('is_personal'));

const insertIdx = sql.indexOf('insert into public.recipes_archive_20260927');
const deleteIdx = sql.indexOf('delete from public.recipes');
check('the archive insert exists', insertIdx !== -1);
check('exactly one delete statement', (sql.match(/\bdelete\s+from\b/gi) ?? []).length === 1);
check('archive insert happens before the delete',
    insertIdx !== -1 && deleteIdx !== -1 && insertIdx < deleteIdx);

// ── the guards ────────────────────────────────────────────────────────────────────────────────
// A (empty archive) and B (a personal row reached the archive) must fire *before* the delete.
// C (deleted != archived) can only be evaluated after it — it is the post-condition.
const guardA = sql.indexOf('if archived_count = 0 then');
const guardB = sql.indexOf('if personal_count > 0 then');
const guardC = sql.indexOf('if deleted_count <> archived_count then');
check('a guard caps the blast radius (450)', /archived_count\s*>\s*450/.test(sql));
check('a guard refuses an empty archive', guardA !== -1);
check('a guard refuses personal rows in the archive', guardB !== -1 && /is_personal is true/.test(sql));
check('a guard requires deleted = archived', guardC !== -1);
check('guards A and B run before the delete',
    guardA !== -1 && guardB !== -1 && guardA < deleteIdx && guardB < deleteIdx);
check('guard C runs after the delete', guardC !== -1 && guardC > deleteIdx);

// ── the archive is not part of the product ────────────────────────────────────────────────────
check('archive has RLS enabled', /alter table public\.recipes_archive_20260927 enable row level security/.test(sql));
check('archive revokes anon/authenticated grants',
    /revoke all on public\.recipes_archive_20260927 from anon, authenticated/.test(sql));
check('archive insert is idempotent (skips already-archived ids)',
    /not exists \(\s*select 1 from public\.recipes_archive_20260927/.test(sql));

// ── undo path ─────────────────────────────────────────────────────────────────────────────────
check('restore script exists', restore.length > 0);
check('restore script is NOT inside supabase/migrations',
    !MIGRATION.startsWith(RESTORE) && RESTORE.includes('/rollback/'));
check('restore inserts back into public.recipes',
    /insert into public\.recipes/.test(restore));
check('restore reads from the archive', /public\.recipes_archive_20260927/.test(restore));
check('restore keeps original ids (on conflict (id) do nothing)',
    /on conflict \(id\) do nothing/.test(restore));
check('restore refuses to run against an empty archive',
    /archive is empty/.test(restore));
check('restore does not silently delete anything', !/\bdelete\s+from\b/i.test(restore));
check('migration points at the restore script',
    /supabase\/rollback\/20260927_restore_seeded_recipes\.sql/.test(migration));

// ── not applied, and says so ──────────────────────────────────────────────────────────────────
check('migration header states it has never been run',
    /never been run/i.test(migration));

// ── the archive approach means no app change is required ──────────────────────────────────────
// If a soft-delete flag had been used instead, some file under src/ would have to filter on it.
// None does — which is the whole reason the archive table was chosen.
function walk(dir, out = []) {
    for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.(js|jsx)$/.test(entry)) out.push(full);
    }
    return out;
}
const srcFiles = walk(join(ROOT, 'src'));
const mentions = [];
for (const file of srcFiles) {
    const text = readFileSync(file, 'utf8');
    if (/deleted_at|recipes_archive|is_archived/.test(text)) mentions.push(file);
}
check(`no src/ file references a deletion flag or the archive (${srcFiles.length} files scanned)`,
    mentions.length === 0, mentions.join(', '));

console.log('');
if (failures > 0) {
    console.log(`${failures} check(s) FAILED`);
    process.exit(1);
}
console.log('all checks passed — SQL structure only; it has not been executed anywhere.');
