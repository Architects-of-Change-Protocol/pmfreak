import test from "node:test";
import assert from "node:assert/strict";

import {
  PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_CAPABILITIES,
  assertPMFreakAocEvidenceRequirementHandoffDoesNotCreateTasks,
  isPMFreakAocEvidenceRequirementHandoffForbiddenTaskOperation,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const FORBIDDEN = ["create_task", "update_task", "delete_task", "create_evidence_task", "create_approval_task"];

for (const operation of FORBIDDEN) {
  test(`blocks "${operation}"`, () => {
    assert.equal(isPMFreakAocEvidenceRequirementHandoffForbiddenTaskOperation(operation), true);
    assert.throws(() => assertPMFreakAocEvidenceRequirementHandoffDoesNotCreateTasks(operation));
  });
}

for (const operation of Object.values(PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_CAPABILITIES)) {
  test(`allows capability operation "${operation}"`, () => {
    assert.equal(isPMFreakAocEvidenceRequirementHandoffForbiddenTaskOperation(operation), false);
    assert.doesNotThrow(() => assertPMFreakAocEvidenceRequirementHandoffDoesNotCreateTasks(operation));
  });
}
