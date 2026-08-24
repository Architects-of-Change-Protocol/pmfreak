import fs from 'node:fs';

const packages = [
  { name: '@pmfreak/aoc-protocol-internal', dir: 'src/aoc/protocol', entries: ['dist/index.js', 'dist/index.d.ts'] },
  { name: '@pmfreak/aoc-enterprise-internal', dir: 'src/aoc/enterprise', entries: ['dist/index.js', 'dist/index.d.ts', 'dist/runtime/index.js', 'dist/runtime/index.d.ts'] }
];

let failed = false;
for (const pkg of packages) {
  const manifest = JSON.parse(fs.readFileSync(`${pkg.dir}/package.json`, 'utf8'));
  for (const field of ['main', 'types', 'exports', 'files']) {
    if (!manifest[field]) {
      console.error(`[governance] ${pkg.name}: missing ${field}`);
      failed = true;
    }
  }
  for (const entry of pkg.entries) {
    if (!fs.existsSync(`${pkg.dir}/${entry}`)) {
      console.error(`[governance] ${pkg.name}: missing required build artifact ${entry}`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.log('[governance] package exports and dist artifacts look valid');
