import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

// ─── Sprint 14R: governance_audit vocabulary calibration ───────────────────────

test("production: previously-missed governance_audit phrases now classify as governance_question/audit_question", () => {
  const expectations = [
    ["qué evidencia usaste", "governance_question"],
    ["qué regla aplicó", "audit_question"],
    ["mostrame el audit trail", "audit_question"],
    ["quiero ver la bitácora de auditoría", "audit_question"],
    ["quién aprobó esto", "audit_question"],
    ["explicame la justificación", "audit_question"],
    ["basado en qué hiciste esa recomendación", "audit_question"],
    ["cuál fue el fundamento de esa recomendación", "audit_question"],
    ["mostrame el historial de decisiones", "audit_question"],
  ];
  for (const [message, expectedIntent] of expectations) {
    const { intent } = classifyProductionIntent(message);
    assert.equal(intent, expectedIntent, `"${message}" should classify as ${expectedIntent}`);
  }
});

test("enriched: previously-missed governance_audit phrases now classify as governance_audit", () => {
  const phrases = [
    "quiero ver la bitácora de auditoría",
    "hay aprobaciones pendientes",
    "mostrame el historial de decisiones",
    "basado en qué hiciste esa recomendación",
    "cuál fue el fundamento de esa recomendación",
  ];
  for (const message of phrases) {
    const { intent } = classifyEnrichedIntent(baseInput(message));
    assert.equal(intent.intentFamily, "governance_audit", `"${message}" should classify as governance_audit`);
  }
});

test("enriched: 'historial de decisiones' does not lose the tie against decision_support's bare 'decision(es)' match", () => {
  // Regression guard: "decisiones" alone matches decision_support's bare pattern (weight 5), tying
  // governance_audit's "historial de decisiones" pattern (weight 5) unless the extra bare
  // "historial" match (weight 3) pushes governance_audit's total to 8. A tie here would fall
  // through to needs_clarification, since neither family is in FAMILY_TIE_BREAK_ORDER.
  const { intent } = classifyEnrichedIntent(baseInput("mostrame el historial de decisiones"));
  assert.equal(intent.intentFamily, "governance_audit");
  assert.notEqual(intent.intentFamily, "decision_support");
});

