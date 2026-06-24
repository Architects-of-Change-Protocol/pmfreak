// tests/pmo-governance-compliance.test.mjs
// Pure-function tests for the PMO Governance Compliance — Operating Discipline
// Snapshot. Mirrors the derivation logic in
// src/lib/pmo-governance-compliance/operating-discipline.ts.

import assert from "node:assert/strict";
import { test, describe } from "node:test";

// ─── Constants ────────────────────────────────────────────────────────────────

const CAPACITY_SNAPSHOT_FRESHNESS_DAYS = 7;
const PERFORMANCE_SNAPSHOT_FRESHNESS_DAYS = 7;

const DOMAIN_WEIGHTS = {
  pm_profile_completeness: 0.15,
  assignment_hygiene: 0.2,
  capacity_governance: 0.2,
  performance_governance: 0.2,
  evidence_readiness: 0.15,
  intervention_readiness: 0.1,
};

const SEVERITY_WEIGHT = { critical: 25, high: 15, medium: 8, low: 3 };
const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const COUNTED_ASSIGNMENT_TYPES = new Set(["primary", "secondary", "program", "observer"]);

// ─── Mirrored pure functions ──────────────────────────────────────────────────

function classifyComplianceStatus(score) {
  if (score >= 90) return "excellent";
  if (score >= 75) return "compliant";
  if (score >= 60) return "watch";
  if (score >= 40) return "non_compliant";
  return "critical";
}

function classifyDomainRisk(score) {
  if (score >= 80) return "low";
  if (score >= 65) return "medium";
  if (score >= 45) return "high";
  return "critical";
}

function deriveComplianceRisk(score, hasCritical, override) {
  if (override) return "critical";
  if (score < 45) return "critical";
  if (score >= 80 && !hasCritical) return "low";
  if (score >= 65) return "medium";
  if (score >= 45) return "high";
  return "critical";
}

function isStale(generatedAt, freshnessDays, now) {
  if (!generatedAt) return false;
  const t = new Date(generatedAt).getTime();
  if (Number.isNaN(t)) return false;
  return (now - t) / (1000 * 60 * 60 * 24) > freshnessDays;
}

function scoreFromViolations(violations) {
  let penalty = 0;
  for (const v of violations) penalty += SEVERITY_WEIGHT[v.severity];
  return Math.max(0, Math.min(100, 100 - penalty));
}

let seq = 0;
function mk(type, severity, domain, base = {}) {
  seq += 1;
  return {
    violation_id: `v_${seq}`,
    violation_type: type,
    severity,
    domain,
    message: `${type} for ${base.pm_name ?? base.project_id ?? "entity"}`,
    recommendation: `fix ${type}`,
    evidence: base.evidence ?? {},
    detected_at: base.detectedAt ?? "2026-06-24T00:00:00.000Z",
    pm_id: base.pm_id,
    pm_name: base.pm_name,
    project_id: base.project_id,
    project_name: base.project_name,
  };
}

function detectProfileViolations(ctx) {
  const out = [];
  const D = "pm_profile_completeness";
  for (const d of ctx.dossiers) {
    const base = { pm_id: d.pm.pm_id, pm_name: d.pm.display_name, detectedAt: ctx.detectedAt };
    if (!d.profile.present) { out.push(mk("PM_PROFILE_MISSING", "high", D, base)); continue; }
    if (!d.profile.role) out.push(mk("PM_ROLE_MISSING", "medium", D, base));
    if (!d.profile.experience_level) out.push(mk("PM_EXPERIENCE_LEVEL_MISSING", "low", D, base));
    if (d.profile.active_projects_limit === null || d.profile.active_projects_limit === undefined)
      out.push(mk("PM_ACTIVE_PROJECTS_LIMIT_MISSING", "medium", D, base));
  }
  return out;
}

