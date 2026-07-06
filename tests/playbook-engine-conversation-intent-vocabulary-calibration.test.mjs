import test from "node:test";
import assert from "node:assert/strict";

import { classifyConversationIntent as classifyProductionIntent } from "../src/lib/playbook-engine/conversation/classifier/intentClassifier.ts";
import { classifyConversationIntent as classifyEnrichedIntent } from "../src/lib/conversational-brain/intent-classifier.ts";
import { runGoldenIntentEvaluation, summarizeGoldenIntentEvaluation } from "../src/lib/playbook-engine/conversation/classifier/intentGoldenEvaluation.ts";
import { GOLDEN_INTENT_CASES } from "./fixtures/conversational-brain-golden-intents.ts";

/**
 * Sprint 12R — Intent Vocabulary Calibration regression tests.
 *
 * Locks in the specific pattern additions made to intentClassifier.rules.ts (production) and
 * intent-patterns.ts (enriched) to close the project_status and playbook_analysis vocabulary gaps
 * found by the Sprint 11R golden evaluation. Also guards the categories that were NOT touched this
 * sprint (communication_draft, closure_billing, task_action, governance_audit) against regressions
 * from the new patterns' vocabulary overlapping with their phrasing.
 */

const baseInput = (message, overrides = {}) => ({ workspaceId: "ws_1", userId: "user_1", message, ...overrides });

// ─── project_status: previously-failing phrases now classify correctly ─────────

test("production: previously-missed project_status phrases now classify as project_status_question", () => {
  const phrases = [
    "dame estado de HMP",
    "qué avance tenemos",
    "estamos atrasados",
    "qué bloqueos hay",
    "cuál es el status del proyecto",
    "cómo está la salud del proyecto",
    "qué tan atrasados estamos con el cronograma",
  ];
  for (const message of phrases) {
    const { intent } = classifyProductionIntent(message);
    assert.equal(intent, "project_status_question", `"${message}" should classify as project_status_question`);
  }
});

test("enriched: previously-missed project_status phrases now classify as project_status", () => {
  const phrases = ["el proyecto está estancado", "nadie responde del lado del cliente", "qué bloqueos hay"];
  for (const message of phrases) {
    const { intent } = classifyEnrichedIntent(baseInput(message));
    assert.equal(intent.intentFamily, "project_status", `"${message}" should classify as project_status`);
  }
});

test("production: 'estado de <referencia>' pattern does not hijack a task_action phrase mentioning 'tarea'", () => {
  // Regression guard for the new "estado de" pattern's negative lookahead — this task_action
  // phrase was already unmatched (unknown) before Sprint 12R and must not be reclassified as
  // project_status_question just because it shares the word "estado".
  const { intent } = classifyProductionIntent("actualiza el estado de esta tarea");
  assert.notEqual(intent, "project_status_question");
});

// ─── playbook_analysis: previously-failing phrases now classify correctly ──────

test("production: previously-missed playbook_analysis phrases now classify as recommendation_request", () => {
  const phrases = [
    "qué recomienda el playbook",
    "cuál es la siguiente mejor acción",
    "analizá esto según el playbook",
    "qué brecha tenemos respecto al playbook",
  ];
  for (const message of phrases) {
    const { intent } = classifyProductionIntent(message);
    assert.equal(intent, "recommendation_request", `"${message}" should classify as recommendation_request`);
  }
});

test("enriched: previously-missed playbook_analysis phrases now classify as playbook_analysis", () => {
  const phrases = ["qué me recomiendas hacer ahora", "qué sugieres que hagamos"];
  for (const message of phrases) {
    const { intent } = classifyEnrichedIntent(baseInput(message));
    assert.equal(intent.intentFamily, "playbook_analysis", `"${message}" should classify as playbook_analysis`);
  }
});

test("enriched: broadened recommendation pattern does not falsely match a decision_support/general_pm_advice phrase", () => {
  // Regression guard: "que (me|nos)? recomienda(s)?" must not match "recomendarias" (conditional
  // tense, decision_support ds-08) or "recomendame" (imperative, general_pm_advice gpa-10).
  const decisionSupport = classifyEnrichedIntent(baseInput("qué opción recomendarías"));
  assert.notEqual(decisionSupport.intent.intentFamily, "playbook_analysis");
  const generalAdvice = classifyEnrichedIntent(baseInput("recomendame cómo proceder"));
  assert.notEqual(generalAdvice.intent.intentFamily, "playbook_analysis");
});

// ─── Regression: categories not targeted this sprint keep classifying the same way ─

test("regression: communication_draft phrases still classify as communication_draft on both classifiers", () => {
  const phrases = ["redactame un correo para pedir recepción", "haceme un correo de escalamiento"];
  for (const message of phrases) {
    assert.equal(classifyProductionIntent(message).intent, "communication_draft");
    assert.equal(classifyEnrichedIntent(baseInput(message)).intent.intentFamily, "communication_draft");
  }
});

test("regression: closure_billing phrases still classify as closure_question/billing_question", () => {
  assert.equal(classifyProductionIntent("ya puedo cerrar el proyecto").intent, "closure_question");
  assert.equal(classifyProductionIntent("qué bloquea la facturación").intent, "billing_question");
  assert.equal(classifyEnrichedIntent(baseInput("ya puedo cerrar el proyecto")).intent.intentFamily, "closure_billing");
});

test("regression: task_action phrases still classify as task_action on the enriched classifier", () => {
  const phrases = ["creá una tarea para Arturo", "creame una tarea para el equipo", "asigname esto a Gabriela"];
  for (const message of phrases) {
    assert.equal(classifyEnrichedIntent(baseInput(message)).intent.intentFamily, "task_action");
  }
});

