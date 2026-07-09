import test from "node:test";
import assert from "node:assert/strict";

import { assertPMFreakAocGateResultUIDoesNotAct, isPMFreakAocGateResultUIForbiddenActionOperation } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const FORBIDDEN = ["execute_action", "run_action", "apply_decision", "auto_apply_decision", "mark_milestone_billing_ready", "send_client_communication", "create_invoice"];

for (const operation of FORBIDDEN) {
  test(`no-action guard blocks ${operation}`, () => {
    assert.equal(isPMFreakAocGateResultUIForbiddenActionOperation(operation), true);
    assert.throws(() => assertPMFreakAocGateResultUIDoesNotAct(operation));
  });
}

const ALLOWED = ["create_display_model", "create_card_view_model", "render_safe_gate_result"];

for (const operation of ALLOWED) {
  test(`no-action guard allows ${operation}`, () => {
    assert.equal(isPMFreakAocGateResultUIForbiddenActionOperation(operation), false);
    assert.doesNotThrow(() => assertPMFreakAocGateResultUIDoesNotAct(operation));
  });
}
