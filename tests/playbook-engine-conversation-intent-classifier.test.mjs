import test from "node:test";
import assert from "node:assert/strict";

import { classifyConversationIntent } from "../src/lib/playbook-engine/conversation/classifier/intentClassifier.ts";
import { normalizeConversationText } from "../src/lib/playbook-engine/conversation/classifier/intentClassifier.rules.ts";

test("normalizeConversationText strips accents, inverted punctuation, and lowercases", () => {
  assert.equal(normalizeConversationText("¿Qué está bloqueando este Proyecto?"), "que esta bloqueando este proyecto?");
});

test("classifies open PM advice in informal Spanish", () => {
  const result = classifyConversationIntent("¿Qué hago si el cliente no responde?");
  assert.equal(result.intent, "general_pm_advice");
  assert.ok(result.confidence > 0);
  assert.ok(result.signals.length > 0);
});

test("classifies project status question about blockers", () => {
  const result = classifyConversationIntent("¿Qué está bloqueando este proyecto?");
  assert.equal(result.intent, "project_status_question");
});

test("classifies informal blocked-project complaint as project status question", () => {
  const result = classifyConversationIntent("Mae este proyecto está pegado y nadie responde.");
  assert.equal(result.intent, "project_status_question");
});

test("classifies recommendation requests", () => {
  const result = classifyConversationIntent("¿Qué recomiendas?");
  assert.equal(result.intent, "recommendation_request");
});

test("classifies risk analysis questions", () => {
  const result = classifyConversationIntent("¿Qué riesgos ves?");
  assert.equal(result.intent, "risk_analysis");
});

test("classifies communication draft requests", () => {
  const result = classifyConversationIntent("Redactame un correo de seguimiento.");
  assert.equal(result.intent, "communication_draft");
});

test("classifies closure questions", () => {
  const result = classifyConversationIntent("¿Podemos cerrar?");
  assert.equal(result.intent, "closure_question");
});

test("classifies billing questions", () => {
  const result = classifyConversationIntent("¿Ya podemos facturar?");
  assert.equal(result.intent, "billing_question");
});

test("classifies governance/evidence questions", () => {
  const result = classifyConversationIntent("¿Tenemos evidencia suficiente para cerrar?");
  assert.equal(result.intent, "governance_question");
});

test("classifies audit questions asking why something was recommended", () => {
  const result = classifyConversationIntent("¿Por qué recomendaste escalar?");
  assert.equal(result.intent, "audit_question");
});

test("audit_question ('recomendaste') never collides with recommendation_request ('recomiendas')", () => {
  const audit = classifyConversationIntent("¿Por qué recomendaste escalar?");
  const request = classifyConversationIntent("¿Qué recomiendas?");
  assert.equal(audit.intent, "audit_question");
  assert.equal(request.intent, "recommendation_request");
});

test("classifies task/action requests", () => {
  const result = classifyConversationIntent("Créame una tarea para el equipo.");
  assert.equal(result.intent, "task_or_action_request");
});

test("classifies clearly off-domain trivia as unsupported", () => {
  const result = classifyConversationIntent("¿Cuál es la capital de Francia?");
  assert.equal(result.intent, "unsupported");
});

test("unmatched, sufficiently long messages classify as unknown rather than being forced into a bucket", () => {
  const result = classifyConversationIntent("Lorem ipsum dolor sit amet consectetur adipiscing elit");
  assert.equal(result.intent, "unknown");
  assert.equal(result.confidence, 0);
});

test("very short ambiguous messages classify as clarification", () => {
  const result = classifyConversationIntent("ayuda");
  assert.equal(result.intent, "clarification");
});

test("supports English phrasing equivalents", () => {
  assert.equal(classifyConversationIntent("What should I do if the client is not responding?").intent, "general_pm_advice");
  assert.equal(classifyConversationIntent("What's blocking this project?").intent, "project_status_question");
  assert.equal(classifyConversationIntent("What do you recommend?").intent, "recommendation_request");
  assert.equal(classifyConversationIntent("Draft an email follow-up.").intent, "communication_draft");
  assert.equal(classifyConversationIntent("Can we invoice?").intent, "billing_question");
});
