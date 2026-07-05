import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  SEED_DELIVERY_PLAYBOOK,
  generatePlaybookRecommendations,
  selectOperationalDraftTypesForRecommendation,
  generateOperationalDraftsFromRecommendation,
  generateOperationalDraftsFromRecommendations,
  explainOperationalDraftGeneration,
  mergeOperationalDrafts,
  resolveOperationalDraftApprovalRequirement,
  markOperationalDraftReviewed,
  approveOperationalDraft,
  convertOperationalDraft,
  discardOperationalDraft,
  operationalDraftToRaidItemInput,
  operationalDraftToDecisionInput,
} from "../src/lib/playbook-engine/index.ts";

const engine = fs.readFileSync("src/lib/playbook-engine/operational-intelligence-engine.ts", "utf8");
const state = fs.readFileSync("src/lib/playbook-engine/operational-intelligence-state.ts", "utf8");
const types = fs.readFileSync("src/lib/playbook-engine/operational-intelligence-types.ts", "utf8");
const mappers = fs.readFileSync("src/lib/playbook-engine/operational-intelligence-mappers.ts", "utf8");
const indexFile = fs.readFileSync("src/lib/playbook-engine/index.ts", "utf8");

// ─── Exports (static) ───────────────────────────────────────────────────────────

test("operational intelligence engine functions are exported from the module", () => {
  for (const fn of [
    "selectOperationalDraftTypesForRecommendation",
    "generateOperationalDraftsFromRecommendation",
    "generateOperationalDraftsFromRecommendations",
    "explainOperationalDraftGeneration",
    "mergeOperationalDrafts",
    "resolveOperationalDraftApprovalRequirement",
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

test("discarded and converted are terminal states in the transition graph", () => {
  assert.match(state, /discarded: \[\]/);
  assert.match(state, /converted: \[\]/);
});

test("converted is only reachable from approved (no automatic conversion path)", () => {
  assert.match(state, /approved: \["converted", "discarded"\]/);
});

test("mappers reuse RAID's canonicalRaidFingerprint and RaidCategory instead of inventing a parallel RAID model", () => {
  assert.match(mappers, /import \{ canonicalRaidFingerprint \} from "\.\.\/raid\/extraction"/);
  assert.match(mappers, /import type \{ RaidCategory \} from "\.\.\/raid\/types"/);
});

test("mappers reuse decision-governance's DecisionType/DecisionStatus instead of inventing a parallel decision model", () => {
  assert.match(mappers, /import type \{ DecisionStatus, DecisionType \} from "\.\.\/decision-governance\/types"/);
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

/** pb-exec-critical-risks-open is scoped to "ejecucion", unlike the "cierre"-scoped rules used
 * as the base fixture elsewhere in this file — generate it in its own real phase/context. */
function criticalRisksOpenRec() {
  return findRec("pb-exec-critical-risks-open", { phase: "ejecucion", openCriticalRisks: 3 });
}

function adhoc(base, fields) {
  return { ...base, ...fields };
}

// ─── Structured (rule-id) classification — Hardening Sprint ────────────────────

test("classification is rule-id-first: known seed rules resolve via the structured lookup", () => {
  const riskRec = criticalRisksOpenRec();
  const riskBlueprints = selectOperationalDraftTypesForRecommendation(riskRec);
  assert.equal(riskBlueprints.length, 1);
  assert.equal(riskBlueprints[0].type, "risk");
  assert.equal(riskBlueprints[0].escalationRecommended, true, "pb-exec-critical-risks-open is always severity=critical");

  const signoffRec = findRec("pb-close-signoff-missing");
  const signoffBlueprints = selectOperationalDraftTypesForRecommendation(signoffRec);
  assert.equal(signoffBlueprints.length, 1);
  assert.equal(signoffBlueprints[0].type, "dependency");
  assert.equal(signoffBlueprints[0].dependencyType, "client");
});

test("structured lookup survives a prose edit to the rule's text (regression guard for the regex-fragility finding)", () => {
  const rec = findRec("pb-close-signoff-missing");
  const reworded = { ...rec, title: "Confirmación pendiente", detectedSituation: "Falta confirmación formal.", recommendedAction: "Solicitar confirmación." };
  const blueprints = selectOperationalDraftTypesForRecommendation(reworded);
  assert.equal(blueprints.length, 1);
  assert.equal(blueprints[0].type, "dependency");
});

test("a recommendation suggesting generate_project_constitution_draft never produces an operational draft", () => {
  const constitutionRec = adhoc(findRec("pb-close-signoff-missing"), {
    playbookRuleId: "pb-init-constitution-missing",
    title: "Constitución de proyecto no generada",
    detectedSituation: "No existe una Constitución de Proyecto aprobada para gobernar decisiones futuras.",
    recommendedAction: "Generar y someter a aprobación la Constitución del Proyecto.",
    severity: "critical",
    suggestedActions: [
      { action: "generate_project_constitution_draft", description: "...", approvalRequired: false },
      { action: "approve_project_constitution", description: "...", approvalRequired: true },
    ],
  });
  // Before this fix, the word "decisiones" in the rule's own text made the regex fallback
  // misclassify this as a "decision" operational draft — a category error, since drafting the
  // constitution is already handled by its own module and is not a RAID-style item.
  assert.deepEqual(selectOperationalDraftTypesForRecommendation(constitutionRec), []);
});

test("an unknown playbookRuleId falls through to the text/severity regex classifier (fallback path still works)", () => {
  const dependencyRec = adhoc(findRec("pb-close-signoff-missing"), {
    playbookRuleId: "pb-any-open-dependency",
    title: "Dependencia interna abierta",
    detectedSituation: "Existe una dependencia interna pendiente de resolución.",
    recommendedAction: "Resolver la dependencia interna pendiente.",
    severity: "medium",
  });
  const blueprints = selectOperationalDraftTypesForRecommendation(dependencyRec);
  assert.equal(blueprints.length, 1);
  assert.equal(blueprints[0].type, "dependency");

  const scopeChangeRec = adhoc(findRec("pb-close-signoff-missing"), {
    playbookRuleId: "pb-any-scope-change",
    title: "Posible cambio de alcance detectado",
    detectedSituation: "Se detectó un posible cambio de alcance no formalizado.",
    recommendedAction: "Evaluar el cambio de alcance y decidir si se formaliza mediante un change request.",
    severity: "high",
  });
  const scopeBlueprints = selectOperationalDraftTypesForRecommendation(scopeChangeRec);
  assert.deepEqual(scopeBlueprints.map((b) => b.type).sort(), ["decision", "risk"]);
});

// ─── owner vs. decisionOwner consolidation — Hardening Sprint ──────────────────

test("decision drafts never auto-copy decisionOwner into the common owner field", () => {
  const decisionRec = adhoc(findRec("pb-close-signoff-missing"), {
    playbookRuleId: "pb-any-decision-pending",
    title: "Decisión pendiente sin dueño",
    detectedSituation: "Hay una decisión de alcance pendiente sin responsable asignado.",
    recommendedAction: "Asignar un dueño y solicitar la decisión al sponsor.",
    severity: "high",
  });
  // decisionOwner supplied, owner never given -> owner must stay null, not copy decisionOwner.
  const draft = generateOperationalDraftsFromRecommendation(decisionRec, { decisionOwner: "Sponsor Lead" }).data[0];
  assert.equal(draft.type, "decision");
  assert.equal(draft.decisionOwner, "Sponsor Lead");
  assert.equal(draft.owner, null, "owner must never be silently backfilled from decisionOwner");
});

test("decision drafts keep owner and decisionOwner independent when both are supplied", () => {
  const decisionRec = adhoc(findRec("pb-close-signoff-missing"), {
    playbookRuleId: "pb-any-decision-pending",
    title: "Decisión pendiente sin dueño",
    detectedSituation: "Hay una decisión de alcance pendiente sin responsable asignado.",
    recommendedAction: "Asignar un dueño y solicitar la decisión al sponsor.",
    severity: "high",
  });
  const draft = generateOperationalDraftsFromRecommendation(decisionRec, { owner: "PM Coordinator", decisionOwner: "Sponsor Lead" }).data[0];
  assert.equal(draft.owner, "PM Coordinator");
  assert.equal(draft.decisionOwner, "Sponsor Lead");
  assert.notEqual(draft.owner, draft.decisionOwner, "owner and decisionOwner answer different questions and must not be forced equal");
});

test("decision drafts without decisionOwner never invent one, and it surfaces in missingInputs", () => {
  const decisionRec = adhoc(findRec("pb-close-signoff-missing"), {
    playbookRuleId: "pb-any-decision-pending",
    title: "Decisión pendiente sin dueño",
    detectedSituation: "Hay una decisión de alcance pendiente sin responsable asignado.",
    recommendedAction: "Asignar un dueño y solicitar la decisión al sponsor.",
    severity: "high",
  });
  const draft = generateOperationalDraftsFromRecommendation(decisionRec, {}).data[0];
  assert.equal(draft.decisionOwner, null);
  assert.ok(draft.missingInputs.includes("decisionOwner"));
});

test("operationalDraftToDecisionInput surfaces decisionOwner (never owner) in metadata for decision drafts", () => {
  const decisionRec = adhoc(findRec("pb-close-signoff-missing"), {
    playbookRuleId: "pb-any-decision-pending",
    title: "Decisión pendiente sin dueño",
    detectedSituation: "Hay una decisión de alcance pendiente sin responsable asignado.",
    recommendedAction: "Asignar un dueño y solicitar la decisión al sponsor.",
    severity: "high",
  });
  const draft = generateOperationalDraftsFromRecommendation(decisionRec, { owner: "PM Coordinator", decisionOwner: "Sponsor Lead" }).data[0];
  const mapped = operationalDraftToDecisionInput(draft);
  assert.equal(mapped.metadata.decisionOwner, "Sponsor Lead");
  assert.notEqual(mapped.metadata.decisionOwner, "PM Coordinator");
});

test("non-decision drafts never carry a decisionOwner key in mapped metadata", () => {
  const riskRec = criticalRisksOpenRec();
  const riskDraft = generateOperationalDraftsFromRecommendation(riskRec, {}).data[0];
  const mapped = operationalDraftToDecisionInput(riskDraft);
  assert.ok(!("decisionOwner" in mapped.metadata));
});

// ─── approvalRequired normalization — Hardening Sprint ──────────────────────────

test("resolveOperationalDraftApprovalRequirement: decision is always approval-required", () => {
  assert.equal(
    resolveOperationalDraftApprovalRequirement({ type: "decision", severity: "low", recommendationApprovalRequired: false }),
    true,
  );
});

test("resolveOperationalDraftApprovalRequirement: risk requires approval on high/critical severity or escalation", () => {
  assert.equal(resolveOperationalDraftApprovalRequirement({ type: "risk", severity: "critical", recommendationApprovalRequired: false }), true);
  assert.equal(resolveOperationalDraftApprovalRequirement({ type: "risk", severity: "high", recommendationApprovalRequired: false }), true);
  assert.equal(
    resolveOperationalDraftApprovalRequirement({ type: "risk", severity: "low", recommendationApprovalRequired: false, escalationRecommended: true }),
    true,
  );
  assert.equal(resolveOperationalDraftApprovalRequirement({ type: "risk", severity: "low", recommendationApprovalRequired: false }), false);
});

test("resolveOperationalDraftApprovalRequirement: issue requires approval when blocking or high/critical severity", () => {
  assert.equal(resolveOperationalDraftApprovalRequirement({ type: "issue", severity: "medium", recommendationApprovalRequired: false, blocking: true }), true);
  assert.equal(resolveOperationalDraftApprovalRequirement({ type: "issue", severity: "critical", recommendationApprovalRequired: false, blocking: false }), true);
  assert.equal(resolveOperationalDraftApprovalRequirement({ type: "issue", severity: "medium", recommendationApprovalRequired: false, blocking: false }), false);
});

test("resolveOperationalDraftApprovalRequirement: dependency requires approval when blocking or high/critical severity", () => {
  assert.equal(resolveOperationalDraftApprovalRequirement({ type: "dependency", severity: "medium", recommendationApprovalRequired: false, blocking: true }), true);
  assert.equal(resolveOperationalDraftApprovalRequirement({ type: "dependency", severity: "high", recommendationApprovalRequired: false, blocking: false }), true);
  assert.equal(resolveOperationalDraftApprovalRequirement({ type: "dependency", severity: "low", recommendationApprovalRequired: false, blocking: false }), false);
});

test("resolveOperationalDraftApprovalRequirement never relaxes a recommendation that already required approval", () => {
  for (const type of ["risk", "issue", "dependency", "decision"]) {
    assert.equal(
      resolveOperationalDraftApprovalRequirement({ type, severity: "low", recommendationApprovalRequired: true, blocking: false, escalationRecommended: false }),
      true,
      `${type} must never relax approvalRequired below what the parent recommendation set`,
    );
  }
});

test("a blocking dependency draft is now approval-required even when its recommendation itself was not", () => {
  // pb-close-signoff-missing has no suggestedActions in the seed playbook, so its own
  // approvalRequired is false — but the derived dependency draft is high-severity/blocking,
  // so it must independently require approval (this was the inconsistency the review flagged).
  const signoffRec = findRec("pb-close-signoff-missing");
  assert.equal(signoffRec.approvalRequired, false);
  const draft = generateOperationalDraftsFromRecommendation(signoffRec, {}).data[0];
  assert.equal(draft.type, "dependency");
  assert.equal(draft.blockingStatus, true);
  assert.equal(draft.approvalRequired, true, "a blocking, high-severity dependency draft must require approval on its own signal");
});

// ─── Draft generation, idempotency, state machine (kept from Sprint 5 coverage) ─

test("high-severity risk without mitigation generates a RiskDraft with missing mitigation surfaced", () => {
  const riskRec = criticalRisksOpenRec();
  const drafts = generateOperationalDraftsFromRecommendation(riskRec, {});
  assert.equal(drafts.ok, true);
  assert.equal(drafts.data.length, 1);
  assert.equal(drafts.data[0].type, "risk");
  assert.equal(drafts.data[0].mitigation, null);
  assert.ok(drafts.data[0].missingInputs.includes("mitigation"));
  assert.equal(drafts.data[0].escalationRecommended, true);
});

test("dependency draft never invents owner/dueDate; both surface in missingInputs", () => {
  const dependencyRec = adhoc(findRec("pb-close-signoff-missing"), {
    playbookRuleId: "pb-any-open-dependency",
    title: "Dependencia interna abierta",
    detectedSituation: "Existe una dependencia interna pendiente de resolución.",
    recommendedAction: "Resolver la dependencia interna pendiente.",
    severity: "medium",
  });
  const draft = generateOperationalDraftsFromRecommendation(dependencyRec, {}).data[0];
  assert.equal(draft.type, "dependency");
  assert.equal(draft.owner, null);
  assert.equal(draft.dueDate, null);
  assert.ok(draft.missingInputs.includes("owner"));
  assert.ok(draft.missingInputs.includes("dueDate"));
});

test("providing owner/dueDate clears those missingInputs without inventing anything else", () => {
  const dependencyRec = adhoc(findRec("pb-close-signoff-missing"), {
    playbookRuleId: "pb-any-open-dependency",
    title: "Dependencia interna abierta",
    detectedSituation: "Existe una dependencia interna pendiente de resolución.",
    recommendedAction: "Resolver la dependencia interna pendiente.",
    severity: "medium",
  });
  const draft = generateOperationalDraftsFromRecommendation(dependencyRec, { owner: "Jane Doe", dueDate: "2026-08-01" }).data[0];
  assert.equal(draft.owner, "Jane Doe");
  assert.equal(draft.dueDate, "2026-08-01");
  assert.ok(!draft.missingInputs.includes("owner"));
  assert.ok(!draft.missingInputs.includes("dueDate"));
});

test("two identical generations produce the same fingerprint/id (idempotent)", () => {
  const dependencyRec = adhoc(findRec("pb-close-signoff-missing"), {
    playbookRuleId: "pb-any-open-dependency",
    title: "Dependencia interna abierta",
    detectedSituation: "Existe una dependencia interna pendiente de resolución.",
    recommendedAction: "Resolver la dependencia interna pendiente.",
    severity: "medium",
  });
  const ctx = { owner: "Jane Doe", dueDate: "2026-08-01" };
  const first = generateOperationalDraftsFromRecommendation(dependencyRec, ctx).data[0];
  const second = generateOperationalDraftsFromRecommendation(dependencyRec, ctx).data[0];
  assert.equal(second.fingerprint, first.fingerprint);
  assert.equal(second.id, first.id);
});

test("mergeOperationalDrafts never duplicates by fingerprint and preserves prior status", () => {
  const dependencyRec = adhoc(findRec("pb-close-signoff-missing"), {
    playbookRuleId: "pb-any-open-dependency",
    title: "Dependencia interna abierta",
    detectedSituation: "Existe una dependencia interna pendiente de resolución.",
    recommendedAction: "Resolver la dependencia interna pendiente.",
    severity: "medium",
  });
  const ctx = { owner: "Jane Doe", dueDate: "2026-08-01" };
  const first = generateOperationalDraftsFromRecommendation(dependencyRec, ctx).data[0];
  const reviewed = markOperationalDraftReviewed(first);
  assert.equal(reviewed.ok, true);
  const second = generateOperationalDraftsFromRecommendation(dependencyRec, ctx).data[0];
  const merged = mergeOperationalDrafts([reviewed.data], [second]);
  const fingerprints = merged.map((d) => d.fingerprint);
  assert.equal(new Set(fingerprints).size, fingerprints.length);
  const mergedDraft = merged.find((d) => d.fingerprint === first.fingerprint);
  assert.equal(mergedDraft.status, "reviewed", "merge must preserve the previously recorded human decision status");
});

test("generateOperationalDraftsFromRecommendations dedupes across a batch", () => {
  const dependencyRec = adhoc(findRec("pb-close-signoff-missing"), {
    playbookRuleId: "pb-any-open-dependency",
    title: "Dependencia interna abierta",
    detectedSituation: "Existe una dependencia interna pendiente de resolución.",
    recommendedAction: "Resolver la dependencia interna pendiente.",
    severity: "medium",
  });
  const batch = generateOperationalDraftsFromRecommendations([dependencyRec, dependencyRec], {});
  assert.equal(batch.ok, true);
  assert.equal(batch.data.length, 1, "the same recommendation processed twice must not produce duplicate drafts");
});

test("explainOperationalDraftGeneration always states the draft was never converted automatically", () => {
  const dependencyRec = adhoc(findRec("pb-close-signoff-missing"), {
    playbookRuleId: "pb-any-open-dependency",
    title: "Dependencia interna abierta",
    detectedSituation: "Existe una dependencia interna pendiente de resolución.",
    recommendedAction: "Resolver la dependencia interna pendiente.",
    severity: "medium",
  });
  const draft = generateOperationalDraftsFromRecommendation(dependencyRec, { owner: "Jane Doe", dueDate: "2026-08-01" }).data[0];
  const explanation = explainOperationalDraftGeneration(draft);
  assert.match(explanation.narrative, /no fue convertido automáticamente/i);
  assert.equal(explanation.supportingRule, "pb-any-open-dependency");
  assert.equal(explanation.originRecommendation, dependencyRec.id);
});

test("state machine: discarded can never become converted; converted is terminal", () => {
  const dependencyRec = adhoc(findRec("pb-close-signoff-missing"), {
    playbookRuleId: "pb-any-open-dependency",
    title: "Dependencia interna abierta",
    detectedSituation: "Existe una dependencia interna pendiente de resolución.",
    recommendedAction: "Resolver la dependencia interna pendiente.",
    severity: "medium",
  });
  const draft = generateOperationalDraftsFromRecommendation(dependencyRec, {}).data[0];
  const discarded = discardOperationalDraft(draft);
  assert.equal(discarded.ok, true);
  const discardedToConverted = convertOperationalDraft(discarded.data);
  assert.equal(discardedToConverted.ok, false, "discarded must never transition to converted");

  const reviewed = markOperationalDraftReviewed(draft).data;
  const approved = approveOperationalDraft(reviewed);
  assert.equal(approved.ok, true);
  const converted = convertOperationalDraft(approved.data);
  assert.equal(converted.ok, true);
  assert.equal(converted.data.status, "converted");
  const convertedAgain = markOperationalDraftReviewed(converted.data);
  assert.equal(convertedAgain.ok, false, "converted must be a final state with no further transitions");
});

test("mappers route by draft type and never persist", () => {
  const dependencyRec = adhoc(findRec("pb-close-signoff-missing"), {
    playbookRuleId: "pb-any-open-dependency",
    title: "Dependencia interna abierta",
    detectedSituation: "Existe una dependencia interna pendiente de resolución.",
    recommendedAction: "Resolver la dependencia interna pendiente.",
    severity: "medium",
  });
  const draft = generateOperationalDraftsFromRecommendation(dependencyRec, { owner: "Jane Doe", dueDate: "2026-08-01" }).data[0];
  const raidInput = operationalDraftToRaidItemInput(draft);
  assert.equal(raidInput.category, "dependency");
  assert.equal(raidInput.workspaceId, dependencyRec.workspaceId);

  const decisionRec = adhoc(findRec("pb-close-signoff-missing"), {
    playbookRuleId: "pb-any-decision-pending",
    title: "Decisión pendiente sin dueño",
    detectedSituation: "Hay una decisión de alcance pendiente sin responsable asignado.",
    recommendedAction: "Asignar un dueño y solicitar la decisión al sponsor.",
    severity: "high",
  });
  const decisionDraft = generateOperationalDraftsFromRecommendation(decisionRec, {}).data[0];
  assert.equal(operationalDraftToRaidItemInput(decisionDraft), null, "decision drafts must never map to a RAID item");

  const decisionInput = operationalDraftToDecisionInput(decisionDraft);
  assert.equal(decisionInput.decision_status, "draft");
  assert.equal(decisionInput.recommendation_id, decisionRec.id);
});
