import test from "node:test";
import assert from "node:assert/strict";

import { routeConversation } from "../src/lib/playbook-engine/conversation/router/brainRouter.ts";

function classification(intent, overrides = {}) {
  return { intent, confidence: 80, signals: [], language: "es", ...overrides };
}

test("routes every direct intent to its documented handler", () => {
  const expectations = {
    general_pm_advice: "general_pm_advisor",
    project_status_question: "project_status_handler",
    recommendation_request: "recommendation_handler",
    risk_analysis: "risk_handler",
    communication_draft: "communications_handler",
    closure_question: "closure_billing_handler",
    billing_question: "closure_billing_handler",
    governance_question: "governance_handler",
    audit_question: "audit_handler",
    task_or_action_request: "task_action_handler",
  };

  for (const [intent, expectedRoute] of Object.entries(expectations)) {
    const decision = routeConversation(classification(intent), "mensaje de prueba");
    assert.equal(decision.route, expectedRoute, `intent ${intent} should route to ${expectedRoute}`);
    assert.equal(decision.intent, intent);
  }
});

test("routes clarification to the general PM advisor rather than bouncing it", () => {
  const decision = routeConversation(classification("clarification"), "ayuda");
  assert.equal(decision.route, "general_pm_advisor");
});

test("routes unsupported straight to the unsupported handler regardless of message content", () => {
  const decision = routeConversation(classification("unsupported"), "¿cuál es la capital de Francia?");
  assert.equal(decision.route, "unsupported_handler");
});

test("routes unknown with PM-domain vocabulary to the general PM advisor as a safer fallback", () => {
  const decision = routeConversation(classification("unknown", { confidence: 0 }), "no se que hacer con este proyecto");
  assert.equal(decision.route, "general_pm_advisor");
});

test("routes unknown with no PM-domain vocabulary to the unsupported handler", () => {
  const decision = routeConversation(classification("unknown", { confidence: 0 }), "cuentame un chiste sobre gatos");
  assert.equal(decision.route, "unsupported_handler");
});
