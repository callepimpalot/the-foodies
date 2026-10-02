/**
 * Data-model coverage check — `node scripts/data_models_coverage_check.mjs`
 *
 * WHY THIS EXISTS
 * `.agent/DATA_MODELS.md` declares itself (and CLAUDE.md declares it) the source of truth for data
 * shapes. On 2026-10-02 it was measured against the live code and four of its statements were false:
 * it said Plan, Shop and Essentials data were "NOT in Supabase … per-device", that `PlanContext` and
 * `InventoryContext` were "localStorage-backed", and that the shopping list was "not persisted
 * anywhere" — while `src/` had been querying `meal_plans`, `plan_state`, `shopping_state`,
 * `essentials` and `essentials_categories` since TASK_07 shipped on 2026-09-29. It also documented
 * none of the six TASK_07 tables and never mentioned `cook_feedback`, although both are in the live
 * schema. A doc that is authoritative and silent is how a fresh session writes the wrong storage layer
 * for a table that already exists.
 *
 * WHAT IT ASSERTS
 *   1. every Supabase table the app queries — `.from('<table>')` anywhere under `src/` — is named in
 *      `.agent/DATA_MODELS.md`; and
 *   2. it found at least one table and the doc is non-empty, so a clean run is never a run that read
 *      nothing.
 *
 * WHAT IT IS NOT
 * It is a text check and a **name** check. It contacts no database and executes no SQL. It proves a
 * table is *named* in the doc, NOT that the doc's description of it, or its columns, are right — §5's
 * per-table column lists cannot be checked from here because `recipes` has no in-repo DDL. It also
 * only sees `.from()` calls: objects reached by `supabase.rpc(...)` (`create_household`,
 * `resolve_join_code`) and anything queried through a wrapper are invisible to it.
 *
 * Non-zero exit on failure. No dependencies — same shape as scripts/migration_reapply_check.mjs.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const DOC = join(ROOT, '.agent/DATA_MODELS.md');
const SOURCE_EXT = new Set(['.js', '.jsx']);

let failures = 0;
function check(name, cond, detail = '') {
    if (cond) {
        console.log(`  ok   ${name}`);
    } else {
        failures += 1;
        console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ''}`);
    }
}

/** Every .js/.jsx file under src/, recursively. */
function walk(dir, out = []) {
    let entries;
    try {
        entries = readdirSync(dir);
    } catch {
        return out;
    }
    for (const name of entries) {
        if (name === 'node_modules' || name.startsWith('.')) continue;
        const full = join(dir, name);
        let st;
        try {
            st = statSync(full);
        } catch {
            continue;
        }
        if (st.isDirectory()) walk(full, out);
        else if (SOURCE_EXT.has(extname(name))) out.push(full);
    }
    return out;
}

/** Strip line and block comments so a table name mentioned in prose cannot satisfy the assertion. */
function stripComments(code) {
    return code
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .map((line) => line.replace(/\/\/.*$/, ''))
        .join('\n');
}

// --- what the app actually queries --------------------------------------------------------------
const files = walk(SRC);
const FROM_RE = /\.from\(\s*['"]([a-z][a-z0-9_]*)['"]\s*\)/g;
const tables = new Map(); // table -> [relative file, ...]
for (const file of files) {
    let code;
    try {
        code = stripComments(readFileSync(file, 'utf8'));
    } catch {
        continue;
    }
    let m;
    while ((m = FROM_RE.exec(code)) !== null) {
        const table = m[1];
        if (!tables.has(table)) tables.set(table, []);
        tables.get(table).push(relative(ROOT, file));
    }
}

let docText = '';
try {
    docText = readFileSync(DOC, 'utf8');
} catch {
    failures += 1;
    console.log(`  FAIL could not read .agent/DATA_MODELS.md`);
}

check('the data-model doc exists and has content', docText.trim().length > 0);
check(
    `the check is not vacuous — the app's table references were found (${files.length} src files read, ${tables.size} table(s))`,
    files.length > 0 && tables.size > 0,
    'no .from(...) calls found under src/: this run proves nothing about coverage',
);

if (tables.size > 0 && docText.trim().length > 0) {
    const missing = [];
    for (const table of [...tables.keys()].sort()) {
        const named = new RegExp(`(^|[^a-z0-9_])${table}([^a-z0-9_]|$)`).test(docText);
        console.log(`       ${named ? 'named    ' : 'MISSING  '} ${table}  ← ${[...new Set(tables.get(table))].join(', ')}`);
        if (!named) missing.push(table);
    }
    check(
        `every table the app queries is named in .agent/DATA_MODELS.md (${tables.size} table(s))`,
        missing.length === 0,
        `${missing.length} unnamed: ${missing.join(', ')} — document the table, or say why it is out of scope`,
    );
}

console.log(
    `\n${failures === 0 ? 'all checks passed' : `${failures} check(s) FAILED`} — static name check only; ` +
        'no database was contacted and no SQL was executed. A pass means the table is named in the doc, ' +
        'not that the doc describes it correctly.',
);
process.exit(failures === 0 ? 0 : 1);
