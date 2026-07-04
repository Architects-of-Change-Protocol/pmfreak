import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const draftEngine = fs.readFileSync("src/lib/playbook-engine/communication-draft-engine.ts", "utf8");
const templates = fs.readFileSync("src/lib/playbook-engine/communication-templates.ts", "utf8");
const state = fs.readFileSync("src/lib/playbook-engine/communication-state.ts", "utf8");
const types = fs.readFileSync("src/lib/playbook-engine/communication-types.ts", "utf8");
const indexFile = fs.readFileSync("src/lib/playbook-engine/index.ts", "utf8");

// ─── Exports ──────────────────────────────────────────────────────────────────

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

test("communication draft state helpers are exported from the module", () => {
  for (const fn of ["markDraftReviewed", "approveDraft", "markDraftCopied", "markDraftSentManually", "discardDraft"]) {
    assert.match(indexFile, new RegExp(fn), `index.ts must re-export ${fn}`);
    assert.match(state, new RegExp(`export function ${fn}`), `communication-state.ts must define ${fn}`);
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

// ─── Status transition graph ─────────────────────────────────────────────────

test("discarded and sent_manually are terminal states in the transition graph", () => {
  assert.match(state, /discarded: \[\]/);
  assert.match(state, /sent_manually: \[\]/);
});

test("no automated send exists: the module never calls an email provider or send function", () => {
  assert.doesNotMatch(draftEngine, /sendEmail|resend\.com/i);
  assert.doesNotMatch(state, /sendEmail|resend\.com/i);
});

// ─── Runtime behavior probe ──────────────────────────────────────────────────

const runtimeProbe = String.raw`
import assert from "node:assert/strict";
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
} from "./src/lib/playbook-engine/index.ts";

const baseContext = {
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
};

const recResult = generatePlaybookRecommendations(baseContext, SEED_DELIVERY_PLAYBOOK);
assert.equal(recResult.ok, true);
const { recommendations } = recResult.data;

const signoffRec = recommendations.find((r) => r.playbookRuleId === "pb-close-signoff-missing");
assert.ok(signoffRec, "pb-close-signoff-missing must fire when hasClientSignoff is false");

const invoiceRec = recommendations.find((r) => r.playbookRuleId === "pb-close-invoice-missing");
assert.ok(invoiceRec, "pb-close-invoice-missing must fire when hasFinalInvoiceIssued is false");

// 1. reception/sign-off recommendation selects reception_request.
assert.equal(selectCommunicationTemplateForRecommendation(signoffRec), "reception_request");

// 2. billing blocker recommendation selects billing_enablement_follow_up.
assert.equal(selectCommunicationTemplateForRecommendation(invoiceRec), "billing_enablement_follow_up");

// 3. client no response, low/medium severity -> soft_follow_up.
const clientNoResponseMedium = {
  ...signoffRec,
  playbookRuleId: "pb-any-client-no-response",
  title: "Cliente sin respuesta",
  detectedSituation: "El cliente no ha respondido a la última solicitud.",
  recommendedAction: "Enviar un seguimiento amistoso.",
  severity: "medium",
};
assert.equal(selectCommunicationTemplateForRecommendation(clientNoResponseMedium), "soft_follow_up");

// 4. client no response, high/critical severity -> formal_follow_up or soft_escalation.
const clientNoResponseHigh = { ...clientNoResponseMedium, severity: "high" };
const clientNoResponseCritical = { ...clientNoResponseMedium, severity: "critical" };
assert.equal(selectCommunicationTemplateForRecommendation(clientNoResponseHigh), "formal_follow_up");
assert.equal(selectCommunicationTemplateForRecommendation(clientNoResponseCritical), "soft_escalation");

// 5. decision recommendation selects decision_request.
const decisionRec = {
  ...signoffRec,
  playbookRuleId: "pb-any-decision-pending",
  title: "Decisión pendiente sin dueño",
  detectedSituation: "Hay una decisión de alcance pendiente sin responsable asignado.",
  recommendedAction: "Asignar un dueño y solicitar la decisión al sponsor.",
  severity: "high",
};
assert.equal(selectCommunicationTemplateForRecommendation(decisionRec), "decision_request");

// 6. no clear match falls back to formal_follow_up.
const noMatchRec = {
  ...signoffRec,
  playbookRuleId: "pb-exec-critical-risks-open",
  title: "Riesgos críticos abiertos",
  detectedSituation: "Existen riesgos críticos sin mitigar durante la Ejecución.",
  recommendedAction: "Escalar y asignar owner a los riesgos críticos abiertos.",
  severity: "critical",
};
assert.equal(selectCommunicationTemplateForRecommendation(noMatchRec), "formal_follow_up");

// 7. draft generation without recipients: never invents them, flags missingInputs.
const draftNoRecipients = generateCommunicationDraftFromRecommendation(signoffRec, {});
assert.equal(draftNoRecipients.ok, true);
assert.deepEqual(draftNoRecipients.data.recipients, []);
assert.ok(draftNoRecipients.data.missingInputs.includes("recipients"), "missing recipients must surface in missingInputs");
assert.match(draftNoRecipients.data.body, /PENDIENTE/);

// 8. draft carries linkedRecommendationId, playbookRuleId, evidenceUsed, missingEvidence, approvalRequired.
assert.equal(draftNoRecipients.data.linkedRecommendationId, signoffRec.id);
assert.equal(draftNoRecipients.data.playbookRuleId, "pb-close-signoff-missing");
assert.deepEqual(draftNoRecipients.data.evidenceUsed, signoffRec.evidenceUsed);
assert.deepEqual(draftNoRecipients.data.missingEvidence, signoffRec.missingEvidence);
assert.equal(draftNoRecipients.data.approvalRequired, true);
assert.equal(draftNoRecipients.data.externalSendRequiresApproval, true);
assert.equal(draftNoRecipients.data.templateId, "reception_request");
assert.equal(draftNoRecipients.data.status, "draft");

// 9. draft generation with a real recipient populates recipients and clears that missingInput.
const draftWithRecipient = generateCommunicationDraftFromRecommendation(signoffRec, {
  projectName: "Proyecto Acme",
  recipients: [{ name: "Jane Doe", email: "jane@acme.com", role: "client" }],
});
assert.equal(draftWithRecipient.ok, true);
assert.equal(draftWithRecipient.data.recipients.length, 1);
assert.ok(!draftWithRecipient.data.missingInputs.includes("recipients"));
assert.match(draftWithRecipient.data.subject ?? "", /Proyecto Acme/);
assert.match(draftWithRecipient.data.body, /Jane Doe/);

// 10. two identical generations produce the same fingerprint (idempotent).
const draftAgain = generateCommunicationDraftFromRecommendation(signoffRec, {
  projectName: "Proyecto Acme",
  recipients: [{ name: "Jane Doe", email: "jane@acme.com", role: "client" }],
});
assert.equal(draftAgain.data.fingerprint, draftWithRecipient.data.fingerprint);
assert.equal(draftAgain.data.id, draftWithRecipient.data.id);

// 11. mergeCommunicationDrafts never duplicates by fingerprint and preserves prior status.
const reviewed = markDraftReviewed(draftWithRecipient.data);
assert.equal(reviewed.ok, true);
const merged = mergeCommunicationDrafts([reviewed.data], [draftAgain.data]);
const fingerprints = merged.map((d) => d.fingerprint);
assert.equal(new Set(fingerprints).size, fingerprints.length, "merge must not duplicate fingerprints");
const mergedDraft = merged.find((d) => d.fingerprint === draftWithRecipient.data.fingerprint);
assert.equal(mergedDraft.status, "reviewed", "merge must preserve the previously recorded human decision status");

// 12. explainCommunicationDraftGeneration mentions it was never sent automatically.
const explanation = explainCommunicationDraftGeneration(draftWithRecipient.data);
assert.match(explanation.narrative, /no fue enviado automáticamente/i);
assert.equal(explanation.supportingRule, "pb-close-signoff-missing");
assert.equal(explanation.originRecommendation, signoffRec.id);

// 13. state machine: discarded can never become sent_manually.
const discarded = discardDraft(draftWithRecipient.data);
assert.equal(discarded.ok, true);
assert.equal(discarded.data.status, "discarded");
const discardedToSent = markDraftSentManually(discarded.data);
assert.equal(discardedToSent.ok, false, "discarded must never transition to sent_manually");

// 14. sent_manually is a terminal state.
const approved = approveDraft(reviewed.data);
assert.equal(approved.ok, true);
assert.equal(approved.data.status, "approved");
const copied = markDraftCopied(approved.data);
assert.equal(copied.ok, true);
const sent = markDraftSentManually(copied.data);
assert.equal(sent.ok, true);
assert.equal(sent.data.status, "sent_manually");
const sentAgain = markDraftReviewed(sent.data);
assert.equal(sentAgain.ok, false, "sent_manually must be a final state with no further transitions");

const payload = {
  recommendationCount: recommendations.length,
  signoffTemplate: draftWithRecipient.data.templateId,
  missingInputsWithoutRecipient: draftNoRecipients.data.missingInputs,
};
console.log(JSON.stringify(payload));
`;

const runtime = JSON.parse(execFileSync("npx", ["tsx", "--eval", runtimeProbe], { encoding: "utf8" }).trim().split("\n").at(-1));

test("communications playbook runtime probe: reception_request template chosen for signoff recommendation", () => {
  assert.equal(runtime.signoffTemplate, "reception_request");
});

test("communications playbook runtime probe: missing recipients are reported without invention", () => {
  assert.deepEqual(runtime.missingInputsWithoutRecipient, ["recipients"]);
});
