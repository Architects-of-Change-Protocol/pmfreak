import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const generator = fs.readFileSync("src/lib/playbook-engine/constitution-generator.ts", "utf8");
const types = fs.readFileSync("src/lib/playbook-engine/types.ts", "utf8");
const rulesEngine = fs.readFileSync("src/lib/playbook-engine/rules-engine.ts", "utf8");
const seedPlaybook = fs.readFileSync("src/lib/playbook-engine/seed-playbook.ts", "utf8");
const indexFile = fs.readFileSync("src/lib/playbook-engine/index.ts", "utf8");

// ─── Exports ──────────────────────────────────────────────────────────────────

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

// ─── Reuse, not duplication ─────────────────────────────────────────────────

test("constitution-generator reuses ConstitutionStatus from project-constitution instead of a parallel type", () => {
  assert.match(generator, /import type \{ ConstitutionStatus \} from "@\/lib\/project-constitution"/);
});

test("constitution-generator follows the PlaybookEngineResult ok/error convention", () => {
  assert.match(generator, /PlaybookEngineResult<ProjectConstitutionDraft>/);
});

// ─── Rules engine: suggested actions ────────────────────────────────────────

test("PlaybookRule and PlaybookRuleEvaluation carry an optional/nullable suggestedActions field", () => {
  assert.match(types, /suggestedActions\?: PlaybookSuggestedAction\[\]/);
  assert.match(types, /suggestedActions: PlaybookSuggestedAction\[\] \| null/);
});

test("evaluatePlaybookRule only populates suggestedActions when fired", () => {
  assert.match(rulesEngine, /suggestedActions: null/);
  assert.match(rulesEngine, /suggestedActions: allConditionsMet \? rule\.suggestedActions \?\? \[\] : null/);
});

test("missing-constitution rule suggests generating a draft (approvalRequired: false) and approving it (approvalRequired: true)", () => {
  const ruleBlockMatch = seedPlaybook.match(/id: "pb-init-constitution-missing"[\s\S]*?\n {4}\},\n/);
  assert.ok(ruleBlockMatch, "pb-init-constitution-missing rule block must exist");
  const block = ruleBlockMatch[0];
  assert.match(block, /generate_project_constitution_draft/);
  assert.match(block, /approve_project_constitution/);
  assert.match(block, /approvalRequired: false/);
  assert.match(block, /approvalRequired: true/);
});

// ─── Runtime behavior probe ──────────────────────────────────────────────────

