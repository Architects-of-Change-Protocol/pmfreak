import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  generatePlaybookGovernanceSnapshot,
  explainPlaybookGovernanceSnapshot,
  generateDemoGovernanceSnapshot,
  PLAYBOOK_DEMO_SCENARIOS,
} from "../src/lib/playbook-engine/index.ts";

const snapshotEngine = fs.readFileSync("src/lib/playbook-engine/governance-snapshot-engine.ts", "utf8");
const snapshotTypes = fs.readFileSync("src/lib/playbook-engine/governance-snapshot-types.ts", "utf8");
const demoScenarios = fs.readFileSync("src/lib/playbook-engine/demo-scenarios.ts", "utf8");
const explainFile = fs.readFileSync("src/lib/playbook-engine/explain.ts", "utf8");
const indexFile = fs.readFileSync("src/lib/playbook-engine/index.ts", "utf8");

// ─── Exports (static) ───────────────────────────────────────────────────────────

test("governance snapshot engine functions are exported from the module", () => {
  for (const fn of ["generatePlaybookGovernanceSnapshot", "explainPlaybookGovernanceSnapshot"]) {
    assert.match(indexFile, new RegExp(fn), `index.ts must re-export ${fn}`);
    assert.match(snapshotEngine, new RegExp(`export function ${fn}`), `governance-snapshot-engine.ts must define ${fn}`);
  }
});

test("core governance snapshot types are exported from the module", () => {
  for (const typeName of ["PlaybookGovernanceSnapshot", "PlaybookGovernanceSnapshotExplanation", "PlaybookGovernanceApprovalItem"]) {
    assert.match(indexFile, new RegExp(typeName), `index.ts must re-export ${typeName}`);
    assert.match(snapshotTypes, new RegExp(`export type ${typeName}`), `governance-snapshot-types.ts must define ${typeName}`);
  }
});

test("demo scenarios module declares all four minimum scenarios", () => {
  for (const scenarioId of [
    "pending_reception_billing_blocker",
    "security_hardening_client_validation",
    "web_software_uat_evidence_pending",
    "ready_for_billing",
  ]) {
    assert.match(demoScenarios, new RegExp(scenarioId), `demo-scenarios.ts must declare scenario '${scenarioId}'`);
  }
  assert.match(indexFile, /PLAYBOOK_DEMO_SCENARIOS/);
  assert.match(indexFile, /generateDemoGovernanceSnapshot/);
});

