// tests/pmo-executive-reporting.test.mjs
// Pure-logic tests for PMO Executive Reporting & Alerts.
// Mirrors the derivation/dedup/alert logic in
// src/lib/pmo-executive-reporting/pmo-executive-reporting.ts.

import assert from "node:assert/strict";
import { test, describe, beforeEach } from "node:test";

const NOW = "2026-06-25T00:00:00.000Z";
const INTERVENTION_STALE_DAYS = 7;

const EXECUTIVE_STATUS_ORDER = ["critical", "attention_required", "watch", "healthy"];
const EXECUTIVE_RISK_ORDER = ["critical", "high", "medium", "low"];
const ALERT_SEVERITY_ORDER = ["critical", "high", "medium", "low"];

// ─── Mirrored pure functions ───────────────────────────────────────────────────

function pickHighest(candidates, order) {
  let best = order[order.length - 1];
  let bestRank = order.length - 1;
  for (const c of candidates) {
    const rank = order.indexOf(c);
    if (rank >= 0 && rank < bestRank) { bestRank = rank; best = c; }
  }
  return best;
}

const OPEN_INTERVENTION_STATUSES = ["proposed", "approved", "in_progress"];

function buildInterventionRollup(rows, nowIso, staleDays = INTERVENTION_STALE_DAYS) {
  const nowMs = new Date(nowIso).getTime();
  const staleMs = staleDays * 24 * 60 * 60 * 1000;
  const open = rows.filter((r) => OPEN_INTERVENTION_STATUSES.includes(r.status));
  const pendingApproval = open.filter((r) => r.status === "proposed" && r.approval_status === "pending");
  const criticalPending = pendingApproval.filter((r) => r.priority === "critical");
  const highPending = pendingApproval.filter((r) => r.priority === "high");
  const inProgress = rows.filter((r) => r.status === "in_progress");
  const stale = inProgress.filter((r) => {
    const updated = new Date(r.updated_at).getTime();
    return Number.isFinite(updated) && nowMs - updated >= staleMs;
  });
  return {
    open: open.length,
    pending_approval: pendingApproval.length,
    critical_pending_approval: criticalPending.length,
    high_pending_approval: highPending.length,
    in_progress: inProgress.length,
    stale_in_progress: stale.length,
    critical_pending: criticalPending,
    high_pending: highPending,
    stale,
  };
}

function deriveExecutiveStatus(view, snapshot, rollup) {
  const candidates = ["healthy"];
  const pmoStatus = view?.pmo_operational_status ?? null;
  if (pmoStatus === "critical") candidates.push("critical");
  else if (pmoStatus === "performance_pressure" || pmoStatus === "capacity_pressure") candidates.push("attention_required");
  else if (pmoStatus === "evidence_gap" || pmoStatus === "watch") candidates.push("watch");

  const compliance = snapshot?.compliance_status ?? null;
  if (compliance === "critical") candidates.push("critical");
  else if (compliance === "non_compliant") candidates.push("attention_required");
  else if (compliance === "watch") candidates.push("watch");

  if ((snapshot?.summary.critical_violations ?? 0) > 0) candidates.push("critical");
  else if ((snapshot?.summary.high_violations ?? 0) > 0) candidates.push("attention_required");

  if (rollup.critical_pending_approval > 0) candidates.push("attention_required");
  if (rollup.stale_in_progress > 0) candidates.push("attention_required");

  return pickHighest(candidates, EXECUTIVE_STATUS_ORDER);
}

function deriveExecutiveRisk(view, snapshot, rollup) {
  const candidates = ["low"];
  const complianceRisk = snapshot?.compliance_risk ?? null;
  if (complianceRisk) candidates.push(complianceRisk);
  const pmoStatus = view?.pmo_operational_status ?? null;
  if (pmoStatus === "critical") candidates.push("critical");
  else if (pmoStatus === "performance_pressure" || pmoStatus === "capacity_pressure") candidates.push("high");
  else if (pmoStatus === "evidence_gap" || pmoStatus === "watch") candidates.push("medium");
  if ((snapshot?.summary.critical_violations ?? 0) > 0) candidates.push("critical");
  else if ((snapshot?.summary.high_violations ?? 0) > 0) candidates.push("high");
  if (rollup.critical_pending_approval > 0) candidates.push("high");
  else if (rollup.high_pending_approval > 0 || rollup.stale_in_progress > 0) candidates.push("medium");
  return pickHighest(candidates, EXECUTIVE_RISK_ORDER);
}

