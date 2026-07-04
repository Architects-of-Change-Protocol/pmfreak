import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  SEED_DELIVERY_PLAYBOOK,
  generatePlaybookRecommendations,
  mergePlaybookRecommendations,
  markRecommendationViewed,
  acceptRecommendation,
  dismissRecommendation,
  markRecommendationRequiresApproval,
  approveRecommendation,
  markRecommendationExecuted,
} from "../src/lib/playbook-engine/index.ts";

const recommendationEngine = fs.readFileSync("src/lib/playbook-engine/recommendation-engine.ts", "utf8");
const recommendationState = fs.readFileSync("src/lib/playbook-engine/recommendation-state.ts", "utf8");
const indexFile = fs.readFileSync("src/lib/playbook-engine/index.ts", "utf8");

// ─── Exports (static) ───────────────────────────────────────────────────────────

test("generatePlaybookRecommendations and explainPlaybookRecommendation are exported from the module", () => {
  assert.match(indexFile, /generatePlaybookRecommendations/);
  assert.match(indexFile, /explainPlaybookRecommendation/);
  assert.match(recommendationEngine, /export function generatePlaybookRecommendations/);
  assert.match(recommendationEngine, /export function explainPlaybookRecommendation/);
});

test("recommendation status helpers are exported from the module", () => {
  for (const helper of [
    "markRecommendationViewed",
    "acceptRecommendation",
    "dismissRecommendation",
    "markRecommendationConvertedToTask",
    "markRecommendationConvertedToDraft",
    "markRecommendationRequiresApproval",
    "approveRecommendation",
    "markRecommendationExecuted",
  ]) {
    assert.match(indexFile, new RegExp(helper), `index.ts must re-export ${helper}`);
    assert.match(recommendationState, new RegExp(`export function ${helper}`), `recommendation-state.ts must define ${helper}`);
  }
});

test("recommendation-engine reuses PlaybookRuleSeverity/PlaybookSuggestedAction instead of parallel types", () => {
  assert.match(recommendationEngine, /PlaybookRecommendationSeverity = PlaybookRuleSeverity/);
  assert.match(recommendationEngine, /PlaybookRecommendationAction = PlaybookSuggestedAction/);
});

test("dismissed and executed are terminal states in the transition graph", () => {
  assert.match(recommendationState, /dismissed: \[\]/);
  assert.match(recommendationState, /executed: \[\]/);
});

// ─── Runtime behavior (direct import) ──────────────────────────────────────────

function baseContext(overrides = {}) {
  return {
    projectId: "00000000-0000-0000-0000-000000000001",
    workspaceId: "00000000-0000-0000-0000-000000000002",
    phase: "iniciacion",
    hasApprovedCharter: null,
    hasApprovedConstitution: false,
    hasScopeBaseline: null,
    hasWbs: null,
    hasScheduleBaseline: null,
    hasBudgetBaseline: null,
    hasRiskRegister: null,
    hasStakeholderMap: null,
    hasCommunicationsPlan: null,
    hasClosureChecklistStarted: null,
    hasFinalInvoiceIssued: null,
    hasClientSignoff: null,
    openCriticalRisks: null,
    openHighRisks: null,
    openIssues: null,
    overdueTasks: null,
    daysSinceLastStatusUpdate: null,
    scheduleVarianceDays: null,
    budgetVariancePercent: null,
    metadata: {},
    ...overrides,
  };
}

function generate(overrides = {}) {
  const result = generatePlaybookRecommendations(baseContext(overrides), SEED_DELIVERY_PLAYBOOK);
  assert.equal(result.ok, true, "generation must succeed with valid projectId/workspaceId");
  return result.data;
}

test("a fired rule (pb-init-constitution-missing) generates a recommendation with evidence/explanation", () => {
  const { recommendations } = generate();
  const rec = recommendations.find((r) => r.playbookRuleId === "pb-init-constitution-missing");
  assert.ok(rec, "pb-init-constitution-missing must produce a recommendation when hasApprovedConstitution is false");
  assert.deepEqual(rec.evidenceUsed, [{ fact: "hasApprovedConstitution", value: false }]);
  assert.deepEqual(rec.missingEvidence, []);
  assert.match(rec.explanation.narrative, /Según el playbook/);
  assert.match(rec.explanation.narrative, /pb-init-constitution-missing/);
});

test("suggestedActions are preserved verbatim from the fired rule", () => {
  const { recommendations } = generate();
  const rec = recommendations.find((r) => r.playbookRuleId === "pb-init-constitution-missing");
  assert.ok(rec.suggestedActions.some((a) => a.action === "generate_project_constitution_draft" && a.approvalRequired === false));
  assert.ok(rec.suggestedActions.some((a) => a.action === "approve_project_constitution" && a.approvalRequired === true));
});

test("approvalRequired/hasApprovalSensitiveActions are true when a suggested action requires approval", () => {
  const { recommendations } = generate();
  const rec = recommendations.find((r) => r.playbookRuleId === "pb-init-constitution-missing");
  assert.equal(rec.approvalRequired, true, "approve_project_constitution requires approval, so the recommendation must too");
  assert.equal(rec.hasApprovalSensitiveActions, true);
});

