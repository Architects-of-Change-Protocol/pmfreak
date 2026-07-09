import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocEvidenceRequirementHandoffEmptyState,
  createPMFreakAocEvidenceRequirementHandoffErrorState,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("empty state is safe and handoffOnly", () => {
  const state = createPMFreakAocEvidenceRequirementHandoffEmptyState();
  assert.equal(state.kind, "evidence_requirement_handoff_empty");
  assert.equal(state.message, "No AOC evidence requirements to hand off yet.");
  assert.equal(state.handoffOnly, true);
});

test("error state defaults to a safe message", () => {
  const state = createPMFreakAocEvidenceRequirementHandoffErrorState();
  assert.equal(state.kind, "evidence_requirement_handoff_error");
  assert.equal(state.safe, true);
  assert.equal(state.handoffOnly, true);
  assert.ok(state.message.length > 0);
});

test("error state redacts a caller-supplied message", () => {
  const state = createPMFreakAocEvidenceRequirementHandoffErrorState("Contact demo.user@example.com about secret-token-abcdefghijklmnopqrstuvwx");
  assert.ok(!state.message.includes("demo.user@example.com"));
  assert.ok(!state.message.includes("secret-token-abcdefghijklmnopqrstuvwx"));
});
