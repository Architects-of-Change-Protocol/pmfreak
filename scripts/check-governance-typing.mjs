import { readFileSync } from 'node:fs';
const paths = [
  'src/lib/governance/authority/runtime/external-authority-adapter.ts',
  'src/lib/governance/authority/runtime/delegated-capabilities-bridge.ts',
];
let failed = false;
for (const p of paths) {
  const c = readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  if (c.includes(': any')) {
    console.error(`[check:governance-typing] explicit any remains in ${p}`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log('[check:governance-typing] governance typing checks passed.');
