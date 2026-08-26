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

// The expected VERSION comes from vendor/aoc-consumer.lock.json; only the
// required export surface is asserted here.
//
// Duplicating the version inline made this gate drift with every repin: it had
// to be hand-edited in lockstep with the lock or it failed for the wrong
// reason. The lock is the single source of artifact identity. The export lists
// stay here on purpose -- they are a deliberate MINIMUM surface this repository
// depends on, not a restatement of what the artifact happens to declare, so
// they must not be derived from the artifact or from the lock.
const LOCK = JSON.parse(fs.readFileSync(path.join(root, 'vendor/aoc-consumer.lock.json'), 'utf8'));
const REQUIRED_EXPORTS = {
  '@aoc/protocol': ['.', './contracts', './canonical', './adapters', './errors'],
  '@aoc-enterprise/runtime': ['.', './runtime', './authorization', './audit', './adapters', './kernel', './enterprise'],
};
const packages = Object.entries(REQUIRED_EXPORTS).map(([name, requiredExports]) => {
  const version = LOCK.artifacts?.[name]?.version;
  if (!version) {
    console.error(`[exports] ${name}: the consumer lock records no version; artifact identity cannot be established.`);
    process.exit(1);
  }
  return { name, version, requiredExports };
});

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
