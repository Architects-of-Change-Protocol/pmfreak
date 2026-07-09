import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocGateResultUIBadge,
  demoPMFreakAocGovernedActionGateBlockedResult,
  demoPMFreakAocGovernedActionGateErrorResult,
  demoPMFreakAocGovernedActionGateHeldResult,
  demoPMFreakAocGovernedActionGateNeedsApprovalResult,
  demoPMFreakAocGovernedActionGateNeedsEvidenceResult,
  demoPMFreakAocGovernedActionGateNeedsReviewResult,
  demoPMFreakAocGovernedActionGatePassedResult,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("badge creates correct iconHint for passed", async () => {
  const badge = createPMFreakAocGateResultUIBadge(await demoPMFreakAocGovernedActionGatePassedResult());
  assert.equal(badge.iconHint, "check");
  assert.equal(badge.tone, "success");
  assert.equal(badge.label, "Passed");
});

test("badge creates correct iconHint for blocked", async () => {
  const badge = createPMFreakAocGateResultUIBadge(await demoPMFreakAocGovernedActionGateBlockedResult());
  assert.equal(badge.iconHint, "block");
  assert.equal(badge.tone, "danger");
});

test("badge creates correct iconHint for held", async () => {
  const badge = createPMFreakAocGateResultUIBadge(await demoPMFreakAocGovernedActionGateHeldResult());
  assert.equal(badge.iconHint, "pause");
  assert.equal(badge.tone, "warning");
});

test("badge creates correct iconHint for needs_evidence", async () => {
  const badge = createPMFreakAocGateResultUIBadge(await demoPMFreakAocGovernedActionGateNeedsEvidenceResult());
  assert.equal(badge.iconHint, "evidence");
  assert.equal(badge.tone, "warning");
});

test("badge creates correct iconHint for needs_approval", async () => {
  const badge = createPMFreakAocGateResultUIBadge(await demoPMFreakAocGovernedActionGateNeedsApprovalResult());
  assert.equal(badge.iconHint, "approval");
  assert.equal(badge.tone, "warning");
});

test("badge creates correct iconHint for needs_review", async () => {
  const badge = createPMFreakAocGateResultUIBadge(await demoPMFreakAocGovernedActionGateNeedsReviewResult());
  assert.equal(badge.iconHint, "review");
  assert.equal(badge.tone, "warning");
});

test("badge creates correct iconHint for error", async () => {
  const badge = createPMFreakAocGateResultUIBadge(await demoPMFreakAocGovernedActionGateErrorResult());
  assert.equal(badge.iconHint, "error");
  assert.equal(badge.tone, "danger");
});
