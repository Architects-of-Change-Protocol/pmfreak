import test from "node:test";
import assert from "node:assert/strict";

import {
  mapEnrichedIntentToProductionIntent,
  compareProductionAndEnrichedIntent,
  runIntentClassifierShadowComparison,
  explainIntentCompatibilityMapping,
} from "../src/lib/playbook-engine/conversation/classifier/intentCompatibilityAdapter.ts";
import { classifyConversationIntent as classifyEnrichedIntent } from "../src/lib/conversational-brain/intent-classifier.ts";
import { classifyConversationIntent as classifyProductionIntent } from "../src/lib/playbook-engine/conversation/classifier/intentClassifier.ts";

const baseInput = (message, overrides = {}) => ({
  workspaceId: "ws_1",
  userId: "user_1",
  message,
  ...overrides,
});

const enrichedFor = (message, overrides = {}) => classifyEnrichedIntent(baseInput(message, overrides)).intent;

// ─── Mapping table: one test per documented rule ───────────────────────────────

test("billing phrase maps to billing_question", () => {
  const enriched = enrichedFor("¿Ya podemos facturar?");
  assert.equal(enriched.intentFamily, "closure_billing");
  const result = mapEnrichedIntentToProductionIntent(enriched);
  assert.equal(result.productionIntent, "billing_question");
});

test("closure phrase maps to closure_question", () => {
  const enriched = enrichedFor("¿Podemos cerrar el proyecto?");
  assert.equal(enriched.intentFamily, "closure_billing");
  const result = mapEnrichedIntentToProductionIntent(enriched);
  assert.equal(result.productionIntent, "closure_question");
});

test("communication phrase maps to communication_draft", () => {
  const enriched = enrichedFor("Redactame un correo");
  assert.equal(enriched.intentFamily, "communication_draft");
  const result = mapEnrichedIntentToProductionIntent(enriched);
  assert.equal(result.productionIntent, "communication_draft");
});

test("playbook recommendation maps to recommendation_request", () => {
  const enriched = enrichedFor("¿Qué recomienda el playbook?");
  assert.equal(enriched.intentFamily, "playbook_analysis");
  const result = mapEnrichedIntentToProductionIntent(enriched);
  assert.equal(result.productionIntent, "recommendation_request");
});

test("risk phrase maps to risk_analysis", () => {
  const enriched = enrichedFor("¿Qué riesgos hay?");
  assert.equal(enriched.intentFamily, "risk_issue_dependency");
  const result = mapEnrichedIntentToProductionIntent(enriched);
  assert.equal(result.productionIntent, "risk_analysis");
});

test("project status phrase maps to project_status_question", () => {
  const enriched = enrichedFor("¿Cómo va el proyecto?");
  assert.equal(enriched.intentFamily, "project_status");
  const result = mapEnrichedIntentToProductionIntent(enriched);
  assert.equal(result.productionIntent, "project_status_question");
});

test("task phrase maps to task_or_action_request", () => {
  const enriched = enrichedFor("Creá una tarea");
  assert.equal(enriched.intentFamily, "task_action");
  const result = mapEnrichedIntentToProductionIntent(enriched);
  assert.equal(result.productionIntent, "task_or_action_request");
});

test("governance why/evidence maps to governance_question", () => {
  const enriched = enrichedFor("¿Qué evidencia usaste?");
  assert.equal(enriched.intentFamily, "governance_audit");
  assert.equal(enriched.intentType, "evidence_request");
  const result = mapEnrichedIntentToProductionIntent(enriched);
  assert.equal(result.productionIntent, "governance_question");
});

test("audit trail (why did you recommend) maps to audit_question", () => {
  const enriched = enrichedFor("¿Por qué recomendaste esto?");
  assert.equal(enriched.intentFamily, "governance_audit");
  const result = mapEnrichedIntentToProductionIntent(enriched);
  assert.equal(result.productionIntent, "audit_question");
});

test("decision_support produces documented warning and maps to unsupported", () => {
  const enriched = enrichedFor("¿Qué decisión falta?");
  assert.equal(enriched.intentFamily, "decision_support");
  const result = mapEnrichedIntentToProductionIntent(enriched);
  assert.equal(result.productionIntent, "unsupported");
  assert.ok(result.warnings.some((w) => w.code === "decision_support_no_production_equivalent"));
});

test("unknown maps safely to unsupported", () => {
  const enriched = enrichedFor("asdkjh qwoiue zxcvbn poiuyt lkjhgf");
  assert.equal(enriched.intentFamily, "unknown");
  const result = mapEnrichedIntentToProductionIntent(enriched);
  assert.equal(result.productionIntent, "unsupported");
});

test("needs_clarification maps safely to general_pm_advice with a documented warning", () => {
  const enriched = enrichedFor("revisá esto");
  assert.equal(enriched.intentFamily, "needs_clarification");
  const result = mapEnrichedIntentToProductionIntent(enriched);
  assert.equal(result.productionIntent, "general_pm_advice");
  assert.ok(result.warnings.some((w) => w.code === "needs_clarification_mapped_to_general_pm_advice"));
});

test("closure_billing reception/acceptance subtypes fall back to closure_question with an info warning", () => {
  // reception_status_check / acceptance_status_check don't literally start with billing_/closure_.
  const enriched = {
    intentFamily: "closure_billing",
    intentType: "reception_status_check",
    confidence: "medium",
    score: 5,
    rationale: "test fixture",
    requiresProjectContext: true,
    requiresEvidence: true,
    mayRequireApproval: true,
    isActionRequest: false,
    isExternalCommunicationRequest: false,
    isReadOnly: true,
    candidateRoutes: ["closure_billing_engine"],
    detectedSignals: [],
    missingClarifications: [],
    createdAt: "2026-07-06T00:00:00.000Z",
  };
  const result = mapEnrichedIntentToProductionIntent(enriched);
  assert.equal(result.productionIntent, "closure_question");
  assert.ok(result.warnings.some((w) => w.code === "closure_billing_subtype_not_billing_or_closure_prefixed"));
});

