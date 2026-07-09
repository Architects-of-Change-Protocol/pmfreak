import test from "node:test";
import assert from "node:assert/strict";

import { assertPMFreakAocGovernedActionGateDoesNotMutate, isPMFreakAocGovernedActionGateForbiddenMutationOperation } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const FORBIDDEN = [
  "mutate_project",
  "update_project",
  "delete_project",
  "create_task",
  "update_task",
  "delete_task",
  "update_schedule",
  "close_risk",
  "attach_evidence",
  "approve_action",
  "writeback_decision",
];

for (const operation of FORBIDDEN) {
  test(`no-mutation guard blocks ${operation}`, () => {
    assert.equal(isPMFreakAocGovernedActionGateForbiddenMutationOperation(operation), true);
    assert.throws(() => assertPMFreakAocGovernedActionGateDoesNotMutate(operation));
  });
}

const ALLOWED = [
  "evaluate_governance_response",
  "evaluate_decision_inbox_item",
  "evaluate_action_attempt",
  "create_gate_result",
  "create_gate_detail_view_model",
  "summarize_gate_results",
  "batch_evaluate_gate_results",
  "render_safe_gate_model",
];

for (const operation of ALLOWED) {
  test(`no-mutation guard allows ${operation}`, () => {
    assert.equal(isPMFreakAocGovernedActionGateForbiddenMutationOperation(operation), false);
    assert.doesNotThrow(() => assertPMFreakAocGovernedActionGateDoesNotMutate(operation));
  });
}
