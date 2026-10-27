/**
 * Environment-boundary checks — `node scripts/env_boundary_check.mjs`
 *
 * WHY THIS EXISTS
 * The whole security premise of this app is a boundary between two kinds of
 * configuration, and until now nothing in the repo asserted it:
 *
 *   * Client vars — `import.meta.env.VITE_*`. Vite replaces these with string
 *     literals at BUILD time, so every one the code reads is baked into the
 *     deployed JavaScript and readable by any visitor. That is fine and
 *     deliberate for the Supabase URL and the anon key (the anon key is in the
 *     public bundle today; RLS is what protects the data) — and it is fatal for
 *     anything else.
 *   * Server vars — `process.env.*`, read inside `netlify/functions/`, which
 *     never reaches the browser. `GEMINI_API_KEY` and the two
 *     `SOCIAL_INGEST_*` values live only there.
 *
 * The `VITE_` prefix is not a naming convention here, it is a publish switch, and
 * the failure it causes is silent: the app keeps working, the key is simply
 * public. This repo has already had that exact failure once — the Gemini key was
 * read in the browser and a doc described it as "by design" — and the fix (PR #4,
 * the key moved behind `netlify/functions/gemini.js`) shipped with no assertion
 * that it stays there. A re-introduction would look like a normal refactor.
 *
 * WHAT IT CHECKS
 *   1. every `import.meta.env.*` read anywhere in code is one of the declared
 *      public vars (a new one is a decision, so the check asks for it to be
 *      declared rather than guessed at)
 *   2. `netlify/functions/` never reads `import.meta.env` (it does not exist in
 *      the functions runtime — a function that used it would read `undefined`)
 *   3. no secret-shaped name is read client-side, even if it is declared
 *   4. the browser bundle does not import the Gemini SDK
 *   5. the browser bundle does not contain the Google API host
 *   6. `process.env` never appears in `src/` (undefined in the browser, and using
 *      it to read a secret would be a false sense of safety)
 *   7. no credential literal is committed in code or `.env.example`
 *   8. every env var the code reads is named in `CLAUDE.md`, the file every agent
 *      reads first — a var that is not there is invisible to the next session
 *
 * WHAT IT IS NOT
 * A text check. No bundler, no build and no network are involved, so it cannot
 * prove what the *deployed* bundle contains — it proves what the source can put
 * there. The literal scan (7) is deliberately narrow (known credential prefixes
 * and length), so a secret in an unrecognised shape would pass; the point is to
 * catch the shapes that actually leak.
 *
 * Docs are exempt from the scans on purpose: `.agent/features/archive/` quotes
 * old code (including a `VITE_GEMINI_API_KEY` line) as history, and a historical
 * record should not be edited to satisfy a check. Only code and `.env.example`
 * are asserted on.
 *
 * Plain script, no dependencies, non-zero exit on failure — same shape as
 * scripts/task07_check.mjs, scripts/recipe_deletion_check.mjs and
 * scripts/migration_reapply_check.mjs.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// The only two vars the client is allowed to read. Both are public *by design*:
// the anon key ships in the deployed bundle and RLS is what protects the data.
// Adding a name here is the deliberate act this check exists to force.
const CLIENT_ALLOWED = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];

// Vite's own built-ins. They are always defined in `import.meta.env` and carry no
// configuration, so they are not a boundary question.
const VITE_BUILTINS = ['MODE', 'DEV', 'PROD', 'BASE_URL', 'SSR'];

// A name that looks like it holds a credential must never be read client-side,
// even if someone has just added it to CLIENT_ALLOWED above.
const SECRET_SHAPE = /(API_?KEY|TOKEN|SECRET|PASSWORD|PASSWD|SERVICE_ROLE|PRIVATE_KEY|CREDENTIAL)/i;

// Credential literal shapes worth failing on. Narrow on purpose: a broad
// "long random string" rule would flag every hash in this repo's docs.
const LITERAL_PATTERNS = [
    ['a Google API key', /AIza[0-9A-Za-z_-]{30,}/],
    ['a Supabase personal access token', /sbp_[0-9a-f]{30,}/i],
    ['a GitHub token', /gh[pousr]_[A-Za-z0-9]{30,}/],
    ['an OpenAI-style key', /sk-[A-Za-z0-9]{30,}/],
    ['a JWT', /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/],
];

const CODE_EXT = /\.(js|jsx|mjs|cjs|html)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'patches', '.git']);
// Whole directories that are documentation rather than code (see the header).
const CODE_ROOTS = ['src', 'netlify', 'scripts', 'landing'];
const ROOT_CODE_FILES = ['vite.config.js', 'eslint.config.js', 'tailwind.config.js', 'postcss.config.js'];

let failures = 0;
function check(name, cond, detail = '') {
    if (cond) {
        console.log(`  ok   ${name}`);
    } else {
        failures += 1;
        console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ''}`);
    }
}

function walk(dir, out = []) {
    let entries;
    try {
        entries = readdirSync(dir);
    } catch {
        return out;
    }
    for (const entry of entries) {
        if (SKIP_DIRS.has(entry) || entry.startsWith('.')) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (CODE_EXT.test(entry)) out.push(full);
    }
    return out;
}

function read(path) {
    try {
        return readFileSync(path, 'utf8');
    } catch {
        return null;
    }
}

const codeFiles = [];
for (const dir of CODE_ROOTS) codeFiles.push(...walk(join(ROOT, dir)));
for (const file of ROOT_CODE_FILES) {
    const full = join(ROOT, file);
    if (read(full) != null) codeFiles.push(full);
}

/** Strip `--` comments, `//` comments and block comments so prose cannot match. */
function stripComments(code) {
    return code
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .split('\n')
        .map((line) => line.replace(/--.*$/, '').replace(/\/\/.*$/, ''))
        .join('\n');
}

