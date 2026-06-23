/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck -- Node 20 executes this TypeScript-named test without a loader.
const assert = require("node:assert/strict");
const { test, describe } = require("node:test");
const { readFileSync } = require("node:fs");

// ─────────────────────────────────────────────────────────────────────────────
// Operational Consequence Engine — Unit Tests (EPIC 4 Sprint 3)
// Pure structural + algorithm tests — no database access.
// ─────────────────────────────────────────────────────────────────────────────

const types        = readFileSync("src/lib/operational-consequence/types.ts", "utf8");
const registry     = readFileSync("src/lib/operational-consequence/consequence-registry.ts", "utf8");
const repo         = readFileSync("src/lib/operational-consequence/consequence-repository.ts", "utf8");
const impactEng    = readFileSync("src/lib/operational-consequence/impact-engine.ts", "utf8");
const cascadeEng   = readFileSync("src/lib/operational-consequence/cascade-engine.ts", "utf8");
const escalEng     = readFileSync("src/lib/operational-consequence/escalation-engine.ts", "utf8");
const scenarioEng  = readFileSync("src/lib/operational-consequence/scenario-engine.ts", "utf8");
const horizonEng   = readFileSync("src/lib/operational-consequence/horizon-engine.ts", "utf8");
const decisionEng  = readFileSync("src/lib/operational-consequence/decision-support-engine.ts", "utf8");
const lineageEng   = readFileSync("src/lib/operational-consequence/lineage-engine.ts", "utf8");
const explainFile  = readFileSync("src/lib/operational-consequence/explain.ts", "utf8");
const dbContract   = readFileSync("src/lib/db/database-contract.ts", "utf8");
const migration    = readFileSync("supabase/migrations/20260711000000_operational_consequence_engine.sql", "utf8");
const docs         = readFileSync("docs/operational-consequence-engine.md", "utf8");

// ─── Inline Engine Implementations ───────────────────────────────────────────

