import test from "node:test";
import assert from "node:assert/strict";

import { runConversationalBrainGateway } from "../src/lib/playbook-engine/conversation/gateway/conversationalBrainGateway.ts";
import { PLAYBOOK_DEMO_SCENARIOS } from "../src/lib/playbook-engine/demo-scenarios.ts";

// ─── Open-ended PM advice never requires project context ──────────────────────

test("open-ended PM advice produces useful guidance without any project context", () => {
  const result = runConversationalBrainGateway({ message: "¿Qué hago si el cliente no responde?" });
  assert.equal(result.intent, "general_pm_advice");
  assert.equal(result.route, "general_pm_advisor");
  assert.deepEqual(result.missingContext, []);
  assert.ok(result.response.length > 0);
  assert.doesNotMatch(result.response, /no tengo (?:suficiente )?contexto/i);
});

test("client-not-responding advice flags approval since it recommends a follow-up email/escalation", () => {
  const result = runConversationalBrainGateway({ message: "¿Qué hago si el cliente no responde?" });
  assert.equal(result.requiresApproval, true);
});

// ─── Informal blocked-project phrasing still gets useful guidance ─────────────

test("informal blocked-project complaint is detected and answered usefully even with no active project", () => {
  const result = runConversationalBrainGateway({ message: "Mae este proyecto está pegado y nadie responde." });
  assert.equal(result.intent, "project_status_question");
  assert.equal(result.route, "project_status_handler");
  assert.ok(result.response.length > 0);
  assert.ok(result.missingContext.includes("project"));
});

// ─── Project-specific questions use active project context when available ────

test("project status question uses real evidence when an active project with facts is supplied", () => {
  const scenario = PLAYBOOK_DEMO_SCENARIOS.pending_reception_billing_blocker;
  const result = runConversationalBrainGateway({
    message: "¿Qué está bloqueando este proyecto?",
    activeProjectId: scenario.context.projectId,
    activeProjectName: scenario.title,
    projectState: scenario.context,
  });
  assert.equal(result.route, "project_status_handler");
  assert.equal(result.mode, "project_specific_analysis");
  assert.ok(!result.missingContext.includes("project"));
  assert.match(result.response, /sign ?off|recepci/i);
});

// ─── Missing context is handled gracefully (never a bare "insufficient context") ──

test("recommendation request with no project still returns general recommendations, not a bare refusal", () => {
  const result = runConversationalBrainGateway({ message: "¿Qué recomiendas?" });
  assert.equal(result.route, "recommendation_handler");
  assert.equal(result.mode, "general_guidance");
  assert.ok(result.recommendedNextSteps.length > 0);
  assert.doesNotMatch(result.response, /^no tengo contexto/i);
});

// ─── Communication drafts and task/action requests always require approval ───

test("communication draft requests always require approval, with or without project context", () => {
  const result = runConversationalBrainGateway({ message: "Redactame un correo de seguimiento." });
  assert.equal(result.route, "communications_handler");
  assert.equal(result.requiresApproval, true);
  assert.ok(result.response.length > 0);
});

test("task/action requests always require approval", () => {
  const result = runConversationalBrainGateway({ message: "Crea una tarea para dar seguimiento." });
  assert.equal(result.route, "task_action_handler");
  assert.equal(result.requiresApproval, true);
});

// ─── Billing/closure readiness is never asserted without evidence ─────────────

test("billing question without any project context never asserts readiness", () => {
  const result = runConversationalBrainGateway({ message: "¿Ya podemos facturar?" });
  assert.equal(result.route, "closure_billing_handler");
  assert.doesNotMatch(result.response, /esta[a-z]* list[oa] para facturar/i);
  assert.equal(result.requiresApproval, true);
});

test("billing question with evidence of a pending client sign-off reports not-ready, never a false positive", () => {
  const scenario = PLAYBOOK_DEMO_SCENARIOS.pending_reception_billing_blocker;
  const result = runConversationalBrainGateway({
    message: "¿Ya podemos facturar?",
    activeProjectId: scenario.context.projectId,
    projectState: scenario.context,
  });
  assert.equal(result.route, "closure_billing_handler");
  assert.doesNotMatch(result.response, /completo — pero la decisión/);
});

test("billing question never claims readiness even for the 'ready' demo fixture without a validated constitution", () => {
  // `evaluateClosureAndBilling` also needs a Project Constitution to confirm acceptance/billing
  // rules are validated (see closure-billing-engine tests) — the conversational gateway has no
  // constitution input in this sprint, so it correctly never claims readiness on facts alone,
  // even for a project whose ProjectContextFacts otherwise looks fully ready.
  const scenario = PLAYBOOK_DEMO_SCENARIOS.ready_for_billing;
  const result = runConversationalBrainGateway({
    message: "¿Ya podemos facturar?",
    activeProjectId: scenario.context.projectId,
    projectState: scenario.context,
  });
  assert.equal(result.route, "closure_billing_handler");
  assert.equal(result.requiresApproval, true);
  assert.doesNotMatch(result.response, /completo — pero la decisión/);
});

// ─── Governance questions emphasize evidence and never claim clean coverage without data ──

test("governance question without project context never claims evidence is sufficient", () => {
  const result = runConversationalBrainGateway({ message: "¿Tenemos evidencia suficiente para cerrar?" });
  assert.equal(result.route, "governance_handler");
  assert.doesNotMatch(result.response, /^la evidencia/i);
});

// ─── Audit questions explain traceability, never invent a justification ───────

test("audit question without project context explains methodology instead of inventing a specific reason", () => {
  const result = runConversationalBrainGateway({ message: "¿Por qué recomendaste escalar?" });
  assert.equal(result.route, "audit_handler");
  assert.ok(result.response.length > 0);
});

// ─── Unsupported questions are handled politely ───────────────────────────────

test("unsupported trivia is redirected politely toward PMFreak's domain", () => {
  const result = runConversationalBrainGateway({ message: "¿Cuál es la capital de Francia?" });
  assert.equal(result.route, "unsupported_handler");
  assert.equal(result.mode, "unsupported");
  assert.equal(result.requiresApproval, false);
  assert.match(result.response, /PMFreak/);
});

// ─── Overall result shape ──────────────────────────────────────────────────────

test("every gateway result has the full documented shape", () => {
  const result = runConversationalBrainGateway({ message: "¿Qué riesgos ves?" });
  for (const key of [
    "intent",
    "route",
    "mode",
    "response",
    "summary",
    "recommendedNextSteps",
    "missingContext",
    "confidence",
    "requiresApproval",
    "auditRelevant",
    "diagnostics",
  ]) {
    assert.ok(key in result, `result must have key '${key}'`);
  }
  assert.ok("intentSignals" in result.diagnostics);
  assert.ok("routingReason" in result.diagnostics);
  assert.ok("contextConfidence" in result.diagnostics);
  assert.ok(result.confidence >= 0 && result.confidence <= 100);
});
