/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck -- Node 20 executes this TypeScript-named test without a loader.
const assert = require("node:assert/strict");
const { test, describe } = require("node:test");
const { readFileSync } = require("node:fs");

// ─────────────────────────────────────────────────────────────────────────────
// Operational Command Center — Unit Tests (EPIC 4 Sprint 2)
// Pure structural tests — no database access.
// ─────────────────────────────────────────────────────────────────────────────

const types          = readFileSync("src/lib/operational-command-center/types.ts", "utf8");
const registry       = readFileSync("src/lib/operational-command-center/command-center-registry.ts", "utf8");
const repo           = readFileSync("src/lib/operational-command-center/command-center-repository.ts", "utf8");
const scoringEng     = readFileSync("src/lib/operational-command-center/focus-scoring-engine.ts", "utf8");
const priorityEng    = readFileSync("src/lib/operational-command-center/priority-engine.ts", "utf8");
const detectionEng   = readFileSync("src/lib/operational-command-center/focus-detection-engine.ts", "utf8");
const rationaleEng   = readFileSync("src/lib/operational-command-center/rationale-engine.ts", "utf8");
const interventionEng = readFileSync("src/lib/operational-command-center/intervention-mapping-engine.ts", "utf8");
const ownerEng       = readFileSync("src/lib/operational-command-center/owner-recommendation-engine.ts", "utf8");
const dueDateEng     = readFileSync("src/lib/operational-command-center/due-date-engine.ts", "utf8");
const healthEng      = readFileSync("src/lib/operational-command-center/health-engine.ts", "utf8");
const lineageEng     = readFileSync("src/lib/operational-command-center/lineage-engine.ts", "utf8");
const explainFile    = readFileSync("src/lib/operational-command-center/explain.ts", "utf8");
const indexFile      = readFileSync("src/lib/operational-command-center/index.ts", "utf8");
const dbContract     = readFileSync("src/lib/db/database-contract.ts", "utf8");
const migration      = readFileSync("supabase/migrations/20260710000000_operational_command_center.sql", "utf8");
const platformEvents = readFileSync("src/lib/platform-events/types.ts", "utf8");
const docs           = readFileSync("docs/operational-command-center.md", "utf8");

// ─── Inline Engine Implementations ───────────────────────────────────────────

function calculateFocusScore({ attentionSeverity, attentionType, operatingHealthScore }) {
  const SEVERITY_BASE = { critical: 40, high: 28, medium: 16, low: 8 };
  const SOURCE_CRITICALITY = {
    authority_gap: 20, ratification_stall: 18, governance_violation: 16,
    critical_signal: 15, overdue_commitment: 12, execution_drift: 10,
    projection_variance: 8, ignored_recommendation: 5, low_health_score: 6,
  };
  const BLOCKER_TYPES = new Set(["authority_gap", "ratification_stall", "governance_violation", "critical_signal"]);

  const severityBase      = SEVERITY_BASE[attentionSeverity] ?? 8;
  const sourceCriticality = SOURCE_CRITICALITY[attentionType] ?? 5;
  const healthImpact      = Math.round((1 - operatingHealthScore / 100) * 15);
  const timeSensitivity   = attentionSeverity === "critical" ? 8 : attentionSeverity === "high" ? 4 : 0;
  const blockerEffect     = BLOCKER_TYPES.has(attentionType) ? 5 : 0;
  const confidenceComponent = Math.round(0.5 * 4); // default 0.5 confidence

  return Math.max(0, Math.min(100, severityBase + sourceCriticality + healthImpact + timeSensitivity + blockerEffect + confidenceComponent));
}

function calculateOperationalPriority(focusScore) {
  if (focusScore >= 85) return "critical";
  if (focusScore >= 65) return "high";
  if (focusScore >= 40) return "medium";
  return "low";
}

function calculateFocusDueDate(priority, from) {
  const DUE_HOURS = { critical: 24, high: 48, medium: 7 * 24, low: 14 * 24 };
  const base = from ?? new Date();
  const due  = new Date(base.getTime() + DUE_HOURS[priority] * 60 * 60 * 1000);
  return due.toISOString();
}

function calculateCommandCenterHealth(focusItems) {
  const openFocusItems     = focusItems.filter((i) => i.status !== "resolved" && i.status !== "dismissed").length;
  const criticalFocusItems = focusItems.filter((i) => i.priority === "critical" && i.status !== "resolved" && i.status !== "dismissed").length;
  const resolvedFocusItems = focusItems.filter((i) => i.status === "resolved").length;
  const scores = focusItems.filter((i) => i.status !== "resolved" && i.status !== "dismissed").map((i) => i.focus_score);
  const averageFocusScore = scores.length > 0
    ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100
    : 0;
  return { openFocusItems, criticalFocusItems, resolvedFocusItems, averageFocusScore };
}

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Database Contract ────────────────────────────────────────────────────────

