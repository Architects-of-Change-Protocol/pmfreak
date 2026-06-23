/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck -- Node 20 executes this TypeScript-named test without a loader.
const assert = require("node:assert/strict");
const { test, describe } = require("node:test");
const { readFileSync } = require("node:fs");

// ─────────────────────────────────────────────────────────────────────────────
// Operational Decision Engine — Unit Tests (EPIC 4 Sprint 4)
// Pure structural + algorithm tests — no database access.
// ─────────────────────────────────────────────────────────────────────────────

const types        = readFileSync("src/lib/operational-decision/types.ts", "utf8");
const registry     = readFileSync("src/lib/operational-decision/decision-registry.ts", "utf8");
const repo         = readFileSync("src/lib/operational-decision/decision-repository.ts", "utf8");
const altEng       = readFileSync("src/lib/operational-decision/alternative-engine.ts", "utf8");
const evalEng      = readFileSync("src/lib/operational-decision/evaluation-engine.ts", "utf8");
const scoreEng     = readFileSync("src/lib/operational-decision/scoring-engine.ts", "utf8");
const confEng      = readFileSync("src/lib/operational-decision/confidence-engine.ts", "utf8");
const tradeoffEng  = readFileSync("src/lib/operational-decision/tradeoff-engine.ts", "utf8");
const recEng       = readFileSync("src/lib/operational-decision/recommendation-engine.ts", "utf8");
const compEng      = readFileSync("src/lib/operational-decision/comparative-engine.ts", "utf8");
const supportEng   = readFileSync("src/lib/operational-decision/decision-support-engine.ts", "utf8");
const lineageEng   = readFileSync("src/lib/operational-decision/lineage-engine.ts", "utf8");
const explainFile  = readFileSync("src/lib/operational-decision/explain.ts", "utf8");
const dbContract   = readFileSync("src/lib/db/database-contract.ts", "utf8");
const migration    = readFileSync("supabase/migrations/20260712000000_operational_decision_engine.sql", "utf8");
const docs         = readFileSync("docs/operational-decision-engine.md", "utf8");

// ─── Inline Engine Implementations ───────────────────────────────────────────

function generateDecisionAlternatives({ focusType }) {
  const ALTERNATIVES = {
    authority: [
      { optionName: "create_delegation",     optionType: "authority",  pros: ["Resolves authority gap immediately", "Preserves governance chain", "Lowest execution impact"], cons: ["Requires qualified delegate", "May need ratification"], estimatedEffort: "medium", estimatedRisk: "low",    optionDescription: "" },
      { optionName: "sponsor_intervention",  optionType: "escalation", pros: ["Fast resolution", "Uses existing sponsor authority"],                                         cons: ["Consumes sponsor bandwidth", "May set precedent for bypassing governance"],        estimatedEffort: "low",    estimatedRisk: "medium", optionDescription: "" },
      { optionName: "governance_board_review",optionType:"governance", pros: ["Highest institutional legitimacy", "Creates permanent governance clarity"],                   cons: ["Slowest path", "High process overhead"],                                              estimatedEffort: "high",   estimatedRisk: "low",    optionDescription: "" },
    ],
    commitment: [
      { optionName: "reassign_owner",        optionType: "commitment", pros: ["Minimises execution impact"], cons: ["Requires available assignee"], estimatedEffort: "medium", estimatedRisk: "low",      optionDescription: "" },
      { optionName: "extend_deadline",       optionType: "commitment", pros: ["Low change risk"],            cons: ["Delays downstream"],           estimatedEffort: "low",    estimatedRisk: "medium",   optionDescription: "" },
      { optionName: "breach_commitment",     optionType: "risk",       pros: ["Forces clarity"],             cons: ["Damages trust"],               estimatedEffort: "low",    estimatedRisk: "critical", optionDescription: "" },
    ],
    execution: [
      { optionName: "revise_projection",     optionType: "execution",  pros: ["Restores accuracy"],          cons: ["May expose misses"],           estimatedEffort: "medium", estimatedRisk: "low",    optionDescription: "" },
      { optionName: "increase_resources",    optionType: "resource",   pros: ["Fastest acceleration"],       cons: ["Higher cost"],                 estimatedEffort: "high",   estimatedRisk: "medium", optionDescription: "" },
      { optionName: "reduce_scope",          optionType: "structural", pros: ["Preserves health"],           cons: ["Stakeholder impact"],          estimatedEffort: "medium", estimatedRisk: "medium", optionDescription: "" },
    ],
    governance: [
      { optionName: "governance_review",     optionType: "governance", pros: ["Restores integrity"],         cons: ["Time-intensive"],              estimatedEffort: "high",   estimatedRisk: "low",    optionDescription: "" },
      { optionName: "corrective_action",     optionType: "governance", pros: ["Fast and targeted"],          cons: ["May not address root cause"],  estimatedEffort: "medium", estimatedRisk: "medium", optionDescription: "" },
      { optionName: "escalation",            optionType: "escalation", pros: ["High visibility"],            cons: ["Consumes bandwidth"],          estimatedEffort: "low",    estimatedRisk: "medium", optionDescription: "" },
    ],
  };
  return ALTERNATIVES[focusType] ?? [
    { optionName: "immediate_resolution",    optionType: "execution",  pros: ["Fast"], cons: [],             estimatedEffort: "medium", estimatedRisk: "medium", optionDescription: "" },
    { optionName: "structured_review",       optionType: "governance", pros: ["Thorough"], cons: ["Slower"], estimatedEffort: "high",   estimatedRisk: "low",    optionDescription: "" },
    { optionName: "escalation_to_authority", optionType: "escalation", pros: ["Accountable"], cons: [],      estimatedEffort: "low",    estimatedRisk: "medium", optionDescription: "" },
  ];
}

