/**
 * UI-primitive checks — `node scripts/ui_primitives_check.mjs`
 *
 * WHY THIS EXISTS
 * Every check script in this directory tests a `.js` module. The four design-system primitives
 * below are `.jsx`, carry real branching logic, and no suite had ever read one of them. Measured,
 * not assumed: reading every `scripts/*_check.mjs` on all 43 remote heads (153 (ref, file) rows,
 * `git ls-tree` + `git cat-file --batch`) and searching each script's text for every basename
 * under `src/` + `netlify/` on `origin/main` — 70 basenames, 41 named by at least one suite,
 * 29 named by nothing, and **all 29 are the React presentational layer** (18 `src/components/*`,
 * 6 `src/views/*`, 3 `src/context/*`, plus `App.jsx` and the design-system CSS). This file takes the
 * four hook-free primitives out of that set: they are the only `.jsx` modules whose entire exported
 * surface is pure — no hook, no context, no DOM — so they are the only ones reachable from a
 * zero-dependency Node process at all.
 *
 * HOW IT REACHES A `.jsx` FILE WITHOUT A DOM OR A RENDERER
 * Node cannot parse JSX, so the module text is transformed in memory with `esbuild` — already in
 * `node_modules` as a Vite dependency, nothing is installed — and executed in a `vm` context whose
 * `require` is anchored at the app file, so the module's own `import React from 'react'` resolves
 * exactly as it does in the build. JSX becomes `React.createElement(...)`, which returns a plain
 * element object: `type`, `props`, `style` and all. Asserting on that object is asserting on the
 * real component function's real output. No renderer, no jsdom, no DOM.
 *
 * WHAT IS PINNED, AND WHY IT IS WORTH PINNING
 * These are the primitives every screen composes, and their contract is entirely class strings and
 * style tokens that nothing else asserts:
 *  - `Button`: the variant→class map, the `|| VARIANT_CLASS.primary` fallback for an unknown
 *    variant, and the `className` merge that must `.trim()` (a stray space is a CSS class of its
 *    own, and DESIGN_SYSTEM tokens are the whole visual language here).
 *  - `Chip`: the `variant="filter"` branch is an interactive toggle and `variant="tag"` is a static
 *    label — they render different elements with different styling — plus the `label ?? children`
 *    fallback that decides what the user reads.
 *  - `FilterChip`: the wrapper must forward to `Chip variant="filter"` (it is the one place the
 *    filter pill is constructed), not re-implement it.
 *  - `TicketCard` / `BoardCard`: the `torn` variant and the class assembly that must not emit a
 *    doubled space.
 *
 * WHAT IS NOT COVERED, AND CANNOT BE HERE
 * This is a node-level logic check. It renders nothing, mounts no component and resolves no CSS —
 * it asserts what the component *returns*, not what it looks like on screen. It says nothing about
 * the components that consume these primitives, and it cannot reach any `.jsx` module that calls a
 * hook or a context (that is why the other 25 presentational files are still uncovered).
 *
 * Plain script, non-zero exit on failure — same shape as scripts/task07_check.mjs.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const here = fileURLToPath(import.meta.url);
const require = createRequire(here);

let transformSync;
try {
    ({ transformSync } = require('esbuild'));
} catch (err) {
    console.log('  FAIL esbuild is not resolvable from scripts/ — this suite cannot read a .jsx file without it');
    console.log(`       ${err.message}`);
    process.exit(1);
}

/** Resolve a module specifier the way Vite does: extensionless relatives get `.jsx`/`.js`. */
function resolveSpecifier(baseRequire, spec) {
    const candidates = [spec, `${spec}.jsx`, `${spec}.js`, `${spec}/index.jsx`, `${spec}/index.js`];
    for (const candidate of candidates) {
        try {
            return baseRequire.resolve(candidate);
        } catch {
            /* try the next extension */
        }
    }
    return null;
}

/** Loaded modules, keyed by absolute path — so an import chain shares one module identity. */
const moduleCache = new Map();

