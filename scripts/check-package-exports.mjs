// P0-PKG-05 — canonical package export surface.
//
// This gate used to validate the dist artifacts of two LOCAL pseudo-packages that
// impersonated the canonical names. Those packages no longer exist. It now validates
// the surface PMFreak actually consumes: the installed frozen artifacts, resolved
// from node_modules, with every declared public export loadable.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const root = process.cwd();

const packages = [
  { name: '@aoc/protocol', version: '0.2.0-rc.0', requiredExports: ['.', './contracts', './canonical', './adapters', './errors'] },
  { name: '@aoc-enterprise/runtime', version: '1.2.0', requiredExports: ['.', './runtime', './authorization', './audit', './adapters', './kernel', './enterprise'] },
];

let failed = false;
const fail = (msg) => { console.error(`[exports] ${msg}`); failed = true; };

for (const pkg of packages) {
  // Resolved from disk rather than via require.resolve: a package is free to omit
  // './package.json' from its exports map, and @aoc-enterprise/runtime does.
  const manifestPath = path.join(root, 'node_modules', pkg.name, 'package.json');
  if (!fs.existsSync(manifestPath)) {
    fail(`${pkg.name}: not installed under node_modules`);
    continue;
  }

  const rel = path.relative(root, manifestPath).replaceAll(path.sep, '/');
  if (!rel.startsWith('node_modules/')) {
    fail(`${pkg.name}: resolves outside node_modules (${rel}) — a local source fallback has returned`);
    continue;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.version !== pkg.version) {
    fail(`${pkg.name}: expected version ${pkg.version}, resolved ${manifest.version}`);
  }
  if (!manifest.exports) {
    fail(`${pkg.name}: manifest declares no exports map`);
    continue;
  }

  for (const key of pkg.requiredExports) {
    if (!manifest.exports[key]) {
      fail(`${pkg.name}: missing declared public export '${key}'`);
      continue;
    }
    const specifier = key === '.' ? pkg.name : `${pkg.name}/${key.slice(2)}`;
    try {
      const resolved = require.resolve(specifier);
      const resolvedRel = path.relative(root, resolved).replaceAll(path.sep, '/');
      if (!resolvedRel.startsWith('node_modules/')) {
        fail(`${specifier}: resolves outside node_modules (${resolvedRel})`);
      }
    } catch (error) {
      fail(`${specifier}: declared export does not resolve (${error?.message ?? error})`);
    }
  }
}

if (failed) process.exit(1);
console.log('[exports] canonical package export surfaces verified — both artifacts resolve from node_modules with all required public exports.');