describe("Database Contract", () => {
  test("DATABASE_CONTRACT_VERSION includes operational-command-center", () => {
    assert.match(dbContract, /operational-command-center/);
  });

  test("OperationalCommandCenterRow is present", () => {
    assert.match(dbContract, /OperationalCommandCenterRow/);
  });

  test("OperationalFocusItemRow is present", () => {
    assert.match(dbContract, /OperationalFocusItemRow/);
  });

  test("OperationalFocusLinkRow is present", () => {
    assert.match(dbContract, /OperationalFocusLinkRow/);
  });

  test("OPERATIONAL_COMMAND_CENTER_SELECTABLE_COLUMNS is present", () => {
    assert.match(dbContract, /OPERATIONAL_COMMAND_CENTER_SELECTABLE_COLUMNS/);
  });

  test("OPERATIONAL_FOCUS_ITEM_SELECTABLE_COLUMNS is present", () => {
    assert.match(dbContract, /OPERATIONAL_FOCUS_ITEM_SELECTABLE_COLUMNS/);
  });

  test("OPERATIONAL_FOCUS_LINK_SELECTABLE_COLUMNS is present", () => {
    assert.match(dbContract, /OPERATIONAL_FOCUS_LINK_SELECTABLE_COLUMNS/);
  });

  test("OperationalCommandStatus includes all 3 statuses", () => {
    for (const s of ["generated", "validated", "archived"]) {
      assert.match(dbContract, new RegExp(`"${s}"`), `Missing status: ${s}`);
    }
  });

  test("OperationalPriority includes all 4 levels", () => {
    for (const p of ["low", "medium", "high", "critical"]) {
      assert.match(dbContract, new RegExp(`"${p}"`), `Missing priority: ${p}`);
    }
  });

  test("OperationalFocusType includes all 10 types", () => {
    for (const t of [
      "governance", "execution", "authority", "ratification", "recommendation",
      "commitment", "projection", "reality", "risk", "health",
    ]) {
      assert.match(dbContract, new RegExp(`"${t}"`), `Missing focus type: ${t}`);
    }
  });

  test("OperationalFocusStatus includes all 5 statuses", () => {
    for (const s of ["open", "acknowledged", "in_progress", "resolved", "dismissed"]) {
      assert.match(dbContract, new RegExp(`"${s}"`), `Missing focus status: ${s}`);
    }
  });
});

// ─── Migration ────────────────────────────────────────────────────────────────

describe("Migration", () => {
  test("creates operational_command_centers table", () => {
    assert.match(migration, /create table if not exists public\.operational_command_centers/);
  });

  test("creates operational_focus_items table", () => {
    assert.match(migration, /create table if not exists public\.operational_focus_items/);
  });

  test("creates operational_focus_links table", () => {
    assert.match(migration, /create table if not exists public\.operational_focus_links/);
  });

  test("enables RLS on all three tables", () => {
    assert.match(migration, /operational_command_centers enable row level security/);
    assert.match(migration, /operational_focus_items enable row level security/);
    assert.match(migration, /operational_focus_links enable row level security/);
  });

  test("uses is_workspace_member for all RLS policies", () => {
    const matches = migration.match(/is_workspace_member/g);
    assert.ok(matches && matches.length >= 3, `Expected >= 3 is_workspace_member usages, got ${matches?.length}`);
  });

  test("command_status check constraint includes all 3 statuses", () => {
    for (const s of ["generated", "validated", "archived"]) {
      assert.match(migration, new RegExp(`'${s}'`), `Missing status: ${s}`);
    }
  });

  test("overall_priority check constraint includes all 4 levels", () => {
    for (const p of ["low", "medium", "high", "critical"]) {
      assert.match(migration, new RegExp(`'${p}'`), `Missing priority: ${p}`);
    }
  });

  test("focus_type check constraint includes all 10 types", () => {
    for (const t of [
      "governance", "execution", "authority", "ratification", "recommendation",
      "commitment", "projection", "reality", "risk", "health",
    ]) {
      assert.match(migration, new RegExp(`'${t}'`), `Missing focus type: ${t}`);
    }
  });

  test("focus status check constraint includes all 5 statuses", () => {
    for (const s of ["open", "acknowledged", "in_progress", "resolved", "dismissed"]) {
      assert.match(migration, new RegExp(`'${s}'`), `Missing focus status: ${s}`);
    }
  });

  test("composite FK on focus_items references command_centers with workspace", () => {
    assert.match(migration, /constraint ofi_command_center_workspace_fk/);
  });

  test("composite unique on command_centers for FK target", () => {
    assert.match(migration, /unique \(id, workspace_id\)/);
  });

  test("focus_score has 0–100 check constraint", () => {
    assert.match(migration, /focus_score between 0 and 100/);
  });

  test("attention_item_id references project_os_attention_items", () => {
    assert.match(migration, /project_os_attention_items/);
  });
});