const runtimeProbe = String.raw`
import assert from "node:assert/strict";
import {
  SEED_DELIVERY_PLAYBOOK,
  evaluatePlaybookRules,
  generateProjectConstitutionDraftFromPlaybook,
  explainProjectConstitutionDraftGeneration,
} from "./src/lib/playbook-engine/index.ts";

const baseContext = {
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
};

// 1. Generates a draft when projectId is present but there is no approved constitution.
const draftResult = generateProjectConstitutionDraftFromPlaybook(baseContext, SEED_DELIVERY_PLAYBOOK);
assert.equal(draftResult.ok, true, "draft generation must succeed with a valid projectId");
const draft = draftResult.data;
assert.equal(draft.projectId, baseContext.projectId);
assert.equal(draft.status, "draft", "draft must always start in 'draft' status — never auto-approved");

// 2. Missing projectId -> validation_failed, no draft invented.
const noProjectId = generateProjectConstitutionDraftFromPlaybook({ ...baseContext, projectId: "" }, SEED_DELIVERY_PLAYBOOK);
assert.equal(noProjectId.ok, false);
assert.equal(noProjectId.failureClass, "validation_failed");

// 3. No content fields are invented: with zero source facts, every content field is empty/null.
for (const field of ["scopeIn", "scopeOut", "deliverables", "acceptanceCriteria", "stakeholders", "constraints", "initialRisks", "initialDependencies", "communicationRules", "changeRules", "closureRules", "billingRules"]) {
  assert.deepEqual(draft[field].value, [], field + " must not invent content");
  assert.notEqual(draft[field].status, "provided", field + " must not be marked provided without real data");
}
assert.equal(draft.objective.value, null, "objective must not be invented");
assert.equal(draft.objective.status, "pending_definition");

// 4. Acceptance criteria missing -> pending_definition.
assert.equal(draft.acceptanceCriteria.status, "pending_definition");

// 5. Billing rules missing -> requires_validation (financial data always needs human validation).
assert.equal(draft.billingRules.status, "requires_validation");

// 6. evidenceRequirements is derived from the playbook's phase evidence, never empty for a known phase.
assert.equal(draft.evidenceRequirements.status, "derived_from_playbook");
assert.ok(draft.evidenceRequirements.value.length > 0, "iniciacion phase must yield evidence requirements from the playbook");
assert.ok(draft.evidenceRequirements.value.some((v) => v.includes("hasApprovedConstitution")));

// 7. Explicit source facts are reflected verbatim (not invented) and marked "provided".
const enrichedResult = generateProjectConstitutionDraftFromPlaybook(baseContext, SEED_DELIVERY_PLAYBOOK, {
  objective: "Entregar el MVP del portal de clientes.",
  acceptanceCriteria: ["UAT firmado por el cliente"],
});
assert.equal(enrichedResult.ok, true);
const enrichedDraft = enrichedResult.data;
assert.equal(enrichedDraft.objective.value, "Entregar el MVP del portal de clientes.");
assert.equal(enrichedDraft.objective.status, "provided");
assert.deepEqual(enrichedDraft.acceptanceCriteria.value, ["UAT firmado por el cliente"]);
assert.equal(enrichedDraft.acceptanceCriteria.status, "provided");
// Fields not supplied via sourceFacts remain unfabricated even when others are enriched.
assert.equal(enrichedDraft.scopeIn.status, "pending_definition");

// 8. Evidence-aware fallback: when the playbook already knows a risk register exists, initialRisks
//    is marked requires_validation (import from elsewhere) instead of pending_definition (start from zero).
const withRiskRegister = generateProjectConstitutionDraftFromPlaybook({ ...baseContext, hasRiskRegister: true }, SEED_DELIVERY_PLAYBOOK);
assert.equal(withRiskRegister.data.initialRisks.status, "requires_validation");
assert.deepEqual(withRiskRegister.data.initialRisks.value, []);

// 9. Missing-constitution rule fires and suggests generating a draft without auto-approval.
const evaluations = evaluatePlaybookRules(SEED_DELIVERY_PLAYBOOK, baseContext);
const constitutionRuleEval = evaluations.find((e) => e.ruleId === "pb-init-constitution-missing");
assert.ok(constitutionRuleEval, "pb-init-constitution-missing must be evaluated for the iniciacion phase");
assert.equal(constitutionRuleEval.status, "fired");
assert.ok(constitutionRuleEval.suggestedActions.some((a) => a.action === "generate_project_constitution_draft" && a.approvalRequired === false));
assert.ok(constitutionRuleEval.suggestedActions.some((a) => a.action === "approve_project_constitution" && a.approvalRequired === true));

// 10. explainProjectConstitutionDraftGeneration reports what was used, what's missing, and never claims approval.
const explanation = explainProjectConstitutionDraftGeneration(draft);
assert.equal(explanation.draftStatus, "draft");
assert.ok(explanation.fieldsDerivedFromPlaybook.includes("evidenceRequirements"));
assert.ok(explanation.fieldsPendingDefinition.includes("acceptanceCriteria"));
assert.ok(explanation.fieldsRequiringValidation.includes("billingRules"));
assert.equal(explanation.requiresHumanReview, true);
assert.match(explanation.approvalNote, /no se aprueba/i);

const payload = {
  draftStatus: draft.status,
  evidenceRequirementsCount: draft.evidenceRequirements.value.length,
  billingRulesStatus: draft.billingRules.status,
  acceptanceCriteriaStatus: draft.acceptanceCriteria.status,
};
console.log(JSON.stringify(payload));
`;

const runtime = JSON.parse(execFileSync("npx", ["tsx", "--eval", runtimeProbe], { encoding: "utf8" }).trim().split("\n").at(-1));

test("draft always starts in 'draft' status (runtime)", () => {
  assert.equal(runtime.draftStatus, "draft");
});

test("evidenceRequirements is non-empty and derived from the playbook (runtime)", () => {
  assert.ok(runtime.evidenceRequirementsCount > 0);
});

test("billingRules defaults to requires_validation, acceptanceCriteria to pending_definition (runtime)", () => {
  assert.equal(runtime.billingRulesStatus, "requires_validation");
  assert.equal(runtime.acceptanceCriteriaStatus, "pending_definition");
});
