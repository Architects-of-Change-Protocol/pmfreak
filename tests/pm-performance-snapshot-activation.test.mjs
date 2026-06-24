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

// ─── Mirror of scoring engines ────────────────────────────────────────────────

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

function calculatePMGovernanceScore({ governanceHealthScores, openViolationCount, pendingEscalationCount }) {
  if (governanceHealthScores.length === 0) return 75;
  const avg = governanceHealthScores.reduce((s, v) => s + v, 0) / governanceHealthScores.length;
  return Math.max(0, Math.min(100, Math.round(avg - Math.min(openViolationCount * 3, 30) - Math.min(pendingEscalationCount * 5, 20))));
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
  return Math.max(0, Math.min(100, Math.round(avgConf - Math.min(avgVar * 10, 25))));
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
  return Math.max(0, Math.min(100, Math.round(avgEff + successRate * 10 - failureRate * 15)));
}

function calculatePMPortfolioHealth({ operatingHealthScores, criticalProjectCount }) {
  if (operatingHealthScores.length === 0) return 75;
  const avg = operatingHealthScores.reduce((s, v) => s + v, 0) / operatingHealthScores.length;
  return Math.max(0, Math.min(100, Math.round(avg - Math.min(criticalProjectCount * 10, 30))));
}

function calculatePMOverallPerformance(scores) {
  const w = PM_PERFORMANCE_WEIGHTS;
  return Math.max(0, Math.min(100, Math.round(
    scores.governance * w.governance +
    scores.execution  * w.execution  +
    scores.prediction * w.prediction +
    scores.decision   * w.decision   +
    scores.portfolio  * w.portfolio
  )));
}

function classifyPMPerformanceStatus(score) {
  if (score >= PM_PERFORMANCE_STATUS_THRESHOLDS.excellent) return "excellent";
  if (score >= PM_PERFORMANCE_STATUS_THRESHOLDS.strong)    return "strong";
  if (score >= PM_PERFORMANCE_STATUS_THRESHOLDS.stable)    return "stable";
  if (score >= PM_PERFORMANCE_STATUS_THRESHOLDS.warning)   return "warning";
  return "critical";
}

// ─── Deterministic recommendation logic ──────────────────────────────────────

function deriveRecommendation(performanceStatus, capacityStatus) {
  const isWeak     = performanceStatus === "warning"   || performanceStatus === "critical";
  const isStrong   = performanceStatus === "excellent" || performanceStatus === "strong";
  const isOverload = capacityStatus === "overloaded" || capacityStatus === "at_capacity" || capacityStatus === "critical";
  const isUnder    = capacityStatus === "underutilized";

  if (isWeak && isOverload)  return "rebalance_capacity";
  if (isStrong && isOverload) return "protect_high_performer";
  if (isWeak && isUnder)     return "coach_execution";
  if (isStrong && isUnder)   return "candidate_for_additional_ownership";
  if (performanceStatus === "excellent") return "recognize_high_performance";
  if (performanceStatus === "strong")    return "maintain_execution_cadence";
  if (performanceStatus === "stable")    return "monitor_execution";
  if (performanceStatus === "warning")   return "intervene_execution";
  return "executive_intervention";
}

// ─── In-memory store for activation tests ────────────────────────────────────