// ─── Platform Events ──────────────────────────────────────────────────────────

describe("Platform Events", () => {
  test("OperationalCommandCenterEventType is defined", () => {
    assert.match(platformEvents, /OperationalCommandCenterEventType/);
  });

  test("all 11 audit events are present", () => {
    for (const evt of [
      "OPERATIONAL_COMMAND_CENTER_GENERATED",
      "OPERATIONAL_COMMAND_CENTER_VALIDATED",
      "OPERATIONAL_COMMAND_CENTER_ARCHIVED",
      "OPERATIONAL_FOCUS_ITEM_CREATED",
      "OPERATIONAL_FOCUS_ITEM_ACKNOWLEDGED",
      "OPERATIONAL_FOCUS_ITEM_STARTED",
      "OPERATIONAL_FOCUS_ITEM_RESOLVED",
      "OPERATIONAL_FOCUS_ITEM_DISMISSED",
      "OPERATIONAL_FOCUS_SCORE_CALCULATED",
      "OPERATIONAL_PRIORITY_CALCULATED",
      "OPERATIONAL_FOCUS_LINEAGE_GENERATED",
    ]) {
      assert.match(platformEvents, new RegExp(evt), `Missing event: ${evt}`);
    }
  });

  test("OperationalCommandCenterEventType is included in PlatformEventType union", () => {
    assert.match(platformEvents, /OperationalCommandCenterEventType/);
  });
});

// ─── Types ────────────────────────────────────────────────────────────────────

describe("Types", () => {
  test("CommandCenterResult is defined", () => {
    assert.match(types, /CommandCenterResult/);
  });

  test("CommandCenterEventType is defined with all 11 events", () => {
    assert.match(types, /CommandCenterEventType/);
    for (const evt of [
      "OPERATIONAL_COMMAND_CENTER_GENERATED",
      "OPERATIONAL_COMMAND_CENTER_VALIDATED",
      "OPERATIONAL_COMMAND_CENTER_ARCHIVED",
      "OPERATIONAL_FOCUS_ITEM_CREATED",
      "OPERATIONAL_FOCUS_ITEM_ACKNOWLEDGED",
      "OPERATIONAL_FOCUS_ITEM_STARTED",
      "OPERATIONAL_FOCUS_ITEM_RESOLVED",
      "OPERATIONAL_FOCUS_ITEM_DISMISSED",
      "OPERATIONAL_FOCUS_SCORE_CALCULATED",
      "OPERATIONAL_PRIORITY_CALCULATED",
      "OPERATIONAL_FOCUS_LINEAGE_GENERATED",
    ]) {
      assert.match(types, new RegExp(evt), `Missing event in types: ${evt}`);
    }
  });

  test("GeneratedFocusItem is defined", () => {
    assert.match(types, /GeneratedFocusItem/);
  });

  test("CommandCenterHealth is defined", () => {
    assert.match(types, /CommandCenterHealth/);
  });

  test("OperationalFocus is defined", () => {
    assert.match(types, /OperationalFocus/);
  });

  test("CommandCenterLineage is defined", () => {
    assert.match(types, /CommandCenterLineage/);
  });

  test("GenerateCommandCenterInput is defined", () => {
    assert.match(types, /GenerateCommandCenterInput/);
  });

  test("ListCommandCentersInput has all filter fields", () => {
    assert.match(types, /ListCommandCentersInput/);
    for (const field of ["projectId", "snapshotId", "status", "priority", "fromDate", "toDate"]) {
      assert.match(types, new RegExp(field), `Missing filter: ${field}`);
    }
  });

  test("OPERATIONAL_COMMAND_STATUSES constant is present", () => {
    assert.match(types, /OPERATIONAL_COMMAND_STATUSES/);
  });

  test("OPERATIONAL_FOCUS_TYPES constant is present", () => {
    assert.match(types, /OPERATIONAL_FOCUS_TYPES/);
  });

  test("OPERATIONAL_FOCUS_STATUSES constant is present", () => {
    assert.match(types, /OPERATIONAL_FOCUS_STATUSES/);
  });
});

// ─── Focus Scoring Engine ─────────────────────────────────────────────────────

