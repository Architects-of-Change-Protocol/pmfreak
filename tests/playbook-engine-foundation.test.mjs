import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const types = fs.readFileSync("src/lib/playbook-engine/types.ts", "utf8");
const seedPlaybook = fs.readFileSync("src/lib/playbook-engine/seed-playbook.ts", "utf8");
const rulesEngine = fs.readFileSync("src/lib/playbook-engine/rules-engine.ts", "utf8");
const explain = fs.readFileSync("src/lib/playbook-engine/explain.ts", "utf8");
const indexFile = fs.readFileSync("src/lib/playbook-engine/index.ts", "utf8");
const docs = fs.readFileSync("docs/playbook-engine-foundation.md", "utf8");

// ─── Exports ──────────────────────────────────────────────────────────────────

test("evaluatePlaybookRules and evaluatePlaybookRule are exported from the module", () => {
  assert.match(indexFile, /evaluatePlaybookRules/);
  assert.match(indexFile, /evaluatePlaybookRule/);
  assert.match(rulesEngine, /export function evaluatePlaybookRules/);
  assert.match(rulesEngine, /export function evaluatePlaybookRule\(/);
});

test("SEED_DELIVERY_PLAYBOOK is exported from the module", () => {
  assert.match(indexFile, /SEED_DELIVERY_PLAYBOOK/);
  assert.match(seedPlaybook, /export const SEED_DELIVERY_PLAYBOOK/);
});

test("explainPlaybookEngineCapability is exported from the module", () => {
  assert.match(indexFile, /explainPlaybookEngineCapability/);
  assert.match(explain, /export function explainPlaybookEngineCapability/);
});

test("core types are exported from the module", () => {
  for (const typeName of [
    "DeliveryPlaybook",
    "PlaybookEngineResult",
    "PlaybookRule",
    "PlaybookRuleEvaluation",
    "PlaybookRuleEvaluationStatus",
    "ProjectContextFacts",
  ]) {
    assert.match(indexFile, new RegExp(typeName), `index.ts must re-export ${typeName}`);
    assert.match(types, new RegExp(`export type ${typeName}`), `types.ts must define ${typeName}`);
  }
});

// ─── Result union convention ────────────────────────────────────────────────

test("PlaybookEngineResult follows the ok/error union convention used across the repo", () => {
  assert.match(types, /\{ ok: true; data: T \}/);
  assert.match(types, /ok: false; error: string; failureClass: PlaybookEngineFailureClass/);
});

// ─── Seed playbook content ──────────────────────────────────────────────────

test("seed playbook covers all five delivery phases", () => {
  for (const phase of ["iniciacion", "planificacion", "ejecucion", "monitoreo_control", "cierre"]) {
    assert.match(seedPlaybook, new RegExp(`key: "${phase}"`), `seed playbook must declare phase '${phase}'`);
  }
});

test("seed playbook rules are scoped to a phase or 'any'", () => {
  const scopeMatches = [...seedPlaybook.matchAll(/scope: "([a-z_]+)"/g)].map((m) => m[1]);
  assert.ok(scopeMatches.length >= 15, "seed playbook must define at least 15 rules");
  for (const scope of scopeMatches) {
    assert.ok(
      ["iniciacion", "planificacion", "ejecucion", "monitoreo_control", "cierre", "any"].includes(scope),
      `unexpected rule scope '${scope}'`,
    );
  }
});

test("every seed rule carries a recommendationTemplate", () => {
  const ruleBlocks = seedPlaybook.split(/\{\s*\n\s*id: "pb-/).slice(1);
  assert.ok(ruleBlocks.length >= 15);
  for (const block of ruleBlocks) {
    assert.match(block, /recommendationTemplate:/, "every rule must declare a recommendationTemplate");
  }
});

// ─── Rules Engine behavior (no invented data) ───────────────────────────────

test("evaluatePlaybookRule never invents data: missing evidence is indeterminate, not fired/not_fired", () => {
  assert.match(rulesEngine, /"indeterminate"/);
  assert.match(rulesEngine, /recommendationTemplate: null/);
});

test("evaluatePlaybookRules filters rules by the context's current phase plus 'any'-scoped rules", () => {
  assert.match(rulesEngine, /rule\.scope === "any" \|\| rule\.scope === context\.phase/);
});

// ─── Documentation ───────────────────────────────────────────────────────────

test("foundation documentation covers the Rules Engine and Seed Playbook", () => {
  assert.match(docs, /evaluatePlaybookRules/);
  assert.match(docs, /SEED_DELIVERY_PLAYBOOK/);
  assert.match(docs, /indeterminate/);
});

test("foundation documentation states the module never persists data in this sprint", () => {
  assert.match(docs, /No database migration or `platform-events` emission/);
});

// ─── Runtime behavior probe ──────────────────────────────────────────────────

const runtimeProbe = String.raw`
import assert from "node:assert/strict";
import { SEED_DELIVERY_PLAYBOOK, evaluatePlaybookRule, evaluatePlaybookRules } from "./src/lib/playbook-engine/index.ts";

const baseContext = {
  projectId: "00000000-0000-0000-0000-000000000001",
  workspaceId: "00000000-0000-0000-0000-000000000002",
  phase: "ejecucion",
  hasApprovedCharter: null,
  hasApprovedConstitution: null,
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

// 1. All facts unknown -> every applicable rule is indeterminate, never invented.
const indeterminateEvaluations = evaluatePlaybookRules(SEED_DELIVERY_PLAYBOOK, baseContext);
assert.ok(indeterminateEvaluations.length > 0, "at least one rule applies to the ejecucion phase");
assert.ok(indeterminateEvaluations.every((e) => e.status === "indeterminate"));
assert.ok(indeterminateEvaluations.every((e) => e.recommendationTemplate === null));
assert.ok(indeterminateEvaluations.every((e) => e.evidenceMissing.length > 0));

// 2. Providing evidence lets a rule fire, with evidence used populated and no invented facts.
const criticalRiskRule = SEED_DELIVERY_PLAYBOOK.rules.find((r) => r.id === "pb-exec-critical-risks-open");
const firedEvaluation = evaluatePlaybookRule(criticalRiskRule, { ...baseContext, openCriticalRisks: 3 });
assert.equal(firedEvaluation.status, "fired");
assert.equal(firedEvaluation.recommendationTemplate, criticalRiskRule.recommendationTemplate);
assert.deepEqual(firedEvaluation.evidenceUsed, [{ fact: "openCriticalRisks", value: 3 }]);
assert.equal(firedEvaluation.evidenceMissing.length, 0);

// 3. Evidence present but condition false -> not_fired, no recommendation surfaced.
const notFiredEvaluation = evaluatePlaybookRule(criticalRiskRule, { ...baseContext, openCriticalRisks: 0 });
assert.equal(notFiredEvaluation.status, "not_fired");
assert.equal(notFiredEvaluation.recommendationTemplate, null);

// 4. Rules scoped to a different phase are excluded from evaluation.
const planningOnlyEvaluations = evaluatePlaybookRules(SEED_DELIVERY_PLAYBOOK, { ...baseContext, phase: "planificacion" });
assert.ok(planningOnlyEvaluations.every((e) => e.scope === "planificacion" || e.scope === "any"));
assert.ok(!planningOnlyEvaluations.some((e) => e.ruleId === "pb-exec-critical-risks-open"));

// 5. "any"-scoped rules apply regardless of phase.
const staleStatusEvaluation = evaluatePlaybookRules(SEED_DELIVERY_PLAYBOOK, { ...baseContext, phase: "cierre", daysSinceLastStatusUpdate: 20 })
  .find((e) => e.ruleId === "pb-any-stale-status");
assert.ok(staleStatusEvaluation, "any-scoped rule must be evaluated regardless of phase");
assert.equal(staleStatusEvaluation.status, "fired");

const payload = {
  ruleCount: SEED_DELIVERY_PLAYBOOK.rules.length,
  phaseCount: SEED_DELIVERY_PLAYBOOK.phases.length,
  indeterminateCount: indeterminateEvaluations.length,
};
console.log(JSON.stringify(payload));
`;

const runtime = JSON.parse(execFileSync("npx", ["tsx", "--eval", runtimeProbe], { encoding: "utf8" }).trim().split("\n").at(-1));

test("seed playbook exposes at least 15 rules across 5 phases (runtime)", () => {
  assert.ok(runtime.ruleCount >= 15);
  assert.equal(runtime.phaseCount, 5);
});

test("with zero known facts, every rule applicable to the ejecucion phase is indeterminate (runtime)", () => {
  // ejecucion-scoped rules (4) + the "any"-scoped stale-status rule (1) = 5
  assert.equal(runtime.indeterminateCount, 5);
});
