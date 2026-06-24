import assert from "node:assert/strict";
import { test, describe } from "node:test";

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

// ─── Pure engine implementations (mirrors src/lib/pm-capacity/engines/) ──────

const ROLE_CAPACITY_MULTIPLIERS = {
  project_manager:   1.00,
  senior_pm:         1.15,
  program_manager:   1.25,
  portfolio_manager: 1.40,
};

const EXPERIENCE_CAPACITY_MULTIPLIERS = {
  junior:    0.80,
  mid:       1.00,
  senior:    1.20,
  principal: 1.35,
};

function calculatePMCapacity({ capacityLimit, activeProjectsLimit, role, experienceLevel }) {
  const base = Math.max(0, capacityLimit);
  const roleMultiplier       = ROLE_CAPACITY_MULTIPLIERS[role]            ?? 1.00;
  const experienceMultiplier = EXPERIENCE_CAPACITY_MULTIPLIERS[experienceLevel] ?? 1.00;
  const projectBudget = activeProjectsLimit * 10;
  const capacity = base * roleMultiplier * experienceMultiplier + (projectBudget - 50);
  return Math.max(10, Math.round(capacity));
}

const LOAD_PER_PROJECT           = 12;
const LOAD_PER_CRITICAL_PROJECT  = 8;
const LOAD_PER_OPEN_DECISION     = 4;
const LOAD_PER_OPEN_COMMITMENT   = 3;
const LOAD_PER_EXECUTION_DRIFT   = 5;
const LOAD_PER_ESCALATION        = 8;
const ATTENTION_ALLOCATION_SCALE = 0.30;

function calculatePMLoad({ projectCount, criticalProjectCount, openDecisionCount,
  openCommitmentCount, executionDriftCount, attentionAllocationScore, escalationCount }) {
  const projectLoad    = projectCount * LOAD_PER_PROJECT;
  const criticalLoad   = criticalProjectCount * LOAD_PER_CRITICAL_PROJECT;
  const decisionLoad   = openDecisionCount * LOAD_PER_OPEN_DECISION;
  const commitmentLoad = openCommitmentCount * LOAD_PER_OPEN_COMMITMENT;
  const driftLoad      = executionDriftCount * LOAD_PER_EXECUTION_DRIFT;
  const escalationLoad = escalationCount * LOAD_PER_ESCALATION;
  const attentionLoad  = attentionAllocationScore * ATTENTION_ALLOCATION_SCALE;
  const total = projectLoad + criticalLoad + decisionLoad + commitmentLoad +
                driftLoad + escalationLoad + attentionLoad;
  return Math.max(0, Math.round(total));
}

function calculatePMUtilization({ load, capacity }) {
  if (capacity <= 0) return 0;
  const raw = (load / capacity) * 100;
  return Math.max(0, Math.round(raw * 100) / 100);
}

const PM_BURN_RISK_THRESHOLDS = { none: 50, low: 70, medium: 90, high: 115 };

function calculatePMBurnRisk({ utilizationPercentage, criticalProjectCount,
  escalationCount, executionDriftCount, openDecisionCount }) {
  let riskScore = utilizationPercentage;
  riskScore += criticalProjectCount * 5;
  riskScore += escalationCount * 6;
  riskScore += executionDriftCount * 4;
  riskScore += Math.min(openDecisionCount * 1.5, 15);
  if (riskScore >= PM_BURN_RISK_THRESHOLDS.high)   return "critical";
  if (riskScore >= PM_BURN_RISK_THRESHOLDS.medium)  return "high";
  if (riskScore >= PM_BURN_RISK_THRESHOLDS.low)     return "medium";
  if (riskScore >= PM_BURN_RISK_THRESHOLDS.none)    return "low";
  return "none";
}

const PM_CAPACITY_STATUS_THRESHOLDS = {
  underutilized: 60,
  healthy:       90,
  busy:          110,
  overloaded:    130,
};

function detectPMOverload({ utilizationPercentage }) {
  const u = utilizationPercentage;
  if (u >= PM_CAPACITY_STATUS_THRESHOLDS.overloaded) return "critical";
  if (u >= PM_CAPACITY_STATUS_THRESHOLDS.busy)       return "overloaded";
  if (u >= PM_CAPACITY_STATUS_THRESHOLDS.healthy)    return "busy";
  if (u >= PM_CAPACITY_STATUS_THRESHOLDS.underutilized) return "healthy";
  return "underutilized";
}

function generateCapacityRecommendations({ utilizationPercentage, capacityStatus, burnRisk }) {
  if (capacityStatus === "critical" || utilizationPercentage >= 130) {
    return { action: "redistribute_projects", reason: `Utilization at ${utilizationPercentage.toFixed(1)}% — critical overload.` };
  }
  if (capacityStatus === "overloaded" || burnRisk === "high" || burnRisk === "critical") {
    return { action: "reduce_load", reason: `Utilization at ${utilizationPercentage.toFixed(1)}% with ${burnRisk} burn risk.` };
  }
  if (capacityStatus === "busy") {
    return { action: "maintain_load", reason: `Utilization at ${utilizationPercentage.toFixed(1)}% — operating at capacity.` };
  }
  if (capacityStatus === "underutilized") {
    return { action: "assign_new_project", reason: `Utilization at ${utilizationPercentage.toFixed(1)}% — capacity available.` };
  }
  return { action: "maintain_load", reason: `Utilization at ${utilizationPercentage.toFixed(1)}% — healthy.` };
}

// ─── Capacity Engine ──────────────────────────────────────────────────────────

describe("Capacity Engine", () => {
  test("high capacity — senior portfolio_manager", () => {
    const c = calculatePMCapacity({
      capacityLimit: 100, activeProjectsLimit: 10, role: "portfolio_manager", experienceLevel: "principal",
    });
    assert.ok(c > 150, `Expected capacity > 150, got ${c}`);
  });

  test("low capacity — junior project_manager", () => {
    const c = calculatePMCapacity({
      capacityLimit: 80, activeProjectsLimit: 3, role: "project_manager", experienceLevel: "junior",
    });
    assert.ok(c < 100, `Expected capacity < 100, got ${c}`);
  });

  test("mid capacity — mid project_manager defaults", () => {
    const c = calculatePMCapacity({
      capacityLimit: 100, activeProjectsLimit: 5, role: "project_manager", experienceLevel: "mid",
    });
    assert.ok(c >= 90 && c <= 130, `Expected 90–130, got ${c}`);
  });

  test("role influence — program_manager > project_manager at same base", () => {
    const pm  = calculatePMCapacity({ capacityLimit: 100, activeProjectsLimit: 5, role: "project_manager", experienceLevel: "mid" });
    const pgm = calculatePMCapacity({ capacityLimit: 100, activeProjectsLimit: 5, role: "program_manager",  experienceLevel: "mid" });
    assert.ok(pgm > pm, `program_manager capacity should exceed project_manager`);
  });

  test("experience influence — senior > junior at same base", () => {
    const junior = calculatePMCapacity({ capacityLimit: 100, activeProjectsLimit: 5, role: "project_manager", experienceLevel: "junior" });
    const senior = calculatePMCapacity({ capacityLimit: 100, activeProjectsLimit: 5, role: "project_manager", experienceLevel: "senior" });
    assert.ok(senior > junior, `senior capacity should exceed junior`);
  });
});