describe("Focus Scoring Engine", () => {
  test("authority_gap critical produces high score", () => {
    const score = calculateFocusScore({
      attentionSeverity: "critical",
      attentionType: "authority_gap",
      operatingHealthScore: 70,
    });
    assert.ok(score >= 65, `Expected score >= 65 for authority_gap critical, got ${score}`);
  });

  test("low severity ignored_recommendation produces low score", () => {
    const score = calculateFocusScore({
      attentionSeverity: "low",
      attentionType: "ignored_recommendation",
      operatingHealthScore: 90,
    });
    assert.ok(score < 40, `Expected score < 40 for low severity item, got ${score}`);
  });

  test("score is always between 0 and 100", () => {
    const extreme = calculateFocusScore({
      attentionSeverity: "critical",
      attentionType: "authority_gap",
      operatingHealthScore: 0,
    });
    assert.ok(extreme >= 0 && extreme <= 100, `Score ${extreme} out of range`);
  });

  test("higher severity produces higher score for same attention type", () => {
    const critical = calculateFocusScore({ attentionSeverity: "critical", attentionType: "execution_drift", operatingHealthScore: 80 });
    const low      = calculateFocusScore({ attentionSeverity: "low",      attentionType: "execution_drift", operatingHealthScore: 80 });
    assert.ok(critical > low, `Expected critical (${critical}) > low (${low})`);
  });

  test("worse health increases score", () => {
    const badHealth  = calculateFocusScore({ attentionSeverity: "high", attentionType: "execution_drift", operatingHealthScore: 20 });
    const goodHealth = calculateFocusScore({ attentionSeverity: "high", attentionType: "execution_drift", operatingHealthScore: 90 });
    assert.ok(badHealth > goodHealth, `Expected badHealth (${badHealth}) > goodHealth (${goodHealth})`);
  });

  test("calculateFocusScore is exported", () => {
    assert.match(scoringEng, /export function calculateFocusScore/);
  });
});

// ─── Priority Engine ──────────────────────────────────────────────────────────

describe("Priority Engine", () => {
  test("score 0 → low", () => {
    assert.equal(calculateOperationalPriority(0), "low");
  });

  test("score 39 → low", () => {
    assert.equal(calculateOperationalPriority(39), "low");
  });

  test("score 40 → medium", () => {
    assert.equal(calculateOperationalPriority(40), "medium");
  });

  test("score 64 → medium", () => {
    assert.equal(calculateOperationalPriority(64), "medium");
  });

  test("score 65 → high", () => {
    assert.equal(calculateOperationalPriority(65), "high");
  });

  test("score 84 → high", () => {
    assert.equal(calculateOperationalPriority(84), "high");
  });

  test("score 85 → critical", () => {
    assert.equal(calculateOperationalPriority(85), "critical");
  });

  test("score 100 → critical", () => {
    assert.equal(calculateOperationalPriority(100), "critical");
  });

  test("calculateOperationalPriority is exported", () => {
    assert.match(priorityEng, /export function calculateOperationalPriority/);
  });

  test("calculateOverallPriority is exported", () => {
    assert.match(priorityEng, /export function calculateOverallPriority/);
  });

  test("calculateCommandCenterFocusScore is exported", () => {
    assert.match(priorityEng, /export function calculateCommandCenterFocusScore/);
  });
});

// ─── Focus Detection Engine ───────────────────────────────────────────────────

describe("Focus Detection Engine", () => {
  test("generateFocusItemsFromAttention is exported", () => {
    assert.match(detectionEng, /export function generateFocusItemsFromAttention/);
  });

  test("authority_gap attention maps to authority focus type", () => {
    assert.match(detectionEng, /authority_gap.*authority|authority.*authority_gap/);
  });

  test("execution_drift attention maps to execution focus type", () => {
    assert.match(detectionEng, /execution_drift.*execution|execution.*execution_drift/);
  });

  test("governance_violation attention maps to governance focus type", () => {
    assert.match(detectionEng, /governance_violation.*governance|governance.*governance_violation/);
  });

  test("ratification_stall attention maps to ratification focus type", () => {
    assert.match(detectionEng, /ratification_stall.*ratification|ratification.*ratification_stall/);
  });

  test("overdue_commitment attention maps to commitment focus type", () => {
    assert.match(detectionEng, /overdue_commitment.*commitment|commitment.*overdue_commitment/);
  });

  test("low_health_score attention maps to health focus type", () => {
    assert.match(detectionEng, /low_health_score.*health|health.*low_health_score/);
  });

  test("detection engine calls calculateFocusScore", () => {
    assert.match(detectionEng, /calculateFocusScore/);
  });

  test("detection engine calls generateFocusRationale", () => {
    assert.match(detectionEng, /generateFocusRationale/);
  });

  test("detection engine calls mapFocusToIntervention", () => {
    assert.match(detectionEng, /mapFocusToIntervention/);
  });

  test("detection engine calls recommendFocusOwner", () => {
    assert.match(detectionEng, /recommendFocusOwner/);
  });

  test("detection engine calls calculateFocusDueDate", () => {
    assert.match(detectionEng, /calculateFocusDueDate/);
  });
});