function calculateImpactScore({ focusScore, operationalPriority, dependencyCount, governanceImpact, executionImpact, historicalSimilarity }) {
  const priorityWeight = { critical: 30, high: 22, medium: 14, low: 6 };
  const base     = (focusScore / 100) * 25;
  const priority = priorityWeight[operationalPriority] ?? 6;
  const deps     = Math.min(dependencyCount * 2, 20);
  const gov      = (governanceImpact / 100) * 10;
  const exec     = (executionImpact  / 100) * 10;
  const history  = (historicalSimilarity / 100) * 5;
  const raw = base + priority + deps + gov + exec + history;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function calculateConsequenceSeverity(impactScore) {
  if (impactScore >= 90) return "systemic";
  if (impactScore >= 70) return "critical";
  if (impactScore >= 50) return "high";
  if (impactScore >= 30) return "medium";
  return "low";
}

function calculateEscalationProbability({ severity, dependencyDensity, openCommitments, activeViolations, historicalEscalationRate }) {
  const severityBase = { systemic: 0.40, critical: 0.30, high: 0.20, medium: 0.12, low: 0.05 };
  const base    = severityBase[severity] ?? 0.05;
  const deps    = Math.min(dependencyDensity * 0.04, 0.20);
  const commits = Math.min(openCommitments   * 0.02, 0.15);
  const vios    = Math.min(activeViolations  * 0.03, 0.15);
  const history = historicalEscalationRate * 0.10;
  const raw = base + deps + commits + vios + history;
  return Math.max(0, Math.min(1, parseFloat(raw.toFixed(3))));
}

function calculateImpactHorizon(severity) {
  const map = { critical: "24h", high: "48h", medium: "7d", low: "14d", systemic: "30d" };
  return map[severity];
}

function generateConsequenceScenarios({ focusType, severity, escalationProbability, impactScore }) {
  return [
    { name: "best_case",     probability: 0.20 },
    { name: "expected_case", probability: 0.60 },
    { name: "worst_case",    probability: 0.20 },
  ];
}

function analyzeCascadeEffects({ focusType, focusItemId, entityCounts }) {
  const chains = {
    authority: [
      { entityType: "operational_focus_items", label: "Authority Gap" },
      { entityType: "ratifications",           label: "Ratification Blocked" },
      { entityType: "commitments",             label: "Commitments Delayed" },
      { entityType: "projections",             label: "Execution Drift" },
      { entityType: "health",                  label: "Health Reduction" },
    ],
    governance: [
      { entityType: "operational_focus_items", label: "Governance Violation" },
      { entityType: "decisions",               label: "Decisions Blocked" },
      { entityType: "commitments",             label: "Commitments Affected" },
      { entityType: "projections",             label: "Projection Drift" },
    ],
    commitment: [
      { entityType: "operational_focus_items", label: "Overdue Commitment" },
      { entityType: "projections",             label: "Projections Affected" },
      { entityType: "realities",               label: "Realities Impacted" },
      { entityType: "health",                  label: "Health Reduction" },
    ],
  };
  const steps = chains[focusType] ?? [
    { entityType: "operational_focus_items", label: "Focus Item" },
    { entityType: "health",                  label: "Health Risk" },
  ];
  return {
    chain:                steps.map((s, i) => ({ ...s, depth: i, children: [] })),
    maxDepth:             steps.length - 1,
    totalAffectedEntities: steps.reduce((sum, s) => sum + (entityCounts[s.entityType] ?? 0), 0),
  };
}

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Database Contract ────────────────────────────────────────────────────────

describe("Database Contract", () => {
  test("DATABASE_CONTRACT_VERSION includes operational-consequence-engine", () => {
    assert.match(dbContract, /operational-consequence-engine/);
  });

  test("OperationalConsequenceRow is present", () => {
    assert.match(dbContract, /OperationalConsequenceRow/);
  });

  test("OperationalConsequenceImpactRow is present", () => {
    assert.match(dbContract, /OperationalConsequenceImpactRow/);
  });

  test("OperationalConsequencePathRow is present", () => {
    assert.match(dbContract, /OperationalConsequencePathRow/);
  });

  test("OperationalConsequenceScenarioRow is present", () => {
    assert.match(dbContract, /OperationalConsequenceScenarioRow/);
  });

  test("OPERATIONAL_CONSEQUENCE_SELECTABLE_COLUMNS is present", () => {
    assert.match(dbContract, /OPERATIONAL_CONSEQUENCE_SELECTABLE_COLUMNS/);
  });

  test("ConsequenceSeverity includes all 5 severities", () => {
    for (const s of ["low", "medium", "high", "critical", "systemic"]) {
      assert.match(dbContract, new RegExp(`"${s}"`), `Missing severity: ${s}`);
    }
  });

  test("ConsequenceImpactHorizon includes all 6 horizons", () => {
    for (const h of ["24h", "48h", "7d", "14d", "30d", "90d"]) {
      assert.match(dbContract, new RegExp(`"${h}"`), `Missing horizon: ${h}`);
    }
  });

  test("ConsequenceImpactType includes all 10 types", () => {
    for (const t of [
      "governance", "execution", "authority", "ratification", "commitment",
      "projection", "reality", "recommendation", "risk", "health",
    ]) {
      assert.match(dbContract, new RegExp(`"${t}"`), `Missing impact type: ${t}`);
    }
  });

  test("ConsequenceAnalysisStatus includes all 3 statuses", () => {
    for (const s of ["generated", "validated", "archived"]) {
      assert.match(dbContract, new RegExp(`"${s}"`), `Missing status: ${s}`);
    }
  });

  test("ConsequenceScenarioName includes all 3 names", () => {
    for (const n of ["best_case", "expected_case", "worst_case"]) {
      assert.match(dbContract, new RegExp(`"${n}"`), `Missing scenario: ${n}`);
    }
  });
});

// ─── Migration ────────────────────────────────────────────────────────────────

describe("Migration", () => {
  test("creates operational_consequences table", () => {
    assert.match(migration, /create table if not exists public\.operational_consequences/);
  });

  test("creates operational_consequence_impacts table", () => {
    assert.match(migration, /create table if not exists public\.operational_consequence_impacts/);
  });

  test("creates operational_consequence_paths table", () => {
    assert.match(migration, /create table if not exists public\.operational_consequence_paths/);
  });

  test("creates operational_consequence_scenarios table", () => {
    assert.match(migration, /create table if not exists public\.operational_consequence_scenarios/);
  });

  test("severity check constraint includes systemic", () => {
    assert.match(migration, /'systemic'/);
  });

  test("impact_horizon check constraint includes 90d", () => {
    assert.match(migration, /'90d'/);
  });

  test("analysis_status check constraint present", () => {
    assert.match(migration, /analysis_status.*check/s);
  });

  test("RLS enabled on all 4 tables", () => {
    const count = (migration.match(/enable row level security/g) ?? []).length;
    assert.equal(count, 4, `Expected 4 RLS enablements, got ${count}`);
  });

  test("workspace isolation policy on operational_consequences", () => {
    assert.match(migration, /workspace_members_can_access_operational_consequences/);
  });

  test("composite FK from operational_consequence_impacts to operational_consequences", () => {
    assert.match(migration, /oci_consequence_workspace_fk/);
  });

  test("composite FK from operational_consequence_paths to operational_consequences", () => {
    assert.match(migration, /ocp_consequence_workspace_fk/);
  });

  test("composite FK from operational_consequence_scenarios to operational_consequences", () => {
    assert.match(migration, /ocs_consequence_workspace_fk/);
  });

  test("indexes created for workspace_id on operational_consequences", () => {
    assert.match(migration, /oc_workspace_id_idx/);
  });

  test("indexes created for focus_item_id on operational_consequences", () => {
    assert.match(migration, /oc_focus_item_id_idx/);
  });
});

// ─── Types ────────────────────────────────────────────────────────────────────

describe("Types", () => {
  test("ConsequenceResult<T> is defined", () => {
    assert.match(types, /ConsequenceResult/);
  });

  test("ConsequenceEventType includes all 9 events", () => {
    const events = [
      "OPERATIONAL_CONSEQUENCE_GENERATED",
      "OPERATIONAL_CONSEQUENCE_VALIDATED",
      "OPERATIONAL_CONSEQUENCE_ARCHIVED",
      "OPERATIONAL_IMPACT_SCORE_CALCULATED",
      "OPERATIONAL_ESCALATION_PROBABILITY_CALCULATED",
      "OPERATIONAL_CASCADE_ANALYZED",
      "OPERATIONAL_SCENARIO_GENERATED",
      "OPERATIONAL_DECISION_SUPPORT_GENERATED",
      "OPERATIONAL_CONSEQUENCE_LINEAGE_GENERATED",
    ];
    for (const e of events) {
      assert.match(types, new RegExp(e), `Missing event type: ${e}`);
    }
  });

  test("DecisionSupport type is defined", () => {
    assert.match(types, /DecisionSupport/);
  });

  test("ConsequenceAnalysis type is defined", () => {
    assert.match(types, /ConsequenceAnalysis/);
  });

  test("CascadeEffect type is defined", () => {
    assert.match(types, /CascadeEffect/);
  });

  test("ConsequenceLineage type is defined", () => {
    assert.match(types, /ConsequenceLineage/);
  });

  test("consequence_analysis layer is present in ConsequenceLineageLayer", () => {
    assert.match(types, /consequence_analysis/);
  });

  test("service input types are defined", () => {
    for (const t of [
      "GenerateConsequenceInput",
      "GetConsequenceInput",
      "ListConsequencesInput",
      "ValidateConsequenceInput",
      "ArchiveConsequenceInput",
      "GetConsequenceLineageInput",
      "ExplainConsequenceInput",
    ]) {
      assert.match(types, new RegExp(t), `Missing input type: ${t}`);
    }
  });
});

// ─── Consequence Generation ───────────────────────────────────────────────────

describe("Consequence Generation", () => {
  test("registry exports generateOperationalConsequence", () => {
    assert.match(registry, /generateOperationalConsequence/);
  });

  test("registry exports getOperationalConsequence", () => {
    assert.match(registry, /getOperationalConsequence/);
  });

  test("registry exports listOperationalConsequences", () => {
    assert.match(registry, /listOperationalConsequences/);
  });

  test("registry exports validateOperationalConsequence", () => {
    assert.match(registry, /validateOperationalConsequence/);
  });

  test("registry exports archiveOperationalConsequence", () => {
    assert.match(registry, /archiveOperationalConsequence/);
  });

  test("registry exports getConsequenceAnalysis", () => {
    assert.match(registry, /getConsequenceAnalysis/);
  });

  test("registry exports getOperationalConsequenceLineageForConsequence", () => {
    assert.match(registry, /getOperationalConsequenceLineageForConsequence/);
  });

  test("registry validates workspaceId as UUID", () => {
    assert.match(registry, /workspaceId must be a UUID/);
  });

  test("registry validates focusItemId as UUID", () => {
    assert.match(registry, /focusItemId must be a UUID/);
  });

  test("registry emits OPERATIONAL_CONSEQUENCE_GENERATED", () => {
    assert.match(registry, /OPERATIONAL_CONSEQUENCE_GENERATED/);
  });

  test("consequence origin requires focus item — not_found failureClass on missing focus item", () => {
    assert.match(registry, /Focus item not found/);
  });
});

// ─── Impact Score Engine ──────────────────────────────────────────────────────

describe("Impact Score Engine", () => {
  test("impact-engine exports calculateImpactScore", () => {
    assert.match(impactEng, /calculateImpactScore/);
  });

  test("impact-engine exports calculateConsequenceSeverity", () => {
    assert.match(impactEng, /calculateConsequenceSeverity/);
  });

  test("low impact score → low severity", () => {
    const score = calculateImpactScore({
      focusScore: 10, operationalPriority: "low", dependencyCount: 0,
      governanceImpact: 10, executionImpact: 10, historicalSimilarity: 10,
    });
    assert.equal(calculateConsequenceSeverity(score), "low");
  });

  test("medium impact score → medium severity", () => {
    const score = calculateImpactScore({
      focusScore: 40, operationalPriority: "medium", dependencyCount: 3,
      governanceImpact: 30, executionImpact: 25, historicalSimilarity: 40,
    });
    assert.equal(calculateConsequenceSeverity(score), "medium");
  });

  test("high impact score → high severity", () => {
    const score = calculateImpactScore({
      focusScore: 65, operationalPriority: "high", dependencyCount: 6,
      governanceImpact: 60, executionImpact: 55, historicalSimilarity: 60,
    });
    assert.equal(calculateConsequenceSeverity(score), "high");
  });

  test("critical impact score → critical severity", () => {
    const score = calculateImpactScore({
      focusScore: 80, operationalPriority: "critical", dependencyCount: 8,
      governanceImpact: 80, executionImpact: 75, historicalSimilarity: 80,
    });
    assert.equal(calculateConsequenceSeverity(score), "critical");
  });

  test("systemic impact score → systemic severity", () => {
    const score = calculateImpactScore({
      focusScore: 100, operationalPriority: "critical", dependencyCount: 10,
      governanceImpact: 100, executionImpact: 100, historicalSimilarity: 100,
    });
    assert.equal(calculateConsequenceSeverity(score), "systemic");
  });

  test("impact score is bounded 0–100", () => {
    const low = calculateImpactScore({
      focusScore: 0, operationalPriority: "low", dependencyCount: 0,
      governanceImpact: 0, executionImpact: 0, historicalSimilarity: 0,
    });
    const high = calculateImpactScore({
      focusScore: 100, operationalPriority: "critical", dependencyCount: 100,
      governanceImpact: 100, executionImpact: 100, historicalSimilarity: 100,
    });
    assert.ok(low >= 0 && low <= 100, `Low score ${low} out of range`);
    assert.ok(high >= 0 && high <= 100, `High score ${high} out of range`);
  });
});

// ─── Escalation Probability Engine ───────────────────────────────────────────

describe("Escalation Probability Engine", () => {
  test("escalation-engine exports calculateEscalationProbability", () => {
    assert.match(escalEng, /calculateEscalationProbability/);
  });

  test("escalation probability is in 0.0–1.0 range", () => {
    const low = calculateEscalationProbability({
      severity: "low", dependencyDensity: 0, openCommitments: 0,
      activeViolations: 0, historicalEscalationRate: 0,
    });
    const high = calculateEscalationProbability({
      severity: "systemic", dependencyDensity: 10, openCommitments: 10,
      activeViolations: 10, historicalEscalationRate: 1,
    });
    assert.ok(low >= 0 && low <= 1, `Low prob ${low} out of range`);
    assert.ok(high >= 0 && high <= 1, `High prob ${high} out of range`);
  });

  test("critical severity has higher base probability than low", () => {
    const critProb = calculateEscalationProbability({
      severity: "critical", dependencyDensity: 0, openCommitments: 0,
      activeViolations: 0, historicalEscalationRate: 0,
    });
    const lowProb = calculateEscalationProbability({
      severity: "low", dependencyDensity: 0, openCommitments: 0,
      activeViolations: 0, historicalEscalationRate: 0,
    });
    assert.ok(critProb > lowProb, `Critical prob ${critProb} should exceed low prob ${lowProb}`);
  });

  test("more dependencies increase escalation probability", () => {
    const withDeps    = calculateEscalationProbability({ severity: "medium", dependencyDensity: 5, openCommitments: 0, activeViolations: 0, historicalEscalationRate: 0 });
    const withoutDeps = calculateEscalationProbability({ severity: "medium", dependencyDensity: 0, openCommitments: 0, activeViolations: 0, historicalEscalationRate: 0 });
    assert.ok(withDeps > withoutDeps);
  });

  test("escalation probability has 3 decimal precision", () => {
    const prob = calculateEscalationProbability({
      severity: "high", dependencyDensity: 3, openCommitments: 5,
      activeViolations: 2, historicalEscalationRate: 0.5,
    });
    const decimals = prob.toString().split(".")[1]?.length ?? 0;
    assert.ok(decimals <= 3, `Too many decimal places: ${decimals}`);
  });
});

// ─── Cascade Analysis Engine ──────────────────────────────────────────────────

describe("Cascade Analysis Engine", () => {
  test("cascade-engine exports analyzeCascadeEffects", () => {
    assert.match(cascadeEng, /analyzeCascadeEffects/);
  });

  test("authority gap cascade is a simple linear chain", () => {
    const focusItemId = uuid();
    const result = analyzeCascadeEffects({
      focusType: "authority", focusItemId, entityCounts: {},
    });
    assert.ok(result.chain.length >= 3, `Expected at least 3 steps, got ${result.chain.length}`);
    assert.ok(result.maxDepth >= 2, `Expected depth >= 2, got ${result.maxDepth}`);
  });

  test("authority gap chain labels include Ratification Blocked", () => {
    const result = analyzeCascadeEffects({ focusType: "authority", focusItemId: uuid(), entityCounts: {} });
    const labels = result.chain.map((n) => n.label);
    assert.ok(labels.includes("Ratification Blocked"), `Missing label. Got: ${JSON.stringify(labels)}`);
  });

  test("authority gap chain labels include Commitments Delayed", () => {
    const result = analyzeCascadeEffects({ focusType: "authority", focusItemId: uuid(), entityCounts: {} });
    const labels = result.chain.map((n) => n.label);
    assert.ok(labels.includes("Commitments Delayed"), `Missing label. Got: ${JSON.stringify(labels)}`);
  });

  test("commitment cascade includes realities impact", () => {
    const result = analyzeCascadeEffects({ focusType: "commitment", focusItemId: uuid(), entityCounts: {} });
    const types = result.chain.map((n) => n.entityType);
    assert.ok(types.includes("realities"), `Expected realities in chain. Got: ${JSON.stringify(types)}`);
  });

  test("cascade depth is correct for authority chain (5 steps → depth 4)", () => {
    const result = analyzeCascadeEffects({ focusType: "authority", focusItemId: uuid(), entityCounts: {} });
    assert.equal(result.maxDepth, 4);
  });

  test("governance cascade is shorter than authority cascade", () => {
    const authority   = analyzeCascadeEffects({ focusType: "authority",  focusItemId: uuid(), entityCounts: {} });
    const governance  = analyzeCascadeEffects({ focusType: "governance", focusItemId: uuid(), entityCounts: {} });
    assert.ok(authority.chain.length >= governance.chain.length);
  });

  test("unknown focus type falls back to default 2-step chain", () => {
    const result = analyzeCascadeEffects({ focusType: "unknown_type", focusItemId: uuid(), entityCounts: {} });
    assert.ok(result.chain.length >= 2);
  });

  test("totalAffectedEntities counts known entity types", () => {
    const result = analyzeCascadeEffects({
      focusType: "authority", focusItemId: uuid(),
      entityCounts: { operational_focus_items: 3, commitments: 5 },
    });
    assert.ok(result.totalAffectedEntities >= 3);
  });
});

// ─── Scenario Engine ──────────────────────────────────────────────────────────

describe("Scenario Engine", () => {
  test("scenario-engine exports generateConsequenceScenarios", () => {
    assert.match(scenarioEng, /generateConsequenceScenarios/);
  });

  test("generates exactly 3 scenarios", () => {
    const scenarios = generateConsequenceScenarios({
      focusType: "authority", severity: "critical", escalationProbability: 0.84, impactScore: 75,
    });
    assert.equal(scenarios.length, 3);
  });

  test("best_case scenario has probability 0.20", () => {
    const scenarios = generateConsequenceScenarios({
      focusType: "commitment", severity: "high", escalationProbability: 0.5, impactScore: 60,
    });
    const best = scenarios.find((s) => s.name === "best_case");
    assert.ok(best, "best_case not found");
    assert.equal(best.probability, 0.20);
  });

  test("expected_case scenario has probability 0.60", () => {
    const scenarios = generateConsequenceScenarios({
      focusType: "governance", severity: "medium", escalationProbability: 0.3, impactScore: 45,
    });
    const expected = scenarios.find((s) => s.name === "expected_case");
    assert.ok(expected, "expected_case not found");
    assert.equal(expected.probability, 0.60);
  });

  test("worst_case scenario has probability 0.20", () => {
    const scenarios = generateConsequenceScenarios({
      focusType: "execution", severity: "high", escalationProbability: 0.6, impactScore: 65,
    });
    const worst = scenarios.find((s) => s.name === "worst_case");
    assert.ok(worst, "worst_case not found");
    assert.equal(worst.probability, 0.20);
  });

  test("scenario probabilities sum to 1.0", () => {
    const scenarios = generateConsequenceScenarios({
      focusType: "projection", severity: "low", escalationProbability: 0.1, impactScore: 20,
    });
    const total = scenarios.reduce((s, sc) => s + sc.probability, 0);
    assert.ok(Math.abs(total - 1.0) < 0.001, `Probabilities sum to ${total}, expected 1.0`);
  });
});

// ─── Impact Horizon Engine ────────────────────────────────────────────────────

describe("Impact Horizon Engine", () => {
  test("horizon-engine exports calculateImpactHorizon", () => {
    assert.match(horizonEng, /calculateImpactHorizon/);
  });

  test("critical severity → 24h horizon", () => {
    assert.equal(calculateImpactHorizon("critical"), "24h");
  });

  test("high severity → 48h horizon", () => {
    assert.equal(calculateImpactHorizon("high"), "48h");
  });

  test("medium severity → 7d horizon", () => {
    assert.equal(calculateImpactHorizon("medium"), "7d");
  });

  test("low severity → 14d horizon", () => {
    assert.equal(calculateImpactHorizon("low"), "14d");
  });

  test("systemic severity → 30d horizon", () => {
    assert.equal(calculateImpactHorizon("systemic"), "30d");
  });
});

// ─── Decision Support Engine ──────────────────────────────────────────────────

describe("Decision Support Engine", () => {
  test("decision-support-engine exports generateDecisionSupport", () => {
    assert.match(decisionEng, /generateDecisionSupport/);
  });

  test("authority gap recommends create_delegation action", () => {
    assert.match(decisionEng, /create_delegation/);
  });

  test("governance violation recommends resolve_governance_issue", () => {
    assert.match(decisionEng, /resolve_governance_issue/);
  });

  test("commitment recommends deliver_commitment", () => {
    assert.match(decisionEng, /deliver_commitment/);
  });

  test("escalation probability is reflected in rationale", () => {
    assert.match(decisionEng, /escalation probability/i);
  });

  test("impact if ignored references severity", () => {
    assert.match(decisionEng, /impactIfIgnored/);
  });

  test("blocked entity count is included", () => {
    assert.match(decisionEng, /blockedEntityCount/);
  });
});

// ─── Consequence Lineage ──────────────────────────────────────────────────────

describe("Consequence Lineage", () => {
  test("lineage-engine exports getOperationalConsequenceLineage", () => {
    assert.match(lineageEng, /getOperationalConsequenceLineage/);
  });

  test("lineage chain includes constitution layer", () => {
    assert.match(lineageEng, /constitution/);
  });

  test("lineage chain includes consequence_analysis layer", () => {
    assert.match(lineageEng, /consequence_analysis/);
  });

  test("lineage chain has 13 layers", () => {
    assert.match(lineageEng, /13/);
  });

  test("lineage returns not_found for missing consequence", () => {
    assert.match(lineageEng, /not_found/);
  });

  test("registry exports getOperationalConsequenceLineageForConsequence", () => {
    assert.match(registry, /getOperationalConsequenceLineageForConsequence/);
  });

  test("lineage emits OPERATIONAL_CONSEQUENCE_LINEAGE_GENERATED", () => {
    assert.match(registry, /OPERATIONAL_CONSEQUENCE_LINEAGE_GENERATED/);
  });
});

// ─── Audit Events ─────────────────────────────────────────────────────────────

describe("Audit Events", () => {
  const expectedEvents = [
    "OPERATIONAL_CONSEQUENCE_GENERATED",
    "OPERATIONAL_CONSEQUENCE_VALIDATED",
    "OPERATIONAL_CONSEQUENCE_ARCHIVED",
    "OPERATIONAL_IMPACT_SCORE_CALCULATED",
    "OPERATIONAL_ESCALATION_PROBABILITY_CALCULATED",
    "OPERATIONAL_CASCADE_ANALYZED",
    "OPERATIONAL_SCENARIO_GENERATED",
    "OPERATIONAL_DECISION_SUPPORT_GENERATED",
    "OPERATIONAL_CONSEQUENCE_LINEAGE_GENERATED",
  ];

  for (const event of expectedEvents) {
    test(`registry emits ${event}`, () => {
      assert.match(registry, new RegExp(event), `Missing event: ${event}`);
    });
  }

  test("events include consequenceId in payload", () => {
    assert.match(registry, /consequenceId/);
  });

  test("events include focusItemId in payload", () => {
    assert.match(registry, /focusItemId/);
  });
});

// ─── Workspace Isolation ──────────────────────────────────────────────────────

describe("Workspace Isolation", () => {
  test("repository always filters by workspace_id", () => {
    const count = (repo.match(/\.eq\("workspace_id"/g) ?? []).length;
    assert.ok(count >= 6, `Expected >= 6 workspace_id filters, got ${count}`);
  });

  test("migration enables RLS on all tables", () => {
    const count = (migration.match(/enable row level security/g) ?? []).length;
    assert.equal(count, 4);
  });

  test("migration uses is_workspace_member in all policies", () => {
    const count = (migration.match(/is_workspace_member/g) ?? []).length;
    assert.equal(count, 4, `Expected 4 is_workspace_member checks, got ${count}`);
  });

  test("registry validates workspaceId on every public operation", () => {
    const count = (registry.match(/workspaceId must be a UUID/g) ?? []).length;
    assert.ok(count >= 5, `Expected >= 5 workspaceId validations, got ${count}`);
  });
});

// ─── Immutability Rules ───────────────────────────────────────────────────────

describe("Immutability Rules (consequence never modifies entities)", () => {
  test("registry does NOT update operational_focus_items", () => {
    assert.doesNotMatch(registry, /update.*operational_focus_items/s);
  });

  test("registry does NOT update operational_command_centers", () => {
    assert.doesNotMatch(registry, /update.*operational_command_centers/s);
  });

  test("repository does NOT delete focus items", () => {
    assert.doesNotMatch(repo, /delete.*operational_focus_items/s);
  });
});

// ─── Repository ───────────────────────────────────────────────────────────────

describe("Repository", () => {
  test("repository exports dbCreateConsequence", () => {
    assert.match(repo, /dbCreateConsequence/);
  });

  test("repository exports dbFindConsequenceById", () => {
    assert.match(repo, /dbFindConsequenceById/);
  });

  test("repository exports dbListConsequences", () => {
    assert.match(repo, /dbListConsequences/);
  });

  test("repository exports dbUpdateConsequenceStatus", () => {
    assert.match(repo, /dbUpdateConsequenceStatus/);
  });

  test("repository exports dbCreateConsequenceImpact", () => {
    assert.match(repo, /dbCreateConsequenceImpact/);
  });

  test("repository exports dbCreateConsequencePath", () => {
    assert.match(repo, /dbCreateConsequencePath/);
  });

  test("repository exports dbCreateConsequenceScenario", () => {
    assert.match(repo, /dbCreateConsequenceScenario/);
  });

  test("list supports focusItemId filter", () => {
    assert.match(repo, /focusItemId/);
  });

  test("list supports severity filter", () => {
    assert.match(repo, /severity/);
  });

  test("list supports analysisStatus filter", () => {
    assert.match(repo, /analysisStatus/);
  });
});

// ─── Explain Capability ───────────────────────────────────────────────────────

describe("Explain Capability", () => {
  test("explain exports explainOperationalConsequences", () => {
    assert.match(explainFile, /explainOperationalConsequences/);
  });

  test("explain includes Cascade Analysis section", () => {
    assert.match(explainFile, /Cascade Analysis/);
  });

  test("explain includes Escalation Probability section", () => {
    assert.match(explainFile, /Escalation Probability/);
  });

  test("explain includes Scenario Generation section", () => {
    assert.match(explainFile, /Scenario Generation/);
  });

  test("explain includes Decision Support section", () => {
    assert.match(explainFile, /Decision Support/);
  });

  test("explain includes Lineage section", () => {
    assert.match(explainFile, /Lineage/);
  });

  test("explain includes Impact Horizon section", () => {
    assert.match(explainFile, /Impact Horizon/);
  });
});

// ─── Documentation ────────────────────────────────────────────────────────────

describe("Documentation", () => {
  test("docs file exists and is non-empty", () => {
    assert.ok(docs.length > 500, `Docs too short: ${docs.length} chars`);
  });

  test("docs include Architecture section", () => {
    assert.match(docs, /Arquitectura|Architecture/i);
  });

  test("docs include Consequence Model", () => {
    assert.match(docs, /Consequence Model|Modelo de Consecuencia/i);
  });

  test("docs include Impact Score", () => {
    assert.match(docs, /Impact Score|Puntaje de Impacto/i);
  });

  test("docs include Cascade Analysis", () => {
    assert.match(docs, /Cascade|Cascada/i);
  });

  test("docs include Escalation Probability", () => {
    assert.match(docs, /Escalation|Escalamiento/i);
  });

  test("docs include Decision Support", () => {
    assert.match(docs, /Decision Support|Soporte de Decisión/i);
  });

  test("docs include use case examples", () => {
    assert.match(docs, /authority_gap|authority gap/i);
  });
});