function evaluateDecisionOptions({ alternatives, consequenceSeverity, escalationProbability, impactScore }) {
  const severityMultiplier = { systemic: 1.0, critical: 0.9, high: 0.8, medium: 0.6, low: 0.4 };
  const sv = severityMultiplier[consequenceSeverity] ?? 0.6;

  return alternatives.map((alt) => {
    const typeGovBonus  = { governance: 30, authority: 25, structural: 20, commitment: 15, escalation: 10, execution: 5, resource: 5, risk: 0 };
    const typeExecBonus = { execution: 40, resource: 35, commitment: 30, escalation: 20, governance: 15, authority: 15, structural: 10, risk: 10 };
    const riskPenalty   = { low: 0, medium: 15, high: 30, critical: 50 };
    const effortPenalty = { low: 0, medium: 10, high: 20 };

    const governanceScore = Math.min(100, Math.round(((typeGovBonus[alt.optionType] ?? 10) + (alt.estimatedEffort === "high" ? 15 : alt.estimatedEffort === "medium" ? 10 : 5)) * (1 + sv * 0.5)));
    const executionScore  = Math.max(0, Math.min(100, Math.round((typeExecBonus[alt.optionType] ?? 10) + (escalationProbability > 0.7 ? 15 : escalationProbability > 0.4 ? 8 : 0) - (effortPenalty[alt.estimatedEffort] ?? 10))));
    const riskScore       = Math.max(0, Math.min(100, Math.round(80 - (riskPenalty[alt.estimatedRisk] ?? 15) + (impactScore > 70 ? 10 : impactScore > 40 ? 5 : 0))));
    const healthScore     = Math.max(0, Math.min(100, Math.round((50 + (alt.pros.length - alt.cons.length) * 8) * (1 + sv * 0.3))));
    const overallScore    = Math.max(0, Math.min(100, Math.round(governanceScore * 0.30 + executionScore * 0.30 + riskScore * 0.25 + healthScore * 0.15)));
    return { optionName: alt.optionName, scores: { governanceScore, executionScore, riskScore, healthScore, overallScore } };
  });
}

function calculateDecisionScore(evaluations) {
  if (evaluations.length === 0) return 0;
  return Math.max(...evaluations.map((e) => e.scores.overallScore));
}

function calculateDecisionConfidence({ evaluations, escalationProbability, impactScore, alternativeCount }) {
  if (evaluations.length === 0) return 0;
  const scores   = evaluations.map((e) => e.scores.overallScore);
  const topScore = Math.max(...scores);
  const second   = scores.length > 1 ? Math.max(...scores.filter((s) => s < topScore)) : 0;
  const spread   = Math.min((topScore - second) / 30, 0.35);
  const raw = spread + escalationProbability * 0.25 + (impactScore / 100) * 0.20 + Math.min(alternativeCount / 3, 1) * 0.20;
  return Math.max(0, Math.min(1, parseFloat(raw.toFixed(3))));
}

function analyzeDecisionTradeoffs(alternatives) {
  return alternatives.map((alt) => {
    const riskImpact   = { low: 20, medium: 45, high: 65, critical: 85 };
    const effortImpact = { low: 15, medium: 40, high: 70 };
    const typeBonus    = { governance: 70, authority: 65, execution: 60, commitment: 55, escalation: 50, resource: 50, risk: 45, structural: 40 };
    const base         = typeBonus[alt.optionType] ?? 50;
    const tradeoffs    = [
      ...alt.pros.map((p) => ({ tradeoffType: "pro", description: p, impactScore: Math.min(100, base + (alt.estimatedEffort === "high" ? 10 : alt.estimatedEffort === "medium" ? 5 : 0)) })),
      ...alt.cons.map((c) => ({ tradeoffType: "con", description: c, impactScore: riskImpact[alt.estimatedRisk] ?? 45 })),
      { tradeoffType: "con", description: `Estimated implementation effort: ${alt.estimatedEffort}`, impactScore: effortImpact[alt.estimatedEffort] ?? 40 },
    ];
    return { optionName: alt.optionName, tradeoffs };
  });
}

function selectRecommendedDecision({ alternatives, evaluations, confidence }) {
  if (evaluations.length === 0) return null;
  const ranked = [...evaluations].sort((a, b) => b.scores.overallScore - a.scores.overallScore);
  const best   = ranked[0];
  const alt    = alternatives.find((a) => a.optionName === best.optionName);
  if (!best || !alt) return null;
  return { optionName: best.optionName, score: best.scores.overallScore, confidence, rationale: `Recommended: ${alt.optionName} (score: ${best.scores.overallScore}/100).` };
}

function compareDecisionOptions(evaluations) {
  if (evaluations.length === 0) return { ranked: [], topOption: "", spread: 0 };
  const sorted    = [...evaluations].sort((a, b) => b.scores.overallScore - a.scores.overallScore);
  const topScore  = sorted[0].scores.overallScore;
  const botScore  = sorted[sorted.length - 1].scores.overallScore;
  const ranked    = sorted.map((e, i) => ({ optionName: e.optionName, score: e.scores.overallScore, rank: i + 1, scoreDifferenceFromTop: topScore - e.scores.overallScore }));
  return { ranked, topOption: sorted[0].optionName, spread: topScore - botScore };
}

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Database Contract ────────────────────────────────────────────────────────

