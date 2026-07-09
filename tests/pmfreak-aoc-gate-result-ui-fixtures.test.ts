import test from "node:test";
import assert from "node:assert/strict";

import {
  demoPMFreakAocGateResultUIBlocker,
  demoPMFreakAocGateResultUIBlockedBanner,
  demoPMFreakAocGateResultUIBlockedDisplayModel,
  demoPMFreakAocGateResultUIEmptyState,
  demoPMFreakAocGateResultUIErrorDisplayModel,
  demoPMFreakAocGateResultUIErrorState,
  demoPMFreakAocGateResultUIHeldDisplayModel,
  demoPMFreakAocGateResultUINeedsApprovalDisplayModel,
  demoPMFreakAocGateResultUINeedsEvidenceCard,
  demoPMFreakAocGateResultUINeedsEvidenceDisplayModel,
  demoPMFreakAocGateResultUINeedsReviewDetailPanel,
  demoPMFreakAocGateResultUINeedsReviewDisplayModel,
  demoPMFreakAocGateResultUIPassedBanner,
  demoPMFreakAocGateResultUIPassedDisplayModel,
  demoPMFreakAocGateResultUIRequirementList,
  demoPMFreakAocGateResultUISafetyDisclaimer,
  demoPMFreakAocGateResultUITrace,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("fixtures are deterministic", async () => {
  const first = await demoPMFreakAocGateResultUIPassedDisplayModel();
  const second = await demoPMFreakAocGateResultUIPassedDisplayModel();
  assert.deepEqual(first, second);
});

test("fixtures cover all required verdict display models", async () => {
  const models = await Promise.all([
    demoPMFreakAocGateResultUIPassedDisplayModel(),
    demoPMFreakAocGateResultUIBlockedDisplayModel(),
    demoPMFreakAocGateResultUIHeldDisplayModel(),
    demoPMFreakAocGateResultUINeedsEvidenceDisplayModel(),
    demoPMFreakAocGateResultUINeedsApprovalDisplayModel(),
    demoPMFreakAocGateResultUINeedsReviewDisplayModel(),
    demoPMFreakAocGateResultUIErrorDisplayModel(),
  ]);
  const verdicts = models.map((model) => model.verdict);
  assert.deepEqual(verdicts, ["passed", "blocked", "held", "needs_evidence", "needs_approval", "needs_review", "error"]);
});

test("view model fixtures resolve", async () => {
  assert.equal((await demoPMFreakAocGateResultUIPassedBanner()).kind, "gate_result_banner");
  assert.equal((await demoPMFreakAocGateResultUIBlockedBanner()).kind, "gate_result_banner");
  assert.equal((await demoPMFreakAocGateResultUINeedsEvidenceCard()).kind, "gate_result_card");
  assert.equal((await demoPMFreakAocGateResultUINeedsReviewDetailPanel()).kind, "gate_result_detail_panel");
  assert.equal((await demoPMFreakAocGateResultUIBlocker()).kind, "gate_result_blocker");
  assert.equal((await demoPMFreakAocGateResultUIRequirementList()).kind, "gate_requirement_list");
  assert.equal((await demoPMFreakAocGateResultUITrace()).kind, "gate_trace");
  assert.equal((await demoPMFreakAocGateResultUISafetyDisclaimer()).kind, "gate_safety_disclaimer");
  assert.equal(demoPMFreakAocGateResultUIEmptyState().kind, "gate_result_empty");
  assert.equal(demoPMFreakAocGateResultUIErrorState().kind, "gate_result_error");
});

test("fixtures contain no real Datasys/customer data", async () => {
  const model = await demoPMFreakAocGateResultUIPassedDisplayModel();
  const text = JSON.stringify(model).toLowerCase();
  assert.ok(!text.includes("datasys"));
  assert.ok(!text.includes("@"));
});
