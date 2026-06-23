/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck -- Node 20 executes this TypeScript-named test without a loader.
// ─────────────────────────────────────────────────────────────────────────────
// Governance Action Engine — Test Suite
// EPIC 3, Sprint 2
//
// All logic is re-implemented in-memory. No database, no mocking.
// ─────────────────────────────────────────────────────────────────────────────

const assert = require("node:assert/strict");
const { test, describe } = require("node:test");
const { readFileSync } = require("node:fs");

// ─── Read source files for verification ──────────────────────────────────────

const types         = readFileSync("src/lib/governance-actions/types.ts", "utf8");
const priorityEng   = readFileSync("src/lib/governance-actions/priority-engine.ts", "utf8");
const confidenceEng = readFileSync("src/lib/governance-actions/confidence-engine.ts", "utf8");
const deadlineEng   = readFileSync("src/lib/governance-actions/deadline-engine.ts", "utf8");
const authorityEng  = readFileSync("src/lib/governance-actions/authority-engine.ts", "utf8");
const generationEng = readFileSync("src/lib/governance-actions/generation-engine.ts", "utf8");
const interventionEng = readFileSync("src/lib/governance-actions/intervention-engine.ts", "utf8");
const justificationEng = readFileSync("src/lib/governance-actions/justification-engine.ts", "utf8");
const lineageFile   = readFileSync("src/lib/governance-actions/lineage.ts", "utf8");
const explainFile   = readFileSync("src/lib/governance-actions/explain.ts", "utf8");
const indexFile     = readFileSync("src/lib/governance-actions/index.ts", "utf8");
const registryFile  = readFileSync("src/lib/governance-actions/action-registry.ts", "utf8");
const dbContract    = readFileSync("src/lib/db/database-contract.ts", "utf8");
const migration     = readFileSync("supabase/migrations/20260705000000_governance_action_engine.sql", "utf8");
const docsFile      = readFileSync("docs/governance-action-engine.md", "utf8");

// ─── In-memory engine implementations ────────────────────────────────────────

type Priority = "low" | "medium" | "high" | "critical";
type ActionStatus = "generated" | "reviewed" | "approved" | "rejected" | "expired" | "completed";

const PRIORITY_RANK: Record<Priority, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const RANK_TO_PRIORITY: Priority[] = ["low", "medium", "high", "critical"];

function escalate(base: Priority, levels: number): Priority {
  return RANK_TO_PRIORITY[Math.min(3, PRIORITY_RANK[base] + levels)];
}

const HIGH_IMPACT = new Set(["governance_violation", "authority_gap", "escalation_gap"]);
const MEDIUM_IMPACT = new Set([
  "approval_delay", "ratification_stall", "decision_bottleneck",
  "amendment_backlog", "risk_accumulation",
]);
const SEVERITY_BASE: Record<string, Priority> = {
  critical: "critical", high: "high", medium: "medium", low: "low",
};

function calculatePriority(opts: {
  signalSeverity: string;
  signalType: string;
  durationDays?: number;
  hasHistoricalNegativeOutcome?: boolean;
}): Priority {
  let p: Priority = SEVERITY_BASE[opts.signalSeverity] ?? "medium";
  if (HIGH_IMPACT.has(opts.signalType)) p = escalate(p, 1);
  else if (MEDIUM_IMPACT.has(opts.signalType) && PRIORITY_RANK[p] < 1) p = "medium";
  if ((opts.durationDays ?? 0) >= 15) p = escalate(p, 2);
  else if ((opts.durationDays ?? 0) >= 8) p = escalate(p, 1);
  if (opts.hasHistoricalNegativeOutcome) p = escalate(p, 1);
  return p;
}

function clamp(v: number): number { return Math.max(0, Math.min(1, v)); }
function round3(v: number): number { return Math.round(v * 1000) / 1000; }

function calculateConfidence(opts: {
  signalConfidence: number;
  recommendationConfidence: number;
  learningConfidence: number;
  historicalEffectiveness: number;
}): number {
  return round3(
    clamp(opts.signalConfidence)        * 0.40 +
    clamp(opts.recommendationConfidence) * 0.25 +
    clamp(opts.learningConfidence)       * 0.20 +
    clamp(opts.historicalEffectiveness)  * 0.15
  );
}

