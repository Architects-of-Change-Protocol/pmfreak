// End-to-end demo scenarios for the AOC Recognition Runtime MVP, built on
// the Datasys Agent Republic fixture: Victor Valverde, a Finance Approver,
// and the PMFreak Closure Agent operating inside one trust domain.

import test from "node:test";
import assert from "node:assert/strict";

import { buildDatasysFixture } from "../src/features/recognition-runtime/fixtures/datasys.fixture";
import {
  pmfreakFollowUpWithEvidence,
  pmfreakFollowUpWithoutEvidence,
  victorUpdateProjectStatus,
} from "../src/features/recognition-runtime/fixtures/pmfreak.fixture";
import { unknownExternalAgentRequest, victorOutOfScopeRequest } from "../src/features/recognition-runtime/fixtures/rogue-actor.fixture";

test("demo: Victor performs a fully recognized project action", () => {
  const fixture = buildDatasysFixture();
  const decision = fixture.runtime.verifyActionRequest(victorUpdateProjectStatus(fixture));
  assert.equal(decision.outcome, "allow");
});

test("demo: the Unknown External Agent cannot act at all", () => {
  const fixture = buildDatasysFixture();
  const decision = fixture.runtime.verifyActionRequest(unknownExternalAgentRequest(fixture));
  assert.equal(decision.outcome, "deny_unrecognized_actor");
});

test("demo: Victor cannot use his HMP-14665 authority against GCH-15992", () => {
  const fixture = buildDatasysFixture();
  const decision = fixture.runtime.verifyActionRequest(victorOutOfScopeRequest(fixture));
  assert.equal(decision.outcome, "deny_out_of_scope");
});

test("demo: PMFreak Closure Agent's client follow-up walks evidence before approval", () => {
  const fixture = buildDatasysFixture();

  const withoutEvidence = fixture.runtime.verifyActionRequest(pmfreakFollowUpWithoutEvidence(fixture));
  assert.equal(withoutEvidence.outcome, "require_more_evidence");

  const withEvidence = fixture.runtime.verifyActionRequest(pmfreakFollowUpWithEvidence(fixture));
  assert.equal(withEvidence.outcome, "require_human_approval");
});

test("demo: revoking Victor's authority mid-stream immediately blocks further recognition", () => {
  const fixture = buildDatasysFixture();
  assert.equal(fixture.runtime.verifyActionRequest(victorUpdateProjectStatus(fixture)).outcome, "allow");

  fixture.runtime.revokeActor(fixture.victor.id);

  const decision = fixture.runtime.verifyActionRequest({
    ...victorUpdateProjectStatus(fixture),
    id: "action-request-victor-after-revocation",
  });
  assert.equal(decision.outcome, "deny_revoked");
  assert.equal(decision.reasonCode, "ACTOR_REVOKED");
});

test("demo: the full trust domain audit trail records every step deterministically", () => {
  const fixture = buildDatasysFixture();
  fixture.runtime.verifyActionRequest(victorUpdateProjectStatus(fixture));
  fixture.runtime.verifyActionRequest(unknownExternalAgentRequest(fixture));

  const events = fixture.runtime.getAuditEventsForTrustDomain(fixture.trustDomain.id);
  const types = events.map((e) => e.type);

  assert.ok(types.includes("trust_domain_created"));
  assert.ok(types.includes("actor_registered"));
  assert.ok(types.includes("passport_issued"));
  assert.ok(types.includes("capability_token_issued"));
  assert.equal(types.filter((t) => t === "action_request_verified").length, 2);

  for (let i = 1; i < events.length; i++) {
    assert.equal(events[i].previousHash, events[i - 1].eventHash);
  }
});