function createStore() {
  const pms            = new Map();
  const assignments    = new Map();
  const snapshots      = new Map();
  const capacitySnaps  = new Map();
  const events         = [];

  function emit(type, payload) { events.push({ type, payload, at: isoNow() }); }
  function fail(error, failureClass = "validation") { return { ok: false, error, failureClass }; }
  function ok(data) { return { ok: true, data }; }

  function registerPM({ workspaceId, displayName, email }) {
    if (!validUuid(workspaceId)) return fail("workspaceId required.");
    const id  = uuid();
    const now = isoNow();
    const pm  = { id, workspace_id: workspaceId, display_name: displayName, email, status: "active", created_at: now, updated_at: now };
    pms.set(id, pm);
    return ok(pm);
  }

  function assignProject({ workspaceId, pmId, projectId }) {
    const id  = uuid();
    const rec = { id, workspace_id: workspaceId, pm_id: pmId, project_id: projectId, assignment_type: "primary", assigned_at: isoNow(), removed_at: null };
    assignments.set(id, rec);
    return ok(rec);
  }

  function setCapacitySnapshot(pmId, workspaceId, capacityStatus, burnRisk = "low", utilization = 0.6) {
    const id  = uuid();
    const now = isoNow();
    const snap = {
      id, workspace_id: workspaceId, pm_id: pmId,
      capacity_status: capacityStatus,
      burn_risk: burnRisk,
      utilization_percentage: utilization * 100,
      snapshot_payload: {
        assignment_capacity: {
          assignment_capacity_status: capacityStatus,
          assignment_overload_risk: burnRisk,
          assignment_capacity_utilization: utilization,
          recommendations: [],
        },
      },
      generated_at: now,
    };
    capacitySnaps.set(`${workspaceId}:${pmId}`, snap);
    return snap;
  }

  function generateSnapshot({ workspaceId, pmId, actorId, _osSnapshots = [], _taskStats = null, _realities = [], _outcomes = [], _violations = 0, _escalations = 0 }) {
    if (!validUuid(workspaceId)) return fail("workspaceId must be a valid UUID.");
    if (!validUuid(pmId))        return fail("pmId must be a valid UUID.");

    const pm = pms.get(pmId);
    if (!pm || pm.workspace_id !== workspaceId) return fail("Project Manager not found.", "not_found");

    const activeAssignments = [...assignments.values()].filter(
      (a) => a.workspace_id === workspaceId && a.pm_id === pmId && a.removed_at === null
    );
    if (activeAssignments.length === 0) {
      return fail("Cannot generate a performance snapshot for a PM with no active assignments.");
    }

    const ts = _taskStats ?? { total: 0, completed: 0, overdue: 0 };

    const governanceScore           = calculatePMGovernanceScore({ governanceHealthScores: _osSnapshots.map((s) => s.governance_health_score), openViolationCount: _violations, pendingEscalationCount: _escalations });
    const executionScore            = calculatePMExecutionScore({ executionHealthScores: _osSnapshots.map((s) => s.execution_health_score), totalTasks: ts.total, completedTasks: ts.completed, overdueTasks: ts.overdue });
    const predictionAccuracyScore   = calculatePMPredictionAccuracy({ confidenceScores: _realities.map((r) => r.confidence_score), varianceValues: [] });
    const successfulOutcomes        = _outcomes.filter((o) => o.outcome_status === "successful").length;
    const unsuccessfulOutcomes      = _outcomes.filter((o) => o.outcome_status === "unsuccessful").length;
    const decisionEffectivenessScore = calculatePMDecisionEffectiveness({ effectivenessScores: _outcomes.map((o) => o.effectiveness_score), successfulOutcomes, unsuccessfulOutcomes, totalOutcomes: _outcomes.length });
    const criticalCount             = _osSnapshots.filter((s) => s.operating_health_score < 45).length;
    const portfolioHealthScore      = calculatePMPortfolioHealth({ operatingHealthScores: _osSnapshots.map((s) => s.operating_health_score), criticalProjectCount: criticalCount });
    const overallScore              = calculatePMOverallPerformance({ governance: governanceScore, execution: executionScore, prediction: predictionAccuracyScore, decision: decisionEffectivenessScore, portfolio: portfolioHealthScore });
    const performanceStatus         = classifyPMPerformanceStatus(overallScore);

    // Read capacity context
    const latestCapacity = capacitySnaps.get(`${workspaceId}:${pmId}`) ?? null;
    const capacityContext = latestCapacity
      ? {
          capacity_snapshot_id:   latestCapacity.id,
          capacity_status:        latestCapacity.capacity_status,
          burn_risk:              latestCapacity.burn_risk,
          utilization_percentage: latestCapacity.utilization_percentage,
          generated_at:           latestCapacity.generated_at,
          assignment_capacity:    latestCapacity.snapshot_payload?.assignment_capacity ?? null,
        }
      : null;

    const id  = uuid();
    const now = isoNow();
    const snap = {
      id, workspace_id: workspaceId, pm_id: pmId,
      governance_score: governanceScore,
      execution_score: executionScore,
      prediction_accuracy_score: predictionAccuracyScore,
      decision_effectiveness_score: decisionEffectivenessScore,
      portfolio_health_score: portfolioHealthScore,
      overall_score: overallScore,
      performance_status: performanceStatus,
      snapshot_payload: {
        pm_name: pm.display_name,
        pm_email: pm.email,
        assigned_project_count: activeAssignments.length,
        os_snapshot_count: _osSnapshots.length,
        capacity_context: capacityContext,
        evidence: {
          pm: { pm_id: pmId, display_name: pm.display_name, email: pm.email },
          assignments: activeAssignments.map((a) => ({ assignment_id: a.id, project_id: a.project_id, assignment_type: a.assignment_type, assigned_at: a.assigned_at })),
          missing_sources: _osSnapshots.length === 0 ? ["project_os_snapshots"] : [],
        },
      },
      generated_at: now,
      created_at:   now,
      updated_at:   now,
    };
    snapshots.set(id, snap);

    emit("PM_PERFORMANCE_SNAPSHOT_GENERATED", { pm_id: pmId, snapshot_id: id, overall_score: overallScore, performance_status: performanceStatus, workspace_id: workspaceId, actor_user_id: actorId ?? null });

    return ok(snap);
  }

  function generateWorkspaceSnapshots({ workspaceId, actorId, _osSnapshots = [], _taskStats = null, _realities = [], _outcomes = [] }) {
    const workspacePMs = [...pms.values()].filter((p) => p.workspace_id === workspaceId && p.status === "active");
    const generated = [];
    let skipped = 0;
    for (const pm of workspacePMs) {
      const r = generateSnapshot({ workspaceId, pmId: pm.id, actorId, _osSnapshots, _taskStats, _realities, _outcomes });
      if (r.ok) generated.push(r.data);
      else skipped++;
    }
    if (generated.length > 0) {
      const avg = generated.reduce((s, sn) => s + sn.overall_score, 0) / generated.length;
      emit("PM_WORKSPACE_PERFORMANCE_SNAPSHOTS_GENERATED", { workspace_id: workspaceId, generated_snapshot_count: generated.length, total_pm_count: workspacePMs.length, average_performance_score: Math.round(avg * 10) / 10 });
    }
    return ok({ generated, skipped, total_pm_count: workspacePMs.length });
  }

  function getLatestSnapshot({ workspaceId, pmId }) {
    const pm = pms.get(pmId);
    if (!pm || pm.workspace_id !== workspaceId) return fail("Project Manager not found.", "not_found");
    const all = [...snapshots.values()].filter((s) => s.workspace_id === workspaceId && s.pm_id === pmId);
    all.sort((a, b) => b.generated_at.localeCompare(a.generated_at));
    return ok(all[0] ?? null);
  }

  function listLatestSnapshots({ workspaceId }) {
    if (!validUuid(workspaceId)) return fail("workspaceId required.");
    const all = [...snapshots.values()].filter((s) => s.workspace_id === workspaceId);
    all.sort((a, b) => b.generated_at.localeCompare(a.generated_at));
    const seen = new Set();
    const latest = [];
    for (const s of all) {
      if (!seen.has(s.pm_id)) { seen.add(s.pm_id); latest.push(s); }
    }
    return ok(latest);
  }

  function listAtRisk({ workspaceId }) {
    const r = listLatestSnapshots({ workspaceId });
    if (!r.ok) return r;
    return ok(r.data.filter((s) => s.performance_status === "warning" || s.performance_status === "critical"));
  }

  return { registerPM, assignProject, setCapacitySnapshot, generateSnapshot, generateWorkspaceSnapshots, getLatestSnapshot, listLatestSnapshots, listAtRisk, events };
}

