// tests/pmo-command-center.test.mjs
// Pure function tests for PMO Command Center logic.
// Mirrors the logic in src/lib/pmo-command-center/pmo-command-center.ts

import assert from "node:assert/strict";
import { test, describe } from "node:test";

// ─── Mirror pure functions ────────────────────────────────────────────────────

function derivePMOOperationalStatus(dossiers) {
  if (dossiers.length === 0) return "healthy";
  const statuses = dossiers.map((d) => d.executive_summary.operational_status);
  if (statuses.includes("critical")) return "critical";
  const perfRiskCount = statuses.filter((s) => s === "performance_risk").length;
  if (perfRiskCount > 0) return "performance_pressure";
  const capRiskCount = statuses.filter((s) => s === "capacity_risk").length;
  if (capRiskCount > 0) return "capacity_pressure";
  const evidenceGapCount = statuses.filter((s) => s === "insufficient_evidence").length;
  if (evidenceGapCount > 0) return "evidence_gap";
  const watchCount = statuses.filter((s) => s === "watch").length;
  if (watchCount > 0) return "watch";
  return "healthy";
}

function buildPMOPMCounts(dossiers) {
  const byStatus = {};
  for (const d of dossiers) {
    const s = d.executive_summary.operational_status;
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }
  return {
    total: dossiers.length,
    active: dossiers.filter((d) => d.pm.status === "active").length,
    inactive: dossiers.filter((d) => d.pm.status === "inactive").length,
    suspended: dossiers.filter((d) => d.pm.status === "suspended").length,
    by_operational_status: byStatus,
  };
}

function buildPMOCapacityOverview(dossiers) {
  const withCap = dossiers.filter((d) => d.capacity.present);
  const withoutCap = dossiers.filter((d) => !d.capacity.present);
  let totalUtil = 0, utilCount = 0, totalCounted = 0, totalObserver = 0;
  let underutilized = 0, healthyCap = 0, nearCap = 0, atCap = 0, overloaded = 0;
  let highestUtil = null, highestUtilVal = -1;
  const overloadedPMs = [], underutilizedPMs = [], recommendations = [];

  for (const d of withCap) {
    const cap = d.capacity;
    if (!cap.present) continue;
    const util = cap.capacity_utilization ?? null;
    if (util !== null) {
      totalUtil += util; utilCount++;
      if (util > highestUtilVal) {
        highestUtilVal = util;
        highestUtil = { pm_id: d.pm.pm_id, display_name: d.pm.display_name, capacity_utilization: util, capacity_status: cap.capacity_status };
      }
    }
    totalCounted += cap.counted_assignment_count ?? 0;
    totalObserver += cap.observer_assignment_count ?? 0;
    const status = cap.capacity_status;
    const pmRef = { pm_id: d.pm.pm_id, display_name: d.pm.display_name, capacity_utilization: util, capacity_status: status };
    if (status === "underutilized") { underutilized++; underutilizedPMs.push(pmRef); }
    else if (status === "healthy") healthyCap++;
    else if (status === "near_capacity" || status === "busy") nearCap++;
    else if (status === "at_capacity") atCap++;
    else if (status === "overloaded" || status === "critical") { overloaded++; overloadedPMs.push(pmRef); }
    for (const r of cap.recommendations) {
      if (!recommendations.includes(r.message)) recommendations.push(r.message);
    }
  }
  if (overloaded > 0) recommendations.unshift(`${overloaded} PM(s) are overloaded — review workload before new assignments.`);
  if (underutilized > 0 && underutilized >= Math.ceil(dossiers.length / 2)) {
    recommendations.push(`${underutilized} PM(s) are underutilized — consider rebalancing assignments.`);
  }
  return {
    pms_with_capacity_snapshot: withCap.length,
    pms_missing_capacity_snapshot: withoutCap.length,
    average_capacity_utilization: utilCount > 0 ? totalUtil / utilCount : null,
    underutilized_count: underutilized,
    healthy_capacity_count: healthyCap,
    near_capacity_count: nearCap,
    at_capacity_count: atCap,
    overloaded_count: overloaded,
    total_counted_assignments: totalCounted,
    total_observer_assignments: totalObserver,
    highest_utilization_pm: highestUtil,
    overloaded_pms: overloadedPMs,
    underutilized_pms: underutilizedPMs,
    capacity_recommendations: recommendations.slice(0, 10),
  };
}

