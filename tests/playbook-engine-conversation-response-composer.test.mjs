import test from "node:test";
import assert from "node:assert/strict";

import { composeConversationalResponse } from "../src/lib/playbook-engine/conversation/composer/responseComposer.ts";

function baseArgs(overrides = {}) {
  const classification = { intent: "general_pm_advice", confidence: 80, signals: [], language: "es" };
  const resolution = {
    intent: "general_pm_advice",
    project: { available: false, projectId: null, projectName: null, facts: null, governanceSnapshot: null },
    missingContext: [],
    confidence: 100,
    reasoning: [],
  };
  const routing = { intent: "general_pm_advice", route: "general_pm_advisor", reason: "Direct route for intent 'general_pm_advice'." };
  const handlerResult = {
    mode: "general_guidance",
    headline: "Encabezado de prueba.",
    body: ["Cuerpo de prueba."],
    recommendedNextSteps: ["Haz esto.", "Luego esto otro."],
    missingContext: [],
    requiresApproval: false,
    auditRelevant: false,
    confidence: 70,
    sourced: false,
  };
  return { classification, resolution, routing, handlerResult, ...overrides };
}

test("composes response text from headline, body, next steps, and missing context", () => {
  const { classification, resolution, routing, handlerResult } = baseArgs({
    handlerResult: {
      mode: "general_guidance",
      headline: "Encabezado de prueba.",
      body: ["Cuerpo de prueba."],
      recommendedNextSteps: ["Haz esto."],
      missingContext: ["project"],
      requiresApproval: false,
      auditRelevant: false,
      confidence: 70,
      sourced: false,
    },
  });

  const result = composeConversationalResponse(classification, resolution, routing, handlerResult);

  assert.match(result.response, /Encabezado de prueba\./);
  assert.match(result.response, /Cuerpo de prueba\./);
  assert.match(result.response, /Haz esto\./);
  assert.match(result.response, /proyecto activo identificado/);
  assert.equal(result.summary, "Encabezado de prueba.");
});

test("passes through intent/route/mode and approval/audit flags unchanged", () => {
  const { classification, resolution, routing, handlerResult } = baseArgs({
    handlerResult: {
      mode: "draft",
      headline: "Borrador listo.",
      body: [],
      recommendedNextSteps: [],
      missingContext: [],
      requiresApproval: true,
      auditRelevant: true,
      confidence: 90,
      sourced: true,
    },
  });

  const result = composeConversationalResponse(classification, resolution, routing, handlerResult);

  assert.equal(result.intent, "general_pm_advice");
  assert.equal(result.route, "general_pm_advisor");
  assert.equal(result.mode, "draft");
  assert.equal(result.requiresApproval, true);
  assert.equal(result.auditRelevant, true);
});

test("blends classifier/context/handler confidence into a single 0-100 score", () => {
  const { classification, resolution, routing, handlerResult } = baseArgs();
  const result = composeConversationalResponse(classification, resolution, routing, handlerResult);
  assert.equal(result.confidence, Math.round((80 + 100 + 70) / 3));
  assert.ok(result.confidence >= 0 && result.confidence <= 100);
});

test("diagnostics surface intent signals, routing reason, and context confidence", () => {
  const { classification, resolution, routing, handlerResult } = baseArgs({
    classification: {
      intent: "general_pm_advice",
      confidence: 80,
      signals: [{ intent: "general_pm_advice", matchedPattern: "que hago si", weight: 45 }],
      language: "es",
    },
  });
  const result = composeConversationalResponse(classification, resolution, routing, handlerResult);
  assert.deepEqual(result.diagnostics.intentSignals, classification.signals);
  assert.equal(result.diagnostics.routingReason, routing.reason);
  assert.equal(result.diagnostics.contextConfidence, resolution.confidence);
});

test("omits the missing-context note entirely when nothing is missing", () => {
  const { classification, resolution, routing, handlerResult } = baseArgs();
  const result = composeConversationalResponse(classification, resolution, routing, handlerResult);
  assert.doesNotMatch(result.response, /me ayudaría tener/);
});
