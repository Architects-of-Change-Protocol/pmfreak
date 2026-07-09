import test from "node:test";
import assert from "node:assert/strict";

import { createPMFreakAocGateResultUIEmptyState, createPMFreakAocGateResultUIErrorState } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("empty state is presentation-only and has a safe message", () => {
  const state = createPMFreakAocGateResultUIEmptyState();
  assert.equal(state.kind, "gate_result_empty");
  assert.equal(state.presentationOnly, true);
  assert.equal(state.message, "No AOC gate result to display yet.");
});

test("error state is presentation-only and safe", () => {
  const state = createPMFreakAocGateResultUIErrorState();
  assert.equal(state.kind, "gate_result_error");
  assert.equal(state.presentationOnly, true);
  assert.equal(state.safe, true);
});

test("error state redacts secrets in the supplied message", () => {
  const state = createPMFreakAocGateResultUIErrorState("failed for user demo@example.com");
  assert.ok(!state.message.includes("demo@example.com"));
});
