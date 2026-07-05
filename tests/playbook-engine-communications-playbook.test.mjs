import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  SEED_DELIVERY_PLAYBOOK,
  generatePlaybookRecommendations,
  selectCommunicationTemplateForRecommendation,
  generateCommunicationDraftFromRecommendation,
  explainCommunicationDraftGeneration,
  mergeCommunicationDrafts,
  markDraftReviewed,
  approveDraft,
  markDraftCopied,
  markDraftSentManually,
  discardDraft,
} from "../src/lib/playbook-engine/index.ts";

const draftEngine = fs.readFileSync("src/lib/playbook-engine/communication-draft-engine.ts", "utf8");
const templates = fs.readFileSync("src/lib/playbook-engine/communication-templates.ts", "utf8");
const state = fs.readFileSync("src/lib/playbook-engine/communication-state.ts", "utf8");
const indexFile = fs.readFileSync("src/lib/playbook-engine/index.ts", "utf8");

// ─── Exports (static) ───────────────────────────────────────────────────────────

test("communication draft engine functions are exported from the module", () => {
  for (const fn of [
    "selectCommunicationTemplateForRecommendation",
    "generateCommunicationDraftFromRecommendation",
    "explainCommunicationDraftGeneration",
    "mergeCommunicationDrafts",
  ]) {
    assert.match(indexFile, new RegExp(fn), `index.ts must re-export ${fn}`);
    assert.match(draftEngine, new RegExp(`export function ${fn}`), `communication-draft-engine.ts must define ${fn}`);
  }
});

test("COMMUNICATION_TEMPLATES seed is exported and includes all 11 required templates", () => {
  assert.match(indexFile, /COMMUNICATION_TEMPLATES/);
  for (const id of [
    "soft_follow_up",
    "formal_follow_up",
    "reception_request",
    "billing_enablement_follow_up",
    "soft_escalation",
    "formal_escalation",
    "meeting_minutes",
    "decision_request",
    "information_request",
    "closure_confirmation",
    "scope_change_notice",
  ]) {
    assert.match(templates, new RegExp(`${id}: \\{`), `communication-templates.ts must define template '${id}'`);
  }
});

test("every template declares externalSendRequiresApproval: true", () => {
  const occurrences = templates.match(/externalSendRequiresApproval: true/g) ?? [];
  assert.ok(occurrences.length >= 11, "every one of the 11 templates must set externalSendRequiresApproval: true");
});

test("discarded and sent_manually are terminal states in the transition graph", () => {
  assert.match(state, /discarded: \[\]/);
  assert.match(state, /sent_manually: \[\]/);
});

test("no automated send exists: the module never calls an email provider or send function", () => {
  assert.doesNotMatch(draftEngine, /sendEmail|resend\.com/i);
  assert.doesNotMatch(state, /sendEmail|resend\.com/i);
});

// ─── Runtime behavior (direct import) ──────────────────────────────────────────

function baseContext(overrides = {}) {
  return {
    projectId: "00000000-0000-0000-0000-000000000001",
    workspaceId: "00000000-0000-0000-0000-000000000002",
    phase: "cierre",
    hasApprovedCharter: true,
    hasApprovedConstitution: true,
    hasScopeBaseline: true,
    hasWbs: true,
    hasScheduleBaseline: true,
    hasBudgetBaseline: true,
    hasRiskRegister: true,
    hasStakeholderMap: true,
    hasCommunicationsPlan: true,
    hasClosureChecklistStarted: true,
    hasFinalInvoiceIssued: false,
    hasClientSignoff: false,
    openCriticalRisks: null,
    openHighRisks: null,
    openIssues: null,
    overdueTasks: null,
    daysSinceLastStatusUpdate: null,
    scheduleVarianceDays: null,
    budgetVariancePercent: null,
    metadata: {},
    ...overrides,
  };
}

function recommendations(overrides = {}) {
  const result = generatePlaybookRecommendations(baseContext(overrides), SEED_DELIVERY_PLAYBOOK);
  assert.equal(result.ok, true);
  return result.data.recommendations;
}

function findRec(id, overrides = {}) {
  const rec = recommendations(overrides).find((r) => r.playbookRuleId === id);
  assert.ok(rec, `${id} must fire for this context`);
  return rec;
}

// ─── Structured (rule-id) template selection — Hardening Sprint ────────────────

