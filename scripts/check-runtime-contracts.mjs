import { readFileSync } from 'node:fs';
const baselines = {
  'src/lib/governance/authority/runtime/runtime-contracts.ts': 20,
  'src/lib/governance/authority/runtime/authority-port.ts': 17,
};
for (const [file, maxAny] of Object.entries(baselines)) {
  const c = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const count = (c.match(/\bany\b/g) ?? []).length;
  if (count > maxAny) {
    console.error(`[check:runtime-contracts] any count regression in ${file}: ${count} > ${maxAny}`);
    process.exit(1);
  }
}
console.log('[check:runtime-contracts] baseline runtime contract ambiguity has not regressed.');