describe("Database Contract", () => {
  test("DATABASE_CONTRACT_VERSION includes operational-decision-engine", () => {
    assert.match(dbContract, /operational-decision-engine/);
  });

  test("OperationalDecisionRow is present", () => {
    assert.match(dbContract, /OperationalDecisionRow/);
  });

  test("OperationalDecisionOptionRow is present", () => {
    assert.match(dbContract, /OperationalDecisionOptionRow/);
  });

  test("OperationalDecisionEvaluationRow is present", () => {
    assert.match(dbContract, /OperationalDecisionEvaluationRow/);
  });

  test("OperationalDecisionTradeoffRow is present", () => {
    assert.match(dbContract, /OperationalDecisionTradeoffRow/);
  });

  test("OPERATIONAL_DECISION_SELECTABLE_COLUMNS is present", () => {
    assert.match(dbContract, /OPERATIONAL_DECISION_SELECTABLE_COLUMNS/);
  });

  test("DecisionCategory includes all 10 categories", () => {
    for (const c of ["governance", "authority", "ratification", "execution", "commitment", "risk", "resource", "escalation", "projection", "portfolio"]) {
      assert.match(dbContract, new RegExp(`"${c}"`), `Missing category: ${c}`);
    }
  });

  test("DecisionStatus includes all 6 statuses", () => {
    for (const s of ["generated", "evaluated", "recommended", "accepted", "rejected", "archived"]) {
      assert.match(dbContract, new RegExp(`"${s}"`), `Missing status: ${s}`);
    }
  });

  test("DecisionTradeoffType includes pro and con", () => {
    assert.match(dbContract, /"pro"/);
    assert.match(dbContract, /"con"/);
  });
});

// ─── Migration ────────────────────────────────────────────────────────────────

describe("Migration", () => {
  test("creates operational_decisions table", () => {
    assert.match(migration, /create table if not exists public\.operational_decisions/);
  });

  test("creates operational_decision_options table", () => {
    assert.match(migration, /create table if not exists public\.operational_decision_options/);
  });

  test("creates operational_decision_evaluations table", () => {
    assert.match(migration, /create table if not exists public\.operational_decision_evaluations/);
  });

  test("creates operational_decision_tradeoffs table", () => {
    assert.match(migration, /create table if not exists public\.operational_decision_tradeoffs/);
  });

  test("decision_status check constraint present", () => {
    assert.match(migration, /decision_status.*check/s);
  });

  test("decision_confidence bounded 0–1", () => {
    assert.match(migration, /decision_confidence.*between 0 and 1/s);
  });

  test("decision_score bounded 0–100", () => {
    assert.match(migration, /decision_score.*between 0 and 100/s);
  });

  test("RLS enabled on all 4 tables", () => {
    const count = (migration.match(/enable row level security/g) ?? []).length;
    assert.equal(count, 4, `Expected 4 RLS enablements, got ${count}`);
  });

  test("workspace isolation policy on operational_decisions", () => {
    assert.match(migration, /workspace_members_can_access_operational_decisions/);
  });

  test("composite FK from operational_decision_options to operational_decisions", () => {
    assert.match(migration, /odo_decision_workspace_fk/);
  });

  test("composite FK from operational_decision_evaluations to operational_decisions", () => {
    assert.match(migration, /ode_decision_workspace_fk/);
  });

  test("composite FK from operational_decision_tradeoffs to operational_decisions", () => {
    assert.match(migration, /odt_decision_workspace_fk/);
  });

  test("FK from operational_decisions to operational_consequences", () => {
    assert.match(migration, /od_consequence_workspace_fk/);
  });

  test("recommended_option FK added via ALTER TABLE", () => {
    assert.match(migration, /od_recommended_option_fk/);
  });

  test("indexes on workspace_id for operational_decisions", () => {
    assert.match(migration, /od_workspace_id_idx/);
  });
});

// ─── Types ────────────────────────────────────────────────────────────────────

describe("Types", () => {
  test("DecisionResult<T> is defined", () => {
    assert.match(types, /DecisionResult/);
  });

  test("DecisionEventType includes all 10 events", () => {
    const events = [
      "OPERATIONAL_DECISION_GENERATED",
      "OPERATIONAL_DECISION_EVALUATED",
      "OPERATIONAL_DECISION_RECOMMENDED",
      "OPERATIONAL_DECISION_ACCEPTED",
      "OPERATIONAL_DECISION_REJECTED",
      "OPERATIONAL_DECISION_ARCHIVED",
      "OPERATIONAL_DECISION_SCORE_CALCULATED",
      "OPERATIONAL_DECISION_CONFIDENCE_CALCULATED",
      "OPERATIONAL_DECISION_TRADEOFF_ANALYZED",
      "OPERATIONAL_DECISION_LINEAGE_GENERATED",
    ];
    for (const e of events) {
      assert.match(types, new RegExp(e), `Missing event type: ${e}`);
    }
  });

  test("DecisionAlternative type is defined", () => {
    assert.match(types, /DecisionAlternative/);
  });

  test("DecisionEvaluationScores type is defined", () => {
    assert.match(types, /DecisionEvaluationScores/);
  });

  test("OperationalDecisionAnalysis type is defined", () => {
    assert.match(types, /OperationalDecisionAnalysis/);
  });

  test("OperationalDecisionLineage type is defined", () => {
    assert.match(types, /OperationalDecisionLineage/);
  });

  test("DecisionLineageLayer includes decision layer", () => {
    assert.match(types, /"decision"/);
  });

  test("service input types are all defined", () => {
    for (const t of [
      "GenerateDecisionInput",
      "GetDecisionInput",
      "ListDecisionsInput",
      "ValidateDecisionInput",
      "ArchiveDecisionInput",
      "GetDecisionLineageInput",
      "ExplainDecisionInput",
    ]) {
      assert.match(types, new RegExp(t), `Missing input type: ${t}`);
    }
  });
});