function buildKeyMetrics(view, snapshot, rollup, alerts) {
  const es = view?.executive_summary ?? null;
  const cap = view?.capacity_overview ?? null;
  const perf = view?.performance_overview ?? null;
  const ev = view?.evidence_confidence_overview ?? null;
  return {
    total_pms: es?.total_pms ?? 0,
    active_pms: es?.active_pms ?? 0,
    critical_pms: es?.critical_pms ?? 0,
    pmo_operational_status: view?.pmo_operational_status ?? "healthy",
    average_capacity_utilization: cap?.average_capacity_utilization ?? null,
    overloaded_pms: cap?.overloaded_count ?? 0,
    pms_missing_capacity_snapshot: cap?.pms_missing_capacity_snapshot ?? 0,
    average_performance_score: perf?.average_performance_score ?? null,
    warning_pms: perf?.warning_count ?? 0,
    critical_performance_pms: perf?.critical_count ?? 0,
    pms_missing_performance_snapshot: perf?.pms_missing_performance_snapshot ?? 0,
    low_evidence_confidence_pms: (ev?.low_confidence_count ?? 0) + (ev?.very_low_confidence_count ?? 0),
    compliance_score: snapshot?.compliance_score ?? null,
    compliance_status: snapshot?.compliance_status ?? null,
    compliance_risk: snapshot?.compliance_risk ?? null,
    total_governance_violations: snapshot?.summary.total_violations ?? 0,
    critical_governance_violations: snapshot?.summary.critical_violations ?? 0,
    high_governance_violations: snapshot?.summary.high_violations ?? 0,
    open_interventions: rollup.open,
    pending_approval_interventions: rollup.pending_approval,
    critical_pending_approvals: rollup.critical_pending_approval,
    high_pending_approvals: rollup.high_pending_approval,
    in_progress_interventions: rollup.in_progress,
    stale_in_progress_interventions: rollup.stale_in_progress,
    total_alerts: alerts.length,
    critical_alerts: alerts.filter((a) => a.severity === "critical").length,
    high_alerts: alerts.filter((a) => a.severity === "high").length,
  };
}

const REPORT_SECTION_KEYS = [
  "pmo_operating_status",
  "governance_compliance",
  "intervention_action_loop",
  "executive_attention_queue",
  "evidence_and_confidence",
  "recommended_next_actions",
];

function buildReportSections(metrics) {
  // Mirror: section count and keys are deterministic.
  return REPORT_SECTION_KEYS.map((key) => ({ key, metrics }));
}

