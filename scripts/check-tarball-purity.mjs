// P0-PKG-05 — frozen artifact purity.
//
// This gate used to pack two LOCAL pseudo-packages and inspect them for leakage.
// Those packages are gone. It now verifies the artifacts PMFreak actually consumes:
// the vendored tarballs must match their pinned checksums, and the installed trees
// must contain no PMFreak source.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

// Derived from vendor/aoc-consumer.lock.json rather than duplicated here.
//
// These constants used to be written out inline, which made this gate silently
// stale the moment the active pins moved: it kept checksumming the retired
// tarballs that happened to still sit in vendor/, reported "checksum verified"
// and never noticed that nothing installed them any more. Reproduced during
// P0-PKG-09 -- after the repin to Protocol rc.1 + Frontera 1.2.1 this gate still
// exited 0 while validating rc.0 and 1.2.0. The lock is the single source of
// artifact identity; this gate now reads it.
const LOCK_PATH = path.join(root, 'vendor/aoc-consumer.lock.json');
if (!fs.existsSync(LOCK_PATH)) {
  console.error('[purity] vendor/aoc-consumer.lock.json is missing; artifact identity cannot be established.');
  process.exit(1);
}
const LOCK = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
const ARTIFACTS = Object.entries(LOCK.artifacts ?? {}).map(([name, entry]) => ({
  name,
  tarball: entry.tarball,
  sha256: entry.sha256,
}));
if (ARTIFACTS.length === 0) {
  console.error('[purity] the consumer lock declares no artifacts; refusing to vacuously pass.');
  process.exit(1);
}

// A canonical artifact must never contain PMFreak application source.
const PMFREAK_MARKERS = ['src/lib/governance/authority', '@pmfreak/aoc-', 'src/aoc/protocol', 'src/aoc/enterprise'];

let failed = false;
const fail = (m) => { console.error(`[purity] ${m}`); failed = true; };

for (const artifact of ARTIFACTS) {
  const tarballPath = path.join(root, artifact.tarball);
  if (!fs.existsSync(tarballPath)) {
    fail(`${artifact.name}: pinned tarball missing at ${artifact.tarball}`);
    continue;
  }
  const actual = createHash('sha256').update(fs.readFileSync(tarballPath)).digest('hex');
  if (actual !== artifact.sha256) {
    fail(`${artifact.name}: checksum drift — expected ${artifact.sha256}, got ${actual}`);
    continue;
  }

  const installed = path.join(root, 'node_modules', artifact.name);
  if (!fs.existsSync(installed)) {
    fail(`${artifact.name}: not installed under node_modules`);
    continue;
  }
  const walk = (dir, acc = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, acc);
      // Code only. The frozen artifacts also ship an integration-contract.json that
      // documents the consumer's forbidden before-state ('file:src/aoc/protocol'); that
      // is upstream data describing what PMFreak must NOT do, not PMFreak source.
      else if (/\.(js|mjs|cjs)$/.test(e.name) || e.name.endsWith('.d.ts')) acc.push(p);
    }
    return acc;
  };
  for (const file of walk(installed)) {
    const content = fs.readFileSync(file, 'utf8');
    for (const marker of PMFREAK_MARKERS) {
      if (content.includes(marker)) {
        fail(`${artifact.name}: installed artifact references PMFreak source '${marker}' in ${path.relative(root, file)}`);
      }
    }
  }
  console.log(`[purity] ${artifact.name}: checksum verified, no PMFreak source present`);
}

if (failed) process.exit(1);
console.log('[purity] frozen artifact purity checks passed.');
