import test from "node:test";
import assert from "node:assert/strict";

import { createPMFreakAocGateSafeNextStep, evaluatePMFreakAocGovernedActionGateClaimSafety } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("safe next step for passed does not imply execution", () => {
  const nextStep = createPMFreakAocGateSafeNextStep({ verdict: "passed" as never });
  assert.ok(nextStep.includes("does not execute the action"));
  assert.ok(!nextStep.toLowerCase().includes("action executed"));
});

test("safe next step for blocked does not claim legal invalidity", () => {
  const nextStep = createPMFreakAocGateSafeNextStep({ verdict: "blocked" as never });
  assert.ok(nextStep.includes("Do not proceed"));
  assert.ok(!nextStep.toLowerCase().includes("legally"));
});

test("safe next step for held asks to hold the action", () => {
  const nextStep = createPMFreakAocGateSafeNextStep({ verdict: "held" as never });
  assert.ok(nextStep.toLowerCase().includes("hold"));
});

test("safe next step for needs_evidence requests evidence", () => {
  const nextStep = createPMFreakAocGateSafeNextStep({ verdict: "needs_evidence" as never });
  assert.ok(nextStep.toLowerCase().includes("evidence"));
});

test("safe next step for needs_approval requests approval", () => {
  const nextStep = createPMFreakAocGateSafeNextStep({ verdict: "needs_approval" as never });
  assert.ok(nextStep.toLowerCase().includes("approval"));
});

test("safe next step for needs_review requests review", () => {
  const nextStep = createPMFreakAocGateSafeNextStep({ verdict: "needs_review" as never });
  assert.ok(nextStep.toLowerCase().includes("review"));
});

test("safe next step for error references gate errors", () => {
  const nextStep = createPMFreakAocGateSafeNextStep({ verdict: "error" as never });
  assert.ok(nextStep.toLowerCase().includes("gate errors"));
});

const ALL_VERDICTS = ["passed", "blocked", "held", "needs_evidence", "needs_approval", "needs_review", "error"];

test("all safe next steps pass claim-safety", () => {
  for (const verdict of ALL_VERDICTS) {
    const nextStep = createPMFreakAocGateSafeNextStep({ verdict: verdict as never });
    const result = evaluatePMFreakAocGovernedActionGateClaimSafety(nextStep);
    assert.equal(result.safe, true, `expected "${nextStep}" to be claim-safe`);
  }
});