function detectAssignmentViolations(ctx) {
  const out = [];
  const D = "assignment_hygiene";
  const prim = new Map();
  for (const d of ctx.dossiers) {
    const base = { pm_id: d.pm.pm_id, pm_name: d.pm.display_name, detectedAt: ctx.detectedAt };
    const active = d.assignments.active;
    if (d.pm.status === "inactive" && active.length > 0) out.push(mk("INACTIVE_PM_HAS_ACTIVE_ASSIGNMENTS", "high", D, base));
    if (d.pm.status === "suspended" && active.length > 0) out.push(mk("SUSPENDED_PM_HAS_ACTIVE_ASSIGNMENTS", "critical", D, base));
    if (d.pm.status === "active" && active.length === 0) out.push(mk("ACTIVE_PM_WITH_NO_ASSIGNMENTS", "low", D, base));
    for (const a of active) {
      if (!COUNTED_ASSIGNMENT_TYPES.has(a.assignment_type)) out.push(mk("INVALID_ASSIGNMENT_TYPE", "medium", D, base));
      if (a.assignment_type === "observer" && a.capacity_counted) out.push(mk("OBSERVER_COUNTED_AS_CAPACITY", "medium", D, base));
      if (a.assignment_type === "primary") {
        const e = prim.get(a.project_id) ?? { name: a.project_name, count: 0 };
        e.count += 1; prim.set(a.project_id, e);
      }
    }
    for (const h of d.assignments.historical) {
      if (!h.removed_at) out.push(mk("HISTORICAL_ASSIGNMENT_MISSING_REMOVED_AT", "low", D, base));
    }
  }
  for (const [pid, info] of prim.entries()) {
    if (info.count > 1) out.push(mk("PROJECT_WITH_MULTIPLE_PRIMARY_PMS", "high", D, { project_id: pid, project_name: info.name, detectedAt: ctx.detectedAt }));
  }
  return out;
}

function detectCapacityViolations(ctx) {
  const out = [];
  const D = "capacity_governance";
  const attn = new Set((ctx.view?.attention_queues.capacity_attention ?? []).map((i) => i.pm_id));
  for (const d of ctx.dossiers) {
    if (d.pm.status !== "active") continue;
    const base = { pm_id: d.pm.pm_id, pm_name: d.pm.display_name, detectedAt: ctx.detectedAt };
    if (!d.capacity.present) { out.push(mk("CAPACITY_SNAPSHOT_MISSING", "high", D, base)); continue; }
    if (isStale(d.capacity.generated_at, CAPACITY_SNAPSHOT_FRESHNESS_DAYS, ctx.now)) out.push(mk("CAPACITY_SNAPSHOT_STALE", "medium", D, base));
    const s = d.capacity.capacity_status;
    const hasRec = d.capacity.recommendations.length > 0;
    if (s === "near_capacity" && !hasRec) out.push(mk("NEAR_CAPACITY_WITHOUT_RECOMMENDATION", "low", D, base));
    if (s === "at_capacity" && !hasRec) out.push(mk("AT_CAPACITY_WITHOUT_RECOMMENDATION", "medium", D, base));
    if ((s === "overloaded" || s === "critical") && !hasRec) out.push(mk("OVERLOADED_WITHOUT_RECOMMENDATION", "high", D, base));
    if ((s === "overloaded" || s === "critical") && !attn.has(d.pm.pm_id)) out.push(mk("OVERLOADED_NOT_IN_ATTENTION_QUEUE", "high", D, base));
  }
  return out;
}

function detectPerformanceViolations(ctx) {
  const out = [];
  const D = "performance_governance";
  const attn = new Set((ctx.view?.attention_queues.performance_attention ?? []).map((i) => i.pm_id));
  for (const d of ctx.dossiers) {
    if (d.pm.status !== "active") continue;
    const base = { pm_id: d.pm.pm_id, pm_name: d.pm.display_name, detectedAt: ctx.detectedAt };
    if (!d.performance.present) { out.push(mk("PERFORMANCE_SNAPSHOT_MISSING", "high", D, base)); continue; }
    if (isStale(d.performance.generated_at, PERFORMANCE_SNAPSHOT_FRESHNESS_DAYS, ctx.now)) out.push(mk("PERFORMANCE_SNAPSHOT_STALE", "medium", D, base));
    const s = d.performance.performance_status;
    const risk = d.performance.performance_risk;
    const hasRec = d.performance.recommendations.length > 0;
    if (s === "warning" && !hasRec) out.push(mk("WARNING_PM_WITHOUT_RECOMMENDATION", "medium", D, base));
    if (s === "critical" && !hasRec) out.push(mk("CRITICAL_PM_WITHOUT_RECOMMENDATION", "high", D, base));
    if ((risk === "high" || risk === "critical") && !attn.has(d.pm.pm_id)) out.push(mk("HIGH_RISK_PM_NOT_IN_ATTENTION_QUEUE", "high", D, base));
    if (!risk) out.push(mk("PERFORMANCE_RISK_MISSING", "low", D, base));
  }
  return out;
}

