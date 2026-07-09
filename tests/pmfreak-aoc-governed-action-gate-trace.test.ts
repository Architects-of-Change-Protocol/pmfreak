import test from "node:test";
import assert from "node:assert/strict";

import { createPMFreakAocGovernedActionGateTrace } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const EXPECTED_STEP_IDS = [
  "gate_input_received",
  "aoc_decision_detected",
  "request_id_check",
  "client_id_check",
  "gate_verdict_mapped",
  "side_effects_blocked",
  "safe_next_step_created",
];

test("trace includes all required deterministic steps", () => {
  const trace = createPMFreakAocGovernedActionGateTrace({ verdict: "passed" as never, decision: "allow" as never });
  const stepIds = trace.map((step) => step.stepId);
  for (const expected of EXPECTED_STEP_IDS) {
    assert.ok(stepIds.includes(expected), `expected trace to include step "${expected}"`);
  }
});

test("trace is deterministic for identical inputs", () => {
  const a = createPMFreakAocGovernedActionGateTrace({ verdict: "needs_evidence" as never, decision: "require_evidence" as never });
  const b = createPMFreakAocGovernedActionGateTrace({ verdict: "needs_evidence" as never, decision: "require_evidence" as never });
  assert.deepEqual(a, b);
});

test("trace marks request_id_check blocked on mismatch", () => {
  const trace = createPMFreakAocGovernedActionGateTrace({ verdict: "error" as never, mismatchedRequestId: true });
  const step = trace.find((s) => s.stepId === "request_id_check");
  assert.equal(step?.status, "blocked");
});

test("trace marks client_id_check blocked on mismatch", () => {
  const trace = createPMFreakAocGovernedActionGateTrace({ verdict: "error" as never, mismatchedClientId: true });
  const step = trace.find((s) => s.stepId === "client_id_check");
  assert.equal(step?.status, "blocked");
});

test("trace marks side_effects_blocked as not_applicable", () => {
  const trace = createPMFreakAocGovernedActionGateTrace({ verdict: "passed" as never });
  const step = trace.find((s) => s.stepId === "side_effects_blocked");
  assert.equal(step?.status, "not_applicable");
});

test("trace never includes a timestamp-like or random-looking field", () => {
  const trace = createPMFreakAocGovernedActionGateTrace({ verdict: "passed" as never, decision: "allow" as never });
  const serialized = JSON.stringify(trace);
  assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(serialized));
});
