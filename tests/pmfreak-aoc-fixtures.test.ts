import test from "node:test";
import assert from "node:assert/strict";

import {
  demoPMFreakAocBillingAllowedRequest,
  demoPMFreakAocBillingAllowedResponse,
  demoPMFreakAocBillingMissingApprovalRequest,
  demoPMFreakAocBillingMissingEvidenceRequest,
  demoPMFreakAocBillingReadinessActionAttempt,
  demoPMFreakAocChangeControlActionAttempt,
  demoPMFreakAocClientCommunicationActionAttempt,
  demoPMFreakAocClientCommunicationRequiresApprovalResponse,
  demoPMFreakAocEvidenceActionAttempt,
  demoPMFreakAocRiskEscalationActionAttempt,
  demoPMFreakAocRiskEscalationAllowedResponse,
  demoPMFreakAocScheduleChangeActionAttempt,
  demoPMFreakAocScheduleRequiresPmApprovalResponse,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const REAL_LOOKING_PATTERNS = [/@gmail\.com/i, /@datasys/i, /\bINV-\d/i, /\bCR-\d{6,}/];

test("fixture action attempts are deterministic across calls", () => {
  assert.deepEqual(demoPMFreakAocBillingReadinessActionAttempt(), demoPMFreakAocBillingReadinessActionAttempt());
  assert.deepEqual(demoPMFreakAocScheduleChangeActionAttempt(), demoPMFreakAocScheduleChangeActionAttempt());
  assert.deepEqual(demoPMFreakAocRiskEscalationActionAttempt(), demoPMFreakAocRiskEscalationActionAttempt());
  assert.deepEqual(demoPMFreakAocClientCommunicationActionAttempt(), demoPMFreakAocClientCommunicationActionAttempt());
  assert.deepEqual(demoPMFreakAocChangeControlActionAttempt(), demoPMFreakAocChangeControlActionAttempt());
  assert.deepEqual(demoPMFreakAocEvidenceActionAttempt(), demoPMFreakAocEvidenceActionAttempt());
});

test("fixture requests are deterministic across calls", () => {
  assert.deepEqual(demoPMFreakAocBillingMissingEvidenceRequest(), demoPMFreakAocBillingMissingEvidenceRequest());
  assert.deepEqual(demoPMFreakAocBillingMissingApprovalRequest(), demoPMFreakAocBillingMissingApprovalRequest());
  assert.deepEqual(demoPMFreakAocBillingAllowedRequest(), demoPMFreakAocBillingAllowedRequest());
});

test("fixture responses are deterministic across calls", async () => {
  assert.deepEqual(await demoPMFreakAocBillingAllowedResponse(), await demoPMFreakAocBillingAllowedResponse());
  assert.deepEqual(await demoPMFreakAocRiskEscalationAllowedResponse(), await demoPMFreakAocRiskEscalationAllowedResponse());
  assert.deepEqual(
    await demoPMFreakAocScheduleRequiresPmApprovalResponse(),
    await demoPMFreakAocScheduleRequiresPmApprovalResponse(),
  );
  assert.deepEqual(
    await demoPMFreakAocClientCommunicationRequiresApprovalResponse(),
    await demoPMFreakAocClientCommunicationRequiresApprovalResponse(),
  );
});

test("fixtures use only fake, demo-only identifiers", () => {
  const attempts = [
    demoPMFreakAocBillingReadinessActionAttempt(),
    demoPMFreakAocScheduleChangeActionAttempt(),
    demoPMFreakAocRiskEscalationActionAttempt(),
    demoPMFreakAocClientCommunicationActionAttempt(),
    demoPMFreakAocChangeControlActionAttempt(),
    demoPMFreakAocEvidenceActionAttempt(),
  ];
  const serialized = JSON.stringify(attempts);

  for (const pattern of REAL_LOOKING_PATTERNS) {
    assert.ok(!pattern.test(serialized), `fixtures must not contain real-looking identifier matching ${pattern}`);
  }
  assert.ok(serialized.includes("demo."), "fixture identifiers should be namespaced under demo.*");
});
