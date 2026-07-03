import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const recommendationEngine = fs.readFileSync("src/lib/playbook-engine/recommendation-engine.ts", "utf8");
const recommendationState = fs.readFileSync("src/lib/playbook-engine/recommendation-state.ts", "utf8");
const indexFile = fs.readFileSync("src/lib/playbook-engine/index.ts", "utf8");

// ─── Exports ──────────────────────────────────────────────────────────────────

test("generatePlaybookRecommendations and explainPlaybookRecommendation are exported from the module", () => {
  assert.match(indexFile, /generatePlaybookRecommendations/);
  assert.match(indexFile, /explainPlaybookRecommendation/);
  assert.match(recommendationEngine, /export function generatePlaybookRecommendations/);
  assert.match(recommendationEngine, /export function explainPlaybookRecommendation/);
});

test("mergePlaybookRecommendations is exported from the module", () => {
  assert.match(indexFile, /mergePlaybookRecommendations/);
  assert.match(recommendationEngine, /export function mergePlaybookRecommendations/);
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

test("core recommendation types are exported from the module", () => {
  for (const typeName of [
    "PlaybookRecommendation",
    "PlaybookRecommendationStatus",
    "PlaybookRecommendationSeverity",
    "PlaybookRecommendationAction",
    "PlaybookRecommendationExplanation",
  ]) {
    assert.match(indexFile, new RegExp(typeName), `index.ts must re-export ${typeName}`);
    assert.match(recommendationEngine, new RegExp(`export type ${typeName}`), `recommendation-engine.ts must define ${typeName}`);
  }
});

// ─── Reuse, not duplication ─────────────────────────────────────────────────

test("recommendation-engine reuses PlaybookRuleSeverity/PlaybookSuggestedAction instead of parallel types", () => {
  assert.match(recommendationEngine, /PlaybookRecommendationSeverity = PlaybookRuleSeverity/);
  assert.match(recommendationEngine, /PlaybookRecommendationAction = PlaybookSuggestedAction/);
});

test("generatePlaybookRecommendations reuses evaluatePlaybookRules from the Rules Engine (Sprint 1)", () => {
  assert.match(recommendationEngine, /import \{ evaluatePlaybookRules \} from "\.\/rules-engine"/);
  assert.match(recommendationEngine, /evaluatePlaybookRules\(playbook, context\)/);
});

test("recommendation-engine and recommendation-state follow the PlaybookEngineResult ok/error convention", () => {
  assert.match(recommendationEngine, /PlaybookEngineResult<GeneratePlaybookRecommendationsResult>/);
  assert.match(recommendationState, /PlaybookEngineResult<PlaybookRecommendation>/);
});

// ─── Status transition graph ─────────────────────────────────────────────────

test("dismissed and executed are terminal states in the transition graph", () => {
  assert.match(recommendationState, /dismissed: \[\]/);
  assert.match(recommendationState, /executed: \[\]/);
});

test("approveRecommendation and markRecommendationExecuted guard on approvalRequired", () => {
  assert.match(recommendationState, /if \(!recommendation\.approvalRequired\)/);
  assert.match(recommendationState, /recommendation\.approvalRequired && recommendation\.status !== "approved"/);
  assert.match(recommendationState, /!recommendation\.approvalRequired && recommendation\.status !== "accepted"/);
});

// ─── Runtime behavior probe ──────────────────────────────────────────────────

const runtimeProbe = String.raw`
import assert from "node:assert/strict";
import {
  SEED_DELIVERY_PLAYBOOK,
  generatePlaybookRecommendations,
  explainPlaybookRecommendation,
  mergePlaybookRecommendations,
  markRecommendationViewed,
  acceptRecommendation,
  dismissRecommendation,
  markRecommendationConvertedToTask,
  markRecommendationRequiresApproval,
  approveRecommendation,
  markRecommendationExecuted,
} from "./src/lib/playbook-engine/index.ts";

const baseContext = {
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
};

// 1. A fired rule (pb-init-constitution-missing) generates a recommendation.
const result = generatePlaybookRecommendations(baseContext, SEED_DELIVERY_PLAYBOOK);
assert.equal(result.ok, true, "generation must succeed with valid projectId/workspaceId");
const { recommendations, indeterminateRuleIds } = result.data;

const constitutionRec = recommendations.find((r) => r.playbookRuleId === "pb-init-constitution-missing");
assert.ok(constitutionRec, "pb-init-constitution-missing must produce a recommendation when hasApprovedConstitution is false");

// 2. Rule includes playbookRuleId, evidenceUsed, missingEvidence, explanation.
assert.equal(constitutionRec.playbookRuleId, "pb-init-constitution-missing");
assert.deepEqual(constitutionRec.evidenceUsed, [{ fact: "hasApprovedConstitution", value: false }]);
assert.deepEqual(constitutionRec.missingEvidence, []);
assert.ok(constitutionRec.explanation, "recommendation must carry an explanation");
assert.match(constitutionRec.explanation.narrative, /Según el playbook/);
assert.match(constitutionRec.explanation.narrative, /pb-init-constitution-missing/);

// 3. suggestedActions are preserved, including generate_project_constitution_draft.
assert.ok(constitutionRec.suggestedActions.some((a) => a.action === "generate_project_constitution_draft" && a.approvalRequired === false));
assert.ok(constitutionRec.suggestedActions.some((a) => a.action === "approve_project_constitution" && a.approvalRequired === true));

// 4. approvalRequired is computed correctly from sensitive suggestedActions.
assert.equal(constitutionRec.approvalRequired, true, "approve_project_constitution requires approval, so the recommendation must too");
assert.equal(constitutionRec.hasApprovalSensitiveActions, true);

// 5. A rule with no sensitive suggestedActions -> approvalRequired false.
const stakeholderRec = recommendations.find((r) => r.playbookRuleId === "pb-init-stakeholder-map-missing");
assert.equal(stakeholderRec, undefined, "hasStakeholderMap is null (unknown), so this rule must be indeterminate, not fired");
assert.ok(indeterminateRuleIds.includes("pb-init-stakeholder-map-missing"), "indeterminate rules must be reported separately");

// 6. not_fired rules never produce a recommendation.
const charterOkContext = { ...baseContext, hasApprovedCharter: true };
const charterResult = generatePlaybookRecommendations(charterOkContext, SEED_DELIVERY_PLAYBOOK);
assert.ok(!charterResult.data.recommendations.some((r) => r.playbookRuleId === "pb-init-charter-missing"));

// 7. Two identical evaluations produce the same fingerprint/id (idempotent).
const secondResult = generatePlaybookRecommendations(baseContext, SEED_DELIVERY_PLAYBOOK);
const secondConstitutionRec = secondResult.data.recommendations.find((r) => r.playbookRuleId === "pb-init-constitution-missing");
assert.equal(secondConstitutionRec.fingerprint, constitutionRec.fingerprint, "fingerprint must be deterministic across identical evaluations");
assert.equal(secondConstitutionRec.id, constitutionRec.id);

// 8. mergePlaybookRecommendations never duplicates by fingerprint and preserves prior status.
const viewedRec = markRecommendationViewed(constitutionRec);
assert.equal(viewedRec.ok, true);
const merged = mergePlaybookRecommendations([viewedRec.data], secondResult.data.recommendations);
const mergedFingerprints = merged.map((r) => r.fingerprint);
assert.equal(new Set(mergedFingerprints).size, mergedFingerprints.length, "merge must not produce duplicate fingerprints");
const mergedConstitutionRec = merged.find((r) => r.fingerprint === constitutionRec.fingerprint);
assert.equal(mergedConstitutionRec.status, "viewed", "merge must preserve the previously recorded human decision status");

// 9. Missing projectId -> validation_failed, no recommendations invented.
const noProjectId = generatePlaybookRecommendations({ ...baseContext, projectId: "" }, SEED_DELIVERY_PLAYBOOK);
assert.equal(noProjectId.ok, false);
assert.equal(noProjectId.failureClass, "validation_failed");

// 10. State machine: dismissed cannot become executed.
const dismissed = dismissRecommendation(constitutionRec);
assert.equal(dismissed.ok, true);
assert.equal(dismissed.data.status, "dismissed");
const dismissedToExecuted = markRecommendationExecuted(dismissed.data);
assert.equal(dismissedToExecuted.ok, false, "dismissed must never transition to executed");

// 11. executed is a final state.
const accepted = acceptRecommendation(viewedRec.data);
assert.equal(accepted.ok, true);
const requiresApproval = markRecommendationRequiresApproval(accepted.data);
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

// 12. approved cannot happen if approvalRequired is false.
const nonSensitiveRec = { ...constitutionRec, approvalRequired: false, status: "requires_approval" };
const approvalOnNonSensitive = approveRecommendation(nonSensitiveRec);
assert.equal(approvalOnNonSensitive.ok, false, "approveRecommendation must reject recommendations that never required approval");

// 13. Sensitive actions never execute automatically: accepted (not approved) cannot become executed
//     when approvalRequired is true.
const acceptedButNotApproved = { ...constitutionRec, status: "accepted" };
const prematureExecution = markRecommendationExecuted(acceptedButNotApproved);
assert.equal(prematureExecution.ok, false, "approval-sensitive recommendations must not execute before approval");

const payload = {
  recommendationCount: recommendations.length,
  constitutionApprovalRequired: constitutionRec.approvalRequired,
  confidence: constitutionRec.confidence,
};
console.log(JSON.stringify(payload));
`;

const runtime = JSON.parse(execFileSync("npx", ["tsx", "--eval", runtimeProbe], { encoding: "utf8" }).trim().split("\n").at(-1));

test("iniciacion phase with an unapproved constitution yields at least one recommendation (runtime)", () => {
  assert.ok(runtime.recommendationCount >= 1);
});

test("pb-init-constitution-missing recommendation requires approval and has full confidence (runtime)", () => {
  assert.equal(runtime.constitutionApprovalRequired, true);
  assert.equal(runtime.confidence, 100);
});
