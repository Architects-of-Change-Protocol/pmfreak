import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { SEED_DELIVERY_PLAYBOOK, evaluatePlaybookRule, evaluatePlaybookRules } from "../src/lib/playbook-engine/index.ts";

const types = fs.readFileSync("src/lib/playbook-engine/types.ts", "utf8");
const seedPlaybook = fs.readFileSync("src/lib/playbook-engine/seed-playbook.ts", "utf8");
const rulesEngine = fs.readFileSync("src/lib/playbook-engine/rules-engine.ts", "utf8");
const explain = fs.readFileSync("src/lib/playbook-engine/explain.ts", "utf8");
const indexFile = fs.readFileSync("src/lib/playbook-engine/index.ts", "utf8");
const docs = fs.readFileSync("docs/playbook-engine-foundation.md", "utf8");

// ─── Exports (static — cheap to check, kept as a guard against accidental barrel regressions) ──

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

test("PlaybookEngineResult follows the ok/error union convention used across the repo", () => {
  assert.match(types, /\{ ok: true; data: T \}/);
  assert.match(types, /ok: false; error: string; failureClass: PlaybookEngineFailureClass/);
});

test("foundation documentation covers the Rules Engine and Seed Playbook", () => {
  assert.match(docs, /evaluatePlaybookRules/);
  assert.match(docs, /SEED_DELIVERY_PLAYBOOK/);
  assert.match(docs, /indeterminate/);
});

test("foundation documentation states the module never persists data in this sprint", () => {
  assert.match(docs, /No database migration or `platform-events` emission/);
});

// ─── Runtime behavior (direct import — no subprocess, no source-text matching) ─────────────────

function baseContext(overrides = {}) {
  return {
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
    ...overrides,
  };
}

test("seed playbook exposes at least 15 rules across 5 phases", () => {
  assert.ok(SEED_DELIVERY_PLAYBOOK.rules.length >= 15);
  assert.equal(SEED_DELIVERY_PLAYBOOK.phases.length, 5);
});

test("every seed rule declares scope, severity, conditions, evidenceFacts, recommendationTemplate", () => {
  for (const rule of SEED_DELIVERY_PLAYBOOK.rules) {
    assert.ok(rule.id.startsWith("pb-"), `rule id '${rule.id}' must start with 'pb-'`);
    assert.ok(["iniciacion", "planificacion", "ejecucion", "monitoreo_control", "cierre", "any"].includes(rule.scope));
    assert.ok(["low", "medium", "high", "critical"].includes(rule.severity));
    assert.ok(rule.conditions.length > 0, `rule '${rule.id}' must declare at least one condition`);
    assert.ok(rule.evidenceFacts.length > 0, `rule '${rule.id}' must declare evidenceFacts`);
    assert.ok(rule.recommendationTemplate.length > 0, `rule '${rule.id}' must declare a recommendationTemplate`);
  }
});

test("with zero known facts, every rule applicable to a phase is indeterminate, never invented", () => {
  const evaluations = evaluatePlaybookRules(SEED_DELIVERY_PLAYBOOK, baseContext());
  assert.ok(evaluations.length > 0, "at least one rule applies to the ejecucion phase");
  assert.ok(evaluations.every((e) => e.status === "indeterminate"));
  assert.ok(evaluations.every((e) => e.recommendationTemplate === null));
  assert.ok(evaluations.every((e) => e.suggestedActions === null));
  assert.ok(evaluations.every((e) => e.evidenceMissing.length > 0));
});

test("with zero known facts, ejecucion + any-scoped rules produce exactly 5 indeterminate evaluations", () => {
  // ejecucion-scoped rules (4) + the "any"-scoped stale-status rule (1) = 5
  const evaluations = evaluatePlaybookRules(SEED_DELIVERY_PLAYBOOK, baseContext());
  assert.equal(evaluations.length, 5);
});

test("providing evidence lets a rule fire, with evidence used populated and nothing invented", () => {
  const rule = SEED_DELIVERY_PLAYBOOK.rules.find((r) => r.id === "pb-exec-critical-risks-open");
  const fired = evaluatePlaybookRule(rule, baseContext({ openCriticalRisks: 3 }));
  assert.equal(fired.status, "fired");
  assert.equal(fired.recommendationTemplate, rule.recommendationTemplate);
  assert.deepEqual(fired.evidenceUsed, [{ fact: "openCriticalRisks", value: 3 }]);
  assert.equal(fired.evidenceMissing.length, 0);
});

test("evidence present but condition false yields not_fired, no recommendation surfaced", () => {
  const rule = SEED_DELIVERY_PLAYBOOK.rules.find((r) => r.id === "pb-exec-critical-risks-open");
  const notFired = evaluatePlaybookRule(rule, baseContext({ openCriticalRisks: 0 }));
  assert.equal(notFired.status, "not_fired");
  assert.equal(notFired.recommendationTemplate, null);
  assert.equal(notFired.suggestedActions, null);
});

test("rules scoped to a different phase are excluded from evaluation", () => {
  const evaluations = evaluatePlaybookRules(SEED_DELIVERY_PLAYBOOK, baseContext({ phase: "planificacion" }));
  assert.ok(evaluations.every((e) => e.scope === "planificacion" || e.scope === "any"));
  assert.ok(!evaluations.some((e) => e.ruleId === "pb-exec-critical-risks-open"));
});

test("'any'-scoped rules apply regardless of phase", () => {
  const evaluations = evaluatePlaybookRules(SEED_DELIVERY_PLAYBOOK, baseContext({ phase: "cierre", daysSinceLastStatusUpdate: 20 }));
  const staleStatus = evaluations.find((e) => e.ruleId === "pb-any-stale-status");
  assert.ok(staleStatus, "any-scoped rule must be evaluated regardless of phase");
  assert.equal(staleStatus.status, "fired");
});

test("evaluatePlaybookRules never skips an applicable rule silently, even when indeterminate", () => {
  const applicableIds = SEED_DELIVERY_PLAYBOOK.rules.filter((r) => r.scope === "any" || r.scope === "cierre").map((r) => r.id);
  const evaluations = evaluatePlaybookRules(SEED_DELIVERY_PLAYBOOK, baseContext({ phase: "cierre" }));
  assert.deepEqual(evaluations.map((e) => e.ruleId).sort(), applicableIds.sort());
});
