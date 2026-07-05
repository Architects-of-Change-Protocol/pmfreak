import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  createPlaybookAuditEvent,
  auditRulesEvaluation,
  auditRecommendationGenerated,
  auditRecommendationStateChanged,
  dedupePlaybookAuditEvents,
  playbookAuditEventToPlatformEventInput,
  evaluatePlaybookRules,
  generatePlaybookRecommendations,
  SEED_DELIVERY_PLAYBOOK,
} from "../src/lib/playbook-engine/index.ts";

const engine = fs.readFileSync("src/lib/playbook-engine/playbook-audit-engine.ts", "utf8");
const types = fs.readFileSync("src/lib/playbook-engine/playbook-audit-types.ts", "utf8");
const mappers = fs.readFileSync("src/lib/playbook-engine/playbook-audit-mappers.ts", "utf8");
const indexFile = fs.readFileSync("src/lib/playbook-engine/index.ts", "utf8");

// ─── Exports (static) ───────────────────────────────────────────────────────────

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

// ─── Runtime behavior (direct import) ──────────────────────────────────────────

const workspaceId = "00000000-0000-0000-0000-000000000002";
const projectId = "00000000-0000-0000-0000-000000000001";

function context(overrides = {}) {
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
    ...overrides,
  };
}

test("the generic constructor validates required fields", () => {
  const result = createPlaybookAuditEvent({
    workspaceId: "",
    projectId,
    eventType: "playbook_rules_evaluated",
    actorType: "system",
    relatedEntityType: "rules_evaluation",
    relatedEntityId: "x",
    summary: "test",
  });
  assert.equal(result.ok, false);
  assert.equal(result.failureClass, "validation_failed");
});

test("the generic constructor succeeds with all required fields present", () => {
  const result = createPlaybookAuditEvent({
    workspaceId,
    projectId,
    eventType: "playbook_rules_evaluated",
    actorType: "system",
    relatedEntityType: "rules_evaluation",
    relatedEntityId: "seed-delivery-playbook-v1@1",
    summary: "test",
  });
  assert.equal(result.ok, true);
});

test("ids/fingerprints are deterministic for identical input", () => {
  const evaluations = evaluatePlaybookRules(SEED_DELIVERY_PLAYBOOK, context());
  const eventA = auditRulesEvaluation(context(), SEED_DELIVERY_PLAYBOOK, evaluations);
  const eventB = auditRulesEvaluation(context(), SEED_DELIVERY_PLAYBOOK, evaluations);
  assert.equal(eventA.id, eventB.id);
  assert.equal(eventA.fingerprint, eventB.fingerprint);
});

test("audit event carries projectId, relatedEntityType, relatedEntityId", () => {
  const evaluations = evaluatePlaybookRules(SEED_DELIVERY_PLAYBOOK, context());
  const event = auditRulesEvaluation(context(), SEED_DELIVERY_PLAYBOOK, evaluations);
  assert.equal(event.projectId, projectId);
  assert.equal(event.relatedEntityType, "rules_evaluation");
  assert.ok(event.relatedEntityId.length > 0);
});

test("auditRecommendationGenerated ties back to the originating recommendation", () => {
  const result = generatePlaybookRecommendations(context(), SEED_DELIVERY_PLAYBOOK);
  assert.equal(result.ok, true);
  const recommendation = result.data.recommendations[0];
  const event = auditRecommendationGenerated(recommendation);
  assert.equal(event.relatedEntityType, "recommendation");
  assert.equal(event.relatedEntityId, recommendation.fingerprint);
  assert.equal(event.approvalRequired, recommendation.approvalRequired);
});

test("auditRecommendationStateChanged produces distinct ids per transition, identical ids on replay", () => {
  const result = generatePlaybookRecommendations(context(), SEED_DELIVERY_PLAYBOOK);
  const recommendation = result.data.recommendations[0];
  const viewedEvent = auditRecommendationStateChanged(recommendation, "new", "viewed");
  const viewedEventAgain = auditRecommendationStateChanged(recommendation, "new", "viewed");
  const dismissedEvent = auditRecommendationStateChanged(recommendation, "viewed", "dismissed");
  assert.equal(viewedEvent.id, viewedEventAgain.id, "replaying the same transition must audit identically");
  assert.notEqual(viewedEvent.id, dismissedEvent.id, "different transitions must get distinct audit ids");
});

test("dedupePlaybookAuditEvents keeps only one event per fingerprint", () => {
  const evaluations = evaluatePlaybookRules(SEED_DELIVERY_PLAYBOOK, context());
  const eventA = auditRulesEvaluation(context(), SEED_DELIVERY_PLAYBOOK, evaluations);
  const eventB = auditRulesEvaluation(context(), SEED_DELIVERY_PLAYBOOK, evaluations);
  const recResult = generatePlaybookRecommendations(context(), SEED_DELIVERY_PLAYBOOK);
  const recEvent = auditRecommendationGenerated(recResult.data.recommendations[0]);
  const deduped = dedupePlaybookAuditEvents([eventA, eventB, recEvent]);
  assert.equal(deduped.length, 2);
});

test("the platform-events mapper is pure and structurally valid", () => {
  const evaluations = evaluatePlaybookRules(SEED_DELIVERY_PLAYBOOK, context());
  const event = auditRulesEvaluation(context(), SEED_DELIVERY_PLAYBOOK, evaluations);
  const mapped = playbookAuditEventToPlatformEventInput(event);
  assert.equal(mapped.workspaceId, workspaceId);
  assert.equal(mapped.projectId, projectId);
  assert.equal(mapped.eventCategory, "governance");
  assert.ok(mapped.eventType.startsWith("PLAYBOOK_"));
  assert.ok(!mapped.eventType.startsWith("PLAYBOOK_PLAYBOOK_"), "event type must not be double-prefixed");
  assert.equal(mapped.learningEligible, false);
  assert.equal(mapped.rawReferenceTable, null);
  assert.equal(mapped.rawReferenceId, null);
});

test("recommendation lifecycle events map to the 'recommendation' platform-events category", () => {
  const result = generatePlaybookRecommendations(context(), SEED_DELIVERY_PLAYBOOK);
  const event = auditRecommendationGenerated(result.data.recommendations[0]);
  const mapped = playbookAuditEventToPlatformEventInput(event);
  assert.equal(mapped.eventCategory, "recommendation");
});