function detectEvidenceViolations(ctx) {
  const out = [];
  const D = "evidence_readiness";
  for (const d of ctx.dossiers) {
    if (d.pm.status !== "active") continue;
    const base = { pm_id: d.pm.pm_id, pm_name: d.pm.display_name, detectedAt: ctx.detectedAt };
    const ev = d.evidence_confidence;
    if (!ev.present) { out.push(mk("EVIDENCE_CONFIDENCE_MISSING", "medium", D, base)); continue; }
    if (ev.evidence_completeness === null || ev.evidence_completeness === undefined) out.push(mk("EVIDENCE_COMPLETENESS_MISSING", "low", D, base));
    if (!ev.confidence_level) out.push(mk("CONFIDENCE_LEVEL_MISSING", "low", D, base));
    if (!ev.score_interpretation) out.push(mk("SCORE_INTERPRETATION_MISSING", "low", D, base));
    const low = ev.confidence_level === "low" || ev.confidence_level === "very_low";
    if (low && ev.confidence_recommendations.length === 0) out.push(mk("LOW_CONFIDENCE_WITHOUT_RECOMMENDATION", "medium", D, base));
    if (ev.missing_source_count > 0 && (!ev.missing_sources || ev.missing_sources.length === 0)) out.push(mk("MISSING_SOURCES_NOT_RECORDED", "low", D, base));
  }
  return out;
}

function detectInterventionViolations(ctx) {
  const out = [];
  const D = "intervention_readiness";
  const crit = new Set((ctx.view?.attention_queues.critical_attention ?? []).map((i) => i.pm_id));
  for (const d of ctx.dossiers) {
    if (d.pm.status !== "active") continue;
    const base = { pm_id: d.pm.pm_id, pm_name: d.pm.display_name, detectedAt: ctx.detectedAt };
    const op = d.executive_summary.operational_status;
    const hasTop = !!d.executive_summary.top_recommendation;
    if (op === "critical" && !hasTop) out.push(mk("CRITICAL_PM_WITHOUT_TOP_RECOMMENDATION", "critical", D, base));
    if (op === "capacity_risk" && !hasTop) out.push(mk("CAPACITY_RISK_WITHOUT_TOP_RECOMMENDATION", "high", D, base));
    if (op === "performance_risk" && !hasTop) out.push(mk("PERFORMANCE_RISK_WITHOUT_TOP_RECOMMENDATION", "high", D, base));
    if (op === "insufficient_evidence" && !hasTop) out.push(mk("INSUFFICIENT_EVIDENCE_WITHOUT_RECOMMENDATION", "medium", D, base));
    if (op === "critical" && !crit.has(d.pm.pm_id)) out.push(mk("RISKY_PM_NOT_IN_ATTENTION_QUEUE", "high", D, base));
    for (const rec of d.recommendations) {
      if (!rec.severity) out.push(mk("RECOMMENDATION_MISSING_SEVERITY", "low", D, base));
      if (!rec.source) out.push(mk("RECOMMENDATION_MISSING_SOURCE", "low", D, base));
    }
  }
  return out;
}