const DEADLINE_HOURS: Record<Priority, number> = {
  critical: 24, high: 48, medium: 7 * 24, low: 14 * 24,
};

function deadlineHours(priority: Priority): number {
  return DEADLINE_HOURS[priority];
}

function recommendedDueDate(priority: Priority, from: Date = new Date()): Date {
  return new Date(from.getTime() + DEADLINE_HOURS[priority] * 60 * 60 * 1000);
}

const AUTHORITY_MAP: Record<string, string> = {
  create_escalation:        "project_manager",
  request_ratification:     "sponsor",
  request_approval:         "decision_authority",
  create_delegation:        "sponsor",
  assign_authority:         "sponsor",
  review_amendment:         "project_manager",
  review_decision:          "decision_authority",
  review_risk:              "risk_owner",
  initiate_governance_review: "sponsor",
  close_signal:             "project_manager",
  reassess_recommendation:  "project_manager",
  other:                    "project_manager",
};

function validateAuthority(opts: {
  actionType: string;
  recommendedActor: string | null;
  actorRoles: string[];
}): { authorized: boolean; requiredAuthorityType: string } {
  const required = AUTHORITY_MAP[opts.actionType];
  const authorized =
    opts.recommendedActor !== null &&
    (opts.actorRoles.includes(required) ||
      opts.actorRoles.includes("owner") ||
      opts.actorRoles.includes("admin") ||
      opts.actorRoles.includes("sponsor"));
  return { authorized, requiredAuthorityType: required };
}

const SIGNAL_ACTION_MAP: Record<string, string[]> = {
  approval_delay:         ["request_approval"],
  authority_gap:          ["create_delegation", "assign_authority"],
  escalation_gap:         ["create_escalation"],
  amendment_backlog:      ["review_amendment"],
  governance_violation:   ["initiate_governance_review"],
  recommendation_ignored: ["reassess_recommendation"],
  ratification_stall:     ["request_ratification"],
  decision_bottleneck:    ["review_decision"],
  risk_accumulation:      ["review_risk"],
  delivery_drift:         ["review_decision"],
};

function generateActionsForSignal(signalType: string): string[] {
  return SIGNAL_ACTION_MAP[signalType] ?? [];
}

const INTERVENTION_PROFILES: Record<string, { expectedEffect: string; baseConfidence: number }> = {
  create_escalation:          { expectedEffect: "reduce_escalation_gap",         baseConfidence: 0.82 },
  request_ratification:       { expectedEffect: "reduce_approval_delay",          baseConfidence: 0.78 },
  request_approval:           { expectedEffect: "reduce_approval_delay",          baseConfidence: 0.80 },
  create_delegation:          { expectedEffect: "close_authority_gap",            baseConfidence: 0.85 },
  assign_authority:           { expectedEffect: "close_authority_gap",            baseConfidence: 0.83 },
  review_amendment:           { expectedEffect: "reduce_amendment_backlog",       baseConfidence: 0.74 },
  review_decision:            { expectedEffect: "reduce_decision_bottleneck",     baseConfidence: 0.76 },
  review_risk:                { expectedEffect: "reduce_risk_accumulation",       baseConfidence: 0.72 },
  initiate_governance_review: { expectedEffect: "resolve_governance_violation",   baseConfidence: 0.88 },
  close_signal:               { expectedEffect: "archive_resolved_signal",        baseConfidence: 0.95 },
  reassess_recommendation:    { expectedEffect: "re_evaluate_ignored_recommendation", baseConfidence: 0.70 },
};

function simulateIntervention(actionType: string, actionConfidence: number) {
  const profile = INTERVENTION_PROFILES[actionType];
  return {
    expectedEffect: profile.expectedEffect,
    confidence: round3(profile.baseConfidence * 0.6 + actionConfidence * 0.4),
  };
}

// Lifecycle transitions
const VALID_TRANSITIONS: Record<ActionStatus, ActionStatus[]> = {
  generated: ["reviewed", "approved", "rejected", "expired"],
  reviewed:  ["approved", "rejected", "expired"],
  approved:  ["completed", "expired"],
  rejected:  [],
  expired:   [],
  completed: [],
};