test("regression: governance_audit phrases still classify as governance_audit on the enriched classifier", () => {
  const phrases = ["por qué recomendaste esto", "qué evidencia usaste", "explicame por qué sugeriste esto"];
  for (const message of phrases) {
    assert.equal(classifyEnrichedIntent(baseInput(message)).intent.intentFamily, "governance_audit");
  }
});

// ─── byCategory compatibilityRate floors: locks in the Sprint 12R improvement ──────

test("golden evaluation: project_status and playbook_analysis meet their Sprint 12R floors", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  const report = summarizeGoldenIntentEvaluation(evaluation);
  const byCategory = Object.fromEntries(report.byCategory.map((c) => [c.category, c]));

  assert.ok(
    byCategory.project_status.compatibilityRate >= 90,
    `project_status compatibilityRate regressed below 90%: ${byCategory.project_status.compatibilityRate}%`,
  );
  assert.ok(
    byCategory.playbook_analysis.compatibilityRate >= 80,
    `playbook_analysis compatibilityRate regressed below 80%: ${byCategory.playbook_analysis.compatibilityRate}%`,
  );
});

test("golden evaluation: categories not targeted this sprint did not regress below their Sprint 11R baseline", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  const report = summarizeGoldenIntentEvaluation(evaluation);
  const byCategory = Object.fromEntries(report.byCategory.map((c) => [c.category, c]));

  const baselines = {
    communication_draft: 60,
    closure_billing: 33.3,
    task_action: 50,
    governance_audit: 40,
    risk_issue_dependency: 30,
    general_pm_advice: 30,
  };
  for (const [category, baseline] of Object.entries(baselines)) {
    assert.ok(
      byCategory[category].compatibilityRate >= baseline,
      `${category} compatibilityRate regressed below its Sprint 11R baseline of ${baseline}%: ${byCategory[category].compatibilityRate}%`,
    );
  }
});

test("golden evaluation: global compatibilityRate did not regress below the Sprint 11R baseline of 28.4%", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  assert.ok(
    evaluation.summary.compatibilityRate >= 28.4,
    `global compatibilityRate regressed: ${evaluation.summary.compatibilityRate}%`,
  );
});

// ─── Sprint 13R: closure_billing vocabulary calibration ────────────────────────

test("production: previously-missed closure_billing billing phrases now classify as billing_question", () => {
  const phrases = [
    "qué falta para facturar",
    "estamos listos para cobrar",
    "qué bloquea la facturación",
    "ya podemos cobrar honorarios",
  ];
  for (const message of phrases) {
    const { intent } = classifyProductionIntent(message);
    assert.equal(intent, "billing_question", `"${message}" should classify as billing_question`);
  }
});

test("production: previously-missed closure_billing closure/reception/acceptance phrases now classify as closure_question", () => {
  const phrases = [
    "qué nos falta para la recepción definitiva",
    "ya puedo cerrar el proyecto",
    "preparame el seguimiento para recepción",
    "estamos listos para la recepción definitiva",
    "qué falta para el cierre",
    "el cliente ya firmó el acta de aceptación",
    "falta el acta de recepción",
    "tenemos aceptación final?",
    "está listo el cierre administrativo?",
  ];
  for (const message of phrases) {
    const { intent } = classifyProductionIntent(message);
    assert.equal(intent, "closure_question", `"${message}" should classify as closure_question`);
  }
});

test("regression: communication_draft phrases sharing closure vocabulary still classify as communication_draft, not closure_billing", () => {
  // "recepcion"/"cierre" now score under closure_question in production, but these phrases also
  // carry "redacta"/"correo (para|de)" (weight 45+25) — a much stronger communication_draft signal
  // than the new bare closure patterns (weight 20) — so they must not flip to closure_question.
  const phrases = [
    "redactame un correo para pedir recepción",
    "redactame un correo de cierre para el cliente",
  ];
  for (const message of phrases) {
    const { intent } = classifyProductionIntent(message);
    assert.equal(intent, "communication_draft", `"${message}" should still classify as communication_draft`);
  }
});

test("regression: communication_draft phrases with no closure vocabulary are unaffected by closure_billing calibration", () => {
  const phrases = ["ayudame a responder este correo", "preparame una minuta"];
  for (const message of phrases) {
    const { intent } = classifyProductionIntent(message);
    assert.notEqual(intent, "billing_question", `"${message}" must not classify as billing_question`);
    assert.notEqual(intent, "closure_question", `"${message}" must not classify as closure_question`);
    assert.equal(
      classifyEnrichedIntent(baseInput(message)).intent.intentFamily,
      "communication_draft",
      `"${message}" enriched family should remain communication_draft`,
    );
  }
});

test("golden evaluation: closure_billing meets its Sprint 13R floor of 70% without regressing protected categories", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  const report = summarizeGoldenIntentEvaluation(evaluation);
  const byCategory = Object.fromEntries(report.byCategory.map((c) => [c.category, c]));

  assert.ok(
    byCategory.closure_billing.compatibilityRate >= 70,
    `closure_billing compatibilityRate did not reach the Sprint 13R floor of 70%: ${byCategory.closure_billing.compatibilityRate}%`,
  );
  assert.equal(
    byCategory.project_status.compatibilityRate,
    100,
    `project_status must remain at 100%: ${byCategory.project_status.compatibilityRate}%`,
  );
  assert.ok(
    byCategory.playbook_analysis.compatibilityRate >= 88.9,
    `playbook_analysis must remain >= 88.9%: ${byCategory.playbook_analysis.compatibilityRate}%`,
  );
  assert.ok(
    byCategory.communication_draft.compatibilityRate >= 60,
    `communication_draft must not regress below 60%: ${byCategory.communication_draft.compatibilityRate}%`,
  );
});