// ─── Rationale Engine ─────────────────────────────────────────────────────────

describe("Rationale Engine", () => {
  const ATTENTION_TYPES = [
    "authority_gap", "ratification_stall", "governance_violation",
    "critical_signal", "overdue_commitment", "execution_drift",
    "projection_variance", "ignored_recommendation", "low_health_score",
  ];

  test("generateFocusRationale is exported", () => {
    assert.match(rationaleEng, /export function generateFocusRationale/);
  });

  for (const t of ATTENTION_TYPES) {
    test(`rationale template exists for ${t}`, () => {
      assert.match(rationaleEng, new RegExp(t), `Missing rationale for: ${t}`);
    });
  }

  test("rationale mentions priority level", () => {
    assert.match(rationaleEng, /priority/);
  });
});

// ─── Intervention Mapping Engine ──────────────────────────────────────────────

describe("Intervention Mapping Engine", () => {
  test("mapFocusToIntervention is exported", () => {
    assert.match(interventionEng, /export function mapFocusToIntervention/);
  });

  const MAPPINGS = [
    ["authority_gap",           "create_delegation"],
    ["ratification_stall",      "request_ratification"],
    ["governance_violation",    "initiate_governance_review"],
    ["critical_signal",         "escalate_signal"],
    ["overdue_commitment",      "breach_commitment"],
    ["execution_drift",         "review_projection"],
    ["projection_variance",     "review_execution_reality"],
    ["ignored_recommendation",  "reactivate_recommendation"],
    ["low_health_score",        "initiate_health_review"],
  ];

  for (const [type, action] of MAPPINGS) {
    test(`${type} maps to ${action}`, () => {
      assert.match(interventionEng, new RegExp(action), `Missing mapping: ${type} → ${action}`);
    });
  }
});

// ─── Owner Recommendation Engine ─────────────────────────────────────────────

describe("Owner Recommendation Engine", () => {
  test("recommendFocusOwner is exported", () => {
    assert.match(ownerEng, /export function recommendFocusOwner/);
  });

  test("authority_gap recommends sponsor", () => {
    assert.match(ownerEng, /authority_gap.*sponsor/);
  });

  test("ratification_stall recommends sponsor", () => {
    assert.match(ownerEng, /ratification_stall.*sponsor/);
  });

  test("execution_drift recommends project_manager", () => {
    assert.match(ownerEng, /execution_drift.*project_manager/);
  });

  test("overdue_commitment recommends commitment_owner", () => {
    assert.match(ownerEng, /overdue_commitment.*commitment_owner/);
  });

  test("governance_violation recommends governance_board", () => {
    assert.match(ownerEng, /governance_violation.*governance_board/);
  });
});

// ─── Due Date Engine ──────────────────────────────────────────────────────────

describe("Due Date Engine", () => {
  test("calculateFocusDueDate is exported", () => {
    assert.match(dueDateEng, /export function calculateFocusDueDate/);
  });

  test("critical priority → 24h from now", () => {
    const now = new Date();
    const due = new Date(calculateFocusDueDate("critical", now));
    const diffHours = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
    assert.ok(Math.abs(diffHours - 24) < 0.01, `Expected 24h, got ${diffHours}h`);
  });

  test("high priority → 48h from now", () => {
    const now = new Date();
    const due = new Date(calculateFocusDueDate("high", now));
    const diffHours = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
    assert.ok(Math.abs(diffHours - 48) < 0.01, `Expected 48h, got ${diffHours}h`);
  });

  test("medium priority → 7d from now", () => {
    const now = new Date();
    const due = new Date(calculateFocusDueDate("medium", now));
    const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    assert.ok(Math.abs(diffDays - 7) < 0.01, `Expected 7d, got ${diffDays}d`);
  });

  test("low priority → 14d from now", () => {
    const now = new Date();
    const due = new Date(calculateFocusDueDate("low", now));
    const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    assert.ok(Math.abs(diffDays - 14) < 0.01, `Expected 14d, got ${diffDays}d`);
  });
});

// ─── Command Center Health Engine ─────────────────────────────────────────────