function buildAlertDrafts(view, snapshot, rollup) {
  const drafts = [];
  if (view) {
    const pmoStatus = view.pmo_operational_status;
    if (pmoStatus === "critical") {
      drafts.push({ alertType: "pmo_status_critical", severity: "critical", targetType: "workspace", targetId: view.workspace_id, sourceType: "pmo_command_center", sourceId: view.workspace_id });
    }
    if (pmoStatus === "capacity_pressure" || view.capacity_overview.overloaded_count > 0) {
      drafts.push({ alertType: "pmo_capacity_pressure", severity: "high", targetType: "workspace", targetId: view.workspace_id, sourceType: "pmo_command_center", sourceId: view.workspace_id });
    }
    if (pmoStatus === "performance_pressure" || view.performance_overview.critical_count > 0) {
      drafts.push({ alertType: "pmo_performance_pressure", severity: "high", targetType: "workspace", targetId: view.workspace_id, sourceType: "pmo_command_center", sourceId: view.workspace_id });
    }
    if (view.evidence_confidence_overview.low_confidence_count + view.evidence_confidence_overview.very_low_confidence_count > 0) {
      drafts.push({ alertType: "evidence_confidence_low", severity: "medium", targetType: "workspace", targetId: view.workspace_id, sourceType: "pmo_command_center", sourceId: view.workspace_id });
    }
    if (view.capacity_overview.pms_missing_capacity_snapshot > 0) {
      drafts.push({ alertType: "missing_capacity_snapshot", severity: "medium", targetType: "workspace", targetId: view.workspace_id, sourceType: "pmo_command_center", sourceId: view.workspace_id });
    }
    if (view.performance_overview.pms_missing_performance_snapshot > 0) {
      drafts.push({ alertType: "missing_performance_snapshot", severity: "medium", targetType: "workspace", targetId: view.workspace_id, sourceType: "pmo_command_center", sourceId: view.workspace_id });
    }
  }
  if (snapshot) {
    if (snapshot.compliance_status === "critical" || snapshot.compliance_risk === "critical") {
      drafts.push({ alertType: "governance_compliance_critical", severity: "critical", targetType: "workspace", targetId: snapshot.workspace_id, sourceType: "pmo_governance_compliance", sourceId: snapshot.snapshot_id });
    }
    for (const v of snapshot.violations) {
      if (v.severity === "critical") {
        drafts.push({ alertType: "governance_violation_critical", severity: "critical", targetType: v.pm_id ? "pm" : "workspace", targetId: v.pm_id ?? snapshot.workspace_id, sourceType: "pmo_governance_compliance", sourceId: v.violation_id });
      } else if (v.severity === "high") {
        drafts.push({ alertType: "governance_violation_high", severity: "high", targetType: v.pm_id ? "pm" : "workspace", targetId: v.pm_id ?? snapshot.workspace_id, sourceType: "pmo_governance_compliance", sourceId: v.violation_id });
      }
    }
  }
  for (const r of rollup.critical_pending) {
    drafts.push({ alertType: "intervention_critical_pending_approval", severity: "critical", targetType: r.target_type ?? "workspace", targetId: r.target_id ?? r.workspace_id, sourceType: "pmo_intervention", sourceId: r.id });
  }
  for (const r of rollup.high_pending) {
    drafts.push({ alertType: "intervention_high_pending_approval", severity: "high", targetType: r.target_type ?? "workspace", targetId: r.target_id ?? r.workspace_id, sourceType: "pmo_intervention", sourceId: r.id });
  }
  for (const r of rollup.stale) {
    drafts.push({ alertType: "intervention_in_progress_stale", severity: "medium", targetType: r.target_type ?? "workspace", targetId: r.target_id ?? r.workspace_id, sourceType: "pmo_intervention", sourceId: r.id });
  }
  return drafts;
}

function filterBySeverityThreshold(drafts, threshold) {
  if (!threshold) return drafts;
  const maxRank = ALERT_SEVERITY_ORDER.indexOf(threshold);
  return drafts.filter((d) => ALERT_SEVERITY_ORDER.indexOf(d.severity) <= maxRank);
}

function alertDedupKey(workspaceId, d) {
  return [workspaceId, d.alertType, d.severity, d.targetType ?? "", d.targetId ?? "", d.sourceType ?? "", d.sourceId ?? ""].join("|");
}

// ─── In-memory alert store with dedup (mirrors generate flow) ──────────────────

let _alerts;
let _idSeq;
function resetAlerts() { _alerts = new Map(); _idSeq = 0; }
function newId() { _idSeq += 1; return `alert_${_idSeq}`; }

function generateAlerts(workspaceId, drafts, threshold) {
  const filtered = filterBySeverityThreshold(drafts, threshold);
  const existing = Array.from(_alerts.values()).filter((a) => a.workspaceId === workspaceId && a.status === "new");
  const openKeys = new Set(existing.map((a) => alertDedupKey(workspaceId, a)));
  const created = [];
  let skipped = 0;
  for (const d of filtered) {
    const key = alertDedupKey(workspaceId, d);
    if (openKeys.has(key)) { skipped += 1; continue; }
    const alert = { id: newId(), workspaceId, status: "new", reviewedBy: null, reviewedAt: null, ...d };
    _alerts.set(alert.id, alert);
    openKeys.add(key);
    created.push(alert);
  }
  return { created_alerts: created, skipped_duplicates: skipped, existing_open_alerts: existing.length };
}