/** Transform a `.jsx` file in memory and hand back its exports. No DOM, no bundler, no temp file. */
function loadJsx(relativePathOrUrl) {
    const abs = relativePathOrUrl instanceof URL
        ? relativePathOrUrl
        : new URL(relativePathOrUrl, import.meta.url);
    const key = fileURLToPath(abs);
    if (moduleCache.has(key)) return moduleCache.get(key);
    const source = readFileSync(abs, 'utf8');
    const { code } = transformSync(source, {
        loader: 'jsx',
        jsx: 'transform',   // React.createElement — the module's own `import React` provides the binding
        format: 'cjs',
        target: 'node20',
    });
    const baseRequire = createRequire(abs);
    // Relatives are resolved and loaded through this same loader, so a `.jsx` import chain works
    // (FilterChip → ./ui/Chip). Bare specifiers (react) go straight to node_modules.
    const moduleRequire = (spec) => {
        if (typeof spec === 'string' && spec.startsWith('.')) {
            const resolved = resolveSpecifier(baseRequire, spec);
            if (!resolved) throw new Error(`Cannot resolve '${spec}' from ${key}`);
            if (resolved.endsWith('.jsx')) return loadJsx(pathToFileURL(resolved));
            return baseRequire(resolved);
        }
        return baseRequire(spec);
    };
    const mod = { exports: {} };
    moduleCache.set(key, mod.exports);
    vm.runInNewContext(code, { require: moduleRequire, module: mod, exports: mod.exports }, { filename: key });
    moduleCache.set(key, mod.exports);
    return mod.exports;
}

let failures = 0;
function check(name, actual, expected) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
        console.log(`  ok   ${name}`);
    } else {
        failures += 1;
        console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
    }
}

const { Button, StampButton, IconButton } = loadJsx('../src/components/ui/Button.jsx');
const { Chip } = loadJsx('../src/components/ui/Chip.jsx');
const { FilterChip } = loadJsx('../src/components/FilterChip.jsx');
const { TicketCard, BoardCard } = loadJsx('../src/components/ui/TicketCard.jsx');

const button = (props = {}) => Button({ children: 'label', ...props });

console.log('\nButton — the variant→class map');

check('the default variant renders btn-primary', button().props.className, 'btn-primary');
check('...on a <button>', button().type, 'button');
check('variant="secondary" renders btn-secondary', button({ variant: 'secondary' }).props.className, 'btn-secondary');
check('variant="ghost" renders btn-ghost', button({ variant: 'ghost' }).props.className, 'btn-ghost');
check('variant="destructive" renders btn-destructive', button({ variant: 'destructive' }).props.className, 'btn-destructive');
check('an unknown variant falls back to btn-primary, not to undefined',
    button({ variant: 'not-a-variant' }).props.className, 'btn-primary');

console.log('\nButton — the className merge');

check('a class is appended to the variant class',
    button({ className: 'mt-2' }).props.className, 'btn-primary mt-2');
check('an empty className leaves no trailing space',
    button({ className: '' }).props.className, 'btn-primary');
check('the default className leaves no trailing space',
    button().props.className, 'btn-primary');

console.log('\nButton — pass-through');

check('extra props reach the element', button({ type: 'submit', disabled: true }).props.type, 'submit');
check('...all of them', button({ type: 'submit', disabled: true }).props.disabled, true);
check('the children reach the element', Button({ children: 'Save' }).props.children, 'Save');
check('StampButton renders btn-stamp', StampButton({ children: 'x' }).props.className, 'btn-stamp');
check('StampButton merges a class', StampButton({ children: 'x', className: 'mt-2' }).props.className, 'btn-stamp mt-2');
check('IconButton renders icon-btn', IconButton({ children: 'x' }).props.className, 'icon-btn');
check('IconButton trims an empty class', IconButton({ children: 'x' }).props.className, 'icon-btn');

console.log('\nChip — the two variants are different elements');

check('variant="tag" (the default) renders a <span>', Chip({ label: 'vegan' }).type, 'span');
check('...carrying the tag class', Chip({ label: 'vegan' }).props.className, 'tag');
check('variant="filter" renders a <button>, not a span', Chip({ variant: 'filter', label: 'dinner' }).type, 'button');

