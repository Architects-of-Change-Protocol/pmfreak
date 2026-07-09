import test from "node:test";
import assert from "node:assert/strict";

import {
  PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_CAPABILITIES,
  assertPMFreakAocEvidenceRequirementHandoffDoesNotAttachEvidence,
  isPMFreakAocEvidenceRequirementHandoffForbiddenAttachmentOperation,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const FORBIDDEN = ["attach_evidence", "upload_evidence", "create_evidence", "validate_evidence", "certify_evidence", "approve_evidence"];

for (const operation of FORBIDDEN) {
  test(`blocks "${operation}"`, () => {
    assert.equal(isPMFreakAocEvidenceRequirementHandoffForbiddenAttachmentOperation(operation), true);
    assert.throws(() => assertPMFreakAocEvidenceRequirementHandoffDoesNotAttachEvidence(operation));
  });
}

for (const operation of Object.values(PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_CAPABILITIES)) {
  test(`allows capability operation "${operation}"`, () => {
    assert.equal(isPMFreakAocEvidenceRequirementHandoffForbiddenAttachmentOperation(operation), false);
    assert.doesNotThrow(() => assertPMFreakAocEvidenceRequirementHandoffDoesNotAttachEvidence(operation));
  });
}