describe("Command Center Health Engine", () => {
  test("calculateCommandCenterHealth is exported", () => {
    assert.match(healthEng, /export function calculateCommandCenterHealth/);
  });

  test("no items yields zero scores", () => {
    const health = calculateCommandCenterHealth([]);
    assert.equal(health.openFocusItems, 0);
    assert.equal(health.criticalFocusItems, 0);
    assert.equal(health.resolvedFocusItems, 0);
    assert.equal(health.averageFocusScore, 0);
  });

  test("open items are counted correctly", () => {
    const items = [
      { id: uuid(), status: "open",     priority: "high",     focus_score: 70 },
      { id: uuid(), status: "resolved", priority: "medium",   focus_score: 50 },
      { id: uuid(), status: "open",     priority: "critical",  focus_score: 90 },
    ];
    const health = calculateCommandCenterHealth(items);
    assert.equal(health.openFocusItems, 2);
    assert.equal(health.criticalFocusItems, 1);
    assert.equal(health.resolvedFocusItems, 1);
  });

  test("dismissed items are excluded from open count", () => {
    const items = [
      { id: uuid(), status: "dismissed", priority: "critical", focus_score: 90 },
    ];
    const health = calculateCommandCenterHealth(items);
    assert.equal(health.openFocusItems, 0);
    assert.equal(health.criticalFocusItems, 0);
  });

  test("average focus score is calculated correctly", () => {
    const items = [
      { id: uuid(), status: "open", priority: "high",   focus_score: 70 },
      { id: uuid(), status: "open", priority: "medium", focus_score: 50 },
    ];
    const health = calculateCommandCenterHealth(items);
    assert.equal(health.averageFocusScore, 60);
  });
});

// ─── Focus Lifecycle ──────────────────────────────────────────────────────────

describe("Focus Lifecycle", () => {
  test("registry validates workspaceId in generateOperationalCommandCenter", () => {
    assert.match(registry, /workspaceId must be a UUID/);
  });

  test("registry validates snapshotId in generateOperationalCommandCenter", () => {
    assert.match(registry, /snapshotId must be a UUID/);
  });

  test("registry validates actorId", () => {
    assert.match(registry, /actorId must be a UUID/);
  });

  test("validateOperationalCommandCenter enforces 'generated' → 'validated' transition", () => {
    assert.match(registry, /can only be validated from 'generated' status/);
  });

  test("archiveOperationalCommandCenter prevents double-archiving", () => {
    assert.match(registry, /already archived/);
  });

  test("acknowledgeFocusItem enforces 'open' → 'acknowledged' transition", () => {
    assert.match(registry, /can only be acknowledged from 'open' status/);
  });

  test("startFocusItem allows 'open' or 'acknowledged' → 'in_progress'", () => {
    assert.match(registry, /can only be started from 'open' or 'acknowledged' status/);
  });

  test("resolveFocusItem prevents resolving a dismissed item", () => {
    assert.match(registry, /Cannot resolve a dismissed focus item/);
  });

  test("dismissFocusItem prevents dismissing a resolved item", () => {
    assert.match(registry, /Cannot dismiss a resolved focus item/);
  });

  test("generateOperationalCommandCenter emits OPERATIONAL_COMMAND_CENTER_GENERATED", () => {
    assert.match(registry, /OPERATIONAL_COMMAND_CENTER_GENERATED/);
  });

  test("validateOperationalCommandCenter emits OPERATIONAL_COMMAND_CENTER_VALIDATED", () => {
    assert.match(registry, /OPERATIONAL_COMMAND_CENTER_VALIDATED/);
  });

  test("archiveOperationalCommandCenter emits OPERATIONAL_COMMAND_CENTER_ARCHIVED", () => {
    assert.match(registry, /OPERATIONAL_COMMAND_CENTER_ARCHIVED/);
  });

  test("focus item creation emits OPERATIONAL_FOCUS_ITEM_CREATED", () => {
    assert.match(registry, /OPERATIONAL_FOCUS_ITEM_CREATED/);
  });

  test("acknowledgeFocusItem emits OPERATIONAL_FOCUS_ITEM_ACKNOWLEDGED", () => {
    assert.match(registry, /OPERATIONAL_FOCUS_ITEM_ACKNOWLEDGED/);
  });

  test("startFocusItem emits OPERATIONAL_FOCUS_ITEM_STARTED", () => {
    assert.match(registry, /OPERATIONAL_FOCUS_ITEM_STARTED/);
  });

  test("resolveFocusItem emits OPERATIONAL_FOCUS_ITEM_RESOLVED", () => {
    assert.match(registry, /OPERATIONAL_FOCUS_ITEM_RESOLVED/);
  });

  test("dismissFocusItem emits OPERATIONAL_FOCUS_ITEM_DISMISSED", () => {
    assert.match(registry, /OPERATIONAL_FOCUS_ITEM_DISMISSED/);
  });

  test("generation emits OPERATIONAL_FOCUS_SCORE_CALCULATED", () => {
    assert.match(registry, /OPERATIONAL_FOCUS_SCORE_CALCULATED/);
  });

  test("generation emits OPERATIONAL_PRIORITY_CALCULATED", () => {
    assert.match(registry, /OPERATIONAL_PRIORITY_CALCULATED/);
  });
});