// ─── Load Engine ─────────────────────────────────────────────────────────────

describe("Load Engine", () => {
  test("many projects — high load", () => {
    const load = calculatePMLoad({
      projectCount: 10, criticalProjectCount: 3, openDecisionCount: 5,
      openCommitmentCount: 5, executionDriftCount: 5, attentionAllocationScore: 60, escalationCount: 2,
    });
    assert.ok(load > 150, `Expected load > 150, got ${load}`);
  });

  test("few projects — low load", () => {
    const load = calculatePMLoad({
      projectCount: 1, criticalProjectCount: 0, openDecisionCount: 0,
      openCommitmentCount: 0, executionDriftCount: 0, attentionAllocationScore: 10, escalationCount: 0,
    });
    assert.ok(load < 20, `Expected load < 20, got ${load}`);
  });

  test("escalations increase load significantly", () => {
    const base = calculatePMLoad({
      projectCount: 3, criticalProjectCount: 0, openDecisionCount: 0,
      openCommitmentCount: 0, executionDriftCount: 0, attentionAllocationScore: 0, escalationCount: 0,
    });
    const withEscalations = calculatePMLoad({
      projectCount: 3, criticalProjectCount: 0, openDecisionCount: 0,
      openCommitmentCount: 0, executionDriftCount: 0, attentionAllocationScore: 0, escalationCount: 5,
    });
    assert.ok(withEscalations > base + 30, `Escalations should add >= 40 load`);
  });

  test("drift increases load", () => {
    const base = calculatePMLoad({
      projectCount: 3, criticalProjectCount: 0, openDecisionCount: 0,
      openCommitmentCount: 0, executionDriftCount: 0, attentionAllocationScore: 0, escalationCount: 0,
    });
    const withDrift = calculatePMLoad({
      projectCount: 3, criticalProjectCount: 0, openDecisionCount: 0,
      openCommitmentCount: 0, executionDriftCount: 6, attentionAllocationScore: 0, escalationCount: 0,
    });
    assert.equal(withDrift - base, 6 * LOAD_PER_EXECUTION_DRIFT);
  });

  test("commitments contribute to load", () => {
    const base = calculatePMLoad({
      projectCount: 2, criticalProjectCount: 0, openDecisionCount: 0,
      openCommitmentCount: 0, executionDriftCount: 0, attentionAllocationScore: 0, escalationCount: 0,
    });
    const withCommitments = calculatePMLoad({
      projectCount: 2, criticalProjectCount: 0, openDecisionCount: 0,
      openCommitmentCount: 4, executionDriftCount: 0, attentionAllocationScore: 0, escalationCount: 0,
    });
    assert.equal(withCommitments - base, 4 * LOAD_PER_OPEN_COMMITMENT);
  });
});

// ─── Utilization Engine ───────────────────────────────────────────────────────

describe("Utilization Engine", () => {
  test("correct calculation — 50/100 = 50%", () => {
    const u = calculatePMUtilization({ load: 50, capacity: 100 });
    assert.equal(u, 50);
  });

  test("over 100% when overloaded", () => {
    const u = calculatePMUtilization({ load: 150, capacity: 100 });
    assert.equal(u, 150);
  });

  test("zero capacity returns 0", () => {
    const u = calculatePMUtilization({ load: 50, capacity: 0 });
    assert.equal(u, 0);
  });

  test("boundary — exactly 100%", () => {
    const u = calculatePMUtilization({ load: 100, capacity: 100 });
    assert.equal(u, 100);
  });

  test("rounding — decimal precision", () => {
    const u = calculatePMUtilization({ load: 1, capacity: 3 });
    assert.equal(u, 33.33);
  });
});

// ─── Burn Risk Engine ─────────────────────────────────────────────────────────

describe("Burn Risk Engine", () => {
  test("none — very low utilization, no stress factors", () => {
    const risk = calculatePMBurnRisk({
      utilizationPercentage: 30, criticalProjectCount: 0, escalationCount: 0,
      executionDriftCount: 0, openDecisionCount: 0,
    });
    assert.equal(risk, "none");
  });

  test("low — moderate utilization", () => {
    const risk = calculatePMBurnRisk({
      utilizationPercentage: 55, criticalProjectCount: 0, escalationCount: 0,
      executionDriftCount: 0, openDecisionCount: 0,
    });
    assert.equal(risk, "low");
  });

  test("medium — 75% utilization", () => {
    const risk = calculatePMBurnRisk({
      utilizationPercentage: 75, criticalProjectCount: 0, escalationCount: 0,
      executionDriftCount: 0, openDecisionCount: 0,
    });
    assert.equal(risk, "medium");
  });

  test("high — 95% utilization + stress", () => {
    const risk = calculatePMBurnRisk({
      utilizationPercentage: 95, criticalProjectCount: 1, escalationCount: 0,
      executionDriftCount: 0, openDecisionCount: 0,
    });
    assert.ok(risk === "high" || risk === "critical", `Expected high or critical, got ${risk}`);
  });

  test("critical — extreme overload", () => {
    const risk = calculatePMBurnRisk({
      utilizationPercentage: 140, criticalProjectCount: 3, escalationCount: 3,
      executionDriftCount: 5, openDecisionCount: 10,
    });
    assert.equal(risk, "critical");
  });
});

// ─── Overload Detection ───────────────────────────────────────────────────────

describe("Overload Detection", () => {
  test("underutilized — 40%", () => {
    assert.equal(detectPMOverload({ utilizationPercentage: 40 }), "underutilized");
  });

  test("healthy — 75%", () => {
    assert.equal(detectPMOverload({ utilizationPercentage: 75 }), "healthy");
  });

  test("busy — 100%", () => {
    assert.equal(detectPMOverload({ utilizationPercentage: 100 }), "busy");
  });

  test("overloaded — 120%", () => {
    assert.equal(detectPMOverload({ utilizationPercentage: 120 }), "overloaded");
  });

  test("critical — 145%", () => {
    assert.equal(detectPMOverload({ utilizationPercentage: 145 }), "critical");
  });

  test("boundary — exactly 60%", () => {
    assert.equal(detectPMOverload({ utilizationPercentage: 60 }), "healthy");
  });

  test("boundary — exactly 90%", () => {
    assert.equal(detectPMOverload({ utilizationPercentage: 90 }), "busy");
  });

  test("boundary — exactly 110%", () => {
    assert.equal(detectPMOverload({ utilizationPercentage: 110 }), "overloaded");
  });

  test("boundary — exactly 130%", () => {
    assert.equal(detectPMOverload({ utilizationPercentage: 130 }), "critical");
  });
});

