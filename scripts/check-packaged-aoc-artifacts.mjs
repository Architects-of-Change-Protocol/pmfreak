// P0-PKG-04 — packaged AOC artifact verification (consumer battery).
//
// Enforces the pmfreak.obligations block of the frozen
// aoc.cross-repository-integration@1.0.0 contract shipped inside the
// @aoc/protocol tarball:
//   1. deps are packed tarballs pinned by SHA-256 — never a path into a source tree
//   2. repository, commit, version and SHA-256 of each installed artifact are
//      recorded in a consumer lock file (vendor/aoc-consumer.lock.json)
//   3. the installed package's integration-contract.json contractVersion matches
//      the version this consumer was built for
//   4. imports go only through declared export keys (spot-checked here by loading
//      runtime entrypoints; statically enforced by the boundary suites)
//
// This script verifies identity and loadability; it authorizes nothing.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const failures = [];
const ok = (msg) => console.log(`[packaged-aoc] ${msg}`);
const fail = (msg) => failures.push(msg);

const lock = JSON.parse(fs.readFileSync(path.join(root, 'vendor/aoc-consumer.lock.json'), 'utf8'));
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const exportsFingerprint = (pkg) => {
  const keys = Object.keys(pkg.exports ?? {}).sort();
  return createHash('sha256').update(JSON.stringify(keys.map((k) => [k, pkg.exports[k]]))).digest('hex');
};

for (const [name, entry] of Object.entries(lock.artifacts)) {
  // 1. Dependency declaration must be the pinned tarball, not a source tree.
  const declared = rootPkg.dependencies?.[name];
  const expectedDeclaration = `file:${entry.tarball}`;
  if (declared !== expectedDeclaration) {
    fail(`${name}: package.json declares "${declared}", expected "${expectedDeclaration}"`);
  } else {
    ok(`${name}: declared as packed tarball (${declared})`);
  }

  // 2. Tarball bytes must match the recorded SHA-256.
  const tarballPath = path.join(root, entry.tarball);
  if (!fs.existsSync(tarballPath)) {
    fail(`${name}: tarball missing at ${entry.tarball}`);
    continue;
  }
  const sha256 = createHash('sha256').update(fs.readFileSync(tarballPath)).digest('hex');
  if (sha256 !== entry.sha256) {
    fail(`${name}: tarball SHA-256 mismatch\n  expected ${entry.sha256}\n  actual   ${sha256}`);
  } else {
    ok(`${name}: tarball SHA-256 verified (${sha256.slice(0, 12)}…)`);
  }

  // 3. Installed package identity + export surface fingerprint.
  const installedManifestPath = path.join(root, 'node_modules', name, 'package.json');
  if (!fs.existsSync(installedManifestPath)) {
    fail(`${name}: not installed under node_modules — run npm install`);
    continue;
  }
  const installed = JSON.parse(fs.readFileSync(installedManifestPath, 'utf8'));
  if (installed.version !== entry.version) {
    fail(`${name}: installed version ${installed.version}, lock records ${entry.version}`);
  }
  const fingerprint = exportsFingerprint(installed);
  if (fingerprint !== entry.exportsFingerprint) {
    fail(`${name}: exports fingerprint mismatch\n  expected ${entry.exportsFingerprint}\n  actual   ${fingerprint}`);
  } else {
    ok(`${name}: installed ${installed.version}, exports fingerprint verified (${fingerprint.slice(0, 12)}…)`);
  }
}

// 4. Frozen integration contract inside the installed protocol artifact.
const contractPath = path.join(root, 'node_modules', '@aoc/protocol', 'integration-contract.json');
if (!fs.existsSync(contractPath)) {
  fail('@aoc/protocol: integration-contract.json missing from installed package');
} else {
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  if (contract.contract !== lock.contract || contract.contractVersion !== lock.contractVersion) {
    fail(`@aoc/protocol: integration contract ${contract.contract}@${contract.contractVersion}, consumer expects ${lock.contract}@${lock.contractVersion}`);
  } else if (contract.status !== 'frozen') {
    fail(`@aoc/protocol: integration contract status is "${contract.status}", expected "frozen"`);
  } else {
    ok(`@aoc/protocol: integration contract ${contract.contract}@${contract.contractVersion} (frozen) verified`);
  }
}

// 5. Runtime loadability through declared export keys only.
try {
  const canonical = require('@aoc/protocol/canonical');
  if (canonical.CANONICAL_JSON_PROFILE !== 'aoc-canonical-json/1') {
    fail(`@aoc/protocol/canonical: unexpected profile ${canonical.CANONICAL_JSON_PROFILE}`);
  } else if (canonical.canonicalizeJSON({ b: 1, a: [true, null] }) !== '{"a":[true,null],"b":1}') {
    fail('@aoc/protocol/canonical: canonicalizeJSON smoke output mismatch');
  } else {
    ok('@aoc/protocol/canonical: loaded and executed (aoc-canonical-json/1)');
  }
} catch (error) {
  fail(`@aoc/protocol/canonical failed to load: ${error?.message ?? error}`);
}

try {
  const runtime = require('@aoc-enterprise/runtime/runtime');
  for (const symbol of ['evaluateEnforcementPipeline', 'enforceEnforcementPipeline']) {
    if (typeof runtime[symbol] !== 'function') fail(`@aoc-enterprise/runtime/runtime: missing ${symbol}`);
  }
  ok('@aoc-enterprise/runtime/runtime: loaded, enforcement pipeline entrypoints present');
} catch (error) {
  fail(`@aoc-enterprise/runtime/runtime failed to load: ${error?.message ?? error}`);
}

if (failures.length) {
  console.error('\n[packaged-aoc] FAILED:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('[packaged-aoc] all packaged artifact checks passed.');
