import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

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
} from "../src/lib/playbook-engine/index.ts";

const engine = fs.readFileSync("src/lib/playbook-engine/closure-billing-engine.ts", "utf8");
const state = fs.readFileSync("src/lib/playbook-engine/closure-billing-state.ts", "utf8");
const types = fs.readFileSync("src/lib/playbook-engine/closure-billing-types.ts", "utf8");
const mappers = fs.readFileSync("src/lib/playbook-engine/closure-billing-mappers.ts", "utf8");
const indexFile = fs.readFileSync("src/lib/playbook-engine/index.ts", "utf8");

// ─── Exports (static) ───────────────────────────────────────────────────────────

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
    "ClosureBillingBlockerEvidenceStatus",
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

test("closure & billing assessment reviewStatus never reaches an automatic closed/invoiced state", () => {
  assert.match(state, /discarded: \[\]/);
  const reviewStatusDeclaration = types.match(/export type ClosureBillingAssessmentReviewStatus = [^;]*;/)?.[0] ?? "";
  assert.ok(reviewStatusDeclaration.length > 0, "ClosureBillingAssessmentReviewStatus must be declared");
  assert.doesNotMatch(reviewStatusDeclaration, /"closed"|"invoiced"/, "reviewStatus must never include a closed/invoiced value");
});

test("checklist item validation only accepts requires_validation as the source status", () => {
  assert.match(state, /item\.status !== "requires_validation"/);
});

// ─── Runtime behavior (direct import) ──────────────────────────────────────────

const workspaceId = "00000000-0000-0000-0000-000000000002";
const projectId = "00000000-0000-0000-0000-000000000001";

function emptyContext(overrides = {}) {
  return {
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
    ...overrides,
  };
}

// A project that is technically complete and has everything except reception/sign-off.
function technicallyCompleteContext(overrides = {}) {
  return emptyContext({
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
    ...overrides,
  });
}

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

function assess(context, options = {}) {
  const result = evaluateClosureAndBilling(context, options);
  assert.equal(result.ok, true);
  return result.data;
}

// ─── Baseline readiness behavior ────────────────────────────────────────────────

test("no constitution at all -> not readyForClosure/readyForBilling", () => {
  const assessment = assess(technicallyCompleteContext());
  assert.equal(assessment.readyForClosure, false, "missing acceptance criteria/closure rules must block closure");
  assert.equal(assessment.readyForBilling, false, "unvalidated billing rules must block billing");
  assert.ok(assessment.billingBlockers.some((b) => b.type === "unknown_billing_rule"));
});

test("technically complete but no reception -> not readyForBilling + missing_reception blocker", () => {
  const assessment = assess(technicallyCompleteContext(), { constitution: fullyReadyConstitution });
  assert.equal(assessment.readyForBilling, false, "missing reception must block billing even when technically complete");
  assert.ok(assessment.billingBlockers.some((b) => b.type === "missing_reception"));
});

test("reception + evidence + everything else complete -> readyForBilling and readyForClosure", () => {
  const assessment = assess(technicallyCompleteContext({ hasClientSignoff: true }), { constitution: fullyReadyConstitution });
  assert.equal(assessment.readyForBilling, true);
  assert.equal(assessment.readyForClosure, true);
  assert.equal(assessment.billingBlockers.length, 0);
  assert.equal(assessment.closureBlockers.length, 0);
});

test("missing evidence generates both a closure blocker and a billing blocker", () => {
  const assessment = assess(technicallyCompleteContext({ hasClientSignoff: true, hasTechnicalEvidence: false }), { constitution: fullyReadyConstitution });
  assert.equal(assessment.closureBlockers.some((b) => b.type === "missing_evidence"), true);
  assert.equal(assessment.billingBlockers.some((b) => b.type === "missing_evidence"), true);
});