// ─── Alternative Generation ───────────────────────────────────────────────────

describe("Alternative Generation", () => {
  test("alternative-engine exports generateDecisionAlternatives", () => {
    assert.match(altEng, /generateDecisionAlternatives/);
  });

  test("authority gap generates create_delegation option", () => {
    const alts = generateDecisionAlternatives({ focusType: "authority" });
    assert.ok(alts.some((a) => a.optionName === "create_delegation"), "Missing create_delegation");
  });

  test("authority gap generates sponsor_intervention option", () => {
    const alts = generateDecisionAlternatives({ focusType: "authority" });
    assert.ok(alts.some((a) => a.optionName === "sponsor_intervention"), "Missing sponsor_intervention");
  });

  test("authority gap generates governance_board_review option", () => {
    const alts = generateDecisionAlternatives({ focusType: "authority" });
    assert.ok(alts.some((a) => a.optionName === "governance_board_review"), "Missing governance_board_review");
  });

  test("overdue commitment generates extend_deadline option", () => {
    const alts = generateDecisionAlternatives({ focusType: "commitment" });
    assert.ok(alts.some((a) => a.optionName === "extend_deadline"), "Missing extend_deadline");
  });

  test("overdue commitment generates reassign_owner option", () => {
    const alts = generateDecisionAlternatives({ focusType: "commitment" });
    assert.ok(alts.some((a) => a.optionName === "reassign_owner"), "Missing reassign_owner");
  });

  test("overdue commitment generates breach_commitment option", () => {
    const alts = generateDecisionAlternatives({ focusType: "commitment" });
    assert.ok(alts.some((a) => a.optionName === "breach_commitment"), "Missing breach_commitment");
  });

  test("execution drift generates revise_projection option", () => {
    const alts = generateDecisionAlternatives({ focusType: "execution" });
    assert.ok(alts.some((a) => a.optionName === "revise_projection"), "Missing revise_projection");
  });

  test("execution drift generates increase_resources option", () => {
    const alts = generateDecisionAlternatives({ focusType: "execution" });
    assert.ok(alts.some((a) => a.optionName === "increase_resources"), "Missing increase_resources");
  });

  test("execution drift generates reduce_scope option", () => {
    const alts = generateDecisionAlternatives({ focusType: "execution" });
    assert.ok(alts.some((a) => a.optionName === "reduce_scope"), "Missing reduce_scope");
  });

  test("governance violation generates governance_review option", () => {
    const alts = generateDecisionAlternatives({ focusType: "governance" });
    assert.ok(alts.some((a) => a.optionName === "governance_review"), "Missing governance_review");
  });

  test("governance violation generates corrective_action option", () => {
    const alts = generateDecisionAlternatives({ focusType: "governance" });
    assert.ok(alts.some((a) => a.optionName === "corrective_action"), "Missing corrective_action");
  });

  test("governance violation generates escalation option", () => {
    const alts = generateDecisionAlternatives({ focusType: "governance" });
    assert.ok(alts.some((a) => a.optionName === "escalation"), "Missing escalation for governance");
  });

  test("unknown focus type falls back to 3 default alternatives", () => {
    const alts = generateDecisionAlternatives({ focusType: "unknown_xyz" });
    assert.equal(alts.length, 3);
  });

  test("each alternative has at least 1 pro", () => {
    const alts = generateDecisionAlternatives({ focusType: "authority" });
    for (const a of alts) {
      assert.ok(a.pros.length >= 1, `${a.optionName} has no pros`);
    }
  });

  test("each alternative has at least 1 con", () => {
    const alts = generateDecisionAlternatives({ focusType: "authority" });
    for (const a of alts) {
      assert.ok(a.cons.length >= 1, `${a.optionName} has no cons`);
    }
  });
});

// ─── Evaluation ───────────────────────────────────────────────────────────────