// ── collect every env read ───────────────────────────────────────────────────
// Names are recorded with the file they came from so a FAIL can name it.
const clientReads = [];   // import.meta.env.X
const nodeReads = [];     // process.env.X
const filesWithMetaEnv = new Set();
const filesWithProcessEnv = new Set();

for (const path of codeFiles) {
    const raw = read(path);
    if (raw == null) continue;
    const code = stripComments(raw);
    const label = relative(ROOT, path);

    for (const m of code.matchAll(/import\.meta\.env\.([A-Za-z0-9_]+)/g)) {
        clientReads.push({ name: m[1], file: label });
        filesWithMetaEnv.add(label);
    }
    // `import.meta.env` used without a dot-access is still a client read.
    for (const m of code.matchAll(/import\.meta\.env(?!\.[A-Za-z0-9_])/g)) {
        filesWithMetaEnv.add(label);
        void m;
    }
    for (const m of code.matchAll(/process\.env\.([A-Za-z0-9_]+)/g)) {
        nodeReads.push({ name: m[1], file: label });
        filesWithProcessEnv.add(label);
    }
    for (const m of code.matchAll(/process\.env\[/g)) {
        filesWithProcessEnv.add(label);
        void m;
    }
}

const clientNames = [...new Set(clientReads.map((r) => r.name))].sort();
const nodeNames = [...new Set(nodeReads.map((r) => r.name))].sort();

console.log(`\nEnvironment boundary (${codeFiles.length} code files scanned)`);

// ── 1. the client allowlist ──────────────────────────────────────────────────
const undeclared = [...new Set(
    clientReads
        .filter((r) => !CLIENT_ALLOWED.includes(r.name) && !VITE_BUILTINS.includes(r.name))
        .map((r) => `${r.name} (${r.file})`),
)].sort();
check(
    `every client env read is a declared public var (${clientNames.length} distinct name(s) read)`,
    undeclared.length === 0,
    undeclared.length === 0
        ? ''
        : `not in CLIENT_ALLOWED: ${undeclared.join(', ')}. A VITE_ var is baked into the ` +
          'deployed bundle at build time — if the value is a credential, move it behind a Netlify ' +
          'function instead; if it is genuinely public, add it to CLIENT_ALLOWED here.',
);

// ── 2. the functions must not read the client namespace ──────────────────────
const functionsMetaEnv = [...filesWithMetaEnv].filter((f) => f.startsWith('netlify/'));
check(
    'netlify/functions never reads import.meta.env (it is undefined in the functions runtime)',
    functionsMetaEnv.length === 0,
    functionsMetaEnv.length === 0
        ? ''
        : `import.meta.env in: ${functionsMetaEnv.join(', ')} — use process.env there`,
);

// ── 3. a secret-shaped name must never be read client-side ───────────────────
const secretClient = [...new Set(
    clientReads.filter((r) => SECRET_SHAPE.test(r.name)).map((r) => `${r.name} (${r.file})`),
)].sort();
check(
    'no secret-shaped name is read client-side',
    secretClient.length === 0,
    secretClient.length === 0
        ? ''
        : `credential-shaped names read via import.meta.env: ${secretClient.join(', ')}`,
);

// ── 4-5. the browser bundle must not be able to call Gemini directly ─────────
const srcFiles = codeFiles.filter((f) => relative(ROOT, f).startsWith('src' + '/'));
const sdkImports = srcFiles.filter((f) => {
    const code = stripComments(read(f) ?? '');
    return /from\s+['"]@google\/genai['"]|require\(\s*['"]@google\/genai['"]\s*\)/.test(code);
});
check(
    'the browser bundle does not import the Gemini SDK',
    sdkImports.length === 0,
    sdkImports.length === 0 ? '' : sdkImports.map((f) => relative(ROOT, f)).join(', '),
);

const apiHost = srcFiles.filter((f) => /generativelanguage\.googleapis\.com/.test(read(f) ?? ''));
check(
    'the browser bundle does not contain the Google API host',
    apiHost.length === 0,
    apiHost.length === 0 ? '' : apiHost.map((f) => relative(ROOT, f)).join(', '),
);

// ── 6. process.env is not a hiding place in the browser ─────────────────────
const srcProcessEnv = [...filesWithProcessEnv].filter((f) => f.startsWith('src/'));
check(
    'src/ never reads process.env (undefined in the browser, and not a place a secret is safe)',
    srcProcessEnv.length === 0,
    srcProcessEnv.length === 0 ? '' : srcProcessEnv.join(', '),
);

// ── 7. no credential literal in the tree ────────────────────────────────────
const literalHits = [];
for (const path of codeFiles) {
    const code = read(path) ?? '';
    for (const [what, re] of LITERAL_PATTERNS) {
        if (re.test(code)) literalHits.push(`${what} in ${relative(ROOT, path)}`);
    }
}
const envExample = read(join(ROOT, '.env.example')) ?? '';
for (const [what, re] of LITERAL_PATTERNS) {
    // A commented-out example line cannot carry a live value, so only live lines count here.
    const live = envExample
        .split('\n')
        .filter((line) => !line.trim().startsWith('#'))
        .join('\n');
    if (re.test(live)) literalHits.push(`${what} in .env.example`);
}
check(
    'no credential literal is committed in code or .env.example',
    literalHits.length === 0,
    literalHits.length === 0 ? '' : literalHits.join(', '),
);

// ── 8. every env var the code reads is visible in CLAUDE.md ──────────────────
const claude = read(join(ROOT, 'CLAUDE.md'));
check('CLAUDE.md is readable', claude != null);
if (claude != null) {
    const allNames = [...clientNames, ...nodeNames];
    const undocumented = allNames.filter((name) => !claude.includes(name));
    check(
        `every env var the code reads is named in CLAUDE.md (${allNames.length} name(s))`,
        undocumented.length === 0,
        undocumented.length === 0
            ? ''
            : `not named in CLAUDE.md: ${undocumented.join(', ')} — CLAUDE.md is the file every ` +
              'agent reads first, so an undocumented var is invisible to the next session',
    );
}

console.log('');
if (failures > 0) {
    console.log(`${failures} check(s) FAILED`);
    process.exit(1);
}
console.log('all checks passed — source-text boundary only; it does not prove what the deployed '
    + 'bundle contains, only what this source can put into it.');