test("golden evaluation: governance_audit meets its Sprint 14R floor of 70% without regressing protected categories", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  const report = summarizeGoldenIntentEvaluation(evaluation);
  const byCategory = Object.fromEntries(report.byCategory.map((c) => [c.category, c]));

  assert.ok(
    byCategory.governance_audit.compatibilityRate >= 70,
    `governance_audit compatibilityRate did not reach the Sprint 14R floor of 70%: ${byCategory.governance_audit.compatibilityRate}%`,
  );
  assert.equal(
    byCategory.project_status.compatibilityRate,
    100,
    `project_status must remain at 100%: ${byCategory.project_status.compatibilityRate}%`,
  );
  assert.equal(
    byCategory.closure_billing.compatibilityRate,
    100,
    `closure_billing must remain at 100%: ${byCategory.closure_billing.compatibilityRate}%`,
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

// ─── Sprint 14R: risk_issue_dependency vocabulary calibration ──────────────────

test("production: previously-missed risk_issue_dependency phrases now classify as risk_analysis", () => {
  const phrases = [
    "qué riesgos hay",
    "qué issues tenemos abiertos",
    "qué dependencias nos bloquean",
    "qué nos está deteniendo",
    "cuál es el impedimento",
    "estamos esperando al cliente",
    "hay algún pendiente de proveedor",
    "qué está frenando el avance",
    "qué obstáculo tenemos",
    "qué está trabando el proyecto",
  ];
  for (const message of phrases) {
    const { intent } = classifyProductionIntent(message);
    assert.equal(intent, "risk_analysis", `"${message}" should classify as risk_analysis`);
  }
});

test("enriched: previously-missed risk_issue_dependency phrases now classify as risk_issue_dependency", () => {
  const phrases = [
    "qué issues tenemos abiertos",
    "qué dependencias nos bloquean",
    "qué nos está deteniendo",
    "cuál es el impedimento",
    "estamos esperando al cliente",
    "hay algún pendiente de proveedor",
    "qué está frenando el avance",
    "qué obstáculo tenemos",
    "qué está trabando el proyecto",
  ];
  for (const message of phrases) {
    const { intent } = classifyEnrichedIntent(baseInput(message));
    assert.equal(intent.intentFamily, "risk_issue_dependency", `"${message}" should classify as risk_issue_dependency`);
  }
});

test("regression: blocker-phrase risk_issue_dependency patterns do not hijack project_status's own blocker vocabulary", () => {
  // Regression guard: "no avanza"/"atorado"/"estancado" stay project_status-only — Sprint 14R's new
  // risk_issue_dependency blocker patterns ("frenando", "trabando", "detiene", "bloquea el avance",
  // "impide avanzar") are distinct word forms and must not match these phrases.
  const phrases = ["el proyecto está estancado", "qué tan atrasados estamos con el cronograma"];
  for (const message of phrases) {
    assert.equal(classifyProductionIntent(message).intent, "project_status_question");
    assert.equal(classifyEnrichedIntent(baseInput(message)).intent.intentFamily, "project_status");
  }
});

test("regression: general_pm_advice's singular 'problema' escalation phrasing is unaffected by risk_issue_dependency's plural-only 'problemas' pattern", () => {
  // Regression guard for the plural-only restriction: production has no pattern matching singular
  // "problema", so this phrase must not flip to risk_analysis.
  const { intent } = classifyProductionIntent("cómo escalo este problema");
  assert.notEqual(intent, "risk_analysis");
});

test("golden evaluation: risk_issue_dependency meets its Sprint 14R floor of 70% without regressing protected categories", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  const report = summarizeGoldenIntentEvaluation(evaluation);
  const byCategory = Object.fromEntries(report.byCategory.map((c) => [c.category, c]));

  assert.ok(
    byCategory.risk_issue_dependency.compatibilityRate >= 70,
    `risk_issue_dependency compatibilityRate did not reach the Sprint 14R floor of 70%: ${byCategory.risk_issue_dependency.compatibilityRate}%`,
  );
  assert.equal(
    byCategory.project_status.compatibilityRate,
    100,
    `project_status must remain at 100%: ${byCategory.project_status.compatibilityRate}%`,
  );
  assert.equal(
    byCategory.closure_billing.compatibilityRate,
    100,
    `closure_billing must remain at 100%: ${byCategory.closure_billing.compatibilityRate}%`,
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

test("golden evaluation: global compatibilityRate did not regress below the Sprint 13R baseline of 51.0%", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  assert.ok(
    evaluation.summary.compatibilityRate >= 51.0,
    `global compatibilityRate regressed: ${evaluation.summary.compatibilityRate}%`,
  );
});

// ─── Sprint 15R: task_action vocabulary calibration ────────────────────────

test("production: previously-missed task_action phrases now classify as task_or_action_request", () => {
  const expectations = [
    ["creá una tarea para Arturo", "task_or_action_request"],
    ["convertí esto en tarea", "task_or_action_request"],
    ["asignale seguimiento a Gabriela", "task_or_action_request"],
    ["actualizá el estado de esta tarea", "task_or_action_request"],
    ["cerrá esta acción", "task_or_action_request"],
    ["programá seguimiento para mañana", "task_or_action_request"],
    ["pasalo a task", "task_or_action_request"],
    ["creá un action item", "task_or_action_request"],
    ["poné esto como pendiente", "task_or_action_request"],
    ["generá una acción desde esta recomendación", "task_or_action_request"],
    ["marcá esta tarea como completada", "task_or_action_request"],
  ];
  for (const [message, expectedIntent] of expectations) {
    const { intent } = classifyProductionIntent(message);
    assert.equal(intent, expectedIntent, `"${message}" should classify as ${expectedIntent}`);
  }
});

test("enriched: previously-missed task_action phrases now classify as task_action", () => {
  const phrases = [
    "convertí esto en tarea",
    "asignale seguimiento a Gabriela",
    "actualizá el estado de esta tarea",
    "cerrá esta acción",
    "programá seguimiento para mañana",
    "pasalo a task",
    "creá un action item",
    "poné esto como pendiente",
    "generá una acción desde esta recomendación",
    "marcá esta tarea como completada",
  ];
  for (const message of phrases) {
    const { intent } = classifyEnrichedIntent(baseInput(message));
    assert.equal(intent.intentFamily, "task_action", `"${message}" should classify as task_action`);
  }
});

test("regression: 'marcá esta recomendación como vista' keeps its documented task_action/playbook_analysis overlap", () => {
  // Regression guard: the new task_action status/update patterns (marca... tarea/accion como,
  // actualiza(r)? el estado, etc.) all require an explicit "tarea"/"accion"/"estado" noun and must
  // not match this bare "recomendación" phrasing — it should keep resolving through
  // recommendation_request/playbook_analysis exactly as before Sprint 15R.
  assert.equal(classifyProductionIntent("marcá esta recomendación como vista").intent, "recommendation_request");
  assert.equal(
    classifyEnrichedIntent(baseInput("marcá esta recomendación como vista")).intent.intentFamily,
    "playbook_analysis",
  );
});

test("regression: task_action's new 'como pendiente'/'estado' vocabulary does not hijack protected categories", () => {
  // project_status
  assert.equal(classifyProductionIntent("cómo va el proyecto").intent, "project_status_question");
  assert.equal(classifyProductionIntent("dame estado de HMP").intent, "project_status_question");
  assert.equal(classifyProductionIntent("qué avance tenemos").intent, "project_status_question");
  // closure_billing
  assert.equal(classifyProductionIntent("qué falta para facturar").intent, "billing_question");
  assert.equal(classifyProductionIntent("estamos listos para cobrar").intent, "billing_question");
  // communication_draft
  assert.equal(classifyProductionIntent("redactame un correo para pedir recepción").intent, "communication_draft");
  assert.equal(
    classifyEnrichedIntent(baseInput("ayudame a responder este correo")).intent.intentFamily,
    "communication_draft",
  );
  assert.equal(classifyEnrichedIntent(baseInput("preparame una minuta")).intent.intentFamily, "communication_draft");
  // governance_audit
  assert.equal(classifyProductionIntent("por qué recomendaste esto").intent, "audit_question");
  assert.equal(classifyProductionIntent("qué evidencia usaste").intent, "governance_question");
  // risk_issue_dependency
  assert.equal(classifyProductionIntent("qué riesgos hay").intent, "risk_analysis");
  assert.equal(classifyProductionIntent("qué dependencias nos bloquean").intent, "risk_analysis");
  // playbook_analysis
  assert.equal(classifyProductionIntent("qué recomienda el playbook").intent, "recommendation_request");
  assert.equal(classifyProductionIntent("cuál es la siguiente mejor acción").intent, "recommendation_request");
});

test("safety: task_action vocabulary calibration never calls the router, composer, handlers, DB, or Supabase, and never executes/creates a real task", () => {
  const rulesSource = readFileSync(
    new URL("../src/lib/playbook-engine/conversation/classifier/intentClassifier.rules.ts", import.meta.url),
    "utf8",
  );
  const patternsSource = readFileSync(
    new URL("../src/lib/conversational-brain/intent-patterns.ts", import.meta.url),
    "utf8",
  );
  for (const source of [rulesSource, patternsSource]) {
    assert.doesNotMatch(source, /brainRouter|responseComposer|handlers\//);
    assert.doesNotMatch(source, /supabase/i);
    assert.doesNotMatch(source, /\bfetch\(/);
    assert.doesNotMatch(source, /sendEmail|createTask|executeAction/i);
  }
});

test("golden evaluation: task_action reaches its Sprint 15R target of 80%+ without regressing protected categories", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  const report = summarizeGoldenIntentEvaluation(evaluation);
  const byCategory = Object.fromEntries(report.byCategory.map((c) => [c.category, c]));

  assert.ok(
    byCategory.task_action.compatibilityRate >= 80,
    `task_action compatibilityRate did not reach the Sprint 15R target of 80%: ${byCategory.task_action.compatibilityRate}%`,
  );
  assert.equal(
    byCategory.project_status.compatibilityRate,
    100,
    `project_status must remain at 100%: ${byCategory.project_status.compatibilityRate}%`,
  );
  assert.equal(
    byCategory.closure_billing.compatibilityRate,
    100,
    `closure_billing must remain at 100%: ${byCategory.closure_billing.compatibilityRate}%`,
  );
  assert.equal(
    byCategory.risk_issue_dependency.compatibilityRate,
    100,
    `risk_issue_dependency must remain at 100%: ${byCategory.risk_issue_dependency.compatibilityRate}%`,
  );
  assert.ok(
    byCategory.governance_audit.compatibilityRate >= 90,
    `governance_audit must remain >= 90%: ${byCategory.governance_audit.compatibilityRate}%`,
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

test("golden evaluation: global compatibilityRate did not regress below the Sprint 14R baseline of 62.7%", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  assert.ok(
    evaluation.summary.compatibilityRate >= 62.7,
    `global compatibilityRate regressed: ${evaluation.summary.compatibilityRate}%`,
  );
});

test("regression: Sprint 12R/13R protected phrases still classify the same way after Sprint 14R calibration", () => {
  const stillProjectStatus = ["cómo va el proyecto", "dame estado de HMP", "qué avance tenemos"];
  for (const message of stillProjectStatus) {
    assert.equal(classifyProductionIntent(message).intent, "project_status_question", `"${message}" should still classify as project_status_question`);
  }

  const stillCommunicationDraft = [
    "redactame un correo para pedir recepción",
    "ayudame a responder este correo",
    "preparame una minuta",
  ];
  for (const message of stillCommunicationDraft) {
    assert.equal(
      classifyEnrichedIntent(baseInput(message)).intent.intentFamily,
      "communication_draft",
      `"${message}" enriched family should still be communication_draft`,
    );
  }

  assert.equal(classifyProductionIntent("qué falta para facturar").intent, "billing_question");
  assert.equal(classifyProductionIntent("estamos listos para cobrar").intent, "billing_question");
  assert.equal(classifyProductionIntent("qué recomienda el playbook").intent, "recommendation_request");
  assert.equal(classifyProductionIntent("cuál es la siguiente mejor acción").intent, "recommendation_request");
});

// ─── Sprint 16R: communication_draft vocabulary calibration ───────────────────

test("production and enriched: previously-missed communication_draft phrases now both classify as communication_draft", () => {
  const phrases = [
    "redactame un correo para pedir recepción",
    "ayudame a responder este correo",
    "preparame una minuta",
    "haceme un correo de escalamiento",
    "dame seguimiento formal para el cliente",
    "armame un mensaje para pedir visto bueno",
    "cómo le digo al cliente que falta el acta",
    "preparame correo para solicitar recepción definitiva",
    "redacta un correo de cierre",
    "escribime una respuesta cordial",
    "redactame un status update para el cliente",
    "preparame un mensaje al cliente sobre la dependencia",
    "ayudame a escalar el bloqueo",
    "redactame un correo con la recomendación del playbook",
    "escribime un correo explicando la recomendación",
  ];
  for (const message of phrases) {
    assert.equal(
      classifyProductionIntent(message).intent,
      "communication_draft",
      `"${message}" should classify as communication_draft (production)`,
    );
    assert.equal(
      classifyEnrichedIntent(baseInput(message)).intent.intentFamily,
      "communication_draft",
      `"${message}" should classify as communication_draft (enriched)`,
    );
  }
});

test("regression: closure_billing phrases without a drafting verb still classify as closure_billing, not communication_draft", () => {
  const expectations = [
    ["qué falta para facturar", "billing_question"],
    ["estamos listos para cobrar", "billing_question"],
    ["qué nos falta para la recepción definitiva", "closure_question"],
    ["ya puedo cerrar el proyecto", "closure_question"],
    ["qué bloquea la facturación", "billing_question"],
    ["falta el acta de recepción", "closure_question"],
    ["tenemos aceptación final?", "closure_question"],
    ["está listo el cierre administrativo?", "closure_question"],
  ];
  for (const [message, expectedIntent] of expectations) {
    assert.equal(classifyProductionIntent(message).intent, expectedIntent, `"${message}" should classify as ${expectedIntent}`);
    assert.equal(
      classifyEnrichedIntent(baseInput(message)).intent.intentFamily,
      "closure_billing",
      `"${message}" enriched family should remain closure_billing`,
    );
  }
});

test("regression: task_action phrases without a drafting verb still classify as task_or_action_request, not communication_draft", () => {
  const expectations = [
    ["creá una tarea para Arturo", "task_or_action_request"],
    ["convertí esto en tarea", "task_or_action_request"],
    ["asignale seguimiento a Gabriela", "task_or_action_request"],
    ["actualizá el estado de esta tarea", "task_or_action_request"],
    ["cerrá esta acción", "task_or_action_request"],
    ["programá seguimiento para mañana", "task_or_action_request"],
    ["pasalo a task", "task_or_action_request"],
    ["creá un action item", "task_or_action_request"],
  ];
  for (const [message, expectedIntent] of expectations) {
    assert.equal(classifyProductionIntent(message).intent, expectedIntent, `"${message}" should classify as ${expectedIntent}`);
    assert.equal(
      classifyEnrichedIntent(baseInput(message)).intent.intentFamily,
      "task_action",
      `"${message}" enriched family should remain task_action`,
    );
  }
  // Documented pre-existing overlap (Sprint 15R): unaffected by Sprint 16R's new patterns.
  assert.equal(classifyProductionIntent("marcá esta recomendación como vista").intent, "recommendation_request");
});

test("regression: governance_audit phrases without a drafting verb still classify as governance_audit", () => {
  const expectations = [
    ["por qué recomendaste esto", "audit_question"],
    ["qué evidencia usaste", "governance_question"],
    ["mostrame el audit trail", "audit_question"],
    ["qué regla aplicó", "audit_question"],
    ["quiero ver la bitácora de auditoría", "audit_question"],
    ["quién aprobó esto", "audit_question"],
  ];
  for (const [message, expectedIntent] of expectations) {
    assert.equal(classifyProductionIntent(message).intent, expectedIntent, `"${message}" should classify as ${expectedIntent}`);
    assert.equal(
      classifyEnrichedIntent(baseInput(message)).intent.intentFamily,
      "governance_audit",
      `"${message}" enriched family should remain governance_audit`,
    );
  }
});

test("regression: risk_issue_dependency phrases without a drafting verb still classify as risk_analysis", () => {
  const phrases = [
    "qué riesgos hay",
    "qué issues tenemos abiertos",
    "qué dependencias nos bloquean",
    "qué nos está deteniendo",
    "cuál es el impedimento",
    "estamos esperando al cliente",
    "hay algún pendiente de proveedor",
  ];
  for (const message of phrases) {
    assert.equal(classifyProductionIntent(message).intent, "risk_analysis", `"${message}" should classify as risk_analysis`);
    assert.equal(
      classifyEnrichedIntent(baseInput(message)).intent.intentFamily,
      "risk_issue_dependency",
      `"${message}" enriched family should remain risk_issue_dependency`,
    );
  }
});

test("regression: project_status phrases without a drafting verb still classify as project_status_question", () => {
  const phrases = ["cómo va el proyecto", "dame estado de HMP", "qué avance tenemos", "estamos atrasados", "salud del proyecto"];
  for (const message of phrases) {
    assert.equal(classifyProductionIntent(message).intent, "project_status_question", `"${message}" should classify as project_status_question`);
    assert.equal(
      classifyEnrichedIntent(baseInput(message)).intent.intentFamily,
      "project_status",
      `"${message}" enriched family should remain project_status`,
    );
  }
});

test("regression: playbook_analysis phrases without a drafting verb still classify as recommendation_request/playbook_analysis", () => {
  const phrases = ["qué recomienda el playbook", "cuál es la siguiente mejor acción", "analizá esto según el playbook"];
  for (const message of phrases) {
    assert.equal(classifyProductionIntent(message).intent, "recommendation_request", `"${message}" should classify as recommendation_request`);
    assert.equal(
      classifyEnrichedIntent(baseInput(message)).intent.intentFamily,
      "playbook_analysis",
      `"${message}" enriched family should remain playbook_analysis`,
    );
  }
});

test("safety: communication_draft vocabulary calibration never calls the router, composer, handlers, DB, or Supabase, and never sends a real email or creates an external draft", () => {
  const rulesSource = readFileSync(
    new URL("../src/lib/playbook-engine/conversation/classifier/intentClassifier.rules.ts", import.meta.url),
    "utf8",
  );
  const patternsSource = readFileSync(
    new URL("../src/lib/conversational-brain/intent-patterns.ts", import.meta.url),
    "utf8",
  );
  for (const source of [rulesSource, patternsSource]) {
    assert.doesNotMatch(source, /brainRouter|responseComposer|handlers\//);
    assert.doesNotMatch(source, /supabase/i);
    assert.doesNotMatch(source, /\bfetch\(/);
    assert.doesNotMatch(source, /sendEmail|createTask|executeAction|gmail/i);
  }
});

test("golden evaluation: communication_draft reaches its Sprint 16R target of 90%+ without regressing protected categories", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  const report = summarizeGoldenIntentEvaluation(evaluation);
  const byCategory = Object.fromEntries(report.byCategory.map((c) => [c.category, c]));

  assert.ok(
    byCategory.communication_draft.compatibilityRate >= 90,
    `communication_draft compatibilityRate did not reach the Sprint 16R target of 90%: ${byCategory.communication_draft.compatibilityRate}%`,
  );
  assert.equal(
    byCategory.project_status.compatibilityRate,
    100,
    `project_status must remain at 100%: ${byCategory.project_status.compatibilityRate}%`,
  );
  assert.equal(
    byCategory.closure_billing.compatibilityRate,
    100,
    `closure_billing must remain at 100%: ${byCategory.closure_billing.compatibilityRate}%`,
  );
  assert.equal(
    byCategory.risk_issue_dependency.compatibilityRate,
    100,
    `risk_issue_dependency must remain at 100%: ${byCategory.risk_issue_dependency.compatibilityRate}%`,
  );
  assert.equal(
    byCategory.task_action.compatibilityRate,
    100,
    `task_action must remain at 100%: ${byCategory.task_action.compatibilityRate}%`,
  );
  assert.ok(
    byCategory.governance_audit.compatibilityRate >= 90,
    `governance_audit must remain >= 90%: ${byCategory.governance_audit.compatibilityRate}%`,
  );
  assert.ok(
    byCategory.playbook_analysis.compatibilityRate >= 88.9,
    `playbook_analysis must remain >= 88.9%: ${byCategory.playbook_analysis.compatibilityRate}%`,
  );
});

test("golden evaluation: global compatibilityRate did not regress below the Sprint 15R baseline of 67.6%", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  assert.ok(
    evaluation.summary.compatibilityRate >= 67.6,
    `global compatibilityRate regressed: ${evaluation.summary.compatibilityRate}%`,
  );
});
