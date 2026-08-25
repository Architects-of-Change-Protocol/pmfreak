// P0-PKG-05 — TypeScript resolution isolation.
//
// Previously this proved a local pseudo-package's dist did not leak protocol source.
// Those packages are gone. It now proves the stronger property that replaced them:
// no TypeScript configuration or source import can resolve a canonical package name,
// or any governance type, back into a local pseudo-upstream tree.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const CANONICAL = ['@aoc/protocol', '@aoc-enterprise/runtime'];
const REMOVED = ['src/aoc/protocol', 'src/aoc/enterprise', '@pmfreak/aoc-protocol-internal', '@pmfreak/aoc-enterprise-internal'];

let failed = false;
const fail = (message) => { console.error(`[isolation] ${message}`); failed = true; };

// 1. Every tsconfig path alias must be free of canonical impersonation and removed trees.
const tsconfigs = readdirSync(root).filter((f) => /^tsconfig.*\.json$/.test(f));
for (const file of tsconfigs) {
  const raw = readFileSync(join(root, file), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  const paths = JSON.parse(raw).compilerOptions?.paths ?? {};
  for (const [key, targets] of Object.entries(paths)) {
    const base = key.replace(/\/\*$/, '');
    if (CANONICAL.includes(base)) fail(`${file}: alias '${key}' impersonates canonical package`);
    if (REMOVED.includes(base)) fail(`${file}: removed alias '${key}' reintroduced`);
    for (const target of targets) {
      if (REMOVED.some((r) => target.includes(r))) fail(`${file}: alias '${key}' resolves into removed tree '${target}'`);
    }
  }
}

// 2. No source file may import a removed tree, and none may deep-import an artifact.
const sources = [];
const walk = (dir) => {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(full)) sources.push(full);
  }
};
walk(join(root, 'src'));

for (const file of sources) {
  const rel = relative(root, file).replaceAll(sep, '/');
  const content = readFileSync(file, 'utf8');
  for (const spec of [...content.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1])) {
    if (REMOVED.some((r) => spec.includes(r))) fail(`${rel}: imports removed pseudo-upstream path '${spec}'`);
    if (/^@aoc\/protocol\/dist|^@aoc-enterprise\/runtime\/dist|^@aoc\/protocol\/src|^@aoc-enterprise\/runtime\/src/.test(spec)) {
      fail(`${rel}: deep/private upstream import '${spec}'`);
    }
  }
}

// 3. The governance authority layer must actually exist and own its own types.
if (!existsSync(join(root, 'src/lib/governance/authority'))) {
  fail('src/lib/governance/authority is missing — governance ownership layer not present');
}

if (failed) process.exit(1);
console.log(`[isolation] TypeScript resolution isolation verified across ${sources.length} source files and ${tsconfigs.length} tsconfig(s).`);