console.log('\nChip — the filter toggle is stateful');

check('an inactive filter is transparent', Chip({ variant: 'filter', active: false, label: 'dinner' }).props.style.background, 'transparent');
check('an active filter is stamp-tinted', Chip({ variant: 'filter', active: true, label: 'dinner' }).props.style.background, 'var(--stamp-tint)');
check('an inactive filter has a dim label', Chip({ variant: 'filter', active: false, label: 'dinner' }).props.style.color, 'var(--chalk-dim)');
check('an active filter has a stamp label', Chip({ variant: 'filter', active: true, label: 'dinner' }).props.style.color, 'var(--stamp)');
check('an inactive filter has a line-coloured border', Chip({ variant: 'filter', active: false, label: 'dinner' }).props.style.border, '1px solid var(--line)');
check('an active filter has a stamp-coloured border', Chip({ variant: 'filter', active: true, label: 'dinner' }).props.style.border, '1px solid var(--stamp)');
check('active defaults to false', Chip({ variant: 'filter', label: 'dinner' }).props.style.background, 'transparent');
check('a tag ignores `active`', Chip({ label: 'vegan', active: true }).props.className, 'tag');

console.log('\nChip — what the user reads');

check('the label is rendered when one is given', Chip({ label: 'vegan' }).props.children, 'vegan');
check('children are the fallback when there is no label', Chip({ children: 'vegan' }).props.children, 'vegan');
check('an empty-string label wins over children (?? falls back only on null/undefined)',
    Chip({ label: '', children: 'ignored' }).props.children, '');
check('a null label falls back to children', Chip({ label: null, children: 'vegan' }).props.children, 'vegan');
check('the filter variant renders the label too', Chip({ variant: 'filter', label: 'dinner' }).props.children, 'dinner');
check('the filter variant falls back to children too', Chip({ variant: 'filter', children: 'dinner' }).props.children, 'dinner');

console.log('\nFilterChip — the wrapper forwards to Chip');

const forwarded = FilterChip({ label: 'dinner', active: true, onClick: () => {} });
check('it renders a Chip, not a re-implementation', forwarded.type === Chip, true);
check('...with variant="filter"', forwarded.props.variant, 'filter');
check('...forwarding the label', forwarded.props.label, 'dinner');
check('...forwarding active', forwarded.props.active, true);
check('...forwarding onClick', typeof forwarded.props.onClick, 'function');

console.log('\nTicketCard — the torn variant');

check('the default card carries the card class', TicketCard({ children: 'x' }).props.className, 'card');
check('torn adds card-torn', TicketCard({ torn: true, children: 'x' }).props.className, 'card card-torn');
check('...and the torn top padding', TicketCard({ torn: true, children: 'x' }).props.style.padding, '24px 20px 20px');
check('untorn keeps the plain padding', TicketCard({ children: 'x' }).props.style.padding, '20px');
check('a class is appended', TicketCard({ className: 'mt-2', children: 'x' }).props.className, 'card mt-2');
check('an empty class emits no doubled space', TicketCard({ className: '', children: 'x' }).props.className, 'card');
check('an eyebrow renders a badge element', typeof TicketCard({ eyebrow: 'NEW', children: 'x' }).props.children[1], 'object');
check('...with the eyebrow text', TicketCard({ eyebrow: 'NEW', children: 'x' }).props.children[1].props.children, 'NEW');
check('no eyebrow renders no badge element', TicketCard({ children: 'x' }).props.children[1], undefined);
check('the torn flag is false by default', TicketCard({ children: 'x' }).props.children[0], false);
check('...and true when asked, so the punch hole renders', typeof TicketCard({ torn: true, children: 'x' }).props.children[0], 'object');
check('the children are still the last thing rendered', TicketCard({ children: 'x' }).props.children[2], 'x');
check('extra props reach the element', TicketCard({ id: 't1', children: 'x' }).props.id, 't1');
check('BoardCard renders card-board', BoardCard({ children: 'x' }).props.className, 'card-board');
check('BoardCard merges a class', BoardCard({ className: 'mt-2', children: 'x' }).props.className, 'card-board mt-2');

console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
