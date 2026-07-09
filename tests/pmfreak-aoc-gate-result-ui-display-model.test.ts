import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocGateResultUIDisplayModel,
  demoPMFreakAocGovernedActionGateBlockedResult,
  demoPMFreakAocGovernedActionGateNeedsEvidenceResult,
  demoPMFreakAocGovernedActionGatePassedResult,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("display model creates a deterministic displayModelId", async () => {
  const result = await demoPMFreakAocGovernedActionGatePassedResult();
  const first = createPMFreakAocGateResultUIDisplayModel({ result });
  const second = createPMFreakAocGateResultUIDisplayModel({ result });
  assert.equal(first.displayModelId, second.displayModelId);
  assert.ok(first.displayModelId.startsWith("pmfreak.aoc.gate.ui.display."));
});

test("display model preserves resultId and gateId", async () => {
  const result = await demoPMFreakAocGovernedActionGatePassedResult();
  const model = createPMFreakAocGateResultUIDisplayModel({ result });
  assert.equal(model.resultId, result.gateResultId);
  assert.equal(model.gateId, result.gateId);
});

test("display model preserves verdict and canProceed", async () => {
  const result = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const model = createPMFreakAocGateResultUIDisplayModel({ result });
  assert.equal(model.verdict, result.verdict);
  assert.equal(model.canProceed, result.canProceed);
});

test("display model creates safe title and subtitle", async () => {
  const result = await demoPMFreakAocGovernedActionGatePassedResult();
  const model = createPMFreakAocGateResultUIDisplayModel({ result });
  assert.equal(model.title, "AOC Gate Result");
  assert.ok(model.subtitle.length > 0);
});

test("display model creates primary and secondary messages and preserves safeNextStep", async () => {
  const result = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const model = createPMFreakAocGateResultUIDisplayModel({ result });
  assert.equal(model.primaryMessage, result.safeSummary);
  assert.ok(model.secondaryMessage.length > 0);
  assert.equal(model.safeNextStep, result.safeNextStep);
});

test("display model includes requirement list, trace and safety disclaimer", async () => {
  const result = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const model = createPMFreakAocGateResultUIDisplayModel({ result });
  assert.equal(model.requirementList.kind, "gate_requirement_list");
  assert.equal(model.trace.kind, "gate_trace");
  assert.equal(model.safetyDisclaimer.kind, "gate_safety_disclaimer");
});

test("display model includes warnings/errors when config allows", async () => {
  const result = await demoPMFreakAocGovernedActionGateBlockedResult();
  const model = createPMFreakAocGateResultUIDisplayModel({ result, config: { showWarnings: true, showErrors: true } });
  assert.deepEqual(model.warnings, result.warnings);
  assert.deepEqual(model.errors, result.errors);
});

test("display model hides warnings/errors when config disables them", async () => {
  const result = await demoPMFreakAocGovernedActionGateBlockedResult();
  const model = createPMFreakAocGateResultUIDisplayModel({ result, config: { showWarnings: false, showErrors: false } });
  assert.deepEqual(model.warnings, []);
  assert.deepEqual(model.errors, []);
});

test("display model includes action hints", async () => {
  const result = await demoPMFreakAocGovernedActionGatePassedResult();
  const model = createPMFreakAocGateResultUIDisplayModel({ result });
  assert.ok(model.actionHints.length > 0);
  assert.equal(model.actionHints[0].enabled, false);
});

test("display model forces all safety flags", async () => {
  const result = await demoPMFreakAocGovernedActionGatePassedResult();
  const model = createPMFreakAocGateResultUIDisplayModel({ result });
  assert.equal(model.presentationOnly, true);
  assert.equal(model.actionExecutionCapable, false);
  assert.equal(model.mutationCapable, false);
  assert.equal(model.writebackCapable, false);
  assert.equal(model.invoiceCreationCapable, false);
  assert.equal(model.communicationCapable, false);
});

test("display model does not mutate input", async () => {
  const result = await demoPMFreakAocGovernedActionGatePassedResult();
  const snapshot = structuredClone(result);
  createPMFreakAocGateResultUIDisplayModel({ result });
  assert.deepEqual(result, snapshot);
});
