import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocGateResultUIActionHints,
  demoPMFreakAocGovernedActionGateBlockedResult,
  demoPMFreakAocGovernedActionGatePassedResult,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("action hints are always disabled", async () => {
  const hints = createPMFreakAocGateResultUIActionHints(await demoPMFreakAocGovernedActionGatePassedResult());
  for (const hint of hints) {
    assert.equal(hint.enabled, false);
  }
});

test("action hints never execute actions, mutate state, create invoices, or send communications", async () => {
  const hints = createPMFreakAocGateResultUIActionHints(await demoPMFreakAocGovernedActionGateBlockedResult());
  for (const hint of hints) {
    assert.equal(hint.executesAction, false);
    assert.equal(hint.mutatesState, false);
    assert.equal(hint.createsInvoice, false);
    assert.equal(hint.sendsCommunication, false);
  }
});

test("action hints are informational for a passed verdict", async () => {
  const hints = createPMFreakAocGateResultUIActionHints(await demoPMFreakAocGovernedActionGatePassedResult());
  assert.ok(hints.some((hint) => hint.intent === "informational"));
});