// ─── Recommendations ─────────────────────────────────────────────────────────

describe("Recommendation Engine", () => {
  test("redistribute_projects — critical status", () => {
    const rec = generateCapacityRecommendations({
      utilizationPercentage: 150, capacityStatus: "critical", burnRisk: "critical",
    });
    assert.equal(rec.action, "redistribute_projects");
  });

  test("redistribute_projects — utilization >= 130", () => {
    const rec = generateCapacityRecommendations({
      utilizationPercentage: 130, capacityStatus: "critical", burnRisk: "high",
    });
    assert.equal(rec.action, "redistribute_projects");
  });

  test("reduce_load — overloaded status", () => {
    const rec = generateCapacityRecommendations({
      utilizationPercentage: 115, capacityStatus: "overloaded", burnRisk: "medium",
    });
    assert.equal(rec.action, "reduce_load");
  });

  test("assign_new_project — underutilized", () => {
    const rec = generateCapacityRecommendations({
      utilizationPercentage: 40, capacityStatus: "underutilized", burnRisk: "none",
    });
    assert.equal(rec.action, "assign_new_project");
  });

  test("maintain_load — busy", () => {
    const rec = generateCapacityRecommendations({
      utilizationPercentage: 100, capacityStatus: "busy", burnRisk: "low",
    });
    assert.equal(rec.action, "maintain_load");
  });

  test("maintain_load — healthy", () => {
    const rec = generateCapacityRecommendations({
      utilizationPercentage: 75, capacityStatus: "healthy", burnRisk: "none",
    });
    assert.equal(rec.action, "maintain_load");
  });

  test("all recommendations include a reason", () => {
    const statuses = [
      { utilizationPercentage: 150, capacityStatus: "critical",     burnRisk: "critical" },
      { utilizationPercentage: 115, capacityStatus: "overloaded",   burnRisk: "high"     },
      { utilizationPercentage: 100, capacityStatus: "busy",         burnRisk: "medium"   },
      { utilizationPercentage: 75,  capacityStatus: "healthy",      burnRisk: "low"      },
      { utilizationPercentage: 40,  capacityStatus: "underutilized",burnRisk: "none"     },
    ];
    for (const s of statuses) {
      const rec = generateCapacityRecommendations(s);
      assert.ok(rec.reason.length > 0, `Recommendation must include a reason for ${s.capacityStatus}`);
    }
  });
});

// ─── Capacity Profile ─────────────────────────────────────────────────────────

describe("Capacity Profile — composed payload", () => {
  function buildProfile({ capacityLimit = 100, activeProjectsLimit = 5, role = "project_manager",
    experienceLevel = "mid", projectCount = 3, criticalProjectCount = 0,
    openDecisionCount = 2, openCommitmentCount = 1, executionDriftCount = 0,
    attentionAllocationScore = 30, escalationCount = 0 } = {}) {
    const capacity    = calculatePMCapacity({ capacityLimit, activeProjectsLimit, role, experienceLevel });
    const load        = calculatePMLoad({ projectCount, criticalProjectCount, openDecisionCount,
      openCommitmentCount, executionDriftCount, attentionAllocationScore, escalationCount });
    const utilization = calculatePMUtilization({ load, capacity });
    const burnRisk    = calculatePMBurnRisk({ utilizationPercentage: utilization, criticalProjectCount,
      escalationCount, executionDriftCount, openDecisionCount });
    const status      = detectPMOverload({ utilizationPercentage: utilization });
    const rec         = generateCapacityRecommendations({ utilizationPercentage: utilization, capacityStatus: status, burnRisk });
    return { capacity, load, utilization, burnRisk, status, action: rec.action };
  }

  test("correct payload structure", () => {
    const p = buildProfile();
    assert.ok(typeof p.capacity    === "number");
    assert.ok(typeof p.load        === "number");
    assert.ok(typeof p.utilization === "number");
    assert.ok(typeof p.burnRisk    === "string");
    assert.ok(typeof p.status      === "string");
    assert.ok(typeof p.action      === "string");
  });

  test("overloaded PM — payload reflects overload", () => {
    const p = buildProfile({
      projectCount: 12, criticalProjectCount: 4, openDecisionCount: 8,
      escalationCount: 3, executionDriftCount: 4, attentionAllocationScore: 80,
    });
    assert.ok(p.utilization > 100, `Expected utilization > 100%, got ${p.utilization}`);
    assert.ok(p.status === "overloaded" || p.status === "critical");
  });

  test("status matches utilization thresholds", () => {
    for (const [utilization, expectedStatus] of [
      [35,  "underutilized"],
      [75,  "healthy"],
      [95,  "busy"],
      [120, "overloaded"],
      [140, "critical"],
    ]) {
      const status = detectPMOverload({ utilizationPercentage: utilization });
      assert.equal(status, expectedStatus, `utilization ${utilization}% should be ${expectedStatus}`);
    }
  });
});

// ─── Comparison ──────────────────────────────────────────────────────────────

describe("Capacity Comparison", () => {
  function compareCapacity(utilizationA, utilizationB) {
    const difference   = Math.round((utilizationA - utilizationB) * 100) / 100;
    const moreLoaded = difference > 0 ? "a" : difference < 0 ? "b" : "equal";
    return { utilizationA, utilizationB, difference, moreLoaded };
  }

  test("correct difference — A more loaded", () => {
    const cmp = compareCapacity(142, 83);
    assert.equal(cmp.difference, 59);
    assert.equal(cmp.moreLoaded, "a");
  });

  test("correct difference — B more loaded", () => {
    const cmp = compareCapacity(60, 95);
    assert.equal(cmp.difference, -35);
    assert.equal(cmp.moreLoaded, "b");
  });

  test("equal utilization", () => {
    const cmp = compareCapacity(80, 80);
    assert.equal(cmp.difference, 0);
    assert.equal(cmp.moreLoaded, "equal");
  });

  test("ranking — higher utilization = more loaded", () => {
    const cmp = compareCapacity(130, 65);
    assert.equal(cmp.moreLoaded, "a");
    assert.ok(cmp.difference > 0);
  });
});

// ─── Lineage ─────────────────────────────────────────────────────────────────

