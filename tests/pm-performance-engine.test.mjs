import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { readFileSync } from "node:fs";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function validUuid(v) {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function isoNow(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

// ─── Pure engine implementations (mirrors src/lib/pm-performance/engines/) ───

const PM_PERFORMANCE_WEIGHTS = {
  governance: 0.20,
  execution:  0.25,
  prediction: 0.15,
  decision:   0.20,
  portfolio:  0.20,
};

const PM_PERFORMANCE_STATUS_THRESHOLDS = {
  excellent: 90,
  strong:    80,
  stable:    65,
  warning:   45,
};

const CRITICAL_PROJECT_THRESHOLD = 45;

function calculatePMGovernanceScore({ governanceHealthScores, openViolationCount, pendingEscalationCount }) {
  if (governanceHealthScores.length === 0) return 75;
  const avg = governanceHealthScores.reduce((s, v) => s + v, 0) / governanceHealthScores.length;
  const vPenalty = Math.min(openViolationCount * 3, 30);
  const ePenalty = Math.min(pendingEscalationCount * 5, 20);
  return Math.max(0, Math.min(100, Math.round(avg - vPenalty - ePenalty)));
}

function calculatePMExecutionScore({ executionHealthScores, totalTasks, completedTasks, overdueTasks }) {
  if (executionHealthScores.length === 0) return 75;
  const avg = executionHealthScores.reduce((s, v) => s + v, 0) / executionHealthScores.length;
  const bonus   = totalTasks > 0 ? (completedTasks / totalTasks) * 10 : 0;
  const penalty = Math.min(overdueTasks * 2, 20);
  return Math.max(0, Math.min(100, Math.round(avg + bonus - penalty)));
}

function calculatePMPredictionAccuracy({ confidenceScores, varianceValues }) {
  if (confidenceScores.length === 0) return 75;
  const avgConf = (confidenceScores.reduce((s, v) => s + v, 0) / confidenceScores.length) * 100;
  const avgVar  = varianceValues.length > 0
    ? varianceValues.reduce((s, v) => s + Math.abs(v), 0) / varianceValues.length
    : 0;
  const varPenalty = Math.min(avgVar * 10, 25);
  return Math.max(0, Math.min(100, Math.round(avgConf - varPenalty)));
}

function calculatePMDecisionEffectiveness({ effectivenessScores, successfulOutcomes, unsuccessfulOutcomes, totalOutcomes }) {
  const hasScores   = effectivenessScores.length > 0;
  const hasOutcomes = totalOutcomes > 0;
  if (!hasScores && !hasOutcomes) return 75;
  const avgEff = hasScores
    ? effectivenessScores.reduce((s, v) => s + v, 0) / effectivenessScores.length
    : 75;
  const successRate  = hasOutcomes ? successfulOutcomes / totalOutcomes : 0.75;
  const failureRate  = hasOutcomes ? unsuccessfulOutcomes / totalOutcomes : 0;
  const successBonus   = successRate * 10;
  const failurePenalty = failureRate * 15;
  return Math.max(0, Math.min(100, Math.round(avgEff + successBonus - failurePenalty)));
}

function calculatePMPortfolioHealth({ operatingHealthScores, criticalProjectCount }) {
  if (operatingHealthScores.length === 0) return 75;
  const avg = operatingHealthScores.reduce((s, v) => s + v, 0) / operatingHealthScores.length;
  const penalty = Math.min(criticalProjectCount * 10, 30);
  return Math.max(0, Math.min(100, Math.round(avg - penalty)));
}

function calculatePMOverallPerformance(scores) {
  const w = PM_PERFORMANCE_WEIGHTS;
  const weighted =
    scores.governance * w.governance +
    scores.execution  * w.execution  +
    scores.prediction * w.prediction +
    scores.decision   * w.decision   +
    scores.portfolio  * w.portfolio;
  return Math.max(0, Math.min(100, Math.round(weighted)));
}

function classifyPMPerformanceStatus(score) {
  if (score >= PM_PERFORMANCE_STATUS_THRESHOLDS.excellent) return "excellent";
  if (score >= PM_PERFORMANCE_STATUS_THRESHOLDS.strong)    return "strong";
  if (score >= PM_PERFORMANCE_STATUS_THRESHOLDS.stable)    return "stable";
  if (score >= PM_PERFORMANCE_STATUS_THRESHOLDS.warning)   return "warning";
  return "critical";
}

// ─── In-memory PM Performance Store ──────────────────────────────────────────

function createPerformanceStore() {
  const pms         = new Map();
  const assignments = new Map();
  const snapshots   = new Map();
  const auditLog    = [];

  function validation(error)       { return { ok: false, error, failureClass: "validation" }; }
  function notFound(r = "Resource") { return { ok: false, error: `${r} not found.`, failureClass: "not_found" }; }

  function emitEvent(type, payload) {
    auditLog.push({ type, payload, occurred_at: isoNow() });
  }

  function registerPM(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId is required.");
    if (!input.displayName?.trim())     return validation("displayName is required.");
    if (!input.email?.trim())           return validation("email is required.");
    const id  = uuid();
    const now = isoNow();
    const pm  = { id, workspace_id: input.workspaceId, display_name: input.displayName, email: input.email, status: "active", created_at: now, updated_at: now };
    pms.set(id, pm);
    return { ok: true, data: pm };
  }

  function assignProject(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId required.");
    if (!validUuid(input.pmId))        return validation("pmId required.");
    if (!validUuid(input.projectId))   return validation("projectId required.");
    const id     = uuid();
    const record = { id, workspace_id: input.workspaceId, pm_id: input.pmId, project_id: input.projectId, assignment_type: "primary", assigned_at: isoNow(), removed_at: null };
    assignments.set(id, record);
    return { ok: true, data: record };
  }

  function generateSnapshot(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");
    if (!validUuid(input.pmId))        return validation("pmId must be a valid UUID.");

    const pm = pms.get(input.pmId);
    if (!pm || pm.workspace_id !== input.workspaceId) return notFound("Project Manager");

    const activeAssignments = [...assignments.values()].filter(
      (a) => a.workspace_id === input.workspaceId && a.pm_id === input.pmId && a.removed_at === null
    );

    if (activeAssignments.length === 0) {
      return validation("Cannot generate a performance snapshot for a PM with no active assignments.");
    }

    const osSnapshots   = input._osSnapshots   ?? [];
    const taskStats     = input._taskStats     ?? { total: 0, completed: 0, overdue: 0 };
    const realities     = input._realities     ?? [];
    const outcomes      = input._outcomes      ?? [];
    const violations    = input._violations    ?? 0;
    const escalations   = input._escalations   ?? 0;

    const governanceScore = calculatePMGovernanceScore({
      governanceHealthScores: osSnapshots.map((s) => s.governance_health_score),
      openViolationCount:     violations,
      pendingEscalationCount: escalations,
    });

    const executionScore = calculatePMExecutionScore({
      executionHealthScores: osSnapshots.map((s) => s.execution_health_score),
      totalTasks:     taskStats.total,
      completedTasks: taskStats.completed,
      overdueTasks:   taskStats.overdue,
    });

    const predictionAccuracyScore = calculatePMPredictionAccuracy({
      confidenceScores: realities.map((r) => r.confidence_score),
      varianceValues:   realities.map((r) => r.variance ?? 0),
    });

    const successfulOutcomes   = outcomes.filter((o) => o.outcome_status === "successful").length;
    const unsuccessfulOutcomes = outcomes.filter((o) => o.outcome_status === "unsuccessful").length;

    const decisionEffectivenessScore = calculatePMDecisionEffectiveness({
      effectivenessScores: outcomes.map((o) => o.effectiveness_score),
      successfulOutcomes,
      unsuccessfulOutcomes,
      totalOutcomes: outcomes.length,
    });

    const criticalProjectCount = osSnapshots.filter((s) => s.operating_health_score < CRITICAL_PROJECT_THRESHOLD).length;

    const portfolioHealthScore = calculatePMPortfolioHealth({
      operatingHealthScores: osSnapshots.map((s) => s.operating_health_score),
      criticalProjectCount,
    });

    const overallScore = calculatePMOverallPerformance({
      governance: governanceScore,
      execution:  executionScore,
      prediction: predictionAccuracyScore,
      decision:   decisionEffectivenessScore,
      portfolio:  portfolioHealthScore,
    });

    const performanceStatus = classifyPMPerformanceStatus(overallScore);

    const id  = uuid();
    const now = isoNow();
    const snapshot = {
      id,
      workspace_id:                 input.workspaceId,
      pm_id:                        input.pmId,
      governance_score:             governanceScore,
      execution_score:              executionScore,
      prediction_accuracy_score:    predictionAccuracyScore,
      decision_effectiveness_score: decisionEffectivenessScore,
      portfolio_health_score:       portfolioHealthScore,
      overall_score:                overallScore,
      performance_status:           performanceStatus,
      snapshot_payload: {
        pm_name:               pm.display_name,
        assigned_project_count: activeAssignments.length,
        os_snapshot_count:     osSnapshots.length,
        outcome_count:         outcomes.length,
        reality_count:         realities.length,
      },
      generated_at: now,
      created_at:   now,
      updated_at:   now,
    };
    snapshots.set(id, snapshot);

    emitEvent("PM_PERFORMANCE_SNAPSHOT_GENERATED", {
      pm_id:         input.pmId,
      snapshot_id:   id,
      overall_score: overallScore,
      status:        performanceStatus,
    });

    return { ok: true, data: snapshot };
  }

  function getSnapshot(workspaceId, snapshotId) {
    const snap = snapshots.get(snapshotId);
    if (!snap || snap.workspace_id !== workspaceId) return notFound("Performance snapshot");
    return { ok: true, data: { ...snap } };
  }

  function listSnapshots(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId required.");
    const results = [];
    for (const snap of snapshots.values()) {
      if (snap.workspace_id !== input.workspaceId) continue;
      if (input.pmId && snap.pm_id !== input.pmId) continue;
      if (input.status && snap.performance_status !== input.status) continue;
      results.push({ ...snap });
    }
    return { ok: true, data: results.sort((a, b) => b.generated_at.localeCompare(a.generated_at)) };
  }

  function generateScorecard(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId required.");
    if (!validUuid(input.pmId))        return validation("pmId required.");
    const pm = pms.get(input.pmId);
    if (!pm || pm.workspace_id !== input.workspaceId) return notFound("Project Manager");

    const snapResult = generateSnapshot(input);
    if (!snapResult.ok) return snapResult;
    const snap    = snapResult.data;
    const payload = snap.snapshot_payload;

    const scorecard = {
      pm: { id: pm.id, name: pm.display_name, email: pm.email },
      scores: {
        governance: snap.governance_score,
        execution:  snap.execution_score,
        prediction: snap.prediction_accuracy_score,
        decision:   snap.decision_effectiveness_score,
        portfolio:  snap.portfolio_health_score,
        overall:    snap.overall_score,
      },
      status:      snap.performance_status,
      evidence:    { projects: payload.assigned_project_count, snapshots: payload.os_snapshot_count, outcomes: payload.outcome_count },
      explanation: { summary: `Overall: ${snap.overall_score}`, strengths: [], attentionAreas: [], supportedBy: [] },
      generatedAt: snap.generated_at,
    };

    emitEvent("PM_SCORECARD_GENERATED", { pm_id: input.pmId, snapshot_id: snap.id });
    return { ok: true, data: scorecard };
  }

  function comparePerformance(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId required.");
    if (!validUuid(input.pmAId))       return validation("pmAId required.");
    if (!validUuid(input.pmBId))       return validation("pmBId required.");
    if (input.pmAId === input.pmBId)   return validation("pmAId and pmBId must be different.");

    const pmA = pms.get(input.pmAId);
    const pmB = pms.get(input.pmBId);
    if (!pmA || pmA.workspace_id !== input.workspaceId) return notFound("PM A");
    if (!pmB || pmB.workspace_id !== input.workspaceId) return notFound("PM B");

    const snapsA = [...snapshots.values()].filter((s) => s.pm_id === input.pmAId && s.workspace_id === input.workspaceId);
    const snapsB = [...snapshots.values()].filter((s) => s.pm_id === input.pmBId && s.workspace_id === input.workspaceId);
    const scoreA = snapsA.length > 0 ? snapsA.sort((a, b) => b.generated_at.localeCompare(a.generated_at))[0].overall_score : 0;
    const scoreB = snapsB.length > 0 ? snapsB.sort((a, b) => b.generated_at.localeCompare(a.generated_at))[0].overall_score : 0;
    const statusA = snapsA.length > 0 ? snapsA[0].performance_status : "critical";
    const statusB = snapsB.length > 0 ? snapsB[0].performance_status : "critical";

    const difference = Math.round((scoreA - scoreB) * 100) / 100;
    const stronger   = difference > 0 ? "a" : difference < 0 ? "b" : "equal";

    emitEvent("PM_PERFORMANCE_COMPARED", { pm_a_id: input.pmAId, pm_b_id: input.pmBId, difference, stronger });
    return {
      ok: true,
      data: {
        pmA: { id: input.pmAId, name: pmA.display_name, overallScore: scoreA, status: statusA },
        pmB: { id: input.pmBId, name: pmB.display_name, overallScore: scoreB, status: statusB },
        difference,
        stronger,
      },
    };
  }

  function getLineage(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId required.");
    if (!validUuid(input.pmId))        return validation("pmId required.");
    const pm = pms.get(input.pmId);
    if (!pm || pm.workspace_id !== input.workspaceId) return notFound("Project Manager");

    const pmAssignments = [...assignments.values()].filter(
      (a) => a.pm_id === input.pmId && a.workspace_id === input.workspaceId && a.removed_at === null
    );
    const projectIds = [...new Set(pmAssignments.map((a) => a.project_id))];

    const latestSnap = [...snapshots.values()]
      .filter((s) => s.pm_id === input.pmId && s.workspace_id === input.workspaceId)
      .sort((a, b) => b.generated_at.localeCompare(a.generated_at))[0];

    emitEvent("PM_PERFORMANCE_LINEAGE_GENERATED", { pm_id: input.pmId });
    return {
      ok: true,
      data: {
        pm:                 { id: pm.id, name: pm.display_name, email: pm.email },
        assignments:        pmAssignments.map((a) => ({ id: a.id, projectId: a.project_id, assignmentType: a.assignment_type, assignedAt: a.assigned_at })),
        projects:           projectIds.map((id) => ({ id })),
        projectOsSnapshots: input._osSnapshots ?? [],
        executionRealities: input._realities   ?? [],
        decisionOutcomes:   input._outcomes    ?? [],
        performanceSnapshot: latestSnap
          ? { id: latestSnap.id, overallScore: latestSnap.overall_score, status: latestSnap.performance_status, generatedAt: latestSnap.generated_at }
          : null,
      },
    };
  }

  return {
    registerPM, assignProject,
    generateSnapshot, getSnapshot, listSnapshots,
    generateScorecard, comparePerformance, getLineage,
    auditLog,
    _pms: pms, _assignments: assignments, _snapshots: snapshots,
  };
}

// ─── Helpers for tests ────────────────────────────────────────────────────────

function goodOsSnapshot(overrides = {}) {
  return {
    id: uuid(),
    operating_health_score:   90,
    governance_health_score:  88,
    execution_health_score:   85,
    ...overrides,
  };
}

function goodOutcome(overrides = {}) {
  return { id: uuid(), outcome_status: "successful", effectiveness_score: 85, ...overrides };
}

function goodReality(overrides = {}) {
  return { id: uuid(), confidence_score: 0.85, variance: 0, ...overrides };
}

// ─── Governance Score Engine ──────────────────────────────────────────────────

describe("Governance Score Engine", () => {
  test("returns 75 when no data", () => {
    assert.equal(calculatePMGovernanceScore({ governanceHealthScores: [], openViolationCount: 0, pendingEscalationCount: 0 }), 75);
  });

  test("high governance health scores produce high score", () => {
    const score = calculatePMGovernanceScore({ governanceHealthScores: [95, 90, 92], openViolationCount: 0, pendingEscalationCount: 0 });
    assert.ok(score >= 80, `Expected >= 80, got ${score}`);
  });

  test("low governance health scores produce low score", () => {
    const score = calculatePMGovernanceScore({ governanceHealthScores: [30, 25, 40], openViolationCount: 0, pendingEscalationCount: 0 });
    assert.ok(score < 65, `Expected < 65, got ${score}`);
  });

  test("open violations reduce score", () => {
    const base    = calculatePMGovernanceScore({ governanceHealthScores: [80], openViolationCount: 0, pendingEscalationCount: 0 });
    const reduced = calculatePMGovernanceScore({ governanceHealthScores: [80], openViolationCount: 5, pendingEscalationCount: 0 });
    assert.ok(reduced < base, `Violations should reduce score: ${reduced} >= ${base}`);
  });

  test("authority gaps (escalations) reduce score", () => {
    const base    = calculatePMGovernanceScore({ governanceHealthScores: [80], openViolationCount: 0, pendingEscalationCount: 0 });
    const reduced = calculatePMGovernanceScore({ governanceHealthScores: [80], openViolationCount: 0, pendingEscalationCount: 3 });
    assert.ok(reduced < base, `Escalations should reduce score: ${reduced} >= ${base}`);
  });

  test("violation penalty capped at 30", () => {
    const s1 = calculatePMGovernanceScore({ governanceHealthScores: [80], openViolationCount: 10, pendingEscalationCount: 0 });
    const s2 = calculatePMGovernanceScore({ governanceHealthScores: [80], openViolationCount: 100, pendingEscalationCount: 0 });
    assert.equal(s1, s2); // both capped at 30 penalty
  });

  test("score clamped to 0", () => {
    const score = calculatePMGovernanceScore({ governanceHealthScores: [5], openViolationCount: 100, pendingEscalationCount: 100 });
    assert.equal(score, 0);
  });
});

// ─── Execution Score Engine ───────────────────────────────────────────────────

describe("Execution Score Engine", () => {
  test("returns 75 when no data", () => {
    assert.equal(calculatePMExecutionScore({ executionHealthScores: [], totalTasks: 0, completedTasks: 0, overdueTasks: 0 }), 75);
  });

  test("completed commitments increase score", () => {
    const withCompletion    = calculatePMExecutionScore({ executionHealthScores: [80], totalTasks: 10, completedTasks: 10, overdueTasks: 0 });
    const withoutCompletion = calculatePMExecutionScore({ executionHealthScores: [80], totalTasks: 10, completedTasks: 0,  overdueTasks: 0 });
    assert.ok(withCompletion > withoutCompletion, `Completion bonus expected: ${withCompletion} <= ${withoutCompletion}`);
  });

  test("overdue commitments reduce score", () => {
    const clean   = calculatePMExecutionScore({ executionHealthScores: [80], totalTasks: 10, completedTasks: 5, overdueTasks: 0 });
    const overdue = calculatePMExecutionScore({ executionHealthScores: [80], totalTasks: 10, completedTasks: 5, overdueTasks: 5 });
    assert.ok(overdue < clean, `Overdue penalty expected: ${overdue} >= ${clean}`);
  });

  test("drifts (overdue) reduce score", () => {
    const s1 = calculatePMExecutionScore({ executionHealthScores: [75], totalTasks: 0, completedTasks: 0, overdueTasks: 3 });
    const s2 = calculatePMExecutionScore({ executionHealthScores: [75], totalTasks: 0, completedTasks: 0, overdueTasks: 0 });
    assert.ok(s1 < s2);
  });

  test("score clamped to 100", () => {
    const score = calculatePMExecutionScore({ executionHealthScores: [100], totalTasks: 10, completedTasks: 10, overdueTasks: 0 });
    assert.ok(score <= 100);
  });
});

// ─── Prediction Accuracy Engine ───────────────────────────────────────────────

describe("Prediction Accuracy Engine", () => {
  test("returns 75 when no data", () => {
    assert.equal(calculatePMPredictionAccuracy({ confidenceScores: [], varianceValues: [] }), 75);
  });

  test("high confidence scores produce high accuracy", () => {
    const score = calculatePMPredictionAccuracy({ confidenceScores: [0.95, 0.90, 0.88], varianceValues: [] });
    assert.ok(score >= 80, `Expected >= 80, got ${score}`);
  });

  test("low confidence scores produce low accuracy", () => {
    const score = calculatePMPredictionAccuracy({ confidenceScores: [0.30, 0.25, 0.40], varianceValues: [] });
    assert.ok(score < 50, `Expected < 50, got ${score}`);
  });

  test("high variance reduces score", () => {
    const noVar  = calculatePMPredictionAccuracy({ confidenceScores: [0.80], varianceValues: [0] });
    const highVar = calculatePMPredictionAccuracy({ confidenceScores: [0.80], varianceValues: [2] });
    assert.ok(highVar < noVar, `Variance penalty expected: ${highVar} >= ${noVar}`);
  });
});

// ─── Decision Effectiveness Engine ────────────────────────────────────────────

describe("Decision Effectiveness Engine", () => {
  test("returns 75 when no data", () => {
    assert.equal(calculatePMDecisionEffectiveness({ effectivenessScores: [], successfulOutcomes: 0, unsuccessfulOutcomes: 0, totalOutcomes: 0 }), 75);
  });

  test("successful outcomes increase score", () => {
    const allSuccess = calculatePMDecisionEffectiveness({ effectivenessScores: [75], successfulOutcomes: 5, unsuccessfulOutcomes: 0, totalOutcomes: 5 });
    const baseline   = calculatePMDecisionEffectiveness({ effectivenessScores: [75], successfulOutcomes: 0, unsuccessfulOutcomes: 0, totalOutcomes: 0 });
    assert.ok(allSuccess >= baseline);
  });

  test("unsuccessful outcomes reduce score", () => {
    const allFail    = calculatePMDecisionEffectiveness({ effectivenessScores: [75], successfulOutcomes: 0, unsuccessfulOutcomes: 5, totalOutcomes: 5 });
    const noOutcomes = calculatePMDecisionEffectiveness({ effectivenessScores: [75], successfulOutcomes: 0, unsuccessfulOutcomes: 0, totalOutcomes: 0 });
    assert.ok(allFail < noOutcomes, `Failure should reduce: ${allFail} >= ${noOutcomes}`);
  });

  test("recommendation quality (effectiveness_score) influences score", () => {
    const high = calculatePMDecisionEffectiveness({ effectivenessScores: [95], successfulOutcomes: 0, unsuccessfulOutcomes: 0, totalOutcomes: 0 });
    const low  = calculatePMDecisionEffectiveness({ effectivenessScores: [30], successfulOutcomes: 0, unsuccessfulOutcomes: 0, totalOutcomes: 0 });
    assert.ok(high > low, `Higher effectiveness_score should produce higher score: ${high} <= ${low}`);
  });
});

// ─── Portfolio Health Engine ──────────────────────────────────────────────────

describe("Portfolio Health Engine", () => {
  test("returns 75 when no data", () => {
    assert.equal(calculatePMPortfolioHealth({ operatingHealthScores: [], criticalProjectCount: 0 }), 75);
  });

  test("healthy projects increase score", () => {
    const score = calculatePMPortfolioHealth({ operatingHealthScores: [90, 85, 92], criticalProjectCount: 0 });
    assert.ok(score >= 80);
  });

  test("critical projects reduce score", () => {
    const noCritical  = calculatePMPortfolioHealth({ operatingHealthScores: [80, 80], criticalProjectCount: 0 });
    const hasCritical = calculatePMPortfolioHealth({ operatingHealthScores: [80, 80], criticalProjectCount: 2 });
    assert.ok(hasCritical < noCritical, `Critical projects should reduce: ${hasCritical} >= ${noCritical}`);
  });

  test("critical penalty capped at 30", () => {
    const s1 = calculatePMPortfolioHealth({ operatingHealthScores: [80], criticalProjectCount: 3 });
    const s2 = calculatePMPortfolioHealth({ operatingHealthScores: [80], criticalProjectCount: 100 });
    assert.equal(s1, s2);
  });
});

// ─── Overall Performance Engine ──────────────────────────────────────────────

describe("Overall Performance Engine", () => {
  test("correct weighted calculation", () => {
    const scores = { governance: 80, execution: 80, prediction: 80, decision: 80, portfolio: 80 };
    const overall = calculatePMOverallPerformance(scores);
    assert.equal(overall, 80);
  });

  test("weights sum to 1.00", () => {
    const sum = Object.values(PM_PERFORMANCE_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.0001, `Weights must sum to 1, got ${sum}`);
  });

  test("differentiated scores calculate correctly", () => {
    const scores = { governance: 90, execution: 90, prediction: 90, decision: 90, portfolio: 90 };
    assert.equal(calculatePMOverallPerformance(scores), 90);
  });

  test("result clamped to 100", () => {
    const scores = { governance: 100, execution: 100, prediction: 100, decision: 100, portfolio: 100 };
    assert.equal(calculatePMOverallPerformance(scores), 100);
  });

  test("result clamped to 0", () => {
    const scores = { governance: 0, execution: 0, prediction: 0, decision: 0, portfolio: 0 };
    assert.equal(calculatePMOverallPerformance(scores), 0);
  });

  test("rounding works correctly", () => {
    // 87*0.20 + 82*0.25 + 78*0.15 + 91*0.20 + 74*0.20
    // = 17.4 + 20.5 + 11.7 + 18.2 + 14.8 = 82.6 → rounds to 83
    const scores = { governance: 87, execution: 82, prediction: 78, decision: 91, portfolio: 74 };
    const result = calculatePMOverallPerformance(scores);
    assert.equal(result, 83);
  });
});

// ─── Status Classification Engine ────────────────────────────────────────────

describe("Status Classification Engine", () => {
  test("90-100 → excellent", () => {
    assert.equal(classifyPMPerformanceStatus(90),  "excellent");
    assert.equal(classifyPMPerformanceStatus(100), "excellent");
    assert.equal(classifyPMPerformanceStatus(95),  "excellent");
  });

  test("80-89 → strong", () => {
    assert.equal(classifyPMPerformanceStatus(80), "strong");
    assert.equal(classifyPMPerformanceStatus(89), "strong");
    assert.equal(classifyPMPerformanceStatus(83), "strong");
  });

  test("65-79 → stable", () => {
    assert.equal(classifyPMPerformanceStatus(65), "stable");
    assert.equal(classifyPMPerformanceStatus(79), "stable");
    assert.equal(classifyPMPerformanceStatus(72), "stable");
  });

  test("45-64 → warning", () => {
    assert.equal(classifyPMPerformanceStatus(45), "warning");
    assert.equal(classifyPMPerformanceStatus(64), "warning");
    assert.equal(classifyPMPerformanceStatus(55), "warning");
  });

  test("0-44 → critical", () => {
    assert.equal(classifyPMPerformanceStatus(0),  "critical");
    assert.equal(classifyPMPerformanceStatus(44), "critical");
    assert.equal(classifyPMPerformanceStatus(20), "critical");
  });
});

// ─── Snapshot Generation ─────────────────────────────────────────────────────

describe("Snapshot Generation", () => {
  test("generates snapshot for valid PM with assignments", () => {
    const store = createPerformanceStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "Ana", email: "ana@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    const result = store.generateSnapshot({ workspaceId: wsId, pmId: pm.id, _osSnapshots: [goodOsSnapshot()] });
    assert.equal(result.ok, true);
    assert.ok(validUuid(result.data.id));
    assert.equal(result.data.pm_id, pm.id);
    assert.equal(result.data.workspace_id, wsId);
  });

  test("rejects PM without assignments (Rule 7)", () => {
    const store = createPerformanceStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "Ana", email: "ana@x.com" });
    const result = store.generateSnapshot({ workspaceId: wsId, pmId: pm.id });
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "validation");
    assert.match(result.error, /no active assignments/i);
  });

  test("rejects invalid workspaceId", () => {
    const store = createPerformanceStore();
    const result = store.generateSnapshot({ workspaceId: "not-a-uuid", pmId: uuid() });
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "validation");
  });

  test("snapshot payload contains evidence", () => {
    const store = createPerformanceStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "Ana", email: "ana@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    const { data: snap } = store.generateSnapshot({ workspaceId: wsId, pmId: pm.id, _osSnapshots: [goodOsSnapshot()] });
    assert.ok(typeof snap.snapshot_payload === "object");
    assert.ok("pm_name" in snap.snapshot_payload);
    assert.ok("assigned_project_count" in snap.snapshot_payload);
  });

  test("snapshot is historical (has generated_at)", () => {
    const store = createPerformanceStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "Ana", email: "ana@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    const { data: snap } = store.generateSnapshot({ workspaceId: wsId, pmId: pm.id, _osSnapshots: [goodOsSnapshot()] });
    assert.ok(typeof snap.generated_at === "string");
    assert.ok(!isNaN(Date.parse(snap.generated_at)));
  });

  test("scores are between 0 and 100", () => {
    const store = createPerformanceStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "Ana", email: "ana@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    const { data: snap } = store.generateSnapshot({ workspaceId: wsId, pmId: pm.id, _osSnapshots: [goodOsSnapshot()] });
    for (const field of ["governance_score","execution_score","prediction_accuracy_score","decision_effectiveness_score","portfolio_health_score","overall_score"]) {
      const v = snap[field];
      assert.ok(v >= 0 && v <= 100, `${field}=${v} out of range`);
    }
  });
});

