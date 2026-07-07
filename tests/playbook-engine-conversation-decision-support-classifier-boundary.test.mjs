import test from "node:test";
import assert from "node:assert/strict";

import { classifyConversationIntent } from "../src/lib/conversational-brain/intent-classifier.ts";
import {
  runDecisionSupportShadowMappingEvaluation,
  summarizeDecisionSupportShadowMappingEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowMappingEvaluation.ts";
import { DECISION_CLARIFICATION_CASES } from "./fixtures/conversational-brain-decision-clarification-cases.ts";

import {
  runGoldenIntentEvaluation,
  summarizeGoldenIntentEvaluation,
} from "../src/lib/playbook-engine/conversation/classifier/intentGoldenEvaluation.ts";
import { GOLDEN_INTENT_CASES } from "./fixtures/conversational-brain-golden-intents.ts";
import {
  runGeneralPmAdviceBoundaryReview,
  summarizeGeneralPmAdviceBoundaryReview,
} from "../src/lib/playbook-engine/conversation/classifier/generalPmAdviceBoundaryReview.ts";
import { GENERAL_PM_ADVICE_BOUNDARY_CASES } from "./fixtures/conversational-brain-general-pm-advice-boundary-cases.ts";
import {
  runDecisionClarificationArchitectureReview,
  summarizeDecisionClarificationArchitectureReview,
} from "../src/lib/playbook-engine/conversation/classifier/decisionClarificationArchitectureReview.ts";
import {
  handleDecisionSupportCandidate,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportCandidateHandler.ts";

/**
 * Sprint 21R — Decision Support Classifier Boundary Calibration.
 *
 * Tests the enriched classifier's calibrated decision_support pattern set
 * (`src/lib/conversational-brain/intent-patterns.ts`) directly, and the Sprint 20R shadow mapping
 * evaluator's new boundary-detection metrics. This sprint does not touch the production classifier
 * (`classifier/intentClassifier.rules.ts`), the adapter mapping table
 * (`classifier/intentCompatibilityAdapter.ts`), the router, the composer, any handler, or the
 * endpoint — every assertion below is either a direct enriched-classifier family check or a
 * regression check against an existing offline/shadow evaluator.
 */

function familyOf(input) {
  return classifyConversationIntent({ workspaceId: "w", userId: "u", message: input }).intent.intentFamily;
}

// ─── Structure ───────────────────────────────────────────────────────────────────

test("enriched classifier exposes decision_support family/type for clear decision phrases", () => {
  const intent = classifyConversationIntent({ workspaceId: "w", userId: "u", message: "qué opción debería escoger" }).intent;
  assert.equal(intent.intentFamily, "decision_support");
  assert.ok(intent.intentType.startsWith("decision_"));
});

const shadowResults = runDecisionSupportShadowMappingEvaluation(DECISION_CLARIFICATION_CASES);
const shadowSummary = summarizeDecisionSupportShadowMappingEvaluation(shadowResults);

test("shadow mapping evaluator processes the full Sprint 18R corpus", () => {
  assert.equal(shadowResults.length, DECISION_CLARIFICATION_CASES.length);
  assert.equal(shadowSummary.totalCases, DECISION_CLARIFICATION_CASES.length);
});

const NEW_SUMMARY_FIELDS = [
  "enrichedDecisionSupportDetectedCount",
  "enrichedDecisionSupportDetectionRate",
  "decisionSupportBoundaryCapturedCount",
  "decisionSupportBoundaryCapturedRate",
  "unsupportedSafeParkingCount",
  "semanticBoundaryImprovementCount",
  "unsafeClassifierCollisionReduction",
  "playbookCollisionReduction",
  "generalPmCollisionReduction",
  "riskCollisionReduction",
  "closureCollisionReduction",
  "governanceCollisionReduction",
];

for (const field of NEW_SUMMARY_FIELDS) {
  test(`shadow mapping summary includes new Sprint 21R metric: ${field}`, () => {
    assert.notEqual(shadowSummary[field], undefined, `expected shadowSummary.${field} to be defined`);
    assert.equal(typeof shadowSummary[field], "number");
  });
}

// ─── Decision support detection ───────────────────────────────────────────────────

const MUST_BE_DECISION_SUPPORT = [
  "qué opción debería escoger",
  "cuál alternativa conviene",
  "deberíamos hacer A o B",
  "conviene escalar o esperar",
  "deberíamos cerrar ya o pedir más evidencia",
  "conviene facturar ya o esperar recepción formal",
  "deberíamos aceptar este riesgo o mitigarlo",
  "qué decisión está bloqueando el avance",
  "qué camino recomiendas tomar",
  "cuál opción es menos riesgosa",
  "deberíamos cambiar de proveedor o presionar al actual",
  "qué alternativa defiendo ante el cliente",
  "qué evidencia necesito para decidir",
  "qué criterio uso para decidir",
  "quién debería aprobar esta alternativa",
  "qué decisión debo llevar al comité",
];

for (const input of MUST_BE_DECISION_SUPPORT) {
  test(`"${input}" classifies as decision_support`, () => {
    assert.equal(familyOf(input), "decision_support");
  });
}

// ─── Boundary vs playbook_analysis ────────────────────────────────────────────────

const MUST_STAY_PLAYBOOK_ANALYSIS = [
  "qué recomienda el playbook",
  "cuál es la siguiente mejor acción",
  "analizá esto según el playbook",
];

for (const input of MUST_STAY_PLAYBOOK_ANALYSIS) {
  test(`"${input}" stays playbook_analysis`, () => {
    assert.equal(familyOf(input), "playbook_analysis");
  });
}

test('"qué gap ve PMFreak" stays unrecognized (neither classifier detects this colloquial phrasing)', () => {
  assert.equal(familyOf("qué gap ve PMFreak"), "unknown");
});

const MUST_BECOME_DECISION_SUPPORT_VS_PLAYBOOK = [
  "qué opción recomienda el playbook entre estas alternativas",
  "según PMFreak, cuál alternativa conviene",
  "analizá estas dos opciones según el playbook",
  "qué decisión recomienda el playbook",
];

for (const input of MUST_BECOME_DECISION_SUPPORT_VS_PLAYBOOK) {
  test(`"${input}" becomes decision_support (playbook boundary)`, () => {
    assert.equal(familyOf(input), "decision_support");
  });
}

// ─── Boundary vs risk_issue_dependency ────────────────────────────────────────────

const MUST_STAY_RISK = ["qué riesgos hay", "qué issues tenemos abiertos", "qué dependencias nos bloquean", "qué nos está deteniendo"];

for (const input of MUST_STAY_RISK) {
  test(`"${input}" stays risk_issue_dependency`, () => {
    assert.equal(familyOf(input), "risk_issue_dependency");
  });
}

const MUST_BECOME_DECISION_SUPPORT_VS_RISK = [
  "deberíamos aceptar este riesgo o mitigarlo",
  "qué opción reduce más el riesgo",
  "conviene escalar este riesgo",
  "cuál riesgo conviene asumir",
];

for (const input of MUST_BECOME_DECISION_SUPPORT_VS_RISK) {
  test(`"${input}" becomes decision_support (risk boundary)`, () => {
    assert.equal(familyOf(input), "decision_support");
  });
}

// ─── Boundary vs closure_billing ──────────────────────────────────────────────────

const MUST_STAY_CLOSURE_BILLING = [
  "qué falta para facturar",
  "estamos listos para cobrar",
  "qué nos falta para la recepción definitiva",
  "ya puedo cerrar el proyecto",
  "qué bloquea la facturación",
];

for (const input of MUST_STAY_CLOSURE_BILLING) {
  test(`"${input}" stays closure_billing`, () => {
    assert.equal(familyOf(input), "closure_billing");
  });
}

const MUST_BECOME_DECISION_SUPPORT_VS_CLOSURE = [
  "conviene facturar ya o esperar recepción formal",
  "deberíamos cobrar con esta evidencia",
  "facturamos ahora o esperamos aceptación final",
  "deberíamos cerrar ya o pedir más evidencia",
  "cerramos el proyecto o dejamos pendiente la observación",
];

for (const input of MUST_BECOME_DECISION_SUPPORT_VS_CLOSURE) {
  test(`"${input}" becomes decision_support (closure/billing boundary)`, () => {
    assert.equal(familyOf(input), "decision_support");
  });
}

// ─── Boundary vs governance_audit ─────────────────────────────────────────────────

const MUST_STAY_GOVERNANCE_AUDIT = ["qué evidencia usaste", "qué regla aplicó", "mostrame el audit trail", "por qué recomendaste esto"];

for (const input of MUST_STAY_GOVERNANCE_AUDIT) {
  test(`"${input}" stays governance_audit`, () => {
    assert.equal(familyOf(input), "governance_audit");
  });
}

const MUST_BECOME_DECISION_SUPPORT_VS_GOVERNANCE = [
  "qué evidencia necesito para decidir",
  "qué criterio uso para decidir",
  "qué regla debería pesar más en esta decisión",
  "quién debería aprobar esta alternativa",
];

for (const input of MUST_BECOME_DECISION_SUPPORT_VS_GOVERNANCE) {
  test(`"${input}" becomes decision_support (governance boundary)`, () => {
    assert.equal(familyOf(input), "decision_support");
  });
}

// ─── Boundary vs communication_draft ──────────────────────────────────────────────

const MUST_STAY_COMMUNICATION_DRAFT = [
  "redactame un correo defendiendo esta decisión",
  "ayudame a explicar la alternativa al cliente",
  "escribime un correo explicando la recomendación",
  "preparame un mensaje al cliente sobre la decisión",
];

for (const input of MUST_STAY_COMMUNICATION_DRAFT) {
  test(`"${input}" stays communication_draft`, () => {
    assert.equal(familyOf(input), "communication_draft");
  });
}

// ─── Boundary vs task_action ───────────────────────────────────────────────────────

const MUST_STAY_TASK_ACTION = [
  "creá una tarea para evaluar opciones",
  "asignale esta decisión a Arturo",
  "programá seguimiento para revisar la decisión",
  "convertí esta decisión en tarea",
];

for (const input of MUST_STAY_TASK_ACTION) {
  test(`"${input}" stays task_action`, () => {
    assert.equal(familyOf(input), "task_action");
  });
}

// ─── Boundary vs general_pm_advice ────────────────────────────────────────────────

const MUST_NOT_BE_DECISION_SUPPORT_GENERAL_PM = [
  "cómo manejarías un cliente difícil",
  "cómo reduzco fricción con el cliente",
  "cómo manejo expectativas con stakeholders",
  "qué buenas prácticas aplican para una reunión de cierre",
];

for (const input of MUST_NOT_BE_DECISION_SUPPORT_GENERAL_PM) {
  test(`"${input}" stays general_pm_advice or another safe non-decision_support route`, () => {
    assert.notEqual(familyOf(input), "decision_support");
  });
}

const MUST_BECOME_DECISION_SUPPORT_VS_GENERAL_PM = [
  "qué harías en mi lugar",
  "qué camino tomarías",
  "qué me recomiendas hacer",
  "cómo debería proceder",
  "qué consejo me das para decidir",
  "cómo manejo esta decisión",
];

for (const input of MUST_BECOME_DECISION_SUPPORT_VS_GENERAL_PM) {
  test(`"${input}" becomes decision_support (general_pm_advice boundary)`, () => {
    assert.equal(familyOf(input), "decision_support");
  });
}

// ─── Protected golden case: pa-05 must not regress ────────────────────────────────

test('"qué me recomiendas hacer ahora" (golden case pa-05) stays playbook_analysis — the bare "qué me recomiendas hacer" pattern above is end-anchored so it does not swallow this longer, already-calibrated phrase', () => {
  assert.equal(familyOf("qué me recomiendas hacer ahora"), "playbook_analysis");
});

// ─── Shadow metrics improved ───────────────────────────────────────────────────────

test("enrichedDecisionSupportDetectionRate improved over the Sprint 20R pre-calibration baseline (33.3%)", () => {
  assert.ok(
    shadowSummary.enrichedDecisionSupportDetectionRate > 33.3,
    `expected enrichedDecisionSupportDetectionRate > 33.3, got ${shadowSummary.enrichedDecisionSupportDetectionRate}`,
  );
});

test("unsafeClassifierCollisionCount decreased from the Sprint 20R baseline (21), or the drop is fully accounted for by unsupportedSafeParkingCount", () => {
  assert.ok(
    shadowSummary.unsafeClassifierCollisionCount < 21,
    `expected unsafeClassifierCollisionCount < 21, got ${shadowSummary.unsafeClassifierCollisionCount}`,
  );
  assert.ok(shadowSummary.unsupportedSafeParkingCount > 0);
});

test("playbookCollisionCount did not increase from the Sprint 20R baseline (3)", () => {
  assert.ok(shadowSummary.playbookCollisionCount <= 3);
});

test("generalPmCollisionCount did not increase from the Sprint 20R baseline (7)", () => {
  assert.ok(shadowSummary.generalPmCollisionCount <= 7);
});

test("riskCollisionCount did not increase from the Sprint 20R baseline (5)", () => {
  assert.ok(shadowSummary.riskCollisionCount <= 5);
});

test("closureCollisionCount did not increase from the Sprint 20R baseline (2)", () => {
  assert.ok(shadowSummary.closureCollisionCount <= 2);
});

test("governanceCollisionCount did not increase from the Sprint 20R baseline (3)", () => {
  assert.ok(shadowSummary.governanceCollisionCount <= 3);
});

test("candidateHandlerSafeRate is still 100% and handlerSafetyFailureCount is still 0", () => {
  assert.equal(shadowSummary.candidateHandlerSafeRate, 100);
  assert.equal(shadowSummary.handlerSafetyFailureCount, 0);
});

test("unsupportedSafeParkingCount is documented as semantic boundary captured, not production success — recommendedIntegrationMode is unaffected by it alone", () => {
  assert.ok(shadowSummary.unsupportedSafeParkingCount > 0);
  assert.notEqual(shadowSummary.recommendedIntegrationMode, undefined);
});

// ─── Regression: golden evaluation ────────────────────────────────────────────────

test("golden corpus global compatibilityRate is unchanged (72.5%)", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  const report = summarizeGoldenIntentEvaluation(evaluation);
  assert.equal(report.overall.compatibilityRate, 72.5, `expected 72.5, got ${report.overall.compatibilityRate}`);
});

test("golden corpus per-category compatibilityRate is unchanged for every previously-calibrated category", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  const report = summarizeGoldenIntentEvaluation(evaluation);
  const byCategory = Object.fromEntries(report.byCategory.map((c) => [c.category, c]));
  const expectedRates = {
    project_status: 100,
    closure_billing: 100,
    risk_issue_dependency: 100,
    task_action: 100,
    communication_draft: 100,
    governance_audit: 90,
    playbook_analysis: 88.9,
  };
  for (const [category, expectedRate] of Object.entries(expectedRates)) {
    assert.equal(
      byCategory[category].compatibilityRate,
      expectedRate,
      `expected ${category} compatibilityRate to stay ${expectedRate}, got ${byCategory[category].compatibilityRate}`,
    );
  }
});