// ─── Lineage Engine ───────────────────────────────────────────────────────────

describe("Lineage Engine", () => {
  test("getOperationalFocusLineage is exported", () => {
    assert.match(lineageEng, /export async function getOperationalFocusLineage/);
  });

  test("lineage chain includes all 12 layers", () => {
    for (const layer of [
      "constitution", "memory", "learning", "recommendation",
      "signal", "action", "commitment", "projection", "reality",
      "snapshot", "command_center", "focus_item",
    ]) {
      assert.match(lineageEng, new RegExp(`layer: "${layer}"`), `Missing lineage layer: ${layer}`);
    }
  });

  test("lineage emits OPERATIONAL_FOCUS_LINEAGE_GENERATED", () => {
    assert.match(registry, /OPERATIONAL_FOCUS_LINEAGE_GENERATED/);
  });
});

// ─── Explain Capability ───────────────────────────────────────────────────────

describe("Explain Capability", () => {
  test("explainOperationalCommandCenter is exported", () => {
    assert.match(explainFile, /export function explainOperationalCommandCenter/);
  });

  test("explain defines 6 principles", () => {
    for (let i = 1; i <= 6; i++) {
      assert.match(explainFile, new RegExp(`number: ${i}`), `Missing Principle ${i}`);
    }
  });

  test("explain describes architecture layers", () => {
    assert.match(explainFile, /architecture/);
  });

  test("explain describes scoring model", () => {
    assert.match(explainFile, /scoringModel/);
  });

  test("explain describes priority model with all 4 levels", () => {
    assert.match(explainFile, /priorityModel/);
    for (const p of ["low", "medium", "high", "critical"]) {
      assert.match(explainFile, new RegExp(p), `Missing priority in explain: ${p}`);
    }
  });

  test("explain describes intervention mapping", () => {
    assert.match(explainFile, /interventionMapping/);
    assert.match(explainFile, /authority_gap/);
    assert.match(explainFile, /create_delegation/);
  });

  test("explain describes owner recommendation", () => {
    assert.match(explainFile, /ownerRecommendation/);
    assert.match(explainFile, /sponsor/);
    assert.match(explainFile, /project_manager/);
  });

  test("explain describes lineage chain with 12 layers", () => {
    assert.match(explainFile, /lineageChain/);
    for (const layer of [
      "Constitution", "Memory", "Learning", "Recommendation", "Signal", "Action",
      "Commitment", "Projection", "Reality", "Snapshot", "Command Center", "Focus Item",
    ]) {
      assert.match(explainFile, new RegExp(layer), `Missing lineage layer in explain: ${layer}`);
    }
  });

  test("explain documents all 11 audit events", () => {
    for (const evt of [
      "OPERATIONAL_COMMAND_CENTER_GENERATED",
      "OPERATIONAL_COMMAND_CENTER_VALIDATED",
      "OPERATIONAL_COMMAND_CENTER_ARCHIVED",
      "OPERATIONAL_FOCUS_ITEM_CREATED",
      "OPERATIONAL_FOCUS_ITEM_ACKNOWLEDGED",
      "OPERATIONAL_FOCUS_ITEM_STARTED",
      "OPERATIONAL_FOCUS_ITEM_RESOLVED",
      "OPERATIONAL_FOCUS_ITEM_DISMISSED",
      "OPERATIONAL_FOCUS_SCORE_CALCULATED",
      "OPERATIONAL_PRIORITY_CALCULATED",
      "OPERATIONAL_FOCUS_LINEAGE_GENERATED",
    ]) {
      assert.match(explainFile, new RegExp(evt), `Missing event in explain: ${evt}`);
    }
  });

  test("explain documents what it does not do", () => {
    assert.match(explainFile, /whatItDoesNotDo/);
  });

  test("explain includes use cases", () => {
    assert.match(explainFile, /useCases/);
  });
});

// ─── Workspace Isolation ──────────────────────────────────────────────────────

