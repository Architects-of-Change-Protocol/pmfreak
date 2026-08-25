// P0-PKG-04 — packaged AOC artifact integrity gate.
//
// The canonical @aoc/protocol and @aoc-enterprise/runtime are the frozen upstream
// tarballs recorded in vendor/aoc-consumer.lock.json. This gate is what stops that
// claim from quietly becoming false. It fails on:
//
//   - checksum drift on either vendored tarball
//   - wrong package identity or version
//   - the return of a file:src/aoc/* (or link:/workspace:) specifier
//   - resolution of either upstream name into src/aoc/*
//   - a TypeScript alias mapping an upstream name into local source
//   - an import of a private or deep upstream path that is not a declared export key
//   - a direct dependency on, or import of, a Frontera-private workspace package
//   - a local copy that drops its NON_CANONICAL_LEGACY_COPY marker or reclaims an
//     upstream name
//   - a lock file that stops forbidding local-source fallback
//
// Checks are split so the negative controls in tests/packaged-aoc-artifact-gate.test.mjs
// can drive the declaration-level half against synthetic fixture roots and prove the
// gate actually rejects each forbidden state. It verifies identity; it authorizes nothing.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const UPSTREAM_PACKAGES = ['@aoc/protocol', '@aoc-enterprise/runtime'];
const LOCK_RELATIVE_PATH = 'vendor/aoc-consumer.lock.json';
const SOURCE_SCAN_ROOTS = ['src', 'tests', 'scripts'];
// The negative controls deliberately contain forbidden specifiers as fixture DATA —
// they are written into temp directories to prove this gate rejects them, never
// imported. Scanning them would report the gate's own proof as a violation.
const SOURCE_SCAN_EXEMPT = new Set(['tests/packaged-aoc-artifact-gate.test.mjs']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const IGNORED_DIRECTORIES = new Set(['node_modules', 'dist', '.next', 'coverage', '.git']);

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const posix = (value) => value.split(path.sep).join('/');

export const exportsFingerprint = (manifest) => {
  const keys = Object.keys(manifest.exports ?? {}).sort();
  return createHash('sha256').update(JSON.stringify(keys.map((key) => [key, manifest.exports[key]]))).digest('hex');
};

/** Every import/require/dynamic-import specifier in a source file. */
function importSpecifiers(source) {
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/gm,
    /\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/gm,
  ];
  const found = new Set();
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.add(match[1]);
  }
  return [...found];
}

function walkSources(directory, files = []) {
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      walkSources(path.join(directory, entry.name), files);
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
}

/**
 * Declaration-level checks. Everything here reads files under `root`, so a fixture
 * root with a poisoned manifest exercises exactly the same code the real gate runs.
 */