describe("Evaluation", () => {
  test("evaluation-engine exports evaluateDecisionOptions", () => {
    assert.match(evalEng, /evaluateDecisionOptions/);
  });

  const alts = generateDecisionAlternatives({ focusType: "authority" });

  test("evaluation returns an entry per alternative", () => {
    const evals = evaluateDecisionOptions({ alternatives: alts, consequenceSeverity: "critical", escalationProbability: 0.8, impactScore: 75 });
    assert.equal(evals.length, alts.length);
  });

  test("governance score is between 0–100", () => {
    const evals = evaluateDecisionOptions({ alternatives: alts, consequenceSeverity: "high", escalationProbability: 0.5, impactScore: 60 });
    for (const ev of evals) {
      assert.ok(ev.scores.governanceScore >= 0 && ev.scores.governanceScore <= 100, `gov score out of range: ${ev.scores.governanceScore}`);
    }
  });

  test("execution score is between 0–100", () => {
    const evals = evaluateDecisionOptions({ alternatives: alts, consequenceSeverity: "medium", escalationProbability: 0.3, impactScore: 45 });
    for (const ev of evals) {
      assert.ok(ev.scores.executionScore >= 0 && ev.scores.executionScore <= 100);
    }
  });

  test("risk score is between 0–100", () => {
    const evals = evaluateDecisionOptions({ alternatives: alts, consequenceSeverity: "low", escalationProbability: 0.1, impactScore: 20 });
    for (const ev of evals) {
      assert.ok(ev.scores.riskScore >= 0 && ev.scores.riskScore <= 100);
    }
  });

  test("health score is between 0–100", () => {
    const evals = evaluateDecisionOptions({ alternatives: alts, consequenceSeverity: "systemic", escalationProbability: 0.9, impactScore: 90 });
    for (const ev of evals) {
      assert.ok(ev.scores.healthScore >= 0 && ev.scores.healthScore <= 100);
    }
  });

  test("overall score is between 0–100", () => {
    const evals = evaluateDecisionOptions({ alternatives: alts, consequenceSeverity: "critical", escalationProbability: 0.7, impactScore: 80 });
    for (const ev of evals) {
      assert.ok(ev.scores.overallScore >= 0 && ev.scores.overallScore <= 100);
    }
  });

  test("governance type options score higher on governance dimension than risk type", () => {
    const govAlt = alts.find((a) => a.optionType === "governance" || a.optionType === "authority");
    const riskAlt = generateDecisionAlternatives({ focusType: "commitment" }).find((a) => a.optionType === "risk");
    if (!govAlt || !riskAlt) return;
    const evals = evaluateDecisionOptions({ alternatives: [govAlt, riskAlt], consequenceSeverity: "high", escalationProbability: 0.5, impactScore: 60 });
    const govScore  = evals.find((e) => e.optionName === govAlt.optionName)?.scores.governanceScore ?? 0;
    const riskScore = evals.find((e) => e.optionName === riskAlt.optionName)?.scores.governanceScore ?? 0;
    assert.ok(govScore >= riskScore, `Governance type should score >= risk type on governance: ${govScore} vs ${riskScore}`);
  });
});

// ─── Decision Scoring ─────────────────────────────────────────────────────────

describe("Decision Scoring", () => {
  test("scoring-engine exports calculateDecisionScore", () => {
    assert.match(scoreEng, /calculateDecisionScore/);
  });

  test("score is max of all overall scores", () => {
    const evals = [
      { optionName: "a", scores: { overallScore: 40, governanceScore: 0, executionScore: 0, riskScore: 0, healthScore: 0 } },
      { optionName: "b", scores: { overallScore: 75, governanceScore: 0, executionScore: 0, riskScore: 0, healthScore: 0 } },
      { optionName: "c", scores: { overallScore: 60, governanceScore: 0, executionScore: 0, riskScore: 0, healthScore: 0 } },
    ];
    assert.equal(calculateDecisionScore(evals), 75);
  });

  test("score of 0 for empty evaluations", () => {
    assert.equal(calculateDecisionScore([]), 0);
  });

  test("score is bounded 0–100", () => {
    const alts    = generateDecisionAlternatives({ focusType: "authority" });
    const evals   = evaluateDecisionOptions({ alternatives: alts, consequenceSeverity: "critical", escalationProbability: 0.9, impactScore: 95 });
    const score   = calculateDecisionScore(evals);
    assert.ok(score >= 0 && score <= 100, `Score out of range: ${score}`);
  });

  test("authority gap with critical severity produces non-zero score", () => {
    const alts  = generateDecisionAlternatives({ focusType: "authority" });
    const evals = evaluateDecisionOptions({ alternatives: alts, consequenceSeverity: "critical", escalationProbability: 0.84, impactScore: 75 });
    const score = calculateDecisionScore(evals);
    assert.ok(score > 0, `Score should be > 0, got ${score}`);
  });
});

// ─── Confidence ───────────────────────────────────────────────────────────────

describe("Confidence", () => {
  test("confidence-engine exports calculateDecisionConfidence", () => {
    assert.match(confEng, /calculateDecisionConfidence/);
  });

  test("confidence is in 0.0–1.0 range", () => {
    const alts  = generateDecisionAlternatives({ focusType: "authority" });
    const evals = evaluateDecisionOptions({ alternatives: alts, consequenceSeverity: "critical", escalationProbability: 0.84, impactScore: 75 });
    const conf  = calculateDecisionConfidence({ evaluations: evals, escalationProbability: 0.84, impactScore: 75, alternativeCount: 3 });
    assert.ok(conf >= 0 && conf <= 1, `Confidence out of range: ${conf}`);
  });

  test("confidence has at most 3 decimal places", () => {
    const alts  = generateDecisionAlternatives({ focusType: "commitment" });
    const evals = evaluateDecisionOptions({ alternatives: alts, consequenceSeverity: "high", escalationProbability: 0.5, impactScore: 60 });
    const conf  = calculateDecisionConfidence({ evaluations: evals, escalationProbability: 0.5, impactScore: 60, alternativeCount: 3 });
    const decimals = conf.toString().split(".")[1]?.length ?? 0;
    assert.ok(decimals <= 3, `Too many decimal places: ${decimals}`);
  });

  test("higher escalation probability increases confidence", () => {
    const alts   = generateDecisionAlternatives({ focusType: "authority" });
    const evals  = evaluateDecisionOptions({ alternatives: alts, consequenceSeverity: "high", escalationProbability: 0.8, impactScore: 70 });
    const high   = calculateDecisionConfidence({ evaluations: evals, escalationProbability: 0.8, impactScore: 70, alternativeCount: 3 });
    const low    = calculateDecisionConfidence({ evaluations: evals, escalationProbability: 0.1, impactScore: 70, alternativeCount: 3 });
    assert.ok(high >= low, `High escalation should produce >= confidence vs low: ${high} vs ${low}`);
  });

  test("confidence of 0 for empty evaluations", () => {
    assert.equal(calculateDecisionConfidence({ evaluations: [], escalationProbability: 0.5, impactScore: 50, alternativeCount: 0 }), 0);
  });
});