// ─── Shadow comparison ───────────────────────────────────────────────────────────

test("shadow comparison returns productionIntent/enrichedIntent/mappedIntent", () => {
  const result = runIntentClassifierShadowComparison(baseInput("¿Ya podemos facturar?"));
  assert.equal(typeof result.productionIntent, "string");
  assert.equal(typeof result.enrichedIntent, "object");
  assert.equal(typeof result.enrichedIntent.intentFamily, "string");
  assert.equal(typeof result.mappedIntent, "string");
  assert.equal(typeof result.compatible, "boolean");
  assert.ok(Array.isArray(result.differences));
  assert.ok(Array.isArray(result.migrationWarnings));
});

test("shadow comparison reports compatible=true when production and mapped intents agree", () => {
  const result = runIntentClassifierShadowComparison(baseInput("Redactame un correo"));
  assert.equal(result.productionIntent, "communication_draft");
  assert.equal(result.mappedIntent, "communication_draft");
  assert.equal(result.compatible, true);
  assert.equal(result.differences.length, 0);
});

test("compareProductionAndEnrichedIntent accepts pre-computed classifications without re-running them", () => {
  const message = "¿Qué riesgos hay?";
  const productionClassification = classifyProductionIntent(message);
  const { intent: enrichedIntent } = classifyEnrichedIntent(baseInput(message));
  const result = compareProductionAndEnrichedIntent({ productionClassification, enrichedIntent });
  assert.equal(result.productionIntent, productionClassification.intent);
  assert.equal(result.enrichedIntent, enrichedIntent);
});

test("shadow comparison flags a mismatch with a migration warning when production and mapped intent diverge", () => {
  // decision_support always maps to "unsupported"; production's own classifier has no
  // decision_support concept and will classify PM-domain vocabulary as something else (or
  // fall through to general_pm_advisor territory), so this is expected to diverge.
  const result = runIntentClassifierShadowComparison(baseInput("¿Qué decisión falta para avanzar?"));
  assert.equal(result.mappedIntent, "unsupported");
  if (!result.compatible) {
    assert.ok(result.migrationWarnings.some((w) => w.code === "production_enriched_mismatch"));
    assert.ok(result.differences.length > 0);
  }
});

// ─── Safety: shadow mode never calls DB/router/composer/handlers ──────────────────

test("shadow comparison does not call a database or external service", async () => {
  const fs = await import("node:fs");
  const content = fs.readFileSync(
    new URL("../src/lib/playbook-engine/conversation/classifier/intentCompatibilityAdapter.ts", import.meta.url),
    "utf8",
  );
  const forbidden = [
    /from\s+["'][^"']*supabase[^"']*["']/i,
    /\bfetch\(/,
    /\bsendEmail\s*\(/i,
    /\bcreatePlatformEvent\s*\(/i,
    /from\s+["'][^"']*gmail[^"']*["']/i,
    /\bcreateTask\s*\(/i,
    /\bcreateRaidItem\s*\(/i,
  ];
  for (const re of forbidden) {
    assert.doesNotMatch(content, re, `intentCompatibilityAdapter.ts must not match ${re}`);
  }
});

test("shadow comparison does not import router/composer/handlers", async () => {
  const fs = await import("node:fs");
  const content = fs.readFileSync(
    new URL("../src/lib/playbook-engine/conversation/classifier/intentCompatibilityAdapter.ts", import.meta.url),
    "utf8",
  );
  // Comments are allowed to *mention* router/composer/gateway filenames for documentation
  // purposes (e.g. "see brainRouter.ts") — what must never appear is an actual import/require of
  // one of those modules.
  const forbiddenImports = [
    /from\s+["'][^"']*brainRouter[^"']*["']/,
    /from\s+["'][^"']*responseComposer[^"']*["']/,
    /from\s+["'][^"']*\/handlers\/[^"']*["']/,
    /from\s+["'][^"']*conversationalBrainGateway[^"']*["']/,
    /require\(\s*["'][^"']*(brainRouter|responseComposer|\/handlers\/|conversationalBrainGateway)[^"']*["']\s*\)/,
  ];
  for (const re of forbiddenImports) {
    assert.doesNotMatch(content, re, `intentCompatibilityAdapter.ts must not import from ${re}`);
  }
});

test("no production behavior changed: production classifier result is untouched by the adapter", () => {
  const message = "¿Cómo va el proyecto?";
  const directResult = classifyProductionIntent(message);
  const shadowResult = runIntentClassifierShadowComparison(baseInput(message));
  assert.equal(shadowResult.productionIntent, directResult.intent);
  // Calling the shadow comparison a second time must not mutate or memoize anything that changes
  // the production classifier's own direct output.
  const directResultAgain = classifyProductionIntent(message);
  assert.deepEqual(directResultAgain, directResult);
});

// ─── explainIntentCompatibilityMapping ──────────────────────────────────────────

test("explainIntentCompatibilityMapping documents scope, mapping table, and remaining risks", () => {
  const explain = explainIntentCompatibilityMapping();
  assert.equal(typeof explain.capability, "string");
  assert.ok(Array.isArray(explain.doesNot) && explain.doesNot.length > 0);
  assert.ok(Array.isArray(explain.mappingTable) && explain.mappingTable.length >= 12);
  assert.ok(Array.isArray(explain.documentedDecisions) && explain.documentedDecisions.length > 0);
  assert.ok(Array.isArray(explain.remainingRisks) && explain.remainingRisks.length > 0);
});