export function staticChecks(root) {
  const failures = [];
  const passes = [];
  const fail = (message) => failures.push(message);
  const pass = (message) => passes.push(message);

  const lock = readJson(path.join(root, LOCK_RELATIVE_PATH));
  const rootManifest = readJson(path.join(root, 'package.json'));
  const declaredDependencies = { ...rootManifest.dependencies, ...rootManifest.devDependencies };

  // The lock must keep forbidding local-source fallback — an edit that relaxes it is
  // itself the drift this gate exists to catch.
  if (lock.localSourceFallback?.allowed !== false) {
    fail(`${LOCK_RELATIVE_PATH}: localSourceFallback.allowed must be false`);
  } else {
    pass('lock forbids local-source fallback');
  }

  for (const name of UPSTREAM_PACKAGES) {
    const entry = lock.artifacts?.[name];
    if (!entry) {
      fail(`${LOCK_RELATIVE_PATH}: no locked artifact for ${name}`);
      continue;
    }

    const declared = declaredDependencies[name];
    const expected = `file:${entry.tarball}`;
    if (declared !== expected) {
      fail(`${name}: declared as "${declared}", expected the pinned tarball "${expected}"`);
    } else {
      pass(`${name}: declared as packed tarball (${declared})`);
    }
  }

  // No forbidden specifier may appear anywhere in the manifest, for any package —
  // this is what makes a reintroduced file:src/aoc/* a hard failure rather than a
  // silently-working local fallback.
  const forbiddenSpecifiers = lock.localSourceFallback?.forbiddenSpecifiers ?? [];
  for (const [name, specifier] of Object.entries(declaredDependencies)) {
    if (typeof specifier !== 'string') continue;
    const normalized = specifier.replace('file:./', 'file:').replace('link:./', 'link:');
    const hit = forbiddenSpecifiers.find((forbidden) => {
      const normalizedForbidden = forbidden.replace('file:./', 'file:').replace('link:./', 'link:');
      return normalizedForbidden === 'workspace:*'
        ? normalized.startsWith('workspace:')
        : normalized === normalizedForbidden;
    });
    if (hit) fail(`${name}: forbidden local-source specifier "${specifier}" — the canonical package is the frozen tarball`);
  }
  if (!failures.some((message) => message.includes('forbidden local-source specifier'))) {
    pass('no forbidden local-source specifier in the manifest');
  }

  // Frontera-private workspaces reach PMFreak only inside the packaged artifact.
  const privatePackages = lock.privateFronteraWorkspaces?.packages ?? [];
  const directPrivate = privatePackages.filter((name) => name in declaredDependencies);
  if (directPrivate.length) {
    fail(`direct dependency on Frontera-private workspace package(s): ${directPrivate.join(', ')}`);
  } else {
    pass('no direct dependency on a Frontera-private workspace package');
  }

  // A TypeScript alias into local source would defeat every other check for tsc.
  const tsconfigPath = path.join(root, 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8').replace(/^\s*\/\/.*$/gm, ''));
    const paths = tsconfig.compilerOptions?.paths ?? {};
    const aliased = (lock.localSourceFallback?.forbiddenTypeScriptAliases ?? []).filter((alias) => alias in paths);
    if (aliased.length) {
      fail(`tsconfig.json aliases upstream package name(s) into local source: ${aliased.join(', ')}`);
    } else {
      pass('tsconfig.json declares no alias for an upstream package name');
    }
  }

  // The retained local copies must stay explicitly non-canonical and must never
  // reclaim an upstream identity.
  for (const [directory, expectedName] of Object.entries(lock.localCopies?.packages ?? {})) {
    const manifestPath = path.join(root, directory, 'package.json');
    if (!fs.existsSync(manifestPath)) {
      pass(`${directory}: absent (removed)`);
      continue;
    }
    const manifest = readJson(manifestPath);
    if (UPSTREAM_PACKAGES.includes(manifest.name)) {
      fail(`${directory}: reclaims the canonical upstream name "${manifest.name}"`);
    } else if (manifest.name !== expectedName) {
      fail(`${directory}: named "${manifest.name}", lock records "${expectedName}"`);
    } else if (manifest.aocCanonicalStatus !== lock.localCopies.marker) {
      fail(`${directory}: missing the ${lock.localCopies.marker} marker (aocCanonicalStatus)`);
    } else {
      pass(`${directory}: ${lock.localCopies.marker} as ${manifest.name}`);
    }
  }

  // Every import of an upstream name must be a declared export key: no deep paths,
  // no private internals, no dist/src reach-through.
  const declaredExportsFor = Object.fromEntries(
    UPSTREAM_PACKAGES.map((name) => [name, new Set((lock.artifacts?.[name]?.declaredExports ?? []).map((key) => key.replace(/^\./, name)))]),
  );
  const violations = [];
  for (const scanRoot of SOURCE_SCAN_ROOTS) {
    for (const file of walkSources(path.join(root, scanRoot))) {
      const relative = posix(path.relative(root, file));
      if (SOURCE_SCAN_EXEMPT.has(relative)) continue;
      for (const specifier of importSpecifiers(fs.readFileSync(file, 'utf8'))) {
        const owner = UPSTREAM_PACKAGES.find((name) => specifier === name || specifier.startsWith(`${name}/`));
        if (owner && !declaredExportsFor[owner].has(specifier)) {
          violations.push(`${relative}: "${specifier}" is not a declared export key of ${owner}`);
        }
        if (privatePackages.some((name) => specifier === name || specifier.startsWith(`${name}/`))) {
          violations.push(`${relative}: imports Frontera-private workspace package "${specifier}"`);
        }
      }
    }
  }
  if (violations.length) {
    for (const violation of violations) fail(violation);
  } else {
    pass('every upstream import uses a declared export key; no Frontera-private imports');
  }

  return { failures, passes };
}

/**
 * Installation-level checks: the bytes on disk, what npm actually resolved, and
 * whether the packaged code loads and runs through its declared entrypoints.
 */
