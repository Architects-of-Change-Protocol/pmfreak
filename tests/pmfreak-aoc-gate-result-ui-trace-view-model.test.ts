import test from "node:test";
import assert from "node:assert/strict";

import { createPMFreakAocGateTraceViewModel, demoPMFreakAocGovernedActionGatePassedResult } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("trace view model preserves deterministic steps", async () => {
  const result = await demoPMFreakAocGovernedActionGatePassedResult();
  const trace = createPMFreakAocGateTraceViewModel(result);
  assert.equal(trace.kind, "gate_trace");
  assert.deepEqual(
    trace.steps.map((step) => step.stepId),
    result.trace.map((step) => step.stepId),
  );
});

test("trace view model contains no timestamps or private metadata", async () => {
  const result = await demoPMFreakAocGovernedActionGatePassedResult();
  const trace = createPMFreakAocGateTraceViewModel(result);
  const text = JSON.stringify(trace);
  assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text));
  assert.ok(!text.toLowerCase().includes("metadata"));
});