test("missing final report (when required) generates missing_report billing blocker", () => {
  const assessment = assess(technicallyCompleteContext({ hasClientSignoff: true, requiresFinalReport: true, hasFinalReportDelivered: false }), {
    constitution: fullyReadyConstitution,
  });
  assert.ok(assessment.billingBlockers.some((b) => b.type === "missing_report"));
});

test("missing PO/OC (when required) generates missing_po billing blocker", () => {
  const assessment = assess(technicallyCompleteContext({ hasClientSignoff: true, requiresPurchaseOrder: true, hasPurchaseOrder: false }), {
    constitution: fullyReadyConstitution,
  });
  assert.ok(assessment.billingBlockers.some((b) => b.type === "missing_po"));
});

test("open blocking issues block closure", () => {
  const assessment = assess(technicallyCompleteContext({ hasClientSignoff: true, openBlockingIssues: 2 }), { constitution: fullyReadyConstitution });
  assert.equal(assessment.readyForClosure, false);
  assert.ok(assessment.closureBlockers.some((b) => b.type === "unresolved_issue"));
});

test("open critical dependencies block closure and billing", () => {
  const assessment = assess(technicallyCompleteContext({ hasClientSignoff: true, openCriticalDependencies: 1 }), { constitution: fullyReadyConstitution });
  assert.equal(assessment.readyForClosure, false);
  assert.equal(assessment.readyForBilling, false);
  assert.ok(assessment.closureBlockers.some((b) => b.type === "unresolved_dependency"));
  assert.ok(assessment.billingBlockers.some((b) => b.type === "unresolved_dependency"));
});

// ─── Evidence confidence: missing vs. requires_validation — Hardening Sprint ───

test("undefined reception evidence produces a requires_validation blocker, never a confirmed one", () => {
  // hasClientSignoff left null/undefined (unknown), not explicitly false.
  const assessment = assess(technicallyCompleteContext({ hasClientSignoff: null }), { constitution: fullyReadyConstitution });
  const blocker = assessment.billingBlockers.find((b) => b.type === "missing_reception");
  assert.ok(blocker, "unknown reception evidence must still surface a blocker (can't proceed either way)");
  assert.equal(blocker.evidenceStatus, "requires_validation", "unknown evidence must never be reported as confirmed missing");
});

test("hasClientSignoff === false produces a confirmed missing_reception blocker", () => {
  const assessment = assess(technicallyCompleteContext({ hasClientSignoff: false }), { constitution: fullyReadyConstitution });
  const blocker = assessment.billingBlockers.find((b) => b.type === "missing_reception");
  assert.ok(blocker);
  assert.equal(blocker.evidenceStatus, "missing", "an explicit false fact must be reported as confirmed missing");
});

test("unknown billing rules (no constitution at all) produce an unknown_billing_rule blocker marked requires_validation", () => {
  const assessment = assess(technicallyCompleteContext({ hasClientSignoff: true }), {});
  const blocker = assessment.billingBlockers.find((b) => b.type === "unknown_billing_rule");
  assert.ok(blocker);
  assert.equal(blocker.evidenceStatus, "requires_validation");
});

test("explicit missing PO produces a confirmed missing_po blocker", () => {
  const assessment = assess(technicallyCompleteContext({ hasClientSignoff: true, requiresPurchaseOrder: true, hasPurchaseOrder: false }), {
    constitution: fullyReadyConstitution,
  });
  const blocker = assessment.billingBlockers.find((b) => b.type === "missing_po");
  assert.ok(blocker);
  assert.equal(blocker.evidenceStatus, "missing");
});

test("unknown PO requirement never invents a confirmed missing_po — it's requires_validation instead", () => {
  const assessment = assess(technicallyCompleteContext({ hasClientSignoff: true, requiresPurchaseOrder: null, hasPurchaseOrder: null }), {
    constitution: fullyReadyConstitution,
  });
  const blocker = assessment.billingBlockers.find((b) => b.type === "missing_po");
  assert.ok(blocker, "an unknown PO requirement still produces a blocker to review, just not a confirmed one");
  assert.equal(blocker.evidenceStatus, "requires_validation", "the engine does not know if a PO is even required — never invent a confirmed absence");
});

