import test from "node:test";
import assert from "node:assert/strict";

import { createPMFreakAocDecisionInboxEmptyState, createPMFreakAocDecisionInboxErrorState } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("empty state is display-only", () => {
  const state = createPMFreakAocDecisionInboxEmptyState();
  assert.equal(state.kind, "empty");
  assert.equal(state.displayOnly, true);
  assert.ok(state.message.length > 0);
});

test("error state is safe and display-only", () => {
  const state = createPMFreakAocDecisionInboxErrorState();
  assert.equal(state.kind, "error");
  assert.equal(state.safe, true);
  assert.equal(state.displayOnly, true);
});

test("error state does not leak secrets", () => {
  const state = createPMFreakAocDecisionInboxErrorState("failed with token abcdefghijklmnopqrstuvwx and email person@example.com");
  assert.ok(!state.message.includes("abcdefghijklmnopqrstuvwx"));
  assert.ok(!state.message.includes("person@example.com"));
});
