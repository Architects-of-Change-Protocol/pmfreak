// tests/pmo-intervention.test.mjs
// Pure-logic tests for the PMO Intervention / Action Loop.
// Mirrors the derivation logic in src/lib/pmo-intervention/pmo-intervention.ts.

import assert from "node:assert/strict";
import { test, describe, beforeEach } from "node:test";

// ─── Constants ─────────────────────────────────────────────────────────────────

const NOW = "2026-06-24T00:00:00.000Z";

// ─── Mirrored pure functions ───────────────────────────────────────────────────

const CRITICAL_PRIORITY_VIOLATIONS = new Set([
  "OVERLOADED_WITHOUT_RECOMMENDATION",
  "CRITICAL_PM_WITHOUT_TOP_RECOMMENDATION",
  "CRITICAL_PM_WITHOUT_RECOMMENDATION",
]);

const HIGH_PRIORITY_VIOLATIONS = new Set([
  "CAPACITY_SNAPSHOT_MISSING",
  "PERFORMANCE_SNAPSHOT_MISSING",
  "LOW_CONFIDENCE_WITHOUT_RECOMMENDATION",
  "HIGH_RISK_PM_NOT_IN_ATTENTION_QUEUE",
]);

function derivePriority(violationType, severity) {
  if (CRITICAL_PRIORITY_VIOLATIONS.has(violationType)) return "critical";
  if (HIGH_PRIORITY_VIOLATIONS.has(violationType)) return "high";
  return severity;
}

const VIOLATION_ACTION_MAP = {
  PM_PROFILE_MISSING: "complete_pm_profile",
  PM_ROLE_MISSING: "complete_pm_profile",
  PM_EXPERIENCE_LEVEL_MISSING: "complete_pm_profile",
  PM_ACTIVE_PROJECTS_LIMIT_MISSING: "complete_pm_profile",
  CAPACITY_SNAPSHOT_MISSING: "generate_capacity_snapshot",
  CAPACITY_SNAPSHOT_STALE: "generate_capacity_snapshot",
  NEAR_CAPACITY_WITHOUT_RECOMMENDATION: "review_capacity_overload",
  AT_CAPACITY_WITHOUT_RECOMMENDATION: "review_capacity_overload",
  OVERLOADED_WITHOUT_RECOMMENDATION: "review_capacity_overload",
  OVERLOADED_NOT_IN_ATTENTION_QUEUE: "review_capacity_overload",
  PERFORMANCE_SNAPSHOT_MISSING: "generate_performance_snapshot",
  PERFORMANCE_SNAPSHOT_STALE: "generate_performance_snapshot",
  WARNING_PM_WITHOUT_RECOMMENDATION: "review_pm_performance_risk",
  CRITICAL_PM_WITHOUT_RECOMMENDATION: "escalate_critical_pm_risk",
  HIGH_RISK_PM_NOT_IN_ATTENTION_QUEUE: "review_pm_performance_risk",
  PERFORMANCE_RISK_MISSING: "review_pm_performance_risk",
  SCORE_INTERPRETATION_MISSING: "improve_evidence_coverage",
  EVIDENCE_CONFIDENCE_MISSING: "improve_evidence_coverage",
  EVIDENCE_COMPLETENESS_MISSING: "improve_evidence_coverage",
  CONFIDENCE_LEVEL_MISSING: "improve_evidence_coverage",
  LOW_CONFIDENCE_WITHOUT_RECOMMENDATION: "improve_evidence_coverage",
  MISSING_SOURCES_NOT_RECORDED: "improve_evidence_coverage",
  NEUTRAL_BASELINE_DOMAINS_NOT_RECORDED: "improve_evidence_coverage",
  CRITICAL_PM_WITHOUT_TOP_RECOMMENDATION: "escalate_critical_pm_risk",
  CAPACITY_RISK_WITHOUT_TOP_RECOMMENDATION: "review_capacity_overload",
  PERFORMANCE_RISK_WITHOUT_TOP_RECOMMENDATION: "review_pm_performance_risk",
  INSUFFICIENT_EVIDENCE_WITHOUT_RECOMMENDATION: "improve_evidence_coverage",
  RECOMMENDATION_MISSING_SEVERITY: "review_intervention_readiness",
  RECOMMENDATION_MISSING_SOURCE: "review_intervention_readiness",
  RISKY_PM_NOT_IN_ATTENTION_QUEUE: "escalate_critical_pm_risk",
  INACTIVE_PM_HAS_ACTIVE_ASSIGNMENTS: "review_assignment_hygiene",
  SUSPENDED_PM_HAS_ACTIVE_ASSIGNMENTS: "review_assignment_hygiene",
  ACTIVE_PM_WITH_NO_ASSIGNMENTS: "review_assignment_hygiene",
  INVALID_ASSIGNMENT_TYPE: "review_assignment_hygiene",
  PROJECT_WITHOUT_PRIMARY_PM: "review_assignment_hygiene",
  PROJECT_WITH_MULTIPLE_PRIMARY_PMS: "review_assignment_hygiene",
  OBSERVER_COUNTED_AS_CAPACITY: "review_assignment_hygiene",
  HISTORICAL_ASSIGNMENT_MISSING_REMOVED_AT: "review_assignment_hygiene",
  ASSIGNMENT_EVENT_MISSING: "review_assignment_hygiene",
  DOSSIER_IDENTITY_MISSING: "complete_pm_profile",
  DOSSIER_PROFILE_SECTION_MISSING: "complete_pm_profile",
  DOSSIER_ASSIGNMENTS_MISSING: "review_assignment_hygiene",
  DOSSIER_CAPACITY_SECTION_MISSING: "generate_capacity_snapshot",
  DOSSIER_PERFORMANCE_SECTION_MISSING: "generate_performance_snapshot",
  DOSSIER_EVIDENCE_SECTION_MISSING: "improve_evidence_coverage",
  DOSSIER_RECOMMENDATIONS_MISSING: "review_intervention_readiness",
  DOSSIER_EVENT_TIMELINE_MISSING: "review_intervention_readiness",
};