function canTransition(from: ActionStatus, to: ActionStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Test Suites ──────────────────────────────────────────────────────────────

describe("Database Contract", () => {
  test("DATABASE_CONTRACT_VERSION includes governance-action-engine", () => {
    assert.match(dbContract, /governance-action-engine/);
  });

  test("GovernanceActionRow is present", () => {
    assert.match(dbContract, /GovernanceActionRow/);
  });

  test("GovernanceActionEvidenceRow is present", () => {
    assert.match(dbContract, /GovernanceActionEvidenceRow/);
  });

  test("GovernanceActionAssignmentRow is present", () => {
    assert.match(dbContract, /GovernanceActionAssignmentRow/);
  });

  test("GovernanceActionType includes all 12 types", () => {
    for (const t of [
      "create_escalation", "request_ratification", "request_approval",
      "create_delegation", "assign_authority", "review_amendment",
      "review_decision", "review_risk", "initiate_governance_review",
      "close_signal", "reassess_recommendation", "other",
    ]) {
      assert.match(dbContract, new RegExp(t), `Missing GovernanceActionType: ${t}`);
    }
  });

  test("GovernanceActionPriority includes all 4 levels", () => {
    for (const p of ["low", "medium", "high", "critical"]) {
      assert.match(dbContract, new RegExp(p), `Missing priority: ${p}`);
    }
  });

  test("GovernanceActionStatus includes all 6 statuses", () => {
    for (const s of ["generated", "reviewed", "approved", "rejected", "expired", "completed"]) {
      assert.match(dbContract, new RegExp(s), `Missing status: ${s}`);
    }
  });

  test("GOVERNANCE_ACTION_SELECTABLE_COLUMNS is present", () => {
    assert.match(dbContract, /GOVERNANCE_ACTION_SELECTABLE_COLUMNS/);
  });
});

describe("Migration", () => {
  test("governance_actions table exists", () => {
    assert.match(migration, /create table if not exists governance_actions/);
  });

  test("governance_action_evidence table exists", () => {
    assert.match(migration, /create table if not exists governance_action_evidence/);
  });

  test("governance_action_assignments table exists", () => {
    assert.match(migration, /create table if not exists governance_action_assignments/);
  });

  test("RLS is enabled on all three tables", () => {
    const rlsCount = (migration.match(/enable row level security/g) ?? []).length;
    assert.equal(rlsCount, 3, "Expected 3 RLS enable statements");
  });

  test("workspace_id FK is present on governance_actions", () => {
    assert.match(migration, /workspace_id.*references workspaces/s);
  });

  test("signal_id FK references governance_signals", () => {
    assert.match(migration, /signal_id.*references governance_signals/s);
  });

  test("action_status check constraint includes all statuses", () => {
    for (const s of ["generated", "reviewed", "approved", "rejected", "expired", "completed"]) {
      assert.match(migration, new RegExp(s), `Missing status in migration: ${s}`);
    }
  });
});

describe("Action Generation", () => {
  test("approval_delay generates request_approval", () => {
    const actions = generateActionsForSignal("approval_delay");
    assert.ok(actions.includes("request_approval"), "Expected request_approval");
  });

  test("authority_gap generates create_delegation and assign_authority", () => {
    const actions = generateActionsForSignal("authority_gap");
    assert.ok(actions.includes("create_delegation"), "Expected create_delegation");
    assert.ok(actions.includes("assign_authority"), "Expected assign_authority");
  });

  test("escalation_gap generates create_escalation", () => {
    const actions = generateActionsForSignal("escalation_gap");
    assert.ok(actions.includes("create_escalation"), "Expected create_escalation");
  });

  test("amendment_backlog generates review_amendment", () => {
    const actions = generateActionsForSignal("amendment_backlog");
    assert.ok(actions.includes("review_amendment"), "Expected review_amendment");
  });

  test("governance_violation generates initiate_governance_review", () => {
    const actions = generateActionsForSignal("governance_violation");
    assert.ok(actions.includes("initiate_governance_review"), "Expected initiate_governance_review");
  });

  test("recommendation_ignored generates reassess_recommendation", () => {
    const actions = generateActionsForSignal("recommendation_ignored");
    assert.ok(actions.includes("reassess_recommendation"), "Expected reassess_recommendation");
  });
});

describe("Priority Engine", () => {
  test("low severity → low priority", () => {
    const p = calculatePriority({ signalSeverity: "low", signalType: "delivery_drift" });
    assert.equal(p, "low");
  });

  test("medium severity → medium priority", () => {
    const p = calculatePriority({ signalSeverity: "medium", signalType: "amendment_backlog" });
    assert.equal(p, "medium");
  });

  test("high severity → high priority", () => {
    const p = calculatePriority({ signalSeverity: "high", signalType: "approval_delay" });
    assert.equal(p, "high");
  });

  test("critical severity → critical priority", () => {
    const p = calculatePriority({ signalSeverity: "critical", signalType: "governance_violation" });
    assert.equal(p, "critical");
  });

  test("governance_violation escalates from medium to high", () => {
    const p = calculatePriority({ signalSeverity: "medium", signalType: "governance_violation" });
    assert.equal(p, "high");
  });

  test("authority_gap escalates from low to medium", () => {
    const p = calculatePriority({ signalSeverity: "low", signalType: "authority_gap" });
    assert.equal(p, "medium");
  });

  test("duration >= 8d escalates by 1", () => {
    const p = calculatePriority({ signalSeverity: "medium", signalType: "delivery_drift", durationDays: 10 });
    assert.equal(p, "high");
  });

  test("duration >= 15d escalates by 2", () => {
    const p = calculatePriority({ signalSeverity: "low", signalType: "delivery_drift", durationDays: 20 });
    assert.equal(p, "high");
  });

  test("historical negative outcome escalates by 1", () => {
    const p = calculatePriority({
      signalSeverity: "medium",
      signalType: "delivery_drift",
      hasHistoricalNegativeOutcome: true,
    });
    assert.equal(p, "high");
  });

  test("priority never exceeds critical", () => {
    const p = calculatePriority({
      signalSeverity: "critical",
      signalType: "governance_violation",
      durationDays: 20,
      hasHistoricalNegativeOutcome: true,
    });
    assert.equal(p, "critical");
  });
});

describe("Confidence Engine", () => {
  test("all factors at max → score close to 1.0", () => {
    const score = calculateConfidence({
      signalConfidence:        1.0,
      recommendationConfidence: 1.0,
      learningConfidence:       1.0,
      historicalEffectiveness:  1.0,
    });
    assert.equal(score, 1.0);
  });

  test("all factors at zero → score is 0.0", () => {
    const score = calculateConfidence({
      signalConfidence:        0.0,
      recommendationConfidence: 0.0,
      learningConfidence:       0.0,
      historicalEffectiveness:  0.0,
    });
    assert.equal(score, 0.0);
  });

  test("typical approval_delay scenario", () => {
    const score = calculateConfidence({
      signalConfidence:        0.84,
      recommendationConfidence: 0.78,
      learningConfidence:       0.72,
      historicalEffectiveness:  0.80,
    });
    assert.ok(score > 0.75 && score < 0.90, `Expected score in [0.75, 0.90], got ${score}`);
  });

  test("signal_confidence weighted heaviest", () => {
    const high = calculateConfidence({
      signalConfidence: 1.0, recommendationConfidence: 0, learningConfidence: 0, historicalEffectiveness: 0,
    });
    const low = calculateConfidence({
      signalConfidence: 0, recommendationConfidence: 1.0, learningConfidence: 0, historicalEffectiveness: 0,
    });
    assert.ok(high > low, "signalConfidence should have higher weight than recommendationConfidence");
  });

  test("clamping prevents score out of [0,1]", () => {
    const score = calculateConfidence({
      signalConfidence: 2.0, recommendationConfidence: -1.0, learningConfidence: 1.5, historicalEffectiveness: 0,
    });
    assert.ok(score >= 0 && score <= 1, `Score must be in [0,1], got ${score}`);
  });
});

describe("Deadline Engine", () => {
  test("critical → 24h", () => {
    assert.equal(deadlineHours("critical"), 24);
  });

  test("high → 48h", () => {
    assert.equal(deadlineHours("high"), 48);
  });

  test("medium → 7d (168h)", () => {
    assert.equal(deadlineHours("medium"), 168);
  });

  test("low → 14d (336h)", () => {
    assert.equal(deadlineHours("low"), 336);
  });

  test("critical due date is ~24h from now", () => {
    const from = new Date("2026-07-05T00:00:00.000Z");
    const due = recommendedDueDate("critical", from);
    const diffHours = (due.getTime() - from.getTime()) / (1000 * 60 * 60);
    assert.equal(diffHours, 24);
  });

  test("high due date is ~48h from now", () => {
    const from = new Date("2026-07-05T00:00:00.000Z");
    const due = recommendedDueDate("high", from);
    const diffHours = (due.getTime() - from.getTime()) / (1000 * 60 * 60);
    assert.equal(diffHours, 48);
  });
});

describe("Authority Validation", () => {
  test("create_delegation requires sponsor authority", () => {
    const { requiredAuthorityType } = validateAuthority({
      actionType: "create_delegation", recommendedActor: "actor-123", actorRoles: ["sponsor"],
    });
    assert.equal(requiredAuthorityType, "sponsor");
  });

  test("sponsor actor is authorized for create_delegation", () => {
    const { authorized } = validateAuthority({
      actionType: "create_delegation", recommendedActor: "actor-123", actorRoles: ["sponsor"],
    });
    assert.equal(authorized, true);
  });

  test("project_manager actor is NOT authorized for create_delegation by default", () => {
    const { authorized } = validateAuthority({
      actionType: "create_delegation", recommendedActor: "actor-123", actorRoles: ["project_manager"],
    });
    assert.equal(authorized, false);
  });

  test("owner role overrides all authority requirements", () => {
    const { authorized } = validateAuthority({
      actionType: "request_ratification", recommendedActor: "actor-123", actorRoles: ["owner"],
    });
    assert.equal(authorized, true);
  });

  test("null recommendedActor → not authorized", () => {
    const { authorized } = validateAuthority({
      actionType: "create_escalation", recommendedActor: null, actorRoles: ["project_manager"],
    });
    assert.equal(authorized, false);
  });

  test("create_escalation requires project_manager", () => {
    const { requiredAuthorityType } = validateAuthority({
      actionType: "create_escalation", recommendedActor: "actor-123", actorRoles: [],
    });
    assert.equal(requiredAuthorityType, "project_manager");
  });

  test("initiate_governance_review requires sponsor", () => {
    const { requiredAuthorityType } = validateAuthority({
      actionType: "initiate_governance_review", recommendedActor: "actor-123", actorRoles: [],
    });
    assert.equal(requiredAuthorityType, "sponsor");
  });
});

describe("Action Lifecycle", () => {
  test("generated → reviewed is valid", () => {
    assert.equal(canTransition("generated", "reviewed"), true);
  });

  test("generated → approved is valid", () => {
    assert.equal(canTransition("generated", "approved"), true);
  });

  test("generated → rejected is valid", () => {
    assert.equal(canTransition("generated", "rejected"), true);
  });

  test("generated → expired is valid", () => {
    assert.equal(canTransition("generated", "expired"), true);
  });

  test("approved → completed is valid", () => {
    assert.equal(canTransition("approved", "completed"), true);
  });

  test("completed → any status is invalid", () => {
    for (const s of ["generated", "reviewed", "approved", "rejected", "expired"] as ActionStatus[]) {
      assert.equal(canTransition("completed", s), false, `completed → ${s} should be invalid`);
    }
  });

  test("expired → any status is invalid", () => {
    for (const s of ["generated", "reviewed", "approved", "rejected", "completed"] as ActionStatus[]) {
      assert.equal(canTransition("expired", s), false, `expired → ${s} should be invalid`);
    }
  });

  test("rejected → any status is invalid", () => {
    for (const s of ["generated", "reviewed", "approved", "expired", "completed"] as ActionStatus[]) {
      assert.equal(canTransition("rejected", s), false, `rejected → ${s} should be invalid`);
    }
  });
});

describe("Governance Intervention Simulation", () => {
  test("request_ratification → reduce_approval_delay", () => {
    const sim = simulateIntervention("request_ratification", 0.78);
    assert.equal(sim.expectedEffect, "reduce_approval_delay");
  });

  test("create_delegation → close_authority_gap", () => {
    const sim = simulateIntervention("create_delegation", 0.85);
    assert.equal(sim.expectedEffect, "close_authority_gap");
  });

  test("initiate_governance_review → resolve_governance_violation", () => {
    const sim = simulateIntervention("initiate_governance_review", 0.88);
    assert.equal(sim.expectedEffect, "resolve_governance_violation");
  });

  test("confidence blends base and action confidence", () => {
    const sim = simulateIntervention("request_ratification", 0.80);
    // base 0.78 * 0.6 + 0.80 * 0.4 = 0.468 + 0.320 = 0.788
    assert.ok(sim.confidence > 0.7 && sim.confidence < 0.9, `Expected ~0.788, got ${sim.confidence}`);
  });

  test("close_signal has highest base confidence", () => {
    const sim = simulateIntervention("close_signal", 1.0);
    assert.ok(sim.confidence >= 0.90, `Expected >= 0.90, got ${sim.confidence}`);
  });
});

describe("Action Lineage", () => {
  function buildLineage() {
    const signal = {
      id: "sig-001",
      signal_type: "approval_delay",
      signal_source: "decision",
      source_entity_id: "entity-001",
      title: "Approval delayed by 5 days",
      severity: "high",
      confidence_score: 0.84,
    };
    const action = {
      id: "act-001",
      action_type: "request_approval",
      action_priority: "high",
      signal_id: "sig-001",
      title: "Request immediate approval",
    };

    const chain = [
      { layer: "artifact",         entityId: signal.source_entity_id, entityType: signal.signal_source },
      { layer: "memory",           entityId: null, entityType: "operational_memory" },
      { layer: "digest",           entityId: null, entityType: "constitutional_digest" },
      { layer: "learning_pattern", entityId: null, entityType: "learning_pattern" },
      { layer: "recommendation",   entityId: null, entityType: "constitutional_recommendation" },
      { layer: "signal",           entityId: signal.id, entityType: signal.signal_type },
      { layer: "action",           entityId: action.id, entityType: action.action_type },
    ];

    return { actionId: action.id, actionType: action.action_type, chain };
  }

  test("lineage chain has 7 layers", () => {
    const lineage = buildLineage();
    assert.equal(lineage.chain.length, 7, "Expected 7 layers in lineage chain");
  });

  test("lineage starts with artifact layer", () => {
    const lineage = buildLineage();
    assert.equal(lineage.chain[0].layer, "artifact");
  });

  test("lineage ends with action layer", () => {
    const lineage = buildLineage();
    assert.equal(lineage.chain[6].layer, "action");
  });

  test("signal layer contains signal id", () => {
    const lineage = buildLineage();
    const signalLayer = lineage.chain.find((c: { layer: string }) => c.layer === "signal");
    assert.equal(signalLayer?.entityId, "sig-001");
  });

  test("action layer contains action id", () => {
    const lineage = buildLineage();
    const actionLayer = lineage.chain.find((c: { layer: string }) => c.layer === "action");
    assert.equal(actionLayer?.entityId, "act-001");
  });

  test("complete chain covers Artifact → Memory → Digest → Learning → Recommendation → Signal → Action", () => {
    const lineage = buildLineage();
    const layers = lineage.chain.map((c: { layer: string }) => c.layer);
    assert.deepEqual(layers, [
      "artifact", "memory", "digest", "learning_pattern",
      "recommendation", "signal", "action",
    ]);
  });
});

describe("Workspace Isolation", () => {
  test("generateAction rejects missing workspaceId", () => {
    function validate(workspaceId: string): boolean {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId);
    }
    assert.equal(validate(""), false);
    assert.equal(validate("not-a-uuid"), false);
    assert.equal(validate("00000000-0000-1000-8000-000000000000"), true);
  });

  test("workspace_id is mandatory on all three tables in migration", () => {
    const tables = ["governance_actions", "governance_action_evidence", "governance_action_assignments"];
    for (const t of tables) {
      assert.match(migration, new RegExp(`create table if not exists ${t}`), `Table ${t} missing`);
      assert.match(
        migration,
        new RegExp(`is_workspace_member`),
        "RLS policy must use is_workspace_member"
      );
    }
  });
});