function buildPMOPerformanceOverview(dossiers) {
  const withPerf = dossiers.filter((d) => d.performance.present);
  const withoutPerf = dossiers.filter((d) => !d.performance.present);
  let totalScore = 0, scoreCount = 0;
  let excellent = 0, strong = 0, stable = 0, warning = 0, criticalPerf = 0;
  let lowRisk = 0, medRisk = 0, highRisk = 0, criticalRisk = 0;
  const topPerformers = [], atRiskPMs = [], criticalPMs = [], recommendations = [];

  for (const d of withPerf) {
    const perf = d.performance;
    if (!perf.present) continue;
    const score = perf.overall_performance_score;
    totalScore += score; scoreCount++;
    const pmRef = { pm_id: d.pm.pm_id, display_name: d.pm.display_name, performance_score: score, performance_status: perf.performance_status };
    const status = perf.performance_status;
    if (status === "excellent") { excellent++; topPerformers.push(pmRef); }
    else if (status === "strong") { strong++; topPerformers.push(pmRef); }
    else if (status === "stable") stable++;
    else if (status === "warning") { warning++; atRiskPMs.push(pmRef); }
    else if (status === "critical") { criticalPerf++; criticalPMs.push(pmRef); }
    const risk = perf.performance_risk;
    if (risk === "low") lowRisk++;
    else if (risk === "medium") medRisk++;
    else if (risk === "high") highRisk++;
    else if (risk === "critical") criticalRisk++;
    for (const r of perf.recommendations) {
      if (!recommendations.includes(r)) recommendations.push(r);
    }
  }
  if (criticalPerf > 0) recommendations.unshift(`${criticalPerf} PM(s) have critical performance — immediate PMO review required.`);
  if (warning > 0) recommendations.push(`${warning} PM(s) have warning-level performance — schedule check-ins.`);

  return {
    pms_with_performance_snapshot: withPerf.length,
    pms_missing_performance_snapshot: withoutPerf.length,
    average_performance_score: scoreCount > 0 ? totalScore / scoreCount : null,
    excellent_count: excellent, strong_count: strong, stable_count: stable,
    warning_count: warning, critical_count: criticalPerf,
    low_risk_count: lowRisk, medium_risk_count: medRisk, high_risk_count: highRisk, critical_risk_count: criticalRisk,
    top_performers: topPerformers.slice(0, 5),
    at_risk_pms: atRiskPMs,
    critical_pms: criticalPMs,
    performance_recommendations: recommendations.slice(0, 10),
  };
}

function buildPMOEvidenceConfidenceOverview(dossiers) {
  const withEvidence = dossiers.filter((d) => d.evidence_confidence.present);
  const withoutEvidence = dossiers.filter((d) => !d.evidence_confidence.present);
  let totalCompleteness = 0, completenessCount = 0;
  let highConf = 0, medConf = 0, lowConf = 0, veryLowConf = 0;
  const lowConfPMs = [], missingSources = {}, neutralDomains = [], recommendations = [];

  for (const d of withEvidence) {
    const ev = d.evidence_confidence;
    if (!ev.present) continue;
    totalCompleteness += ev.evidence_completeness; completenessCount++;
    const level = ev.confidence_level;
    if (level === "high") highConf++;
    else if (level === "medium") medConf++;
    else if (level === "low") { lowConf++; lowConfPMs.push({ pm_id: d.pm.pm_id, display_name: d.pm.display_name, evidence_confidence_level: level }); }
    else if (level === "very_low") { veryLowConf++; lowConfPMs.push({ pm_id: d.pm.pm_id, display_name: d.pm.display_name, evidence_confidence_level: level }); }
    for (const src of ev.missing_sources) {
      missingSources[src] = (missingSources[src] ?? 0) + 1;
    }
  }
  if (veryLowConf > 0) recommendations.push(`${veryLowConf} PM(s) have very low evidence confidence — performance scores are provisional.`);
  if (lowConf > 0) recommendations.push(`${lowConf} PM(s) have low evidence confidence — expand data coverage.`);

  const commonMissingSources = Object.entries(missingSources)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([source, missing_count]) => ({ source, missing_count }));

  return {
    pms_with_evidence_confidence: withEvidence.length,
    pms_missing_evidence_confidence: withoutEvidence.length,
    average_evidence_completeness: completenessCount > 0 ? totalCompleteness / completenessCount : null,
    high_confidence_count: highConf, medium_confidence_count: medConf,
    low_confidence_count: lowConf, very_low_confidence_count: veryLowConf,
    low_confidence_pms: lowConfPMs,
    common_missing_sources: commonMissingSources,
    common_neutral_baseline_domains: neutralDomains,
    evidence_recommendations: recommendations.slice(0, 10),
  };
}