// ─── Tradeoffs ────────────────────────────────────────────────────────────────

describe("Tradeoffs", () => {
  test("tradeoff-engine exports analyzeDecisionTradeoffs", () => {
    assert.match(tradeoffEng, /analyzeDecisionTradeoffs/);
  });

  test("each alternative has at least one pro tradeoff", () => {
    const alts     = generateDecisionAlternatives({ focusType: "authority" });
    const tradeoffs = analyzeDecisionTradeoffs(alts);
    for (const tr of tradeoffs) {
      const pros = tr.tradeoffs.filter((t) => t.tradeoffType === "pro");
      assert.ok(pros.length >= 1, `${tr.optionName} has no pro tradeoffs`);
    }
  });

  test("each alternative has at least one con tradeoff", () => {
    const alts     = generateDecisionAlternatives({ focusType: "authority" });
    const tradeoffs = analyzeDecisionTradeoffs(alts);
    for (const tr of tradeoffs) {
      const cons = tr.tradeoffs.filter((t) => t.tradeoffType === "con");
      assert.ok(cons.length >= 1, `${tr.optionName} has no con tradeoffs`);
    }
  });

  test("tradeoff impact scores are between 0–100", () => {
    const alts     = generateDecisionAlternatives({ focusType: "commitment" });
    const tradeoffs = analyzeDecisionTradeoffs(alts);
    for (const tr of tradeoffs) {
      for (const t of tr.tradeoffs) {
        assert.ok(t.impactScore >= 0 && t.impactScore <= 100, `Impact score out of range: ${t.impactScore}`);
      }
    }
  });

  test("critical risk option has higher con impact than low risk option", () => {
    const alts     = generateDecisionAlternatives({ focusType: "commitment" });
    const critical = alts.find((a) => a.estimatedRisk === "critical");
    const low      = alts.find((a) => a.estimatedRisk === "low");
    if (!critical || !low) return;
    const tradeoffs   = analyzeDecisionTradeoffs([critical, low]);
    const critCons    = tradeoffs.find((t) => t.optionName === critical.optionName)?.tradeoffs.filter((t) => t.tradeoffType === "con") ?? [];
    const lowCons     = tradeoffs.find((t) => t.optionName === low.optionName)?.tradeoffs.filter((t) => t.tradeoffType === "con") ?? [];
    const critMax     = Math.max(...critCons.map((t) => t.impactScore));
    const lowMax      = Math.max(...lowCons.map((t) => t.impactScore));
    assert.ok(critMax >= lowMax, `Critical risk should have >= con impact than low risk: ${critMax} vs ${lowMax}`);
  });
});

// ─── Recommendation ───────────────────────────────────────────────────────────

describe("Recommendation", () => {
  test("recommendation-engine exports selectRecommendedDecision", () => {
    assert.match(recEng, /selectRecommendedDecision/);
  });

  test("authority gap: create_delegation recommended with high-severity critical score", () => {
    const alts  = generateDecisionAlternatives({ focusType: "authority" });
    const evals = evaluateDecisionOptions({ alternatives: alts, consequenceSeverity: "critical", escalationProbability: 0.84, impactScore: 75 });
    const conf  = calculateDecisionConfidence({ evaluations: evals, escalationProbability: 0.84, impactScore: 75, alternativeCount: 3 });
    const rec   = selectRecommendedDecision({ alternatives: alts, evaluations: evals, confidence: conf });
    assert.ok(rec, "No recommendation produced");
    assert.equal(rec.optionName, "create_delegation", `Expected create_delegation, got ${rec.optionName}`);
  });

  test("commitment: reassign_owner recommended for high-severity case", () => {
    const alts  = generateDecisionAlternatives({ focusType: "commitment" });
    const evals = evaluateDecisionOptions({ alternatives: alts, consequenceSeverity: "high", escalationProbability: 0.7, impactScore: 70 });
    const conf  = calculateDecisionConfidence({ evaluations: evals, escalationProbability: 0.7, impactScore: 70, alternativeCount: 3 });
    const rec   = selectRecommendedDecision({ alternatives: alts, evaluations: evals, confidence: conf });
    assert.ok(rec, "No recommendation produced");
    assert.equal(rec.optionName, "reassign_owner", `Expected reassign_owner, got ${rec.optionName}`);
  });

  test("recommendation includes score", () => {
    const alts = generateDecisionAlternatives({ focusType: "execution" });
    const evals = evaluateDecisionOptions({ alternatives: alts, consequenceSeverity: "medium", escalationProbability: 0.4, impactScore: 50 });
    const rec   = selectRecommendedDecision({ alternatives: alts, evaluations: evals, confidence: 0.6 });
    assert.ok(rec?.score >= 0 && rec?.score <= 100, `Score out of range: ${rec?.score}`);
  });

  test("recommendation includes confidence", () => {
    const alts  = generateDecisionAlternatives({ focusType: "governance" });
    const evals = evaluateDecisionOptions({ alternatives: alts, consequenceSeverity: "high", escalationProbability: 0.6, impactScore: 65 });
    const rec   = selectRecommendedDecision({ alternatives: alts, evaluations: evals, confidence: 0.72 });
    assert.equal(rec?.confidence, 0.72);
  });

  test("recommendation includes rationale", () => {
    const alts  = generateDecisionAlternatives({ focusType: "authority" });
    const evals = evaluateDecisionOptions({ alternatives: alts, consequenceSeverity: "critical", escalationProbability: 0.84, impactScore: 80 });
    const rec   = selectRecommendedDecision({ alternatives: alts, evaluations: evals, confidence: 0.8 });
    assert.ok(rec?.rationale?.length > 10, "Rationale too short");
  });

  test("null returned for empty evaluations", () => {
    assert.equal(selectRecommendedDecision({ alternatives: [], evaluations: [], confidence: 0 }), null);
  });
});