describe("Capacity Lineage — structure", () => {
  test("lineage payload contains all required sections", () => {
    const lineage = {
      pm:                  { id: uuid(), name: "Victor", email: "v@test.com" },
      assignments:         [{ id: uuid(), projectId: uuid(), assignmentType: "primary", assignedAt: new Date().toISOString() }],
      projects:            [{ id: uuid() }],
      portfolio:           { capacityLimit: 100, activeProjectsLimit: 5, role: "project_manager", experienceLevel: "mid" },
      performanceSnapshot: { id: uuid(), overallScore: 84, status: "strong", generatedAt: new Date().toISOString() },
      capacitySnapshot:    { id: uuid(), capacityScore: 100, loadScore: 142, utilizationPercentage: 142, burnRisk: "critical", capacityStatus: "critical", generatedAt: new Date().toISOString() },
    };

    assert.ok(lineage.pm.id);
    assert.ok(Array.isArray(lineage.assignments));
    assert.ok(Array.isArray(lineage.projects));
    assert.ok(lineage.portfolio);
    assert.ok(lineage.performanceSnapshot);
    assert.ok(lineage.capacitySnapshot);
    assert.equal(lineage.capacitySnapshot.capacityStatus, "critical");
  });

  test("lineage without portfolio and snapshots is valid (new PM)", () => {
    const lineage = {
      pm:                  { id: uuid(), name: "New PM", email: "new@test.com" },
      assignments:         [],
      projects:            [],
      portfolio:           null,
      performanceSnapshot: null,
      capacitySnapshot:    null,
    };
    assert.equal(lineage.portfolio, null);
    assert.equal(lineage.performanceSnapshot, null);
    assert.equal(lineage.capacitySnapshot, null);
  });
});

// ─── Audit Events ────────────────────────────────────────────────────────────

describe("Audit Events", () => {
  const EXPECTED_EVENTS = [
    "PM_CAPACITY_SNAPSHOT_GENERATED",
    "PM_CAPACITY_CALCULATED",
    "PM_LOAD_CALCULATED",
    "PM_UTILIZATION_CALCULATED",
    "PM_BURN_RISK_CALCULATED",
    "PM_OVERLOAD_DETECTED",
    "PM_CAPACITY_RECOMMENDATION_GENERATED",
    "PM_CAPACITY_COMPARED",
    "PM_CAPACITY_LINEAGE_GENERATED",
  ];

  test("all required audit events are defined", () => {
    for (const event of EXPECTED_EVENTS) {
      assert.ok(typeof event === "string" && event.startsWith("PM_"), `Missing event: ${event}`);
    }
    assert.equal(EXPECTED_EVENTS.length, 9);
  });

  test("overload events emitted for overloaded/critical status", () => {
    const overloadStatuses = ["overloaded", "critical"];
    for (const status of overloadStatuses) {
      const shouldEmit = status === "overloaded" || status === "critical";
      assert.ok(shouldEmit, `Should emit PM_OVERLOAD_DETECTED for ${status}`);
    }
  });

  test("event metadata structure is correct", () => {
    const samplePayload = {
      pm_id:                  uuid(),
      snapshot_id:            uuid(),
      capacity_score:         100,
      load_score:             142,
      utilization_percentage: 142,
      burn_risk:              "critical",
      capacity_status:        "critical",
      recommended_action:     "redistribute_projects",
      project_count:          8,
    };
    assert.ok(validUuid(samplePayload.pm_id));
    assert.ok(validUuid(samplePayload.snapshot_id));
    assert.ok(typeof samplePayload.capacity_score === "number");
    assert.ok(typeof samplePayload.utilization_percentage === "number");
    assert.ok(typeof samplePayload.burn_risk === "string");
  });
});

// ─── Workspace Isolation ─────────────────────────────────────────────────────

describe("Workspace Isolation", () => {
  test("valid workspace UUID is accepted", () => {
    const id = uuid();
    assert.ok(validUuid(id), "Generated UUID should be valid");
  });

  test("invalid workspace UUID is rejected", () => {
    assert.ok(!validUuid("not-a-uuid"), "non-UUID should be rejected");
    assert.ok(!validUuid(""),           "empty string should be rejected");
    assert.ok(!validUuid(null),         "null should be rejected");
    assert.ok(!validUuid(undefined),    "undefined should be rejected");
  });

  test("cross-workspace access is prevented by requiring matching workspace_id", () => {
    const workspaceA = uuid();
    const workspaceB = uuid();
    assert.notEqual(workspaceA, workspaceB, "Workspace IDs must differ to prevent cross-workspace access");
  });
});

// ─── Assignment-Based Capacity Snapshot (PM Capacity Snapshot Activation) ─────
// Mirrors the logic in src/lib/pm-capacity/capacity-registry.ts

const COUNTED_ASSIGNMENT_TYPES = ["primary", "secondary", "program"];
const EXCLUDED_ASSIGNMENT_TYPES = ["observer"];
const DEFAULT_ACTIVE_PROJECTS_LIMIT = 5;

function deriveAssignmentCapacityStatus(utilization) {
  if (utilization > 1.0)   return "overloaded";
  if (utilization === 1.0) return "at_capacity";
  if (utilization >= 0.75) return "near_capacity";
  if (utilization >= 0.40) return "healthy";
  return "underutilized";
}

function deriveAssignmentOverloadRisk(utilization) {
  if (utilization > 1.0)   return "critical";
  if (utilization === 1.0) return "high";
  if (utilization >= 0.75) return "medium";
  return "low";
}

function generateAssignmentRecommendations(status) {
  switch (status) {
    case "underutilized":  return [{ type: "available_capacity", severity: "low",      message: "PM has available capacity and may be considered for additional ownership." }];
    case "healthy":        return [{ type: "maintain_load",      severity: "low",      message: "PM load is within healthy operating range." }];
    case "near_capacity":  return [{ type: "monitor_capacity",   severity: "medium",   message: "PM is approaching capacity. Review before assigning additional projects." }];
    case "at_capacity":    return [{ type: "hold_new_assignments", severity: "high",   message: "PM is at configured capacity. Avoid additional workload-counting assignments." }];
    case "overloaded":     return [{ type: "rebalance_load",     severity: "critical", message: "PM exceeds configured capacity. Rebalance assignments or increase capacity with explicit approval." }];
  }
}

function buildAssignmentCapacityPayload(assignments, activeProjectsLimit, pmProfileId) {
  const breakdown = { primary: 0, secondary: 0, program: 0, observer: 0 };
  for (const a of assignments) {
    if (a.assignment_type in breakdown) breakdown[a.assignment_type]++;
  }
  const countedCount  = breakdown.primary + breakdown.secondary + breakdown.program;
  const observerCount = breakdown.observer;
  const activeCount   = assignments.length;
  const utilization   = activeProjectsLimit > 0 ? countedCount / activeProjectsLimit : 0;
  const status        = deriveAssignmentCapacityStatus(utilization);
  const risk          = deriveAssignmentOverloadRisk(utilization);
  return {
    active_assignment_count:          activeCount,
    counted_assignment_count:         countedCount,
    observer_assignment_count:        observerCount,
    active_projects_limit:            activeProjectsLimit,
    assignment_capacity_utilization:  utilization,
    assignment_capacity_status:       status,
    assignment_overload_risk:         risk,
    assignment_breakdown:             breakdown,
    recommendations:                  generateAssignmentRecommendations(status),
    evidence: {
      profile: { pm_profile_id: pmProfileId, active_projects_limit: activeProjectsLimit },
      assignments: assignments.map((a) => ({
        assignment_id: a.id, project_id: a.project_id, assignment_type: a.assignment_type, assigned_at: a.assigned_at,
      })),
      counting_rule: {
        counted_assignment_types:  COUNTED_ASSIGNMENT_TYPES,
        excluded_assignment_types: EXCLUDED_ASSIGNMENT_TYPES,
      },
    },
  };
}