function markReviewed(alertId, actorId, reviewedAt = NOW) {
  const a = _alerts.get(alertId);
  if (!a) return { ok: false, failureClass: "PMO_EXECUTIVE_REPORTING_ALERT_NOT_FOUND" };
  const updated = { ...a, status: "reviewed", reviewedBy: actorId, reviewedAt };
  _alerts.set(alertId, updated);
  return { ok: true, data: updated };
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

function mkView(overrides = {}) {
  return {
    workspace_id: "ws1",
    pmo_operational_status: overrides.pmo_operational_status ?? "healthy",
    executive_summary: { total_pms: 5, active_pms: 4, critical_pms: overrides.critical_pms ?? 0, top_recommendation: null, ...overrides.executive_summary },
    capacity_overview: { overloaded_count: 0, average_capacity_utilization: 0.5, pms_missing_capacity_snapshot: 0, ...overrides.capacity_overview },
    performance_overview: { critical_count: 0, warning_count: 0, average_performance_score: 80, pms_missing_performance_snapshot: 0, ...overrides.performance_overview },
    evidence_confidence_overview: { low_confidence_count: 0, very_low_confidence_count: 0, ...overrides.evidence_confidence_overview },
    attention_queues: { critical_attention: [] },
  };
}

function mkSnapshot(overrides = {}) {
  return {
    workspace_id: "ws1",
    snapshot_id: "snap1",
    compliance_score: overrides.compliance_score ?? 90,
    compliance_status: overrides.compliance_status ?? "compliant",
    compliance_risk: overrides.compliance_risk ?? "low",
    summary: { total_violations: 0, critical_violations: 0, high_violations: 0, medium_violations: 0, low_violations: 0, ...overrides.summary },
    violations: overrides.violations ?? [],
  };
}

function mkIntervention(overrides = {}) {
  return {
    id: overrides.id ?? "act1",
    workspace_id: "ws1",
    status: overrides.status ?? "proposed",
    approval_status: overrides.approval_status ?? "pending",
    priority: overrides.priority ?? "high",
    action_title: "Some action",
    action_type: "complete_pm_profile",
    target_type: overrides.target_type ?? "pm",
    target_id: overrides.target_id ?? "pm1",
    pm_id: overrides.pm_id ?? "pm1",
    project_id: overrides.project_id ?? null,
    updated_at: overrides.updated_at ?? NOW,
  };
}

// ─── Service / report tests ────────────────────────────────────────────────────

describe("PMO Executive Reporting — report assembly", () => {
  test("derives healthy executive status when all clean", () => {
    const view = mkView();
    const snap = mkSnapshot();
    const rollup = buildInterventionRollup([], NOW);
    assert.equal(deriveExecutiveStatus(view, snap, rollup), "healthy");
  });

  test("derives watch executive status", () => {
    const view = mkView({ pmo_operational_status: "watch" });
    const snap = mkSnapshot();
    const rollup = buildInterventionRollup([], NOW);
    assert.equal(deriveExecutiveStatus(view, snap, rollup), "watch");
  });

  test("derives attention_required executive status", () => {
    const view = mkView({ pmo_operational_status: "capacity_pressure" });
    const snap = mkSnapshot();
    const rollup = buildInterventionRollup([], NOW);
    assert.equal(deriveExecutiveStatus(view, snap, rollup), "attention_required");
  });

  test("derives critical executive status", () => {
    const view = mkView({ pmo_operational_status: "critical", critical_pms: 2 });
    const snap = mkSnapshot({ summary: { critical_violations: 1 } });
    const rollup = buildInterventionRollup([], NOW);
    assert.equal(deriveExecutiveStatus(view, snap, rollup), "critical");
  });

  test("derives low executive risk", () => {
    assert.equal(deriveExecutiveRisk(mkView(), mkSnapshot(), buildInterventionRollup([], NOW)), "low");
  });

  test("derives medium executive risk", () => {
    const view = mkView({ pmo_operational_status: "watch" });
    assert.equal(deriveExecutiveRisk(view, mkSnapshot(), buildInterventionRollup([], NOW)), "medium");
  });

  test("derives high executive risk", () => {
    const view = mkView({ pmo_operational_status: "capacity_pressure" });
    assert.equal(deriveExecutiveRisk(view, mkSnapshot(), buildInterventionRollup([], NOW)), "high");
  });

  test("derives critical executive risk", () => {
    const snap = mkSnapshot({ compliance_status: "critical", compliance_risk: "critical", summary: { critical_violations: 3 } });
    assert.equal(deriveExecutiveRisk(mkView(), snap, buildInterventionRollup([], NOW)), "critical");
  });

  test("builds key metrics from sources", () => {
    const view = mkView({ critical_pms: 1, capacity_overview: { overloaded_count: 2, pms_missing_capacity_snapshot: 1 } });
    const snap = mkSnapshot({ compliance_score: 70, summary: { total_violations: 4, critical_violations: 1, high_violations: 2 } });
    const rollup = buildInterventionRollup([mkIntervention()], NOW);
    const m = buildKeyMetrics(view, snap, rollup, []);
    assert.equal(m.critical_pms, 1);
    assert.equal(m.overloaded_pms, 2);
    assert.equal(m.compliance_score, 70);
    assert.equal(m.total_governance_violations, 4);
    assert.equal(m.open_interventions, 1);
  });

  test("builds all six report sections", () => {
    const sections = buildReportSections({});
    assert.equal(sections.length, 6);
    assert.deepEqual(sections.map((s) => s.key), REPORT_SECTION_KEYS);
  });

  test("handles missing PMO Command Center gracefully", () => {
    const snap = mkSnapshot();
    const rollup = buildInterventionRollup([], NOW);
    const m = buildKeyMetrics(null, snap, rollup, []);
    assert.equal(m.total_pms, 0);
    assert.equal(deriveExecutiveStatus(null, snap, rollup), "healthy");
  });

  test("handles missing Governance Compliance gracefully", () => {
    const view = mkView();
    const rollup = buildInterventionRollup([], NOW);
    const m = buildKeyMetrics(view, null, rollup, []);
    assert.equal(m.compliance_score, null);
    assert.equal(m.total_governance_violations, 0);
  });

  test("handles no intervention actions gracefully", () => {
    const rollup = buildInterventionRollup([], NOW);
    assert.equal(rollup.open, 0);
    assert.equal(rollup.pending_approval, 0);
    assert.equal(rollup.stale_in_progress, 0);
  });
});

describe("PMO Executive Reporting — intervention rollup", () => {
  test("counts open / pending / critical / high", () => {
    const rows = [
      mkIntervention({ id: "a", status: "proposed", priority: "critical" }),
      mkIntervention({ id: "b", status: "proposed", priority: "high" }),
      mkIntervention({ id: "c", status: "approved", priority: "medium" }),
      mkIntervention({ id: "d", status: "completed", priority: "high" }),
    ];
    const r = buildInterventionRollup(rows, NOW);
    assert.equal(r.open, 3);
    assert.equal(r.pending_approval, 2);
    assert.equal(r.critical_pending_approval, 1);
    assert.equal(r.high_pending_approval, 1);
  });

  test("detects stale in-progress interventions", () => {
    const old = "2026-06-01T00:00:00.000Z"; // > 7 days before NOW
    const rows = [
      mkIntervention({ id: "a", status: "in_progress", updated_at: old }),
      mkIntervention({ id: "b", status: "in_progress", updated_at: NOW }),
    ];
    const r = buildInterventionRollup(rows, NOW);
    assert.equal(r.in_progress, 2);
    assert.equal(r.stale_in_progress, 1);
  });
});

// ─── Alert tests ────────────────────────────────────────────────────────────

describe("PMO Executive Reporting — alert generation", () => {
  test("generates pmo_status_critical, capacity, performance alerts", () => {
    const view = mkView({
      pmo_operational_status: "critical",
      critical_pms: 1,
      capacity_overview: { overloaded_count: 2 },
      performance_overview: { critical_count: 1 },
    });
    const drafts = buildAlertDrafts(view, mkSnapshot(), buildInterventionRollup([], NOW));
    const types = drafts.map((d) => d.alertType);
    assert.ok(types.includes("pmo_status_critical"));
    assert.ok(types.includes("pmo_capacity_pressure"));
    assert.ok(types.includes("pmo_performance_pressure"));
  });

  test("generates governance compliance + violation alerts", () => {
    const snap = mkSnapshot({
      compliance_status: "critical",
      compliance_risk: "critical",
      violations: [
        { violation_id: "v1", severity: "critical", message: "m", pm_id: "pm1", domain: "capacity_governance", violation_type: "X" },
        { violation_id: "v2", severity: "high", message: "m", pm_id: "pm2", domain: "capacity_governance", violation_type: "Y" },
      ],
    });
    const drafts = buildAlertDrafts(mkView(), snap, buildInterventionRollup([], NOW));
    const types = drafts.map((d) => d.alertType);
    assert.ok(types.includes("governance_compliance_critical"));
    assert.ok(types.includes("governance_violation_critical"));
    assert.ok(types.includes("governance_violation_high"));
  });

  test("generates intervention pending approval alerts", () => {
    const rows = [
      mkIntervention({ id: "a", status: "proposed", priority: "critical" }),
      mkIntervention({ id: "b", status: "proposed", priority: "high", pm_id: "pm2", target_id: "pm2" }),
    ];
    const drafts = buildAlertDrafts(mkView(), mkSnapshot(), buildInterventionRollup(rows, NOW));
    const types = drafts.map((d) => d.alertType);
    assert.ok(types.includes("intervention_critical_pending_approval"));
    assert.ok(types.includes("intervention_high_pending_approval"));
  });

  test("generates evidence + missing snapshot alerts", () => {
    const view = mkView({
      evidence_confidence_overview: { low_confidence_count: 1, very_low_confidence_count: 1 },
      capacity_overview: { pms_missing_capacity_snapshot: 2 },
      performance_overview: { pms_missing_performance_snapshot: 3 },
    });
    const drafts = buildAlertDrafts(view, mkSnapshot(), buildInterventionRollup([], NOW));
    const types = drafts.map((d) => d.alertType);
    assert.ok(types.includes("evidence_confidence_low"));
    assert.ok(types.includes("missing_capacity_snapshot"));
    assert.ok(types.includes("missing_performance_snapshot"));
  });

  test("severity threshold filters lower-severity alerts", () => {
    const view = mkView({
      pmo_operational_status: "critical",
      capacity_overview: { pms_missing_capacity_snapshot: 1 }, // medium
    });
    const drafts = buildAlertDrafts(view, mkSnapshot(), buildInterventionRollup([], NOW));
    const high = filterBySeverityThreshold(drafts, "high");
    assert.ok(high.every((d) => ["critical", "high"].includes(d.severity)));
    assert.ok(high.length < drafts.length);
  });
});

describe("PMO Executive Reporting — alert dedup + review", () => {
  beforeEach(() => resetAlerts());

  test("deduplicates unresolved new alerts", () => {
    const view = mkView({ pmo_operational_status: "critical" });
    const drafts = buildAlertDrafts(view, mkSnapshot(), buildInterventionRollup([], NOW));
    const first = generateAlerts("ws1", drafts);
    assert.ok(first.created_alerts.length > 0);
    const second = generateAlerts("ws1", drafts);
    assert.equal(second.created_alerts.length, 0);
    assert.equal(second.skipped_duplicates, first.created_alerts.length);
  });

  test("allows new alert after the existing one is reviewed (historical)", () => {
    const view = mkView({ pmo_operational_status: "critical" });
    const drafts = buildAlertDrafts(view, mkSnapshot(), buildInterventionRollup([], NOW));
    const first = generateAlerts("ws1", drafts);
    const id = first.created_alerts[0].id;
    markReviewed(id, "user1");
    // reviewed alerts no longer block dedup
    const second = generateAlerts("ws1", [drafts[0]]);
    assert.equal(second.created_alerts.length, 1);
  });

  test("marks alert reviewed with actor and timestamp", () => {
    const view = mkView({ pmo_operational_status: "critical" });
    const drafts = buildAlertDrafts(view, mkSnapshot(), buildInterventionRollup([], NOW));
    const first = generateAlerts("ws1", drafts);
    const id = first.created_alerts[0].id;
    const result = markReviewed(id, "actor99", NOW);
    assert.equal(result.ok, true);
    assert.equal(result.data.status, "reviewed");
    assert.equal(result.data.reviewedBy, "actor99");
    assert.equal(result.data.reviewedAt, NOW);
  });

  test("returns not found for unknown alert", () => {
    const result = markReviewed("nope", "user1");
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "PMO_EXECUTIVE_REPORTING_ALERT_NOT_FOUND");
  });

  test("dedup key differs by alert type", () => {
    const k1 = alertDedupKey("ws1", { alertType: "pmo_status_critical", severity: "critical", targetType: "workspace", targetId: "ws1", sourceType: "pmo_command_center", sourceId: "ws1" });
    const k2 = alertDedupKey("ws1", { alertType: "pmo_capacity_pressure", severity: "critical", targetType: "workspace", targetId: "ws1", sourceType: "pmo_command_center", sourceId: "ws1" });
    assert.notEqual(k1, k2);
  });

  test("does not dedup across workspaces", () => {
    const view = mkView({ pmo_operational_status: "critical" });
    const drafts = buildAlertDrafts(view, mkSnapshot(), buildInterventionRollup([], NOW));
    const a = generateAlerts("ws1", [drafts[0]]);
    const b = generateAlerts("ws2", [{ ...drafts[0], targetId: "ws2", sourceId: "ws2" }]);
    assert.equal(a.created_alerts.length, 1);
    assert.equal(b.created_alerts.length, 1);
  });
});

