import test from "node:test";
import assert from "node:assert/strict";

import {
  PMFreakAocMutationNotAllowedError,
  assertPMFreakAocReadOnlyOperation,
  isPMFreakAocForbiddenSurfaceOperation,
} from "../src/features/pmfreak-integrations/aoc-read-only-surface";

test("no-mutation guard blocks forbidden operations", () => {
  const forbidden = ["update_project", "create_invoice", "send_email", "writeback_decision", "execute_action"];

  for (const operationName of forbidden) {
    assert.equal(isPMFreakAocForbiddenSurfaceOperation(operationName), true);
    assert.throws(() => assertPMFreakAocReadOnlyOperation(operationName), PMFreakAocMutationNotAllowedError);
  }
});

test("no-mutation guard allows read operations", () => {
  const allowed = ["read_projects", "read_agents", "read_milestones", "read_action_proposals"];

  for (const operationName of allowed) {
    assert.equal(isPMFreakAocForbiddenSurfaceOperation(operationName), false);
    assert.doesNotThrow(() => assertPMFreakAocReadOnlyOperation(operationName));
  }
});

test("thrown mutation error carries a safe surface error", () => {
  try {
    assertPMFreakAocReadOnlyOperation("delete_task");
    assert.fail("expected assertPMFreakAocReadOnlyOperation to throw");
  } catch (error) {
    if (!(error instanceof PMFreakAocMutationNotAllowedError)) {
      throw error;
    }
    assert.equal(error.surfaceError.code, "mutation_not_allowed");
    assert.equal(error.surfaceError.safe, true);
  }
});
