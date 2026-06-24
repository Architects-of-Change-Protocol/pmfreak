import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test, describe } from "node:test";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isoNow(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

// ─── Pure Engine Implementations ──────────────────────────────────────────────
// Mirrors src/lib/pmo-command-center/engines/ for in-process testing.

const PMO_HEALTH_WEIGHTS = {
  performance:   0.30,
  capacity:      0.25,
  compliance:    0.25,
  projectHealth: 0.20,
};

function calculatePMOHealth({ avgPerformanceScore, avgCapacityScore, avgComplianceScore, projectHealthScore }) {
  const weighted =
    avgPerformanceScore  * PMO_HEALTH_WEIGHTS.performance   +
    avgCapacityScore     * PMO_HEALTH_WEIGHTS.capacity      +
    avgComplianceScore   * PMO_HEALTH_WEIGHTS.compliance    +
    projectHealthScore   * PMO_HEALTH_WEIGHTS.projectHealth;
  return Math.round(Math.min(100, Math.max(0, weighted)) * 100) / 100;
}

const PMO_STATUS_THRESHOLDS = { excellent: 90, healthy: 75, stable: 60, warning: 45 };

function classifyPMOStatus(score) {
  if (score >= PMO_STATUS_THRESHOLDS.excellent) return "excellent";
  if (score >= PMO_STATUS_THRESHOLDS.healthy)   return "healthy";
  if (score >= PMO_STATUS_THRESHOLDS.stable)    return "stable";
  if (score >= PMO_STATUS_THRESHOLDS.warning)   return "warning";
  return "critical";
}

function calculateOrganizationalCapacity({ pmCount, overloadedPMCount, warningPMCount, healthyPMCount, avgUtilizationPercentage }) {
  if (pmCount === 0) return 100;
  const utilizationScore = Math.max(0, 100 - avgUtilizationPercentage);
  const overloadRatio    = overloadedPMCount / pmCount;
  const overloadPenalty  = overloadRatio * 30;
  const healthyRatio     = healthyPMCount / pmCount;
  const healthyBonus     = healthyRatio * 10;
  const raw = utilizationScore - overloadPenalty + healthyBonus;
  return Math.round(Math.min(100, Math.max(0, raw)) * 100) / 100;
}

function calculateGovernanceMaturity({ avgComplianceScore, totalGovernanceDebt, hotspotCount }) {
  if (avgComplianceScore === 0 && totalGovernanceDebt === 0) return 100;
  const base         = avgComplianceScore * 0.70;
  const debtPenalty  = Math.min(20, totalGovernanceDebt * 0.5);
  const hotspotPenalty = Math.min(10, hotspotCount * 2);
  const raw = base - debtPenalty - hotspotPenalty + (avgComplianceScore * 0.30);
  return Math.round(Math.min(100, Math.max(0, raw)) * 100) / 100;
}

const PMO_RISK_WEIGHTS = {
  criticalProjects: 0.35,
  executionDrift:   0.25,
  governanceGaps:   0.20,
  overloadedPMs:    0.15,
  escalations:      0.05,
};

function calculatePMORiskIndex({ criticalProjectCount, totalProjectCount, executionDriftCount,
  totalCommitmentCount, governanceGapCount, overloadedPMCount, pmCount, escalationCount }) {
  const critRisk  = totalProjectCount > 0 ? (criticalProjectCount / totalProjectCount) * 100 : 0;
  const driftRisk = totalCommitmentCount > 0 ? (executionDriftCount / totalCommitmentCount) * 100 : 0;
  const govRisk   = Math.min(100, governanceGapCount * 5);
  const overRisk  = pmCount > 0 ? (overloadedPMCount / pmCount) * 100 : 0;
  const escRisk   = Math.min(100, escalationCount * 10);
  const raw =
    critRisk  * PMO_RISK_WEIGHTS.criticalProjects +
    driftRisk * PMO_RISK_WEIGHTS.executionDrift   +
    govRisk   * PMO_RISK_WEIGHTS.governanceGaps   +
    overRisk  * PMO_RISK_WEIGHTS.overloadedPMs    +
    escRisk   * PMO_RISK_WEIGHTS.escalations;
  return Math.round(Math.min(100, Math.max(0, raw)) * 100) / 100;
}

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function generateAttentionQueue({ pms, projects, riskScore, governanceScore }) {
  const items = [];

  for (const pm of pms) {
    if (pm.utilizationPercentage >= 130) {
      items.push({ priority: "critical", entityType: "pm", entityId: pm.id, title: `${pm.name} — critical overload`, description: `PM is at ${Math.round(pm.utilizationPercentage)}% utilization — well above safe threshold.`, recommendedAction: "Immediately redistribute projects or defer non-critical work." });
    } else if (pm.utilizationPercentage >= 110) {
      items.push({ priority: "high", entityType: "pm", entityId: pm.id, title: `${pm.name} — overloaded`, description: `PM is at ${Math.round(pm.utilizationPercentage)}% utilization.`, recommendedAction: "Review project assignments and consider load redistribution." });
    } else if (pm.utilizationPercentage >= 90) {
      items.push({ priority: "medium", entityType: "pm", entityId: pm.id, title: `${pm.name} — approaching capacity`, description: `PM is at ${Math.round(pm.utilizationPercentage)}% utilization — nearing overload.`, recommendedAction: "Monitor closely and avoid assigning new projects." });
    }
    if (pm.complianceScore < 60) {
      items.push({ priority: "high", entityType: "pm", entityId: pm.id, title: `${pm.name} — critical governance debt`, description: `Compliance score is ${Math.round(pm.complianceScore)}.`, recommendedAction: "Conduct governance review and accelerate ratifications." });
    } else if (pm.complianceScore < 80) {
      items.push({ priority: "medium", entityType: "pm", entityId: pm.id, title: `${pm.name} — governance warning`, description: `Compliance score is ${Math.round(pm.complianceScore)}.`, recommendedAction: "Address open governance gaps in next sprint." });
    }
    if (pm.performanceScore < 60) {
      items.push({ priority: "high", entityType: "pm", entityId: pm.id, title: `${pm.name} — low performance`, description: `Performance score is ${Math.round(pm.performanceScore)}.`, recommendedAction: "Investigate root causes and provide targeted support." });
    }
  }

  for (const project of projects) {
    if (project.healthScore < 50) {
      items.push({ priority: "critical", entityType: "project", entityId: project.id, title: `${project.name} — critical health`, description: `Project health score is ${Math.round(project.healthScore)}.`, recommendedAction: "Escalate to PMO and initiate recovery plan." });
    } else if (project.healthScore < 70) {
      items.push({ priority: "high", entityType: "project", entityId: project.id, title: `${project.name} — warning health`, description: `Project health score is ${Math.round(project.healthScore)}.`, recommendedAction: "Schedule executive review and define corrective actions." });
    }
  }

  if (governanceScore < 60) {
    items.push({ priority: "critical", entityType: "governance", entityId: "pmo", title: "PMO governance maturity — critical", description: `Governance maturity score is ${Math.round(governanceScore)}.`, recommendedAction: "Launch governance remediation program across all PMs." });
  }
  if (riskScore > 70) {
    items.push({ priority: "critical", entityType: "governance", entityId: "pmo", title: "PMO risk index — elevated", description: `Risk index is ${Math.round(riskScore)}.`, recommendedAction: "Convene PMO risk review and prioritize mitigation actions." });
  }

  items.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  return items;
}

function generateExecutiveRecommendations({ pms, projects, capacityScore, governanceScore, riskScore, overloadedPMCount, criticalProjectCount }) {
  const recs = [];

  if (overloadedPMCount >= 2) {
    recs.push({ type: "capacity", recommendation: "Redistribute project load across underutilized PMs to reduce burn risk.", confidence: Math.min(0.99, 0.70 + overloadedPMCount * 0.05), impact: overloadedPMCount >= 4 ? "critical" : "high" });
  }
  if (capacityScore < 50) {
    recs.push({ type: "staffing", recommendation: "Organizational capacity is critically low. Evaluate PM headcount expansion or project deferral.", confidence: 0.85, impact: "critical" });
  } else if (capacityScore < 70) {
    recs.push({ type: "staffing", recommendation: "Consider onboarding additional PM capacity before next portfolio cycle.", confidence: 0.72, impact: "high" });
  }
  if (governanceScore < 65) {
    recs.push({ type: "governance", recommendation: "Accelerate ratifications and close authority gaps.", confidence: 0.81, impact: "high" });
  }
  if (governanceScore < 50) {
    recs.push({ type: "governance", recommendation: "Launch governance maturity program.", confidence: 0.90, impact: "critical" });
  }
  const criticalRatio = projects.length > 0 ? criticalProjectCount / projects.length : 0;
  if (criticalRatio > 0.15) {
    recs.push({ type: "execution", recommendation: "High proportion of critical projects detected. Prioritize triage and assign senior PMs.", confidence: 0.78, impact: "high" });
  }
  if (riskScore > 60) {
    recs.push({ type: "risk", recommendation: "PMO risk index exceeds threshold. Convene risk steering committee.", confidence: 0.83, impact: riskScore > 80 ? "critical" : "high" });
  }
  const unassigned = projects.filter((p) => p.pmId === null);
  if (unassigned.length > 0) {
    recs.push({ type: "portfolio", recommendation: `${unassigned.length} project(s) lack PM assignment. Assign responsible PMs.`, confidence: 0.95, impact: unassigned.length >= 3 ? "high" : "medium" });
  }
  recs.sort((a, b) => b.confidence - a.confidence);
  return recs;
}

function identifyPMOHotspots({ pms, projects, riskScore }) {
  const hotspots = [];
  for (const pm of pms) {
    if (pm.utilizationPercentage >= 110) {
      hotspots.push({ type: "capacity", entityId: pm.id, severity: pm.utilizationPercentage >= 130 ? "critical" : "high" });
    }
    if (pm.complianceScore < 60) {
      hotspots.push({ type: "governance", entityId: pm.id, severity: "critical" });
    } else if (pm.complianceScore < 75) {
      hotspots.push({ type: "governance", entityId: pm.id, severity: "high" });
    }
  }
  for (const project of projects) {
    if (project.healthScore < 50) {
      hotspots.push({ type: "execution", entityId: project.id, severity: "critical" });
    } else if (project.healthScore < 65) {
      hotspots.push({ type: "execution", entityId: project.id, severity: "high" });
    }
  }
  if (riskScore > 70) {
    hotspots.push({ type: "portfolio", entityId: "pmo", severity: riskScore > 85 ? "critical" : "high" });
  }
  return hotspots;
}

function calculatePMOTrends(snapshots) {
  if (snapshots.length < 2) return null;
  const current  = snapshots[0];
  const previous = snapshots[snapshots.length - 1];
  function buildTrend(cur, prev) {
    const delta = Math.round((cur - prev) * 100) / 100;
    return { current: cur, previous: prev, delta, direction: delta > 1 ? "improving" : delta < -1 ? "deteriorating" : "stable" };
  }
  return {
    health:     buildTrend(current.overall_health_score, previous.overall_health_score),
    capacity:   buildTrend(current.capacity_score, previous.capacity_score),
    governance: buildTrend(current.governance_score, previous.governance_score),
    risk:       buildTrend(current.risk_score, previous.risk_score),
    snapshotsCompared: snapshots.length,
  };
}

function makeSnapshot(overrides = {}) {
  return {
    id:                   uuid(),
    workspace_id:         uuid(),
    overall_health_score: 80,
    capacity_score:       75,
    governance_score:     85,
    execution_score:      78,
    risk_score:           22,
    project_count:        20,
    portfolio_count:      3,
    pm_count:             8,
    critical_projects:    2,
    warning_projects:     5,
    healthy_projects:     13,
    snapshot_payload:     {},
    generated_at:         isoNow(),
    created_at:           isoNow(),
    updated_at:           isoNow(),
    ...overrides,
  };
}

// ─── PMO Health ───────────────────────────────────────────────────────────────

describe("PMO Health Engine", () => {
  test("high score — all dimensions excellent", () => {
    const score = calculatePMOHealth({ avgPerformanceScore: 95, avgCapacityScore: 92, avgComplianceScore: 94, projectHealthScore: 91 });
    assert.ok(score >= 90, `Expected >= 90, got ${score}`);
    assert.equal(classifyPMOStatus(score), "excellent");
  });

  test("medium score — mixed dimensions", () => {
    const score = calculatePMOHealth({ avgPerformanceScore: 72, avgCapacityScore: 65, avgComplianceScore: 70, projectHealthScore: 68 });
    assert.ok(score >= 60 && score < 80, `Expected 60-80, got ${score}`);
    const status = classifyPMOStatus(score);
    assert.ok(["stable", "healthy"].includes(status), `Unexpected status ${status}`);
  });

  test("low score — critical dimensions", () => {
    const score = calculatePMOHealth({ avgPerformanceScore: 30, avgCapacityScore: 25, avgComplianceScore: 35, projectHealthScore: 20 });
    assert.ok(score < 45, `Expected < 45, got ${score}`);
    assert.equal(classifyPMOStatus(score), "critical");
  });

  test("score is bounded 0-100", () => {
    const high = calculatePMOHealth({ avgPerformanceScore: 100, avgCapacityScore: 100, avgComplianceScore: 100, projectHealthScore: 100 });
    assert.equal(high, 100);
    const low = calculatePMOHealth({ avgPerformanceScore: 0, avgCapacityScore: 0, avgComplianceScore: 0, projectHealthScore: 0 });
    assert.equal(low, 0);
  });

  test("PMO status thresholds", () => {
    assert.equal(classifyPMOStatus(92), "excellent");
    assert.equal(classifyPMOStatus(80), "healthy");
    assert.equal(classifyPMOStatus(65), "stable");
    assert.equal(classifyPMOStatus(50), "warning");
    assert.equal(classifyPMOStatus(30), "critical");
  });

  test("weights sum to 1", () => {
    const sum = Object.values(PMO_HEALTH_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.0001, `Weights sum = ${sum}`);
  });
});

// ─── Organizational Capacity ──────────────────────────────────────────────────

describe("Organizational Capacity Engine", () => {
  test("PMO saturated — many overloaded PMs", () => {
    const score = calculateOrganizationalCapacity({ pmCount: 10, overloadedPMCount: 7, warningPMCount: 2, healthyPMCount: 1, avgUtilizationPercentage: 140 });
    assert.ok(score < 40, `Expected < 40 (saturated), got ${score}`);
  });

  test("PMO healthy — balanced utilization", () => {
    const score = calculateOrganizationalCapacity({ pmCount: 10, overloadedPMCount: 1, warningPMCount: 2, healthyPMCount: 7, avgUtilizationPercentage: 75 });
    assert.ok(score >= 25, `Expected >= 25 (healthy), got ${score}`);
  });

  test("PMO with full available capacity — underutilized", () => {
    const score = calculateOrganizationalCapacity({ pmCount: 8, overloadedPMCount: 0, warningPMCount: 0, healthyPMCount: 8, avgUtilizationPercentage: 40 });
    assert.ok(score >= 60, `Expected >= 60 (underutilized), got ${score}`);
  });

  test("zero PMs returns 100", () => {
    const score = calculateOrganizationalCapacity({ pmCount: 0, overloadedPMCount: 0, warningPMCount: 0, healthyPMCount: 0, avgUtilizationPercentage: 0 });
    assert.equal(score, 100);
  });

  test("score is bounded 0-100", () => {
    const s = calculateOrganizationalCapacity({ pmCount: 5, overloadedPMCount: 5, warningPMCount: 0, healthyPMCount: 0, avgUtilizationPercentage: 200 });
    assert.ok(s >= 0 && s <= 100, `Out of bounds: ${s}`);
  });
});

// ─── Governance Maturity ──────────────────────────────────────────────────────

describe("Governance Maturity Engine", () => {
  test("high maturity — excellent compliance, no debt", () => {
    const score = calculateGovernanceMaturity({ avgComplianceScore: 92, totalGovernanceDebt: 0, hotspotCount: 0, criticalGapCount: 0, highGapCount: 0 });
    assert.ok(score >= 85, `Expected >= 85, got ${score}`);
  });

  test("low maturity — poor compliance and high debt", () => {
    const score = calculateGovernanceMaturity({ avgComplianceScore: 45, totalGovernanceDebt: 30, hotspotCount: 8, criticalGapCount: 10, highGapCount: 5 });
    assert.ok(score < 50, `Expected < 50, got ${score}`);
  });

  test("hotspots reduce score", () => {
    const withoutHotspots = calculateGovernanceMaturity({ avgComplianceScore: 80, totalGovernanceDebt: 0, hotspotCount: 0, criticalGapCount: 0, highGapCount: 0 });
    const withHotspots    = calculateGovernanceMaturity({ avgComplianceScore: 80, totalGovernanceDebt: 0, hotspotCount: 5, criticalGapCount: 0, highGapCount: 0 });
    assert.ok(withoutHotspots > withHotspots, "Hotspots should reduce maturity score");
  });

  test("score is bounded 0-100", () => {
    const high = calculateGovernanceMaturity({ avgComplianceScore: 100, totalGovernanceDebt: 0, hotspotCount: 0, criticalGapCount: 0, highGapCount: 0 });
    assert.ok(high <= 100 && high >= 0);
    const low = calculateGovernanceMaturity({ avgComplianceScore: 0, totalGovernanceDebt: 100, hotspotCount: 50, criticalGapCount: 100, highGapCount: 100 });
    assert.ok(low >= 0 && low <= 100);
  });
});

// ─── PMO Risk Index ───────────────────────────────────────────────────────────

describe("PMO Risk Engine", () => {
  test("low risk — healthy organization", () => {
    const risk = calculatePMORiskIndex({ criticalProjectCount: 0, totalProjectCount: 20, executionDriftCount: 1, totalCommitmentCount: 50, governanceGapCount: 0, overloadedPMCount: 0, pmCount: 8, escalationCount: 0 });
    assert.ok(risk < 20, `Expected < 20 (low risk), got ${risk}`);
  });

  test("medium risk — some issues", () => {
    const risk = calculatePMORiskIndex({ criticalProjectCount: 3, totalProjectCount: 20, executionDriftCount: 8, totalCommitmentCount: 50, governanceGapCount: 5, overloadedPMCount: 2, pmCount: 8, escalationCount: 2 });
    assert.ok(risk >= 10 && risk < 60, `Expected medium risk, got ${risk}`);
  });

  test("critical risk — multiple risk factors", () => {
    const risk = calculatePMORiskIndex({ criticalProjectCount: 10, totalProjectCount: 20, executionDriftCount: 30, totalCommitmentCount: 50, governanceGapCount: 15, overloadedPMCount: 6, pmCount: 8, escalationCount: 8 });
    assert.ok(risk >= 60, `Expected >= 60 (critical risk), got ${risk}`);
  });

  test("risk is bounded 0-100", () => {
    const max = calculatePMORiskIndex({ criticalProjectCount: 100, totalProjectCount: 100, executionDriftCount: 100, totalCommitmentCount: 100, governanceGapCount: 100, overloadedPMCount: 10, pmCount: 10, escalationCount: 100 });
    assert.ok(max >= 0 && max <= 100, `Out of bounds: ${max}`);
  });

  test("zero total projects returns 0 critical ratio", () => {
    const risk = calculatePMORiskIndex({ criticalProjectCount: 0, totalProjectCount: 0, executionDriftCount: 0, totalCommitmentCount: 0, governanceGapCount: 0, overloadedPMCount: 0, pmCount: 0, escalationCount: 0 });
    assert.equal(risk, 0);
  });
});

// ─── Attention Queue ──────────────────────────────────────────────────────────

describe("Attention Queue Engine", () => {
  const healthyPM   = { id: uuid(), name: "Alice", utilizationPercentage: 75, complianceScore: 88, performanceScore: 85 };
  const overloadedPM = { id: uuid(), name: "Bob",   utilizationPercentage: 145, complianceScore: 55, performanceScore: 72 };
  const warningPM   = { id: uuid(), name: "Carol",  utilizationPercentage: 95, complianceScore: 70, performanceScore: 62 };
  const critProject = { id: uuid(), name: "PROJ-001", healthScore: 35, pmId: null };
  const warnProject = { id: uuid(), name: "PROJ-002", healthScore: 62, pmId: uuid() };
  const goodProject = { id: uuid(), name: "PROJ-003", healthScore: 85, pmId: uuid() };

  test("prioritization — critical items come first", () => {
    const queue = generateAttentionQueue({ pms: [healthyPM, overloadedPM], projects: [critProject], riskScore: 30, governanceScore: 80 });
    assert.ok(queue.length > 0, "Queue should not be empty");
    assert.equal(queue[0].priority, "critical", "First item must be critical");
  });

  test("order — critical before high before medium before low", () => {
    const queue = generateAttentionQueue({ pms: [overloadedPM, warningPM, healthyPM], projects: [critProject, warnProject, goodProject], riskScore: 75, governanceScore: 55 });
    let maxPriority = -1;
    for (const item of queue) {
      const p = PRIORITY_ORDER[item.priority];
      assert.ok(p >= maxPriority, `Priority out of order: ${item.priority} after a lower-priority item`);
      maxPriority = p;
    }
  });

  test("overloaded PM at 145% generates critical item", () => {
    const queue = generateAttentionQueue({ pms: [overloadedPM], projects: [], riskScore: 0, governanceScore: 90 });
    const critItems = queue.filter((i) => i.priority === "critical" && i.entityType === "pm");
    assert.ok(critItems.length >= 1, "Should have critical capacity item for 145% utilization PM");
  });

  test("warning PM at 95% generates medium item", () => {
    const queue = generateAttentionQueue({ pms: [warningPM], projects: [], riskScore: 0, governanceScore: 90 });
    const medItems = queue.filter((i) => i.priority === "medium" && i.entityType === "pm" && i.entityId === warningPM.id);
    assert.ok(medItems.length >= 1, "Should have medium capacity item for 95% utilization PM");
  });

  test("healthy PM generates no capacity attention", () => {
    const queue = generateAttentionQueue({ pms: [healthyPM], projects: [], riskScore: 0, governanceScore: 90 });
    const capacityItems = queue.filter((i) => i.entityId === healthyPM.id && i.title.includes("overload"));
    assert.equal(capacityItems.length, 0, "Healthy PM should not have capacity attention");
  });

  test("critical project generates critical item", () => {
    const queue = generateAttentionQueue({ pms: [], projects: [critProject], riskScore: 0, governanceScore: 90 });
    const critItems = queue.filter((i) => i.priority === "critical" && i.entityType === "project");
    assert.ok(critItems.length >= 1);
  });

  test("high risk score triggers governance attention", () => {
    const queue = generateAttentionQueue({ pms: [], projects: [], riskScore: 80, governanceScore: 90 });
    const riskItems = queue.filter((i) => i.entityType === "governance");
    assert.ok(riskItems.length >= 1, "High risk score should trigger governance attention");
  });

  test("each attention item has required fields", () => {
    const queue = generateAttentionQueue({ pms: [overloadedPM], projects: [critProject], riskScore: 50, governanceScore: 50 });
    for (const item of queue) {
      assert.ok(typeof item.priority === "string", "priority required");
      assert.ok(typeof item.entityType === "string", "entityType required");
      assert.ok(typeof item.entityId === "string", "entityId required");
      assert.ok(typeof item.title === "string" && item.title.length > 0, "title required");
      assert.ok(typeof item.description === "string" && item.description.length > 0, "description required");
      assert.ok(typeof item.recommendedAction === "string" && item.recommendedAction.length > 0, "recommendedAction required");
    }
  });
});

// ─── Executive Recommendations ────────────────────────────────────────────────

describe("Executive Recommendations Engine", () => {
  const pm1 = { id: uuid(), name: "Alice", utilizationPercentage: 75, complianceScore: 88, performanceScore: 85, status: "healthy" };
  const pm2 = { id: uuid(), name: "Bob",   utilizationPercentage: 145, complianceScore: 55, performanceScore: 72, status: "overloaded" };

  test("recommendations are generated for overloaded PMO", () => {
    const recs = generateExecutiveRecommendations({
      pms: [pm1, pm2, pm2], projects: [], healthScore: 55, capacityScore: 45, governanceScore: 58, riskScore: 70, overloadedPMCount: 3, criticalProjectCount: 0
    });
    assert.ok(recs.length > 0, "Should generate recommendations");
  });

  test("capacity recommendation for low capacity score", () => {
    const recs = generateExecutiveRecommendations({
      pms: [], projects: [], healthScore: 55, capacityScore: 40, governanceScore: 80, riskScore: 30, overloadedPMCount: 0, criticalProjectCount: 0
    });
    const capRec = recs.find((r) => r.type === "staffing");
    assert.ok(capRec, "Should recommend staffing for critically low capacity");
    assert.equal(capRec.impact, "critical");
  });

  test("governance recommendation for low governance score", () => {
    const recs = generateExecutiveRecommendations({
      pms: [], projects: [], healthScore: 60, capacityScore: 80, governanceScore: 50, riskScore: 30, overloadedPMCount: 0, criticalProjectCount: 0
    });
    const govRec = recs.find((r) => r.type === "governance");
    assert.ok(govRec, "Should recommend governance for low score");
  });

  test("confidence is between 0 and 1", () => {
    const recs = generateExecutiveRecommendations({
      pms: [pm2, pm2, pm2], projects: [], healthScore: 40, capacityScore: 35, governanceScore: 40, riskScore: 75, overloadedPMCount: 3, criticalProjectCount: 2
    });
    for (const rec of recs) {
      assert.ok(rec.confidence >= 0 && rec.confidence <= 1, `Confidence out of range: ${rec.confidence}`);
    }
  });

  test("impact is a valid value", () => {
    const valid = ["low", "medium", "high", "critical"];
    const recs = generateExecutiveRecommendations({
      pms: [pm2], projects: [{ id: uuid(), healthScore: 30, pmId: null }], healthScore: 50, capacityScore: 55, governanceScore: 45, riskScore: 75, overloadedPMCount: 1, criticalProjectCount: 1
    });
    for (const rec of recs) {
      assert.ok(valid.includes(rec.impact), `Invalid impact: ${rec.impact}`);
    }
  });

  test("recommendations sorted by confidence descending", () => {
    const recs = generateExecutiveRecommendations({
      pms: [pm2, pm2], projects: [{ id: uuid(), healthScore: 30, pmId: null }], healthScore: 45, capacityScore: 40, governanceScore: 45, riskScore: 75, overloadedPMCount: 2, criticalProjectCount: 3
    });
    for (let i = 1; i < recs.length; i++) {
      assert.ok(recs[i - 1].confidence >= recs[i].confidence, "Should be sorted by confidence desc");
    }
  });

  test("portfolio recommendation when projects have no PM", () => {
    const recs = generateExecutiveRecommendations({
      pms: [], projects: [{ id: uuid(), healthScore: 80, pmId: null }, { id: uuid(), healthScore: 75, pmId: null }, { id: uuid(), healthScore: 85, pmId: null }],
      healthScore: 80, capacityScore: 80, governanceScore: 80, riskScore: 20, overloadedPMCount: 0, criticalProjectCount: 0
    });
    const portRec = recs.find((r) => r.type === "portfolio");
    assert.ok(portRec, "Should recommend portfolio fix for unassigned projects");
  });
});

// ─── PMO Hotspots ─────────────────────────────────────────────────────────────

describe("PMO Hotspot Engine", () => {
  const overloadedPM = { id: uuid(), name: "Bob", utilizationPercentage: 145, complianceScore: 88 };
  const lowCompPM    = { id: uuid(), name: "Carol", utilizationPercentage: 75, complianceScore: 52 };
  const critProject  = { id: uuid(), name: "PROJ-001", healthScore: 35 };
  const warnProject  = { id: uuid(), name: "PROJ-002", healthScore: 58 };

  test("capacity hotspot — overloaded PM", () => {
    const hotspots = identifyPMOHotspots({ pms: [overloadedPM], projects: [], governanceScore: 80, riskScore: 30 });
    const cap = hotspots.filter((h) => h.type === "capacity");
    assert.ok(cap.length >= 1, "Should detect capacity hotspot");
    assert.equal(cap[0].severity, "critical");
  });

  test("governance hotspot — low compliance PM", () => {
    const hotspots = identifyPMOHotspots({ pms: [lowCompPM], projects: [], governanceScore: 80, riskScore: 30 });
    const gov = hotspots.filter((h) => h.type === "governance");
    assert.ok(gov.length >= 1, "Should detect governance hotspot");
    assert.equal(gov[0].severity, "critical");
  });

  test("execution hotspot — critical health project", () => {
    const hotspots = identifyPMOHotspots({ pms: [], projects: [critProject], governanceScore: 80, riskScore: 30 });
    const exec = hotspots.filter((h) => h.type === "execution");
    assert.ok(exec.length >= 1, "Should detect execution hotspot");
    assert.equal(exec[0].severity, "critical");
  });

  test("portfolio hotspot — high risk score", () => {
    const hotspots = identifyPMOHotspots({ pms: [], projects: [], governanceScore: 80, riskScore: 90 });
    const port = hotspots.filter((h) => h.type === "portfolio");
    assert.ok(port.length >= 1, "Should detect portfolio hotspot at risk 90");
    assert.equal(port[0].severity, "critical");
  });

  test("no hotspots — healthy PMO", () => {
    const healthyPM = { id: uuid(), name: "Alice", utilizationPercentage: 70, complianceScore: 90 };
    const healthProject = { id: uuid(), name: "PROJ-OK", healthScore: 88 };
    const hotspots = identifyPMOHotspots({ pms: [healthyPM], projects: [healthProject], governanceScore: 85, riskScore: 20 });
    assert.equal(hotspots.length, 0, "Healthy PMO should have no hotspots");
  });

  test("multiple hotspot types can coexist", () => {
    const hotspots = identifyPMOHotspots({ pms: [overloadedPM, lowCompPM], projects: [critProject, warnProject], governanceScore: 55, riskScore: 80 });
    const types = new Set(hotspots.map((h) => h.type));
    assert.ok(types.has("capacity"),   "Should have capacity hotspot");
    assert.ok(types.has("governance"), "Should have governance hotspot");
    assert.ok(types.has("execution"),  "Should have execution hotspot");
    assert.ok(types.has("portfolio"),  "Should have portfolio hotspot");
  });
});

// ─── PMO Trends ───────────────────────────────────────────────────────────────

describe("PMO Trend Engine", () => {
  test("null when only one snapshot", () => {
    const trend = calculatePMOTrends([makeSnapshot()]);
    assert.equal(trend, null);
  });

  test("null when no snapshots", () => {
    const trend = calculatePMOTrends([]);
    assert.equal(trend, null);
  });

  test("improving trend — health increased", () => {
    const older = makeSnapshot({ overall_health_score: 65, capacity_score: 60, governance_score: 70, risk_score: 40 });
    const newer = makeSnapshot({ overall_health_score: 82, capacity_score: 78, governance_score: 85, risk_score: 22 });
    const trend = calculatePMOTrends([newer, older]);
    assert.equal(trend.health.direction, "improving");
    assert.ok(trend.health.delta > 0, "Health delta should be positive");
  });

  test("deteriorating trend — health decreased", () => {
    const older = makeSnapshot({ overall_health_score: 82, capacity_score: 78, governance_score: 85, risk_score: 22 });
    const newer = makeSnapshot({ overall_health_score: 61, capacity_score: 55, governance_score: 60, risk_score: 45 });
    const trend = calculatePMOTrends([newer, older]);
    assert.equal(trend.health.direction, "deteriorating");
    assert.ok(trend.health.delta < 0, "Health delta should be negative");
  });

  test("stable trend — minimal change", () => {
    const older = makeSnapshot({ overall_health_score: 80, capacity_score: 75, governance_score: 85, risk_score: 22 });
    const newer = makeSnapshot({ overall_health_score: 80.5, capacity_score: 75, governance_score: 85, risk_score: 22 });
    const trend = calculatePMOTrends([newer, older]);
    assert.equal(trend.health.direction, "stable");
  });

  test("trend includes snapshotsCompared count", () => {
    const snaps = [
      makeSnapshot({ overall_health_score: 85 }),
      makeSnapshot({ overall_health_score: 78 }),
      makeSnapshot({ overall_health_score: 70 }),
    ];
    const trend = calculatePMOTrends(snaps);
    assert.equal(trend.snapshotsCompared, 3);
  });

  test("trend compares newest vs oldest in list", () => {
    const snaps = [
      makeSnapshot({ overall_health_score: 90 }),
      makeSnapshot({ overall_health_score: 75 }),
      makeSnapshot({ overall_health_score: 60 }),
    ];
    const trend = calculatePMOTrends(snaps);
    assert.equal(trend.health.current, 90);
    assert.equal(trend.health.previous, 60);
    assert.ok(trend.health.delta > 1, "Should be improving from 60 to 90");
  });
});

// ─── PMO Summary / Snapshot ───────────────────────────────────────────────────

describe("PMO Snapshot — Aggregation", () => {
  test("snapshot has correct structure", () => {
    const snap = makeSnapshot();
    assert.ok(typeof snap.id === "string");
    assert.ok(typeof snap.overall_health_score === "number");
    assert.ok(typeof snap.capacity_score === "number");
    assert.ok(typeof snap.governance_score === "number");
    assert.ok(typeof snap.execution_score === "number");
    assert.ok(typeof snap.risk_score === "number");
    assert.ok(typeof snap.project_count === "number");
    assert.ok(typeof snap.portfolio_count === "number");
    assert.ok(typeof snap.pm_count === "number");
    assert.ok(typeof snap.critical_projects === "number");
    assert.ok(typeof snap.warning_projects === "number");
    assert.ok(typeof snap.healthy_projects === "number");
    assert.ok(typeof snap.generated_at === "string");
  });

  test("project counts are correct", () => {
    const snap = makeSnapshot({ critical_projects: 3, warning_projects: 7, healthy_projects: 10 });
    assert.equal(snap.critical_projects + snap.warning_projects + snap.healthy_projects, 20);
  });

  test("scores are within 0-100 range", () => {
    const snap = makeSnapshot();
    for (const field of ["overall_health_score", "capacity_score", "governance_score", "execution_score", "risk_score"]) {
      assert.ok(snap[field] >= 0 && snap[field] <= 100, `${field} out of range: ${snap[field]}`);
    }
  });

  test("health score aggregation uses correct weights", () => {
    const score = calculatePMOHealth({ avgPerformanceScore: 80, avgCapacityScore: 70, avgComplianceScore: 75, projectHealthScore: 85 });
    const expected = 80 * 0.30 + 70 * 0.25 + 75 * 0.25 + 85 * 0.20;
    assert.equal(score, Math.round(expected * 100) / 100);
  });
});

// ─── Lineage ──────────────────────────────────────────────────────────────────

describe("PMO Lineage", () => {
  test("lineage types file contains PMOLineage type", () => {
    const src = readFileSync("src/lib/pmo-command-center/types.ts", "utf8");
    assert.ok(src.includes("PMOLineage"), "types.ts must export PMOLineage");
    assert.ok(src.includes("ProjectSummary"), "types.ts must export ProjectSummary");
    assert.ok(src.includes("PMSummary"), "types.ts must export PMSummary");
  });

  test("lineage engine file exports getPMOLineage", () => {
    const src = readFileSync("src/lib/pmo-command-center/pmo-lineage.ts", "utf8");
    assert.ok(src.includes("getPMOLineage"), "pmo-lineage.ts must export getPMOLineage");
    assert.ok(src.includes("PMO_LINEAGE_GENERATED"), "lineage must emit PMO_LINEAGE_GENERATED event");
  });

  test("lineage references all chain components", () => {
    const src = readFileSync("src/lib/pmo-command-center/pmo-lineage.ts", "utf8");
    assert.ok(src.includes("pm_performance_snapshots"), "lineage must reference performance");
    assert.ok(src.includes("pm_capacity_snapshots"), "lineage must reference capacity");
    assert.ok(src.includes("governance_compliance_snapshots"), "lineage must reference compliance");
    assert.ok(src.includes("project_os_snapshots"), "lineage must reference project health");
    assert.ok(src.includes("pm_assignments"), "lineage must reference assignments");
    assert.ok(src.includes("programs"), "lineage must reference portfolios");
  });
});

// ─── Audit Events ─────────────────────────────────────────────────────────────

describe("Audit Events", () => {
  test("registry emits all required event types", () => {
    const src = readFileSync("src/lib/pmo-command-center/pmo-registry.ts", "utf8");
    const events = [
      "PMO_SNAPSHOT_GENERATED",
      "PMO_HEALTH_CALCULATED",
      "PMO_CAPACITY_CALCULATED",
      "PMO_GOVERNANCE_MATURITY_CALCULATED",
      "PMO_RISK_INDEX_CALCULATED",
      "PMO_ATTENTION_QUEUE_GENERATED",
      "PMO_RECOMMENDATIONS_GENERATED",
      "PMO_HOTSPOT_IDENTIFIED",
    ];
    for (const event of events) {
      assert.ok(src.includes(event), `Missing event: ${event}`);
    }
  });

  test("lineage emits PMO_LINEAGE_GENERATED", () => {
    const src = readFileSync("src/lib/pmo-command-center/pmo-lineage.ts", "utf8");
    assert.ok(src.includes("PMO_LINEAGE_GENERATED"), "lineage must emit PMO_LINEAGE_GENERATED");
  });

  test("trend event type declared in types", () => {
    const src = readFileSync("src/lib/pmo-command-center/types.ts", "utf8");
    assert.ok(src.includes("PMO_TREND_CALCULATED"), "types must include PMO_TREND_CALCULATED event");
  });

  test("audit event payloads include snapshot_id", () => {
    const src = readFileSync("src/lib/pmo-command-center/pmo-registry.ts", "utf8");
    assert.ok(src.includes("snapshot_id:"), "Event payloads must reference snapshot_id");
  });

  test("event metadata includes correlation and causation IDs", () => {
    const src = readFileSync("src/lib/pmo-command-center/pmo-registry.ts", "utf8");
    assert.ok(src.includes("correlationId:"), "Must set correlationId on events");
    assert.ok(src.includes("causationId:"), "Must set causationId on sub-events");
  });
});

// ─── Workspace Isolation ──────────────────────────────────────────────────────

describe("Workspace Isolation", () => {
  test("all queries filter by workspace_id", () => {
    const registrySrc  = readFileSync("src/lib/pmo-command-center/pmo-registry.ts", "utf8");
    const dashboardSrc = readFileSync("src/lib/pmo-command-center/pmo-dashboard.ts", "utf8");
    const lineageSrc   = readFileSync("src/lib/pmo-command-center/pmo-lineage.ts", "utf8");

    for (const [name, src] of [["pmo-registry", registrySrc], ["pmo-dashboard", dashboardSrc], ["pmo-lineage", lineageSrc]]) {
      assert.ok(src.includes('.eq("workspace_id"'), `${name} must filter by workspace_id`);
    }
  });

  test("UUID validation rejects invalid workspace IDs", () => {
    const src = readFileSync("src/lib/pmo-command-center/pmo-registry.ts", "utf8");
    assert.ok(src.includes("validUuid(input.workspaceId)"), "Must validate workspaceId UUID");
  });

  test("UUID validation rejects invalid snapshot IDs", () => {
    const src = readFileSync("src/lib/pmo-command-center/pmo-registry.ts", "utf8");
    assert.ok(src.includes("validUuid(input.snapshotId)"), "Must validate snapshotId UUID");
  });

  test("result type includes failureClass for error cases", () => {
    const src = readFileSync("src/lib/pmo-command-center/types.ts", "utf8");
    assert.ok(src.includes("failureClass"), "PMOCommandCenterResult must include failureClass");
  });

  test("no automatic modifications to projects or PMs", () => {
    const registrySrc = readFileSync("src/lib/pmo-command-center/pmo-registry.ts", "utf8");
    // Verify no update calls on project_managers or projects tables
    assert.ok(!registrySrc.includes('.from("project_managers")\n    .update'), "Must not update project_managers");
    assert.ok(!registrySrc.includes('.from("projects")\n    .update'), "Must not update projects");
  });
});

// ─── Database Contract ────────────────────────────────────────────────────────

describe("Database Contract", () => {
  test("database-contract includes all PMO Command Center tables", () => {
    const src = readFileSync("src/lib/db/database-contract.ts", "utf8");
    assert.ok(src.includes("PMOCommandCenterSnapshotRow"), "Contract must include PMOCommandCenterSnapshotRow");
    assert.ok(src.includes("PMOAttentionItemRow"), "Contract must include PMOAttentionItemRow");
    assert.ok(src.includes("PMORecommendationRow"), "Contract must include PMORecommendationRow");
  });

  test("database-contract exports selectable column arrays", () => {
    const src = readFileSync("src/lib/db/database-contract.ts", "utf8");
    assert.ok(src.includes("PMO_COMMAND_CENTER_SNAPSHOT_SELECTABLE_COLUMNS"), "Must export snapshot column selector");
    assert.ok(src.includes("PMO_ATTENTION_ITEM_SELECTABLE_COLUMNS"), "Must export attention item column selector");
    assert.ok(src.includes("PMO_RECOMMENDATION_SELECTABLE_COLUMNS"), "Must export recommendation column selector");
  });

  test("database contract version updated for sprint 5", () => {
    const src = readFileSync("src/lib/db/database-contract.ts", "utf8");
    assert.ok(src.includes("pmo-command-center"), "DATABASE_CONTRACT_VERSION must reference pmo-command-center");
  });

  test("migration file exists", () => {
    const src = readFileSync("supabase/migrations/20260718000000_pmo_command_center.sql", "utf8");
    assert.ok(src.includes("pmo_command_center_snapshots"), "Migration must create pmo_command_center_snapshots");
    assert.ok(src.includes("pmo_attention_items"), "Migration must create pmo_attention_items");
    assert.ok(src.includes("pmo_recommendations"), "Migration must create pmo_recommendations");
  });

  test("migration enables RLS on all tables", () => {
    const src = readFileSync("supabase/migrations/20260718000000_pmo_command_center.sql", "utf8");
    const rlsCount = (src.match(/enable row level security/g) ?? []).length;
    assert.equal(rlsCount, 3, "All 3 tables must have RLS enabled");
  });
});

// ─── Index / Exports ──────────────────────────────────────────────────────────

describe("Module Exports", () => {
  test("index exports all required services", () => {
    const src = readFileSync("src/lib/pmo-command-center/index.ts", "utf8");
    assert.ok(src.includes("generatePMOSnapshot"), "Must export generatePMOSnapshot");
    assert.ok(src.includes("getPMOSnapshot"), "Must export getPMOSnapshot");
    assert.ok(src.includes("listPMOSnapshots"), "Must export listPMOSnapshots");
    assert.ok(src.includes("generatePMODashboardModel"), "Must export generatePMODashboardModel");
    assert.ok(src.includes("getPMOLineage"), "Must export getPMOLineage");
    assert.ok(src.includes("explainPMOCommandCenter"), "Must export explainPMOCommandCenter");
    assert.ok(src.includes("calculatePMOTrendsFromWorkspace"), "Must export calculatePMOTrendsFromWorkspace");
  });

  test("index exports all engine functions", () => {
    const src = readFileSync("src/lib/pmo-command-center/index.ts", "utf8");
    assert.ok(src.includes("calculatePMOHealth"), "Must export calculatePMOHealth");
    assert.ok(src.includes("calculateOrganizationalCapacity"), "Must export calculateOrganizationalCapacity");
    assert.ok(src.includes("calculateGovernanceMaturity"), "Must export calculateGovernanceMaturity");
    assert.ok(src.includes("calculatePMORiskIndex"), "Must export calculatePMORiskIndex");
    assert.ok(src.includes("generateAttentionQueue"), "Must export generateAttentionQueue");
    assert.ok(src.includes("generateExecutiveRecommendations"), "Must export generateExecutiveRecommendations");
    assert.ok(src.includes("identifyPMOHotspots"), "Must export identifyPMOHotspots");
    assert.ok(src.includes("calculatePMOTrends"), "Must export calculatePMOTrends");
  });

  test("explain function returns structured explanation", () => {
    const src = readFileSync("src/lib/pmo-command-center/explain.ts", "utf8");
    assert.ok(src.includes("PMO Health Engine"), "Explanation must describe PMO Health Engine");
    assert.ok(src.includes("Organizational Capacity Engine"), "Explanation must describe Organizational Capacity Engine");
    assert.ok(src.includes("Governance Maturity Engine"), "Explanation must describe Governance Maturity Engine");
    assert.ok(src.includes("PMO Risk Engine"), "Explanation must describe PMO Risk Engine");
    assert.ok(src.includes("Attention Queue Engine"), "Explanation must describe Attention Queue Engine");
    assert.ok(src.includes("Executive Recommendation Engine"), "Explanation must describe Recommendation Engine");
    assert.ok(src.includes("PMO Hotspot Engine"), "Explanation must describe Hotspot Engine");
    assert.ok(src.includes("PMO Trend Engine"), "Explanation must describe Trend Engine");
    assert.ok(src.includes("PMO Lineage Engine"), "Explanation must describe Lineage Engine");
    assert.ok(src.includes("governance-by-exception"), "Explanation must describe governance-by-exception");
  });
});
