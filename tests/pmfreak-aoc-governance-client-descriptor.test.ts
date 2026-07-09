import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocGovernanceRequestClientDescriptor,
  PMFREAK_AOC_GOVERNANCE_REQUEST_CLIENT_ID,
  evaluatePMFreakAocGovernanceClaimSafety,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("descriptor identifies PMFreak as the AOC governance client (correct runtime direction)", () => {
  const descriptor = createPMFreakAocGovernanceRequestClientDescriptor();

  assert.equal(descriptor.clientId, PMFREAK_AOC_GOVERNANCE_REQUEST_CLIENT_ID);
  assert.equal(descriptor.providerId, "pmfreak");
  assert.equal(descriptor.consumerOf, "aoc");
  assert.equal(descriptor.runtimeDirection, "pmfreak_consumes_aoc_governance");
  assert.equal(descriptor.mode, "governance_request_client");
  assert.equal(descriptor.version, "v1");
});

test("descriptor declares itself non-mutating, non-enforcing and non-executing", () => {
  const descriptor = createPMFreakAocGovernanceRequestClientDescriptor();

  assert.equal(descriptor.productionMutationCapable, false);
  assert.equal(descriptor.productionEnforcementCapable, false);
  assert.equal(descriptor.actionExecutionCapable, false);
});

test("descriptor lists capabilities, forbidden operations, safe labels and disclaimers", () => {
  const descriptor = createPMFreakAocGovernanceRequestClientDescriptor();

  assert.ok(descriptor.capabilities.includes("build_governance_request"));
  assert.ok(descriptor.capabilities.includes("evaluate_governance_request"));
  assert.ok(descriptor.forbiddenOperations.includes("execute_action"));
  assert.ok(descriptor.forbiddenOperations.includes("create_invoice"));
  assert.ok(descriptor.forbiddenOperations.includes("certify_compliance"));
  assert.ok(descriptor.safeLabels.includes("PMFreak consumes AOC Governance"));
  assert.ok(descriptor.disclaimers.some((line) => /does not execute PMFreak actions/i.test(line)));
  assert.ok(descriptor.disclaimers.some((line) => /does not provide legal advice/i.test(line)));
});

test("descriptor output is claim-safe", () => {
  const descriptor = createPMFreakAocGovernanceRequestClientDescriptor();
  const result = evaluatePMFreakAocGovernanceClaimSafety(descriptor);
  assert.equal(result.safe, true);
  assert.deepEqual(result.foundPhrases, []);
});