test("golden corpus fixture has no drift against current classifier/adapter behavior (gpa-06 updated for the decision_support boundary move)", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  assert.equal(
    evaluation.summary.expectedMappedIntentFailCount,
    0,
    `expected 0 drifted cases, got ${evaluation.summary.expectedMappedIntentFailCount}: ` + JSON.stringify(evaluation.summary.warnings, null, 2),
  );
});

// ─── Regression: Sprint 17R boundary review ───────────────────────────────────────

test("Sprint 17R boundary review: policyAlignedRate moved to 82.9 (decision_support boundary only), currentSystemAcceptableRate/gap counts unchanged", () => {
  const results = runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES);
  const summary = summarizeGeneralPmAdviceBoundaryReview(results);
  assert.equal(summary.totalCases, 70);
  assert.equal(summary.policyAlignedRate, 82.9);
  assert.equal(summary.currentSystemAcceptableRate, 84.3);
  assert.equal(summary.architectureGapCount, 10);
  assert.equal(summary.clarificationGapCount, 10);
});

// ─── Regression: Sprint 18R architecture review ───────────────────────────────────

test("Sprint 18R architecture review: currentSafeMappingRate/futureRouteAlreadySupportedRate moved to 84.8 (decision_support boundary only), no existing-route regressions", () => {
  const results = runDecisionClarificationArchitectureReview(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionClarificationArchitectureReview(results);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.currentSafeMappingRate, 84.8);
  assert.equal(summary.futureRouteAlreadySupportedRate, 84.8);
  assert.equal(summary.requiresNewHandlerCount, 45);
  assert.equal(summary.requiresClarificationCount, 24);
  assert.equal(summary.existingRouteRegressions.length, 0);
});

// ─── Regression: Sprint 19R candidate handler ─────────────────────────────────────

test("Sprint 19R candidate handler behavior is unchanged: still produces a safe, well-formed result for a decision_support input", () => {
  const result = handleDecisionSupportCandidate({ input: "qué opción debería escoger", source: "manual_test" });
  assert.equal(result.kind, "decision_support_candidate_result");
  assert.equal(result.safety.shouldExecuteAction, false);
  assert.equal(result.safety.shouldCreateTask, false);
  assert.equal(result.safety.shouldSendEmail, false);
  assert.equal(result.safety.shouldWriteToDb, false);
  assert.equal(result.safety.requiresHumanConfirmation, true);
  assert.equal(result.safety.productionRoutingEnabled, false);
  assert.ok(result.options.length >= 1);
});

// ─── Safety ────────────────────────────────────────────────────────────────────────

test("classifying decision-shaped input never executes an action or calls an external service", () => {
  for (const input of MUST_BE_DECISION_SUPPORT) {
    const intent = classifyConversationIntent({ workspaceId: "w", userId: "u", message: input }).intent;
    assert.equal(intent.isActionRequest, false);
    assert.equal(intent.isExternalCommunicationRequest, false);
    assert.equal(intent.isReadOnly, true);
  }
});