function buildRecommendations(violations) {
  const groups = new Map();
  for (const v of violations) {
    const key = `${v.domain}::${v.violation_type}`;
    const ex = groups.get(key);
    if (ex) {
      ex.count += 1; ex.types.add(v.violation_type);
      if (SEVERITY_ORDER[v.severity] < SEVERITY_ORDER[ex.severity]) ex.severity = v.severity;
    } else {
      groups.set(key, { domain: v.domain, severity: v.severity, types: new Set([v.violation_type]), sample: v, count: 1 });
    }
  }
  const recs = [];
  for (const g of groups.values()) {
    recs.push({
      type: g.sample.violation_type,
      severity: g.severity,
      domain: g.domain,
      message: `${g.sample.recommendation} (${g.count > 1 ? `${g.count} occurrences` : "1 occurrence"})`,
      source: "pmo_governance_compliance",
      related_violation_types: Array.from(g.types),
    });
  }
  recs.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return recs;
}

function evaluateCriticalOverride(dossiers) {
  const reasons = [];
  const active = dossiers.filter((d) => d.pm.status === "active");
  const n = active.length;
  const overloadedNoRec = active.filter((d) => d.capacity.present && (d.capacity.capacity_status === "overloaded" || d.capacity.capacity_status === "critical") && d.capacity.recommendations.length === 0);
  if (overloadedNoRec.length > 0) reasons.push("overloaded no rec");
  const critNoPerf = active.filter((d) => d.executive_summary.operational_status === "critical" && !d.performance.present);
  if (critNoPerf.length > 0) reasons.push("critical no perf");
  if (n > 0) {
    if (active.filter((d) => !d.capacity.present).length / n > 0.4) reasons.push("missing cap");
    if (active.filter((d) => !d.performance.present).length / n > 0.4) reasons.push("missing perf");
    if (active.filter((d) => d.evidence_confidence.present && (d.evidence_confidence.confidence_level === "low" || d.evidence_confidence.confidence_level === "very_low")).length / n > 0.5) reasons.push("low conf");
  }
  return { triggered: reasons.length > 0, reasons };
}

