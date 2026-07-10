import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const denyHelper = fs.readFileSync('src/lib/security/deny-response.ts', 'utf8');
const telemetry = fs.readFileSync('src/lib/security/telemetry.ts', 'utf8');
const copilotRoute = fs.readFileSync('src/app/api/copilot/route.ts', 'utf8');
const billingCheckout = fs.readFileSync('src/app/api/billing/create-checkout-session/route.ts', 'utf8');

const events = [
  'auth_denied','workspace_scope_violation','project_scope_violation','denied_permission','governance_violation',
  'revoked_agent_access','invalid_attestation','expired_attestation','malformed_attestation','unsafe_agent_attempt',
  'external_scope_violation','billing_governance_denied','suspicious_permission_escalation','privileged_client_used','suspicious_cross_scope_attempt'
];

test('central deny helper persists telemetry fields for 401/403', () => {
  assert.match(denyHelper, /logSecurityEvent/);
  assert.match(denyHelper, /requested_permission/);
  assert.match(denyHelper, /denied_permission/);
  assert.match(denyHelper, /denial_reason/);
});

test('security taxonomy includes required phase 4.3 events', () => {
  for (const eventName of events) assert.match(telemetry, new RegExp(`"${eventName}"`));
});

test('copilot requires full agent attestation and execute_ai_action scope', () => {
  // Partial agent headers must be rejected with the attestation error message.
  assert.match(copilotRoute, /Agent attestation required/);
  assert.match(copilotRoute, /permission: "execute_ai_action"/);
  // Agent and human paths must be separated — partial headers never fall through.
  assert.match(copilotRoute, /isAgentCall/);
  assert.match(copilotRoute, /actorType: "ai_agent"/);
  assert.match(copilotRoute, /actorType: "user"/);
});

test('billing checkout resolves billing.manage from server-side workspace membership, not display role', () => {
  assert.match(billingCheckout, /requireBillingManageMembership/);
  assert.match(billingCheckout, /billing_governance_denied/);
  assert.doesNotMatch(billingCheckout, /user\.role/);
  assert.doesNotMatch(billingCheckout, /toGovernanceRole/);
});