test("governance snapshot engine source never persists, sends, or executes anything", () => {
  assert.doesNotMatch(snapshotEngine, /supabase|createPlatformEvent\(|\.insert\(|sendEmail|nodemailer/i);
});

test("capability explanation mentions every MVP module", () => {
  for (const moduleLabel of [
    "Seed Playbook",
    "Rules Engine",
    "Project Constitution Generator",
    "Recommendation Engine",
    "Communications Playbook",
    "Operational Intelligence",
    "Closure & Billing Intelligence",
    "Audit Trail",
    "Governance Snapshot",
  ]) {
    assert.match(explainFile, new RegExp(moduleLabel), `explain.ts must mention '${moduleLabel}'`);
  }
});

test("capability explanation states no DB side effects, no automatic emails/closure/billing/approvals", () => {
  assert.match(explainFile, /escribe en base de datos/i);
  assert.match(explainFile, /env[ií]a correos/i);
  assert.match(explainFile, /cierra proyectos/i);
  assert.match(explainFile, /marca facturas/i);
  assert.match(explainFile, /aprueba autom[aá]ticamente/i);
});

// ─── Runtime behavior (direct import) ───────────────────────────────────────────

function baseContext(overrides = {}) {
  return {
    projectId: "00000000-0000-0000-0000-000000000001",
    workspaceId: "00000000-0000-0000-0000-000000000002",
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

test("validation failure: missing projectId never produces a snapshot", () => {
  const result = generatePlaybookGovernanceSnapshot(baseContext({ projectId: "" }));
  assert.equal(result.ok, false);
  assert.equal(result.failureClass, "validation_failed");
});

// ─── Smoke test: the full chain, exercised end-to-end on real project facts ────

test("smoke test: generatePlaybookGovernanceSnapshot runs the complete chain end-to-end", () => {
  const context = baseContext({
    hasApprovedConstitution: false,
    hasApprovedCharter: false,
    hasStakeholderMap: false,
    openCriticalRisks: 2,
    hasClientSignoff: false,
    hasFinalInvoiceIssued: false,
  });
  const result = generatePlaybookGovernanceSnapshot(context, { phase: undefined });
  assert.equal(result.ok, true);
  const snapshot = result.data;

  // Every stage of the chain actually ran and left a trace in the snapshot.
  assert.ok(snapshot.rulesEvaluationSummary.totalRules > 0, "Rules Engine must have evaluated something");
  assert.ok(snapshot.constitutionDraft, "Project Constitution Generator must have run by default");
  assert.equal(snapshot.constitutionDraft.status, "draft");
  assert.ok(Array.isArray(snapshot.recommendations), "Recommendation Engine must have run");
  assert.ok(Array.isArray(snapshot.communicationDrafts), "Communications Playbook must have run");
  assert.ok(Array.isArray(snapshot.operationalDrafts), "Operational Intelligence must have run");
  assert.ok(snapshot.closureBillingAssessment, "Closure & Billing Intelligence must have run");
  assert.ok(snapshot.auditEvents.length > 0, "Audit Trail must have recorded events for every stage");
  assert.ok(snapshot.demoSummary.length > 0);
  assert.match(snapshot.demoSummary, /solo-lectura|automáticamente/i);

  // The orchestrator's own event is present and references the snapshot's own fingerprint.
  const snapshotEvent = snapshot.auditEvents.find((e) => e.eventType === "governance_snapshot_generated");
  assert.ok(snapshotEvent);
  assert.equal(snapshotEvent.relatedEntityId, snapshot.fingerprint);
});

test("smoke test: generateConstitutionDraft: false skips the constitution stage but nothing else", () => {
  const result = generatePlaybookGovernanceSnapshot(baseContext({ hasClientSignoff: false }), { generateConstitutionDraft: false });
  assert.equal(result.ok, true);
  assert.equal(result.data.constitutionDraft, null);
  assert.ok(!result.data.auditEvents.some((e) => e.eventType === "project_constitution_draft_generated"));
  assert.ok(result.data.closureBillingAssessment, "the rest of the chain must still run");
});

// ─── Demo scenario A: pending reception + billing blocker ─────────────────────

test("scenario A generates a recommendation, communication draft, operational draft, billing blocker, and audit events", () => {
  const result = generateDemoGovernanceSnapshot("pending_reception_billing_blocker");
  assert.equal(result.ok, true);
  const snapshot = result.data;

  assert.ok(snapshot.recommendations.length > 0);
  assert.ok(snapshot.communicationDrafts.length > 0);
  assert.ok(
    snapshot.communicationDrafts.some((d) => d.templateId === "reception_request" || d.templateId === "billing_enablement_follow_up"),
    "scenario A must recommend reception_request or billing_enablement_follow_up",
  );
  assert.ok(snapshot.operationalDrafts.some((d) => d.type === "dependency"), "scenario A must generate at least a dependency operational draft");
  assert.ok(snapshot.closureBillingAssessment.billingBlockers.some((b) => b.type === "missing_reception"));
  assert.ok(snapshot.auditEvents.length > 0);
  assert.equal(snapshot.closureBillingAssessment.readyForClosure, false);
  assert.equal(snapshot.closureBillingAssessment.readyForBilling, false);
});

// ─── Demo scenario B: security hardening requiring client validation ──────────

test("scenario B surfaces the missing_validation blocker with a concrete next action", () => {
  const result = generateDemoGovernanceSnapshot("security_hardening_client_validation");
  assert.equal(result.ok, true);
  const snapshot = result.data;
  assert.equal(snapshot.closureBillingAssessment.readyForClosure, false);
  assert.ok(snapshot.closureBillingAssessment.billingBlockers.some((b) => b.type === "missing_validation"));
  assert.ok(
    snapshot.communicationDrafts.some((d) => d.templateId === "decision_request" || d.templateId === "information_request"),
    "scenario B must recommend decision_request or information_request",
  );
  assert.ok(
    snapshot.nextBestActions.some((a) => a.type === "request_client_validation"),
    "the missing_validation blocker must no longer be left with an empty nextBestActions list",
  );
});

// ─── Demo scenario C: web/software with UAT/evidence pending ──────────────────

test("scenario C surfaces missing evidence and a client dependency, never ready", () => {
  const result = generateDemoGovernanceSnapshot("web_software_uat_evidence_pending");
  assert.equal(result.ok, true);
  const snapshot = result.data;
  assert.ok(snapshot.communicationDrafts.some((d) => d.templateId === "information_request"));
  assert.ok(snapshot.operationalDrafts.some((d) => d.type === "dependency" && d.dependencyType === "client"));
  assert.equal(snapshot.closureBillingAssessment.readyForClosure, false);
  assert.equal(snapshot.closureBillingAssessment.readyForBilling, false);
  assert.ok(
    snapshot.closureBillingAssessment.closureBlockers.some((b) => b.type === "missing_evidence"),
    "scenario C must surface a missing_evidence blocker from hasTechnicalEvidence=false",
  );
});

// ─── Demo scenario D: ready for billing, but never invoiced/closed ────────────

test("scenario D reaches readyForBilling/readyForClosure true without ever invoicing or closing", () => {
  const result = generateDemoGovernanceSnapshot("ready_for_billing");
  assert.equal(result.ok, true);
  const snapshot = result.data;
  assert.equal(snapshot.closureBillingAssessment.readyForBilling, true);
  assert.equal(snapshot.closureBillingAssessment.readyForClosure, true);
  assert.ok(snapshot.nextBestActions.some((na) => na.type === "start_internal_billing_process"));
  assert.ok(snapshot.nextBestActions.some((na) => na.type === "start_administrative_closure"));
  assert.ok(!("invoiced" in snapshot.closureBillingAssessment), "no invoiced field must ever exist on the assessment");
  assert.ok(!("closed" in snapshot.closureBillingAssessment), "no closed field must ever exist on the assessment");
  // Every one of D's suggested next actions is still approval-gated — readiness never auto-executes.
  assert.ok(snapshot.nextBestActions.every((a) => a.approvalRequired), "a ready-for-billing snapshot must never suggest an unapproved action");
});

test("even a ready-for-billing snapshot flags its sensitive next actions in approvalRequiredSummary", () => {
  const result = generateDemoGovernanceSnapshot("ready_for_billing");
  assert.ok(result.data.approvalRequiredSummary.length > 0, "even a ready-for-billing snapshot must flag approval-required next actions");
});

// ─── Roll-ups: dedup, approval detection ───────────────────────────────────────

test("missingEvidenceSummary deduplicates real fact keys across every stage", () => {
  const result = generateDemoGovernanceSnapshot("web_software_uat_evidence_pending");
  const summary = result.data.missingEvidenceSummary;
  assert.equal(new Set(summary).size, summary.length, "missingEvidenceSummary must contain no duplicate entries");
  assert.ok(summary.length > 0, "this scenario has genuinely unknown facts to report");
});

test("approvalRequiredSummary detects sensitive recommendations, drafts, blockers, and next actions", () => {
  const result = generateDemoGovernanceSnapshot("pending_reception_billing_blocker");
  const summary = result.data.approvalRequiredSummary;
  assert.ok(summary.length > 0);
  const entityTypes = new Set(summary.map((item) => item.relatedEntityType));
  // At least the closure/billing blocker and next-action paths must appear for this scenario.
  assert.ok(entityTypes.has("closure_billing_blocker") || entityTypes.has("closure_billing_next_action"));
  for (const item of summary) {
    assert.ok(item.title.length > 0);
    assert.ok(item.reason.length > 0);
  }
});

// ─── Never invents anything, and never emits a side effect ─────────────────────

test("snapshot never emits a side effect: no persistence, no send, no execution anywhere in the result", () => {
  const result = generateDemoGovernanceSnapshot("pending_reception_billing_blocker");
  const snapshot = result.data;
  assert.ok(snapshot.communicationDrafts.every((d) => d.status === "draft"), "every communication draft must start at 'draft', never sent");
  assert.ok(snapshot.operationalDrafts.every((d) => d.status === "draft"), "every operational draft must start at 'draft', never converted");
  assert.equal(snapshot.closureBillingAssessment.reviewStatus, "draft");
  assert.ok(snapshot.recommendations.every((r) => r.status === "new"), "every recommendation must start at 'new', never auto-executed");
});

test("communication drafts never invent recipients: unresolved ones stay empty and surface in missingInputs", () => {
  const result = generateDemoGovernanceSnapshot("pending_reception_billing_blocker");
  for (const draft of result.data.communicationDrafts) {
    assert.deepEqual(draft.recipients, [], "demo scenarios never supply a communicationProjectContext, so recipients must stay empty");
    assert.ok(draft.missingInputs.includes("recipients"));
  }
});

test("operational drafts never invent owner/dueDate: unresolved ones stay null and surface in missingInputs", () => {
  const result = generateDemoGovernanceSnapshot("pending_reception_billing_blocker");
  for (const draft of result.data.operationalDrafts) {
    assert.equal(draft.owner, null, "demo scenarios never supply an operationalProjectContext, so owner must stay null");
    assert.equal(draft.dueDate, null);
  }
});

test("closure/billing never invents evidence: every blocker's evidenceStatus matches its underlying fact", () => {
  const result = generateDemoGovernanceSnapshot("pending_reception_billing_blocker");
  const assessment = result.data.closureBillingAssessment;
  // pending_reception_billing_blocker sets hasClientSignoff explicitly to false -> confirmed missing.
  const receptionBlocker = assessment.billingBlockers.find((b) => b.type === "missing_reception");
  assert.ok(receptionBlocker);
  assert.equal(receptionBlocker.evidenceStatus, "missing");
  // Every blocker's evidenceStatus must be one of exactly the two governed values — never fabricated.
  for (const blocker of [...assessment.closureBlockers, ...assessment.billingBlockers]) {
    assert.ok(["missing", "requires_validation"].includes(blocker.evidenceStatus));
  }
});

test("audit events are deterministic: re-running the same scenario reproduces identical fingerprints", () => {
  const first = generateDemoGovernanceSnapshot("pending_reception_billing_blocker");
  const second = generateDemoGovernanceSnapshot("pending_reception_billing_blocker");
  assert.deepEqual(
    first.data.auditEvents.map((e) => e.fingerprint).sort(),
    second.data.auditEvents.map((e) => e.fingerprint).sort(),
  );
  assert.equal(first.data.fingerprint, second.data.fingerprint, "the whole snapshot must be idempotent on identical input");
});

test("auditEvents is deduplicated by fingerprint", () => {
  const result = generateDemoGovernanceSnapshot("pending_reception_billing_blocker");
  const fingerprints = result.data.auditEvents.map((e) => e.fingerprint);
  assert.equal(new Set(fingerprints).size, fingerprints.length);
});

test("every declared demo scenario runs successfully", () => {
  for (const scenarioId of Object.keys(PLAYBOOK_DEMO_SCENARIOS)) {
    const result = generateDemoGovernanceSnapshot(scenarioId);
    assert.equal(result.ok, true, `scenario '${scenarioId}' must generate successfully`);
  }
  assert.equal(Object.keys(PLAYBOOK_DEMO_SCENARIOS).length, 4);
});

test("explainPlaybookGovernanceSnapshot states nothing executed automatically", () => {
  const result = generateDemoGovernanceSnapshot("pending_reception_billing_blocker");
  const explanation = explainPlaybookGovernanceSnapshot(result.data);
  assert.match(explanation.narrative, /no se ejecut[oó]|no se env[ií]|no se aprob[oó]/i);
  assert.ok(explanation.rulesActivated.length > 0);
  assert.ok(explanation.recommendationsGenerated.length > 0);
});
