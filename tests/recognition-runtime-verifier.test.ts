import test from "node:test";
import assert from "node:assert/strict";

import { createAocRecognitionRuntime } from "../src/features/recognition-runtime/runtime/aoc-recognition-runtime";
import { createDeterministicContext } from "../src/features/recognition-runtime/fixtures/deterministic-context";
import {
  buildActionRequest,
  buildDatasysFixture,
} from "../src/features/recognition-runtime/fixtures/datasys.fixture";
import { unknownExternalAgentRequest, victorOutOfScopeRequest } from "../src/features/recognition-runtime/fixtures/rogue-actor.fixture";
import {
  pmfreakFollowUpWithEvidence,
  pmfreakFollowUpWithoutEvidence,
  victorUpdateProjectStatus,
} from "../src/features/recognition-runtime/fixtures/pmfreak.fixture";

test("allow: a fully satisfied action request is recognized", () => {
  const fixture = buildDatasysFixture();
  const decision = fixture.runtime.verifyActionRequest(victorUpdateProjectStatus(fixture));
  assert.equal(decision.outcome, "allow");
  assert.equal(decision.reasonCode, "ALLOWED");
});

test("deny_unrecognized_actor: an actor that was never registered", () => {
  const fixture = buildDatasysFixture();
  const decision = fixture.runtime.verifyActionRequest(unknownExternalAgentRequest(fixture));
  assert.equal(decision.outcome, "deny_unrecognized_actor");
  assert.equal(decision.reasonCode, "ACTOR_UNKNOWN");
});

test("deny_out_of_scope: Victor's project token does not cover a different project", () => {
  const fixture = buildDatasysFixture();
  const decision = fixture.runtime.verifyActionRequest(victorOutOfScopeRequest(fixture));
  assert.equal(decision.outcome, "deny_out_of_scope");
  assert.equal(decision.reasonCode, "RESOURCE_SCOPE_MISMATCH");
});

test("deny_rogue_actor: an actor flagged rogue is denied even with valid-looking credentials", () => {
  const context = createDeterministicContext();
  const runtime = createAocRecognitionRuntime(context);
  runtime.createTrustDomain({ id: "td", name: "Datasys Agent Republic" });
  runtime.registerActor({ id: "a-rogue", trustDomainId: "td", type: "agent", displayName: "Rogue", metadata: { rogue: true } });
  const passport = runtime.issuePassport({ id: "p-rogue", actorId: "a-rogue", trustDomainId: "td" });
  const token = runtime.issueCapabilityToken({
    id: "t-rogue",
    actorId: "a-rogue",
    trustDomainId: "td",
    passportId: passport.id,
    capability: "act",
    resourceScope: "scope",
  });

  const decision = runtime.verifyActionRequest({
    id: "ar-rogue",
    trustDomainId: "td",
    actorId: "a-rogue",
    action: "act",
    resourceScope: "scope",
    passportId: passport.id,
    capabilityTokenId: token.id,
    requestedAt: context.clock.now(),
  });

  assert.equal(decision.outcome, "deny_rogue_actor");
  assert.equal(decision.reasonCode, "ACTOR_FLAGGED_ROGUE");
});

test("deny_revoked: a revoked capability token can never be reused", () => {
  const fixture = buildDatasysFixture();
  fixture.runtime.revokeCapabilityToken(fixture.victorProjectToken.id);
  const decision = fixture.runtime.verifyActionRequest(victorUpdateProjectStatus(fixture));
  assert.equal(decision.outcome, "deny_revoked");
  assert.equal(decision.reasonCode, "CAPABILITY_TOKEN_REVOKED");
});

test("deny_revoked: revoking a passport cascades to deny before capability is even checked", () => {
  const fixture = buildDatasysFixture();
  fixture.runtime.revokePassport(fixture.victorPassport.id);
  const decision = fixture.runtime.verifyActionRequest(victorUpdateProjectStatus(fixture));
  assert.equal(decision.outcome, "deny_revoked");
  assert.equal(decision.reasonCode, "PASSPORT_REVOKED");
});

test("deny_expired: an expired passport blocks recognition even with a valid token", () => {
  const context = createDeterministicContext(1000);
  const runtime = createAocRecognitionRuntime(context);
  runtime.createTrustDomain({ id: "td", name: "X" });
  runtime.registerActor({ id: "a", trustDomainId: "td", type: "human", displayName: "A" });

  const expiresAt = context.clock.now();
  const passport = runtime.issuePassport({ id: "p", actorId: "a", trustDomainId: "td", expiresAt });
  const token = runtime.issueCapabilityToken({
    id: "t",
    actorId: "a",
    trustDomainId: "td",
    passportId: passport.id,
    capability: "act",
    resourceScope: "scope",
  });

  const decision = runtime.verifyActionRequest({
    id: "ar",
    trustDomainId: "td",
    actorId: "a",
    action: "act",
    resourceScope: "scope",
    passportId: passport.id,
    capabilityTokenId: token.id,
    requestedAt: context.clock.now(),
  });

  assert.equal(decision.outcome, "deny_expired");
  assert.equal(decision.reasonCode, "PASSPORT_EXPIRED");
});

test("policy_violation: an action request that references no passport at all", () => {
  const fixture = buildDatasysFixture();
  const decision = fixture.runtime.verifyActionRequest(
    buildActionRequest(fixture, {
      actorId: fixture.victor.id,
      action: "update_project_status",
      resourceScope: "project:HMP-14665",
    })
  );
  assert.equal(decision.outcome, "policy_violation");
  assert.equal(decision.reasonCode, "PASSPORT_REQUIRED");
});

test("require_more_evidence: PMFreak Closure Agent's follow-up needs evidence first", () => {
  const fixture = buildDatasysFixture();
  const decision = fixture.runtime.verifyActionRequest(pmfreakFollowUpWithoutEvidence(fixture));
  assert.equal(decision.outcome, "require_more_evidence");
  assert.equal(decision.reasonCode, "EVIDENCE_MISSING");
});

test("require_human_approval: with evidence satisfied, Recognition Runtime still holds for human approval", () => {
  const fixture = buildDatasysFixture();
  const decision = fixture.runtime.verifyActionRequest(pmfreakFollowUpWithEvidence(fixture));
  assert.equal(decision.outcome, "require_human_approval");
  assert.equal(decision.reasonCode, "HUMAN_APPROVAL_REQUIRED");
});

test("verify() records a deterministic audit trail retrievable by ActionRequest id", () => {
  const fixture = buildDatasysFixture();
  const request = victorUpdateProjectStatus(fixture);
  const decision = fixture.runtime.verifyActionRequest(request);

  const trail = fixture.runtime.getAuditTrail(request.id);
  assert.equal(trail.length, 1);
  assert.equal(trail[0].type, "action_request_verified");
  assert.equal(trail[0].recognitionDecisionId, decision.id);
});

test("verify() evaluates every policy up to and including the first failure, in fixed order", () => {
  const fixture = buildDatasysFixture();
  const decision = fixture.runtime.verifyActionRequest(unknownExternalAgentRequest(fixture));
  assert.deepEqual(
    decision.evaluatedPolicies.map((p) => p.policyName),
    ["trust_domain_validity", "actor_recognition"]
  );
});