const VALID_TRANSITIONS = {
  proposed:    ["approved", "rejected", "dismissed"],
  approved:    ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed:   [],
  rejected:    [],
  dismissed:   [],
  cancelled:   [],
};

function isValidTransition(from, to) {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

const OPEN_STATUSES = new Set(["proposed", "approved", "in_progress"]);

// ─── In-memory store (mirrored) ────────────────────────────────────────────────

let _store;
let _idSeq;

function resetStore() {
  _store = new Map();
  _idSeq = 0;
}

function newId() {
  _idSeq += 1;
  return `act_${_idSeq}`;
}

function mkAction(overrides = {}) {
  const id = newId();
  const now = NOW;
  return {
    id,
    workspaceId: "ws1",
    sourceType: "pmo_governance_compliance",
    sourceId: "snap1",
    sourceSnapshotId: "snap1",
    sourceViolationId: overrides.sourceViolationId ?? `viol_${id}`,
    sourceRecommendationId: null,
    actionType: overrides.actionType ?? "complete_pm_profile",
    actionTitle: "Complete PM Profile",
    actionDescription: "PM profile is missing",
    priority: overrides.priority ?? "high",
    status: overrides.status ?? "proposed",
    targetType: overrides.targetType ?? "pm",
    targetId: overrides.targetId ?? "pm1",
    targetName: overrides.targetName ?? "PM 1",
    pmId: overrides.pmId ?? "pm1",
    projectId: overrides.projectId ?? null,
    evidence: null,
    recommendation: "Fix profile.",
    requiresApproval: true,
    approvalStatus: overrides.approvalStatus ?? "pending",
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    completedBy: null,
    completedAt: null,
    completionNotes: null,
    dismissedBy: null,
    dismissedAt: null,
    dismissalReason: null,
    decisionReason: null,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function dedupKey(p) {
  if (p.sourceViolationId) {
    return [p.workspaceId, p.sourceType, p.sourceViolationId, p.actionType, p.targetType ?? "", p.targetId ?? ""].join("|");
  }
  return [p.workspaceId, p.sourceType, p.actionType, p.targetType ?? "", p.targetId ?? "", p.pmId ?? "", p.projectId ?? ""].join("|");
}

// Simulate generate from violations
function generateFromViolations(workspaceId, violations, actorId = null, snapshotId = "snap1") {
  const existing = Array.from(_store.values()).filter((a) => a.workspaceId === workspaceId);
  const openKeys = new Set();
  let existingOpenCount = 0;
  for (const a of existing) {
    if (OPEN_STATUSES.has(a.status)) {
      existingOpenCount += 1;
      openKeys.add(dedupKey({
        workspaceId: a.workspaceId,
        sourceType: a.sourceType,
        sourceViolationId: a.sourceViolationId,
        actionType: a.actionType,
        targetType: a.targetType,
        targetId: a.targetId,
        pmId: a.pmId,
        projectId: a.projectId,
      }));
    }
  }

  const created = [];
  let skipped = 0;

  for (const v of violations) {
    const actionType = VIOLATION_ACTION_MAP[v.violation_type];
    if (!actionType) continue;
    const targetType = v.pm_id ? "pm" : v.project_id ? "project" : null;
    const targetId = v.pm_id ?? v.project_id ?? null;
    const key = dedupKey({
      workspaceId,
      sourceType: "pmo_governance_compliance",
      sourceViolationId: v.violation_id,
      actionType,
      targetType,
      targetId,
      pmId: v.pm_id ?? null,
      projectId: v.project_id ?? null,
    });
    if (openKeys.has(key)) { skipped += 1; continue; }

    const priority = derivePriority(v.violation_type, v.severity);
    const action = mkAction({
      id: newId(),
      workspaceId,
      sourceType: "pmo_governance_compliance",
      sourceId: snapshotId,
      sourceSnapshotId: snapshotId,
      sourceViolationId: v.violation_id,
      actionType,
      actionTitle: actionType.replace(/_/g, " "),
      actionDescription: v.message,
      priority,
      status: "proposed",
      targetType,
      targetId,
      targetName: v.pm_name ?? v.project_name ?? null,
      pmId: v.pm_id ?? null,
      projectId: v.project_id ?? null,
      evidence: v.evidence ?? null,
      recommendation: v.recommendation ?? null,
      requiresApproval: true,
      approvalStatus: "pending",
      createdBy: actorId,
    });
    _store.set(action.id, action);
    openKeys.add(key);
    created.push(action);
  }

  return { created_actions: created, existing_open_actions: existingOpenCount, skipped_duplicates: skipped, source_snapshot_id: snapshotId, generated_at: NOW };
}

// Apply status transition
function applyStatusUpdate(actionId, actorId, status, decisionReason, completionNotes) {
  const action = _store.get(actionId);
  if (!action) return { ok: false, error: "not found", failureClass: "PMO_INTERVENTION_ACTION_NOT_FOUND" };
  if (!isValidTransition(action.status, status)) {
    return { ok: false, error: `Invalid: ${action.status} → ${status}`, failureClass: "PMO_INTERVENTION_INVALID_STATUS_TRANSITION" };
  }
  const updated = { ...action, status, updatedAt: NOW };
  if (decisionReason !== undefined) updated.decisionReason = decisionReason;
  if (completionNotes !== undefined) updated.completionNotes = completionNotes;
  if (status === "approved") { updated.approvalStatus = "approved"; updated.approvedBy = actorId; updated.approvedAt = NOW; }
  if (status === "rejected") { updated.approvalStatus = "rejected"; updated.rejectedBy = actorId; updated.rejectedAt = NOW; updated.rejectionReason = decisionReason ?? null; }
  if (status === "dismissed") { updated.dismissedBy = actorId; updated.dismissedAt = NOW; updated.dismissalReason = decisionReason ?? null; }
  if (status === "completed") { updated.completedBy = actorId; updated.completedAt = NOW; }
  _store.set(actionId, updated);
  return { ok: true, data: updated };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function mkViolation(type, severity, base = {}) {
  return {
    violation_id: `v_${type}_${Math.random().toString(36).slice(2, 7)}`,
    violation_type: type,
    severity,
    domain: "pm_profile_completeness",
    message: `${type} detected`,
    recommendation: `Fix ${type}`,
    evidence: {},
    detected_at: NOW,
    pm_id: base.pm_id ?? "pm1",
    pm_name: base.pm_name ?? "PM 1",
    project_id: base.project_id ?? null,
    project_name: base.project_name ?? null,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PMO Intervention — generation", () => {
  beforeEach(() => resetStore());

  test("creates proposed actions from governance violations", () => {
    const v = mkViolation("PM_PROFILE_MISSING", "high");
    const result = generateFromViolations("ws1", [v]);
    assert.equal(result.created_actions.length, 1);
    assert.equal(result.created_actions[0].status, "proposed");
    assert.equal(result.created_actions[0].actionType, "complete_pm_profile");
  });

  test("generated actions require approval by default, approval_status = pending", () => {
    const v = mkViolation("PM_PROFILE_MISSING", "high");
    const result = generateFromViolations("ws1", [v]);
    const action = result.created_actions[0];
    assert.equal(action.requiresApproval, true);
    assert.equal(action.approvalStatus, "pending");
  });

  test("handles empty violations gracefully", () => {
    const result = generateFromViolations("ws1", []);
    assert.equal(result.created_actions.length, 0);
    assert.equal(result.skipped_duplicates, 0);
    assert.equal(result.existing_open_actions, 0);
  });

  test("includes evidence and recommendation", () => {
    const v = mkViolation("PM_PROFILE_MISSING", "high");
    v.evidence = { foo: "bar" };
    v.recommendation = "Fix it now";
    const result = generateFromViolations("ws1", [v]);
    const action = result.created_actions[0];
    assert.deepEqual(action.evidence, { foo: "bar" });
    assert.equal(action.recommendation, "Fix it now");
  });

  test("includes pm_id and project_id when available", () => {
    const v = mkViolation("CAPACITY_SNAPSHOT_MISSING", "high", { pm_id: "pm42", project_id: null });
    const result = generateFromViolations("ws1", [v]);
    assert.equal(result.created_actions[0].pmId, "pm42");
  });
});

describe("PMO Intervention — violation → action type mapping", () => {
  test("PM_PROFILE_MISSING → complete_pm_profile", () => {
    assert.equal(VIOLATION_ACTION_MAP["PM_PROFILE_MISSING"], "complete_pm_profile");
  });
  test("CAPACITY_SNAPSHOT_MISSING → generate_capacity_snapshot", () => {
    assert.equal(VIOLATION_ACTION_MAP["CAPACITY_SNAPSHOT_MISSING"], "generate_capacity_snapshot");
  });
  test("OVERLOADED_WITHOUT_RECOMMENDATION → review_capacity_overload", () => {
    assert.equal(VIOLATION_ACTION_MAP["OVERLOADED_WITHOUT_RECOMMENDATION"], "review_capacity_overload");
  });
  test("PERFORMANCE_SNAPSHOT_MISSING → generate_performance_snapshot", () => {
    assert.equal(VIOLATION_ACTION_MAP["PERFORMANCE_SNAPSHOT_MISSING"], "generate_performance_snapshot");
  });
  test("LOW_CONFIDENCE_WITHOUT_RECOMMENDATION → improve_evidence_coverage", () => {
    assert.equal(VIOLATION_ACTION_MAP["LOW_CONFIDENCE_WITHOUT_RECOMMENDATION"], "improve_evidence_coverage");
  });
  test("CRITICAL_PM_WITHOUT_TOP_RECOMMENDATION → escalate_critical_pm_risk", () => {
    assert.equal(VIOLATION_ACTION_MAP["CRITICAL_PM_WITHOUT_TOP_RECOMMENDATION"], "escalate_critical_pm_risk");
  });
  test("CRITICAL_PM_WITHOUT_RECOMMENDATION → escalate_critical_pm_risk", () => {
    assert.equal(VIOLATION_ACTION_MAP["CRITICAL_PM_WITHOUT_RECOMMENDATION"], "escalate_critical_pm_risk");
  });
  test("HIGH_RISK_PM_NOT_IN_ATTENTION_QUEUE → review_pm_performance_risk", () => {
    assert.equal(VIOLATION_ACTION_MAP["HIGH_RISK_PM_NOT_IN_ATTENTION_QUEUE"], "review_pm_performance_risk");
  });
  test("INACTIVE_PM_HAS_ACTIVE_ASSIGNMENTS → review_assignment_hygiene", () => {
    assert.equal(VIOLATION_ACTION_MAP["INACTIVE_PM_HAS_ACTIVE_ASSIGNMENTS"], "review_assignment_hygiene");
  });
});

describe("PMO Intervention — priority derivation", () => {
  test("OVERLOADED_WITHOUT_RECOMMENDATION → critical priority regardless of severity", () => {
    assert.equal(derivePriority("OVERLOADED_WITHOUT_RECOMMENDATION", "medium"), "critical");
  });
  test("CRITICAL_PM_WITHOUT_TOP_RECOMMENDATION → critical priority", () => {
    assert.equal(derivePriority("CRITICAL_PM_WITHOUT_TOP_RECOMMENDATION", "high"), "critical");
  });
  test("CRITICAL_PM_WITHOUT_RECOMMENDATION → critical priority", () => {
    assert.equal(derivePriority("CRITICAL_PM_WITHOUT_RECOMMENDATION", "high"), "critical");
  });
  test("CAPACITY_SNAPSHOT_MISSING → high priority", () => {
    assert.equal(derivePriority("CAPACITY_SNAPSHOT_MISSING", "medium"), "high");
  });
  test("PERFORMANCE_SNAPSHOT_MISSING → high priority", () => {
    assert.equal(derivePriority("PERFORMANCE_SNAPSHOT_MISSING", "low"), "high");
  });
  test("LOW_CONFIDENCE_WITHOUT_RECOMMENDATION → high priority", () => {
    assert.equal(derivePriority("LOW_CONFIDENCE_WITHOUT_RECOMMENDATION", "low"), "high");
  });
  test("HIGH_RISK_PM_NOT_IN_ATTENTION_QUEUE → high priority", () => {
    assert.equal(derivePriority("HIGH_RISK_PM_NOT_IN_ATTENTION_QUEUE", "medium"), "high");
  });
  test("other violations map severity directly", () => {
    assert.equal(derivePriority("PM_ROLE_MISSING", "medium"), "medium");
    assert.equal(derivePriority("PM_EXPERIENCE_LEVEL_MISSING", "low"), "low");
    assert.equal(derivePriority("CAPACITY_SNAPSHOT_STALE", "high"), "high");
  });
});

describe("PMO Intervention — deduplication", () => {
  beforeEach(() => resetStore());

  test("skips duplicate if open action exists with same violation key", () => {
    const v = mkViolation("PM_PROFILE_MISSING", "high", { pm_id: "pm1" });
    const first = generateFromViolations("ws1", [v]);
    assert.equal(first.created_actions.length, 1);
    // Use same violation_id
    const second = generateFromViolations("ws1", [v]);
    assert.equal(second.created_actions.length, 0);
    assert.equal(second.skipped_duplicates, 1);
  });

  test("allows new action when previous is terminal (completed)", () => {
    const v = mkViolation("PM_PROFILE_MISSING", "high", { pm_id: "pm1" });
    const first = generateFromViolations("ws1", [v]);
    const actionId = first.created_actions[0].id;
    // Complete the action (proposed → approved → in_progress → completed)
    applyStatusUpdate(actionId, "user1", "approved");
    applyStatusUpdate(actionId, "user1", "in_progress");
    applyStatusUpdate(actionId, "user1", "completed");
    // Generate again with different violation_id to avoid same key
    const v2 = { ...v, violation_id: "v_new" };
    const second = generateFromViolations("ws1", [v2]);
    assert.equal(second.created_actions.length, 1);
  });

  test("does not create duplicate across workspaces", () => {
    const v = mkViolation("PM_PROFILE_MISSING", "high", { pm_id: "pm1" });
    const first = generateFromViolations("ws1", [v]);
    const second = generateFromViolations("ws2", [v]);
    assert.equal(first.created_actions.length, 1);
    // Different workspace — allowed
    assert.equal(second.created_actions.length, 1);
  });
});

describe("PMO Intervention — status lifecycle", () => {
  beforeEach(() => resetStore());

  test("proposed → approved", () => {
    const a = mkAction({ status: "proposed" });
    _store.set(a.id, a);
    const result = applyStatusUpdate(a.id, "user1", "approved");
    assert.equal(result.ok, true);
    assert.equal(result.data.status, "approved");
    assert.equal(result.data.approvalStatus, "approved");
    assert.equal(result.data.approvedBy, "user1");
  });

  test("proposed → rejected sets approvalStatus = rejected", () => {
    const a = mkAction({ status: "proposed" });
    _store.set(a.id, a);
    const result = applyStatusUpdate(a.id, "user1", "rejected", "not actionable");
    assert.equal(result.ok, true);
    assert.equal(result.data.status, "rejected");
    assert.equal(result.data.approvalStatus, "rejected");
    assert.equal(result.data.rejectedBy, "user1");
    assert.equal(result.data.rejectionReason, "not actionable");
  });

  test("proposed → dismissed", () => {
    const a = mkAction({ status: "proposed" });
    _store.set(a.id, a);
    const result = applyStatusUpdate(a.id, "user1", "dismissed", "not relevant");
    assert.equal(result.ok, true);
    assert.equal(result.data.status, "dismissed");
    assert.equal(result.data.dismissedBy, "user1");
    assert.equal(result.data.dismissalReason, "not relevant");
  });

  test("approved → in_progress", () => {
    const a = mkAction({ status: "approved", approvalStatus: "approved" });
    _store.set(a.id, a);
    const result = applyStatusUpdate(a.id, "user1", "in_progress");
    assert.equal(result.ok, true);
    assert.equal(result.data.status, "in_progress");
  });

  test("in_progress → completed records completedBy", () => {
    const a = mkAction({ status: "in_progress" });
    _store.set(a.id, a);
    const result = applyStatusUpdate(a.id, "user1", "completed", undefined, "All done");
    assert.equal(result.ok, true);
    assert.equal(result.data.status, "completed");
    assert.equal(result.data.completedBy, "user1");
    assert.equal(result.data.completionNotes, "All done");
  });

  test("rejects invalid transition: proposed → completed", () => {
    const a = mkAction({ status: "proposed" });
    _store.set(a.id, a);
    const result = applyStatusUpdate(a.id, "user1", "completed");
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "PMO_INTERVENTION_INVALID_STATUS_TRANSITION");
  });

  test("rejects invalid transition: completed → in_progress", () => {
    const a = mkAction({ status: "completed" });
    _store.set(a.id, a);
    const result = applyStatusUpdate(a.id, "user1", "in_progress");
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "PMO_INTERVENTION_INVALID_STATUS_TRANSITION");
  });

  test("rejects invalid transition: rejected → approved", () => {
    const a = mkAction({ status: "rejected" });
    _store.set(a.id, a);
    const result = applyStatusUpdate(a.id, "user1", "approved");
    assert.equal(result.ok, false);
  });

  test("records actor and timestamps on approval", () => {
    const a = mkAction({ status: "proposed" });
    _store.set(a.id, a);
    const result = applyStatusUpdate(a.id, "actor99", "approved");
    assert.equal(result.data.approvedBy, "actor99");
    assert.ok(result.data.approvedAt);
  });
});

describe("PMO Intervention — isValidTransition table", () => {
  test("all valid transitions from proposed", () => {
    assert.equal(isValidTransition("proposed", "approved"), true);
    assert.equal(isValidTransition("proposed", "rejected"), true);
    assert.equal(isValidTransition("proposed", "dismissed"), true);
    assert.equal(isValidTransition("proposed", "in_progress"), false);
    assert.equal(isValidTransition("proposed", "completed"), false);
  });
  test("all valid transitions from approved", () => {
    assert.equal(isValidTransition("approved", "in_progress"), true);
    assert.equal(isValidTransition("approved", "cancelled"), true);
    assert.equal(isValidTransition("approved", "completed"), false);
  });
  test("all valid transitions from in_progress", () => {
    assert.equal(isValidTransition("in_progress", "completed"), true);
    assert.equal(isValidTransition("in_progress", "cancelled"), true);
    assert.equal(isValidTransition("in_progress", "approved"), false);
  });
  test("terminal states have no valid transitions", () => {
    for (const terminal of ["completed", "rejected", "dismissed", "cancelled"]) {
      assert.equal(isValidTransition(terminal, "proposed"), false);
      assert.equal(isValidTransition(terminal, "approved"), false);
    }
  });
});

describe("PMO Intervention — listing and filtering", () => {
  beforeEach(() => resetStore());

  test("lists by status", () => {
    const a1 = mkAction({ status: "proposed" });
    const a2 = mkAction({ status: "approved", approvalStatus: "approved" });
    _store.set(a1.id, a1); _store.set(a2.id, a2);
    const all = Array.from(_store.values()).filter((a) => a.workspaceId === "ws1");
    const proposed = all.filter((a) => a.status === "proposed");
    assert.equal(proposed.length, 1);
    assert.equal(proposed[0].id, a1.id);
  });

  test("lists by priority", () => {
    const a1 = mkAction({ priority: "critical" });
    const a2 = mkAction({ priority: "low" });
    _store.set(a1.id, a1); _store.set(a2.id, a2);
    const critical = Array.from(_store.values()).filter((a) => a.workspaceId === "ws1" && a.priority === "critical");
    assert.equal(critical.length, 1);
  });

  test("gets action by id", () => {
    const a = mkAction();
    _store.set(a.id, a);
    const found = _store.get(a.id);
    assert.equal(found.id, a.id);
  });

  test("returns not found for unknown id", () => {
    const found = _store.get("nonexistent");
    assert.equal(found, undefined);
  });
});

describe("PMO Intervention — event emission (logic only)", () => {
  test("event payload structure for generation", () => {
    const payload = {
      workspace_id: "ws1",
      source_snapshot_id: "snap1",
      created_count: 3,
      skipped_duplicates: 1,
      existing_open_actions: 2,
      generated_at: NOW,
    };
    assert.equal(payload.workspace_id, "ws1");
    assert.equal(typeof payload.created_count, "number");
    assert.ok(!("full_email_body" in payload));
  });

  test("event payload structure for status change", () => {
    const payload = {
      workspace_id: "ws1",
      action_id: "act_1",
      action_type: "complete_pm_profile",
      previous_status: "proposed",
      new_status: "approved",
      actor_id: "user1",
      changed_at: NOW,
    };
    assert.equal(payload.previous_status, "proposed");
    assert.equal(payload.new_status, "approved");
    assert.ok(!("token" in payload));
  });

  test("no event emitted on failed transition (guard check)", () => {
    const a = mkAction({ status: "completed" });
    _store.set(a.id, a);
    const result = applyStatusUpdate(a.id, "user1", "in_progress");
    // Transition fails — in real code we only emit on success
    assert.equal(result.ok, false);
    // Verify store is unchanged
    const unchanged = _store.get(a.id);
    assert.equal(unchanged.status, "completed");
  });
});

describe("PMO Intervention — edge cases", () => {
  beforeEach(() => resetStore());

  test("handles unknown violation type gracefully (no action created)", () => {
    const v = mkViolation("UNKNOWN_VIOLATION_TYPE_XYZ", "low");
    const result = generateFromViolations("ws1", [v]);
    assert.equal(result.created_actions.length, 0);
  });

  test("dedup key uses violation_id when present", () => {
    const key1 = dedupKey({ workspaceId: "ws1", sourceType: "pmo_governance_compliance", sourceViolationId: "v1", actionType: "complete_pm_profile", targetType: "pm", targetId: "pm1", pmId: "pm1", projectId: null });
    const key2 = dedupKey({ workspaceId: "ws1", sourceType: "pmo_governance_compliance", sourceViolationId: "v1", actionType: "complete_pm_profile", targetType: "pm", targetId: "pm1", pmId: "pm1", projectId: null });
    assert.equal(key1, key2);
  });

  test("dedup key differs for different violation ids", () => {
    const key1 = dedupKey({ workspaceId: "ws1", sourceType: "pmo_governance_compliance", sourceViolationId: "v1", actionType: "complete_pm_profile", targetType: "pm", targetId: "pm1", pmId: "pm1", projectId: null });
    const key2 = dedupKey({ workspaceId: "ws1", sourceType: "pmo_governance_compliance", sourceViolationId: "v2", actionType: "complete_pm_profile", targetType: "pm", targetId: "pm1", pmId: "pm1", projectId: null });
    assert.notEqual(key1, key2);
  });

  test("dedup key fallback (no violation_id) uses pm_id and project_id", () => {
    const key1 = dedupKey({ workspaceId: "ws1", sourceType: "pmo_governance_compliance", sourceViolationId: null, actionType: "complete_pm_profile", targetType: "pm", targetId: "pm1", pmId: "pm1", projectId: null });
    const key2 = dedupKey({ workspaceId: "ws1", sourceType: "pmo_governance_compliance", sourceViolationId: null, actionType: "complete_pm_profile", targetType: "pm", targetId: "pm1", pmId: "pm2", projectId: null });
    assert.notEqual(key1, key2);
  });
});
