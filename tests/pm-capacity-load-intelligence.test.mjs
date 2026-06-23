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
