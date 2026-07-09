import test from "node:test";
import assert from "node:assert/strict";

import { assertPMFreakAocDecisionInboxDisplayOnlyOperation, isPMFreakAocDecisionInboxForbiddenOperation } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const FORBIDDEN = [
  "execute_action",
  "apply_decision",
  "enforce_decision",
  "mutate_project",
  "mark_milestone_billing_ready",
  "send_client_communication",
  "create_invoice",
  "writeback_decision",
];

for (const operation of FORBIDDEN) {
  test(`no-action guard blocks ${operation}`, () => {
    assert.equal(isPMFreakAocDecisionInboxForbiddenOperation(operation), true);
    assert.throws(() => assertPMFreakAocDecisionInboxDisplayOnlyOperation(operation));
  });
}

const ALLOWED = [
  "normalize_governance_response",
  "create_inbox_item",
  "create_decision_detail_view_model",
  "filter_inbox_items",
  "sort_inbox_items",
  "group_inbox_items",
  "summarize_inbox_items",
];

for (const operation of ALLOWED) {
  test(`no-action guard allows ${operation}`, () => {
    assert.equal(isPMFreakAocDecisionInboxForbiddenOperation(operation), false);
    assert.doesNotThrow(() => assertPMFreakAocDecisionInboxDisplayOnlyOperation(operation));
  });
}
