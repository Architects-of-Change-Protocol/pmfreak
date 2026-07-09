import test from "node:test";
import assert from "node:assert/strict";

import {
  assertPMFreakAocGovernanceClientReadOnlyOperation,
  isPMFreakAocGovernanceClientForbiddenOperation,
  PMFreakAocGovernanceClientError,
  PMFREAK_AOC_GOVERNANCE_CLIENT_CAPABILITIES,
  PMFREAK_AOC_GOVERNANCE_CLIENT_FORBIDDEN_OPERATIONS,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("no-mutation guard blocks every forbidden operation", () => {
  for (const operation of PMFREAK_AOC_GOVERNANCE_CLIENT_FORBIDDEN_OPERATIONS) {
    assert.equal(isPMFreakAocGovernanceClientForbiddenOperation(operation), true);
    assert.throws(() => assertPMFreakAocGovernanceClientReadOnlyOperation(operation), PMFreakAocGovernanceClientError);
  }
});

test("no-mutation guard allows the client's own request-oriented capabilities", () => {
  for (const capability of Object.values(PMFREAK_AOC_GOVERNANCE_CLIENT_CAPABILITIES)) {
    assert.equal(isPMFreakAocGovernanceClientForbiddenOperation(capability), false);
    assert.doesNotThrow(() => assertPMFreakAocGovernanceClientReadOnlyOperation(capability));
  }
});

test("forbidden operation error carries a safe, typed error code", () => {
  try {
    assertPMFreakAocGovernanceClientReadOnlyOperation("execute_action");
    assert.fail("expected assertPMFreakAocGovernanceClientReadOnlyOperation to throw");
  } catch (error) {
    assert.ok(error instanceof PMFreakAocGovernanceClientError);
    assert.equal((error as InstanceType<typeof PMFreakAocGovernanceClientError>).code, "mutation_not_allowed");
  }
});
