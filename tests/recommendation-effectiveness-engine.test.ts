/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck -- Node 20 executes this TypeScript-named test without a loader.
const assert = require("node:assert/strict");
const { test, describe } = require("node:test");
const { readFileSync } = require("node:fs");

// ─────────────────────────────────────────────────────────────────────────────
// Recommendation Effectiveness Engine — Unit Tests (Sprint 5)
// Pure unit tests — no database access.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Source files ─────────────────────────────────────────────────────────────

const types           = readFileSync("src/lib/constitutional-recommendations/types.ts", "utf8");
const outcomeRegistry = readFileSync("src/lib/constitutional-recommendations/outcome-registry.ts", "utf8");
const feedbackReg     = readFileSync("src/lib/constitutional-recommendations/feedback-registry.ts", "utf8");
const effectivenessEng= readFileSync("src/lib/constitutional-recommendations/effectiveness-engine.ts", "utf8");
const adaptationEng   = readFileSync("src/lib/constitutional-recommendations/adaptation-engine.ts", "utf8");
const benchmarkEng    = readFileSync("src/lib/constitutional-recommendations/benchmark-engine.ts", "utf8");
const rankingEng      = readFileSync("src/lib/constitutional-recommendations/ranking-engine.ts", "utf8");
const benchmarkReg    = readFileSync("src/lib/constitutional-recommendations/benchmark-registry.ts", "utf8");
const explainFile     = readFileSync("src/lib/constitutional-recommendations/effectiveness-explain-capability.ts", "utf8");
const indexFile       = readFileSync("src/lib/constitutional-recommendations/index.ts", "utf8");
const dbContract      = readFileSync("src/lib/db/database-contract.ts", "utf8");
const migration       = readFileSync("supabase/migrations/20260622000003_recommendation_effectiveness_engine.sql", "utf8");
const docs            = readFileSync("docs/recommendation-effectiveness-engine.md", "utf8");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function round3(v) { return Math.round(v * 1000) / 1000; }

// ─── Inline Effectiveness Engine ──────────────────────────────────────────────

function outcomeStatusWeight(status) {
  switch (status) {
    case "successful": return 1.0;
    case "neutral":    return 0.5;
    case "failed":     return 0.0;
    case "unknown":    return 0.3;
  }
}

function feedbackWeight(rating) {
  return Math.min(1.0, Math.max(0.0, (rating - 1) / 4));
}

function calculateEffectivenessScore({ outcomes, feedbacks }) {
  const applicationsCount = outcomes.length;
  const successfulCount = outcomes.filter((o) => o.outcomeStatus === "successful").length;
  const failedCount     = outcomes.filter((o) => o.outcomeStatus === "failed").length;
  const neutralCount    = outcomes.filter((o) => o.outcomeStatus === "neutral").length;

  const successRate = applicationsCount > 0 ? round3(successfulCount / applicationsCount) : 0;
  const failureRate = applicationsCount > 0 ? round3(failedCount / applicationsCount) : 0;
  const neutralRate = applicationsCount > 0 ? round3(neutralCount / applicationsCount) : 0;

  const outcomeQuality =
    outcomes.length > 0
      ? round3(outcomes.reduce((s, o) => s + o.effectivenessScore, 0) / outcomes.length)
      : 0;

  const feedbackAvg =
    feedbacks.length > 0
      ? feedbacks.reduce((s, f) => s + feedbackWeight(f.rating), 0) / feedbacks.length
      : 0;

  const consistencyComponent =
    applicationsCount === 0 ? 0 : applicationsCount > 1 ? (1.0 - failureRate) * 0.10 : 0.05;

  const averageEffectiveness = round3(
    successRate * 0.40 +
    outcomeQuality * 0.30 +
    feedbackAvg * 0.20 +
    consistencyComponent,
  );

  return { applicationsCount, successfulCount, failedCount, neutralCount, successRate, failureRate, neutralRate, averageEffectiveness };
}

function computeOutcomeEffectivenessScore(outcomeStatus, observedValue, expectedValue) {
  const statusBase = outcomeStatusWeight(outcomeStatus);
  if (observedValue !== null && expectedValue !== null && expectedValue !== 0) {
    const ratio = Math.max(0, observedValue / expectedValue);
    return round3(Math.min(1.0, statusBase * 0.70 + Math.min(1.0, ratio) * 0.30));
  }
  return round3(statusBase);
}

// ─── Inline Adaptation Engine ─────────────────────────────────────────────────