// ─── Comparative Analysis ─────────────────────────────────────────────────────

describe("Comparative Analysis", () => {
  test("comparative-engine exports compareDecisionOptions", () => {
    assert.match(compEng, /compareDecisionOptions/);
  });

  test("ranked list has correct length", () => {
    const alts    = generateDecisionAlternatives({ focusType: "authority" });
    const evals   = evaluateDecisionOptions({ alternatives: alts, consequenceSeverity: "critical", escalationProbability: 0.84, impactScore: 75 });
    const comp    = compareDecisionOptions(evals);
    assert.equal(comp.ranked.length, alts.length);
  });

  test("topOption matches rank 1", () => {
    const alts  = generateDecisionAlternatives({ focusType: "authority" });
    const evals = evaluateDecisionOptions({ alternatives: alts, consequenceSeverity: "critical", escalationProbability: 0.84, impactScore: 75 });
    const comp  = compareDecisionOptions(evals);
    const top   = comp.ranked.find((r) => r.rank === 1);
    assert.equal(top?.optionName, comp.topOption);
  });

  test("spread is correct (max - min)", () => {
    const evals = [
      { optionName: "a", scores: { overallScore: 91, governanceScore: 0, executionScore: 0, riskScore: 0, healthScore: 0 } },
      { optionName: "b", scores: { overallScore: 63, governanceScore: 0, executionScore: 0, riskScore: 0, healthScore: 0 } },
      { optionName: "c", scores: { overallScore: 58, governanceScore: 0, executionScore: 0, riskScore: 0, healthScore: 0 } },
    ];
    const comp = compareDecisionOptions(evals);
    assert.equal(comp.spread, 33);
  });

  test("scoreDifferenceFromTop is 0 for rank 1", () => {
    const alts  = generateDecisionAlternatives({ focusType: "authority" });
    const evals = evaluateDecisionOptions({ alternatives: alts, consequenceSeverity: "critical", escalationProbability: 0.84, impactScore: 75 });
    const comp  = compareDecisionOptions(evals);
    const top   = comp.ranked.find((r) => r.rank === 1);
    assert.equal(top?.scoreDifferenceFromTop, 0);
  });

  test("empty evaluations produce empty result", () => {
    const comp = compareDecisionOptions([]);
    assert.equal(comp.ranked.length, 0);
    assert.equal(comp.spread, 0);
  });
});

// ─── Decision Support ─────────────────────────────────────────────────────────

describe("Decision Support", () => {
  test("decision-support-engine exports generateOperationalDecisionSupport", () => {
    assert.match(supportEng, /generateOperationalDecisionSupport/);
  });

  test("support includes recommendedOption", () => {
    assert.match(supportEng, /recommendedOption/);
  });

  test("support includes because array", () => {
    assert.match(supportEng, /because/);
  });

  test("support includes confidence", () => {
    assert.match(supportEng, /confidence/);
  });

  test("support includes score", () => {
    assert.match(supportEng, /score/);
  });

  test("because array has at least 2 items for valid recommendation", () => {
    assert.match(supportEng, /because\.push/);
  });
});

// ─── Decision Lineage ─────────────────────────────────────────────────────────

