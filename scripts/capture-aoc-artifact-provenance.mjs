// P0-PKG-04 — artifact provenance capture.
//
// Run immediately before the Founder browser acceptance so its evidence can be tied
// to the artifacts that were actually installed at that moment. It records what the
// module system resolves for each canonical package name — the installed path,
// version and tarball checksum — plus the PMFreak commit and the database baseline
// identity, and it asserts that neither name resolves under src/aoc.
//
// Emits JSON on stdout (and to --out <file> when given). It measures; it changes and
// authorizes nothing.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'vendor/aoc-consumer.lock.json'), 'utf8'));
const posix = (value) => value.split(path.sep).join('/');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

const failures = [];
const artifacts = {};

for (const [name, entry] of Object.entries(lock.artifacts)) {
  const resolvedEntry = posix(path.relative(root, require.resolve(name)));
  const manifest = require(path.join(root, 'node_modules', name, 'package.json'));
  const tarballSha256 = createHash('sha256').update(fs.readFileSync(path.join(root, entry.tarball))).digest('hex');

  if (resolvedEntry.startsWith('src/aoc/')) failures.push(`${name} resolves into local source: ${resolvedEntry}`);
  if (!resolvedEntry.startsWith(`node_modules/${name}/`)) failures.push(`${name} resolves outside its installed package: ${resolvedEntry}`);
  if (manifest.version !== entry.version) failures.push(`${name} installed ${manifest.version}, expected ${entry.version}`);
  if (tarballSha256 !== entry.sha256) failures.push(`${name} tarball checksum drift`);

  artifacts[name] = {
    installedVersion: manifest.version,
    resolvedEntrypoint: resolvedEntry,
    installedPath: `node_modules/${name}`,
    tarball: entry.tarball,
    tarballSha256,
    exportsFingerprint: entry.exportsFingerprint,
    sourceRepository: entry.sourceRepository,
    sourceCommit: entry.sourceCommit,
    resolvesUnderSrcAoc: resolvedEntry.startsWith('src/aoc/'),
  };
}

const provenance = {
  _generatedBy: 'scripts/capture-aoc-artifact-provenance.mjs — evidence only; authorizes nothing',
  capturedAtCommit: git('rev-parse', 'HEAD'),
  branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
  workingTreeClean: git('status', '--porcelain', '--untracked-files=no') === '',
  toolchain: { node: process.version, npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim() },
  artifacts,
  localCopies: {
    disposition: lock.localCopies.disposition,
    installedAsPackages: fs.existsSync(path.join(root, 'node_modules/@pmfreak')),
  },
  database: {
    supabaseUrl: process.env.OPERATIONAL_FLOW_TEST_SUPABASE_URL ?? null,
    appBaseUrl: process.env.OPERATIONAL_FLOW_TEST_BASE_URL ?? null,
    seedScenario: process.env.P2_13_SCENARIO_ID ?? 'p2-13-founder (see scripts/p2-13/founder-scenario-manifest.mjs)',
  },
};

if (provenance.localCopies.installedAsPackages) {
  failures.push('node_modules/@pmfreak exists — a legacy copy is installed as a package');
}

const outIndex = process.argv.indexOf('--out');
const serialized = `${JSON.stringify(provenance, null, 2)}\n`;
if (outIndex !== -1 && process.argv[outIndex + 1]) {
  fs.mkdirSync(path.dirname(process.argv[outIndex + 1]), { recursive: true });
  fs.writeFileSync(process.argv[outIndex + 1], serialized);
}
process.stdout.write(serialized);

if (failures.length) {
  console.error('\n[provenance] FAILED:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