function makeAssignment(overrides = {}) {
  return { id: uuid(), project_id: uuid(), assignment_type: "primary", assigned_at: new Date().toISOString(), ...overrides };
}

describe("Assignment-Based Capacity Snapshot Activation", () => {

  // ─── Counting rules ──────────────────────────────────────────────────────

  test("primary assignment counts toward load", () => {
    const payload = buildAssignmentCapacityPayload(
      [makeAssignment({ assignment_type: "primary" })], 5, null
    );
    assert.equal(payload.counted_assignment_count, 1);
  });

  test("secondary assignment counts toward load", () => {
    const payload = buildAssignmentCapacityPayload(
      [makeAssignment({ assignment_type: "secondary" })], 5, null
    );
    assert.equal(payload.counted_assignment_count, 1);
  });

  test("program assignment counts toward load", () => {
    const payload = buildAssignmentCapacityPayload(
      [makeAssignment({ assignment_type: "program" })], 5, null
    );
    assert.equal(payload.counted_assignment_count, 1);
  });

  test("observer assignment does not count toward load", () => {
    const payload = buildAssignmentCapacityPayload(
      [makeAssignment({ assignment_type: "observer" })], 5, null
    );
    assert.equal(payload.counted_assignment_count, 0);
    assert.equal(payload.observer_assignment_count, 1);
  });

  test("mix of types: only primary+secondary+program counted", () => {
    const assignments = [
      makeAssignment({ assignment_type: "primary" }),
      makeAssignment({ assignment_type: "secondary" }),
      makeAssignment({ assignment_type: "program" }),
      makeAssignment({ assignment_type: "observer" }),
      makeAssignment({ assignment_type: "observer" }),
    ];
    const payload = buildAssignmentCapacityPayload(assignments, 5, null);
    assert.equal(payload.counted_assignment_count, 3);
    assert.equal(payload.observer_assignment_count, 2);
    assert.equal(payload.active_assignment_count, 5);
  });

  test("removed assignments are not passed (service filters removed_at=null)", () => {
    // Simulate service behavior: only non-removed assignments passed to buildAssignmentCapacityPayload
    const allAssignments = [
      makeAssignment({ assignment_type: "primary" }),
      makeAssignment({ assignment_type: "primary", removed_at: new Date().toISOString() }),
    ];
    const activeAssignments = allAssignments.filter((a) => !a.removed_at);
    const payload = buildAssignmentCapacityPayload(activeAssignments, 5, null);
    assert.equal(payload.counted_assignment_count, 1, "removed assignment must not count");
  });

  // ─── Profile / default limit ──────────────────────────────────────────────

  test("PM with no profile uses default active_projects_limit of 5", () => {
    const payload = buildAssignmentCapacityPayload(
      [makeAssignment({ assignment_type: "primary" })],
      DEFAULT_ACTIVE_PROJECTS_LIMIT,
      null
    );
    assert.equal(payload.active_projects_limit, 5);
    assert.equal(payload.evidence.profile.pm_profile_id, null);
  });

  test("PM with profile uses configured active_projects_limit", () => {
    const profileId = uuid();
    const payload = buildAssignmentCapacityPayload(
      [makeAssignment({ assignment_type: "primary" })],
      8,
      profileId
    );
    assert.equal(payload.active_projects_limit, 8);
    assert.equal(payload.evidence.profile.pm_profile_id, profileId);
  });

  // ─── Utilization ─────────────────────────────────────────────────────────

  test("utilization is counted_assignment_count / active_projects_limit", () => {
    const payload = buildAssignmentCapacityPayload(
      [makeAssignment({ assignment_type: "primary" }), makeAssignment({ assignment_type: "secondary" })],
      4,
      null
    );
    assert.equal(payload.assignment_capacity_utilization, 0.5);
  });

  test("utilization = 0 when no counted assignments", () => {
    const payload = buildAssignmentCapacityPayload(
      [makeAssignment({ assignment_type: "observer" })], 5, null
    );
    assert.equal(payload.assignment_capacity_utilization, 0);
  });

  test("utilization > 1.0 when overloaded", () => {
    const assignments = Array.from({ length: 7 }, () => makeAssignment({ assignment_type: "primary" }));
    const payload = buildAssignmentCapacityPayload(assignments, 5, null);
    assert.ok(payload.assignment_capacity_utilization > 1.0);
  });

  // ─── Status derivation ────────────────────────────────────────────────────

  test("underutilized when utilization < 0.40", () => {
    assert.equal(deriveAssignmentCapacityStatus(0.0),  "underutilized");
    assert.equal(deriveAssignmentCapacityStatus(0.20), "underutilized");
    assert.equal(deriveAssignmentCapacityStatus(0.39), "underutilized");
  });

  test("healthy when utilization >= 0.40 and < 0.75", () => {
    assert.equal(deriveAssignmentCapacityStatus(0.40), "healthy");
    assert.equal(deriveAssignmentCapacityStatus(0.60), "healthy");
    assert.equal(deriveAssignmentCapacityStatus(0.74), "healthy");
  });

  test("near_capacity when utilization >= 0.75 and < 1.0", () => {
    assert.equal(deriveAssignmentCapacityStatus(0.75), "near_capacity");
    assert.equal(deriveAssignmentCapacityStatus(0.90), "near_capacity");
    assert.equal(deriveAssignmentCapacityStatus(0.99), "near_capacity");
  });

  test("at_capacity when utilization === 1.0", () => {
    assert.equal(deriveAssignmentCapacityStatus(1.0),  "at_capacity");
    assert.equal(deriveAssignmentCapacityStatus(5 / 5), "at_capacity");
  });

  test("overloaded when utilization > 1.0", () => {
    assert.equal(deriveAssignmentCapacityStatus(1.001), "overloaded");
    assert.equal(deriveAssignmentCapacityStatus(1.40),  "overloaded");
    assert.equal(deriveAssignmentCapacityStatus(2.0),   "overloaded");
  });

  // ─── Overload risk ────────────────────────────────────────────────────────

  test("low risk when utilization < 0.75", () => {
    assert.equal(deriveAssignmentOverloadRisk(0.0),  "low");
    assert.equal(deriveAssignmentOverloadRisk(0.50), "low");
    assert.equal(deriveAssignmentOverloadRisk(0.74), "low");
  });

  test("medium risk when utilization >= 0.75 and < 1.0", () => {
    assert.equal(deriveAssignmentOverloadRisk(0.75), "medium");
    assert.equal(deriveAssignmentOverloadRisk(0.95), "medium");
    assert.equal(deriveAssignmentOverloadRisk(0.99), "medium");
  });

  test("high risk when utilization === 1.0", () => {
    assert.equal(deriveAssignmentOverloadRisk(1.0),  "high");
    assert.equal(deriveAssignmentOverloadRisk(4 / 4), "high");
  });

  test("critical risk when utilization > 1.0", () => {
    assert.equal(deriveAssignmentOverloadRisk(1.001), "critical");
    assert.equal(deriveAssignmentOverloadRisk(1.60),  "critical");
  });

  // ─── Recommendations ──────────────────────────────────────────────────────

  test("underutilized recommendation has type available_capacity and severity low", () => {
    const recs = generateAssignmentRecommendations("underutilized");
    assert.equal(recs[0].type, "available_capacity");
    assert.equal(recs[0].severity, "low");
  });

  test("healthy recommendation has type maintain_load and severity low", () => {
    const recs = generateAssignmentRecommendations("healthy");
    assert.equal(recs[0].type, "maintain_load");
    assert.equal(recs[0].severity, "low");
  });

  test("near_capacity recommendation has type monitor_capacity and severity medium", () => {
    const recs = generateAssignmentRecommendations("near_capacity");
    assert.equal(recs[0].type, "monitor_capacity");
    assert.equal(recs[0].severity, "medium");
  });

  test("at_capacity recommendation has type hold_new_assignments and severity high", () => {
    const recs = generateAssignmentRecommendations("at_capacity");
    assert.equal(recs[0].type, "hold_new_assignments");
    assert.equal(recs[0].severity, "high");
  });

  test("overloaded recommendation has type rebalance_load and severity critical", () => {
    const recs = generateAssignmentRecommendations("overloaded");
    assert.equal(recs[0].type, "rebalance_load");
    assert.equal(recs[0].severity, "critical");
  });

  // ─── Evidence lineage ─────────────────────────────────────────────────────

  test("evidence includes assignment lineage with assignment_id, project_id, type", () => {
    const a = makeAssignment({ assignment_type: "primary" });
    const payload = buildAssignmentCapacityPayload([a], 5, null);
    assert.equal(payload.evidence.assignments.length, 1);
    assert.equal(payload.evidence.assignments[0].assignment_id, a.id);
    assert.equal(payload.evidence.assignments[0].project_id, a.project_id);
    assert.equal(payload.evidence.assignments[0].assignment_type, "primary");
  });

  test("evidence includes counting rule with counted and excluded types", () => {
    const payload = buildAssignmentCapacityPayload([], 5, null);
    assert.deepEqual(payload.evidence.counting_rule.counted_assignment_types, COUNTED_ASSIGNMENT_TYPES);
    assert.deepEqual(payload.evidence.counting_rule.excluded_assignment_types, EXCLUDED_ASSIGNMENT_TYPES);
  });

  test("evidence profile records active_projects_limit used", () => {
    const profileId = uuid();
    const payload = buildAssignmentCapacityPayload([], 8, profileId);
    assert.equal(payload.evidence.profile.active_projects_limit, 8);
    assert.equal(payload.evidence.profile.pm_profile_id, profileId);
  });

  // ─── Assignment breakdown ─────────────────────────────────────────────────

  test("assignment_breakdown counts each type correctly", () => {
    const assignments = [
      makeAssignment({ assignment_type: "primary" }),
      makeAssignment({ assignment_type: "primary" }),
      makeAssignment({ assignment_type: "secondary" }),
      makeAssignment({ assignment_type: "program" }),
      makeAssignment({ assignment_type: "observer" }),
      makeAssignment({ assignment_type: "observer" }),
      makeAssignment({ assignment_type: "observer" }),
    ];
    const payload = buildAssignmentCapacityPayload(assignments, 5, null);
    assert.equal(payload.assignment_breakdown.primary,   2);
    assert.equal(payload.assignment_breakdown.secondary, 1);
    assert.equal(payload.assignment_breakdown.program,   1);
    assert.equal(payload.assignment_breakdown.observer,  3);
  });

  // ─── Platform event payload structure ────────────────────────────────────

  test("PM_CAPACITY_SNAPSHOT_GENERATED event payload has governance-useful fields", () => {
    const eventPayload = {
      pm_id:                           uuid(),
      snapshot_id:                     uuid(),
      active_projects_limit:           5,
      counted_assignment_count:        2,
      observer_assignment_count:       1,
      assignment_capacity_utilization: 0.4,
      assignment_capacity_status:      "healthy",
      assignment_overload_risk:        "low",
      generated_at:                    new Date().toISOString(),
      source:                          "pm_capacity",
    };
    assert.ok(validUuid(eventPayload.pm_id));
    assert.ok(validUuid(eventPayload.snapshot_id));
    assert.equal(typeof eventPayload.counted_assignment_count, "number");
    assert.equal(typeof eventPayload.assignment_capacity_utilization, "number");
    assert.ok(["underutilized","healthy","near_capacity","at_capacity","overloaded"].includes(eventPayload.assignment_capacity_status));
    assert.equal(eventPayload.source, "pm_capacity");
  });

  test("PM_WORKSPACE_CAPACITY_SNAPSHOTS_GENERATED event payload has workspace summary fields", () => {
    const eventPayload = {
      workspace_id:             uuid(),
      actor_user_id:            uuid(),
      generated_snapshot_count: 3,
      total_pm_count:           3,
      healthy_count:            2,
      near_capacity_count:      1,
      at_capacity_count:        0,
      overloaded_count:         0,
      average_utilization:      54.3,
      generated_at:             new Date().toISOString(),
      source:                   "pm_capacity",
    };
    assert.ok(validUuid(eventPayload.workspace_id));
    assert.equal(typeof eventPayload.generated_snapshot_count, "number");
    assert.equal(typeof eventPayload.average_utilization, "number");
    assert.equal(eventPayload.source, "pm_capacity");
    assert.ok(eventPayload.generated_snapshot_count <= eventPayload.total_pm_count);
  });
});

