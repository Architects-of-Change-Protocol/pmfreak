import test from "node:test";
import assert from "node:assert/strict";

import { classifyConversationIntent } from "../src/lib/conversational-brain/intent-classifier.ts";

const baseInput = (message, overrides = {}) => ({
  workspaceId: "ws_1",
  userId: "user_1",
  message,
  ...overrides,
});

const NOW = () => "2026-07-06T00:00:00.000Z";

// ─── Core intent family + type classification ─────────────────────────────────

test("qué falta para facturar -> closure_billing / billing_blocker_check", () => {
  const { intent } = classifyConversationIntent(baseInput("¿Qué falta para facturar?"));
  assert.equal(intent.intentFamily, "closure_billing");
  assert.equal(intent.intentType, "billing_blocker_check");
});

test("estamos listos para cobrar -> closure_billing / billing_readiness_check", () => {
  const { intent } = classifyConversationIntent(baseInput("Estamos listos para cobrar?"));
  assert.equal(intent.intentFamily, "closure_billing");
  assert.equal(intent.intentType, "billing_readiness_check");
});

test("redactame un correo -> communication_draft / email_draft_request", () => {
  const { intent } = classifyConversationIntent(baseInput("Redactame un correo"));
  assert.equal(intent.intentFamily, "communication_draft");
  assert.equal(intent.intentType, "email_draft_request");
});

test("ayudame con seguimiento formal -> communication_draft / follow_up_draft_request", () => {
  const { intent } = classifyConversationIntent(baseInput("Ayudame con seguimiento formal"));
  assert.equal(intent.intentFamily, "communication_draft");
  assert.equal(intent.intentType, "follow_up_draft_request");
});

test("qué recomienda el playbook -> playbook_analysis", () => {
  const { intent } = classifyConversationIntent(baseInput("¿Qué recomienda el playbook?"));
  assert.equal(intent.intentFamily, "playbook_analysis");
});

test("cuál es la siguiente mejor acción -> playbook_analysis", () => {
  const { intent } = classifyConversationIntent(baseInput("¿Cuál es la siguiente mejor acción?"));
  assert.equal(intent.intentFamily, "playbook_analysis");
});

test("cómo va el proyecto -> project_status", () => {
  const { intent } = classifyConversationIntent(baseInput("¿Cómo va el proyecto?"));
  assert.equal(intent.intentFamily, "project_status");
});

test("dame estado de HMP -> project_status", () => {
  const { intent } = classifyConversationIntent(baseInput("Dame estado de HMP"));
  assert.equal(intent.intentFamily, "project_status");
});

test("creá una tarea -> task_action", () => {
  const { intent } = classifyConversationIntent(baseInput("Creá una tarea"));
  assert.equal(intent.intentFamily, "task_action");
});

test("convertí esto en tarea -> task_action", () => {
  const { intent } = classifyConversationIntent(baseInput("Convertí esto en tarea"));
  assert.equal(intent.intentFamily, "task_action");
});

test("qué riesgos hay -> risk_issue_dependency", () => {
  const { intent } = classifyConversationIntent(baseInput("¿Qué riesgos hay?"));
  assert.equal(intent.intentFamily, "risk_issue_dependency");
});

test("qué dependencias bloquean -> risk_issue_dependency", () => {
  const { intent } = classifyConversationIntent(baseInput("¿Qué dependencias bloquean?"));
  assert.equal(intent.intentFamily, "risk_issue_dependency");
});

test("qué decisión falta -> decision_support", () => {
  const { intent } = classifyConversationIntent(baseInput("¿Qué decisión falta?"));
  assert.equal(intent.intentFamily, "decision_support");
});

test("por qué recomendaste esto -> governance_audit", () => {
  const { intent } = classifyConversationIntent(baseInput("¿Por qué recomendaste esto?"));
  assert.equal(intent.intentFamily, "governance_audit");
});

test("qué evidencia usaste -> governance_audit", () => {
  const { intent } = classifyConversationIntent(baseInput("¿Qué evidencia usaste?"));
  assert.equal(intent.intentFamily, "governance_audit");
});

test("qué hago con este cliente -> general_pm_advice", () => {
  const { intent } = classifyConversationIntent(baseInput("¿Qué hago con este cliente?"));
  assert.equal(intent.intentFamily, "general_pm_advice");
});

// ─── Flags ─────────────────────────────────────────────────────────────────────

test("task_action flags mayRequireApproval and isActionRequest", () => {
  const { intent } = classifyConversationIntent(baseInput("Creá una tarea"));
  assert.equal(intent.mayRequireApproval, true);
  assert.equal(intent.isActionRequest, true);
});

test("communication_draft flags isExternalCommunicationRequest", () => {
  const { intent } = classifyConversationIntent(baseInput("Redactame un correo"));
  assert.equal(intent.isExternalCommunicationRequest, true);
});

