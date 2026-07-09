import test from "node:test";
import assert from "node:assert/strict";

import {
  PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_CAPABILITIES,
  assertPMFreakAocEvidenceRequirementHandoffDoesNotCommunicate,
  isPMFreakAocEvidenceRequirementHandoffForbiddenCommunicationOperation,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const FORBIDDEN = ["send_client_communication", "send_email", "post_to_slack", "notify_customer", "request_customer_evidence"];

for (const operation of FORBIDDEN) {
  test(`blocks "${operation}"`, () => {
    assert.equal(isPMFreakAocEvidenceRequirementHandoffForbiddenCommunicationOperation(operation), true);
    assert.throws(() => assertPMFreakAocEvidenceRequirementHandoffDoesNotCommunicate(operation));
  });
}

for (const operation of Object.values(PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_CAPABILITIES)) {
  test(`allows capability operation "${operation}"`, () => {
    assert.equal(isPMFreakAocEvidenceRequirementHandoffForbiddenCommunicationOperation(operation), false);
    assert.doesNotThrow(() => assertPMFreakAocEvidenceRequirementHandoffDoesNotCommunicate(operation));
  });
}