function buildPMOAttentionQueues(dossiers) {
  const criticalAttention = [], capacityAttention = [], performanceAttention = [];
  const evidenceAttention = [], underutilizedCapacity = [], highPerformers = [];

  for (const d of dossiers) {
    const es = d.executive_summary;
    const item = {
      pm_id: d.pm.pm_id, display_name: d.pm.display_name, email: d.pm.email,
      operational_status: es.operational_status, capacity_status: es.capacity_status,
      performance_status: es.performance_status, performance_risk: es.performance_risk,
      evidence_confidence_level: es.evidence_confidence_level,
      top_recommendation: es.top_recommendation,
      dossier_url: `/pm-registry/${d.pm.pm_id}`,
    };
    if (es.operational_status === "critical") criticalAttention.push(item);
    if (["overloaded", "critical", "at_capacity", "near_capacity"].includes(es.capacity_status)) capacityAttention.push(item);
    if (["critical", "warning"].includes(es.performance_status) || ["critical", "high"].includes(es.performance_risk)) performanceAttention.push(item);
    if (["very_low", "low"].includes(es.evidence_confidence_level)) evidenceAttention.push(item);
    if (es.capacity_status === "underutilized") underutilizedCapacity.push(item);
    if (["excellent", "strong"].includes(es.performance_status)) highPerformers.push(item);
  }
  return { critical_attention: criticalAttention, capacity_attention: capacityAttention, performance_attention: performanceAttention, evidence_attention: evidenceAttention, underutilized_capacity: underutilizedCapacity, high_performers: highPerformers };
}