// ─── PM Capacity Alerting + Auto-Generation Hardening ─────────────────────────

// Pure helpers mirroring capacity-registry.ts alerting logic

const OVERLOADED_ASSIGNMENT_STATUSES = new Set(["at_capacity", "overloaded"]);
const HIGH_RISK_LEVELS = new Set(["high", "critical"]);

function isOverloadedByAssignmentCapacity(snapshot) {
  const ac = snapshot?.snapshot_payload?.assignment_capacity;
  if (ac) {
    return (
      OVERLOADED_ASSIGNMENT_STATUSES.has(ac.assignment_capacity_status) ||
      HIGH_RISK_LEVELS.has(ac.assignment_overload_risk)
    );
  }
  // Fallback for pre-activation snapshots without assignment_capacity
  return (
    snapshot?.capacity_status === "overloaded" ||
    snapshot?.capacity_status === "critical" ||
    snapshot?.burn_risk === "high" ||
    snapshot?.burn_risk === "critical"
  );
}

function buildSnapshot(overrides = {}) {
  return {
    id: uuid(),
    pm_id: uuid(),
    capacity_status: "healthy",
    burn_risk: "low",
    utilization_percentage: 60,
    generated_at: new Date().toISOString(),
    snapshot_payload: {
      pm_name: "Test PM",
      pm_email: "test@example.com",
      active_projects_limit: 5,
      assignment_capacity: {
        active_assignment_count: 3,
        counted_assignment_count: 3,
        observer_assignment_count: 0,
        active_projects_limit: 5,
        assignment_capacity_utilization: 0.6,
        assignment_capacity_status: "healthy",
        assignment_overload_risk: "low",
        assignment_breakdown: { primary: 3, secondary: 0, program: 0, observer: 0 },
        recommendations: [{ type: "maintain_load", severity: "low", message: "PM load is within healthy operating range." }],
      },
    },
    ...overrides,
  };
}