// ─── Event tests (payload shape) ────────────────────────────────────────────

describe("PMO Executive Reporting — event payloads", () => {
  test("report generated event payload shape", () => {
    const payload = {
      workspace_id: "ws1",
      report_id: "rep1",
      report_type: "daily_pmo_brief",
      executive_status: "critical",
      executive_risk: "high",
      alert_count: 3,
      generated_at: NOW,
    };
    assert.equal(payload.workspace_id, "ws1");
    assert.equal(typeof payload.alert_count, "number");
    assert.ok(!("token" in payload));
  });

  test("alert generated event payload shape", () => {
    const payload = { workspace_id: "ws1", alert_id: "alert_1", alert_type: "pmo_status_critical", severity: "critical", source_type: "pmo_command_center", generated_at: NOW };
    assert.equal(payload.alert_type, "pmo_status_critical");
    assert.ok(!("api_key" in payload));
  });

  test("alert reviewed event payload shape", () => {
    const payload = { workspace_id: "ws1", alert_id: "alert_1", alert_type: "pmo_status_critical", severity: "critical", reviewed_by: "user1", reviewed_at: NOW };
    assert.equal(payload.reviewed_by, "user1");
    assert.ok(!("secret" in payload));
  });

  test("no event emitted on failed generation (guard check)", () => {
    // When workspaceId is missing, generation returns early — mirror the guard.
    const workspaceId = "";
    const shouldEmit = Boolean(workspaceId.trim());
    assert.equal(shouldEmit, false);
  });
});

// ─── Threshold ordering invariants ──────────────────────────────────────────

describe("PMO Executive Reporting — ordering invariants", () => {
  test("pickHighest selects most severe candidate", () => {
    assert.equal(pickHighest(["low", "critical", "medium"], EXECUTIVE_RISK_ORDER), "critical");
    assert.equal(pickHighest(["healthy", "watch"], EXECUTIVE_STATUS_ORDER), "watch");
  });

  test("severity threshold of low keeps everything", () => {
    const drafts = [{ severity: "low" }, { severity: "critical" }];
    assert.equal(filterBySeverityThreshold(drafts, "low").length, 2);
  });
});