test("selection is rule-id-first: every known seed rule resolves via the structured lookup, not prose", () => {
  const expected = {
    "pb-close-signoff-missing": "reception_request",
    "pb-close-invoice-missing": "billing_enablement_follow_up",
    "pb-close-checklist-not-started": "information_request",
  };
  for (const [ruleId, templateId] of Object.entries(expected)) {
    const rec = findRec(ruleId, { hasClosureChecklistStarted: false });
    assert.equal(selectCommunicationTemplateForRecommendation(rec), templateId);
  }
});

test("structured lookup survives a prose edit to the rule's text (regression guard for the regex-fragility finding)", () => {
  const rec = findRec("pb-close-signoff-missing");
  // Simulate a future copy-edit to the rule's wording that no longer contains "sign-off"/"recepción" —
  // the old text-only classifier would have silently stopped selecting reception_request here.
  const reworded = { ...rec, title: "Confirmación pendiente", detectedSituation: "Falta confirmación formal del cliente.", recommendedAction: "Solicitar confirmación." };
  assert.equal(selectCommunicationTemplateForRecommendation(reworded), "reception_request");
});

test("an unknown playbookRuleId falls through to the text/severity regex classifier (fallback path still works)", () => {
  const clientNoResponseMedium = {
    ...findRec("pb-close-signoff-missing"),
    playbookRuleId: "pb-any-client-no-response",
    title: "Cliente sin respuesta",
    detectedSituation: "El cliente no ha respondido a la última solicitud.",
    recommendedAction: "Enviar un seguimiento amistoso.",
    severity: "medium",
  };
  assert.equal(selectCommunicationTemplateForRecommendation(clientNoResponseMedium), "soft_follow_up");

  const clientNoResponseHigh = { ...clientNoResponseMedium, severity: "high" };
  const clientNoResponseCritical = { ...clientNoResponseMedium, severity: "critical" };
  assert.equal(selectCommunicationTemplateForRecommendation(clientNoResponseHigh), "formal_follow_up");
  assert.equal(selectCommunicationTemplateForRecommendation(clientNoResponseCritical), "soft_escalation");

  const decisionRec = {
    ...clientNoResponseMedium,
    playbookRuleId: "pb-any-decision-pending",
    title: "Decisión pendiente sin dueño",
    detectedSituation: "Hay una decisión de alcance pendiente sin responsable asignado.",
    recommendedAction: "Asignar un dueño y solicitar la decisión al sponsor.",
    severity: "high",
  };
  assert.equal(selectCommunicationTemplateForRecommendation(decisionRec), "decision_request");

  const noMatchRec = {
    ...clientNoResponseMedium,
    playbookRuleId: "pb-exec-critical-risks-open-adhoc",
    title: "Riesgos críticos abiertos",
    detectedSituation: "Existen riesgos críticos sin mitigar durante la Ejecución.",
    recommendedAction: "Escalar y asignar owner a los riesgos críticos abiertos.",
    severity: "critical",
  };
  assert.equal(selectCommunicationTemplateForRecommendation(noMatchRec), "formal_follow_up");
});

test("an explicit templateId pin always overrides auto-selection", () => {
  const rec = findRec("pb-close-signoff-missing");
  const draft = generateCommunicationDraftFromRecommendation(rec, {}, "closure_confirmation");
  assert.equal(draft.ok, true);
  assert.equal(draft.data.templateId, "closure_confirmation", "an explicit templateId must win over selectCommunicationTemplateForRecommendation");
});

// ─── Draft generation, idempotency, state machine ──────────────────────────────

test("draft generation without recipients never invents them and flags missingInputs", () => {
  const rec = findRec("pb-close-signoff-missing");
  const draft = generateCommunicationDraftFromRecommendation(rec, {});
  assert.equal(draft.ok, true);
  assert.deepEqual(draft.data.recipients, []);
  assert.ok(draft.data.missingInputs.includes("recipients"));
  assert.match(draft.data.body, /PENDIENTE/);
});

test("draft carries linkedRecommendationId, playbookRuleId, evidence, approvalRequired, template, status", () => {
  const rec = findRec("pb-close-signoff-missing");
  const draft = generateCommunicationDraftFromRecommendation(rec, {}).data;
  assert.equal(draft.linkedRecommendationId, rec.id);
  assert.equal(draft.playbookRuleId, "pb-close-signoff-missing");
  assert.deepEqual(draft.evidenceUsed, rec.evidenceUsed);
  assert.deepEqual(draft.missingEvidence, rec.missingEvidence);
  assert.equal(draft.approvalRequired, true);
  assert.equal(draft.externalSendRequiresApproval, true);
  assert.equal(draft.templateId, "reception_request");
  assert.equal(draft.status, "draft");
});

