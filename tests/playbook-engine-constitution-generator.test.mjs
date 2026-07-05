import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  SEED_DELIVERY_PLAYBOOK,
  evaluatePlaybookRules,
  generateProjectConstitutionDraftFromPlaybook,
  explainProjectConstitutionDraftGeneration,
} from "../src/lib/playbook-engine/index.ts";

const generator = fs.readFileSync("src/lib/playbook-engine/constitution-generator.ts", "utf8");
const types = fs.readFileSync("src/lib/playbook-engine/types.ts", "utf8");
const rulesEngine = fs.readFileSync("src/lib/playbook-engine/rules-engine.ts", "utf8");
const seedPlaybook = fs.readFileSync("src/lib/playbook-engine/seed-playbook.ts", "utf8");
const indexFile = fs.readFileSync("src/lib/playbook-engine/index.ts", "utf8");

// ─── Exports (static) ───────────────────────────────────────────────────────────

test("generateProjectConstitutionDraftFromPlaybook is exported from the module", () => {
  assert.match(indexFile, /generateProjectConstitutionDraftFromPlaybook/);
  assert.match(generator, /export function generateProjectConstitutionDraftFromPlaybook/);
});

test("explainProjectConstitutionDraftGeneration is exported from the module", () => {
  assert.match(indexFile, /explainProjectConstitutionDraftGeneration/);
  assert.match(generator, /export function explainProjectConstitutionDraftGeneration/);
});

test("ProjectConstitutionDraft types are exported from the module", () => {
  for (const typeName of ["ProjectConstitutionDraft", "ProjectConstitutionDraftField", "ProjectConstitutionDraftFieldStatus", "ProjectConstitutionSourceFacts"]) {
    assert.match(indexFile, new RegExp(typeName), `index.ts must re-export ${typeName}`);
  }
});

test("constitution-generator reuses ConstitutionStatus from project-constitution instead of a parallel type", () => {
  assert.match(generator, /import type \{ ConstitutionStatus \} from "@\/lib\/project-constitution"/);
});

test("constitution-generator follows the PlaybookEngineResult ok/error convention", () => {
  assert.match(generator, /PlaybookEngineResult<ProjectConstitutionDraft>/);
});

test("PlaybookRule and PlaybookRuleEvaluation carry an optional/nullable suggestedActions field", () => {
  assert.match(types, /suggestedActions\?: PlaybookSuggestedAction\[\]/);
  assert.match(types, /suggestedActions: PlaybookSuggestedAction\[\] \| null/);
});

test("evaluatePlaybookRule only populates suggestedActions when fired", () => {
  assert.match(rulesEngine, /suggestedActions: null/);
  assert.match(rulesEngine, /suggestedActions: allConditionsMet \? rule\.suggestedActions \?\? \[\] : null/);
});

test("missing-constitution rule declares its suggested actions in the seed playbook", () => {
  const ruleBlockMatch = seedPlaybook.match(/id: "pb-init-constitution-missing"[\s\S]*?\n {4}\},\n/);
  assert.ok(ruleBlockMatch, "pb-init-constitution-missing rule block must exist");
  const block = ruleBlockMatch[0];
  assert.match(block, /generate_project_constitution_draft/);
  assert.match(block, /approve_project_constitution/);
  assert.match(block, /approvalRequired: false/);
  assert.match(block, /approvalRequired: true/);
});

// ─── Runtime behavior (direct import) ──────────────────────────────────────────