function assemble(dossiers, view, generatedAt) {
  seq = 0;
  const now = new Date(generatedAt).getTime();
  const ctx = { dossiers, view, now, detectedAt: generatedAt };
  const profileV = detectProfileViolations(ctx);
  const assignmentV = detectAssignmentViolations(ctx);
  const capacityV = detectCapacityViolations(ctx);
  const performanceV = detectPerformanceViolations(ctx);
  const evidenceV = detectEvidenceViolations(ctx);
  const interventionV = detectInterventionViolations(ctx);
  const all = [...profileV, ...assignmentV, ...capacityV, ...performanceV, ...evidenceV, ...interventionV];

  const scores = {
    pm_profile_completeness: scoreFromViolations(profileV),
    assignment_hygiene: scoreFromViolations(assignmentV),
    capacity_governance: scoreFromViolations(capacityV),
    performance_governance: scoreFromViolations(performanceV),
    evidence_readiness: scoreFromViolations(evidenceV),
    intervention_readiness: scoreFromViolations(interventionV),
  };
  let weighted = 0;
  for (const k of Object.keys(DOMAIN_WEIGHTS)) weighted += scores[k] * DOMAIN_WEIGHTS[k];
  const override = evaluateCriticalOverride(dossiers);
  const base = Math.round(weighted * 10) / 10;
  const complianceScore = override.triggered ? Math.min(base, 39) : base;
  const hasCritical = all.some((v) => v.severity === "critical");
  const status = override.triggered ? "critical" : classifyComplianceStatus(complianceScore);
  const risk = deriveComplianceRisk(complianceScore, hasCritical, override.triggered);
  const active = dossiers.filter((d) => d.pm.status === "active");

  return {
    compliance_score: complianceScore,
    compliance_status: status,
    compliance_risk: risk,
    domain_scores: scores,
    violations: all,
    recommendations: buildRecommendations(all),
    summary: {
      total_violations: all.length,
      critical_violations: all.filter((v) => v.severity === "critical").length,
      active_pms_evaluated: active.length,
      critical_override_triggered: override.triggered,
      critical_override_reasons: override.reasons,
    },
    evidence: {
      counts: {
        total_pms: dossiers.length,
        active_pms: active.length,
        pm_dossiers_evaluated: dossiers.length,
        capacity_snapshots_present: dossiers.filter((d) => d.capacity.present).length,
        performance_snapshots_present: dossiers.filter((d) => d.performance.present).length,
        evidence_confidence_present: dossiers.filter((d) => d.evidence_confidence.present).length,
        violations_detected: all.length,
      },
    },
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FRESH = "2026-06-23T00:00:00.000Z";
const STALE = "2026-06-01T00:00:00.000Z";
const NOW = "2026-06-24T00:00:00.000Z";

function fullyCompliantPM(id) {
  return {
    pm: { pm_id: id, display_name: `PM ${id}`, email: `${id}@x.com`, status: "active" },
    profile: { present: true, role: "lead", experience_level: "senior", active_projects_limit: 5 },
    assignments: { active: [{ assignment_id: "a1", project_id: "p1", project_name: "P1", assignment_type: "primary", capacity_counted: true, removed_at: null }], historical: [] },
    executive_summary: { operational_status: "healthy", top_recommendation: null },
    capacity: { present: true, generated_at: FRESH, capacity_status: "healthy", recommendations: [] },
    performance: { present: true, generated_at: FRESH, performance_status: "stable", performance_risk: "low", recommendations: [] },
    evidence_confidence: { present: true, evidence_completeness: 0.9, confidence_level: "high", score_interpretation: "ok", missing_source_count: 0, missing_sources: [], confidence_recommendations: [] },
    recommendations: [],
  };
}

const emptyView = { attention_queues: { capacity_attention: [], performance_attention: [], critical_attention: [] } };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PMO Governance Compliance — snapshot", () => {
  test("returns a snapshot for a healthy workspace", () => {
    const snap = assemble([fullyCompliantPM("1"), fullyCompliantPM("2")], emptyView, NOW);
    assert.ok(snap);
    assert.equal(typeof snap.compliance_score, "number");
    assert.ok(Array.isArray(snap.violations));
  });

  test("computes a high compliance score when fully compliant", () => {
    const snap = assemble([fullyCompliantPM("1")], emptyView, NOW);
    assert.equal(snap.compliance_score, 100);
    assert.equal(snap.violations.length, 0);
  });

  test("derives excellent status", () => {
    assert.equal(classifyComplianceStatus(95), "excellent");
  });
  test("derives compliant status", () => {
    assert.equal(classifyComplianceStatus(80), "compliant");
  });
  test("derives watch status", () => {
    assert.equal(classifyComplianceStatus(65), "watch");
  });
  test("derives non_compliant status", () => {
    assert.equal(classifyComplianceStatus(45), "non_compliant");
  });
  test("derives critical status", () => {
    assert.equal(classifyComplianceStatus(20), "critical");
  });

  test("derives low/medium/high/critical risk", () => {
    assert.equal(deriveComplianceRisk(85, false, false), "low");
    assert.equal(deriveComplianceRisk(70, false, false), "medium");
    assert.equal(deriveComplianceRisk(50, false, false), "high");
    assert.equal(deriveComplianceRisk(30, false, false), "critical");
    assert.equal(deriveComplianceRisk(85, true, false), "medium");
    assert.equal(deriveComplianceRisk(85, false, true), "critical");
  });

  test("domain risk mapping", () => {
    assert.equal(classifyDomainRisk(80), "low");
    assert.equal(classifyDomainRisk(65), "medium");
    assert.equal(classifyDomainRisk(45), "high");
    assert.equal(classifyDomainRisk(10), "critical");
  });
});

