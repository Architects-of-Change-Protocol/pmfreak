// P0-PKG-05: the local pseudo-packages this gate used to build and hash for
// reproducibility no longer exist. The canonical artifacts are vendored, pinned and
// checksum-verified instead (check-tarball-purity), so a local rebuild proves
// nothing. The ownership and collision gates replace what was lost.
import { spawnSync } from 'node:child_process';

const checks = [
  ['node', ['scripts/check-package-exports.mjs']],
  ['node', ['scripts/check-compatibility-governance.mjs']],
  ['node', ['scripts/check-lifecycle-integrity.mjs']],
  ['node', ['scripts/check-forbidden-imports.mjs']],
  ['node', ['scripts/check-tarball-purity.mjs']],
  ['node', ['scripts/check-aoc-packages.mjs']],
  ['node', ['scripts/check-governance-ownership.mjs']],
  ['node', ['scripts/check-governance-collisions.mjs']]
];

for (const [cmd, args] of checks) {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
console.log('[release-readiness] all checks passed');