test("indeterminate rules never produce a recommendation and are reported separately", () => {
  const { recommendations, indeterminateRuleIds } = generate();
  assert.equal(
    recommendations.find((r) => r.playbookRuleId === "pb-init-stakeholder-map-missing"),
    undefined,
    "hasStakeholderMap is null (unknown), so this rule must be indeterminate, not fired",
  );
  assert.ok(indeterminateRuleIds.includes("pb-init-stakeholder-map-missing"));
});

test("not_fired rules never produce a recommendation", () => {
  const { recommendations } = generate({ hasApprovedCharter: true });
  assert.ok(!recommendations.some((r) => r.playbookRuleId === "pb-init-charter-missing"));
});

test("confidence is 100 when every evidence fact for the fired rule is known", () => {
  const { recommendations } = generate();
  const rec = recommendations.find((r) => r.playbookRuleId === "pb-init-constitution-missing");
  assert.equal(rec.confidence, 100);
});

test("two identical evaluations produce the same fingerprint/id (idempotent)", () => {
  const first = generate().recommendations.find((r) => r.playbookRuleId === "pb-init-constitution-missing");
  const second = generate().recommendations.find((r) => r.playbookRuleId === "pb-init-constitution-missing");
  assert.equal(second.fingerprint, first.fingerprint);
  assert.equal(second.id, first.id);
});

test("mergePlaybookRecommendations never duplicates by fingerprint and preserves prior status", () => {
  const first = generate().recommendations.find((r) => r.playbookRuleId === "pb-init-constitution-missing");
  const viewed = markRecommendationViewed(first);
  assert.equal(viewed.ok, true);
  const second = generate().recommendations;
  const merged = mergePlaybookRecommendations([viewed.data], second);
  const fingerprints = merged.map((r) => r.fingerprint);
  assert.equal(new Set(fingerprints).size, fingerprints.length, "merge must not produce duplicate fingerprints");
  const mergedRec = merged.find((r) => r.fingerprint === first.fingerprint);
  assert.equal(mergedRec.status, "viewed", "merge must preserve the previously recorded human decision status");
});

test("missing projectId fails validation, no recommendations invented", () => {
  const result = generatePlaybookRecommendations(baseContext({ projectId: "" }), SEED_DELIVERY_PLAYBOOK);
  assert.equal(result.ok, false);
  assert.equal(result.failureClass, "validation_failed");
});

test("missing workspaceId fails validation", () => {
  const result = generatePlaybookRecommendations(baseContext({ workspaceId: "" }), SEED_DELIVERY_PLAYBOOK);
  assert.equal(result.ok, false);
  assert.equal(result.failureClass, "validation_failed");
});

test("state machine: dismissed can never become executed", () => {
  const rec = generate().recommendations.find((r) => r.playbookRuleId === "pb-init-constitution-missing");
  const dismissed = dismissRecommendation(rec);
  assert.equal(dismissed.ok, true);
  assert.equal(dismissed.data.status, "dismissed");
  const result = markRecommendationExecuted(dismissed.data);
  assert.equal(result.ok, false, "dismissed must never transition to executed");
});

test("state machine: executed is a terminal state reached only through the approval gate", () => {
  const rec = generate().recommendations.find((r) => r.playbookRuleId === "pb-init-constitution-missing");
  const viewed = markRecommendationViewed(rec).data;
  const accepted = acceptRecommendation(viewed).data;
  const requiresApproval = markRecommendationRequiresApproval(accepted);
  assert.equal(requiresApproval.ok, true);
  assert.equal(requiresApproval.data.status, "requires_approval");
  const approved = approveRecommendation(requiresApproval.data);
  assert.equal(approved.ok, true);
  assert.equal(approved.data.status, "approved");
  const executed = markRecommendationExecuted(approved.data);
  assert.equal(executed.ok, true);
  assert.equal(executed.data.status, "executed");
  const executedAgain = markRecommendationExecuted(executed.data);
  assert.equal(executedAgain.ok, false, "executed must be a final state with no further transitions");
});

test("approveRecommendation rejects a recommendation that never required approval", () => {
  const rec = generate().recommendations.find((r) => r.playbookRuleId === "pb-init-constitution-missing");
  const nonSensitive = { ...rec, approvalRequired: false, status: "requires_approval" };
  const result = approveRecommendation(nonSensitive);
  assert.equal(result.ok, false, "approveRecommendation must reject recommendations that never required approval");
});

test("sensitive recommendations can never execute before approval", () => {
  const rec = generate().recommendations.find((r) => r.playbookRuleId === "pb-init-constitution-missing");
  const acceptedButNotApproved = { ...rec, status: "accepted" };
  const result = markRecommendationExecuted(acceptedButNotApproved);
  assert.equal(result.ok, false, "approval-sensitive recommendations must not execute before approval");
});