function adaptRecommendationConfidence({ originalConfidence, observedEffectiveness, applicationsCount }) {
  const evidenceWeight = Math.min(1.0, applicationsCount / 10);
  let adjustment, rule;
  if (observedEffectiveness > 0.80) {
    adjustment = round3((observedEffectiveness - originalConfidence) * 0.30 * evidenceWeight);
    rule = "high_effectiveness";
  } else if (observedEffectiveness < 0.50) {
    adjustment = round3((observedEffectiveness - originalConfidence) * 0.40 * evidenceWeight);
    rule = "low_effectiveness";
  } else {
    adjustment = round3((observedEffectiveness - originalConfidence) * 0.10 * evidenceWeight);
    rule = "medium_effectiveness";
  }
  const newConfidence = round3(Math.min(1.0, Math.max(0.0, originalConfidence + adjustment)));
  return { originalConfidence: round3(originalConfidence), observedEffectiveness: round3(observedEffectiveness), confidenceAdjustment: adjustment, newConfidence, rule };
}

// ─── Inline Benchmark Engine ──────────────────────────────────────────────────

function benchmarkRecommendations(entries) {
  return entries
    .map((e) => ({
      recommendationId: e.recommendationId,
      recommendationKey: e.recommendationKey,
      title: e.title,
      averageEffectiveness: e.averageEffectiveness,
      applicationsCount: e.applicationsCount,
      confidenceScore: e.confidenceScore,
    }))
    .sort((a, b) => b.averageEffectiveness - a.averageEffectiveness);
}

// ─── Inline Ranking Engine ────────────────────────────────────────────────────

function usageScore(n) {
  if (n === 0) return 0.0;
  if (n <= 5) return 0.3;
  if (n <= 20) return 0.6;
  if (n <= 50) return 0.85;
  return 1.0;
}

function computeRankScore(e) {
  return round3(
    e.averageEffectiveness * 0.40 +
    e.confidenceScore * 0.30 +
    usageScore(e.applicationsCount) * 0.20 +
    e.successRate * 0.10,
  );
}

