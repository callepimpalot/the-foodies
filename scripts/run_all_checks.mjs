/**
 * Every check script in this repo, run together — `node scripts/run_all_checks.mjs`
 *
 * WHY THIS EXISTS
 * This repo's verification lives in a set of standalone check scripts and, until this file, nothing
 * ran them together:
 * each is invoked by hand, one `node scripts/<name>.mjs` at a time, and `npm run lint` cannot
 * speak about any of them (eslint.config.js scopes its rules to js and jsx files only, so eslint
 * never opens a `.mjs`). The practical effect is that a regression in the SQL, the
 * rollback pairing or the app's search helpers is only noticed when someone remembers to look —
 * which is exactly the failure the scripts were written to prevent. `npm run check` is the
 * missing entry point; this file is what it runs.
 *
 * WHAT IT DOES
 * Discovers every `scripts/*_check.mjs`, runs each one in a child process with the repo root as
 * its working directory, prints its output unmodified, and counts the suite's own verdict lines
 * (`^  ok` / `^  FAIL` — never the summary line, which overcounts by one per file because the
 * "read N object declaration(s) inspected" line is not an ok). Then it prints an aggregate and
 * exits non-zero if any suite failed.
 *
 * WHAT IT IS NOT
 * A convenience wrapper, not a new assertion. It adds no coverage of its own and proves nothing
 * about the SQL: a green run means the check scripts that exist on this branch all passed. It
 * also has no dependency on a database, and it contacts none. Non-zero exit when a suite fails,
 * when a suite exits non-zero, or when a suite produced no `ok` line at all (a suite that cannot
 * run is not a suite that passed).
 *
 * Plain script, no dependencies — same shape as the checks it drives.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SELF = fileURLToPath(new URL(import.meta.url));
const SCRIPTS_DIR = join(ROOT, 'scripts');

/** Every `*_check.mjs` beside this file, sorted so output order is stable between runs. */
function discover() {
    return readdirSync(SCRIPTS_DIR)
        .filter((name) => name.endsWith('_check.mjs'))
        .filter((name) => join(SCRIPTS_DIR, name) !== SELF)
        .sort();
}

/** Count a suite's own verdict lines. `ok`/`FAIL` are printed with a two-space indent. */
function tally(output) {
    const lines = output.split('\n');
    return {
        ok: lines.filter((l) => l.startsWith('  ok')).length,
        fail: lines.filter((l) => l.startsWith('  FAIL')).length,
        vacuous: lines.filter((l) => /\bvacuous\b/i.test(l)).length,
    };
}

const scripts = discover();
if (scripts.length === 0) {
    console.log('no scripts/*_check.mjs found — nothing to run, which is not a pass');
    process.exit(1);
}

console.log(`run_all_checks — ${scripts.length} suite(s) in this checkout: ${scripts.join(', ')}\n`);

let failed = 0;
const summary = [];

for (const name of scripts) {
    console.log(`── ${name} ──`);
    let output = '';
    let status = 0;
    try {
        output = execFileSync(process.execPath, [join(SCRIPTS_DIR, name)], {
            cwd: ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
    } catch (error) {
        // A non-zero exit (or a thrown suite) is a result too: keep whatever it printed.
        output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
        status = typeof error.status === 'number' ? error.status : 1;
    }

    console.log(output.trimEnd());
    console.log('');

    const { ok, fail, vacuous } = tally(output);
    const ran = ok + fail > 0;
    if (!ran) {
        console.log(`   ✗ ${name}: no verdict lines — the suite did not run its assertions\n`);
        failed += 1;
    } else if (fail > 0 || status !== 0) {
        failed += 1;
    }
    summary.push({ name, ok, fail, vacuous, status, ran });
}

console.log('── summary ──');
for (const s of summary) {
    const marker = s.fail > 0 || s.status !== 0 || !s.ran ? '✗' : '✓';
    const extra = [
        s.vacuous > 0 ? `${s.vacuous} vacuous marker(s)` : null,
        s.status !== 0 ? `exit ${s.status}` : null,
    ]
        .filter(Boolean)
        .join(', ');
    console.log(
        `  ${marker} ${s.name.padEnd(32)} ${s.ran ? `${s.ok} ok / ${s.fail} FAIL` : 'did not run'}` +
            (extra ? `  (${extra})` : ''),
    );
}

const totalOk = summary.reduce((n, s) => n + s.ok, 0);
const totalFail = summary.reduce((n, s) => n + s.fail, 0);
console.log(`\n${scripts.length} suite(s) · ${totalOk} ok · ${totalFail} FAIL · ${failed} suite(s) failing`);

if (failed > 0) {
    console.log('FAILED — at least one suite did not pass');
    process.exit(1);
}
console.log('all suites passed — this is a text check; it has executed no SQL and contacted no database');
