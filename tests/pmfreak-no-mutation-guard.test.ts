import test from "node:test";
import assert from "node:assert/strict";

import {
  AocPMFreakMutationNotAllowedError,
  assertAocPMFreakReadOnlyOperation,
  isAocPMFreakForbiddenConnectorOperation,
} from "../src/features/aoc-integrations/pmfreak-read-only-connector";

test("no-mutation guard blocks forbidden operations", () => {
  const forbidden = ["update_project", "create_invoice", "send_email", "writeback_decision", "execute_action"];

  for (const operationName of forbidden) {
    assert.equal(isAocPMFreakForbiddenConnectorOperation(operationName), true);
    assert.throws(() => assertAocPMFreakReadOnlyOperation(operationName), AocPMFreakMutationNotAllowedError);
  }
});

test("no-mutation guard allows read operations", () => {
  const allowed = ["read_projects", "read_agents", "read_milestones", "read_action_proposals"];

  for (const operationName of allowed) {
    assert.equal(isAocPMFreakForbiddenConnectorOperation(operationName), false);
    assert.doesNotThrow(() => assertAocPMFreakReadOnlyOperation(operationName));
  }
});

test("thrown mutation error carries a safe connector error", () => {
  try {
    assertAocPMFreakReadOnlyOperation("delete_task");
    assert.fail("expected assertAocPMFreakReadOnlyOperation to throw");
  } catch (error) {
    if (!(error instanceof AocPMFreakMutationNotAllowedError)) {
      throw error;
    }
    assert.equal(error.connectorError.code, "mutation_not_allowed");
    assert.equal(error.connectorError.safe, true);
  }
});
