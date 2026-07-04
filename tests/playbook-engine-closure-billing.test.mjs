import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const engine = fs.readFileSync("src/lib/playbook-engine/closure-billing-engine.ts", "utf8");
const state = fs.readFileSync("src/lib/playbook-engine/closure-billing-state.ts", "utf8");
const types = fs.readFileSync("src/lib/playbook-engine/closure-billing-types.ts", "utf8");
const mappers = fs.readFileSync("src/lib/playbook-engine/closure-billing-mappers.ts", "utf8");
const indexFile = fs.readFileSync("src/lib/playbook-engine/index.ts", "utf8");

// ─── Exports ──────────────────────────────────────────────────────────────────

test("closure & billing engine functions are exported from the module", () => {
  for (const fn of [
    "buildClosureChecklist",
    "detectClosureBlockers",
    "detectBillingBlockers",
    "selectClosureBillingNextBestActions",
    "evaluateClosureAndBilling",
    "explainClosureBillingAssessment",
  ]) {
    assert.match(indexFile, new RegExp(fn), `index.ts must re-export ${fn}`);
    assert.match(engine, new RegExp(`export function ${fn}`), `closure-billing-engine.ts must define ${fn}`);
  }
});

test("closure & billing state helpers are exported from the module", () => {
  for (const fn of [
    "markClosureChecklistItemValidated",
    "markClosureBlockerReviewed",
    "markBillingBlockerReviewed",
    "markClosureBillingAssessmentReviewed",
    "discardClosureBillingAssessment",
  ]) {
    assert.match(indexFile, new RegExp(fn), `index.ts must re-export ${fn}`);
    assert.match(state, new RegExp(`export function ${fn}`), `closure-billing-state.ts must define ${fn}`);
  }
});

