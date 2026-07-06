import test from "node:test";
import assert from "node:assert/strict";

import { resolveConversationContext } from "../src/lib/playbook-engine/conversation/context/contextResolver.ts";

const workspaceId = "00000000-0000-0000-0000-000000000010";
const projectId = "00000000-0000-0000-0000-000000000011";

function fullFacts(overrides = {}) {
  return {
    projectId,
    workspaceId,
    phase: "cierre",
    hasApprovedCharter: null,
    hasApprovedConstitution: true,
    hasScopeBaseline: null,
    hasWbs: null,
    hasScheduleBaseline: null,
    hasBudgetBaseline: null,
    hasRiskRegister: null,
    hasStakeholderMap: null,
    hasCommunicationsPlan: null,
    hasClosureChecklistStarted: true,
    hasFinalInvoiceIssued: false,
    hasClientSignoff: false,
    openCriticalRisks: 0,
    openHighRisks: null,
    openIssues: null,
    overdueTasks: null,
    daysSinceLastStatusUpdate: null,
    scheduleVarianceDays: null,
    budgetVariancePercent: null,
    hasDeliverablesCompleted: true,
    hasTechnicalEvidence: true,
    hasClientValidation: true,
    hasClosureDecisionsMade: true,
    hasFinalReportDelivered: null,
    requiresFinalReport: false,
    hasPurchaseOrder: null,
    requiresPurchaseOrder: false,
    hasAdministrativeDocumentationComplete: null,
    requiresAdministrativeDocumentation: false,
    hasInternalApprovalForBilling: true,
    openCriticalDependencies: 0,
    openBlockingIssues: 0,
    metadata: {},
    ...overrides,
  };
}

test("general_pm_advice never reports missing context, even with nothing supplied", () => {
  const resolution = resolveConversationContext("general_pm_advice", { message: "¿qué hago?" });
  assert.deepEqual(resolution.missingContext, []);
  assert.equal(resolution.confidence, 100);
  assert.equal(resolution.project.available, false);
});

test("project-dependent intents report 'project' missing when no active project is given", () => {
  const resolution = resolveConversationContext("project_status_question", { message: "¿qué está bloqueando esto?" });
  assert.equal(resolution.project.available, false);
  assert.ok(resolution.missingContext.includes("project"));
  assert.ok(resolution.confidence < 100);
});

test("an active project id alone (no structured facts) resolves as available but with no facts/snapshot", () => {
  const resolution = resolveConversationContext("project_status_question", {
    message: "¿cómo va el proyecto?",
    activeProjectId: projectId,
    activeProjectName: "Proyecto Demo",
  });
  assert.equal(resolution.project.available, true);
  assert.equal(resolution.project.facts, null);
  assert.equal(resolution.project.governanceSnapshot, null);
  assert.ok(!resolution.missingContext.includes("project"));
});

test("a genuine ProjectContextFacts-shaped projectState resolves facts and a governance snapshot", () => {
  const resolution = resolveConversationContext("closure_question", {
    message: "¿podemos cerrar?",
    activeProjectId: projectId,
    activeProjectName: "Proyecto Demo",
    projectState: fullFacts(),
  });
  assert.equal(resolution.project.available, true);
  assert.ok(resolution.project.facts);
  assert.ok(resolution.project.governanceSnapshot);
  assert.equal(resolution.project.governanceSnapshot.projectId, projectId);
});

test("an unrelated object passed as projectState is never guessed into ProjectContextFacts", () => {
  const resolution = resolveConversationContext("closure_question", {
    message: "¿podemos cerrar?",
    activeProjectId: projectId,
    projectState: { some: "unrelated", shape: true },
  });
  assert.equal(resolution.project.facts, null);
  assert.equal(resolution.project.governanceSnapshot, null);
});

test("communication_draft requires project, stakeholder, and requested_output when nothing is known", () => {
  const resolution = resolveConversationContext("communication_draft", { message: "escribime algo" });
  assert.ok(resolution.missingContext.includes("project"));
  assert.ok(resolution.missingContext.includes("stakeholder"));
  assert.ok(resolution.missingContext.includes("requested_output"));
});

test("communication_draft does not report requested_output missing when the message already names a specific draft", () => {
  const resolution = resolveConversationContext("communication_draft", { message: "Redactame un correo de seguimiento." });
  assert.ok(!resolution.missingContext.includes("requested_output"));
});

test("communication_draft does not report stakeholder missing when metadata supplies one", () => {
  const resolution = resolveConversationContext("communication_draft", {
    message: "escribime algo",
    metadata: { stakeholderName: "Cliente ACME" },
  });
  assert.ok(!resolution.missingContext.includes("stakeholder"));
});

test("billing_question reports billing_status and acceptance_status missing without facts", () => {
  const resolution = resolveConversationContext("billing_question", {
    message: "¿ya podemos facturar?",
    activeProjectId: projectId,
  });
  assert.ok(resolution.missingContext.includes("billing_status"));
  assert.ok(resolution.missingContext.includes("acceptance_status"));
});

test("governance_question only requires evidence, not a project", () => {
  const resolution = resolveConversationContext("governance_question", { message: "¿tenemos evidencia suficiente?" });
  assert.deepEqual(resolution.missingContext, ["risk_evidence"]);
});
