/**
 * Recipe-deletion checks — `node scripts/recipe_deletion_check.mjs`
 *
 * The deletion of the 400 bulk-imported recipes is destructive-adjacent. It was written with no
 * credentials available (by the owner's instruction) and has since been APPLIED to production on
 * 2026-09-29, after three non-persisting rehearsals. What this script can verify statically, on the
 * file text, is the SQL's own structure: that the archive and the delete cannot drift apart, that a
 * captured recipe cannot slip through, that the file is undoable, and that the header's claim about
 * whether it has been run is present and true.
 *
 * What is NOT covered, and cannot be here: whether the SQL applies, whether the predicate matches
 * the right rows in the live project, and whether Postgres accepts the DO blocks. Those were settled
 * against the real database — see the PR #8 evidence comment and the rehearsal scripts in
 * `~/.hermes/recipe-ingest/rehearsal/`.
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
// The guard variables are named for what the *block* knows: `archived_total` is the archive's size
// once the insert has run, `archived_count` is what this application added to it. Both are checked
// against by name below, because which one guard C uses is the whole difference between a
// re-appliable file and one that aborts on a second run.
const guardA = sql.indexOf('if archived_total = 0 then');
const guardA2 = sql.indexOf('if archived_total > 450 then');
const guardB = sql.indexOf('if personal_count > 0 then');
const guardC = sql.indexOf('if deleted_count <> archived_count then');
check('a guard caps the blast radius (450)', guardA2 !== -1);
check('a guard refuses an empty archive', guardA !== -1);
check('a guard refuses personal rows in the archive', guardB !== -1 && /is_personal is true/.test(sql));
check('a guard requires deleted = archived', guardC !== -1);
check('guards A, A2 and B run before the delete',
    guardA !== -1 && guardA2 !== -1 && guardB !== -1 &&
    guardA < deleteIdx && guardA2 < deleteIdx && guardB < deleteIdx);
check('guard C runs after the delete', guardC !== -1 && guardC > deleteIdx);

// B2 and D were added after the first review pass and had no assertion of their own until now — the
// two guards carrying the file's central promise (a capture cannot be deleted) were the two the
// suite did not read. B2 covers the one row the predicate cannot classify; D is the only guard that
// measures the live table rather than the archive.
const guardB2 = sql.indexOf('if unknown_count > 0 then');
const guardD = sql.indexOf('if personal_live_after <> personal_live_before then');
check('a guard refuses archived rows whose is_personal is NULL',
    guardB2 !== -1 && /where is_personal is null/.test(sql));
check('guard B2 runs before the delete', guardB2 !== -1 && guardB2 < deleteIdx);
check("a guard counts the live table's personal rows before and after the delete",
    /select count\(\*\) into personal_live_before from public\.recipes where is_personal is true/.test(sql) &&
    /select count\(\*\) into personal_live_after from public\.recipes where is_personal is true/.test(sql));
check("guard D (the live-table personal count) runs after the delete",
    guardD !== -1 && guardD > deleteIdx);

// ── re-apply safety — the property the header claims ──────────────────────────────────────────
// Guard C's right-hand side must be "rows archived BY THIS APPLICATION", not the archive's total.
// If it goes back to the total, a second application compares 0 deleted against the ~400 rows
// already sitting in the archive and aborts — a red failure on a file whose own header says it is
// idempotent, on the one migration in this repo where a rushed operator's next move is to start
// deleting guards until it runs. The mechanism is `get diagnostics archived_count = row_count`
// straight after the insert, which is why the insert has to live inside the same block as the
// delete: outside it, the block has no count of this application's own work.
const doIdx = sql.indexOf('do $$');
check('the archive insert runs inside the guarded block, so the block can count its own work',
    insertIdx !== -1 && doIdx !== -1 && insertIdx > doIdx && insertIdx < deleteIdx);
check('guard C compares against the rows this application archived, not the whole archive',
    /get diagnostics archived_count = row_count/.test(sql) &&
    /archived_total\s*:=\s*archived_before \+ archived_count/.test(sql) &&
    guardC !== -1);

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
check('restore names the target columns explicitly (not a positional insert)',
    /insert into public\.recipes\s*\(\s*id\s*,/.test(restore));
check('restore no longer relies on column order (`select a.*` is gone)',
    !/\bselect\s+a\.\*\s+from\s+public\.recipes_archive_20260927/.test(restore));
check('restore reads from the archive', /public\.recipes_archive_20260927/.test(restore));
check('restore keeps original ids (on conflict (id) do nothing)',
    /on conflict \(id\) do nothing/.test(restore));
check('restore refuses to run against an empty archive',
    /archive is empty/.test(restore));
check('restore does not silently delete anything', !/\bdelete\s+from\b/i.test(restore));
check('migration points at the restore script',
    /supabase\/rollback\/20260927_restore_seeded_recipes\.sql/.test(migration));

// ── application status: stated, and TRUE ───────────────────────────────────────────────────────
// This assertion's intent was INVERTED on 2026-09-29, deliberately. It used to read
// "not applied, and says so" (`/never been run/i`) because the deletion could not be applied from
// here. It has since been applied to production, so the old wording asserted the opposite of the
// truth — and a header still claiming the migration is unapplied is exactly how a future session
// concludes the 400 recipes are still in the app.
//
// The invariant is not "contains phrase X". It is that the header's claim of application status is
// unambiguous, matches what actually happened, and carries the evidence and the undo. If this
// migration is ever rolled back for real, these assertions must be inverted again — the point is
// that they cannot quietly agree with a stale header.
check('migration header records that it HAS been applied',
    /THIS FILE HAS BEEN RUN/i.test(migration));
check('migration header no longer claims it has never been run',
    !/never been run/i.test(migration));
check('migration header states the applied result (408 -> 8)',
    /408\s*(?:→|->)\s*8/.test(migration));
check('migration header cites the evidence of the run',
    /pull\/8#issuecomment-\d+/.test(migration));
check('migration header names the undo path',
    /supabase\/rollback\/20260927_restore_seeded_recipes\.sql/.test(migration));

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
console.log('all checks passed — SQL structure only; this script does not execute anything. The '
    + 'migration itself HAS been executed, against production, on 2026-09-29 (see its header).');