function baseContext(overrides = {}) {
  return {
    projectId: "00000000-0000-0000-0000-000000000001",
    workspaceId: "00000000-0000-0000-0000-000000000002",
    phase: "iniciacion",
    hasApprovedCharter: null,
    hasApprovedConstitution: false,
    hasScopeBaseline: null,
    hasWbs: null,
    hasScheduleBaseline: null,
    hasBudgetBaseline: null,
    hasRiskRegister: null,
    hasStakeholderMap: null,
    hasCommunicationsPlan: null,
    hasClosureChecklistStarted: null,
    hasFinalInvoiceIssued: null,
    hasClientSignoff: null,
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

const CONTENT_FIELDS = [
  "scopeIn",
  "scopeOut",
  "deliverables",
  "acceptanceCriteria",
  "stakeholders",
  "constraints",
  "initialRisks",
  "initialDependencies",
  "communicationRules",
  "changeRules",
  "closureRules",
  "billingRules",
];

test("generates a draft in 'draft' status when projectId is present, never auto-approved", () => {
  const result = generateProjectConstitutionDraftFromPlaybook(baseContext(), SEED_DELIVERY_PLAYBOOK);
  assert.equal(result.ok, true);
  assert.equal(result.data.projectId, "00000000-0000-0000-0000-000000000001");
  assert.equal(result.data.status, "draft");
});

test("missing projectId fails validation, no draft invented", () => {
  const result = generateProjectConstitutionDraftFromPlaybook(baseContext({ projectId: "" }), SEED_DELIVERY_PLAYBOOK);
  assert.equal(result.ok, false);
  assert.equal(result.failureClass, "validation_failed");
});

test("with zero source facts, no content field is invented or marked provided", () => {
  const draft = generateProjectConstitutionDraftFromPlaybook(baseContext(), SEED_DELIVERY_PLAYBOOK).data;
  for (const field of CONTENT_FIELDS) {
    assert.deepEqual(draft[field].value, [], `${field} must not invent content`);
    assert.notEqual(draft[field].status, "provided", `${field} must not be marked provided without real data`);
  }
  assert.equal(draft.objective.value, null, "objective must not be invented");
  assert.equal(draft.objective.status, "pending_definition");
});

test("acceptance criteria default to pending_definition, billing rules to requires_validation", () => {
  const draft = generateProjectConstitutionDraftFromPlaybook(baseContext(), SEED_DELIVERY_PLAYBOOK).data;
  assert.equal(draft.acceptanceCriteria.status, "pending_definition");
  // Financial data always requires human validation before it governs a project, even absent evidence.
  assert.equal(draft.billingRules.status, "requires_validation");
});

test("evidenceRequirements is derived from the playbook's declared phase evidence, never empty", () => {
  const draft = generateProjectConstitutionDraftFromPlaybook(baseContext(), SEED_DELIVERY_PLAYBOOK).data;
  assert.equal(draft.evidenceRequirements.status, "derived_from_playbook");
  assert.ok(draft.evidenceRequirements.value.length > 0, "iniciacion phase must yield evidence requirements from the playbook");
  assert.ok(draft.evidenceRequirements.value.some((v) => v.includes("hasApprovedConstitution")));
});

test("explicit source facts are reflected verbatim and marked 'provided'", () => {
  const draft = generateProjectConstitutionDraftFromPlaybook(baseContext(), SEED_DELIVERY_PLAYBOOK, {
    objective: "Entregar el MVP del portal de clientes.",
    acceptanceCriteria: ["UAT firmado por el cliente"],
  }).data;
  assert.equal(draft.objective.value, "Entregar el MVP del portal de clientes.");
  assert.equal(draft.objective.status, "provided");
  assert.deepEqual(draft.acceptanceCriteria.value, ["UAT firmado por el cliente"]);
  assert.equal(draft.acceptanceCriteria.status, "provided");
  // Fields not supplied via sourceFacts remain unfabricated even when others are enriched.
  assert.equal(draft.scopeIn.status, "pending_definition");
});

test("evidence-aware fallback: known risk register evidence marks initialRisks requires_validation, not pending_definition", () => {
  const draft = generateProjectConstitutionDraftFromPlaybook(baseContext({ hasRiskRegister: true }), SEED_DELIVERY_PLAYBOOK).data;
  assert.equal(draft.initialRisks.status, "requires_validation");
  assert.deepEqual(draft.initialRisks.value, []);
});

test("missing-constitution rule fires and suggests generating a draft without auto-approval", () => {
  const evaluations = evaluatePlaybookRules(SEED_DELIVERY_PLAYBOOK, baseContext());
  const evaluation = evaluations.find((e) => e.ruleId === "pb-init-constitution-missing");
  assert.ok(evaluation, "pb-init-constitution-missing must be evaluated for the iniciacion phase");
  assert.equal(evaluation.status, "fired");
  assert.ok(evaluation.suggestedActions.some((a) => a.action === "generate_project_constitution_draft" && a.approvalRequired === false));
  assert.ok(evaluation.suggestedActions.some((a) => a.action === "approve_project_constitution" && a.approvalRequired === true));
});

test("explainProjectConstitutionDraftGeneration reports usage, gaps, and never claims approval", () => {
  const draft = generateProjectConstitutionDraftFromPlaybook(baseContext(), SEED_DELIVERY_PLAYBOOK).data;
  const explanation = explainProjectConstitutionDraftGeneration(draft);
  assert.equal(explanation.draftStatus, "draft");
  assert.ok(explanation.fieldsDerivedFromPlaybook.includes("evidenceRequirements"));
  assert.ok(explanation.fieldsPendingDefinition.includes("acceptanceCriteria"));
  assert.ok(explanation.fieldsRequiringValidation.includes("billingRules"));
  assert.equal(explanation.requiresHumanReview, true);
  assert.match(explanation.approvalNote, /no se aprueba/i);
});

test("invalid playbook with no phases fails validation", () => {
  const result = generateProjectConstitutionDraftFromPlaybook(baseContext(), { ...SEED_DELIVERY_PLAYBOOK, phases: [] });
  assert.equal(result.ok, false);
  assert.equal(result.failureClass, "validation_failed");
});