describe("PMO Governance Compliance — violation detection", () => {
  test("detects missing profile", () => {
    const pm = fullyCompliantPM("1"); pm.profile = { present: false };
    const v = detectProfileViolations({ dossiers: [pm], detectedAt: NOW });
    assert.ok(v.some((x) => x.violation_type === "PM_PROFILE_MISSING"));
  });
  test("detects missing role", () => {
    const pm = fullyCompliantPM("1"); pm.profile.role = "";
    const v = detectProfileViolations({ dossiers: [pm], detectedAt: NOW });
    assert.ok(v.some((x) => x.violation_type === "PM_ROLE_MISSING"));
  });
  test("detects missing active_projects_limit", () => {
    const pm = fullyCompliantPM("1"); pm.profile.active_projects_limit = null;
    const v = detectProfileViolations({ dossiers: [pm], detectedAt: NOW });
    assert.ok(v.some((x) => x.violation_type === "PM_ACTIVE_PROJECTS_LIMIT_MISSING"));
  });
  test("detects inactive PM with active assignments", () => {
    const pm = fullyCompliantPM("1"); pm.pm.status = "inactive";
    const v = detectAssignmentViolations({ dossiers: [pm], detectedAt: NOW });
    assert.ok(v.some((x) => x.violation_type === "INACTIVE_PM_HAS_ACTIVE_ASSIGNMENTS"));
  });
  test("detects multiple primary PMs on a project", () => {
    const a = fullyCompliantPM("1"); const b = fullyCompliantPM("2");
    const v = detectAssignmentViolations({ dossiers: [a, b], detectedAt: NOW });
    assert.ok(v.some((x) => x.violation_type === "PROJECT_WITH_MULTIPLE_PRIMARY_PMS"));
  });
  test("detects missing capacity snapshot", () => {
    const pm = fullyCompliantPM("1"); pm.capacity = { present: false };
    const v = detectCapacityViolations({ dossiers: [pm], now: new Date(NOW).getTime(), detectedAt: NOW, view: emptyView });
    assert.ok(v.some((x) => x.violation_type === "CAPACITY_SNAPSHOT_MISSING"));
  });
  test("detects stale capacity snapshot", () => {
    const pm = fullyCompliantPM("1"); pm.capacity.generated_at = STALE;
    const v = detectCapacityViolations({ dossiers: [pm], now: new Date(NOW).getTime(), detectedAt: NOW, view: emptyView });
    assert.ok(v.some((x) => x.violation_type === "CAPACITY_SNAPSHOT_STALE"));
  });
  test("detects overloaded without recommendation", () => {
    const pm = fullyCompliantPM("1"); pm.capacity.capacity_status = "overloaded"; pm.capacity.recommendations = [];
    const v = detectCapacityViolations({ dossiers: [pm], now: new Date(NOW).getTime(), detectedAt: NOW, view: emptyView });
    assert.ok(v.some((x) => x.violation_type === "OVERLOADED_WITHOUT_RECOMMENDATION"));
    assert.ok(v.some((x) => x.violation_type === "OVERLOADED_NOT_IN_ATTENTION_QUEUE"));
  });
  test("detects missing performance snapshot", () => {
    const pm = fullyCompliantPM("1"); pm.performance = { present: false };
    const v = detectPerformanceViolations({ dossiers: [pm], now: new Date(NOW).getTime(), detectedAt: NOW, view: emptyView });
    assert.ok(v.some((x) => x.violation_type === "PERFORMANCE_SNAPSHOT_MISSING"));
  });
  test("detects stale performance snapshot", () => {
    const pm = fullyCompliantPM("1"); pm.performance.generated_at = STALE;
    const v = detectPerformanceViolations({ dossiers: [pm], now: new Date(NOW).getTime(), detectedAt: NOW, view: emptyView });
    assert.ok(v.some((x) => x.violation_type === "PERFORMANCE_SNAPSHOT_STALE"));
  });
  test("detects warning PM without recommendation", () => {
    const pm = fullyCompliantPM("1"); pm.performance.performance_status = "warning"; pm.performance.recommendations = [];
    const v = detectPerformanceViolations({ dossiers: [pm], now: new Date(NOW).getTime(), detectedAt: NOW, view: emptyView });
    assert.ok(v.some((x) => x.violation_type === "WARNING_PM_WITHOUT_RECOMMENDATION"));
  });
  test("detects critical PM without recommendation", () => {
    const pm = fullyCompliantPM("1"); pm.performance.performance_status = "critical"; pm.performance.recommendations = [];
    const v = detectPerformanceViolations({ dossiers: [pm], now: new Date(NOW).getTime(), detectedAt: NOW, view: emptyView });
    assert.ok(v.some((x) => x.violation_type === "CRITICAL_PM_WITHOUT_RECOMMENDATION"));
  });
  test("detects missing evidence confidence", () => {
    const pm = fullyCompliantPM("1"); pm.evidence_confidence = { present: false };
    const v = detectEvidenceViolations({ dossiers: [pm], detectedAt: NOW });
    assert.ok(v.some((x) => x.violation_type === "EVIDENCE_CONFIDENCE_MISSING"));
  });
  test("detects low confidence without recommendation", () => {
    const pm = fullyCompliantPM("1"); pm.evidence_confidence.confidence_level = "low"; pm.evidence_confidence.confidence_recommendations = [];
    const v = detectEvidenceViolations({ dossiers: [pm], detectedAt: NOW });
    assert.ok(v.some((x) => x.violation_type === "LOW_CONFIDENCE_WITHOUT_RECOMMENDATION"));
  });
  test("detects critical PM without top recommendation", () => {
    const pm = fullyCompliantPM("1"); pm.executive_summary.operational_status = "critical"; pm.executive_summary.top_recommendation = null;
    const v = detectInterventionViolations({ dossiers: [pm], detectedAt: NOW, view: emptyView });
    assert.ok(v.some((x) => x.violation_type === "CRITICAL_PM_WITHOUT_TOP_RECOMMENDATION"));
  });
  test("detects risky PM not in attention queue", () => {
    const pm = fullyCompliantPM("1"); pm.executive_summary.operational_status = "critical"; pm.executive_summary.top_recommendation = "x";
    const v = detectInterventionViolations({ dossiers: [pm], detectedAt: NOW, view: emptyView });
    assert.ok(v.some((x) => x.violation_type === "RISKY_PM_NOT_IN_ATTENTION_QUEUE"));
  });
});