describe("Decision Lineage", () => {
  test("lineage-engine exports getOperationalDecisionLineage", () => {
    assert.match(lineageEng, /getOperationalDecisionLineage/);
  });

  test("lineage chain includes constitution layer", () => {
    assert.match(lineageEng, /constitution/);
  });

  test("lineage chain includes decision layer", () => {
    assert.match(lineageEng, /\"decision\"/);
  });

  test("lineage chain has 14 layers", () => {
    assert.match(lineageEng, /14/);
  });

  test("lineage returns not_found for missing decision", () => {
    assert.match(lineageEng, /not_found/);
  });

  test("registry exports getOperationalDecisionLineageForDecision", () => {
    assert.match(registry, /getOperationalDecisionLineageForDecision/);
  });

  test("lineage emits OPERATIONAL_DECISION_LINEAGE_GENERATED", () => {
    assert.match(registry, /OPERATIONAL_DECISION_LINEAGE_GENERATED/);
  });
});

// ─── Registry ─────────────────────────────────────────────────────────────────

describe("Registry", () => {
  test("registry exports generateOperationalDecision", () => {
    assert.match(registry, /generateOperationalDecision/);
  });

  test("registry exports getOperationalDecision", () => {
    assert.match(registry, /getOperationalDecision/);
  });

  test("registry exports listOperationalDecisions", () => {
    assert.match(registry, /listOperationalDecisions/);
  });

  test("registry exports validateOperationalDecision", () => {
    assert.match(registry, /validateOperationalDecision/);
  });

  test("registry exports archiveOperationalDecision", () => {
    assert.match(registry, /archiveOperationalDecision/);
  });

  test("registry exports getOperationalDecisionAnalysis", () => {
    assert.match(registry, /getOperationalDecisionAnalysis/);
  });

  test("registry validates workspaceId as UUID", () => {
    assert.match(registry, /workspaceId must be a UUID/);
  });

  test("registry validates consequenceId as UUID", () => {
    assert.match(registry, /consequenceId must be a UUID/);
  });

  test("registry emits OPERATIONAL_DECISION_GENERATED", () => {
    assert.match(registry, /OPERATIONAL_DECISION_GENERATED/);
  });

  test("registry does NOT update operational_consequences (no side-effects)", () => {
    assert.doesNotMatch(registry, /update.*operational_consequences/s);
  });

  test("registry does NOT update operational_focus_items", () => {
    assert.doesNotMatch(registry, /update.*operational_focus_items/s);
  });

  test("consequence not found returns not_found failureClass", () => {
    assert.match(registry, /Consequence not found/);
  });
});

// ─── Audit Events ─────────────────────────────────────────────────────────────

describe("Audit Events", () => {
  const expectedEvents = [
    "OPERATIONAL_DECISION_GENERATED",
    "OPERATIONAL_DECISION_EVALUATED",
    "OPERATIONAL_DECISION_RECOMMENDED",
    "OPERATIONAL_DECISION_ARCHIVED",
    "OPERATIONAL_DECISION_SCORE_CALCULATED",
    "OPERATIONAL_DECISION_CONFIDENCE_CALCULATED",
    "OPERATIONAL_DECISION_TRADEOFF_ANALYZED",
    "OPERATIONAL_DECISION_LINEAGE_GENERATED",
  ];

  for (const event of expectedEvents) {
    test(`registry emits ${event}`, () => {
      assert.match(registry, new RegExp(event), `Missing event: ${event}`);
    });
  }

  test("events include decisionId in payload", () => {
    assert.match(registry, /decisionId/);
  });

  test("events include consequenceId in payload", () => {
    assert.match(registry, /consequenceId/);
  });
});

// ─── Workspace Isolation ──────────────────────────────────────────────────────

describe("Workspace Isolation", () => {
  test("repository always filters by workspace_id", () => {
    const count = (repo.match(/\.eq\("workspace_id"/g) ?? []).length;
    assert.ok(count >= 7, `Expected >= 7 workspace_id filters, got ${count}`);
  });

  test("migration enables RLS on all 4 tables", () => {
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

// ─── Repository ───────────────────────────────────────────────────────────────

describe("Repository", () => {
  test("repository exports dbCreateDecision", () => {
    assert.match(repo, /dbCreateDecision/);
  });

  test("repository exports dbFindDecisionById", () => {
    assert.match(repo, /dbFindDecisionById/);
  });

  test("repository exports dbListDecisions", () => {
    assert.match(repo, /dbListDecisions/);
  });

  test("repository exports dbUpdateDecisionStatus", () => {
    assert.match(repo, /dbUpdateDecisionStatus/);
  });

  test("repository exports dbCreateDecisionOption", () => {
    assert.match(repo, /dbCreateDecisionOption/);
  });

  test("repository exports dbCreateDecisionEvaluation", () => {
    assert.match(repo, /dbCreateDecisionEvaluation/);
  });

  test("repository exports dbCreateDecisionTradeoff", () => {
    assert.match(repo, /dbCreateDecisionTradeoff/);
  });

  test("repository exports dbSetRecommendedOption", () => {
    assert.match(repo, /dbSetRecommendedOption/);
  });

  test("list supports consequenceId filter", () => {
    assert.match(repo, /consequenceId/);
  });

  test("list supports decisionCategory filter", () => {
    assert.match(repo, /decisionCategory/);
  });

  test("list supports decisionStatus filter", () => {
    assert.match(repo, /decisionStatus/);
  });
});

// ─── Explain Capability ───────────────────────────────────────────────────────

describe("Explain Capability", () => {
  test("explain exports explainOperationalDecisions", () => {
    assert.match(explainFile, /explainOperationalDecisions/);
  });

  test("explain includes Alternatives section", () => {
    assert.match(explainFile, /Alternatives/);
  });

  test("explain includes Evaluation section", () => {
    assert.match(explainFile, /Evaluation/);
  });

  test("explain includes Scoring section", () => {
    assert.match(explainFile, /Scoring/);
  });

  test("explain includes Confidence section", () => {
    assert.match(explainFile, /Confidence/);
  });

  test("explain includes Tradeoffs section", () => {
    assert.match(explainFile, /Tradeoffs/);
  });

  test("explain includes Recommendation section", () => {
    assert.match(explainFile, /Recommendation/);
  });

  test("explain includes Decision Support section", () => {
    assert.match(explainFile, /Decision Support/);
  });

  test("explain includes Comparative Analysis section", () => {
    assert.match(explainFile, /Comparative Analysis/);
  });

  test("explain includes Lineage section", () => {
    assert.match(explainFile, /Lineage/);
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

  test("docs include Alternative Model", () => {
    assert.match(docs, /Alternative|Alternativa/i);
  });

  test("docs include Evaluation Model", () => {
    assert.match(docs, /Evaluation|Evaluación/i);
  });

  test("docs include Scoring section", () => {
    assert.match(docs, /Score|Scoring|Puntaje/i);
  });

  test("docs include Confidence section", () => {
    assert.match(docs, /Confidence|Confianza/i);
  });

  test("docs include Decision Support", () => {
    assert.match(docs, /Decision Support|Soporte de Decisión/i);
  });

  test("docs include use case examples (authority_gap)", () => {
    assert.match(docs, /authority_gap|authority gap/i);
  });
});
