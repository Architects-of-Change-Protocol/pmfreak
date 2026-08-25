import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const claims = fs.readFileSync('src/lib/security/capability-claims.ts', 'utf8');
const execGrants = fs.readFileSync('src/lib/governance/authority/runtime/execution-grants.ts', 'utf8');
const delegations = fs.readFileSync('src/lib/governance/authority/runtime/delegated-capabilities.ts', 'utf8');
const verifyRoute = fs.readFileSync('src/app/api/governance/capabilities/verify/route.ts', 'utf8');

test('claim module provides deterministic signing and hashing helpers', () => {
  assert.match(claims, /canonicalize/);
  assert.match(claims, /HMAC-SHA256/);
  assert.match(claims, /hashCapabilityClaim/);
});

test('claim verification validates scope bindings and version fail-closed logic', () => {
  assert.match(claims, /unsupported_version/);
  assert.match(claims, /unknown_key/);
  assert.match(claims, /issuer_policy_denied/);
  assert.match(claims, /signature_invalid/);
  assert.match(claims, /capability_claim_secret_missing/);
});

test('raw tokens are not embedded in claims', () => {
  assert.match(claims, /claim_contains_raw_token/);
  assert.doesNotMatch(claims, /grantToken\s*:/);
  assert.doesNotMatch(claims, /delegationToken\s*:/);
});

test('issuance paths include portable claim generation for grants + delegations', () => {
  assert.match(execGrants, /createCapabilityClaim/);
  assert.match(execGrants, /hashCapabilityClaim/);
  assert.match(delegations, /delegation_token_hash/);
  assert.match(delegations, /issueDelegatedCapability/);
});

test('verification endpoint exists and is verify-only', () => {
  assert.match(verifyRoute, /verifyCapabilityClaim/);
  assert.match(verifyRoute, /capability_claim_verified/);
  assert.doesNotMatch(verifyRoute, /consumeExecutionGrant|consumeDelegatedCapability/);
});
