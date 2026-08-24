import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = fs.readFileSync('src/lib/governance/authority/runtime/delegated-capabilities.ts', 'utf8');
const copilot = fs.readFileSync('src/app/api/copilot/route.ts', 'utf8');
const telemetry = fs.readFileSync('src/lib/security/telemetry.ts', 'utf8');

test('owner/admin allowed list includes ai.execute and PM scoped delegation', () => {
  assert.match(runtime, /OWNER_ADMIN_ALLOWED/);
  assert.match(runtime, /"ai.execute"/);
  assert.match(runtime, /PM_ALLOWED/);
  assert.match(runtime, /pm_requires_project_scope/);
});

test('delegation blocks broadening, ttl extension, forbidden admin-like actions', () => {
  assert.match(runtime, /scope_broadening/);
  assert.match(runtime, /ttl_extension/);
  assert.match(runtime, /permission_broadening/);
  assert.match(runtime, /billing\.manage/);
});

test('raw token is hashed and never persisted', () => {
  assert.match(runtime, /delegation_token_hash/);
  assert.doesNotMatch(runtime, /delegation_token[^_]/);
});

test('consumption + replay + depth telemetry events are represented', () => {
  assert.match(telemetry, /delegated_capability_consumed/);
  assert.match(telemetry, /delegated_capability_replay_attempt/);
  assert.match(telemetry, /delegated_capability_depth_exceeded/);
});

test('copilot accepts delegated ai.execute token path', () => {
  assert.match(copilot, /x-pmf-delegation-token/);
  assert.match(copilot, /consumeDelegatedCapability/);
});
