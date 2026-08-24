// P0-PKG-05 — governance layer dependency direction.
//
// The former src/aoc/protocol and src/aoc/enterprise pseudo-upstream trees are gone.
// This gate polices the layer that replaced them: PMFreak's governance authority
// domain must depend inward only, must never reach back into the deleted trees, and
// must never resolve a canonical package name through anything but node_modules.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const LAYER = 'src/lib/governance/authority';
const COMPOSITION_ROOT = `${LAYER}/runtime/composition.ts`;

const DELETED_TREES = [
  'src/aoc/protocol',
  'src/aoc/enterprise',
  '@pmfreak/aoc-protocol-internal',
  '@pmfreak/aoc-enterprise-internal',
];

const files = [];
const walk = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && /\.(ts|tsx|js|mjs)$/.test(entry.name)) files.push(full);
  }
};
walk(path.join(root, LAYER));

if (files.length === 0) {
  console.error(`[direction] ${LAYER} not found — the governance authority layer must exist.`);
  process.exit(1);
}

const violations = [];
for (const full of files) {
  const rel = path.relative(root, full).replaceAll(path.sep, '/');
  const content = fs.readFileSync(full, 'utf8');
  const specifiers = [...content.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);

  for (const spec of specifiers) {
    if (DELETED_TREES.some((t) => spec.includes(t))) {
      violations.push(`${rel}: imports removed pseudo-upstream path '${spec}'`);
    }
    // Deep/private imports into the canonical artifacts are forbidden; only
    // declared public subpath exports may be used.
    if (/^@aoc\/protocol\/dist|^@aoc-enterprise\/runtime\/dist/.test(spec)) {
      violations.push(`${rel}: deep/private upstream import '${spec}' — use a declared public export`);
    }
  }

  // Ports must stay free of concrete infrastructure: they are interfaces only.
  if (rel.startsWith(`${LAYER}/ports/`)) {
    if (specifiers.some((s) => s.startsWith('@/lib/') && !s.startsWith('@/lib/governance/authority'))) {
      violations.push(`${rel}: a port must not depend on PMFreak infrastructure modules`);
    }
    if (specifiers.some((s) => s.includes('supabase'))) {
      violations.push(`${rel}: a port must not depend on a database driver`);
    }
  }

  // Only the composition root may read the process-wide adapter registry.
  if (content.includes('getAocAdapter(') && rel !== COMPOSITION_ROOT) {
    violations.push(`${rel}: adapter registry access is only allowed in ${COMPOSITION_ROOT}`);
  }
}

if (violations.length) {
  console.error('Governance layer dependency direction checks failed:\n');
  for (const v of violations) console.error(`- ${v}`);
  process.exit(1);
}

console.log(`[direction] governance layer dependency direction checks passed (${files.length} files).`);
