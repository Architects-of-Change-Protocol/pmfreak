import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = fs.readFileSync('src/lib/governance/authority/runtime/governance-core.ts', 'utf8');
const apiList = fs.readFileSync('src/app/api/governance/approvals/route.ts', 'utf8');
const apiApprove = fs.readFileSync('src/app/api/governance/approvals/[id]/approve/route.ts', 'utf8');

test('approval decisions are represented in governance evaluation output', () => {
  assert.match(runtime, /requiredApprovalType/);
  assert.match(runtime, /reviewerRoleRequired/);
  assert.match(runtime, /decision: "require_human_approval"|decision: "require_admin_approval"/);
});

test('high-risk actions still route through approval gates', () => {
  for (const action of ['ai.execute', 'document.upload', 'billing.manage', 'privileged.use']) {
    assert.match(runtime, new RegExp(`input\\.action === "${action}"`));
  }
});

test('approval API maintains lifecycle protections for stale or already-resolved approvals', () => {
  assert.match(apiList, /export async function GET/);
  assert.match(apiApprove, /Already resolved/);
  assert.match(apiApprove, /Expired/);
});