export function installedChecks(root) {
  const failures = [];
  const passes = [];
  const fail = (message) => failures.push(message);
  const pass = (message) => passes.push(message);

  const lock = readJson(path.join(root, LOCK_RELATIVE_PATH));
  const require = createRequire(path.join(root, 'package.json'));
  const forbiddenRoots = (lock.localSourceFallback?.forbiddenResolutionRoots ?? []).map((entry) => posix(entry));

  for (const [name, entry] of Object.entries(lock.artifacts ?? {})) {
    const tarballPath = path.join(root, entry.tarball);
    if (!fs.existsSync(tarballPath)) {
      fail(`${name}: tarball missing at ${entry.tarball}`);
      continue;
    }
    const sha256 = createHash('sha256').update(fs.readFileSync(tarballPath)).digest('hex');
    if (sha256 !== entry.sha256) {
      fail(`${name}: tarball SHA-256 drift\n  expected ${entry.sha256}\n  actual   ${sha256}`);
    } else {
      pass(`${name}: tarball SHA-256 verified (${sha256.slice(0, 12)}…)`);
    }

    const manifestPath = path.join(root, 'node_modules', name, 'package.json');
    if (!fs.existsSync(manifestPath)) {
      fail(`${name}: not installed under node_modules — run npm ci`);
      continue;
    }
    const installed = readJson(manifestPath);
    if (installed.name !== entry.package || installed.version !== entry.version) {
      fail(`${name}: installed ${installed.name}@${installed.version}, lock records ${entry.package}@${entry.version}`);
    }
    const fingerprint = exportsFingerprint(installed);
    if (fingerprint !== entry.exportsFingerprint) {
      fail(`${name}: exports fingerprint drift\n  expected ${entry.exportsFingerprint}\n  actual   ${fingerprint}`);
    } else {
      pass(`${name}: installed ${installed.version}, exports fingerprint verified (${fingerprint.slice(0, 12)}…)`);
    }

    // Resolution proof: the file the runtime actually loads for this name, and proof
    // it is not reaching into a repository-local source copy. Resolved through the
    // package's own root export ('.') rather than `${name}/package.json`, which is not
    // a declared export key of every artifact — so this asks the module system the
    // same question application code asks.
    let resolved;
    try {
      resolved = require.resolve(name);
    } catch (error) {
      fail(`${name}: root export does not resolve: ${error?.message ?? error}`);
      continue;
    }
    const relativeResolved = posix(path.relative(root, resolved));
    const insideForbidden = forbiddenRoots.find((forbidden) => relativeResolved.startsWith(`${forbidden}/`));
    if (insideForbidden) {
      fail(`${name}: resolves into local source (${relativeResolved}) — the canonical package is the frozen tarball`);
    } else if (!relativeResolved.startsWith(`node_modules/${name}/`)) {
      fail(`${name}: resolves outside its installed package (${relativeResolved})`);
    } else {
      pass(`${name}: root export resolves to ${relativeResolved} (${installed.version})`);
    }
  }

  // The frozen cross-repository contract must be present and still frozen.
  const contractPath = path.join(root, 'node_modules', '@aoc/protocol', 'integration-contract.json');
  if (!fs.existsSync(contractPath)) {
    fail('@aoc/protocol: integration-contract.json missing from the installed package');
  } else {
    const contract = readJson(contractPath);
    if (contract.contract !== lock.contract || contract.contractVersion !== lock.contractVersion) {
      fail(`@aoc/protocol: integration contract ${contract.contract}@${contract.contractVersion}, consumer expects ${lock.contract}@${lock.contractVersion}`);
    } else if (contract.status !== 'frozen') {
      fail(`@aoc/protocol: integration contract status is "${contract.status}", expected "frozen"`);
    } else {
      pass(`@aoc/protocol: integration contract ${contract.contract}@${contract.contractVersion} (frozen) verified`);
    }
  }

  // Load and execute through declared export keys only.
  try {
    const canonical = require('@aoc/protocol/canonical');
    if (canonical.CANONICAL_JSON_PROFILE !== 'aoc-canonical-json/1') {
      fail(`@aoc/protocol/canonical: unexpected profile ${canonical.CANONICAL_JSON_PROFILE}`);
    } else if (canonical.canonicalizeJSON({ b: 1, a: [true, null] }) !== '{"a":[true,null],"b":1}') {
      fail('@aoc/protocol/canonical: canonicalizeJSON smoke output mismatch');
    } else {
      pass('@aoc/protocol/canonical: loaded and executed (aoc-canonical-json/1)');
    }
  } catch (error) {
    fail(`@aoc/protocol/canonical failed to load: ${error?.message ?? error}`);
  }

  try {
    const runtime = require('@aoc-enterprise/runtime/runtime');
    const missing = ['evaluateEnforcementPipeline', 'enforceEnforcementPipeline'].filter((symbol) => typeof runtime[symbol] !== 'function');
    if (missing.length) {
      fail(`@aoc-enterprise/runtime/runtime: missing ${missing.join(', ')}`);
    } else {
      pass('@aoc-enterprise/runtime/runtime: loaded, enforcement pipeline entrypoints present');
    }
  } catch (error) {
    fail(`@aoc-enterprise/runtime/runtime failed to load: ${error?.message ?? error}`);
  }

  return { failures, passes };
}

function main() {
  const root = process.cwd();
  const staticResult = staticChecks(root);
  const installedResult = installedChecks(root);
  const failures = [...staticResult.failures, ...installedResult.failures];

  for (const message of [...staticResult.passes, ...installedResult.passes]) {
    console.log(`[packaged-aoc] ${message}`);
  }
  if (failures.length) {
    console.error('\n[packaged-aoc] FAILED:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log('[packaged-aoc] all packaged artifact checks passed.');
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();
export const __filenameForTests = fileURLToPath(import.meta.url);