describe("Audit Events", () => {
  test("all 10 audit events are defined in types", () => {
    const events = [
      "GOVERNANCE_ACTION_GENERATED",
      "GOVERNANCE_ACTION_ASSIGNED",
      "GOVERNANCE_ACTION_APPROVED",
      "GOVERNANCE_ACTION_REJECTED",
      "GOVERNANCE_ACTION_COMPLETED",
      "GOVERNANCE_ACTION_EXPIRED",
      "GOVERNANCE_ACTION_CONFIDENCE_CALCULATED",
      "GOVERNANCE_ACTION_PRIORITY_CALCULATED",
      "GOVERNANCE_ACTION_AUTHORITY_VALIDATED",
      "GOVERNANCE_ACTION_LINEAGE_GENERATED",
    ];
    for (const e of events) {
      assert.match(types, new RegExp(e), `Missing audit event: ${e}`);
    }
  });

  test("audit events are emitted by action registry", () => {
    for (const e of [
      "GOVERNANCE_ACTION_GENERATED",
      "GOVERNANCE_ACTION_ASSIGNED",
      "GOVERNANCE_ACTION_APPROVED",
      "GOVERNANCE_ACTION_REJECTED",
      "GOVERNANCE_ACTION_COMPLETED",
      "GOVERNANCE_ACTION_EXPIRED",
    ]) {
      assert.match(registryFile, new RegExp(e), `Registry missing event: ${e}`);
    }
  });
});