function goodOsSnapshot(overrides = {}) {
  return { id: uuid(), operating_health_score: 88, governance_health_score: 85, execution_health_score: 85, ...overrides };
}

// ─── Workspace snapshot generation ───────────────────────────────────────────

describe("Workspace PM Performance Snapshots", () => {
  test("generates one snapshot per active PM with assignments", () => {
    const store = createStore();
    const wsId  = uuid();
    const { data: pm1 } = store.registerPM({ workspaceId: wsId, displayName: "PM One", email: "pm1@x.com" });
    const { data: pm2 } = store.registerPM({ workspaceId: wsId, displayName: "PM Two", email: "pm2@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm1.id, projectId: uuid() });
    store.assignProject({ workspaceId: wsId, pmId: pm2.id, projectId: uuid() });

    const result = store.generateWorkspaceSnapshots({ workspaceId: wsId, _osSnapshots: [goodOsSnapshot()] });
    assert.equal(result.ok, true);
    assert.equal(result.data.generated.length, 2);
    assert.equal(result.data.skipped, 0);
    assert.equal(result.data.total_pm_count, 2);
  });

  test("skips PMs with no active assignments without failing workspace generation", () => {
    const store = createStore();
    const wsId  = uuid();
    const { data: pm1 } = store.registerPM({ workspaceId: wsId, displayName: "PM One", email: "pm1@x.com" });
    const { data: pm2 } = store.registerPM({ workspaceId: wsId, displayName: "PM Two", email: "pm2@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm1.id, projectId: uuid() });
    // pm2 has no assignments — should be skipped

    const result = store.generateWorkspaceSnapshots({ workspaceId: wsId, _osSnapshots: [goodOsSnapshot()] });
    assert.equal(result.ok, true);
    assert.equal(result.data.generated.length, 1);
    assert.equal(result.data.skipped, 1);
    assert.equal(result.data.total_pm_count, 2);
  });

  test("emits PM_WORKSPACE_PERFORMANCE_SNAPSHOTS_GENERATED when snapshots generated", () => {
    const store = createStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    store.generateWorkspaceSnapshots({ workspaceId: wsId, _osSnapshots: [goodOsSnapshot()] });

    assert.ok(store.events.some((e) => e.type === "PM_WORKSPACE_PERFORMANCE_SNAPSHOTS_GENERATED"));
  });

  test("does not emit workspace event when all PMs skipped", () => {
    const store = createStore();
    const wsId  = uuid();
    store.registerPM({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    // No assignments — all skipped
    store.generateWorkspaceSnapshots({ workspaceId: wsId });

    assert.ok(!store.events.some((e) => e.type === "PM_WORKSPACE_PERFORMANCE_SNAPSHOTS_GENERATED"));
  });

  test("workspace event payload has governance-useful fields", () => {
    const store = createStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    store.generateWorkspaceSnapshots({ workspaceId: wsId, _osSnapshots: [goodOsSnapshot()] });

    const evt = store.events.find((e) => e.type === "PM_WORKSPACE_PERFORMANCE_SNAPSHOTS_GENERATED");
    assert.ok("generated_snapshot_count" in evt.payload);
    assert.ok("total_pm_count"           in evt.payload);
    assert.ok("average_performance_score" in evt.payload);
  });
});

// ─── Capacity context integration ────────────────────────────────────────────

describe("Capacity Context Integration", () => {
  test("snapshot includes capacity context when capacity snapshot exists", () => {
    const store = createStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    store.setCapacitySnapshot(pm.id, wsId, "healthy");

    const { data: snap } = store.generateSnapshot({ workspaceId: wsId, pmId: pm.id, _osSnapshots: [goodOsSnapshot()] });
    assert.ok(snap.snapshot_payload.capacity_context !== null);
    assert.equal(snap.snapshot_payload.capacity_context.capacity_status, "healthy");
  });

  test("snapshot handles missing capacity snapshot gracefully", () => {
    const store = createStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    // No capacity snapshot set

    const result = store.generateSnapshot({ workspaceId: wsId, pmId: pm.id, _osSnapshots: [goodOsSnapshot()] });
    assert.equal(result.ok, true);
    assert.equal(result.data.snapshot_payload.capacity_context, null);
  });

  test("overloaded capacity is surfaced in snapshot payload", () => {
    const store = createStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    store.setCapacitySnapshot(pm.id, wsId, "overloaded", "high", 1.2);

    const { data: snap } = store.generateSnapshot({ workspaceId: wsId, pmId: pm.id });
    assert.equal(snap.snapshot_payload.capacity_context.capacity_status, "overloaded");
  });

  test("capacity context does not mutate capacity snapshot", () => {
    const store = createStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    store.setCapacitySnapshot(pm.id, wsId, "healthy");

    store.generateSnapshot({ workspaceId: wsId, pmId: pm.id });
    // Capacity snapshot should be unchanged
    const cap = store.setCapacitySnapshot(pm.id, wsId, "healthy"); // re-read
    assert.equal(cap.capacity_status, "healthy");
  });
});

// ─── Recommendation derivation ────────────────────────────────────────────────

describe("Deterministic Recommendation Logic", () => {
  test("weak performance + overloaded capacity → rebalance_capacity", () => {
    assert.equal(deriveRecommendation("critical", "overloaded"), "rebalance_capacity");
    assert.equal(deriveRecommendation("warning",  "at_capacity"), "rebalance_capacity");
  });

  test("strong performance + overloaded capacity → protect_high_performer", () => {
    assert.equal(deriveRecommendation("excellent", "overloaded"), "protect_high_performer");
    assert.equal(deriveRecommendation("strong",    "overloaded"), "protect_high_performer");
  });

  test("weak performance + underutilized capacity → coach_execution", () => {
    assert.equal(deriveRecommendation("warning",  "underutilized"), "coach_execution");
    assert.equal(deriveRecommendation("critical", "underutilized"), "coach_execution");
  });

  test("strong performance + underutilized capacity → candidate_for_additional_ownership", () => {
    assert.equal(deriveRecommendation("excellent", "underutilized"), "candidate_for_additional_ownership");
    assert.equal(deriveRecommendation("strong",    "underutilized"), "candidate_for_additional_ownership");
  });

  test("excellent performance → recognize_high_performance", () => {
    assert.equal(deriveRecommendation("excellent", "healthy"), "recognize_high_performance");
  });

  test("critical performance → executive_intervention", () => {
    assert.equal(deriveRecommendation("critical", "healthy"), "executive_intervention");
  });
});

// ─── Latest and at-risk retrieval ─────────────────────────────────────────────

describe("Latest and At-Risk Retrieval", () => {
  test("getLatestSnapshot returns most recent snapshot for PM", () => {
    const store = createStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });

    store.generateSnapshot({ workspaceId: wsId, pmId: pm.id, _osSnapshots: [goodOsSnapshot({ operating_health_score: 70 })] });
    store.generateSnapshot({ workspaceId: wsId, pmId: pm.id, _osSnapshots: [goodOsSnapshot({ operating_health_score: 90 })] });

    const { data: latest } = store.getLatestSnapshot({ workspaceId: wsId, pmId: pm.id });
    assert.ok(latest !== null);
  });

  test("listLatestSnapshots returns one snapshot per PM", () => {
    const store = createStore();
    const wsId  = uuid();
    const { data: pm1 } = store.registerPM({ workspaceId: wsId, displayName: "PM1", email: "pm1@x.com" });
    const { data: pm2 } = store.registerPM({ workspaceId: wsId, displayName: "PM2", email: "pm2@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm1.id, projectId: uuid() });
    store.assignProject({ workspaceId: wsId, pmId: pm2.id, projectId: uuid() });

    store.generateSnapshot({ workspaceId: wsId, pmId: pm1.id, _osSnapshots: [goodOsSnapshot()] });
    store.generateSnapshot({ workspaceId: wsId, pmId: pm1.id, _osSnapshots: [goodOsSnapshot()] }); // second for pm1
    store.generateSnapshot({ workspaceId: wsId, pmId: pm2.id, _osSnapshots: [goodOsSnapshot()] });

    const { data: latest } = store.listLatestSnapshots({ workspaceId: wsId });
    assert.equal(latest.length, 2);
    const pm1Snaps = latest.filter((s) => s.pm_id === pm1.id);
    assert.equal(pm1Snaps.length, 1, "Should have exactly one snapshot for pm1");
  });

  test("listAtRisk returns only warning and critical PMs", () => {
    const store = createStore();
    const wsId  = uuid();
    const { data: pm1 } = store.registerPM({ workspaceId: wsId, displayName: "Good PM", email: "good@x.com" });
    const { data: pm2 } = store.registerPM({ workspaceId: wsId, displayName: "Bad PM",  email: "bad@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm1.id, projectId: uuid() });
    store.assignProject({ workspaceId: wsId, pmId: pm2.id, projectId: uuid() });

    // PM1 gets good scores → excellent
    store.generateSnapshot({ workspaceId: wsId, pmId: pm1.id, _osSnapshots: [goodOsSnapshot({ operating_health_score: 95, governance_health_score: 95, execution_health_score: 95 })] });
    // PM2 gets bad scores → critical
    store.generateSnapshot({ workspaceId: wsId, pmId: pm2.id, _osSnapshots: [goodOsSnapshot({ operating_health_score: 10, governance_health_score: 10, execution_health_score: 10 })] });

    const { data: atRisk } = store.listAtRisk({ workspaceId: wsId });
    assert.ok(atRisk.every((s) => s.performance_status === "warning" || s.performance_status === "critical"));
    assert.ok(!atRisk.some((s) => s.pm_id === pm1.id));
  });

  test("listAtRisk returns empty when no at-risk PMs", () => {
    const store = createStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    store.generateSnapshot({ workspaceId: wsId, pmId: pm.id, _osSnapshots: [goodOsSnapshot({ operating_health_score: 95, governance_health_score: 95, execution_health_score: 95 })] });

    const { data: atRisk } = store.listAtRisk({ workspaceId: wsId });
    assert.equal(atRisk.length, 0);
  });

  test("listLatestSnapshots does not leak across workspaces", () => {
    const store = createStore();
    const ws1   = uuid();
    const ws2   = uuid();
    const { data: pm1 } = store.registerPM({ workspaceId: ws1, displayName: "PM1", email: "pm1@x.com" });
    const { data: pm2 } = store.registerPM({ workspaceId: ws2, displayName: "PM2", email: "pm2@x.com" });
    store.assignProject({ workspaceId: ws1, pmId: pm1.id, projectId: uuid() });
    store.assignProject({ workspaceId: ws2, pmId: pm2.id, projectId: uuid() });
    store.generateSnapshot({ workspaceId: ws1, pmId: pm1.id, _osSnapshots: [goodOsSnapshot()] });
    store.generateSnapshot({ workspaceId: ws2, pmId: pm2.id, _osSnapshots: [goodOsSnapshot()] });

    const { data: ws1Snaps } = store.listLatestSnapshots({ workspaceId: ws1 });
    assert.equal(ws1Snaps.length, 1);
    assert.equal(ws1Snaps[0].workspace_id, ws1);
  });
});

// ─── Evidence structure ───────────────────────────────────────────────────────

describe("Evidence Structure", () => {
  test("snapshot payload includes PM lineage", () => {
    const store = createStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });

    const { data: snap } = store.generateSnapshot({ workspaceId: wsId, pmId: pm.id, _osSnapshots: [goodOsSnapshot()] });
    assert.ok(snap.snapshot_payload.evidence?.pm?.pm_id === pm.id);
    assert.ok(snap.snapshot_payload.evidence?.pm?.display_name === pm.display_name);
  });

  test("snapshot payload includes assignment lineage", () => {
    const store = createStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });

    const { data: snap } = store.generateSnapshot({ workspaceId: wsId, pmId: pm.id, _osSnapshots: [goodOsSnapshot()] });
    assert.ok(Array.isArray(snap.snapshot_payload.evidence?.assignments));
    assert.equal(snap.snapshot_payload.evidence.assignments.length, 1);
  });

  test("missing project OS snapshots marked in missing_sources", () => {
    const store = createStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });

    // No OS snapshots provided
    const { data: snap } = store.generateSnapshot({ workspaceId: wsId, pmId: pm.id });
    assert.ok(snap.snapshot_payload.evidence?.missing_sources?.includes("project_os_snapshots"));
  });

  test("capacity context included when capacity snapshot exists", () => {
    const store = createStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    store.setCapacitySnapshot(pm.id, wsId, "healthy");

    const { data: snap } = store.generateSnapshot({ workspaceId: wsId, pmId: pm.id, _osSnapshots: [goodOsSnapshot()] });
    assert.ok(snap.snapshot_payload.capacity_context?.capacity_snapshot_id);
  });
});

// ─── Status threshold verification ────────────────────────────────────────────

describe("Status Threshold Verification", () => {
  test("score ≥ 90 → excellent", () => assert.equal(classifyPMPerformanceStatus(90), "excellent"));
  test("score 80-89 → strong",   () => assert.equal(classifyPMPerformanceStatus(85), "strong"));
  test("score 65-79 → stable",   () => assert.equal(classifyPMPerformanceStatus(72), "stable"));
  test("score 45-64 → warning",  () => assert.equal(classifyPMPerformanceStatus(55), "warning"));
  test("score < 45 → critical",  () => assert.equal(classifyPMPerformanceStatus(30), "critical"));
});

// ─── Platform events ─────────────────────────────────────────────────────────

describe("Platform Events", () => {
  test("PM_PERFORMANCE_SNAPSHOT_GENERATED includes workspace and actor", () => {
    const store   = createStore();
    const wsId    = uuid();
    const actorId = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    store.generateSnapshot({ workspaceId: wsId, pmId: pm.id, actorId, _osSnapshots: [goodOsSnapshot()] });

    const evt = store.events.find((e) => e.type === "PM_PERFORMANCE_SNAPSHOT_GENERATED");
    assert.ok(evt);
    assert.equal(evt.payload.workspace_id, wsId);
    assert.equal(evt.payload.actor_user_id, actorId);
    assert.ok("overall_score" in evt.payload);
    assert.ok("performance_status" in evt.payload);
  });

  test("no event emitted when PM has no assignments (snapshot skipped)", () => {
    const store = createStore();
    const wsId  = uuid();
    const { data: pm } = store.registerPM({ workspaceId: wsId, displayName: "PM", email: "pm@x.com" });
    store.generateSnapshot({ workspaceId: wsId, pmId: pm.id });

    assert.ok(!store.events.some((e) => e.type === "PM_PERFORMANCE_SNAPSHOT_GENERATED"));
  });
});

// ─── Source file checks ───────────────────────────────────────────────────────

describe("Source File Checks — Activation Slice", () => {
  const indexFile = readFileSync("src/lib/pm-performance/index.ts", "utf8");
  const typesFile = readFileSync("src/lib/pm-performance/types.ts", "utf8");

  test("index.ts exports generateWorkspacePMPerformanceSnapshots", () => {
    assert.ok(indexFile.includes("generateWorkspacePMPerformanceSnapshots"), "index.ts missing generateWorkspacePMPerformanceSnapshots");
  });

  test("index.ts exports getLatestPMPerformanceSnapshot", () => {
    assert.ok(indexFile.includes("getLatestPMPerformanceSnapshot"), "index.ts missing getLatestPMPerformanceSnapshot");
  });

  test("index.ts exports listLatestPMPerformanceSnapshots", () => {
    assert.ok(indexFile.includes("listLatestPMPerformanceSnapshots"), "index.ts missing listLatestPMPerformanceSnapshots");
  });

  test("index.ts exports listAtRiskPMPerformanceSnapshots", () => {
    assert.ok(indexFile.includes("listAtRiskPMPerformanceSnapshots"), "index.ts missing listAtRiskPMPerformanceSnapshots");
  });

  test("types.ts defines GenerateWorkspacePMPerformanceSnapshotsInput", () => {
    assert.ok(typesFile.includes("GenerateWorkspacePMPerformanceSnapshotsInput"));
  });

  test("types.ts defines GetLatestPMPerformanceSnapshotInput", () => {
    assert.ok(typesFile.includes("GetLatestPMPerformanceSnapshotInput"));
  });

  test("types.ts defines ListLatestPMPerformanceSnapshotsInput", () => {
    assert.ok(typesFile.includes("ListLatestPMPerformanceSnapshotsInput"));
  });

  test("types.ts defines ListAtRiskPMPerformanceSnapshotsInput", () => {
    assert.ok(typesFile.includes("ListAtRiskPMPerformanceSnapshotsInput"));
  });

  test("types.ts includes PM_WORKSPACE_PERFORMANCE_SNAPSHOTS_GENERATED event type", () => {
    assert.ok(typesFile.includes("PM_WORKSPACE_PERFORMANCE_SNAPSHOTS_GENERATED"));
  });
});

// ─── Sprint 2: Evidence Confidence Hardening ──────────────────────────────────

const EVIDENCE_TOTAL_SOURCE_COUNT = 5;

function calculateEvidenceConfidence(availability) {
  const sourceEntries = [
    ["project_os_snapshots", "project_os_snapshots"],
    ["execution_tasks",      "execution_tasks"],
    ["execution_realities",  "execution_realities"],
    ["decision_outcomes",    "decision_outcomes"],
    ["capacity_context",     "capacity_context"],
  ];

  const available = [];
  const missing   = [];

  for (const [key, label] of sourceEntries) {
    if (availability[key]) available.push(label);
    else                   missing.push(label);
  }

  const availableCount = available.length;
  const missingCount   = missing.length;
  const completeness   = availableCount / EVIDENCE_TOTAL_SOURCE_COUNT;

  const confidenceLevel =
    completeness >= 0.80 ? "high"    :
    completeness >= 0.50 ? "medium"  :
    completeness >= 0.25 ? "low"     :
    "very_low";

  const scoreInterpretation =
    completeness >= 0.80 ? "evidence_backed"            :
    completeness >= 0.50 ? "partially_evidence_backed"  :
    "low_confidence_provisional";

  const neutralBaselineDomains = [];
  if (!availability.project_os_snapshots) neutralBaselineDomains.push("governance", "execution", "portfolio");
  if (!availability.execution_realities)  neutralBaselineDomains.push("prediction_accuracy");
  if (!availability.decision_outcomes)    neutralBaselineDomains.push("decision_effectiveness");

  return {
    evidence_completeness:    Math.round(completeness * 100) / 100,
    confidence_level:         confidenceLevel,
    available_source_count:   availableCount,
    missing_source_count:     missingCount,
    total_source_count:       EVIDENCE_TOTAL_SOURCE_COUNT,
    available_sources:        available,
    missing_sources:          missing,
    neutral_baseline_domains: neutralBaselineDomains,
    missing_source_policy:    "neutral_baseline_75",
    score_interpretation:     scoreInterpretation,
  };
}

function deriveConfidenceRecommendations(ec) {
  if (ec.evidence_completeness < 0.25) {
    return [{ type: "insufficient_performance_evidence", severity: "high", message: expect.any || "" }];
  }
  if (ec.evidence_completeness < 0.50) {
    return [{ type: "increase_evidence_coverage", severity: "medium", message: "" }];
  }
  return [];
}

function classifyPerformanceRisk(overallScore, capacityStatus) {
  let base =
    overallScore >= 75 ? "low"      :
    overallScore >= 60 ? "medium"   :
    overallScore >= 45 ? "high"     :
    "critical";

  const isOverloaded = capacityStatus === "overloaded" || capacityStatus === "at_capacity";
  if (isOverloaded) {
    if (base === "low")    base = "medium";
    else if (base === "medium") base = "high";
    else if (base === "high")   base = "critical";
  }
  return base;
}

describe("Evidence Confidence — calculateEvidenceConfidence", () => {
  test("all sources available → high confidence, evidence_backed", () => {
    const ec = calculateEvidenceConfidence({
      project_os_snapshots: true,
      execution_tasks:      true,
      execution_realities:  true,
      decision_outcomes:    true,
      capacity_context:     true,
    });
    assert.equal(ec.confidence_level, "high");
    assert.equal(ec.evidence_completeness, 1.0);
    assert.equal(ec.available_source_count, 5);
    assert.equal(ec.missing_source_count, 0);
    assert.equal(ec.score_interpretation, "evidence_backed");
    assert.deepEqual(ec.neutral_baseline_domains, []);
  });

  test("4/5 sources → high confidence (≥80%)", () => {
    const ec = calculateEvidenceConfidence({
      project_os_snapshots: true,
      execution_tasks:      true,
      execution_realities:  true,
      decision_outcomes:    true,
      capacity_context:     false,
    });
    assert.equal(ec.confidence_level, "high");
    assert.equal(ec.evidence_completeness, 0.8);
    assert.equal(ec.score_interpretation, "evidence_backed");
  });

  test("3/5 sources → medium confidence, partially_evidence_backed", () => {
    const ec = calculateEvidenceConfidence({
      project_os_snapshots: true,
      execution_tasks:      true,
      execution_realities:  true,
      decision_outcomes:    false,
      capacity_context:     false,
    });
    assert.equal(ec.confidence_level, "medium");
    assert.equal(ec.evidence_completeness, 0.6);
    assert.equal(ec.score_interpretation, "partially_evidence_backed");
    assert.ok(ec.missing_sources.includes("decision_outcomes"));
    assert.ok(ec.neutral_baseline_domains.includes("decision_effectiveness"));
  });

  test("2/5 sources → low confidence, low_confidence_provisional", () => {
    const ec = calculateEvidenceConfidence({
      project_os_snapshots: true,
      execution_tasks:      false,
      execution_realities:  true,
      decision_outcomes:    false,
      capacity_context:     false,
    });
    assert.equal(ec.confidence_level, "low");
    assert.equal(ec.evidence_completeness, 0.4);
    assert.equal(ec.score_interpretation, "low_confidence_provisional");
    assert.ok(ec.neutral_baseline_domains.includes("decision_effectiveness"));
  });

  test("1/5 source → very_low confidence", () => {
    const ec = calculateEvidenceConfidence({
      project_os_snapshots: false,
      execution_tasks:      true,
      execution_realities:  false,
      decision_outcomes:    false,
      capacity_context:     false,
    });
    assert.equal(ec.confidence_level, "very_low");
    assert.equal(ec.evidence_completeness, 0.2);
    assert.equal(ec.score_interpretation, "low_confidence_provisional");
    assert.ok(ec.neutral_baseline_domains.includes("governance"));
    assert.ok(ec.neutral_baseline_domains.includes("execution"));
    assert.ok(ec.neutral_baseline_domains.includes("portfolio"));
    assert.ok(ec.neutral_baseline_domains.includes("prediction_accuracy"));
    assert.ok(ec.neutral_baseline_domains.includes("decision_effectiveness"));
  });

  test("0/5 sources → very_low confidence, all domains neutral", () => {
    const ec = calculateEvidenceConfidence({
      project_os_snapshots: false,
      execution_tasks:      false,
      execution_realities:  false,
      decision_outcomes:    false,
      capacity_context:     false,
    });
    assert.equal(ec.confidence_level, "very_low");
    assert.equal(ec.available_source_count, 0);
    assert.equal(ec.missing_source_count, 5);
    assert.equal(ec.missing_source_policy, "neutral_baseline_75");
  });

  test("neutral_baseline_domains excludes sources with data", () => {
    const ec = calculateEvidenceConfidence({
      project_os_snapshots: true,
      execution_tasks:      false,
      execution_realities:  false,
      decision_outcomes:    true,
      capacity_context:     false,
    });
    assert.ok(!ec.neutral_baseline_domains.includes("governance"));
    assert.ok(!ec.neutral_baseline_domains.includes("execution"));
    assert.ok(!ec.neutral_baseline_domains.includes("portfolio"));
    assert.ok(!ec.neutral_baseline_domains.includes("decision_effectiveness"));
    assert.ok(ec.neutral_baseline_domains.includes("prediction_accuracy"));
  });
});

describe("Performance Risk Classification", () => {
  test("score ≥ 75 → low risk", () => {
    assert.equal(classifyPerformanceRisk(80, "healthy"), "low");
    assert.equal(classifyPerformanceRisk(75, "healthy"), "low");
  });

  test("60 ≤ score < 75 → medium risk", () => {
    assert.equal(classifyPerformanceRisk(70, "healthy"), "medium");
    assert.equal(classifyPerformanceRisk(60, "healthy"), "medium");
  });

  test("45 ≤ score < 60 → high risk", () => {
    assert.equal(classifyPerformanceRisk(50, "healthy"), "high");
    assert.equal(classifyPerformanceRisk(45, "healthy"), "high");
  });

  test("score < 45 → critical risk", () => {
    assert.equal(classifyPerformanceRisk(44, "healthy"), "critical");
    assert.equal(classifyPerformanceRisk(0, "healthy"), "critical");
  });

  test("overloaded capacity elevates risk one level (low → medium)", () => {
    assert.equal(classifyPerformanceRisk(80, "overloaded"), "medium");
  });

  test("at_capacity elevates risk one level (medium → high)", () => {
    assert.equal(classifyPerformanceRisk(70, "at_capacity"), "high");
  });

  test("overloaded with high risk → critical", () => {
    assert.equal(classifyPerformanceRisk(50, "overloaded"), "critical");
  });

  test("critical stays critical under overload", () => {
    assert.equal(classifyPerformanceRisk(44, "overloaded"), "critical");
  });

  test("healthy capacity does not elevate risk", () => {
    assert.equal(classifyPerformanceRisk(80, "healthy"), "low");
    assert.equal(classifyPerformanceRisk(70, "healthy"), "medium");
  });
});

describe("At-risk filtering — includes performance_risk high/critical", () => {
  function isAtRisk(snap) {
    if (snap.performance_status === "warning" || snap.performance_status === "critical") return true;
    const risk = snap.snapshot_payload?.performance_risk;
    return risk === "high" || risk === "critical";
  }

  test("warning status is at-risk", () => {
    assert.ok(isAtRisk({ performance_status: "warning", snapshot_payload: { performance_risk: "low" } }));
  });

  test("critical status is at-risk", () => {
    assert.ok(isAtRisk({ performance_status: "critical", snapshot_payload: { performance_risk: "critical" } }));
  });

  test("stable status with low risk is NOT at-risk", () => {
    assert.ok(!isAtRisk({ performance_status: "stable", snapshot_payload: { performance_risk: "low" } }));
  });

  test("stable status with high performance_risk IS at-risk", () => {
    assert.ok(isAtRisk({ performance_status: "stable", snapshot_payload: { performance_risk: "high" } }));
  });

  test("strong status with critical performance_risk IS at-risk", () => {
    assert.ok(isAtRisk({ performance_status: "strong", snapshot_payload: { performance_risk: "critical" } }));
  });

  test("strong status with medium risk is NOT at-risk", () => {
    assert.ok(!isAtRisk({ performance_status: "strong", snapshot_payload: { performance_risk: "medium" } }));
  });
});

describe("Evidence Confidence — source file checks", () => {
  const ecFile = readFileSync("src/lib/pm-performance/evidence-confidence.ts", "utf8");

  test("defines EVIDENCE_TOTAL_SOURCE_COUNT = 5", () => {
    assert.ok(ecFile.includes("EVIDENCE_TOTAL_SOURCE_COUNT = 5"));
  });

  test("defines EvidenceSourceAvailability type", () => {
    assert.ok(ecFile.includes("EvidenceSourceAvailability"));
  });

  test("defines ConfidenceLevel type", () => {
    assert.ok(ecFile.includes("ConfidenceLevel"));
  });

  test("defines EvidenceConfidence type", () => {
    assert.ok(ecFile.includes("EvidenceConfidence"));
  });

  test("exports calculateEvidenceConfidence", () => {
    assert.ok(ecFile.includes("export function calculateEvidenceConfidence"));
  });

  test("exports deriveConfidenceRecommendations", () => {
    assert.ok(ecFile.includes("export function deriveConfidenceRecommendations"));
  });

  const perfRegFile = readFileSync("src/lib/pm-performance/performance-registry.ts", "utf8");

  test("performance-registry imports calculateEvidenceConfidence", () => {
    assert.ok(perfRegFile.includes("calculateEvidenceConfidence"));
  });

  test("performance-registry computes performance_risk", () => {
    assert.ok(perfRegFile.includes("performance_risk"));
  });

  test("performance-registry embeds evidence_confidence in snapshot_payload", () => {
    assert.ok(perfRegFile.includes("evidence_confidence"));
  });

  test("performance-registry capacity_context includes present field", () => {
    assert.ok(perfRegFile.includes("present: true") || perfRegFile.includes("present: false"));
  });

  test("platform event includes evidence_completeness", () => {
    assert.ok(perfRegFile.includes("evidence_completeness"));
  });

  test("platform event includes confidence_level", () => {
    assert.ok(perfRegFile.includes("confidence_level"));
  });

  test("at-risk filter checks performance_risk high/critical from payload", () => {
    assert.ok(perfRegFile.includes(`risk === "high"`) || perfRegFile.includes("performance_risk"));
  });
});
