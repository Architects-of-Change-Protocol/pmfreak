import { readFileSync } from 'node:fs';
const c = readFileSync(new URL('../src/lib/governance/authority/runtime/runtime-contracts.ts', import.meta.url), 'utf8');
const required = ['RuntimeGovernanceEvaluationInput','RuntimeEnterpriseDecision','RuntimeAgentAccessInput','RuntimeAgentScopeInput'];
for (const r of required) {
  if (!c.includes(`export type ${r} =`)) {
    console.error(`[check:runtime-normalization] missing canonical type ${r}`);
    process.exit(1);
  }
}
console.log('[check:runtime-normalization] canonical runtime contract types are present.');
