import test from "node:test";
import assert from "node:assert/strict";

import { assertPMFreakAocGateResultUIDoesNotMutate, isPMFreakAocGateResultUIForbiddenMutationOperation } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const FORBIDDEN = ["mutate_project", "update_project", "create_task", "update_schedule", "close_risk", "writeback_decision"];

for (const operation of FORBIDDEN) {
  test(`no-mutation guard blocks ${operation}`, () => {
    assert.equal(isPMFreakAocGateResultUIForbiddenMutationOperation(operation), true);
    assert.throws(() => assertPMFreakAocGateResultUIDoesNotMutate(operation));
  });
}

const ALLOWED = ["create_display_model", "create_card_view_model", "create_banner_view_model", "render_safe_gate_result"];

for (const operation of ALLOWED) {
  test(`no-mutation guard allows pure display operation ${operation}`, () => {
    assert.equal(isPMFreakAocGateResultUIForbiddenMutationOperation(operation), false);
    assert.doesNotThrow(() => assertPMFreakAocGateResultUIDoesNotMutate(operation));
  });
}