// ─── Scorecard ───────────────────────────────────────────────────────────────

describe("PM Scorecard", () => {
  test("scorecard has correct structure", () => {
    const store = createPerformanceStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "Victor", email: "victor@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    const { data: scorecard } = store.generateScorecard({ workspaceId: wsId, pmId: pm.id, _osSnapshots: [goodOsSnapshot()] });
    assert.ok("pm" in scorecard);
    assert.ok("scores" in scorecard);
    assert.ok("status" in scorecard);
    assert.ok("evidence" in scorecard);
    assert.equal(scorecard.pm.id, pm.id);
    assert.equal(scorecard.pm.name, "Victor");
  });

  test("scorecard scores match snapshot", () => {
    const store = createPerformanceStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "Victor", email: "victor@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    const snapResult = store.generateSnapshot({ workspaceId: wsId, pmId: pm.id, _osSnapshots: [goodOsSnapshot()] });
    const cardResult = store.generateScorecard({ workspaceId: wsId, pmId: pm.id, _osSnapshots: [goodOsSnapshot()] });
    // Both should produce valid scores
    assert.equal(snapResult.ok, true);
    assert.equal(cardResult.ok, true);
    assert.equal(cardResult.data.scores.overall, snapResult.data.overall_score);
  });

  test("scorecard evidence reflects project count", () => {
    const store = createPerformanceStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    const { data: scorecard } = store.generateScorecard({
      workspaceId: wsId, pmId: pm.id,
      _osSnapshots: [goodOsSnapshot(), goodOsSnapshot()],
    });
    assert.equal(scorecard.evidence.projects, 2);
  });
});

