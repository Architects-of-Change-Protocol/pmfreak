import test from "node:test";
import assert from "node:assert/strict";

import { createPMFreakAocGateFlagsFromVerdict } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("passed sets canProceed true and all other flags false", () => {
  const flags = createPMFreakAocGateFlagsFromVerdict("passed" as never);
  assert.equal(flags.canProceed, true);
  assert.equal(flags.blocked, false);
  assert.equal(flags.requiresEvidence, false);
  assert.equal(flags.requiresApproval, false);
  assert.equal(flags.requiresReview, false);
});

const NON_PASSED_VERDICTS = ["blocked", "held", "needs_evidence", "needs_approval", "needs_review", "error"];

for (const verdict of NON_PASSED_VERDICTS) {
  test(`${verdict} sets canProceed false`, () => {
    const flags = createPMFreakAocGateFlagsFromVerdict(verdict as never);
    assert.equal(flags.canProceed, false);
  });
}

test("blocked sets blocked true", () => {
  assert.equal(createPMFreakAocGateFlagsFromVerdict("blocked" as never).blocked, true);
});

test("error sets blocked true", () => {
  assert.equal(createPMFreakAocGateFlagsFromVerdict("error" as never).blocked, true);
});

test("needs_evidence sets requiresEvidence true and no other requirement flags", () => {
  const flags = createPMFreakAocGateFlagsFromVerdict("needs_evidence" as never);
  assert.equal(flags.requiresEvidence, true);
  assert.equal(flags.requiresApproval, false);
  assert.equal(flags.requiresReview, false);
});

test("needs_approval sets requiresApproval true and no other requirement flags", () => {
  const flags = createPMFreakAocGateFlagsFromVerdict("needs_approval" as never);
  assert.equal(flags.requiresApproval, true);
  assert.equal(flags.requiresEvidence, false);
  assert.equal(flags.requiresReview, false);
});

test("needs_review sets requiresReview true and no other requirement flags", () => {
  const flags = createPMFreakAocGateFlagsFromVerdict("needs_review" as never);
  assert.equal(flags.requiresReview, true);
  assert.equal(flags.requiresEvidence, false);
  assert.equal(flags.requiresApproval, false);
});

test("held sets all flags false besides canProceed", () => {
  const flags = createPMFreakAocGateFlagsFromVerdict("held" as never);
  assert.equal(flags.canProceed, false);
  assert.equal(flags.blocked, false);
  assert.equal(flags.requiresEvidence, false);
  assert.equal(flags.requiresApproval, false);
  assert.equal(flags.requiresReview, false);
});
