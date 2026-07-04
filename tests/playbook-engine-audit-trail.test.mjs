import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const engine = fs.readFileSync("src/lib/playbook-engine/playbook-audit-engine.ts", "utf8");
const types = fs.readFileSync("src/lib/playbook-engine/playbook-audit-types.ts", "utf8");
const mappers = fs.readFileSync("src/lib/playbook-engine/playbook-audit-mappers.ts", "utf8");
const indexFile = fs.readFileSync("src/lib/playbook-engine/index.ts", "utf8");

// ─── Exports ──────────────────────────────────────────────────────────────────

test("playbook audit engine functions are exported from the module", () => {
  for (const fn of [
    "createPlaybookAuditEvent",
    "auditRulesEvaluation",
    "auditConstitutionDraftGenerated",
    "auditRecommendationGenerated",
    "auditCommunicationDraftGenerated",
    "auditOperationalDraftGenerated",
    "auditClosureBillingAssessmentGenerated",
    "auditGovernanceSnapshotGenerated",
    "dedupePlaybookAuditEvents",
  ]) {
    assert.match(indexFile, new RegExp(fn), `index.ts must re-export ${fn}`);
    assert.match(engine, new RegExp(`export function ${fn}`), `playbook-audit-engine.ts must define ${fn}`);
  }
});

test("playbook audit mapper is exported and never calls createPlatformEvent or touches Supabase", () => {
  assert.match(indexFile, /playbookAuditEventToPlatformEventInput/);
  assert.match(mappers, /export function playbookAuditEventToPlatformEventInput/);
  assert.doesNotMatch(mappers, /supabase\.|createPlatformEvent\(|\.insert\(/i, "mapper must never persist or emit anything");
});

test("core audit trail types are exported from the module", () => {
  for (const typeName of [
    "PlaybookAuditEvent",
    "PlaybookAuditEventType",
    "PlaybookAuditActorType",
    "PlaybookAuditRelatedEntityType",
    "PlaybookAuditSeverity",
    "PlaybookAuditExplanation",
  ]) {
    assert.match(indexFile, new RegExp(typeName), `index.ts must re-export ${typeName}`);
    assert.match(types, new RegExp(`export type ${typeName}`), `playbook-audit-types.ts must define ${typeName}`);
  }
});

test("every minimum event type from the Sprint 7 spec is declared", () => {
  const declaration = types.match(/export type PlaybookAuditEventType =[\s\S]*?;/)?.[0] ?? "";
  for (const eventType of [
    "playbook_rules_evaluated",
    "project_constitution_draft_generated",
    "recommendation_generated",
    "recommendation_state_changed",
    "communication_draft_generated",
    "communication_draft_state_changed",
    "operational_draft_generated",
    "operational_draft_state_changed",
    "closure_billing_assessment_generated",
    "closure_billing_blocker_detected",
    "closure_billing_next_action_recommended",
    "governance_snapshot_generated",
  ]) {
    assert.match(declaration, new RegExp(`"${eventType}"`), `PlaybookAuditEventType must include '${eventType}'`);
  }
});

test("the audit engine never persists or emits a real platform event by itself", () => {
  assert.doesNotMatch(engine, /supabase|createPlatformEvent\(|\.insert\(/i);
});

// ─── Runtime behavior probe ──────────────────────────────────────────────────

const runtimeProbe = String.raw`
import assert from "node:assert/strict";
import {
  createPlaybookAuditEvent,
  auditRulesEvaluation,
  auditRecommendationGenerated,
  dedupePlaybookAuditEvents,
  playbookAuditEventToPlatformEventInput,
  evaluatePlaybookRules,
  generatePlaybookRecommendations,
  SEED_DELIVERY_PLAYBOOK,
} from "./src/lib/playbook-engine/index.ts";

const workspaceId = "00000000-0000-0000-0000-000000000002";
const projectId = "00000000-0000-0000-0000-000000000001";

const context = {
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
  hasClientSignoff: false,
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

// 1. Generic constructor validates required fields.
const missingWorkspace = createPlaybookAuditEvent({
  workspaceId: "",
  projectId,
  eventType: "playbook_rules_evaluated",
  actorType: "system",
  relatedEntityType: "rules_evaluation",
  relatedEntityId: "x",
  summary: "test",
});
assert.equal(missingWorkspace.ok, false);
assert.equal(missingWorkspace.failureClass, "validation_failed");

const validEvent = createPlaybookAuditEvent({
  workspaceId,
  projectId,
  eventType: "playbook_rules_evaluated",
  actorType: "system",
  relatedEntityType: "rules_evaluation",
  relatedEntityId: "seed-delivery-playbook-v1@1",
  summary: "test",
});
assert.equal(validEvent.ok, true);

// 2. IDs/fingerprints are deterministic for identical input.
const evaluations = evaluatePlaybookRules(SEED_DELIVERY_PLAYBOOK, context);
const eventA = auditRulesEvaluation(context, SEED_DELIVERY_PLAYBOOK, evaluations);
const eventB = auditRulesEvaluation(context, SEED_DELIVERY_PLAYBOOK, evaluations);
assert.equal(eventA.id, eventB.id);
assert.equal(eventA.fingerprint, eventB.fingerprint);

// 3. Audit event carries projectId, relatedEntityType, relatedEntityId.
assert.equal(eventA.projectId, projectId);
assert.equal(eventA.relatedEntityType, "rules_evaluation");
assert.ok(eventA.relatedEntityId.length > 0);

// 4. auditRecommendationGenerated ties back to the originating recommendation.
const recsResult = generatePlaybookRecommendations(context, SEED_DELIVERY_PLAYBOOK);
assert.equal(recsResult.ok, true);
const recommendation = recsResult.data.recommendations[0];
const recEvent = auditRecommendationGenerated(recommendation);
assert.equal(recEvent.relatedEntityType, "recommendation");
assert.equal(recEvent.relatedEntityId, recommendation.fingerprint);
assert.equal(recEvent.approvalRequired, recommendation.approvalRequired);

// 5. Deduplication keeps only one event per fingerprint.
const deduped = dedupePlaybookAuditEvents([eventA, eventB, recEvent]);
assert.equal(deduped.length, 2);

// 6. The platform-events mapper is pure and structurally valid.
const mapped = playbookAuditEventToPlatformEventInput(eventA);
assert.equal(mapped.workspaceId, workspaceId);
assert.equal(mapped.projectId, projectId);
assert.equal(mapped.eventCategory, "governance");
assert.ok(mapped.eventType.startsWith("PLAYBOOK_"));
assert.equal(mapped.learningEligible, false);
assert.equal(mapped.rawReferenceTable, null);

const payload = { dedupedCount: deduped.length, mappedEventType: mapped.eventType };
console.log(JSON.stringify(payload));
`;

const runtime = JSON.parse(execFileSync("npx", ["tsx", "--eval", runtimeProbe], { encoding: "utf8" }).trim().split("\n").at(-1));

test("audit runtime probe: dedupePlaybookAuditEvents keeps one event per fingerprint", () => {
  assert.equal(runtime.dedupedCount, 2);
});

test("audit runtime probe: mapped platform event type is namespaced under PLAYBOOK_", () => {
  assert.ok(runtime.mappedEventType.startsWith("PLAYBOOK_"));
  assert.ok(!runtime.mappedEventType.startsWith("PLAYBOOK_PLAYBOOK_"), "event type must not be double-prefixed");
});
