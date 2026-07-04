import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const engine = fs.readFileSync("src/lib/playbook-engine/operational-intelligence-engine.ts", "utf8");
const state = fs.readFileSync("src/lib/playbook-engine/operational-intelligence-state.ts", "utf8");
const types = fs.readFileSync("src/lib/playbook-engine/operational-intelligence-types.ts", "utf8");
const mappers = fs.readFileSync("src/lib/playbook-engine/operational-intelligence-mappers.ts", "utf8");
const indexFile = fs.readFileSync("src/lib/playbook-engine/index.ts", "utf8");

// ─── Exports ──────────────────────────────────────────────────────────────────

test("operational intelligence engine functions are exported from the module", () => {
  for (const fn of [
    "selectOperationalDraftTypesForRecommendation",
    "generateOperationalDraftsFromRecommendation",
    "generateOperationalDraftsFromRecommendations",
    "explainOperationalDraftGeneration",
    "mergeOperationalDrafts",
  ]) {
    assert.match(indexFile, new RegExp(fn), `index.ts must re-export ${fn}`);
    assert.match(engine, new RegExp(`export function ${fn}`), `operational-intelligence-engine.ts must define ${fn}`);
  }
});

test("operational draft state helpers are exported from the module", () => {
  for (const fn of ["markOperationalDraftReviewed", "approveOperationalDraft", "convertOperationalDraft", "discardOperationalDraft"]) {
    assert.match(indexFile, new RegExp(fn), `index.ts must re-export ${fn}`);
    assert.match(state, new RegExp(`export function ${fn}`), `operational-intelligence-state.ts must define ${fn}`);
  }
});