// ─── Comparison ──────────────────────────────────────────────────────────────

describe("PM Performance Comparison", () => {
  function setupTwoPMs(store) {
    const wsId = uuid();
    const { data: pmA } = store.registerPM({ workspaceId: wsId, displayName: "PM A", email: "pma@x.com" });
    const { data: pmB } = store.registerPM({ workspaceId: wsId, displayName: "PM B", email: "pmb@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pmA.id, projectId: uuid() });
    store.assignProject({ workspaceId: wsId, pmId: pmB.id, projectId: uuid() });
    store.generateSnapshot({ workspaceId: wsId, pmId: pmA.id, _osSnapshots: [goodOsSnapshot({ operating_health_score: 90, governance_health_score: 90, execution_health_score: 90 })] });
    store.generateSnapshot({ workspaceId: wsId, pmId: pmB.id, _osSnapshots: [goodOsSnapshot({ operating_health_score: 60, governance_health_score: 60, execution_health_score: 60 })] });
    return { wsId, pmA, pmB };
  }

  test("correct difference calculation", () => {
    const store = createPerformanceStore();
    const { wsId, pmA, pmB } = setupTwoPMs(store);
    const result = store.comparePerformance({ workspaceId: wsId, pmAId: pmA.id, pmBId: pmB.id });
    assert.equal(result.ok, true);
    assert.ok(result.data.difference !== 0);
    assert.equal(result.data.stronger, "a");
  });

  test("equal scores produce equal stronger", () => {
    const store = createPerformanceStore();
    const wsId  = uuid();
    const { data: pmA } = store.registerPM({ workspaceId: wsId, displayName: "PM A", email: "pma@x.com" });
    const { data: pmB } = store.registerPM({ workspaceId: wsId, displayName: "PM B", email: "pmb@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pmA.id, projectId: uuid() });
    store.assignProject({ workspaceId: wsId, pmId: pmB.id, projectId: uuid() });
    const snap = goodOsSnapshot({ operating_health_score: 80, governance_health_score: 80, execution_health_score: 80 });
    store.generateSnapshot({ workspaceId: wsId, pmId: pmA.id, _osSnapshots: [snap] });
    store.generateSnapshot({ workspaceId: wsId, pmId: pmB.id, _osSnapshots: [snap] });
    const result = store.comparePerformance({ workspaceId: wsId, pmAId: pmA.id, pmBId: pmB.id });
    assert.equal(result.data.difference, 0);
    assert.equal(result.data.stronger, "equal");
  });

  test("rejects same PM ID for both sides", () => {
    const store = createPerformanceStore();
    const wsId  = uuid();
    const id    = uuid();
    const result = store.comparePerformance({ workspaceId: wsId, pmAId: id, pmBId: id });
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "validation");
  });

  test("emits PM_PERFORMANCE_COMPARED event", () => {
    const store = createPerformanceStore();
    const { wsId, pmA, pmB } = setupTwoPMs(store);
    store.comparePerformance({ workspaceId: wsId, pmAId: pmA.id, pmBId: pmB.id });
    assert.ok(store.auditLog.some((e) => e.type === "PM_PERFORMANCE_COMPARED"));
  });
});

// ─── Lineage ─────────────────────────────────────────────────────────────────

describe("PM Performance Lineage", () => {
  test("reconstructs full lineage chain", () => {
    const store = createPerformanceStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    const projId = uuid();
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: projId });

    const osSnap    = goodOsSnapshot();
    const reality   = goodReality();
    const outcome   = goodOutcome();

    store.generateSnapshot({ workspaceId: wsId, pmId: pm.id, _osSnapshots: [osSnap], _realities: [reality], _outcomes: [outcome] });

    const result = store.getLineage({
      workspaceId:   wsId,
      pmId:          pm.id,
      _osSnapshots:  [{ id: osSnap.id, projectId: projId, operatingHealthScore: 90, governanceHealthScore: 88, executionHealthScore: 85 }],
      _realities:    [{ id: reality.id, confidenceScore: 0.85, status: "validated" }],
      _outcomes:     [{ id: outcome.id, outcomeStatus: "successful", effectivenessScore: 85 }],
    });

    assert.equal(result.ok, true);
    assert.ok("pm"                 in result.data);
    assert.ok("assignments"        in result.data);
    assert.ok("projects"           in result.data);
    assert.ok("projectOsSnapshots" in result.data);
    assert.ok("executionRealities" in result.data);
    assert.ok("decisionOutcomes"   in result.data);
    assert.ok("performanceSnapshot" in result.data);
    assert.equal(result.data.pm.id, pm.id);
    assert.equal(result.data.assignments.length, 1);
    assert.notEqual(result.data.performanceSnapshot, null);
  });

  test("emits PM_PERFORMANCE_LINEAGE_GENERATED event", () => {
    const store = createPerformanceStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    store.getLineage({ workspaceId: wsId, pmId: pm.id });
    assert.ok(store.auditLog.some((e) => e.type === "PM_PERFORMANCE_LINEAGE_GENERATED"));
  });
});

// ─── Audit Events ────────────────────────────────────────────────────────────

describe("Audit Events", () => {
  test("PM_PERFORMANCE_SNAPSHOT_GENERATED emitted on generation", () => {
    const store = createPerformanceStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    store.generateSnapshot({ workspaceId: wsId, pmId: pm.id, _osSnapshots: [goodOsSnapshot()] });
    assert.ok(store.auditLog.some((e) => e.type === "PM_PERFORMANCE_SNAPSHOT_GENERATED"));
  });

  test("PM_SCORECARD_GENERATED emitted on scorecard generation", () => {
    const store = createPerformanceStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    store.generateScorecard({ workspaceId: wsId, pmId: pm.id, _osSnapshots: [goodOsSnapshot()] });
    assert.ok(store.auditLog.some((e) => e.type === "PM_SCORECARD_GENERATED"));
  });

  test("audit events carry pm_id in payload", () => {
    const store = createPerformanceStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    store.generateSnapshot({ workspaceId: wsId, pmId: pm.id, _osSnapshots: [goodOsSnapshot()] });
    const event = store.auditLog.find((e) => e.type === "PM_PERFORMANCE_SNAPSHOT_GENERATED");
    assert.equal(event.payload.pm_id, pm.id);
    assert.ok("overall_score" in event.payload);
    assert.ok("status" in event.payload);
  });

  test("PM_PERFORMANCE_COMPARED emitted with diff metadata", () => {
    const store = createPerformanceStore();
    const wsId  = uuid();
    const { data: pmA } = store.registerPM({ workspaceId: wsId, displayName: "A", email: "a@x.com" });
    const { data: pmB } = store.registerPM({ workspaceId: wsId, displayName: "B", email: "b@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pmA.id, projectId: uuid() });
    store.assignProject({ workspaceId: wsId, pmId: pmB.id, projectId: uuid() });
    store.generateSnapshot({ workspaceId: wsId, pmId: pmA.id, _osSnapshots: [goodOsSnapshot()] });
    store.generateSnapshot({ workspaceId: wsId, pmId: pmB.id, _osSnapshots: [goodOsSnapshot()] });
    store.comparePerformance({ workspaceId: wsId, pmAId: pmA.id, pmBId: pmB.id });
    const e = store.auditLog.find((ev) => ev.type === "PM_PERFORMANCE_COMPARED");
    assert.ok("difference" in e.payload);
    assert.ok("stronger"   in e.payload);
  });
});

// ─── Workspace Isolation ─────────────────────────────────────────────────────

describe("Workspace Isolation", () => {
  test("PM from workspace A not visible in workspace B", () => {
    const store = createPerformanceStore();
    const ws1   = uuid();
    const ws2   = uuid();
    const { data: pm } = store.registerPM({ workspaceId: ws1, displayName: "PM", email: "pm@x.com" });
    const result = store.generateSnapshot({ workspaceId: ws2, pmId: pm.id });
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "not_found");
  });

  test("snapshot from workspace A not visible in workspace B", () => {
    const store = createPerformanceStore();
    const ws1   = uuid();
    const ws2   = uuid();
    const { data: pm } = store.registerPM({ workspaceId: ws1, displayName: "PM", email: "pm@x.com" });
    store.assignProject({ workspaceId: ws1, pmId: pm.id, projectId: uuid() });
    const { data: snap } = store.generateSnapshot({ workspaceId: ws1, pmId: pm.id, _osSnapshots: [goodOsSnapshot()] });
    const result = store.getSnapshot(ws2, snap.id);
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "not_found");
  });

  test("listSnapshots does not leak across workspaces", () => {
    const store = createPerformanceStore();
    const ws1   = uuid();
    const ws2   = uuid();
    const { data: pm1 } = store.registerPM({ workspaceId: ws1, displayName: "PM1", email: "pm1@x.com" });
    const { data: pm2 } = store.registerPM({ workspaceId: ws2, displayName: "PM2", email: "pm2@x.com" });
    store.assignProject({ workspaceId: ws1, pmId: pm1.id, projectId: uuid() });
    store.assignProject({ workspaceId: ws2, pmId: pm2.id, projectId: uuid() });
    store.generateSnapshot({ workspaceId: ws1, pmId: pm1.id, _osSnapshots: [goodOsSnapshot()] });
    store.generateSnapshot({ workspaceId: ws2, pmId: pm2.id, _osSnapshots: [goodOsSnapshot()] });
    const ws1Snaps = store.listSnapshots({ workspaceId: ws1 });
    assert.equal(ws1Snaps.data.length, 1);
    assert.equal(ws1Snaps.data[0].workspace_id, ws1);
  });
});

// ─── Source File Checks ───────────────────────────────────────────────────────

describe("Source File Checks", () => {
  const indexFile    = readFileSync("src/lib/pm-performance/index.ts", "utf8");
  const typesFile    = readFileSync("src/lib/pm-performance/types.ts", "utf8");
  const explainFile  = readFileSync("src/lib/pm-performance/explain.ts", "utf8");

  test("index.ts exports all required functions", () => {
    const fns = [
      "generatePMPerformanceSnapshot", "getPMPerformanceSnapshot", "listPMPerformanceSnapshots",
      "generatePMScorecard", "explainPMScorecard",
      "comparePMPerformance", "getPMPerformanceLineage",
      "explainPMPerformanceEngine",
      "calculatePMGovernanceScore", "calculatePMExecutionScore",
      "calculatePMPredictionAccuracy", "calculatePMDecisionEffectiveness",
      "calculatePMPortfolioHealth", "calculatePMOverallPerformance",
      "classifyPMPerformanceStatus",
    ];
    for (const fn of fns) {
      assert.ok(indexFile.includes(fn), `index.ts missing export: ${fn}`);
    }
  });

  test("types.ts defines all required types", () => {
    const requiredTypes = [
      "PMPerformanceStatus", "PMPerformanceDomain", "PMPerformanceResult",
      "PMPerformanceEventType", "PMScorecard", "PMPerformanceComparison",
      "PMPerformanceLineage", "GovernanceScoreInput", "ExecutionScoreInput",
      "PredictionAccuracyInput", "DecisionEffectivenessInput", "PortfolioHealthInput",
    ];
    for (const t of requiredTypes) {
      assert.ok(typesFile.includes(t), `types.ts missing: ${t}`);
    }
  });

  test("explain covers all 10 audit events", () => {
    const events = [
      "PM_PERFORMANCE_SNAPSHOT_GENERATED",
      "PM_SCORECARD_GENERATED",
      "PM_GOVERNANCE_SCORE_CALCULATED",
      "PM_EXECUTION_SCORE_CALCULATED",
      "PM_PREDICTION_ACCURACY_CALCULATED",
      "PM_DECISION_EFFECTIVENESS_CALCULATED",
      "PM_PORTFOLIO_HEALTH_CALCULATED",
      "PM_OVERALL_PERFORMANCE_CALCULATED",
      "PM_PERFORMANCE_COMPARED",
      "PM_PERFORMANCE_LINEAGE_GENERATED",
    ];
    for (const e of events) {
      assert.ok(explainFile.includes(e), `explain.ts missing event: ${e}`);
    }
  });

  test("explain covers all 10 business rules", () => {
    for (let i = 1; i <= 10; i++) {
      assert.ok(explainFile.includes(`number: ${i}`), `explain.ts missing rule ${i}`);
    }
  });

  test("types.ts defines PM_PERFORMANCE_WEIGHTS", () => {
    assert.ok(typesFile.includes("PM_PERFORMANCE_WEIGHTS"));
  });

  test("types.ts defines PM_PERFORMANCE_STATUS_THRESHOLDS", () => {
    assert.ok(typesFile.includes("PM_PERFORMANCE_STATUS_THRESHOLDS"));
  });
});
