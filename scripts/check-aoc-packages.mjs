// P0-PKG-05 — canonical package identity.
//
// @aoc/protocol and @aoc-enterprise/runtime must mean the frozen upstream artifacts
// and nothing else. No source directory, local manifest, workspace or path alias may
// impersonate either identity, and the former pseudo-upstream trees must stay gone.
//
// Exported as a pure function over a repository root so the negative controls in
// tests/governance-ownership-gate.test.mjs can poison a synthetic root and prove
// each rejection actually fires.
import fs from 'node:fs';
import path from 'node:path';

const CANONICAL = ['@aoc/protocol', '@aoc-enterprise/runtime'];
const FORBIDDEN_TREES = ['src/aoc/protocol', 'src/aoc/enterprise'];
const FORBIDDEN_ALIASES = ['@pmfreak/aoc-protocol-internal', '@pmfreak/aoc-enterprise-internal'];

export function identityChecks(root) {
  const failures = [];
  const fail = (m) => failures.push(m);

  // 1. The pseudo-upstream trees must be absent.
  for (const tree of FORBIDDEN_TREES) {
    if (fs.existsSync(path.join(root, tree))) fail(`pseudo-upstream tree still present: ${tree}`);
  }

  // 2. No local package manifest may declare a canonical or removed name.
  const manifests = [];
  const walk = (dir, depth = 0) => {
    if (depth > 6 || !fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name === '.git') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, depth + 1);
      else if (e.name === 'package.json') manifests.push(full);
    }
  };
  walk(path.join(root, 'src'));
  walk(path.join(root, 'packages'));
  for (const m of manifests) {
    const rel = path.relative(root, m).replaceAll(path.sep, '/');
    let pkg;
    try { pkg = JSON.parse(fs.readFileSync(m, 'utf8')); } catch { fail(`${rel}: unreadable manifest`); continue; }
    if (CANONICAL.includes(pkg.name)) fail(`${rel}: local manifest impersonates canonical package "${pkg.name}"`);
    if (FORBIDDEN_ALIASES.includes(pkg.name)) fail(`${rel}: removed pseudo-upstream package name "${pkg.name}" reintroduced`);
  }

  // 3. The root manifest must resolve both canonical names to pinned tarballs.
  const rootManifestPath = path.join(root, 'package.json');
  if (!fs.existsSync(rootManifestPath)) {
    fail('package.json: missing');
    return { failures };
  }
  const rootPkg = JSON.parse(fs.readFileSync(rootManifestPath, 'utf8'));
  for (const name of CANONICAL) {
    const spec = rootPkg.dependencies?.[name];
    if (!spec) fail(`package.json: missing dependency on canonical package "${name}"`);
    else if (!/^file:vendor\/.+\.tgz$/.test(spec)) {
      fail(`package.json: "${name}" must resolve to a pinned vendor tarball, got "${spec}"`);
    }
  }
  for (const alias of FORBIDDEN_ALIASES) {
    if (rootPkg.dependencies?.[alias] || rootPkg.devDependencies?.[alias]) {
      fail(`package.json: forbidden alias dependency "${alias}"`);
    }
  }
  if (rootPkg.workspaces) fail('package.json: workspaces must not reintroduce local AOC packages');

  // 4. No tsconfig path alias may impersonate a canonical name or reach a removed tree.
  for (const file of fs.readdirSync(root).filter((f) => /^tsconfig.*\.json$/.test(f))) {
    const raw = fs.readFileSync(path.join(root, file), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    let paths;
    try { paths = JSON.parse(raw).compilerOptions?.paths ?? {}; } catch { fail(`${file}: unreadable`); continue; }
    for (const [key, targets] of Object.entries(paths)) {
      const base = key.replace(/\/\*$/, '');
      if (CANONICAL.includes(base)) fail(`${file}: path alias "${key}" impersonates a canonical package`);
      if (FORBIDDEN_ALIASES.includes(base)) fail(`${file}: removed pseudo-upstream alias "${key}" reintroduced`);
      for (const target of targets) {
        if (FORBIDDEN_TREES.some((t) => target.includes(t))) {
          fail(`${file}: path alias "${key}" resolves into removed tree "${target}"`);
        }
      }
    }
  }

  return { failures };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { failures } = identityChecks(process.cwd());
  if (failures.length) {
    console.error('Canonical package identity checks failed:\n');
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
  }
  console.log('[identity] canonical package identity checks passed: @aoc/protocol and @aoc-enterprise/runtime resolve only to the pinned frozen artifacts.');
}
