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

const ARTIFACTS = [
  { name: '@aoc/protocol', tarball: 'vendor/aoc-protocol-0.2.0-rc.0.tgz', sha256: 'dbe8a08f432a0324ad34eb7cb85054b6dcd23c0d9a073914edf23fccd10445e5' },
  { name: '@aoc-enterprise/runtime', tarball: 'vendor/aoc-enterprise-runtime-1.0.0.tgz', sha256: '53d9e6ce4f3ba8fd82bbd90ebe5bc53f8bffb597b0d11bfd22d9a1ba5245a2de' },
];

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