function buildPMORecommendationQueue(dossiers) {
  const SEVERITY_ORDER = ["critical", "high", "medium", "low"];
  const OPERATIONAL_ORDER = { critical: 0, performance_risk: 1, capacity_risk: 2, insufficient_evidence: 3, watch: 4, healthy: 5 };
  const raw = [];
  for (const d of dossiers) {
    for (const rec of d.recommendations) {
      raw.push({ type: rec.type, severity: rec.severity, message: rec.message, source: rec.source, pm_id: d.pm.pm_id, pm_name: d.pm.display_name, operational_status: d.executive_summary.operational_status, created_from: d.generated_at });
    }
  }
  const seen = new Set();
  const deduped = raw.filter((r) => {
    const key = `${r.pm_id ?? ""}::${r.type}::${r.message}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  return deduped.sort((a, b) => {
    const sd = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (sd !== 0) return sd;
    return (OPERATIONAL_ORDER[a.operational_status ?? ""] ?? 99) - (OPERATIONAL_ORDER[b.operational_status ?? ""] ?? 99);
  });
}

function buildPMODossierRows(dossiers) {
  return dossiers.map((d) => {
    const es = d.executive_summary;
    return {
      pm_id: d.pm.pm_id, display_name: d.pm.display_name, email: d.pm.email,
      pm_status: d.pm.status, role: es.role, operational_status: es.operational_status,
      active_assignment_count: es.active_assignment_count, counted_assignment_count: es.counted_assignment_count,
      capacity_status: es.capacity_status, capacity_utilization: d.capacity.present ? d.capacity.capacity_utilization : null,
      performance_status: es.performance_status, performance_risk: es.performance_risk,
      overall_performance_score: d.performance.present ? d.performance.overall_performance_score : null,
      evidence_confidence_level: es.evidence_confidence_level, evidence_completeness: es.evidence_completeness,
      top_recommendation: es.top_recommendation, dossier_url: `/pm-registry/${d.pm.pm_id}`,
    };
  });
}

// ─── Test data helpers ────────────────────────────────────────────────────────

function makeDossier({ pmId = "pm-1", status = "active", operationalStatus = "healthy", capacityStatus = null, perfStatus = null, perfRisk = null, confLevel = null } = {}) {
  return {
    pm: { pm_id: pmId, display_name: `PM ${pmId}`, email: `${pmId}@test.com`, status },
    executive_summary: {
      operational_status: operationalStatus, capacity_status: capacityStatus,
      performance_status: perfStatus, performance_risk: perfRisk,
      evidence_confidence_level: confLevel, active_assignment_count: 3,
      counted_assignment_count: 2, role: "project_manager", top_recommendation: null,
      evidence_completeness: null,
    },
    capacity: capacityStatus
      ? { present: true, capacity_status: capacityStatus, capacity_utilization: 0.5, counted_assignment_count: 2, observer_assignment_count: 1, recommendations: [] }
      : { present: false, message: "No snapshot." },
    performance: perfStatus
      ? { present: true, performance_status: perfStatus, performance_risk: perfRisk, overall_performance_score: 75, recommendations: [] }
      : { present: false, message: "No snapshot." },
    evidence_confidence: confLevel
      ? { present: true, confidence_level: confLevel, evidence_completeness: 0.6, missing_sources: ["execution_data"], neutral_baseline_domains: [] }
      : { present: false, message: "No evidence." },
    recommendations: [],
    generated_at: new Date().toISOString(),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("derivePMOOperationalStatus", () => {
  test("returns healthy for empty list", () => {
    assert.equal(derivePMOOperationalStatus([]), "healthy");
  });

  test("returns healthy when all healthy", () => {
    const d = [makeDossier({ operationalStatus: "healthy" }), makeDossier({ pmId: "pm-2", operationalStatus: "healthy" })];
    assert.equal(derivePMOOperationalStatus(d), "healthy");
  });

  test("critical takes precedence", () => {
    const d = [makeDossier({ operationalStatus: "critical" }), makeDossier({ pmId: "pm-2", operationalStatus: "performance_risk" })];
    assert.equal(derivePMOOperationalStatus(d), "critical");
  });

  test("performance_pressure when no critical", () => {
    const d = [makeDossier({ operationalStatus: "performance_risk" }), makeDossier({ pmId: "pm-2", operationalStatus: "capacity_risk" })];
    assert.equal(derivePMOOperationalStatus(d), "performance_pressure");
  });

  test("capacity_pressure when no perf risk", () => {
    const d = [makeDossier({ operationalStatus: "capacity_risk" })];
    assert.equal(derivePMOOperationalStatus(d), "capacity_pressure");
  });

  test("evidence_gap when only insufficient_evidence", () => {
    const d = [makeDossier({ operationalStatus: "insufficient_evidence" })];
    assert.equal(derivePMOOperationalStatus(d), "evidence_gap");
  });

  test("watch when only watch", () => {
    const d = [makeDossier({ operationalStatus: "watch" })];
    assert.equal(derivePMOOperationalStatus(d), "watch");
  });
});

describe("buildPMOPMCounts", () => {
  test("empty list returns zeros", () => {
    const counts = buildPMOPMCounts([]);
    assert.equal(counts.total, 0);
    assert.equal(counts.active, 0);
    assert.deepEqual(counts.by_operational_status, {});
  });

  test("counts by status", () => {
    const d = [
      makeDossier({ pmId: "pm-1", status: "active", operationalStatus: "healthy" }),
      makeDossier({ pmId: "pm-2", status: "inactive", operationalStatus: "watch" }),
      makeDossier({ pmId: "pm-3", status: "suspended", operationalStatus: "healthy" }),
    ];
    const counts = buildPMOPMCounts(d);
    assert.equal(counts.total, 3);
    assert.equal(counts.active, 1);
    assert.equal(counts.inactive, 1);
    assert.equal(counts.suspended, 1);
    assert.equal(counts.by_operational_status.healthy, 2);
    assert.equal(counts.by_operational_status.watch, 1);
  });
});

describe("buildPMOCapacityOverview", () => {
  test("empty list returns nulls and zeros", () => {
    const ov = buildPMOCapacityOverview([]);
    assert.equal(ov.pms_with_capacity_snapshot, 0);
    assert.equal(ov.average_capacity_utilization, null);
    assert.equal(ov.overloaded_count, 0);
  });

  test("missing capacity snapshot counted", () => {
    const d = [makeDossier({ pmId: "pm-1" })];
    const ov = buildPMOCapacityOverview(d);
    assert.equal(ov.pms_missing_capacity_snapshot, 1);
    assert.equal(ov.pms_with_capacity_snapshot, 0);
  });

  test("overloaded PM is captured", () => {
    const d = [makeDossier({ pmId: "pm-1", capacityStatus: "overloaded" })];
    const ov = buildPMOCapacityOverview(d);
    assert.equal(ov.overloaded_count, 1);
    assert.equal(ov.overloaded_pms.length, 1);
    assert.equal(ov.overloaded_pms[0].pm_id, "pm-1");
  });

  test("average capacity utilization computed", () => {
    const d = [
      makeDossier({ pmId: "pm-1", capacityStatus: "healthy" }),
      makeDossier({ pmId: "pm-2", capacityStatus: "near_capacity" }),
    ];
    const ov = buildPMOCapacityOverview(d);
    assert.equal(ov.average_capacity_utilization, 0.5);
  });
});

describe("buildPMOPerformanceOverview", () => {
  test("empty returns zeros and null avg", () => {
    const ov = buildPMOPerformanceOverview([]);
    assert.equal(ov.average_performance_score, null);
    assert.equal(ov.excellent_count, 0);
  });

  test("missing performance snapshot counted", () => {
    const d = [makeDossier({ pmId: "pm-1" })];
    const ov = buildPMOPerformanceOverview(d);
    assert.equal(ov.pms_missing_performance_snapshot, 1);
  });

  test("top performers extracted", () => {
    const d = [makeDossier({ pmId: "pm-1", perfStatus: "excellent" }), makeDossier({ pmId: "pm-2", perfStatus: "strong" })];
    const ov = buildPMOPerformanceOverview(d);
    assert.equal(ov.excellent_count, 1);
    assert.equal(ov.strong_count, 1);
    assert.equal(ov.top_performers.length, 2);
  });

  test("critical performance captured", () => {
    const d = [makeDossier({ pmId: "pm-1", perfStatus: "critical", perfRisk: "critical" })];
    const ov = buildPMOPerformanceOverview(d);
    assert.equal(ov.critical_count, 1);
    assert.equal(ov.critical_pms.length, 1);
    assert(ov.performance_recommendations.some((r) => r.includes("critical")));
  });
});

describe("buildPMOEvidenceConfidenceOverview", () => {
  test("empty returns zeros", () => {
    const ov = buildPMOEvidenceConfidenceOverview([]);
    assert.equal(ov.pms_with_evidence_confidence, 0);
    assert.equal(ov.average_evidence_completeness, null);
  });

  test("very_low confidence captured", () => {
    const d = [makeDossier({ pmId: "pm-1", confLevel: "very_low" })];
    const ov = buildPMOEvidenceConfidenceOverview(d);
    assert.equal(ov.very_low_confidence_count, 1);
    assert.equal(ov.low_confidence_pms.length, 1);
    assert(ov.evidence_recommendations.some((r) => r.includes("very low")));
  });

  test("missing sources aggregated", () => {
    const d1 = makeDossier({ pmId: "pm-1", confLevel: "low" });
    const d2 = makeDossier({ pmId: "pm-2", confLevel: "low" });
    // Both share "execution_data" as missing source
    const ov = buildPMOEvidenceConfidenceOverview([d1, d2]);
    assert.equal(ov.common_missing_sources[0].source, "execution_data");
    assert.equal(ov.common_missing_sources[0].missing_count, 2);
  });
});

describe("buildPMOAttentionQueues", () => {
  test("critical PM goes in critical queue", () => {
    const d = [makeDossier({ pmId: "pm-1", operationalStatus: "critical" })];
    const q = buildPMOAttentionQueues(d);
    assert.equal(q.critical_attention.length, 1);
  });

  test("overloaded PM goes in capacity queue", () => {
    const d = [makeDossier({ pmId: "pm-1", capacityStatus: "overloaded" })];
    const q = buildPMOAttentionQueues(d);
    assert.equal(q.capacity_attention.length, 1);
  });

  test("excellent performer goes in high_performers queue", () => {
    const d = [makeDossier({ pmId: "pm-1", perfStatus: "excellent" })];
    const q = buildPMOAttentionQueues(d);
    assert.equal(q.high_performers.length, 1);
  });

  test("empty dossiers produces empty queues", () => {
    const q = buildPMOAttentionQueues([]);
    assert.equal(q.critical_attention.length, 0);
    assert.equal(q.high_performers.length, 0);
  });
});

describe("buildPMORecommendationQueue", () => {
  test("empty dossiers returns empty queue", () => {
    assert.deepEqual(buildPMORecommendationQueue([]), []);
  });

  test("deduplicates same type+message per PM", () => {
    const d = makeDossier({ pmId: "pm-1" });
    d.recommendations = [
      { type: "foo", severity: "high", message: "Fix it", source: "pm_capacity" },
      { type: "foo", severity: "high", message: "Fix it", source: "pm_capacity" },
    ];
    const q = buildPMORecommendationQueue([d]);
    assert.equal(q.length, 1);
  });

  test("sorted by severity: critical first", () => {
    const d = makeDossier({ pmId: "pm-1" });
    d.recommendations = [
      { type: "a", severity: "low", message: "Low msg", source: "pm_capacity" },
      { type: "b", severity: "critical", message: "Critical msg", source: "pm_capacity" },
    ];
    const q = buildPMORecommendationQueue([d]);
    assert.equal(q[0].severity, "critical");
    assert.equal(q[1].severity, "low");
  });

  test("includes pm_id and pm_name", () => {
    const d = makeDossier({ pmId: "pm-42" });
    d.recommendations = [{ type: "x", severity: "medium", message: "Hello", source: "pm_detail_intelligence" }];
    const q = buildPMORecommendationQueue([d]);
    assert.equal(q[0].pm_id, "pm-42");
    assert.equal(q[0].pm_name, "PM pm-42");
  });
});

describe("buildPMODossierRows", () => {
  test("empty returns empty array", () => {
    assert.deepEqual(buildPMODossierRows([]), []);
  });

  test("maps fields correctly", () => {
    const d = makeDossier({ pmId: "pm-1", status: "active", operationalStatus: "healthy", capacityStatus: "healthy", perfStatus: "strong" });
    const rows = buildPMODossierRows([d]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].pm_id, "pm-1");
    assert.equal(rows[0].pm_status, "active");
    assert.equal(rows[0].operational_status, "healthy");
    assert.equal(rows[0].capacity_status, "healthy");
    assert.equal(rows[0].performance_status, "strong");
    assert.equal(rows[0].dossier_url, "/pm-registry/pm-1");
  });

  test("null capacity and performance when absent", () => {
    const d = makeDossier({ pmId: "pm-1" });
    const rows = buildPMODossierRows([d]);
    assert.equal(rows[0].capacity_utilization, null);
    assert.equal(rows[0].overall_performance_score, null);
  });
});