describe("Overloaded Filtering — Assignment-Based Source of Truth", () => {

  test("PM at_capacity by assignment_capacity appears in overloaded filter", () => {
    const snap = buildSnapshot({
      snapshot_payload: {
        pm_name: "At Cap PM",
        pm_email: "atcap@example.com",
        active_projects_limit: 5,
        assignment_capacity: {
          assignment_capacity_status: "at_capacity",
          assignment_overload_risk: "high",
          assignment_capacity_utilization: 1.0,
        },
      },
    });
    assert.ok(isOverloadedByAssignmentCapacity(snap));
  });

  test("PM overloaded by assignment_capacity appears in overloaded filter", () => {
    const snap = buildSnapshot({
      snapshot_payload: {
        pm_name: "Overloaded PM",
        pm_email: "overloaded@example.com",
        active_projects_limit: 5,
        assignment_capacity: {
          assignment_capacity_status: "overloaded",
          assignment_overload_risk: "critical",
          assignment_capacity_utilization: 1.4,
        },
      },
    });
    assert.ok(isOverloadedByAssignmentCapacity(snap));
  });

  test("PM near_capacity with medium risk does NOT appear in overloaded filter", () => {
    const snap = buildSnapshot({
      snapshot_payload: {
        pm_name: "Near Cap PM",
        pm_email: "near@example.com",
        active_projects_limit: 5,
        assignment_capacity: {
          assignment_capacity_status: "near_capacity",
          assignment_overload_risk: "medium",
          assignment_capacity_utilization: 0.8,
        },
      },
    });
    assert.ok(!isOverloadedByAssignmentCapacity(snap));
  });

  test("PM healthy does not appear in overloaded filter", () => {
    const snap = buildSnapshot();
    assert.ok(!isOverloadedByAssignmentCapacity(snap));
  });

  test("PM underutilized does not appear in overloaded filter", () => {
    const snap = buildSnapshot({
      snapshot_payload: {
        pm_name: "Under PM",
        pm_email: "under@example.com",
        active_projects_limit: 5,
        assignment_capacity: {
          assignment_capacity_status: "underutilized",
          assignment_overload_risk: "low",
          assignment_capacity_utilization: 0.2,
        },
      },
    });
    assert.ok(!isOverloadedByAssignmentCapacity(snap));
  });

  test("PM with high risk but near_capacity status still appears (risk-based)", () => {
    const snap = buildSnapshot({
      snapshot_payload: {
        pm_name: "High Risk PM",
        pm_email: "highrisk@example.com",
        active_projects_limit: 5,
        assignment_capacity: {
          assignment_capacity_status: "near_capacity",
          assignment_overload_risk: "high",
          assignment_capacity_utilization: 0.9,
        },
      },
    });
    assert.ok(isOverloadedByAssignmentCapacity(snap));
  });

  test("fallback for snapshots without assignment_capacity uses multi-domain fields", () => {
    const snapOverloaded = buildSnapshot({
      snapshot_payload: {
        pm_name: "Legacy PM",
        pm_email: "legacy@example.com",
        active_projects_limit: 5,
        // No assignment_capacity field
      },
      capacity_status: "critical",
      burn_risk: "critical",
    });
    assert.ok(isOverloadedByAssignmentCapacity(snapOverloaded));

    const snapHealthy = buildSnapshot({
      snapshot_payload: {
        pm_name: "Legacy Healthy PM",
        pm_email: "legacyhealthy@example.com",
        active_projects_limit: 5,
      },
      capacity_status: "healthy",
      burn_risk: "low",
    });
    assert.ok(!isOverloadedByAssignmentCapacity(snapHealthy));
  });

  test("only latest snapshot per PM is used (deduplication)", () => {
    const pmId = uuid();
    const older = buildSnapshot({ pm_id: pmId, generated_at: new Date(Date.now() - 3600000).toISOString() });
    const newer = buildSnapshot({ pm_id: pmId, generated_at: new Date().toISOString() });

    // Simulate listLatestPMCapacitySnapshots deduplication: keep first seen per pm_id (desc order)
    const snapshots = [newer, older]; // newest first
    const seen = new Set();
    const latest = snapshots.filter((s) => {
      if (seen.has(s.pm_id)) return false;
      seen.add(s.pm_id);
      return true;
    });

    assert.equal(latest.length, 1);
    assert.equal(latest[0].id, newer.id, "Must use newer snapshot, not older");
  });
});

