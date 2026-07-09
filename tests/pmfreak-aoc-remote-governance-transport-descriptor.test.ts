import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocRemoteGovernanceTransportDescriptor,
  PMFREAK_AOC_REMOTE_GOVERNANCE_DEFAULT_ENDPOINT_PATH,
  PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_ID,
  PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_NAME,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("descriptor identifies the transport and its runtime direction", () => {
  const descriptor = createPMFreakAocRemoteGovernanceTransportDescriptor();

  assert.equal(descriptor.transportId, PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_ID);
  assert.equal(descriptor.transportId, "pmfreak.integration.aoc.remote_governance_transport.v1");
  assert.equal(descriptor.transportName, PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_NAME);
  assert.equal(descriptor.providerId, "pmfreak");
  assert.equal(descriptor.consumerOf, "aoc");
  assert.equal(descriptor.runtimeDirection, "pmfreak_consumes_aoc_governance");
  assert.equal(descriptor.mode, "remote_http_transport");
  assert.equal(descriptor.defaultEndpointPath, PMFREAK_AOC_REMOTE_GOVERNANCE_DEFAULT_ENDPOINT_PATH);
  assert.equal(descriptor.defaultEndpointPath, "/api/aoc/pmfreak/governance/evaluate");
});

test("descriptor states no action execution, no mutation, no writeback, no invoices, no communications", () => {
  const descriptor = createPMFreakAocRemoteGovernanceTransportDescriptor();

  assert.equal(descriptor.actionExecutionCapable, false);
  assert.equal(descriptor.productionMutationCapable, false);
  assert.equal(descriptor.decisionWritebackCapable, false);
  assert.equal(descriptor.invoiceCreationCapable, false);
  assert.equal(descriptor.communicationCapable, false);

  assert.ok(descriptor.disclaimers.some((line) => /does not execute PMFreak actions/i.test(line)));
  assert.ok(descriptor.disclaimers.some((line) => /does not mutate PMFreak data/i.test(line)));
  assert.ok(descriptor.disclaimers.some((line) => /does not write back decisions/i.test(line)));
  assert.ok(descriptor.disclaimers.some((line) => /does not create invoices/i.test(line)));
  assert.ok(descriptor.disclaimers.some((line) => /does not send communications/i.test(line)));
  assert.ok(descriptor.disclaimers.some((line) => /does not certify/i.test(line)));
  assert.ok(descriptor.disclaimers.some((line) => /does not provide legal advice/i.test(line)));
});

test("descriptor lists forbidden operations and capabilities", () => {
  const descriptor = createPMFreakAocRemoteGovernanceTransportDescriptor();

  assert.ok(descriptor.forbiddenOperations.includes("execute_action"));
  assert.ok(descriptor.forbiddenOperations.includes("create_invoice"));
  assert.ok(descriptor.forbiddenOperations.includes("certify_compliance"));
  assert.ok(descriptor.capabilities.includes("send_governance_request"));
  assert.ok(descriptor.capabilities.includes("map_aoc_response_to_pmfreak_response"));
  assert.ok(descriptor.safeLabels.includes("PMFreak consumes AOC Governance"));
});