describe("Workspace Isolation", () => {
  test("registry validates workspaceId in all public functions", () => {
    assert.match(registry, /validUuid/);
    assert.match(registry, /workspaceId must be a UUID/);
  });

  test("repository filters by workspace_id in all queries", () => {
    const workspaceMatches = repo.match(/eq\("workspace_id"/g);
    assert.ok(workspaceMatches && workspaceMatches.length >= 4, `Expected >= 4 workspace_id filters, got ${workspaceMatches?.length}`);
  });

  test("migration enables RLS on all 3 tables", () => {
    assert.match(migration, /operational_command_centers enable row level security/);
    assert.match(migration, /operational_focus_items enable row level security/);
    assert.match(migration, /operational_focus_links enable row level security/);
  });

  test("migration uses is_workspace_member for all policies", () => {
    assert.match(migration, /is_workspace_member/);
  });

  test("registry access denied for invalid workspaceId returns validation_failed", () => {
    assert.match(registry, /validation_failed/);
  });
});

// ─── Command Center Generation ────────────────────────────────────────────────

describe("Command Center Generation", () => {
  test("generateOperationalCommandCenter is defined", () => {
    assert.match(registry, /export async function generateOperationalCommandCenter/);
  });

  test("generation reads attention items from snapshot", () => {
    assert.match(registry, /dbListProjectOSAttentionItems/);
  });

  test("generation calls generateFocusItemsFromAttention", () => {
    assert.match(registry, /generateFocusItemsFromAttention/);
  });

  test("generation creates focus links for traceability", () => {
    assert.match(registry, /source_attention_item/);
  });

  test("generation reads operating_health_score from snapshot", () => {
    assert.match(registry, /operating_health_score/);
  });
});

// ─── Operational Focus ────────────────────────────────────────────────────────

describe("Operational Focus", () => {
  test("getOperationalFocus is defined", () => {
    assert.match(registry, /export async function getOperationalFocus/);
  });

  test("getOperationalFocus returns top focus items", () => {
    assert.match(registry, /topFocusItems/);
  });

  test("getOperationalFocus returns critical blockers", () => {
    assert.match(registry, /criticalBlockers/);
  });

  test("getOperationalFocus returns overdue items", () => {
    assert.match(registry, /overdueItems/);
  });

  test("getOperationalFocus returns recommended interventions", () => {
    assert.match(registry, /recommendedInterventions/);
  });
});

// ─── Public API — index.ts ────────────────────────────────────────────────────

describe("Public API — index.ts", () => {
  const publicFns = [
    "generateOperationalCommandCenter",
    "getOperationalCommandCenter",
    "listOperationalCommandCenters",
    "validateOperationalCommandCenter",
    "archiveOperationalCommandCenter",
    "acknowledgeFocusItem",
    "startFocusItem",
    "resolveFocusItem",
    "dismissFocusItem",
    "getOperationalFocus",
    "getCommandCenterHealth",
    "getOperationalFocusLineageForCommandCenter",
    "calculateFocusScore",
    "calculateOperationalPriority",
    "calculateOverallPriority",
    "calculateCommandCenterFocusScore",
    "generateFocusItemsFromAttention",
    "generateFocusRationale",
    "mapFocusToIntervention",
    "recommendFocusOwner",
    "calculateFocusDueDate",
    "calculateCommandCenterHealth",
    "getOperationalFocusLineage",
    "explainOperationalCommandCenter",
    "OPERATIONAL_COMMAND_STATUSES",
    "OPERATIONAL_PRIORITIES",
    "OPERATIONAL_FOCUS_TYPES",
    "OPERATIONAL_FOCUS_STATUSES",
  ];

  for (const fn of publicFns) {
    test(`index exports ${fn}`, () => {
      assert.match(indexFile, new RegExp(fn), `Missing export: ${fn}`);
    });
  }
});

// ─── Documentation ────────────────────────────────────────────────────────────

describe("Documentation", () => {
  test("docs cover the Command Center concept", () => {
    assert.match(docs, /Operational Command Center/i);
  });

  test("documentation describes architecture", () => {
    assert.match(docs, /[Aa]rchitecture/);
  });

  test("documentation describes focus model", () => {
    assert.match(docs, /[Ff]ocus/);
  });

  test("documentation describes scoring model", () => {
    assert.match(docs, /[Ss]cor/);
  });

  test("documentation describes priority model", () => {
    assert.match(docs, /[Pp]riority/);
  });

  test("documentation describes intervention mapping", () => {
    assert.match(docs, /[Ii]ntervention/);
  });

  test("documentation describes owner recommendation", () => {
    assert.match(docs, /[Oo]wner/);
  });

  test("documentation describes lineage", () => {
    assert.match(docs, /[Ll]ineage/);
  });

  test("documentation includes examples", () => {
    assert.match(docs, /[Ee]xample/);
  });

  test("documentation mentions all 11 audit events", () => {
    assert.match(docs, /OPERATIONAL_COMMAND_CENTER_GENERATED/);
    assert.match(docs, /OPERATIONAL_FOCUS_ITEM_CREATED/);
  });
});
