import test from "node:test";
import assert from "node:assert/strict";

import { assertPMFreakAocGovernedActionGateDoesNotExecute, isPMFreakAocGovernedActionGateForbiddenExecutionOperation } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const FORBIDDEN = [
  "execute_action",
  "run_action",
  "apply_decision",
  "auto_apply_decision",
  "mark_milestone_complete",
  "mark_milestone_billing_ready",
  "send_client_communication",
  "create_invoice",
];

for (const operation of FORBIDDEN) {
  test(`no-execution guard blocks ${operation}`, () => {
    assert.equal(isPMFreakAocGovernedActionGateForbiddenExecutionOperation(operation), true);
    assert.throws(() => assertPMFreakAocGovernedActionGateDoesNotExecute(operation));
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
  test(`no-execution guard allows ${operation}`, () => {
    assert.equal(isPMFreakAocGovernedActionGateForbiddenExecutionOperation(operation), false);
    assert.doesNotThrow(() => assertPMFreakAocGovernedActionGateDoesNotExecute(operation));
  });
}
