/**
 * RLS coverage check — `node scripts/rls_coverage_check.mjs [file.sql ...]`
 *
 * WHY THIS EXISTS
 * TASK_07's entire security model is row level security: the anon key is in the public bundle, so
 * the only thing standing between one household's plans and another's is that every table has RLS
 * enabled and a policy (or a revoke) gating access. Nothing in this repo asserted that.
 *
 * That is not a guess. Mutation controls were run against `scripts/task07_check.mjs` at the head of
 * PR #11 (the branch that extends it to 48 assertions):
 *
 *   (a) `public.households` `alter table ... enable row level security` -> `disable`
 *   (b) the `plan_state` enable line deleted outright
 *
 * Both leave the suite at **48 ok / 0 FAIL, exit 0**. The suite can go red (a `join_code` CHECK
 * length change, or `when unique_violation` -> `when others`, each produce a named FAIL), so it is
 * not vacuous — it simply does not cover the one property the task rests on. RLS coverage had been
 * re-derived by hand by counting `create table` against `enable row level security` in several
 * runs; a hand count does not fail when someone edits the file, and this does.
 *
 * WHAT IT ASSERTS
 *   1. every table created by a migration has `enable row level security` somewhere in the
 *      migrations directory (not necessarily the same file — a later migration may enable it)
 *   2. no migration contains `disable row level security`
 *   3. every RLS-enabled table is either policed (>=1 `create policy ... on <t>`) or explicitly
 *      revoked (`revoke all on <t> ...`, the archive-table pattern: RLS on, no policies, no grants)
 *   4. every table named in a `create policy` has RLS enabled — a policy on a table whose RLS is
 *      off is decoration: the table is open
 *
 * WHAT IT IS NOT
 * A text check. No SQL engine, parser or database is involved and none is touched. A clean report
 * means the statements exist and line up as described; it does NOT mean the SQL applies, that the
 * policies are *correct*, or that they are reachable by the anon role. Comments are stripped before
 * any assertion, so a file's own prose (the archive migration's header says "RLS on with no
 * policies, and no grants") can never satisfy a check. Non-zero exit on failure.
 *
 * Plain script, no dependencies — same shape as scripts/task07_check.mjs,
 * scripts/recipe_deletion_check.mjs and scripts/migration_reapply_check.mjs. Point it at files
 * outside this checkout when the migration lives on another branch:
 *   node scripts/rls_coverage_check.mjs /path/to/other.sql
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DEFAULT_DIR = join(ROOT, 'supabase/migrations');

let failures = 0;
let vacuous = 0;

function check(name, cond, detail = '') {
    if (cond) {
        console.log(`  ok   ${name}`);
    } else {
        failures += 1;
        console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ''}`);
    }
}

function note(name) {
    vacuous += 1;
    console.log(`  ..   ${name}`);
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

/** `public."Households"` -> `households`; so a quoted/qualified name still compares equal. */
function tableKey(name) {
    return (name ?? '')
        .replace(/"/g, '')
        .split('.')
        .pop()
        .trim()
        .toLowerCase();
}

const IDENT = `"?([a-z0-9_.]+)"?`;

const RE = {
    createTable: new RegExp(`\\bcreate\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?${IDENT}`, 'gi'),
    enableRls: new RegExp(`\\balter\\s+table\\s+(?:only\\s+)?${IDENT}\\s+enable\\s+row\\s+level\\s+security`, 'gi'),
    disableRls: /\bdisable\s+row\s+level\s+security\b/gi,
    policy: new RegExp(`\\bcreate\\s+policy\\s+(?:"([^"]+)"|([a-z0-9_]+))\\s+on\\s+${IDENT}`, 'gi'),
    revokeAll: new RegExp(`\\brevoke\\s+all(?:\\s+privileges)?\\s+on\\s+${IDENT}`, 'gi'),
};

const targets = resolveTargets();
if (targets.length === 0) {
    console.log('  FAIL no .sql files found (pass explicit paths, or run from a checkout with supabase/migrations/)');
    process.exit(1);
}

// --- pass 1: read and parse everything, so an assertion can span files -------------------------
const files = [];
for (const path of targets) {
    let raw;
    try {
        raw = readFileSync(path, 'utf8');
    } catch {
        check(`could not read ${path}`, false);
        continue;
    }
    const sql = stripComments(raw);
    const label = relative(ROOT, path).startsWith('..') ? path : relative(ROOT, path);
    const created = [];
    const enabled = [];
    const policed = [];
    const revoked = [];
    const disabled = [];
    let m;

    RE.createTable.lastIndex = 0;
    while ((m = RE.createTable.exec(sql)) !== null) created.push(tableKey(m[1]));
    RE.enableRls.lastIndex = 0;
    while ((m = RE.enableRls.exec(sql)) !== null) enabled.push(tableKey(m[1]));
    RE.policy.lastIndex = 0;
    while ((m = RE.policy.exec(sql)) !== null) policed.push(tableKey(m[3]));
    RE.revokeAll.lastIndex = 0;
    while ((m = RE.revokeAll.exec(sql)) !== null) revoked.push(tableKey(m[1]));
    RE.disableRls.lastIndex = 0;
    while ((m = RE.disableRls.exec(sql)) !== null) disabled.push(m.index);

    files.push({ label, created, enabled, policed, revoked, disabled });
}

// --- pass 2: the corpus ------------------------------------------------------------------------
const allCreated = new Set(files.flatMap((f) => f.created));
const allEnabled = new Set(files.flatMap((f) => f.enabled));
const policedTables = new Set(files.flatMap((f) => f.policed));
const revokedTables = new Set(files.flatMap((f) => f.revoked));
const allDisabled = files.flatMap((f) => f.disabled.map(() => f.label));

console.log(`${targets.length} file(s) inspected: ${files.map((f) => f.label).join(', ')}\n`);

// --- per file ----------------------------------------------------------------------------------
for (const f of files) {
    console.log(f.label);
    if (f.created.length === 0 && f.enabled.length === 0 && f.policed.length === 0) {
        note('nothing to check in this file — no create table, no RLS statement, no policy');
        continue;
    }
    const unguarded = f.created.filter((t) => !allEnabled.has(t));
    check(
        f.created.length > 0
            ? `every table this file creates has RLS enabled (${f.created.length} table(s))`
            : 'file creates no tables',
        unguarded.length === 0,
        unguarded.length === 0 ? '' : `created without RLS enabled anywhere in the migrations dir: ${unguarded.join(', ')}`,
    );
    if (f.enabled.length > 0) {
        const bare = f.enabled.filter((t) => !policedTables.has(t) && !revokedTables.has(t));
        check(
            `every RLS-enabled table here is policed or revoked (${f.enabled.length} enabled)`,
            bare.length === 0,
            bare.length === 0
                ? ''
                : `RLS on but neither a policy nor "revoke all ... from anon, authenticated": ${bare.join(', ')} ` +
                  '— RLS with no policy denies everything, which is safe but almost never intended',
        );
    }
    console.log('');
}

// --- the corpus-level assertions ---------------------------------------------------------------
console.log('corpus');
const missingRls = [...allCreated].filter((t) => !allEnabled.has(t));
check(
    `every table created by a migration has RLS enabled (${allCreated.size} table(s) created, ${allEnabled.size} enabled)`,
    missingRls.length === 0,
    missingRls.length === 0 ? '' : `created but never enabled: ${missingRls.join(', ')}`,
);

check(
    'no migration disables row level security',
    allDisabled.length === 0,
    allDisabled.length === 0 ? '' : `"disable row level security" appears in: ${[...new Set(allDisabled)].join(', ')}`,
);

const unpoliced = [...allEnabled].filter((t) => !policedTables.has(t) && !revokedTables.has(t));
check(
    `every RLS-enabled table is policed or revoked (${policedTables.size} policed, ${revokedTables.size} revoked-only)`,
    unpoliced.length === 0,
    unpoliced.length === 0 ? '' : `RLS on, no policy and no revoke-all: ${unpoliced.join(', ')}`,
);

const policyTablesWithoutRls = [...policedTables].filter((t) => !allEnabled.has(t));
check(
    `every table a policy names has RLS enabled (${policedTables.size} policed table(s))`,
    policyTablesWithoutRls.length === 0,
    policyTablesWithoutRls.length === 0
        ? ''
        : `a policy on a table whose RLS is off is decoration — the table is open: ${policyTablesWithoutRls.join(', ')}`,
);

check(
    'the check is not vacuous (at least one create table and one enable were inspected)',
    allCreated.size > 0 && allEnabled.size > 0,
    'no create table / enable row level security found — this run proves nothing',
);

console.log(
    `\n${failures === 0 ? 'all checks passed' : `${failures} check(s) FAILED`}` +
        `${vacuous > 0 ? ` (${vacuous} file(s) held nothing to check)` : ''} — static file-text check only; ` +
        'no database was contacted, so a clean report means the statements line up, not that the policies are correct.',
);
process.exit(failures === 0 ? 0 : 1);