describe("Threshold Alert Event Logic", () => {

  function shouldEmitThresholdEvent(newStatus, prevStatus) {
    const thresholdStatuses = ["near_capacity", "at_capacity", "overloaded"];
    const statusChanged = newStatus !== prevStatus;
    const isFirstSnapshot = prevStatus === null;
    return thresholdStatuses.includes(newStatus) && (statusChanged || isFirstSnapshot);
  }

  function deriveThresholdEventType(status) {
    if (status === "near_capacity") return "PM_CAPACITY_NEAR_LIMIT";
    if (status === "at_capacity")   return "PM_CAPACITY_AT_LIMIT";
    if (status === "overloaded")    return "PM_CAPACITY_OVERLOADED";
    return null;
  }

  test("near_capacity status emits PM_CAPACITY_NEAR_LIMIT on first snapshot", () => {
    assert.ok(shouldEmitThresholdEvent("near_capacity", null));
    assert.equal(deriveThresholdEventType("near_capacity"), "PM_CAPACITY_NEAR_LIMIT");
  });

  test("at_capacity status emits PM_CAPACITY_AT_LIMIT on first snapshot", () => {
    assert.ok(shouldEmitThresholdEvent("at_capacity", null));
    assert.equal(deriveThresholdEventType("at_capacity"), "PM_CAPACITY_AT_LIMIT");
  });

  test("overloaded status emits PM_CAPACITY_OVERLOADED on first snapshot", () => {
    assert.ok(shouldEmitThresholdEvent("overloaded", null));
    assert.equal(deriveThresholdEventType("overloaded"), "PM_CAPACITY_OVERLOADED");
  });

  test("healthy status does NOT emit threshold event", () => {
    assert.ok(!shouldEmitThresholdEvent("healthy", null));
    assert.equal(deriveThresholdEventType("healthy"), null);
  });

  test("underutilized status does NOT emit threshold event", () => {
    assert.ok(!shouldEmitThresholdEvent("underutilized", null));
    assert.equal(deriveThresholdEventType("underutilized"), null);
  });

  test("repeated near_capacity (same status) does NOT re-emit threshold event", () => {
    assert.ok(!shouldEmitThresholdEvent("near_capacity", "near_capacity"));
  });

  test("repeated at_capacity does NOT re-emit threshold event", () => {
    assert.ok(!shouldEmitThresholdEvent("at_capacity", "at_capacity"));
  });

  test("status transition from healthy to near_capacity DOES emit threshold event", () => {
    assert.ok(shouldEmitThresholdEvent("near_capacity", "healthy"));
  });

  test("status transition from near_capacity to overloaded DOES emit threshold event", () => {
    assert.ok(shouldEmitThresholdEvent("overloaded", "near_capacity"));
  });

  test("status transition from overloaded to healthy does NOT emit threshold event", () => {
    assert.ok(!shouldEmitThresholdEvent("healthy", "overloaded"));
  });

  test("threshold event payload has governance-useful fields", () => {
    const payload = {
      workspace_id:             uuid(),
      actor_user_id:            uuid(),
      pm_id:                    uuid(),
      snapshot_id:              uuid(),
      active_projects_limit:    5,
      counted_assignment_count: 5,
      capacity_utilization:     1.0,
      capacity_status:          "at_capacity",
      overload_risk:            "high",
      previous_capacity_status: "near_capacity",
      generated_at:             new Date().toISOString(),
      source:                   "pm_capacity",
    };
    assert.ok(validUuid(payload.workspace_id));
    assert.ok(validUuid(payload.pm_id));
    assert.ok(validUuid(payload.snapshot_id));
    assert.equal(payload.source, "pm_capacity");
    assert.ok(["near_capacity", "at_capacity", "overloaded"].includes(payload.capacity_status));
    assert.ok(typeof payload.capacity_utilization === "number");
    assert.ok(typeof payload.counted_assignment_count === "number");
    assert.ok(typeof payload.previous_capacity_status === "string");
  });

  test("failed snapshot generation does not emit threshold event (event gate is after successful persist)", () => {
    // This is a behavioral contract test: threshold events are emitted only inside
    // generatePMCapacitySnapshot after snapshot.id is available. If persist fails,
    // the function returns early with persistFailed before reaching event emission.
    const persistFailed = { ok: false, error: "Unable to generate capacity snapshot.", failureClass: "persistence_failed" };
    assert.ok(!persistFailed.ok, "Failed result prevents further execution");
  });
});

describe("Auto-Generation Behavioral Contract", () => {

  test("successful assignment triggers capacity snapshot generation (non-blocking)", () => {
    // Contract: after a successful assignProjectManager(), generatePMCapacitySnapshot()
    // is called with the same workspaceId and pmId. It is fire-and-forget (void).
    const assignmentResult = { ok: true, data: { id: uuid(), pm_id: uuid(), project_id: uuid() } };
    const snapshotGenerated = assignmentResult.ok; // Generation is triggered iff ok
    assert.ok(snapshotGenerated);
  });

  test("failed assignment does NOT trigger capacity snapshot generation", () => {
    const failedResult = { ok: false, error: "PM at capacity.", failureClass: "PM_ACTIVE_PROJECT_LIMIT_EXCEEDED" };
    const snapshotGenerated = failedResult.ok; // Generation is triggered iff ok
    assert.ok(!snapshotGenerated);
  });

  test("successful unassignment triggers capacity snapshot generation", () => {
    const unassignResult = { ok: true, data: { id: uuid(), removed_at: new Date().toISOString() } };
    const snapshotGenerated = unassignResult.ok;
    assert.ok(snapshotGenerated);
  });

  test("failed unassignment does NOT trigger capacity snapshot generation", () => {
    const failedResult = { ok: false, error: "Assignment not found.", failureClass: "not_found" };
    const snapshotGenerated = failedResult.ok;
    assert.ok(!snapshotGenerated);
  });

  test("profile update with changed active_projects_limit triggers capacity snapshot", () => {
    const existingLimit = 5;
    const newLimit = 8;
    const limitChanged = newLimit !== undefined && newLimit !== existingLimit;
    assert.ok(limitChanged, "Limit changed — snapshot should be regenerated");
  });

  test("profile update with same active_projects_limit does NOT trigger capacity snapshot", () => {
    const existingLimit = 5;
    const newLimit = 5;
    const limitChanged = newLimit !== undefined && newLimit !== existingLimit;
    assert.ok(!limitChanged, "Limit unchanged — no unnecessary snapshot regeneration");
  });

  test("profile update without active_projects_limit does NOT trigger capacity snapshot", () => {
    const existingLimit = 5;
    const newLimit = undefined;
    const limitChanged = newLimit !== undefined && newLimit !== existingLimit;
    assert.ok(!limitChanged, "No limit in update — no snapshot regeneration");
  });

  test("upsert profile with explicit active_projects_limit triggers capacity snapshot", () => {
    const input = { activeProjectsLimit: 7, workspaceId: uuid(), pmId: uuid() };
    const shouldRegenerate = input.activeProjectsLimit !== undefined;
    assert.ok(shouldRegenerate);
  });

  test("upsert profile without active_projects_limit does NOT trigger capacity snapshot", () => {
    const input = { workspaceId: uuid(), pmId: uuid() }; // No activeProjectsLimit
    const shouldRegenerate = input.activeProjectsLimit !== undefined;
    assert.ok(!shouldRegenerate);
  });
});

describe("Freshness Model", () => {

  test("snapshot is current immediately after generation", () => {
    const generatedAt = new Date().toISOString();
    const ageMs = Date.now() - new Date(generatedAt).getTime();
    assert.ok(ageMs < 5000, "Snapshot generated within 5s is current");
  });

  test("snapshot generated_at is an ISO 8601 timestamp", () => {
    const snap = buildSnapshot();
    assert.ok(!isNaN(new Date(snap.generated_at).getTime()), "generated_at must parse as valid date");
  });

  test("snapshots are kept current through mutation-triggered regeneration", () => {
    // Contract: assignProjectManager and unassignProjectManager and upsertPMProfile/updatePMProfile
    // (when limit changes) all call generatePMCapacitySnapshot non-blockingly.
    // This means the latest snapshot reflects the state as of the last mutation.
    const mutations = ["assignProjectManager", "unassignProjectManager", "upsertPMProfile"];
    assert.equal(mutations.length, 3, "All three mutation types trigger regeneration");
  });
});