test("readyForBilling stays false when a critical billing fact is unknown, exactly as when it's confirmed false", () => {
  const unknown = assess(technicallyCompleteContext({ hasClientSignoff: null }), { constitution: fullyReadyConstitution });
  const confirmed = assess(technicallyCompleteContext({ hasClientSignoff: false }), { constitution: fullyReadyConstitution });
  assert.equal(unknown.readyForBilling, false);
  assert.equal(confirmed.readyForBilling, false);
  // But the assessment-level status still distinguishes "we don't know" from "we know it's not ready".
  assert.equal(unknown.billingStatus, "indeterminate");
  assert.equal(confirmed.billingStatus, "not_ready");
});

test("explainClosureBillingAssessment's blocker summaries flag unconfirmed evidence distinctly", () => {
  const assessment = assess(technicallyCompleteContext({ hasClientSignoff: null }), { constitution: fullyReadyConstitution });
  const explanation = explainClosureBillingAssessment(assessment);
  assert.ok(explanation.billingBlockersSummary.some((line) => /evidencia por validar/i.test(line)));
});

// ─── Next-best-actions, including the missing_validation gap fix ───────────────

test("unknown closure/billing rules generate a review_project_constitution_rules next action", () => {
  const assessment = assess(technicallyCompleteContext());
  assert.ok(assessment.nextBestActions.some((a) => a.type === "review_project_constitution_rules"));
});

test("reception_request template recommended, billing_enablement_follow_up next action generated, when reception is missing", () => {
  const assessment = assess(technicallyCompleteContext(), { constitution: fullyReadyConstitution });
  assert.equal(assessment.recommendedCommunicationTemplateId, "reception_request");
  assert.ok(assessment.nextBestActions.some((a) => a.recommendedCommunicationTemplateId === "billing_enablement_follow_up"));
});

test("information_request recommended when evidence is missing", () => {
  const assessment = assess(technicallyCompleteContext({ hasClientSignoff: true, hasTechnicalEvidence: false }), { constitution: fullyReadyConstitution });
  assert.equal(assessment.recommendedCommunicationTemplateId, "information_request");
});

test("closure_confirmation recommended when ready for closure", () => {
  const assessment = assess(technicallyCompleteContext({ hasClientSignoff: true }), { constitution: fullyReadyConstitution });
  assert.equal(assessment.recommendedCommunicationTemplateId, "closure_confirmation");
});

test("missing_validation billing blocker now generates a request_client_validation next action (previously empty)", () => {
  // hasClientValidation: false, everything else ready -> this used to leave nextBestActions
  // completely empty despite a real, detected blocker.
  const assessment = assess(
    technicallyCompleteContext({ hasClientSignoff: true, hasClientValidation: false }),
    { constitution: fullyReadyConstitution },
  );
  assert.ok(assessment.billingBlockers.some((b) => b.type === "missing_validation"));
  const action = assessment.nextBestActions.find((a) => a.type === "request_client_validation");
  assert.ok(action, "a missing_validation blocker must produce a concrete next action, not an empty list");
  assert.equal(action.recommendedCommunicationTemplateId, "information_request");
  assert.equal(action.recommendedOperationalDraftType, "decision");
  assert.equal(action.approvalRequired, true);
});

test("issue/dependency operational draft types recommended when those blockers are open, with matching next actions", () => {
  const issueAssessment = assess(technicallyCompleteContext({ hasClientSignoff: true, openBlockingIssues: 2 }), { constitution: fullyReadyConstitution });
  assert.ok(issueAssessment.recommendedOperationalDraftTypes.includes("issue"));
  assert.ok(issueAssessment.nextBestActions.some((a) => a.type === "convert_to_operational_issue"));

  const dependencyAssessment = assess(technicallyCompleteContext({ hasClientSignoff: true, openCriticalDependencies: 1 }), {
    constitution: fullyReadyConstitution,
  });
  assert.ok(dependencyAssessment.recommendedOperationalDraftTypes.includes("dependency"));
  assert.ok(dependencyAssessment.nextBestActions.some((a) => a.type === "convert_to_operational_dependency"));
});

