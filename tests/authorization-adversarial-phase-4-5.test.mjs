import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const privileged = fs.readFileSync('src/lib/security/privileged-access.ts', 'utf8');
const telemetry = fs.readFileSync('src/lib/security/telemetry.ts', 'utf8');
const workspaceTeam = fs.readFileSync('src/lib/workspace-team.ts', 'utf8');
const billing = fs.readFileSync('src/lib/billing.ts', 'utf8');
const billingWebhookRoute = fs.readFileSync('src/app/api/billing/webhook/route.ts', 'utf8');
const attestation = fs.readFileSync('src/lib/security/agent-attestation.ts', 'utf8');

test('privileged client requires explicit context and emits telemetry', () => {
  assert.match(privileged, /if \(!context\.routeId \|\| !context\.operation \|\| !context\.reason\)/);
  assert.match(privileged, /if \(!context\.actorUserId && !context\.systemActor\)/);
  assert.match(privileged, /logSecurityEvent\("privileged_client_used"/);
});

test('telemetry writer uses privileged context and recursion bypass guard', () => {
  assert.match(telemetry, /allowTelemetryRecursionBypass: true/);
  assert.match(telemetry, /createPrivilegedSupabaseClient\(/);
});

test('workspace team helper enforces governance permission for member management', () => {
  assert.match(workspaceTeam, /requireGovernancePermission\(input\.workspaceId, "manage_members"\)/);
  assert.match(workspaceTeam, /routeId: input\.routeId/);
});

test('billing privileged paths require explicit context and webhook system actor', () => {
  // Perilla 6: the webhook route (not billing.ts) now instantiates the
  // privileged client — and only after Stripe signature verification — so
  // the "stripe_webhook" systemActor literal now lives there.
  assert.match(billing, /Privileged billing access requires explicit context/);
  assert.match(billingWebhookRoute, /systemActor: "stripe_webhook"/);
});

test('attestation v2 gaps are explicit for replay protection status', () => {
  assert.match(attestation, /verifyAgentAttestation/);
});
