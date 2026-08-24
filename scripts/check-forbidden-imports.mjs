// P0-PKG-05 — forbidden imports in the governance authority layer.
//
// Previously this checked that a local enterprise pseudo-package did not import a
// local protocol pseudo-package by source path. Both are gone. It now enforces the
// import discipline of the layer that replaced them.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const LAYER = 'src/lib/governance/authority';

const FORBIDDEN = [
  { test: (s) => s.includes('src/aoc/protocol') || s.includes('src/aoc/enterprise'), why: 'removed pseudo-upstream tree' },
  { test: (s) => s.startsWith('@pmfreak/aoc-'), why: 'removed pseudo-upstream alias' },
  { test: (s) => /^@aoc\/protocol\/(dist|src)\b|^@aoc-enterprise\/runtime\/(dist|src)\b/.test(s), why: 'deep/private upstream import — use a declared public export' },
];

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile() && p.endsWith('.ts')) out.push(p);
  }
  return out;
}

const files = walk(path.join(root, LAYER));
if (files.length === 0) {
  console.error(`[boundary] ${LAYER} not found`);
  process.exit(1);
}

let failed = false;
for (const file of files) {
  const rel = path.relative(root, file).replaceAll(path.sep, '/');
  const content = fs.readFileSync(file, 'utf8');
  for (const [, spec] of content.matchAll(/from\s+["']([^"']+)["']/g)) {
    for (const rule of FORBIDDEN) {
      if (rule.test(spec)) {
        console.error(`[boundary] ${rel}: forbidden import '${spec}' (${rule.why})`);
        failed = true;
      }
    }
  }
}

if (failed) process.exit(1);
console.log(`[boundary] governance authority layer import discipline verified (${files.length} files).`);