// ─── Never invents owner/dueDate/evidence; idempotency; mappers; state machine ─

test("blockers never invent owner/dueDate; providing projectContext populates them uniformly", () => {
  const assessment = assess(technicallyCompleteContext(), { constitution: fullyReadyConstitution });
  assert.equal(assessment.billingBlockers[0].owner, null);
  assert.equal(assessment.billingBlockers[0].dueDate, null);

  const withOwner = assess(technicallyCompleteContext(), {
    constitution: fullyReadyConstitution,
    projectContext: { owner: "Jane Doe", dueDate: "2026-08-01" },
  });
  const blocker = withOwner.billingBlockers.find((b) => b.type === "missing_reception");
  assert.equal(blocker.owner, "Jane Doe");
  assert.equal(blocker.dueDate, "2026-08-01");
});

test("fingerprint and blocker ids are deterministic across identical evaluations", () => {
  const context = technicallyCompleteContext({ hasClientSignoff: true });
  const first = assess(context, { constitution: fullyReadyConstitution });
  const second = assess(context, { constitution: fullyReadyConstitution });
  assert.equal(second.fingerprint, first.fingerprint);
  assert.equal(second.id, first.id);

  const contextWithBlocker = technicallyCompleteContext();
  const a = assess(contextWithBlocker, { constitution: fullyReadyConstitution });
  const b = assess(contextWithBlocker, { constitution: fullyReadyConstitution });
  assert.equal(
    b.billingBlockers.find((x) => x.type === "missing_reception").id,
    a.billingBlockers.find((x) => x.type === "missing_reception").id,
  );
});

test("explanation always states nothing was closed or invoiced automatically", () => {
  const assessment = assess(technicallyCompleteContext({ hasClientSignoff: true }), { constitution: fullyReadyConstitution });
  const explanation = explainClosureBillingAssessment(assessment);
  assert.match(explanation.narrative, /no cerr[oó] ni factur/i);
});

test("mappers are pure, never persist, and route by blocker type", () => {
  const issueAssessment = assess(technicallyCompleteContext({ hasClientSignoff: true, openBlockingIssues: 2 }), { constitution: fullyReadyConstitution });
  const raidInput = closureBlockerToOperationalDraftInput(issueAssessment.closureBlockers.find((b) => b.type === "unresolved_issue"), { workspaceId, projectId });
  assert.equal(raidInput.category, "issue");
  assert.equal(raidInput.workspaceId, workspaceId);

  const billingIssueInput = billingBlockerToOperationalDraftInput(issueAssessment.billingBlockers.find((b) => b.type === "unresolved_issue"), { workspaceId, projectId });
  assert.equal(billingIssueInput.category, "issue");

  const poAssessment = assess(technicallyCompleteContext({ hasClientSignoff: true, requiresPurchaseOrder: true, hasPurchaseOrder: false }), {
    constitution: fullyReadyConstitution,
  });
  const billingPoInput = billingBlockerToOperationalDraftInput(poAssessment.billingBlockers.find((b) => b.type === "missing_po"), { workspaceId, projectId });
  assert.equal(billingPoInput, null, "administrative/commercial billing blocker types must never map to a RAID item");

  const noConstitutionAssessment = assess(technicallyCompleteContext());
  const raidInputNull = closureBlockerToOperationalDraftInput(noConstitutionAssessment.closureBlockers.find((b) => b.type === "missing_acceptance"), {
    workspaceId,
    projectId,
  });
  assert.equal(raidInputNull, null, "closure blockers with no RAID category must map to null");

  const decisionInput = closureBlockerToDecisionInput(noConstitutionAssessment.closureBlockers.find((b) => b.type === "unknown_closure_rule"), {
    workspaceId,
    projectId,
  });
  assert.equal(decisionInput.decision_status, "draft");
  assert.equal(decisionInput.recommendation_id, null);

  const billingDecisionInput = billingBlockerToDecisionInput(noConstitutionAssessment.billingBlockers.find((b) => b.type === "unknown_billing_rule"), {
    workspaceId,
    projectId,
  });
  assert.equal(billingDecisionInput.decision_status, "draft");

  const withConstitution = assess(technicallyCompleteContext(), { constitution: fullyReadyConstitution });
  const commsInput = closureBillingAssessmentToCommunicationDraftInput(withConstitution);
  assert.equal(commsInput.templateId, "reception_request");
  const readyAssessment = assess(technicallyCompleteContext({ hasClientSignoff: true }), { constitution: fullyReadyConstitution });
  const commsInputNull = closureBillingAssessmentToCommunicationDraftInput({ ...readyAssessment, recommendedCommunicationTemplateId: null });
  assert.equal(commsInputNull, null);
});