describe("PMO Governance Compliance — recommendations & evidence", () => {
  test("builds recommendations from violations grouped by type", () => {
    const a = fullyCompliantPM("1"); a.profile = { present: false };
    const b = fullyCompliantPM("2"); b.profile = { present: false };
    const snap = assemble([a, b], emptyView, NOW);
    const rec = snap.recommendations.find((r) => r.type === "PM_PROFILE_MISSING");
    assert.ok(rec);
    assert.match(rec.message, /2 occurrences/);
  });

  test("builds evidence summary counts", () => {
    const snap = assemble([fullyCompliantPM("1"), fullyCompliantPM("2")], emptyView, NOW);
    assert.equal(snap.evidence.counts.total_pms, 2);
    assert.equal(snap.evidence.counts.active_pms, 2);
    assert.equal(snap.evidence.counts.capacity_snapshots_present, 2);
  });

  test("critical override forces critical status when >40% missing capacity", () => {
    const a = fullyCompliantPM("1"); a.capacity = { present: false };
    const b = fullyCompliantPM("2"); b.capacity = { present: false };
    const c = fullyCompliantPM("3");
    const snap = assemble([a, b, c], emptyView, NOW);
    assert.equal(snap.summary.critical_override_triggered, true);
    assert.equal(snap.compliance_status, "critical");
    assert.equal(snap.compliance_risk, "critical");
    assert.ok(snap.compliance_score <= 39);
  });

  test("handles empty workspace gracefully", () => {
    const snap = assemble([], null, NOW);
    assert.equal(snap.compliance_score, 100);
    assert.equal(snap.compliance_status, "excellent");
    assert.equal(snap.summary.total_violations, 0);
    assert.equal(snap.evidence.counts.total_pms, 0);
  });

  test("handles missing PMO Command Center view gracefully", () => {
    const pm = fullyCompliantPM("1"); pm.capacity.capacity_status = "overloaded"; pm.capacity.recommendations = [];
    const snap = assemble([pm], null, NOW);
    // With null view, overloaded PM is treated as not in attention queue.
    assert.ok(snap.violations.some((v) => v.violation_type === "OVERLOADED_NOT_IN_ATTENTION_QUEUE"));
  });
});