test("closure & billing mappers are exported and never persist", () => {
  for (const fn of [
    "closureBlockerToOperationalDraftInput",
    "billingBlockerToOperationalDraftInput",
    "closureBlockerToDecisionInput",
    "billingBlockerToDecisionInput",
    "closureBillingAssessmentToCommunicationDraftInput",
  ]) {
    assert.match(indexFile, new RegExp(fn), `index.ts must re-export ${fn}`);
    assert.match(mappers, new RegExp(`export function ${fn}`), `closure-billing-mappers.ts must define ${fn}`);
  }
  assert.doesNotMatch(mappers, /supabase|\.insert\(|\.from\(/i, "mappers must never persist anything");
});

test("core closure & billing types are exported from the module", () => {
  for (const typeName of [
    "ClosureBillingAssessment",
    "ClosureReadinessStatus",
    "BillingReadinessStatus",
    "ClosureChecklist",
    "ClosureChecklistItem",
    "ClosureChecklistItemStatus",
    "ClosureBlocker",
    "BillingBlocker",
    "BillingBlockerType",
    "ClosureBlockerType",
    "ClosureBillingNextAction",
    "ClosureBillingExplanation",
  ]) {
    assert.match(indexFile, new RegExp(typeName), `index.ts must re-export ${typeName}`);
    assert.match(types, new RegExp(`export type ${typeName}`), `closure-billing-types.ts must define ${typeName}`);
  }
});

test("mappers reuse RAID's canonicalRaidFingerprint and decision-governance's DecisionType/DecisionStatus instead of inventing parallel models", () => {
  assert.match(mappers, /import \{ canonicalRaidFingerprint \} from "\.\.\/raid\/extraction"/);
  assert.match(mappers, /import type \{ RaidCategory \} from "\.\.\/raid\/types"/);
  assert.match(mappers, /import type \{ DecisionStatus, DecisionType \} from "\.\.\/decision-governance\/types"/);
});

test("engine reuses the Project Constitution draft's closureRules/billingRules/acceptanceCriteria/deliverables instead of a parallel rules model", () => {
  assert.match(engine, /import type \{ ProjectConstitutionDraft, ProjectConstitutionDraftField \} from "\.\/constitution-generator"/);
  assert.match(engine, /constitution\?\.deliverables/);
  assert.match(engine, /constitution\?\.acceptanceCriteria/);
  assert.match(engine, /constitution\?\.closureRules/);
  assert.match(engine, /constitution\?\.billingRules/);
});

test("engine reuses the existing CommunicationTemplateId enum for its recommended templates", () => {
  assert.match(engine, /import type \{ CommunicationTemplateId \} from "\.\/communication-types"/);
});

// ─── Governed state transitions ────────────────────────────────────────────────

test("closure & billing assessment reviewStatus never reaches an automatic closed/invoiced state", () => {
  assert.match(state, /discarded: \[\]/);
  const reviewStatusDeclaration = types.match(/export type ClosureBillingAssessmentReviewStatus = [^;]*;/)?.[0] ?? "";
  assert.ok(reviewStatusDeclaration.length > 0, "ClosureBillingAssessmentReviewStatus must be declared");
  assert.doesNotMatch(reviewStatusDeclaration, /"closed"|"invoiced"/, "reviewStatus must never include a closed/invoiced value");
});

test("checklist item validation only accepts requires_validation as the source status", () => {
  assert.match(state, /item\.status !== "requires_validation"/);
});

// ─── Runtime behavior probe ──────────────────────────────────────────────────

const runtimeProbe = String.raw`
import assert from "node:assert/strict";
import {
  evaluateClosureAndBilling,
  buildClosureChecklist,
  detectClosureBlockers,
  detectBillingBlockers,
  selectClosureBillingNextBestActions,
  explainClosureBillingAssessment,
  markClosureChecklistItemValidated,
  markClosureBlockerReviewed,
  markBillingBlockerReviewed,
  markClosureBillingAssessmentReviewed,
  discardClosureBillingAssessment,
  closureBlockerToOperationalDraftInput,
  billingBlockerToOperationalDraftInput,
  closureBlockerToDecisionInput,
  billingBlockerToDecisionInput,
  closureBillingAssessmentToCommunicationDraftInput,
} from "./src/lib/playbook-engine/index.ts";

const workspaceId = "00000000-0000-0000-0000-000000000002";
const projectId = "00000000-0000-0000-0000-000000000001";

const emptyContext = {
  projectId,
  workspaceId,
  phase: "cierre",
  hasApprovedCharter: null,
  hasApprovedConstitution: null,
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
  hasDeliverablesCompleted: null,
  hasTechnicalEvidence: null,
  hasClientValidation: null,
  hasClosureDecisionsMade: null,
  hasFinalReportDelivered: null,
  requiresFinalReport: null,
  hasPurchaseOrder: null,
  requiresPurchaseOrder: null,
  hasAdministrativeDocumentationComplete: null,
  requiresAdministrativeDocumentation: null,
  hasInternalApprovalForBilling: null,
  openCriticalDependencies: null,
  openBlockingIssues: null,
  metadata: {},
};

// A project that is technically complete and has everything except reception/sign-off.
const technicallyCompleteContext = {
  ...emptyContext,
  hasApprovedConstitution: true,
  hasTechnicalEvidence: true,
  hasDeliverablesCompleted: true,
  openCriticalRisks: 0,
  openBlockingIssues: 0,
  openCriticalDependencies: 0,
  hasClosureDecisionsMade: true,
  hasClientValidation: true,
  hasClientSignoff: false, // still pending
  requiresFinalReport: false,
  requiresPurchaseOrder: false,
  requiresAdministrativeDocumentation: false,
  hasInternalApprovalForBilling: true,
  hasClosureChecklistStarted: true,
};

const fullyReadyConstitution = {
  projectId,
  status: "approved",
  objective: { value: "Objetivo", status: "provided", note: "" },
  scopeIn: { value: ["in"], status: "provided", note: "" },
  scopeOut: { value: [], status: "provided", note: "" },
  deliverables: { value: ["Entregable 1"], status: "provided", note: "" },
  acceptanceCriteria: { value: ["Criterio 1"], status: "provided", note: "" },
  stakeholders: { value: [], status: "provided", note: "" },
  constraints: { value: [], status: "provided", note: "" },
  initialRisks: { value: [], status: "provided", note: "" },
  initialDependencies: { value: [], status: "provided", note: "" },
  communicationRules: { value: [], status: "provided", note: "" },
  changeRules: { value: [], status: "provided", note: "" },
  closureRules: { value: ["Regla de cierre"], status: "provided", note: "" },
  billingRules: { value: ["Regla de facturación"], status: "provided", note: "" },
  evidenceRequirements: { value: [], status: "provided", note: "" },
  playbookId: "seed-delivery-playbook-v1",
  playbookVersion: 1,
  generatedAt: new Date().toISOString(),
};

// 1. No acceptance criteria (no constitution at all) -> not readyForClosure.
const noAcceptanceCriteriaResult = evaluateClosureAndBilling(technicallyCompleteContext, {});
assert.equal(noAcceptanceCriteriaResult.ok, true);
const noAcceptanceCriteriaAssessment = noAcceptanceCriteriaResult.data;
assert.equal(noAcceptanceCriteriaAssessment.readyForClosure, false, "missing acceptance criteria/closure rules must block closure");

// 2. No billingRules validated -> not readyForBilling.
assert.equal(noAcceptanceCriteriaAssessment.readyForBilling, false, "unvalidated billing rules must block billing");
assert.ok(
  noAcceptanceCriteriaAssessment.billingBlockers.some((b) => b.type === "unknown_billing_rule"),
  "missing billingRules must generate an unknown_billing_rule blocker",
);

// 3 & 4. Technically complete but no reception -> not readyForBilling + missing_reception blocker.
const withConstitutionResult = evaluateClosureAndBilling(technicallyCompleteContext, { constitution: fullyReadyConstitution });
assert.equal(withConstitutionResult.ok, true);
const withConstitutionAssessment = withConstitutionResult.data;
assert.equal(withConstitutionAssessment.readyForBilling, false, "missing reception must block billing even when technically complete");
assert.ok(
  withConstitutionAssessment.billingBlockers.some((b) => b.type === "missing_reception"),
  "missing hasClientSignoff must generate a missing_reception billing blocker",
);

// 5. Reception/sign-off + evidence present + everything else complete -> readyForBilling.
const fullyReadyContext = { ...technicallyCompleteContext, hasClientSignoff: true };
const fullyReadyResult = evaluateClosureAndBilling(fullyReadyContext, { constitution: fullyReadyConstitution });
assert.equal(fullyReadyResult.ok, true);
const fullyReadyAssessment = fullyReadyResult.data;
assert.equal(fullyReadyAssessment.readyForBilling, true, "complete checklist must yield readyForBilling");
assert.equal(fullyReadyAssessment.readyForClosure, true, "complete checklist must yield readyForClosure");
assert.equal(fullyReadyAssessment.billingBlockers.length, 0);
assert.equal(fullyReadyAssessment.closureBlockers.length, 0);

// 6. Missing evidence generates both a closure blocker and a billing blocker.
const noEvidenceContext = { ...fullyReadyContext, hasTechnicalEvidence: false };
const noEvidenceResult = evaluateClosureAndBilling(noEvidenceContext, { constitution: fullyReadyConstitution });
assert.equal(noEvidenceResult.data.closureBlockers.some((b) => b.type === "missing_evidence"), true);
assert.equal(noEvidenceResult.data.billingBlockers.some((b) => b.type === "missing_evidence"), true);

// 7. Missing final report (when required) generates missing_report billing blocker.
const noReportContext = { ...fullyReadyContext, requiresFinalReport: true, hasFinalReportDelivered: false };
const noReportResult = evaluateClosureAndBilling(noReportContext, { constitution: fullyReadyConstitution });
assert.ok(noReportResult.data.billingBlockers.some((b) => b.type === "missing_report"));

// 8. Missing PO/OC (when required) generates missing_po billing blocker.
const noPoContext = { ...fullyReadyContext, requiresPurchaseOrder: true, hasPurchaseOrder: false };
const noPoResult = evaluateClosureAndBilling(noPoContext, { constitution: fullyReadyConstitution });
assert.ok(noPoResult.data.billingBlockers.some((b) => b.type === "missing_po"));

// 9. Open critical issues block closure.
const criticalIssueContext = { ...fullyReadyContext, openBlockingIssues: 2 };
const criticalIssueResult = evaluateClosureAndBilling(criticalIssueContext, { constitution: fullyReadyConstitution });
assert.equal(criticalIssueResult.data.readyForClosure, false);
assert.ok(criticalIssueResult.data.closureBlockers.some((b) => b.type === "unresolved_issue"));

// 10. Open critical dependencies block closure/billing.
const criticalDependencyContext = { ...fullyReadyContext, openCriticalDependencies: 1 };
const criticalDependencyResult = evaluateClosureAndBilling(criticalDependencyContext, { constitution: fullyReadyConstitution });
assert.equal(criticalDependencyResult.data.readyForClosure, false);
assert.equal(criticalDependencyResult.data.readyForBilling, false);
assert.ok(criticalDependencyResult.data.closureBlockers.some((b) => b.type === "unresolved_dependency"));
assert.ok(criticalDependencyResult.data.billingBlockers.some((b) => b.type === "unresolved_dependency"));

// 11. Unknown closure rules -> next action review_project_constitution_rules.
const unknownRulesAssessment = noAcceptanceCriteriaAssessment;
assert.ok(
  unknownRulesAssessment.nextBestActions.some((a) => a.type === "review_project_constitution_rules"),
  "unknown closure/billing rules must generate a review_project_constitution_rules next action",
);

// 12. reception_request template recommended when reception is missing.
assert.equal(withConstitutionAssessment.recommendedCommunicationTemplateId, "reception_request");

// 13. billing_enablement_follow_up recommended (as a next action) when reception blocks billing.
assert.ok(
  withConstitutionAssessment.nextBestActions.some((a) => a.recommendedCommunicationTemplateId === "billing_enablement_follow_up"),
  "reception blocking billing must recommend billing_enablement_follow_up via a next action",
);

// 14. information_request recommended when evidence is missing.
assert.equal(noEvidenceResult.data.recommendedCommunicationTemplateId, "information_request");

// 15. closure_confirmation recommended when ready for closure.
assert.equal(fullyReadyAssessment.recommendedCommunicationTemplateId, "closure_confirmation");

// 16. issue/dependency operational draft types recommended when those blockers are open.
assert.ok(criticalIssueResult.data.recommendedOperationalDraftTypes.includes("issue"));
assert.ok(criticalDependencyResult.data.recommendedOperationalDraftTypes.includes("dependency"));
assert.ok(
  criticalIssueResult.data.nextBestActions.some((a) => a.type === "convert_to_operational_issue"),
  "open blocking issue must generate a convert_to_operational_issue next action",
);
assert.ok(
  criticalDependencyResult.data.nextBestActions.some((a) => a.type === "convert_to_operational_dependency"),
  "open critical dependency must generate a convert_to_operational_dependency next action",
);

// 17. never invents owner/dueDate/evidence.
assert.equal(withConstitutionAssessment.billingBlockers[0].owner, null);
assert.equal(withConstitutionAssessment.billingBlockers[0].dueDate, null);
const withOwnerResult = evaluateClosureAndBilling(technicallyCompleteContext, {
  constitution: fullyReadyConstitution,
  projectContext: { owner: "Jane Doe", dueDate: "2026-08-01" },
});
assert.equal(withOwnerResult.data.billingBlockers.find((b) => b.type === "missing_reception").owner, "Jane Doe");
assert.equal(withOwnerResult.data.billingBlockers.find((b) => b.type === "missing_reception").dueDate, "2026-08-01");

// 18. fingerprint is deterministic for identical input.
const again = evaluateClosureAndBilling(fullyReadyContext, { constitution: fullyReadyConstitution });
assert.equal(again.data.fingerprint, fullyReadyAssessment.fingerprint);
assert.equal(again.data.id, fullyReadyAssessment.id);

// 19. blocker ids are deterministic across evaluations of the same context.
const again2 = evaluateClosureAndBilling(withConstitutionAssessment && technicallyCompleteContext, { constitution: fullyReadyConstitution });
assert.equal(
  again2.data.billingBlockers.find((b) => b.type === "missing_reception").id,
  withConstitutionAssessment.billingBlockers.find((b) => b.type === "missing_reception").id,
);

// 20. explanation mentions no automatic closure/billing.
const explanation = explainClosureBillingAssessment(fullyReadyAssessment);
assert.match(explanation.narrative, /no cerr[oó] ni factur/i);

// 21. mappers are pure and never persist; route by blocker type.
const raidInput = closureBlockerToOperationalDraftInput(criticalIssueResult.data.closureBlockers.find((b) => b.type === "unresolved_issue"), {
  workspaceId,
  projectId,
});
assert.equal(raidInput.category, "issue");
assert.equal(raidInput.workspaceId, workspaceId);
const raidInputNull = closureBlockerToOperationalDraftInput(withConstitutionAssessment.closureBlockers.find((b) => b.type === "missing_acceptance") ?? noAcceptanceCriteriaAssessment.closureBlockers.find((b) => b.type === "missing_acceptance"), { workspaceId, projectId });
assert.equal(raidInputNull, null, "closure blockers with no RAID category must map to null");

const decisionInput = closureBlockerToDecisionInput(noAcceptanceCriteriaAssessment.closureBlockers.find((b) => b.type === "unknown_closure_rule"), {
  workspaceId,
  projectId,
});
assert.equal(decisionInput.decision_status, "draft");
assert.equal(decisionInput.recommendation_id, null);

const billingDecisionInput = billingBlockerToDecisionInput(noAcceptanceCriteriaAssessment.billingBlockers.find((b) => b.type === "unknown_billing_rule"), {
  workspaceId,
  projectId,
});
assert.equal(billingDecisionInput.decision_status, "draft");

const commsInput = closureBillingAssessmentToCommunicationDraftInput(withConstitutionAssessment);
assert.equal(commsInput.templateId, "reception_request");
const commsInputNull = closureBillingAssessmentToCommunicationDraftInput({ ...fullyReadyAssessment, recommendedCommunicationTemplateId: null });
assert.equal(commsInputNull, null);

// 22. state transitions: checklist item validation, blocker review, assessment review/discard.
const requiresValidationItem = noAcceptanceCriteriaAssessment.checklist.items.find((i) => i.status === "requires_validation");
const validated = markClosureChecklistItemValidated(requiresValidationItem);
assert.equal(validated.ok, true);
assert.equal(validated.data.status, "complete");
const cannotValidateComplete = markClosureChecklistItemValidated(validated.data);
assert.equal(cannotValidateComplete.ok, false);

const reviewedClosureBlocker = markClosureBlockerReviewed(noAcceptanceCriteriaAssessment.closureBlockers[0]);
assert.equal(reviewedClosureBlocker.ok, true);
assert.equal(reviewedClosureBlocker.data.status, "reviewed");
const cannotReviewTwice = markClosureBlockerReviewed(reviewedClosureBlocker.data);
assert.equal(cannotReviewTwice.ok, false);

const reviewedBillingBlocker = markBillingBlockerReviewed(noAcceptanceCriteriaAssessment.billingBlockers[0]);
assert.equal(reviewedBillingBlocker.ok, true);

const reviewedAssessment = markClosureBillingAssessmentReviewed(noAcceptanceCriteriaAssessment);
assert.equal(reviewedAssessment.ok, true);
assert.equal(reviewedAssessment.data.reviewStatus, "reviewed");
const discardedAssessment = discardClosureBillingAssessment(reviewedAssessment.data);
assert.equal(discardedAssessment.ok, true);
assert.equal(discardedAssessment.data.reviewStatus, "discarded");
const cannotReviveDiscarded = markClosureBillingAssessmentReviewed(discardedAssessment.data);
assert.equal(cannotReviveDiscarded.ok, false, "discarded assessment must never become reviewed again");

// 23. buildClosureChecklist/detectClosureBlockers/detectBillingBlockers are independently callable.
const standaloneChecklist = buildClosureChecklist(technicallyCompleteContext, fullyReadyConstitution);
assert.equal(standaloneChecklist.projectId, projectId);
const standaloneClosureBlockers = detectClosureBlockers(technicallyCompleteContext, standaloneChecklist, fullyReadyConstitution);
const standaloneBillingBlockers = detectBillingBlockers(technicallyCompleteContext, standaloneChecklist, fullyReadyConstitution);
assert.ok(standaloneBillingBlockers.some((b) => b.type === "missing_reception"));
const standaloneNextActions = selectClosureBillingNextBestActions({
  workspaceId,
  projectId,
  closureBlockers: standaloneClosureBlockers,
  billingBlockers: standaloneBillingBlockers,
  readyForClosure: false,
  readyForBilling: false,
});
assert.ok(standaloneNextActions.some((a) => a.type === "request_formal_reception"));

// 24. validation failures.
const invalidResult = evaluateClosureAndBilling({ ...emptyContext, projectId: "" });
assert.equal(invalidResult.ok, false);
assert.equal(invalidResult.failureClass, "validation_failed");

const payload = {
  readyForBilling: fullyReadyAssessment.readyForBilling,
  technicalCompletionRatio: fullyReadyAssessment.technicalCompletionRatio,
  closureChecklistTotal: fullyReadyAssessment.checklist.totalCount,
};
console.log(JSON.stringify(payload));
`;

const runtime = JSON.parse(execFileSync("npx", ["tsx", "--eval", runtimeProbe], { encoding: "utf8" }).trim().split("\n").at(-1));

test("closure & billing runtime probe: a fully-ready project reaches readyForBilling", () => {
  assert.equal(runtime.readyForBilling, true);
});

test("closure & billing runtime probe: technicalCompletionRatio is derived (0-100) when technical items exist", () => {
  assert.ok(typeof runtime.technicalCompletionRatio === "number");
  assert.ok(runtime.technicalCompletionRatio >= 0 && runtime.technicalCompletionRatio <= 100);
});

test("closure & billing runtime probe: checklist has a non-zero total item count", () => {
  assert.ok(runtime.closureChecklistTotal > 0);
});