test("closure_billing requires project context", () => {
  const { intent } = classifyConversationIntent(baseInput("¿Ya podemos facturar?"));
  assert.equal(intent.requiresProjectContext, true);
});

test("project_status requires project context", () => {
  const { intent } = classifyConversationIntent(baseInput("¿Cómo va el proyecto?"));
  assert.equal(intent.requiresProjectContext, true);
});

test("general_pm_advice does not require project context", () => {
  const { intent } = classifyConversationIntent(baseInput("¿Qué hago con este cliente?"));
  assert.equal(intent.requiresProjectContext, false);
});

test("governance_audit is read only", () => {
  const { intent } = classifyConversationIntent(baseInput("¿Qué evidencia usaste?"));
  assert.equal(intent.isReadOnly, true);
});

// ─── Missing clarifications ─────────────────────────────────────────────────────

test("closure_billing without projectId adds missing_project clarification", () => {
  const { intent } = classifyConversationIntent(baseInput("¿Ya podemos facturar?"));
  assert.ok(intent.missingClarifications.some((c) => c.type === "missing_project"));
});

test("project_status without projectId adds missing_project clarification", () => {
  const { intent } = classifyConversationIntent(baseInput("¿Cómo va el proyecto?"));
  assert.ok(intent.missingClarifications.some((c) => c.type === "missing_project"));
});

test("project_status with projectId does not add missing_project clarification", () => {
  const { intent } = classifyConversationIntent(baseInput("¿Cómo va el proyecto?", { projectId: "proj_1" }));
  assert.ok(!intent.missingClarifications.some((c) => c.type === "missing_project"));
});

test("general_pm_advice without projectId does not add missing_project clarification", () => {
  const { intent } = classifyConversationIntent(baseInput("¿Qué hago con este cliente?"));
  assert.ok(!intent.missingClarifications.some((c) => c.type === "missing_project"));
});

// ─── Ambiguity ──────────────────────────────────────────────────────────────────

test("ayuda -> needs_clarification or unknown", () => {
  const { intent } = classifyConversationIntent(baseInput("ayuda"));
  assert.ok(["needs_clarification", "unknown"].includes(intent.intentFamily));
});

test("revisá esto -> needs_clarification", () => {
  const { intent } = classifyConversationIntent(baseInput("revisá esto"));
  assert.equal(intent.intentFamily, "needs_clarification");
});

test("qué hago -> general_pm_advice with medium/low confidence", () => {
  const { intent } = classifyConversationIntent(baseInput("¿Qué hago?"));
  assert.equal(intent.intentFamily, "general_pm_advice");
  assert.ok(["medium", "low"].includes(intent.confidence));
});

// ─── Determinism / now() injection ─────────────────────────────────────────────

test("createdAt uses the injected now() for deterministic tests", () => {
  const { intent } = classifyConversationIntent(baseInput("¿Cómo va el proyecto?"), { now: NOW });
  assert.equal(intent.createdAt, "2026-07-06T00:00:00.000Z");
});

test("result includes candidateRoutes, detectedSignals, rationale, and score", () => {
  const { intent } = classifyConversationIntent(baseInput("Redactame un correo"));
  assert.ok(Array.isArray(intent.candidateRoutes) && intent.candidateRoutes.length > 0);
  assert.ok(Array.isArray(intent.detectedSignals) && intent.detectedSignals.length > 0);
  assert.equal(typeof intent.rationale, "string");
  assert.ok(intent.rationale.length > 0);
  assert.equal(typeof intent.score, "number");
});

// ─── Safety: pure module, no side effects ──────────────────────────────────────

test("module source never references DB/network/side-effect APIs", async () => {
  const fs = await import("node:fs");
  const files = [
    "../src/lib/conversational-brain/intent-classifier.ts",
    "../src/lib/conversational-brain/intent-classifier-types.ts",
    "../src/lib/conversational-brain/intent-patterns.ts",
    "../src/lib/conversational-brain/explain.ts",
    "../src/lib/conversational-brain/index.ts",
  ];
  const forbidden = [
    /from\s+["'][^"']*supabase[^"']*["']/i,
    /\bfetch\(/,
    /\bsendEmail\s*\(/i,
    /\bcreatePlatformEvent\s*\(/i,
    /from\s+["'][^"']*gmail[^"']*["']/i,
    /\bcreateTask\s*\(/i,
    /\bcreateRaidItem\s*\(/i,
  ];
  for (const relPath of files) {
    const content = fs.readFileSync(new URL(relPath, import.meta.url), "utf8");
    for (const re of forbidden) {
      assert.doesNotMatch(content, re, `${relPath} must not match ${re}`);
    }
  }
});