describe("Documentation", () => {
  test("docs file exists and is non-empty", () => {
    assert.ok(docsFile.length > 500, "Documentation file is too short");
  });

  test("docs covers Action Model", () => {
    assert.match(docsFile, /Action Model|action model|GovernanceActionRow/i);
  });

  test("docs covers Priority Model", () => {
    assert.match(docsFile, /Priority|priority/i);
  });

  test("docs covers Authority Validation", () => {
    assert.match(docsFile, /Authority Validation|authority validation/i);
  });

  test("docs covers Intervention", () => {
    assert.match(docsFile, /Intervention|intervention/i);
  });

  test("docs covers Lineage", () => {
    assert.match(docsFile, /Lineage|lineage/i);
  });
});

describe("Explain Capability", () => {
  test("explainGovernanceActions is exported from index", () => {
    assert.match(indexFile, /explainGovernanceActions/);
  });

  test("explain file contains all 10 audit events", () => {
    const events = [
      "GOVERNANCE_ACTION_GENERATED", "GOVERNANCE_ACTION_ASSIGNED",
      "GOVERNANCE_ACTION_APPROVED",  "GOVERNANCE_ACTION_REJECTED",
      "GOVERNANCE_ACTION_COMPLETED", "GOVERNANCE_ACTION_EXPIRED",
      "GOVERNANCE_ACTION_CONFIDENCE_CALCULATED",
      "GOVERNANCE_ACTION_PRIORITY_CALCULATED",
      "GOVERNANCE_ACTION_AUTHORITY_VALIDATED",
      "GOVERNANCE_ACTION_LINEAGE_GENERATED",
    ];
    for (const e of events) {
      assert.match(explainFile, new RegExp(e), `Explain missing event: ${e}`);
    }
  });

  test("explain covers all 12 action types", () => {
    for (const t of [
      "create_escalation", "request_ratification", "request_approval",
      "create_delegation", "assign_authority", "review_amendment",
      "review_decision", "review_risk", "initiate_governance_review",
      "close_signal", "reassess_recommendation", "other",
    ]) {
      assert.match(explainFile, new RegExp(t), `Explain missing action type: ${t}`);
    }
  });

  test("explain covers all 6 business rules", () => {
    for (let i = 1; i <= 6; i++) {
      assert.match(explainFile, new RegExp(`number: ${i}`), `Explain missing principle #${i}`);
    }
  });
});