test("RAID/decision mappers are exported and never persist", () => {
  for (const fn of ["operationalDraftToRaidItemInput", "operationalDraftToDecisionInput"]) {
    assert.match(indexFile, new RegExp(fn), `index.ts must re-export ${fn}`);
    assert.match(mappers, new RegExp(`export function ${fn}`), `operational-intelligence-mappers.ts must define ${fn}`);
  }
  assert.doesNotMatch(mappers, /supabase|\.insert\(|\.from\(/i, "mappers must never persist anything");
});

test("core operational draft types are exported from the module", () => {
  for (const typeName of ["OperationalDraft", "OperationalDraftType", "OperationalDraftStatus", "RiskDraft", "IssueDraft", "DependencyDraft", "DecisionDraft"]) {
    assert.match(indexFile, new RegExp(typeName), `index.ts must re-export ${typeName}`);
    assert.match(types, new RegExp(`export type ${typeName}`), `operational-intelligence-types.ts must define ${typeName}`);
  }
});

// ─── Status transition graph ─────────────────────────────────────────────────

test("discarded and converted are terminal states in the transition graph", () => {
  assert.match(state, /discarded: \[\]/);
  assert.match(state, /converted: \[\]/);
});

test("converted is only reachable from approved (no automatic conversion path)", () => {
  assert.match(state, /approved: \["converted", "discarded"\]/);
});

// ─── Reuse, not duplication ─────────────────────────────────────────────────

test("mappers reuse RAID's canonicalRaidFingerprint and RaidCategory instead of inventing a parallel RAID model", () => {
  assert.match(mappers, /import \{ canonicalRaidFingerprint \} from "\.\.\/raid\/extraction"/);
  assert.match(mappers, /import type \{ RaidCategory \} from "\.\.\/raid\/types"/);
});

test("mappers reuse decision-governance's DecisionType/DecisionStatus instead of inventing a parallel decision model", () => {
  assert.match(mappers, /import type \{ DecisionStatus, DecisionType \} from "\.\.\/decision-governance\/types"/);
});

// ─── Runtime behavior probe ──────────────────────────────────────────────────

const runtimeProbe = String.raw`
import assert from "node:assert/strict";
import {
  SEED_DELIVERY_PLAYBOOK,
  generatePlaybookRecommendations,
  generateOperationalDraftsFromRecommendation,
  generateOperationalDraftsFromRecommendations,
  explainOperationalDraftGeneration,
  mergeOperationalDrafts,
  markOperationalDraftReviewed,
  approveOperationalDraft,
  convertOperationalDraft,
  discardOperationalDraft,
  operationalDraftToRaidItemInput,
  operationalDraftToDecisionInput,
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

// 1. high-severity risk without mitigation generates a RiskDraft.
const riskRec = {
  ...signoffRec,
  playbookRuleId: "pb-exec-critical-risks-open",
  title: "Riesgos críticos abiertos",
  detectedSituation: "Existen riesgos críticos sin mitigar durante la Ejecución.",
  recommendedAction: "Escalar y asignar owner a los riesgos críticos abiertos.",
  severity: "critical",
};
const riskDrafts = generateOperationalDraftsFromRecommendation(riskRec, {});
assert.equal(riskDrafts.ok, true);
assert.equal(riskDrafts.data.length, 1);
assert.equal(riskDrafts.data[0].type, "risk");
assert.equal(riskDrafts.data[0].mitigation, null);
assert.ok(riskDrafts.data[0].missingInputs.includes("mitigation"));
assert.equal(riskDrafts.data[0].escalationRecommended, true);

// 2 & 3. dependency without owner / without dueDate.
const dependencyRec = {
  ...signoffRec,
  playbookRuleId: "pb-any-open-dependency",
  title: "Dependencia interna abierta",
  detectedSituation: "Existe una dependencia interna pendiente de resolución.",
  recommendedAction: "Resolver la dependencia interna pendiente.",
  severity: "medium",
};
const dependencyDrafts = generateOperationalDraftsFromRecommendation(dependencyRec, {});
assert.equal(dependencyDrafts.ok, true);
assert.equal(dependencyDrafts.data.length, 1);
const dependencyDraft = dependencyDrafts.data[0];
assert.equal(dependencyDraft.type, "dependency");
assert.equal(dependencyDraft.owner, null);
assert.equal(dependencyDraft.dueDate, null);
assert.ok(dependencyDraft.missingInputs.includes("owner"), "missing owner must surface in missingInputs");
assert.ok(dependencyDraft.missingInputs.includes("dueDate"), "missing dueDate must surface in missingInputs");

// 4. client no response generates a DependencyDraft of type client.
const clientNoResponseRec = {
  ...signoffRec,
  playbookRuleId: "pb-any-client-no-response",
  title: "Cliente sin respuesta",
  detectedSituation: "El cliente no ha respondido a la última solicitud.",
  recommendedAction: "Enviar un seguimiento amistoso.",
  severity: "medium",
};
const clientDrafts = generateOperationalDraftsFromRecommendation(clientNoResponseRec, {});
assert.equal(clientDrafts.ok, true);
assert.equal(clientDrafts.data.length, 1);
assert.equal(clientDrafts.data[0].type, "dependency");
assert.equal(clientDrafts.data[0].dependencyType, "client");

// 5. decision without owner generates a DecisionDraft.
const decisionRec = {
  ...signoffRec,
  playbookRuleId: "pb-any-decision-pending",
  title: "Decisión pendiente sin dueño",
  detectedSituation: "Hay una decisión de alcance pendiente sin responsable asignado.",
  recommendedAction: "Asignar un dueño y solicitar la decisión al sponsor.",
  severity: "high",
};
const decisionDrafts = generateOperationalDraftsFromRecommendation(decisionRec, {});
assert.equal(decisionDrafts.ok, true);
assert.equal(decisionDrafts.data.length, 1);
const decisionDraft = decisionDrafts.data[0];
assert.equal(decisionDraft.type, "decision");
assert.equal(decisionDraft.decisionOwner, null);
assert.deepEqual(decisionDraft.options, []);
assert.ok(decisionDraft.missingInputs.includes("decisionOwner"));
assert.equal(decisionDraft.approvalRequired, true);

// 6. pending reception generates a DependencyDraft of type client.
const receptionDrafts = generateOperationalDraftsFromRecommendation(signoffRec, {});
assert.equal(receptionDrafts.ok, true);
assert.equal(receptionDrafts.data.length, 1);
assert.equal(receptionDrafts.data[0].type, "dependency");
assert.equal(receptionDrafts.data[0].dependencyType, "client");

// 7. pending reception with billing impact generates DependencyDraft + IssueDraft.
const invoiceRec = recommendations.find((r) => r.playbookRuleId === "pb-close-invoice-missing");
assert.ok(invoiceRec);
const receptionBillingRec = {
  ...signoffRec,
  playbookRuleId: "pb-close-signoff-billing-blocked",
  title: "Recepción pendiente bloquea facturación",
  detectedSituation: "El proyecto está técnicamente completo pero la recepción del cliente y la facturación siguen pendientes.",
  recommendedAction: "Solicitar la recepción formal para poder emitir la factura final.",
  severity: "critical",
};
const receptionBillingDrafts = generateOperationalDraftsFromRecommendation(receptionBillingRec, {});
assert.equal(receptionBillingDrafts.ok, true);
assert.equal(receptionBillingDrafts.data.length, 2);
assert.ok(receptionBillingDrafts.data.some((d) => d.type === "dependency" && d.dependencyType === "client"));
assert.ok(receptionBillingDrafts.data.some((d) => d.type === "issue"));

// 8. scope change generates DecisionDraft + RiskDraft (contractual/commercial).
const scopeChangeRec = {
  ...signoffRec,
  playbookRuleId: "pb-any-scope-change",
  title: "Posible cambio de alcance detectado",
  detectedSituation: "Se detectó un posible cambio de alcance no formalizado.",
  recommendedAction: "Evaluar el cambio de alcance y decidir si se formaliza mediante un change request.",
  severity: "high",
};
const scopeChangeDrafts = generateOperationalDraftsFromRecommendation(scopeChangeRec, {});
assert.equal(scopeChangeDrafts.ok, true);
assert.equal(scopeChangeDrafts.data.length, 2);
assert.ok(scopeChangeDrafts.data.some((d) => d.type === "decision"));
const scopeRisk = scopeChangeDrafts.data.find((d) => d.type === "risk");
assert.ok(scopeRisk);
assert.ok(["contractual", "commercial"].includes(scopeRisk.category));

// 9. draft carries linkedRecommendationId, playbookRuleId, evidenceUsed, missingEvidence.
assert.equal(dependencyDraft.linkedRecommendationId, dependencyRec.id);
assert.equal(dependencyDraft.playbookRuleId, "pb-any-open-dependency");
assert.deepEqual(dependencyDraft.evidenceUsed, dependencyRec.evidenceUsed);
assert.deepEqual(dependencyDraft.missingEvidence, dependencyRec.missingEvidence);

// 10. draft never invents owner/dueDate/decisionOwner/externalParty; providing them clears missingInputs.
const dependencyWithOwner = generateOperationalDraftsFromRecommendation(dependencyRec, { owner: "Jane Doe", dueDate: "2026-08-01" });
assert.equal(dependencyWithOwner.data[0].owner, "Jane Doe");
assert.equal(dependencyWithOwner.data[0].dueDate, "2026-08-01");
assert.ok(!dependencyWithOwner.data[0].missingInputs.includes("owner"));
assert.ok(!dependencyWithOwner.data[0].missingInputs.includes("dueDate"));

// 11. two identical generations produce the same fingerprint (idempotent).
const dependencyAgain = generateOperationalDraftsFromRecommendation(dependencyRec, { owner: "Jane Doe", dueDate: "2026-08-01" });
assert.equal(dependencyAgain.data[0].fingerprint, dependencyWithOwner.data[0].fingerprint);
assert.equal(dependencyAgain.data[0].id, dependencyWithOwner.data[0].id);

// 12. mergeOperationalDrafts never duplicates by fingerprint and preserves prior status.
const reviewed = markOperationalDraftReviewed(dependencyWithOwner.data[0]);
assert.equal(reviewed.ok, true);
const merged = mergeOperationalDrafts([reviewed.data], [dependencyAgain.data[0]]);
const fingerprints = merged.map((d) => d.fingerprint);
assert.equal(new Set(fingerprints).size, fingerprints.length, "merge must not duplicate fingerprints");
const mergedDraft = merged.find((d) => d.fingerprint === dependencyWithOwner.data[0].fingerprint);
assert.equal(mergedDraft.status, "reviewed", "merge must preserve the previously recorded human decision status");

// 13. generateOperationalDraftsFromRecommendations dedupes across a batch.
const batch = generateOperationalDraftsFromRecommendations([dependencyRec, dependencyRec], {});
assert.equal(batch.ok, true);
assert.equal(batch.data.length, 1, "the same recommendation processed twice must not produce duplicate drafts");

// 14. explainOperationalDraftGeneration mentions it was never converted automatically.
const explanation = explainOperationalDraftGeneration(dependencyWithOwner.data[0]);
assert.match(explanation.narrative, /no fue convertido automáticamente/i);
assert.equal(explanation.supportingRule, "pb-any-open-dependency");
assert.equal(explanation.originRecommendation, dependencyRec.id);

// 15. state machine: discarded can never become converted; converted is terminal.
const discarded = discardOperationalDraft(dependencyWithOwner.data[0]);
assert.equal(discarded.ok, true);
const discardedToConverted = convertOperationalDraft(discarded.data);
assert.equal(discardedToConverted.ok, false, "discarded must never transition to converted");

const approved = approveOperationalDraft(reviewed.data);
assert.equal(approved.ok, true);
const converted = convertOperationalDraft(approved.data);
assert.equal(converted.ok, true);
assert.equal(converted.data.status, "converted");
const convertedAgain = markOperationalDraftReviewed(converted.data);
assert.equal(convertedAgain.ok, false, "converted must be a final state with no further transitions");

// 16. mappers to RAID/decision input never persist and route by draft type.
const raidInput = operationalDraftToRaidItemInput(dependencyWithOwner.data[0]);
assert.equal(raidInput.category, "dependency");
assert.equal(raidInput.workspaceId, dependencyRec.workspaceId);
const raidInputForDecision = operationalDraftToRaidItemInput(decisionDraft);
assert.equal(raidInputForDecision, null, "decision drafts must never map to a RAID item");

const decisionInput = operationalDraftToDecisionInput(decisionDraft);
assert.equal(decisionInput.decision_status, "draft");
assert.equal(decisionInput.recommendation_id, decisionRec.id);
const decisionInputForIssue = operationalDraftToDecisionInput(receptionBillingDrafts.data.find((d) => d.type === "issue"));
assert.equal(decisionInputForIssue, null, "issue drafts must never map to a decision input");

const payload = {
  riskDraftType: riskDrafts.data[0].type,
  scopeChangeDraftTypes: scopeChangeDrafts.data.map((d) => d.type).sort(),
  receptionBillingDraftTypes: receptionBillingDrafts.data.map((d) => d.type).sort(),
};
console.log(JSON.stringify(payload));
`;

const runtime = JSON.parse(execFileSync("npx", ["tsx", "--eval", runtimeProbe], { encoding: "utf8" }).trim().split("\n").at(-1));

test("operational intelligence runtime probe: risk draft generated for unmitigated critical risk", () => {
  assert.equal(runtime.riskDraftType, "risk");
});

test("operational intelligence runtime probe: scope change generates decision + risk drafts", () => {
  assert.deepEqual(runtime.scopeChangeDraftTypes, ["decision", "risk"]);
});

test("operational intelligence runtime probe: reception blocking billing generates dependency + issue drafts", () => {
  assert.deepEqual(runtime.receptionBillingDraftTypes, ["dependency", "issue"]);
});
