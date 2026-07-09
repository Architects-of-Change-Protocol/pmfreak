import test from "node:test";
import assert from "node:assert/strict";

import {
  PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_CAPABILITIES,
  assertPMFreakAocEvidenceRequirementHandoffDoesNotMutate,
  isPMFreakAocEvidenceRequirementHandoffForbiddenMutationOperation,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const FORBIDDEN = [
  "mutate_project",
  "update_project",
  "delete_project",
  "mark_milestone_complete",
  "mark_milestone_billing_ready",
  "update_schedule",
  "close_risk",
  "writeback_decision",
];

for (const operation of FORBIDDEN) {
  test(`blocks "${operation}"`, () => {
    assert.equal(isPMFreakAocEvidenceRequirementHandoffForbiddenMutationOperation(operation), true);
    assert.throws(() => assertPMFreakAocEvidenceRequirementHandoffDoesNotMutate(operation));
  });
}

for (const operation of Object.values(PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_CAPABILITIES)) {
  test(`allows capability operation "${operation}"`, () => {
    assert.equal(isPMFreakAocEvidenceRequirementHandoffForbiddenMutationOperation(operation), false);
    assert.doesNotThrow(() => assertPMFreakAocEvidenceRequirementHandoffDoesNotMutate(operation));
  });
}
