import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = fs.readFileSync('src/lib/governance/authority/runtime/execution-grants.ts', 'utf8');
const approveRoute = fs.readFileSync('src/app/api/governance/approvals/[id]/approve/route.ts', 'utf8');
const consumeRoute = fs.readFileSync('src/app/api/governance/executions/consume/route.ts', 'utf8');
const copilot = fs.readFileSync('src/app/api/copilot/route.ts', 'utf8');

test('execution grant runtime enforces one-time token hash semantics', () => {
  assert.match(runtime, /sha256/);
  assert.match(runtime, /grant_token_hash/);
  assert.match(runtime, /eq\("status", "active"\)/);
  assert.match(runtime, /execution_grant_replay_attempt/);
});

test('approval approval route issues execution grants', () => {
  assert.match(approveRoute, /issueExecutionGrant/);
  assert.match(approveRoute, /requireGovernancePermission/);
});

test('consume API exists and uses consumeExecutionGrant', () => {
  assert.match(consumeRoute, /consumeExecutionGrant/);
  assert.match(consumeRoute, /\/api\/governance\/executions\/consume/);
});

test('copilot supports execution-grant based continuation', () => {
  assert.match(copilot, /x-pmf-execution-grant/);
  assert.match(copilot, /consumeExecutionGrant/);
});