test("state transitions: checklist item validation, blocker review, assessment review/discard", () => {
  const assessment = assess(technicallyCompleteContext());
  const requiresValidationItem = assessment.checklist.items.find((i) => i.status === "requires_validation");
  const validated = markClosureChecklistItemValidated(requiresValidationItem);
  assert.equal(validated.ok, true);
  assert.equal(validated.data.status, "complete");
  assert.equal(markClosureChecklistItemValidated(validated.data).ok, false);

  const reviewedClosureBlocker = markClosureBlockerReviewed(assessment.closureBlockers[0]);
  assert.equal(reviewedClosureBlocker.ok, true);
  assert.equal(reviewedClosureBlocker.data.status, "reviewed");
  assert.equal(markClosureBlockerReviewed(reviewedClosureBlocker.data).ok, false);

  const reviewedBillingBlocker = markBillingBlockerReviewed(assessment.billingBlockers[0]);
  assert.equal(reviewedBillingBlocker.ok, true);

  const reviewedAssessment = markClosureBillingAssessmentReviewed(assessment);
  assert.equal(reviewedAssessment.ok, true);
  assert.equal(reviewedAssessment.data.reviewStatus, "reviewed");
  const discarded = discardClosureBillingAssessment(reviewedAssessment.data);
  assert.equal(discarded.ok, true);
  assert.equal(discarded.data.reviewStatus, "discarded");
  assert.equal(markClosureBillingAssessmentReviewed(discarded.data).ok, false, "discarded assessment must never become reviewed again");
});

test("buildClosureChecklist/detectClosureBlockers/detectBillingBlockers are independently callable", () => {
  const context = technicallyCompleteContext();
  const checklist = buildClosureChecklist(context, fullyReadyConstitution);
  assert.equal(checklist.projectId, projectId);
  const closureBlockers = detectClosureBlockers(context, checklist, fullyReadyConstitution);
  const billingBlockers = detectBillingBlockers(context, checklist, fullyReadyConstitution);
  assert.ok(billingBlockers.some((b) => b.type === "missing_reception"));
  const nextActions = selectClosureBillingNextBestActions({
    workspaceId,
    projectId,
    closureBlockers,
    billingBlockers,
    readyForClosure: false,
    readyForBilling: false,
  });
  assert.ok(nextActions.some((a) => a.type === "request_formal_reception"));
});

test("missing projectId fails validation", () => {
  const result = evaluateClosureAndBilling(emptyContext({ projectId: "" }));
  assert.equal(result.ok, false);
  assert.equal(result.failureClass, "validation_failed");
});

test("technicalCompletionRatio is derived (0-100) and checklist has a non-zero total item count", () => {
  const assessment = assess(technicallyCompleteContext({ hasClientSignoff: true }), { constitution: fullyReadyConstitution });
  assert.equal(typeof assessment.technicalCompletionRatio, "number");
  assert.ok(assessment.technicalCompletionRatio >= 0 && assessment.technicalCompletionRatio <= 100);
  assert.ok(assessment.checklist.totalCount > 0);
});