test("providing a real recipient populates recipients and clears that missingInput", () => {
  const rec = findRec("pb-close-signoff-missing");
  const draft = generateCommunicationDraftFromRecommendation(rec, {
    projectName: "Proyecto Acme",
    recipients: [{ name: "Jane Doe", email: "jane@acme.com", role: "client" }],
  }).data;
  assert.equal(draft.recipients.length, 1);
  assert.ok(!draft.missingInputs.includes("recipients"));
  assert.match(draft.subject ?? "", /Proyecto Acme/);
  assert.match(draft.body, /Jane Doe/);
});

test("two identical generations produce the same fingerprint/id (idempotent)", () => {
  const rec = findRec("pb-close-signoff-missing");
  const ctx = { projectName: "Proyecto Acme", recipients: [{ name: "Jane Doe", email: "jane@acme.com", role: "client" }] };
  const first = generateCommunicationDraftFromRecommendation(rec, ctx).data;
  const second = generateCommunicationDraftFromRecommendation(rec, ctx).data;
  assert.equal(second.fingerprint, first.fingerprint);
  assert.equal(second.id, first.id);
});

test("mergeCommunicationDrafts never duplicates by fingerprint and preserves prior status", () => {
  const rec = findRec("pb-close-signoff-missing");
  const ctx = { projectName: "Proyecto Acme", recipients: [{ name: "Jane Doe", email: "jane@acme.com", role: "client" }] };
  const first = generateCommunicationDraftFromRecommendation(rec, ctx).data;
  const reviewed = markDraftReviewed(first);
  assert.equal(reviewed.ok, true);
  const second = generateCommunicationDraftFromRecommendation(rec, ctx).data;
  const merged = mergeCommunicationDrafts([reviewed.data], [second]);
  const fingerprints = merged.map((d) => d.fingerprint);
  assert.equal(new Set(fingerprints).size, fingerprints.length, "merge must not duplicate fingerprints");
  const mergedDraft = merged.find((d) => d.fingerprint === first.fingerprint);
  assert.equal(mergedDraft.status, "reviewed", "merge must preserve the previously recorded human decision status");
});

test("explainCommunicationDraftGeneration always states the draft was never sent automatically", () => {
  const rec = findRec("pb-close-signoff-missing");
  const draft = generateCommunicationDraftFromRecommendation(rec, {
    recipients: [{ name: "Jane Doe", email: "jane@acme.com", role: "client" }],
  }).data;
  const explanation = explainCommunicationDraftGeneration(draft);
  assert.match(explanation.narrative, /no fue enviado automáticamente/i);
  assert.equal(explanation.supportingRule, "pb-close-signoff-missing");
  assert.equal(explanation.originRecommendation, rec.id);
});

test("state machine: discarded can never become sent_manually", () => {
  const rec = findRec("pb-close-signoff-missing");
  const draft = generateCommunicationDraftFromRecommendation(rec, {}).data;
  const discarded = discardDraft(draft);
  assert.equal(discarded.ok, true);
  assert.equal(discarded.data.status, "discarded");
  const result = markDraftSentManually(discarded.data);
  assert.equal(result.ok, false, "discarded must never transition to sent_manually");
});

test("state machine: sent_manually is a terminal state reached only through approved -> copied", () => {
  const rec = findRec("pb-close-signoff-missing");
  const draft = generateCommunicationDraftFromRecommendation(rec, {}).data;
  const reviewed = markDraftReviewed(draft).data;
  const approved = approveDraft(reviewed);
  assert.equal(approved.ok, true);
  assert.equal(approved.data.status, "approved");
  const copied = markDraftCopied(approved.data);
  assert.equal(copied.ok, true);
  const sent = markDraftSentManually(copied.data);
  assert.equal(sent.ok, true);
  assert.equal(sent.data.status, "sent_manually");
  const sentAgain = markDraftReviewed(sent.data);
  assert.equal(sentAgain.ok, false, "sent_manually must be a final state with no further transitions");
});

test("missing projectId/workspaceId on the recommendation fails validation", () => {
  const rec = findRec("pb-close-signoff-missing");
  const noProject = generateCommunicationDraftFromRecommendation({ ...rec, projectId: "" }, {});
  assert.equal(noProject.ok, false);
  assert.equal(noProject.failureClass, "validation_failed");
});