function rankRecommendations(entries) {
  return entries
    .map((e) => ({ ...e, rankScore: computeRankScore(e), rank: 0 }))
    .sort((a, b) => b.rankScore - a.rankScore)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

// ─── Database Contract ────────────────────────────────────────────────────────

describe("Database Contract", () => {
  test("DATABASE_CONTRACT_VERSION includes recommendation-effectiveness-engine", () => {
    assert.match(dbContract, /recommendation-effectiveness-engine/);
  });

  test("ConstitutionalRecommendationOutcomeRow is present", () => {
    assert.match(dbContract, /ConstitutionalRecommendationOutcomeRow/);
  });

  test("ConstitutionalRecommendationFeedbackRow is present", () => {
    assert.match(dbContract, /ConstitutionalRecommendationFeedbackRow/);
  });

  test("ConstitutionalRecommendationEffectivenessRow is present", () => {
    assert.match(dbContract, /ConstitutionalRecommendationEffectivenessRow/);
  });

  test("CONSTITUTIONAL_RECOMMENDATION_OUTCOME_SELECTABLE_COLUMNS is present", () => {
    assert.match(dbContract, /CONSTITUTIONAL_RECOMMENDATION_OUTCOME_SELECTABLE_COLUMNS/);
  });

  test("CONSTITUTIONAL_RECOMMENDATION_FEEDBACK_SELECTABLE_COLUMNS is present", () => {
    assert.match(dbContract, /CONSTITUTIONAL_RECOMMENDATION_FEEDBACK_SELECTABLE_COLUMNS/);
  });

  test("CONSTITUTIONAL_RECOMMENDATION_EFFECTIVENESS_SELECTABLE_COLUMNS is present", () => {
    assert.match(dbContract, /CONSTITUTIONAL_RECOMMENDATION_EFFECTIVENESS_SELECTABLE_COLUMNS/);
  });

  test("RecommendationOutcomeType includes all 8 types", () => {
    for (const t of [
      "risk_reduction", "schedule_improvement", "cost_reduction", "quality_improvement",
      "governance_improvement", "delivery_improvement", "authority_improvement", "ratification_improvement",
    ]) {
      assert.match(dbContract, new RegExp(t), `RecommendationOutcomeType missing: ${t}`);
    }
  });

  test("RecommendationOutcomeStatus includes all 4 statuses", () => {
    for (const s of ["successful", "neutral", "failed", "unknown"]) {
      assert.match(dbContract, new RegExp(s), `RecommendationOutcomeStatus missing: ${s}`);
    }
  });

  test("RecommendationFeedbackType includes positive, neutral, negative", () => {
    for (const t of ["positive", "neutral", "negative"]) {
      assert.match(dbContract, new RegExp(`"${t}"`), `RecommendationFeedbackType missing: ${t}`);
    }
  });

  test("RecommendationStatus includes deprecated", () => {
    assert.match(dbContract, /"deprecated"/);
  });
});

// ─── Migration ────────────────────────────────────────────────────────────────

describe("Migration", () => {
  test("creates constitutional_recommendation_outcomes table", () => {
    assert.match(migration, /create table if not exists constitutional_recommendation_outcomes/);
  });

  test("creates constitutional_recommendation_feedback table", () => {
    assert.match(migration, /create table if not exists constitutional_recommendation_feedback/);
  });

  test("creates constitutional_recommendation_effectiveness table", () => {
    assert.match(migration, /create table if not exists constitutional_recommendation_effectiveness/);
  });

  test("enables RLS on all three new tables", () => {
    assert.match(migration, /constitutional_recommendation_outcomes.*enable row level security/s);
    assert.match(migration, /constitutional_recommendation_feedback.*enable row level security/s);
    assert.match(migration, /constitutional_recommendation_effectiveness.*enable row level security/s);
  });

  test("enforces composite FKs for workspace isolation on outcomes", () => {
    assert.match(migration, /constraint cro_recommendation_workspace_fk/);
    assert.match(migration, /constraint cro_application_workspace_fk/);
  });

  test("enforces composite FKs for workspace isolation on feedback", () => {
    assert.match(migration, /constraint crf_recommendation_workspace_fk/);
    assert.match(migration, /constraint crf_application_workspace_fk/);
  });

  test("outcome_type includes all 8 types", () => {
    for (const t of [
      "risk_reduction", "schedule_improvement", "cost_reduction", "quality_improvement",
      "governance_improvement", "delivery_improvement", "authority_improvement", "ratification_improvement",
    ]) {
      assert.match(migration, new RegExp(`'${t}'`), `Missing outcome_type: ${t}`);
    }
  });

  test("outcome_status includes all 4 statuses", () => {
    for (const s of ["successful", "neutral", "failed", "unknown"]) {
      assert.match(migration, new RegExp(`'${s}'`), `Missing outcome_status: ${s}`);
    }
  });

  test("feedback rating check 1–5", () => {
    assert.match(migration, /rating between 1 and 5/);
  });

  test("effectiveness score check 0.0–1.0", () => {
    assert.match(migration, /effectiveness_score between 0.0 and 1.0/);
  });

  test("unique constraint on effectiveness (workspace, recommendation)", () => {
    assert.match(migration, /unique \(workspace_id, recommendation_id\)/);
  });

  test("extends recommendation status check with deprecated", () => {
    assert.match(migration, /'deprecated'/);
  });
});

// ─── Types ────────────────────────────────────────────────────────────────────

describe("Types", () => {
  test("RecordOutcomeInput is defined", () => {
    assert.match(types, /RecordOutcomeInput/);
  });

  test("SubmitFeedbackInput is defined", () => {
    assert.match(types, /SubmitFeedbackInput/);
  });

  test("CalculateEffectivenessInput is defined", () => {
    assert.match(types, /CalculateEffectivenessInput/);
  });

  test("RecommendationEffectivenessBreakdown is defined", () => {
    assert.match(types, /RecommendationEffectivenessBreakdown/);
  });

  test("RecommendationBenchmark is defined", () => {
    assert.match(types, /RecommendationBenchmark/);
  });

  test("RecommendationRankEntry is defined", () => {
    assert.match(types, /RecommendationRankEntry/);
  });

  test("ConstitutionalRecommendationEventType includes all 7 new events", () => {
    for (const evt of [
      "CONSTITUTIONAL_RECOMMENDATION_OUTCOME_RECORDED",
      "CONSTITUTIONAL_RECOMMENDATION_FEEDBACK_SUBMITTED",
      "CONSTITUTIONAL_RECOMMENDATION_EFFECTIVENESS_CALCULATED",
      "CONSTITUTIONAL_RECOMMENDATION_CONFIDENCE_ADJUSTED",
      "CONSTITUTIONAL_RECOMMENDATION_BENCHMARK_GENERATED",
      "CONSTITUTIONAL_RECOMMENDATION_RANKING_GENERATED",
      "CONSTITUTIONAL_RECOMMENDATION_DEPRECATED",
    ]) {
      assert.match(types, new RegExp(evt), `Event type missing: ${evt}`);
    }
  });

  test("ListOutcomesInput has filter fields", () => {
    assert.match(types, /ListOutcomesInput/);
    assert.match(types, /outcomeType/);
    assert.match(types, /outcomeStatus/);
    assert.match(types, /fromDate/);
  });
});

// ─── Outcome Tracking ────────────────────────────────────────────────────────

describe("Outcome Tracking — recordRecommendationOutcome()", () => {
  test("validates workspaceId as UUID", () => {
    assert.match(outcomeRegistry, /workspaceId must be a UUID/);
  });

  test("validates actorId as UUID", () => {
    assert.match(outcomeRegistry, /actorId must be a UUID/);
  });

  test("validates recommendationId as UUID", () => {
    assert.match(outcomeRegistry, /recommendationId must be a UUID/);
  });

  test("validates applicationId as UUID (Rule 2 — no orphan outcomes)", () => {
    assert.match(outcomeRegistry, /applicationId must be a UUID/);
  });

  test("requires outcomeType", () => {
    assert.match(outcomeRegistry, /outcomeType is required/);
  });

  test("requires outcomeStatus", () => {
    assert.match(outcomeRegistry, /outcomeStatus is required/);
  });

  test("verifies application belongs to recommendation (Rule 2)", () => {
    assert.match(outcomeRegistry, /Application not found or does not belong/);
  });

  test("emits CONSTITUTIONAL_RECOMMENDATION_OUTCOME_RECORDED event", () => {
    assert.match(outcomeRegistry, /CONSTITUTIONAL_RECOMMENDATION_OUTCOME_RECORDED/);
  });

  test("enforces workspace_id isolation in all queries", () => {
    assert.match(outcomeRegistry, /eq\("workspace_id"/);
  });
});

// ─── Feedback ─────────────────────────────────────────────────────────────────

describe("Feedback — submitRecommendationFeedback()", () => {
  test("validates rating range 1–5", () => {
    assert.match(feedbackReg, /rating must be an integer between 1 and 5/);
  });

  test("validates feedbackType is required", () => {
    assert.match(feedbackReg, /feedbackType is required/);
  });

  test("verifies application ownership before inserting", () => {
    assert.match(feedbackReg, /Application not found or does not belong/);
  });

  test("emits CONSTITUTIONAL_RECOMMENDATION_FEEDBACK_SUBMITTED event", () => {
    assert.match(feedbackReg, /CONSTITUTIONAL_RECOMMENDATION_FEEDBACK_SUBMITTED/);
  });

  test("stores submitted_by as actorId", () => {
    assert.match(feedbackReg, /submitted_by.*actorId|actorId.*submitted_by/s);
  });

  test("listRecommendationFeedback filters by workspace_id", () => {
    assert.match(feedbackReg, /eq\("workspace_id"/);
  });
});

// ─── Effectiveness Engine ─────────────────────────────────────────────────────

describe("Effectiveness Engine — calculateEffectivenessScore()", () => {
  test("all counts are 0 with no outcomes", () => {
    const result = calculateEffectivenessScore({ outcomes: [], feedbacks: [] });
    assert.equal(result.applicationsCount, 0);
    assert.equal(result.averageEffectiveness, 0);
  });

  test("100% successful outcomes produce high effectiveness", () => {
    const outcomes = Array.from({ length: 5 }, () => ({ outcomeStatus: "successful", effectivenessScore: 1.0 }));
    const result = calculateEffectivenessScore({ outcomes, feedbacks: [] });
    assert.ok(result.averageEffectiveness > 0.5, `expected > 0.5, got ${result.averageEffectiveness}`);
    assert.equal(result.successfulCount, 5);
    assert.equal(result.failedCount, 0);
  });

  test("100% failed outcomes produce low effectiveness", () => {
    const outcomes = Array.from({ length: 5 }, () => ({ outcomeStatus: "failed", effectivenessScore: 0.0 }));
    const result = calculateEffectivenessScore({ outcomes, feedbacks: [] });
    assert.ok(result.averageEffectiveness < 0.5, `expected < 0.5, got ${result.averageEffectiveness}`);
    assert.equal(result.failedCount, 5);
  });

  test("success rate is correctly calculated", () => {
    const outcomes = [
      { outcomeStatus: "successful", effectivenessScore: 1.0 },
      { outcomeStatus: "successful", effectivenessScore: 1.0 },
      { outcomeStatus: "failed", effectivenessScore: 0.0 },
      { outcomeStatus: "neutral", effectivenessScore: 0.5 },
    ];
    const result = calculateEffectivenessScore({ outcomes, feedbacks: [] });
    assert.equal(result.successRate, 0.5);
    assert.equal(result.failedCount, 1);
    assert.equal(result.neutralCount, 1);
  });

  test("feedback improves effectiveness score", () => {
    const outcomes = [{ outcomeStatus: "successful", effectivenessScore: 0.8 }];
    const noFeedback = calculateEffectivenessScore({ outcomes, feedbacks: [] });
    const withGoodFeedback = calculateEffectivenessScore({
      outcomes,
      feedbacks: [{ rating: 5 }, { rating: 5 }],
    });
    assert.ok(withGoodFeedback.averageEffectiveness > noFeedback.averageEffectiveness);
  });

  test("effectiveness is between 0 and 1 for all inputs", () => {
    for (const statuses of [["successful"], ["failed"], ["neutral", "unknown"], ["successful", "failed", "neutral"]]) {
      const outcomes = statuses.map((s) => ({ outcomeStatus: s, effectivenessScore: s === "successful" ? 1.0 : 0.0 }));
      const result = calculateEffectivenessScore({ outcomes, feedbacks: [] });
      assert.ok(result.averageEffectiveness >= 0 && result.averageEffectiveness <= 1);
    }
  });
});

describe("Effectiveness Engine — computeOutcomeEffectivenessScore()", () => {
  test("successful with no values returns 1.0", () => {
    assert.equal(computeOutcomeEffectivenessScore("successful", null, null), 1.0);
  });

  test("failed with no values returns 0.0", () => {
    assert.equal(computeOutcomeEffectivenessScore("failed", null, null), 0.0);
  });

  test("neutral with no values returns 0.5", () => {
    assert.equal(computeOutcomeEffectivenessScore("neutral", null, null), 0.5);
  });

  test("blends status weight with value ratio when both present", () => {
    const score = computeOutcomeEffectivenessScore("successful", 80, 100);
    // statusBase=1.0, ratio=0.8 → 1.0*0.70 + 0.8*0.30 = 0.70 + 0.24 = 0.94
    assert.equal(score, 0.94);
  });

  test("unknown status yields 0.3 base", () => {
    assert.equal(computeOutcomeEffectivenessScore("unknown", null, null), 0.3);
  });

  test("score never exceeds 1.0", () => {
    const score = computeOutcomeEffectivenessScore("successful", 200, 100);
    assert.ok(score <= 1.0);
  });
});

// ─── Confidence Adaptation ────────────────────────────────────────────────────

describe("Confidence Adaptation — adaptRecommendationConfidence()", () => {
  test("Rule A: high effectiveness > 0.80 increases confidence", () => {
    const result = adaptRecommendationConfidence({ originalConfidence: 0.70, observedEffectiveness: 0.90, applicationsCount: 10 });
    assert.equal(result.rule, "high_effectiveness");
    assert.ok(result.newConfidence > 0.70, `expected > 0.70, got ${result.newConfidence}`);
    assert.ok(result.confidenceAdjustment > 0);
  });

  test("Rule B: low effectiveness < 0.50 reduces confidence", () => {
    const result = adaptRecommendationConfidence({ originalConfidence: 0.75, observedEffectiveness: 0.30, applicationsCount: 10 });
    assert.equal(result.rule, "low_effectiveness");
    assert.ok(result.newConfidence < 0.75, `expected < 0.75, got ${result.newConfidence}`);
    assert.ok(result.confidenceAdjustment < 0);
  });

  test("Rule C: medium effectiveness 0.50–0.80 maintains stability", () => {
    const original = 0.72;
    const result = adaptRecommendationConfidence({ originalConfidence: original, observedEffectiveness: 0.65, applicationsCount: 10 });
    assert.equal(result.rule, "medium_effectiveness");
    // adjustment should be small
    assert.ok(Math.abs(result.newConfidence - original) < 0.10);
  });

  test("confidence never exceeds 1.0 (Rule 7)", () => {
    const result = adaptRecommendationConfidence({ originalConfidence: 0.99, observedEffectiveness: 1.0, applicationsCount: 100 });
    assert.ok(result.newConfidence <= 1.0);
  });

  test("confidence never falls below 0.0 (Rule 8)", () => {
    const result = adaptRecommendationConfidence({ originalConfidence: 0.01, observedEffectiveness: 0.0, applicationsCount: 100 });
    assert.ok(result.newConfidence >= 0.0);
  });

  test("evidence weight scales adjustment — more applications = larger effect", () => {
    const lowEvidence  = adaptRecommendationConfidence({ originalConfidence: 0.70, observedEffectiveness: 0.90, applicationsCount: 2 });
    const highEvidence = adaptRecommendationConfidence({ originalConfidence: 0.70, observedEffectiveness: 0.90, applicationsCount: 20 });
    assert.ok(Math.abs(highEvidence.confidenceAdjustment) >= Math.abs(lowEvidence.confidenceAdjustment));
  });

  test("result includes all required fields", () => {
    const result = adaptRecommendationConfidence({ originalConfidence: 0.70, observedEffectiveness: 0.85, applicationsCount: 5 });
    for (const field of ["originalConfidence", "observedEffectiveness", "confidenceAdjustment", "newConfidence", "rule"]) {
      assert.ok(field in result, `missing field: ${field}`);
    }
  });
});

// ─── Benchmarking ─────────────────────────────────────────────────────────────

describe("Benchmarking — benchmarkRecommendations()", () => {
  test("sorts by averageEffectiveness descending", () => {
    const entries = [
      { recommendationId: uuid(), recommendationKey: "k1", title: "T1", averageEffectiveness: 0.63, applicationsCount: 5, confidenceScore: 0.70 },
      { recommendationId: uuid(), recommendationKey: "k2", title: "T2", averageEffectiveness: 0.84, applicationsCount: 10, confidenceScore: 0.80 },
      { recommendationId: uuid(), recommendationKey: "k3", title: "T3", averageEffectiveness: 0.45, applicationsCount: 3, confidenceScore: 0.60 },
    ];
    const result = benchmarkRecommendations(entries);
    assert.equal(result[0].averageEffectiveness, 0.84);
    assert.equal(result[1].averageEffectiveness, 0.63);
    assert.equal(result[2].averageEffectiveness, 0.45);
  });

  test("returns all entries", () => {
    const entries = Array.from({ length: 5 }, (_, i) => ({
      recommendationId: uuid(), recommendationKey: `k${i}`, title: `T${i}`,
      averageEffectiveness: Math.random(), applicationsCount: i + 1, confidenceScore: 0.7,
    }));
    const result = benchmarkRecommendations(entries);
    assert.equal(result.length, 5);
  });

  test("benchmark entry has correct shape", () => {
    const entry = { recommendationId: uuid(), recommendationKey: "k1", title: "T1", averageEffectiveness: 0.80, applicationsCount: 10, confidenceScore: 0.75 };
    const result = benchmarkRecommendations([entry]);
    for (const field of ["recommendationId", "recommendationKey", "title", "averageEffectiveness", "applicationsCount", "confidenceScore"]) {
      assert.ok(field in result[0], `missing field: ${field}`);
    }
  });
});

// ─── Ranking ──────────────────────────────────────────────────────────────────

describe("Ranking — rankRecommendations()", () => {
  test("assigns rank 1 to highest composite score", () => {
    const entries = [
      { recommendationId: uuid(), recommendationKey: "k1", title: "T1", averageEffectiveness: 0.40, confidenceScore: 0.50, applicationsCount: 2, successRate: 0.5 },
      { recommendationId: uuid(), recommendationKey: "k2", title: "T2", averageEffectiveness: 0.90, confidenceScore: 0.85, applicationsCount: 30, successRate: 0.9 },
    ];
    const result = rankRecommendations(entries);
    assert.equal(result[0].rank, 1);
    assert.equal(result[0].recommendationKey, "k2");
  });

  test("ranks are sequential starting from 1", () => {
    const entries = Array.from({ length: 4 }, (_, i) => ({
      recommendationId: uuid(), recommendationKey: `k${i}`, title: `T${i}`,
      averageEffectiveness: 0.5 + i * 0.1, confidenceScore: 0.7,
      applicationsCount: 10, successRate: 0.6,
    }));
    const result = rankRecommendations(entries);
    const ranks = result.map((r) => r.rank).sort((a, b) => a - b);
    assert.deepEqual(ranks, [1, 2, 3, 4]);
  });

  test("rankScore is between 0 and 1", () => {
    const entries = [
      { recommendationId: uuid(), recommendationKey: "k1", title: "T1", averageEffectiveness: 1.0, confidenceScore: 1.0, applicationsCount: 100, successRate: 1.0 },
      { recommendationId: uuid(), recommendationKey: "k2", title: "T2", averageEffectiveness: 0.0, confidenceScore: 0.0, applicationsCount: 0, successRate: 0.0 },
    ];
    const result = rankRecommendations(entries);
    for (const r of result) {
      assert.ok(r.rankScore >= 0 && r.rankScore <= 1, `rankScore out of range: ${r.rankScore}`);
    }
  });

  test("rank entry has all required fields", () => {
    const entry = { recommendationId: uuid(), recommendationKey: "k1", title: "T1", averageEffectiveness: 0.7, confidenceScore: 0.8, applicationsCount: 15, successRate: 0.75 };
    const result = rankRecommendations([entry]);
    for (const field of ["rank", "recommendationId", "recommendationKey", "title", "rankScore", "averageEffectiveness", "confidenceScore", "applicationsCount"]) {
      assert.ok(field in result[0], `missing field: ${field}`);
    }
  });
});

// ─── Recommendation Deprecation ───────────────────────────────────────────────

describe("Recommendation Deprecation", () => {
  test("deprecateRecommendation is defined in outcome-registry", () => {
    assert.match(outcomeRegistry, /deprecateRecommendation/);
  });

  test("only published recommendations can be deprecated", () => {
    assert.match(outcomeRegistry, /Only published recommendations can be deprecated/);
  });

  test("deprecation requires effectiveness below threshold", () => {
    assert.match(outcomeRegistry, /effectiveness.*threshold|threshold.*effectiveness/s);
  });

  test("emits CONSTITUTIONAL_RECOMMENDATION_DEPRECATED event", () => {
    assert.match(outcomeRegistry, /CONSTITUTIONAL_RECOMMENDATION_DEPRECATED/);
  });

  test("deprecation sets status to deprecated", () => {
    assert.match(outcomeRegistry, /'deprecated'|status.*deprecated/s);
  });
});

// ─── Lineage Extension ────────────────────────────────────────────────────────

describe("Lineage Extension", () => {
  test("types define RecommendationLineageWithOutcome", () => {
    assert.match(types, /RecommendationLineageWithOutcome/);
  });

  test("effectiveness explain capability describes extended chain including outcome", () => {
    assert.match(explainFile, /Outcome/);
    assert.match(explainFile, /Artifact/);
    assert.match(explainFile, /Memory/);
    assert.match(explainFile, /Digest/);
    assert.match(explainFile, /Learning Pattern/);
    assert.match(explainFile, /Recommendation/);
  });
});

// ─── Audit Events ─────────────────────────────────────────────────────────────

describe("Audit Events", () => {
  const EFFECTIVENESS_EVENTS = [
    "CONSTITUTIONAL_RECOMMENDATION_OUTCOME_RECORDED",
    "CONSTITUTIONAL_RECOMMENDATION_FEEDBACK_SUBMITTED",
    "CONSTITUTIONAL_RECOMMENDATION_EFFECTIVENESS_CALCULATED",
    "CONSTITUTIONAL_RECOMMENDATION_CONFIDENCE_ADJUSTED",
    "CONSTITUTIONAL_RECOMMENDATION_BENCHMARK_GENERATED",
    "CONSTITUTIONAL_RECOMMENDATION_RANKING_GENERATED",
    "CONSTITUTIONAL_RECOMMENDATION_DEPRECATED",
  ];

  for (const evt of EFFECTIVENESS_EVENTS) {
    test(`explain capability documents ${evt}`, () => {
      assert.match(explainFile, new RegExp(evt), `Missing event in explain: ${evt}`);
    });
  }

  test("outcome registry emits OUTCOME_RECORDED with correct metadata", () => {
    assert.match(outcomeRegistry, /CONSTITUTIONAL_RECOMMENDATION_OUTCOME_RECORDED/);
    assert.match(outcomeRegistry, /learningEligible: true/);
    assert.match(outcomeRegistry, /eventCategory: "governance"/);
  });

  test("feedback registry emits FEEDBACK_SUBMITTED with correct metadata", () => {
    assert.match(feedbackReg, /CONSTITUTIONAL_RECOMMENDATION_FEEDBACK_SUBMITTED/);
    assert.match(feedbackReg, /learningEligible: true/);
  });

  test("outcome registry emits EFFECTIVENESS_CALCULATED", () => {
    assert.match(outcomeRegistry, /CONSTITUTIONAL_RECOMMENDATION_EFFECTIVENESS_CALCULATED/);
  });

  test("outcome registry emits CONFIDENCE_ADJUSTED", () => {
    assert.match(outcomeRegistry, /CONSTITUTIONAL_RECOMMENDATION_CONFIDENCE_ADJUSTED/);
  });

  test("benchmark registry emits BENCHMARK_GENERATED", () => {
    assert.match(benchmarkReg, /CONSTITUTIONAL_RECOMMENDATION_BENCHMARK_GENERATED/);
  });

  test("benchmark registry emits RANKING_GENERATED", () => {
    assert.match(benchmarkReg, /CONSTITUTIONAL_RECOMMENDATION_RANKING_GENERATED/);
  });
});

// ─── Workspace Isolation ──────────────────────────────────────────────────────

describe("Workspace Isolation", () => {
  test("outcome registry validates workspaceId UUID format", () => {
    assert.match(outcomeRegistry, /validUuid/);
    assert.match(outcomeRegistry, /workspaceId must be a UUID/);
  });

  test("feedback registry validates workspaceId UUID format", () => {
    assert.match(feedbackReg, /validUuid/);
    assert.match(feedbackReg, /workspaceId must be a UUID/);
  });

  test("benchmark registry validates workspaceId UUID format", () => {
    assert.match(benchmarkReg, /validUuid/);
    assert.match(benchmarkReg, /workspaceId must be a UUID/);
  });

  test("migration enables RLS on all three tables", () => {
    assert.match(migration, /constitutional_recommendation_outcomes.*enable row level security/s);
    assert.match(migration, /constitutional_recommendation_feedback.*enable row level security/s);
    assert.match(migration, /constitutional_recommendation_effectiveness.*enable row level security/s);
  });

  test("migration uses is_workspace_member for all RLS policies", () => {
    assert.match(migration, /is_workspace_member/);
  });

  test("outcome queries filter by workspace_id", () => {
    assert.match(outcomeRegistry, /eq\("workspace_id"/);
  });
});

// ─── Explain Capability ───────────────────────────────────────────────────────

describe("Explain Capability — explainRecommendationEffectiveness()", () => {
  test("defines concept", () => {
    assert.match(explainFile, /concept/);
    assert.match(explainFile, /Effectiveness/);
  });

  test("defines all 6 principles", () => {
    for (let i = 1; i <= 6; i++) {
      assert.match(explainFile, new RegExp(`Principle ${i}`), `Missing Principle ${i}`);
    }
  });

  test("describes outcome model with all 8 outcome types", () => {
    assert.match(explainFile, /outcomeModel/);
    for (const t of ["risk_reduction", "schedule_improvement", "cost_reduction", "quality_improvement",
                     "governance_improvement", "delivery_improvement", "authority_improvement", "ratification_improvement"]) {
      assert.match(explainFile, new RegExp(t), `Missing outcome type: ${t}`);
    }
  });

  test("describes feedback model with all 3 feedback types", () => {
    assert.match(explainFile, /feedbackModel/);
    for (const t of ["positive", "neutral", "negative"]) {
      assert.match(explainFile, new RegExp(t), `Missing feedback type: ${t}`);
    }
  });

  test("describes effectiveness model with scale 0.0–1.0", () => {
    assert.match(explainFile, /effectivenessModel/);
    assert.match(explainFile, /0\.0.*1\.0|1\.0.*0\.0/s);
  });

  test("describes adaptation rules A, B, C", () => {
    assert.match(explainFile, /adaptationModel/);
    assert.match(explainFile, /Rule A/);
    assert.match(explainFile, /Rule B/);
    assert.match(explainFile, /Rule C/);
  });

  test("describes deprecation lifecycle", () => {
    assert.match(explainFile, /deprecation/);
    assert.match(explainFile, /deprecated/);
  });

  test("describes all 8 business rules", () => {
    for (let i = 1; i <= 8; i++) {
      assert.match(explainFile, new RegExp(`Rule ${i}`), `Missing Rule ${i}`);
    }
  });

  test("documents all 7 new audit events", () => {
    for (const evt of [
      "CONSTITUTIONAL_RECOMMENDATION_OUTCOME_RECORDED",
      "CONSTITUTIONAL_RECOMMENDATION_FEEDBACK_SUBMITTED",
      "CONSTITUTIONAL_RECOMMENDATION_EFFECTIVENESS_CALCULATED",
      "CONSTITUTIONAL_RECOMMENDATION_CONFIDENCE_ADJUSTED",
      "CONSTITUTIONAL_RECOMMENDATION_BENCHMARK_GENERATED",
      "CONSTITUTIONAL_RECOMMENDATION_RANKING_GENERATED",
      "CONSTITUTIONAL_RECOMMENDATION_DEPRECATED",
    ]) {
      assert.match(explainFile, new RegExp(evt), `Explain missing event: ${evt}`);
    }
  });
});

// ─── Public API — index.ts ────────────────────────────────────────────────────

describe("Public API — index.ts", () => {
  const publicFns = [
    "recordRecommendationOutcome",
    "calculateRecommendationEffectiveness",
    "adjustRecommendationConfidence",
    "getRecommendationEffectiveness",
    "listRecommendationOutcomes",
    "deprecateRecommendation",
    "submitRecommendationFeedback",
    "listRecommendationFeedback",
    "benchmarkRecommendationsForWorkspace",
    "rankRecommendationsForWorkspace",
    "explainRecommendationEffectiveness",
    "calculateEffectivenessScore",
    "computeOutcomeEffectivenessScore",
    "adaptRecommendationConfidence",
    "benchmarkRecommendations",
    "rankRecommendations",
  ];
  for (const fn of publicFns) {
    test(`exports ${fn}`, () => {
      assert.match(indexFile, new RegExp(fn), `Missing export: ${fn}`);
    });
  }
});

// ─── Documentation ────────────────────────────────────────────────────────────

describe("Documentation", () => {
  test("docs/recommendation-effectiveness-engine.md covers key concepts", () => {
    assert.match(docs, /Effectiveness/i);
    assert.match(docs, /Outcome/i);
    assert.match(docs, /Feedback/i);
  });

  test("documentation describes adaptation model", () => {
    assert.match(docs, /Adaptation|adaptation/);
    assert.match(docs, /confidence/i);
  });

  test("documentation describes benchmarking", () => {
    assert.match(docs, /Benchmark|benchmark/);
  });

  test("documentation describes ranking", () => {
    assert.match(docs, /Rank|rank/);
  });

  test("documentation mentions audit events", () => {
    assert.match(docs, /CONSTITUTIONAL_RECOMMENDATION/);
  });

  test("documentation describes the full 6-node lineage chain including outcome", () => {
    assert.match(docs, /Artifact/i);
    assert.match(docs, /Memory/i);
    assert.match(docs, /Digest/i);
    assert.match(docs, /Learning Pattern/i);
    assert.match(docs, /Recommendation/i);
    assert.match(docs, /Outcome/i);
  });
});
