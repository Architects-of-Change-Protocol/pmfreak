import { spawnSync } from 'node:child_process';

const packages = [
  { name: '@pmfreak/aoc-protocol-internal', dir: 'src/aoc/protocol' },
  { name: '@pmfreak/aoc-enterprise-internal', dir: 'src/aoc/enterprise' }
];

function dryRun(dir) {
  const r = spawnSync('npm', ['pack', '--dry-run', '--json'], { cwd: dir, encoding: 'utf8' });
  if (r.status !== 0) {
    process.stderr.write(r.stderr || r.stdout || 'npm pack failed\n');
    process.exit(r.status ?? 1);
  }
  return JSON.parse(r.stdout)[0];
}

let failed = false;
for (const pkg of packages) {
  const packed = dryRun(pkg.dir);
  const files = packed.files.map((f) => f.path);

  const forbidden = files.filter((f) =>
    f.includes('/src/') ||
    (f.endsWith('.ts') && !f.endsWith('.d.ts')) ||
    f.includes('/test/') ||
    f.includes('/tests/') ||
    f.includes('__tests__') ||
    f.includes('docs/')
  );

  const hasNestedProtocol = files.some((f) =>
    /dist\/protocol\//.test(f) ||
    /dist\/aoc\/protocol\//.test(f) ||
    /dist\/.*\/protocol\//.test(f)
  );

  const hasProtocolArtifactDuplication =
    pkg.name === '@aoc-enterprise/runtime' &&
    files.some((f) => /dist\/.*(actor-model|contracts|ports).*(\.d\.ts|\.js)$/.test(f) && f.includes('protocol'));

  if (forbidden.length) {
    console.error(`[tarball] ${pkg.name} has forbidden files: ${forbidden.join(', ')}`);
    failed = true;
  }

  if ((hasNestedProtocol || hasProtocolArtifactDuplication) && pkg.name === '@aoc-enterprise/runtime') {
    console.error(`[tarball] ${pkg.name} contains protocol artifacts that must be externalized`);
    failed = true;
  }

  if (files.some((f) => !f.startsWith('dist/') && !['package.json', 'README.md', 'LICENSE', 'LICENSE.md'].includes(f))) {
    console.error(`[tarball] ${pkg.name} contains non-minimal root artifacts: ${files.join(', ')}`);
    failed = true;
  }

  console.log(`[tarball] ${pkg.name} -> ${files.length} files, ${packed.unpackedSize} bytes unpacked`);
}

if (failed) process.exit(1);
console.log('[tarball] tarball purity checks passed');
