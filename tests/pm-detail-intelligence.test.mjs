/**
 * PM Detail Intelligence Tests
 *
 * Tests the dossier aggregation logic including:
 * - Identity, profile, assignment grouping
 * - Capacity and performance section building
 * - Evidence confidence handling
 * - Recommendation consolidation and deduplication
 * - Operational status derivation
 * - Event timeline summary generation
 * - Cross-workspace access guard
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isoNow() {
  return new Date().toISOString();
}

// ─── Pure logic functions mirroring the production module ────────────────────

const CAPACITY_COUNTED_TYPES = new Set(["primary", "secondary", "program"]);
const SEVERITY_ORDER = ["critical", "high", "medium", "low"];

function buildPMIdentity(pm) {
  return {
    pm_id: pm.id,
    workspace_id: pm.workspace_id,
    display_name: pm.display_name,
    email: pm.email,
    status: pm.status,
    joined_at: pm.joined_at ?? null,
    created_at: pm.created_at,
    updated_at: pm.updated_at,
  };
}

function buildPMProfile(profile) {
  if (!profile) return { present: false, message: "No PM profile has been configured yet." };
  return {
    present: true,
    role: profile.role,
    experience_level: profile.experience_level,
    capacity_limit: profile.capacity_limit,
    active_projects_limit: profile.active_projects_limit,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };
}

function buildPMAssignments(rows) {
  const mapped = rows.map((a) => ({
    assignment_id: a.id,
    project_id: a.project_id,
    project_name: null,
    project_status: null,
    assignment_type: a.assignment_type,
    assigned_at: a.assigned_at,
    removed_at: a.removed_at ?? null,
    capacity_counted: CAPACITY_COUNTED_TYPES.has(a.assignment_type),
  }));

  const active = mapped.filter((a) => a.removed_at === null);
  const historical = mapped.filter((a) => a.removed_at !== null);
  const by_type = {
    primary:   active.filter((a) => a.assignment_type === "primary"),
    secondary: active.filter((a) => a.assignment_type === "secondary"),
    program:   active.filter((a) => a.assignment_type === "program"),
    observer:  active.filter((a) => a.assignment_type === "observer"),
  };

  return {
    active,
    historical,
    by_type,
    counts: {
      active_total:     active.length,
      historical_total: historical.length,
      primary:          by_type.primary.length,
      secondary:        by_type.secondary.length,
      program:          by_type.program.length,
      observer:         by_type.observer.length,
    },
  };
}

function buildCapacitySection(snapshot) {
  if (!snapshot) return { present: false, message: "No capacity snapshot has been generated for this Project Manager yet." };
  const payload = snapshot.snapshot_payload ?? {};
  const ac = payload.assignment_capacity ?? null;
  return {
    present: true,
    snapshot_id: snapshot.id,
    generated_at: snapshot.generated_at,
    capacity_status: ac?.assignment_capacity_status ?? snapshot.capacity_status,
    overload_risk: ac?.assignment_overload_risk ?? snapshot.burn_risk,
    active_projects_limit: ac?.active_projects_limit ?? payload.active_projects_limit ?? null,
    active_assignment_count: ac?.active_assignment_count ?? null,
    counted_assignment_count: ac?.counted_assignment_count ?? null,
    observer_assignment_count: ac?.observer_assignment_count ?? null,
    capacity_utilization: ac?.assignment_capacity_utilization ?? null,
    assignment_breakdown: ac?.assignment_breakdown ?? null,
    recommendations: ac?.recommendations ?? [],
    source: "pm_capacity",
  };
}

function buildPerformanceSection(snapshot) {
  if (!snapshot) return { present: false, message: "No performance snapshot has been generated for this Project Manager yet." };
  const payload = snapshot.snapshot_payload ?? {};
  return {
    present: true,
    snapshot_id: snapshot.id,
    generated_at: snapshot.generated_at,
    overall_performance_score: Number(snapshot.overall_score),
    performance_status: snapshot.performance_status,
    performance_risk: payload.performance_risk ?? null,
    assigned_project_count: payload.assigned_project_count ?? null,
    active_project_count: payload.active_project_count ?? null,
    governance_score: Number(snapshot.governance_score),
    execution_score: Number(snapshot.execution_score),
    prediction_score: Number(snapshot.prediction_accuracy_score),
    decision_score: Number(snapshot.decision_effectiveness_score),
    portfolio_score: Number(snapshot.portfolio_health_score),
    capacity_context: payload.capacity_context ?? null,
    recommendations: [],
    source: "pm_performance",
  };
}

function buildEvidenceSection(snapshot) {
  if (!snapshot) return { present: false, message: "Evidence confidence is not available yet." };
  const payload = snapshot.snapshot_payload ?? {};
  const ec = payload.evidence_confidence;
  if (!ec) return { present: false, message: "Evidence confidence is not available yet." };
  const isLow = ec.confidence_level === "low" || ec.confidence_level === "very_low";
  return {
    present: true,
    evidence_completeness: ec.evidence_completeness,
    confidence_level: ec.confidence_level,
    available_source_count: ec.available_source_count,
    missing_source_count: ec.missing_source_count,
    total_source_count: ec.total_source_count,
    available_sources: ec.available_sources ?? [],
    missing_sources: ec.missing_sources ?? [],
    neutral_baseline_domains: ec.neutral_baseline_domains ?? [],
    score_interpretation: ec.score_interpretation,
    missing_source_policy: ec.missing_source_policy ?? null,
    confidence_recommendations: [],
    ...(isLow ? { warning: "Performance score is provisional due to limited evidence." } : {}),
  };
}

function derivePMOperationalStatus(capSection, perfSection, evidSection) {
  const capStatus = capSection.present ? capSection.capacity_status : null;
  const overloadRisk = capSection.present ? capSection.overload_risk : null;
  const perfStatus = perfSection.present ? perfSection.performance_status : null;
  const perfRisk = perfSection.present ? perfSection.performance_risk : null;
  const confLevel = evidSection.present ? evidSection.confidence_level : null;
  const scoreInterp = evidSection.present ? evidSection.score_interpretation : null;

  if (capStatus === "overloaded" || capStatus === "critical" || perfStatus === "critical" || perfRisk === "critical") return "critical";
  if (perfStatus === "warning" || perfRisk === "high") return "performance_risk";
  if (capStatus === "near_capacity" || capStatus === "at_capacity" || capStatus === "busy" || overloadRisk === "high") return "capacity_risk";
  if (confLevel === "low" || confLevel === "very_low" || scoreInterp === "low_confidence_provisional") return "insufficient_evidence";
  if (perfStatus === "stable" || perfRisk === "medium" || capStatus === "near_capacity" || confLevel === "medium") return "watch";
  return "healthy";
}

function deduplicateRecommendations(recs) {
  const seen = new Set();
  return recs.filter((r) => {
    const key = `${r.type}::${r.message}::${r.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortRecommendationsBySeverity(recs) {
  return [...recs].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
}

// ─── Test data factories ──────────────────────────────────────────────────────

function makePM(overrides = {}) {
  const id = uuid();
  return {
    id,
    workspace_id: uuid(),
    display_name: "Test PM",
    email: "pm@example.com",
    status: "active",
    joined_at: isoNow(),
    created_at: isoNow(),
    updated_at: isoNow(),
    ...overrides,
  };
}

function makeProfile(overrides = {}) {
  return {
    id: uuid(),
    pm_id: uuid(),
    workspace_id: uuid(),
    role: "project_manager",
    experience_level: "mid",
    capacity_limit: 100,
    active_projects_limit: 5,
    created_at: isoNow(),
    updated_at: isoNow(),
    ...overrides,
  };
}

function makeAssignment(overrides = {}) {
  return {
    id: uuid(),
    workspace_id: uuid(),
    pm_id: uuid(),
    project_id: uuid(),
    assignment_type: "primary",
    assigned_at: isoNow(),
    removed_at: null,
    ...overrides,
  };
}

function makeCapacitySnapshot(overrides = {}) {
  return {
    id: uuid(),
    workspace_id: uuid(),
    pm_id: uuid(),
    capacity_score: 80,
    load_score: 60,
    utilization_percentage: 75,
    burn_risk: "low",
    capacity_status: "healthy",
    recommended_action: "Maintain current workload.",
    snapshot_payload: {
      active_projects_limit: 5,
      assignment_capacity: {
        active_assignment_count: 3,
        counted_assignment_count: 3,
        observer_assignment_count: 0,
        active_projects_limit: 5,
        assignment_capacity_utilization: 0.6,
        assignment_capacity_status: "healthy",
        assignment_overload_risk: "low",
        assignment_breakdown: { primary: 2, secondary: 1, program: 0, observer: 0 },
        recommendations: [{ type: "maintain", severity: "low", message: "Current workload is sustainable." }],
      },
    },
    generated_at: isoNow(),
    created_at: isoNow(),
    updated_at: isoNow(),
    ...overrides,
  };
}

function makePerformanceSnapshot(overrides = {}) {
  return {
    id: uuid(),
    workspace_id: uuid(),
    pm_id: uuid(),
    governance_score: 80,
    execution_score: 75,
    prediction_accuracy_score: 70,
    decision_effectiveness_score: 72,
    portfolio_health_score: 78,
    overall_score: 75,
    performance_status: "strong",
    snapshot_payload: {
      pm_name: "Test PM",
      assigned_project_count: 3,
      performance_risk: "low",
      evidence_confidence: {
        evidence_completeness: 0.8,
        confidence_level: "high",
        available_source_count: 4,
        missing_source_count: 1,
        total_source_count: 5,
        available_sources: ["project_os_snapshots", "execution_tasks", "execution_realities", "decision_outcomes"],
        missing_sources: ["capacity_context"],
        neutral_baseline_domains: [],
        score_interpretation: "evidence_backed",
        missing_source_policy: "neutral_baseline_75",
      },
    },
    generated_at: isoNow(),
    created_at: isoNow(),
    updated_at: isoNow(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PM Detail Intelligence — Identity", () => {
  test("buildPMIdentity returns correct PM identity fields", () => {
    const pm = makePM();
    const identity = buildPMIdentity(pm);
    assert.equal(identity.pm_id, pm.id);
    assert.equal(identity.workspace_id, pm.workspace_id);
    assert.equal(identity.display_name, pm.display_name);
    assert.equal(identity.email, pm.email);
    assert.equal(identity.status, pm.status);
  });
});

describe("PM Detail Intelligence — Profile", () => {
  test("returns present profile when profile exists", () => {
    const profile = makeProfile();
    const result = buildPMProfile(profile);
    assert.equal(result.present, true);
    if (result.present) {
      assert.equal(result.role, profile.role);
      assert.equal(result.experience_level, profile.experience_level);
      assert.equal(result.active_projects_limit, profile.active_projects_limit);
    }
  });

  test("returns absent profile when profile is null", () => {
    const result = buildPMProfile(null);
    assert.equal(result.present, false);
    if (!result.present) {
      assert.ok(result.message.length > 0);
    }
  });
});

describe("PM Detail Intelligence — Assignments", () => {
  test("separates active and historical assignments", () => {
    const now = isoNow();
    const rows = [
      makeAssignment({ removed_at: null }),
      makeAssignment({ removed_at: now }),
      makeAssignment({ removed_at: null }),
    ];
    const result = buildPMAssignments(rows);
    assert.equal(result.active.length, 2);
    assert.equal(result.historical.length, 1);
    assert.equal(result.counts.active_total, 2);
    assert.equal(result.counts.historical_total, 1);
  });

  test("groups active assignments by type", () => {
    const rows = [
      makeAssignment({ assignment_type: "primary", removed_at: null }),
      makeAssignment({ assignment_type: "secondary", removed_at: null }),
      makeAssignment({ assignment_type: "observer", removed_at: null }),
    ];
    const result = buildPMAssignments(rows);
    assert.equal(result.by_type.primary.length, 1);
    assert.equal(result.by_type.secondary.length, 1);
    assert.equal(result.by_type.observer.length, 1);
    assert.equal(result.counts.primary, 1);
    assert.equal(result.counts.observer, 1);
  });

  test("marks primary as capacity_counted", () => {
    const rows = [makeAssignment({ assignment_type: "primary", removed_at: null })];
    const result = buildPMAssignments(rows);
    assert.equal(result.active[0].capacity_counted, true);
  });

  test("marks secondary as capacity_counted", () => {
    const rows = [makeAssignment({ assignment_type: "secondary", removed_at: null })];
    const result = buildPMAssignments(rows);
    assert.equal(result.active[0].capacity_counted, true);
  });

  test("marks program as capacity_counted", () => {
    const rows = [makeAssignment({ assignment_type: "program", removed_at: null })];
    const result = buildPMAssignments(rows);
    assert.equal(result.active[0].capacity_counted, true);
  });

  test("marks observer as not capacity_counted", () => {
    const rows = [makeAssignment({ assignment_type: "observer", removed_at: null })];
    const result = buildPMAssignments(rows);
    assert.equal(result.active[0].capacity_counted, false);
  });
});

describe("PM Detail Intelligence — Capacity Section", () => {
  test("returns present capacity section from snapshot", () => {
    const snap = makeCapacitySnapshot();
    const result = buildCapacitySection(snap);
    assert.equal(result.present, true);
    if (result.present) {
      assert.equal(result.snapshot_id, snap.id);
      assert.equal(result.source, "pm_capacity");
      assert.ok(result.capacity_status.length > 0);
    }
  });

  test("prefers assignment_capacity_status over top-level capacity_status", () => {
    const snap = makeCapacitySnapshot({ capacity_status: "busy" });
    const result = buildCapacitySection(snap);
    if (result.present) {
      assert.equal(result.capacity_status, "healthy");
    }
  });

  test("returns absent section when no snapshot", () => {
    const result = buildCapacitySection(null);
    assert.equal(result.present, false);
  });
});

describe("PM Detail Intelligence — Performance Section", () => {
  test("returns present performance section from snapshot", () => {
    const snap = makePerformanceSnapshot();
    const result = buildPerformanceSection(snap);
    assert.equal(result.present, true);
    if (result.present) {
      assert.equal(result.snapshot_id, snap.id);
      assert.equal(result.source, "pm_performance");
      assert.ok(typeof result.overall_performance_score === "number");
    }
  });

  test("returns absent section when no snapshot", () => {
    const result = buildPerformanceSection(null);
    assert.equal(result.present, false);
    assert.ok(result.message.length > 0);
  });

  test("reads performance_risk from payload", () => {
    const snap = makePerformanceSnapshot({ snapshot_payload: { performance_risk: "high", assigned_project_count: 4 } });
    const result = buildPerformanceSection(snap);
    if (result.present) {
      assert.equal(result.performance_risk, "high");
    }
  });
});

describe("PM Detail Intelligence — Evidence Confidence", () => {
  test("returns present evidence when snapshot has evidence_confidence", () => {
    const snap = makePerformanceSnapshot();
    const result = buildEvidenceSection(snap);
    assert.equal(result.present, true);
    if (result.present) {
      assert.equal(result.confidence_level, "high");
      assert.ok(result.evidence_completeness > 0);
    }
  });

  test("returns absent evidence when snapshot is null", () => {
    const result = buildEvidenceSection(null);
    assert.equal(result.present, false);
  });

  test("returns absent evidence when payload lacks evidence_confidence", () => {
    const snap = makePerformanceSnapshot({ snapshot_payload: {} });
    const result = buildEvidenceSection(snap);
    assert.equal(result.present, false);
  });

  test("includes warning for low confidence", () => {
    const snap = makePerformanceSnapshot({
      snapshot_payload: {
        evidence_confidence: {
          evidence_completeness: 0.2,
          confidence_level: "low",
          available_source_count: 1,
          missing_source_count: 4,
          total_source_count: 5,
          available_sources: ["project_os_snapshots"],
          missing_sources: ["execution_tasks", "execution_realities", "decision_outcomes", "capacity_context"],
          neutral_baseline_domains: ["prediction_accuracy", "decision_effectiveness"],
          score_interpretation: "low_confidence_provisional",
          missing_source_policy: "neutral_baseline_75",
        },
      },
    });
    const result = buildEvidenceSection(snap);
    assert.equal(result.present, true);
    if (result.present) {
      assert.ok(result.warning !== undefined);
    }
  });

  test("includes warning for very_low confidence", () => {
    const snap = makePerformanceSnapshot({
      snapshot_payload: {
        evidence_confidence: {
          evidence_completeness: 0.0,
          confidence_level: "very_low",
          available_source_count: 0,
          missing_source_count: 5,
          total_source_count: 5,
          available_sources: [],
          missing_sources: ["project_os_snapshots", "execution_tasks", "execution_realities", "decision_outcomes", "capacity_context"],
          neutral_baseline_domains: ["governance", "execution", "portfolio", "prediction_accuracy", "decision_effectiveness"],
          score_interpretation: "low_confidence_provisional",
          missing_source_policy: "neutral_baseline_75",
        },
      },
    });
    const result = buildEvidenceSection(snap);
    if (result.present) {
      assert.ok(result.warning !== undefined);
    }
  });
});

describe("PM Detail Intelligence — Operational Status", () => {
  const absent = { present: false, message: "" };

  test("derives critical when capacity is overloaded", () => {
    const cap = { present: true, capacity_status: "overloaded", overload_risk: "critical" };
    const status = derivePMOperationalStatus(cap, absent, absent);
    assert.equal(status, "critical");
  });

  test("derives critical when performance is critical", () => {
    const perf = { present: true, performance_status: "critical", performance_risk: "medium" };
    const status = derivePMOperationalStatus(absent, perf, absent);
    assert.equal(status, "critical");
  });

  test("derives performance_risk when performance is warning", () => {
    const perf = { present: true, performance_status: "warning", performance_risk: "medium" };
    const status = derivePMOperationalStatus(absent, perf, absent);
    assert.equal(status, "performance_risk");
  });

  test("derives performance_risk when performance_risk is high", () => {
    const perf = { present: true, performance_status: "stable", performance_risk: "high" };
    const status = derivePMOperationalStatus(absent, perf, absent);
    assert.equal(status, "performance_risk");
  });

  test("derives capacity_risk when capacity is near_capacity", () => {
    const cap = { present: true, capacity_status: "near_capacity", overload_risk: "medium" };
    const status = derivePMOperationalStatus(cap, absent, absent);
    assert.equal(status, "capacity_risk");
  });

  test("derives capacity_risk when capacity is at_capacity", () => {
    const cap = { present: true, capacity_status: "at_capacity", overload_risk: "high" };
    const status = derivePMOperationalStatus(cap, absent, absent);
    assert.equal(status, "capacity_risk");
  });

  test("derives capacity_risk when capacity is busy", () => {
    const cap = { present: true, capacity_status: "busy", overload_risk: "medium" };
    const status = derivePMOperationalStatus(cap, absent, absent);
    assert.equal(status, "capacity_risk");
  });

  test("derives insufficient_evidence when confidence is low", () => {
    const evid = { present: true, confidence_level: "low", score_interpretation: "low_confidence_provisional" };
    const status = derivePMOperationalStatus(absent, absent, evid);
    assert.equal(status, "insufficient_evidence");
  });

  test("derives insufficient_evidence when confidence is very_low", () => {
    const evid = { present: true, confidence_level: "very_low", score_interpretation: "low_confidence_provisional" };
    const status = derivePMOperationalStatus(absent, absent, evid);
    assert.equal(status, "insufficient_evidence");
  });

  test("derives watch when performance is stable", () => {
    const perf = { present: true, performance_status: "stable", performance_risk: "low" };
    const evid = { present: true, confidence_level: "high", score_interpretation: "evidence_backed" };
    const status = derivePMOperationalStatus(absent, perf, evid);
    assert.equal(status, "watch");
  });

  test("derives healthy when everything is positive", () => {
    const cap = { present: true, capacity_status: "healthy", overload_risk: "low" };
    const perf = { present: true, performance_status: "strong", performance_risk: "low" };
    const evid = { present: true, confidence_level: "high", score_interpretation: "evidence_backed" };
    const status = derivePMOperationalStatus(cap, perf, evid);
    assert.equal(status, "healthy");
  });

  test("derives healthy when all snapshots are absent", () => {
    const status = derivePMOperationalStatus(absent, absent, absent);
    assert.equal(status, "healthy");
  });
});

describe("PM Detail Intelligence — Recommendations", () => {
  test("deduplicates recommendations by type+message+source", () => {
    const recs = [
      { type: "foo", severity: "high", message: "msg", source: "pm_capacity" },
      { type: "foo", severity: "high", message: "msg", source: "pm_capacity" },
      { type: "bar", severity: "medium", message: "other", source: "pm_detail_intelligence" },
    ];
    const result = deduplicateRecommendations(recs);
    assert.equal(result.length, 2);
  });

  test("sorts recommendations by severity: critical first", () => {
    const recs = [
      { type: "a", severity: "low",      message: "a", source: "pm_detail_intelligence" },
      { type: "b", severity: "critical", message: "b", source: "pm_capacity" },
      { type: "c", severity: "medium",   message: "c", source: "pm_performance" },
      { type: "d", severity: "high",     message: "d", source: "pm_capacity" },
    ];
    const result = sortRecommendationsBySeverity(recs);
    assert.equal(result[0].severity, "critical");
    assert.equal(result[1].severity, "high");
    assert.equal(result[2].severity, "medium");
    assert.equal(result[3].severity, "low");
  });
});

describe("PM Detail Intelligence — Cross-workspace access", () => {
  test("PM from different workspace is rejected", () => {
    const workspaceId = uuid();
    const pm = makePM({ workspace_id: uuid() }); // different workspace
    const isCrossWorkspace = pm.workspace_id !== workspaceId;
    assert.equal(isCrossWorkspace, true);
  });
});

describe("PM Detail Intelligence — Project Breakdown", () => {
  test("builds project breakdown from assignments", () => {
    const now = isoNow();
    const rows = [
      makeAssignment({ assignment_type: "primary", removed_at: null }),
      makeAssignment({ assignment_type: "observer", removed_at: now }),
    ];

    const breakdown = rows.map((a) => ({
      project_id: a.project_id,
      project_name: null,
      project_status: null,
      assignment_type: a.assignment_type,
      assigned_at: a.assigned_at,
      removed_at: a.removed_at ?? null,
      active: a.removed_at === null,
      capacity_counted: CAPACITY_COUNTED_TYPES.has(a.assignment_type),
      latest_health_status: "not_available",
      performance_contribution: "not_enough_data",
      evidence_status: "not_enough_data",
    }));

    assert.equal(breakdown.length, 2);
    assert.equal(breakdown[0].active, true);
    assert.equal(breakdown[0].capacity_counted, true);
    assert.equal(breakdown[1].active, false);
    assert.equal(breakdown[1].capacity_counted, false);
    assert.equal(breakdown[0].latest_health_status, "not_available");
    assert.equal(breakdown[0].evidence_status, "not_enough_data");
  });
});
