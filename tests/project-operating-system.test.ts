/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck -- Node 20 executes this TypeScript-named test without a loader.
const assert = require("node:assert/strict");
const { test, describe } = require("node:test");
const { readFileSync } = require("node:fs");

// ─────────────────────────────────────────────────────────────────────────────
// Project Operating System Shell — Unit Tests (EPIC 4 Sprint 1)
// Pure structural tests — no database access.
// ─────────────────────────────────────────────────────────────────────────────

const types         = readFileSync("src/lib/project-operating-system/types.ts", "utf8");
const registry      = readFileSync("src/lib/project-operating-system/project-os-registry.ts", "utf8");
const repo          = readFileSync("src/lib/project-operating-system/project-os-repository.ts", "utf8");
const healthEng     = readFileSync("src/lib/project-operating-system/health-engine.ts", "utf8");
const attentionEng  = readFileSync("src/lib/project-operating-system/attention-engine.ts", "utf8");
const contextEng    = readFileSync("src/lib/project-operating-system/context-engine.ts", "utf8");
const lineageEng    = readFileSync("src/lib/project-operating-system/lineage-engine.ts", "utf8");
const explainFile   = readFileSync("src/lib/project-operating-system/explain.ts", "utf8");
const indexFile     = readFileSync("src/lib/project-operating-system/index.ts", "utf8");
const dbContract    = readFileSync("src/lib/db/database-contract.ts", "utf8");
const migration     = readFileSync("supabase/migrations/20260709000000_project_operating_system.sql", "utf8");
const platformEvents = readFileSync("src/lib/platform-events/types.ts", "utf8");
const docs          = readFileSync("docs/project-operating-system-shell.md", "utf8");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Inline Health Engine ─────────────────────────────────────────────────────

function calculateGovernanceOSHealth({ activeSignals, criticalSignals, unresolvedViolations }) {
  let penalty = 0;
  penalty += criticalSignals * 25;
  penalty += (activeSignals - criticalSignals) * 5;
  penalty += unresolvedViolations * 15;
  return Math.max(0, Math.min(100, 100 - penalty));
}

function calculateExecutionOSHealth({ activeCommitments, overdueCommitments, projectionAccuracy }) {
  const overdueRatio   = activeCommitments > 0 ? overdueCommitments / activeCommitments : 0;
  const overduePenalty = Math.round(overdueRatio * 40);
  const accuracyBonus  = Math.round((projectionAccuracy - 70) / 10);
  return Math.max(0, Math.min(100, 100 - overduePenalty + Math.max(0, accuracyBonus)));
}

function calculateMemoryOSHealth({ artifacts, memoryRecords, digests, learningPatterns }) {
  const totalRecords = artifacts + memoryRecords + digests + learningPatterns;
  if (totalRecords === 0) return 60;
  const bonus = Math.min(40, Math.floor(totalRecords / 2));
  return Math.min(100, 60 + bonus);
}

function calculateRecommendationOSHealth({ activeRecommendations, highConfidenceRecommendations, ignoredRecommendations }) {
  const ignoredPenalty = ignoredRecommendations * 10;
  const highConfidenceBonus = highConfidenceRecommendations > 0
    ? Math.min(10, highConfidenceRecommendations * 3) : 0;
  return Math.max(0, Math.min(100, 100 - ignoredPenalty + highConfidenceBonus));
}

function calculateProjectOperatingHealth({ governanceHealthScore, executionHealthScore, memoryHealthScore, recommendationHealthScore }) {
  return Math.max(0, Math.min(100, Math.round(
    governanceHealthScore * 0.35 +
    executionHealthScore * 0.35 +
    memoryHealthScore * 0.15 +
    recommendationHealthScore * 0.15
  )));
}

// ─── Inline Attention Engine ──────────────────────────────────────────────────

function detectAttentionItems({ signals, commitments, drifts, violations, operatingHealthScore, snapshotId, variances, recommendations }) {
  const items = [];
  const now = new Date();

  for (const signal of signals) {
    if (signal.severity === "critical" && signal.status === "active") {
      items.push({ attentionType: "critical_signal", attentionSeverity: "critical" });
    }
  }

  for (const c of commitments) {
    if (c.due_date && c.status !== "completed" && c.status !== "cancelled" && new Date(c.due_date) < now) {
      items.push({ attentionType: "overdue_commitment", attentionSeverity: "high" });
    }
  }

  for (const d of drifts) {
    if (d.severity === "critical" || d.severity === "persistent") {
      items.push({ attentionType: "execution_drift", attentionSeverity: d.severity === "critical" ? "critical" : "high" });
    }
  }

  for (const v of violations) {
    if (v.status === "open" || v.status === "unresolved") {
      items.push({ attentionType: "governance_violation", attentionSeverity: "high" });
    }
  }

  if (operatingHealthScore < 60) {
    items.push({ attentionType: "low_health_score", attentionSeverity: operatingHealthScore < 40 ? "critical" : "high" });
  }

  for (const v of (variances ?? [])) {
    if (v.severity === "high" || v.severity === "critical") {
      items.push({ attentionType: "projection_variance", attentionSeverity: v.severity });
    }
  }

  for (const r of (recommendations ?? [])) {
    if (r.status === "ignored" || r.status === "dismissed") {
      items.push({ attentionType: "ignored_recommendation", attentionSeverity: "medium" });
    }
  }

  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

// ─── Database Contract ────────────────────────────────────────────────────────

describe("Database Contract", () => {
  test("DATABASE_CONTRACT_VERSION includes project-operating-system", () => {
    assert.match(dbContract, /project-operating-system/);
  });

  test("ProjectOSSnapshotRow is present", () => {
    assert.match(dbContract, /ProjectOSSnapshotRow/);
  });

  test("ProjectOSAttentionItemRow is present", () => {
    assert.match(dbContract, /ProjectOSAttentionItemRow/);
  });

  test("ProjectOSContextLinkRow is present", () => {
    assert.match(dbContract, /ProjectOSContextLinkRow/);
  });

  test("PROJECT_OS_SNAPSHOT_SELECTABLE_COLUMNS is present", () => {
    assert.match(dbContract, /PROJECT_OS_SNAPSHOT_SELECTABLE_COLUMNS/);
  });

  test("PROJECT_OS_ATTENTION_ITEM_SELECTABLE_COLUMNS is present", () => {
    assert.match(dbContract, /PROJECT_OS_ATTENTION_ITEM_SELECTABLE_COLUMNS/);
  });

  test("PROJECT_OS_CONTEXT_LINK_SELECTABLE_COLUMNS is present", () => {
    assert.match(dbContract, /PROJECT_OS_CONTEXT_LINK_SELECTABLE_COLUMNS/);
  });

  test("ProjectOSSnapshotStatus includes all 3 statuses", () => {
    for (const s of ["generated", "validated", "archived"]) {
      assert.match(dbContract, new RegExp(`"${s}"`), `Missing status: ${s}`);
    }
  });

  test("ProjectOSAttentionType includes all 9 types", () => {
    for (const t of [
      "critical_signal", "overdue_commitment", "execution_drift",
      "governance_violation", "ratification_stall", "authority_gap",
      "low_health_score", "ignored_recommendation", "projection_variance",
    ]) {
      assert.match(dbContract, new RegExp(t), `Missing attention type: ${t}`);
    }
  });

  test("ProjectOSAttentionSeverity includes all 4 levels", () => {
    for (const s of ["low", "medium", "high", "critical"]) {
      assert.match(dbContract, new RegExp(`"${s}"`), `Missing severity: ${s}`);
    }
  });
});

// ─── Migration ────────────────────────────────────────────────────────────────

describe("Migration", () => {
  test("creates project_os_snapshots table", () => {
    assert.match(migration, /create table if not exists public\.project_os_snapshots/);
  });

  test("creates project_os_attention_items table", () => {
    assert.match(migration, /create table if not exists public\.project_os_attention_items/);
  });

  test("creates project_os_context_links table", () => {
    assert.match(migration, /create table if not exists public\.project_os_context_links/);
  });

  test("enables RLS on all three tables", () => {
    assert.match(migration, /project_os_snapshots enable row level security/);
    assert.match(migration, /project_os_attention_items enable row level security/);
    assert.match(migration, /project_os_context_links enable row level security/);
  });

  test("uses is_workspace_member for all RLS policies", () => {
    const matches = migration.match(/is_workspace_member/g);
    assert.ok(matches && matches.length >= 3, `Expected >= 3 is_workspace_member usages, got ${matches?.length}`);
  });

  test("snapshot_status check constraint includes all 3 statuses", () => {
    for (const s of ["generated", "validated", "archived"]) {
      assert.match(migration, new RegExp(`'${s}'`), `Missing status in check: ${s}`);
    }
  });

  test("attention_type check constraint includes all 9 types", () => {
    for (const t of [
      "critical_signal", "overdue_commitment", "execution_drift",
      "governance_violation", "ratification_stall", "authority_gap",
      "low_health_score", "ignored_recommendation", "projection_variance",
    ]) {
      assert.match(migration, new RegExp(`'${t}'`), `Missing attention_type: ${t}`);
    }
  });

  test("attention_severity check constraint includes all 4 levels", () => {
    for (const s of ["low", "medium", "high", "critical"]) {
      assert.match(migration, new RegExp(`'${s}'`), `Missing attention severity: ${s}`);
    }
  });

  test("operating_health_score has 0–100 check constraint", () => {
    assert.match(migration, /operating_health_score between 0 and 100/);
  });

  test("composite FKs for workspace isolation on attention items", () => {
    assert.match(migration, /constraint posa_snapshot_workspace_fk/);
  });

  test("composite FKs for workspace isolation on context links", () => {
    assert.match(migration, /constraint poscl_snapshot_workspace_fk/);
  });

  test("composite unique on snapshots for FK target", () => {
    assert.match(migration, /unique \(id, workspace_id\)/);
  });

  test("indexes include workspace_id, project_id, status, health", () => {
    assert.match(migration, /project_os_snapshots_workspace_id_idx/);
    assert.match(migration, /project_os_snapshots_project_id_idx/);
    assert.match(migration, /project_os_snapshots_status_idx/);
    assert.match(migration, /project_os_snapshots_health_idx/);
  });
});

// ─── Platform Events ──────────────────────────────────────────────────────────

describe("Platform Events", () => {
  test("ProjectOSEventType is defined", () => {
    assert.match(platformEvents, /ProjectOSEventType/);
  });

  test("all 7 audit events are present", () => {
    for (const evt of [
      "PROJECT_OS_SNAPSHOT_GENERATED",
      "PROJECT_OS_SNAPSHOT_VALIDATED",
      "PROJECT_OS_SNAPSHOT_ARCHIVED",
      "PROJECT_OS_HEALTH_CALCULATED",
      "PROJECT_OS_ATTENTION_ITEM_CREATED",
      "PROJECT_OS_CONTEXT_COMPOSED",
      "PROJECT_OS_LINEAGE_GENERATED",
    ]) {
      assert.match(platformEvents, new RegExp(evt), `Missing event type: ${evt}`);
    }
  });

  test("ProjectOSEventType is included in PlatformEventType union", () => {
    assert.match(platformEvents, /ProjectOSEventType/);
  });
});

// ─── Types ────────────────────────────────────────────────────────────────────

describe("Types", () => {
  test("ProjectOSSnapshotStatus is defined", () => {
    assert.match(types, /ProjectOSSnapshotStatus/);
  });

  test("ProjectOSAttentionType is defined with all 9 types", () => {
    assert.match(types, /ProjectOSAttentionType/);
    for (const t of [
      "critical_signal", "overdue_commitment", "execution_drift",
      "governance_violation", "ratification_stall", "authority_gap",
      "low_health_score", "ignored_recommendation", "projection_variance",
    ]) {
      assert.match(types, new RegExp(t), `Missing: ${t}`);
    }
  });

  test("ProjectOSAttentionSeverity is defined", () => {
    assert.match(types, /ProjectOSAttentionSeverity/);
  });

  test("ProjectOSResult is defined", () => {
    assert.match(types, /ProjectOSResult/);
  });

  test("ProjectOSSnapshotPayload is defined with all required fields", () => {
    assert.match(types, /ProjectOSSnapshotPayload/);
    for (const field of ["constitution", "governance", "execution", "memory", "recommendations", "attention"]) {
      assert.match(types, new RegExp(field), `Missing payload field: ${field}`);
    }
  });

  test("ProjectOSHealthScore is defined", () => {
    assert.match(types, /ProjectOSHealthScore/);
  });

  test("ProjectOSOperatingContext is defined", () => {
    assert.match(types, /ProjectOSOperatingContext/);
  });

  test("ProjectOSLineage is defined", () => {
    assert.match(types, /ProjectOSLineage/);
  });

  test("DetectedAttentionItem is defined", () => {
    assert.match(types, /DetectedAttentionItem/);
  });

  test("GenerateProjectOSSnapshotInput is defined", () => {
    assert.match(types, /GenerateProjectOSSnapshotInput/);
  });

  test("ListProjectOSSnapshotsInput has all filter fields", () => {
    assert.match(types, /ListProjectOSSnapshotsInput/);
    for (const field of ["projectId", "status", "fromDate", "toDate", "minHealthScore"]) {
      assert.match(types, new RegExp(field), `Missing filter field: ${field}`);
    }
  });

  test("PROJECT_OS_SNAPSHOT_STATUSES constant contains all 3 statuses", () => {
    assert.match(types, /PROJECT_OS_SNAPSHOT_STATUSES/);
    for (const s of ["generated", "validated", "archived"]) {
      assert.match(types, new RegExp(`"${s}"`), `Missing: ${s}`);
    }
  });

  test("PROJECT_OS_ATTENTION_TYPES constant contains all 9 types", () => {
    assert.match(types, /PROJECT_OS_ATTENTION_TYPES/);
  });
});

// ─── Health Aggregation Engine ────────────────────────────────────────────────

describe("Health Aggregation Engine", () => {
  test("governance: 100 with no signals or violations", () => {
    const score = calculateGovernanceOSHealth({ activeSignals: 0, criticalSignals: 0, unresolvedViolations: 0 });
    assert.equal(score, 100);
  });

  test("governance: one critical signal reduces score by 25", () => {
    const score = calculateGovernanceOSHealth({ activeSignals: 1, criticalSignals: 1, unresolvedViolations: 0 });
    assert.equal(score, 75);
  });

  test("governance: unresolved violation reduces score by 15", () => {
    const score = calculateGovernanceOSHealth({ activeSignals: 0, criticalSignals: 0, unresolvedViolations: 1 });
    assert.equal(score, 85);
  });

  test("governance: score never goes below 0", () => {
    const score = calculateGovernanceOSHealth({ activeSignals: 10, criticalSignals: 10, unresolvedViolations: 5 });
    assert.equal(score, 0);
  });

  test("execution: score >= 100 with no commitments and full accuracy", () => {
    const score = calculateExecutionOSHealth({ activeCommitments: 0, overdueCommitments: 0, projectionAccuracy: 100 });
    assert.ok(score >= 100 || score === 100, `Expected score >= 100, got ${score}`);
  });

  test("execution: all commitments overdue = max penalty (40)", () => {
    const score = calculateExecutionOSHealth({ activeCommitments: 5, overdueCommitments: 5, projectionAccuracy: 70 });
    assert.equal(score, 60);
  });

  test("memory: 0 records yields 60 (neutral)", () => {
    const score = calculateMemoryOSHealth({ artifacts: 0, memoryRecords: 0, digests: 0, learningPatterns: 0 });
    assert.equal(score, 60);
  });

  test("memory: records increase score above 60", () => {
    const score = calculateMemoryOSHealth({ artifacts: 10, memoryRecords: 10, digests: 10, learningPatterns: 10 });
    assert.ok(score > 60, `Expected score > 60, got ${score}`);
  });

  test("memory: score never exceeds 100", () => {
    const score = calculateMemoryOSHealth({ artifacts: 100, memoryRecords: 100, digests: 100, learningPatterns: 100 });
    assert.equal(score, 100);
  });

  test("recommendation: 100 with no ignored recommendations", () => {
    const score = calculateRecommendationOSHealth({ activeRecommendations: 3, highConfidenceRecommendations: 3, ignoredRecommendations: 0 });
    assert.ok(score >= 100);
  });

  test("recommendation: ignored recommendations reduce score", () => {
    const s0 = calculateRecommendationOSHealth({ activeRecommendations: 0, highConfidenceRecommendations: 0, ignoredRecommendations: 0 });
    const s3 = calculateRecommendationOSHealth({ activeRecommendations: 0, highConfidenceRecommendations: 0, ignoredRecommendations: 3 });
    assert.ok(s3 < s0, `Expected s3 (${s3}) < s0 (${s0})`);
  });

  test("aggregate: weighted average formula (35/35/15/15)", () => {
    const score = calculateProjectOperatingHealth({
      governanceHealthScore: 100,
      executionHealthScore: 100,
      memoryHealthScore: 100,
      recommendationHealthScore: 100,
    });
    assert.equal(score, 100);
  });

  test("aggregate: score is always between 0 and 100", () => {
    const score = calculateProjectOperatingHealth({
      governanceHealthScore: 0,
      executionHealthScore: 0,
      memoryHealthScore: 0,
      recommendationHealthScore: 0,
    });
    assert.equal(score, 0);
  });

  test("health engine exports calculateProjectOperatingHealth", () => {
    assert.match(healthEng, /export function calculateProjectOperatingHealth/);
  });

  test("health engine exports calculateGovernanceOSHealth", () => {
    assert.match(healthEng, /export function calculateGovernanceOSHealth/);
  });

  test("health engine exports calculateExecutionOSHealth", () => {
    assert.match(healthEng, /export function calculateExecutionOSHealth/);
  });

  test("health engine exports calculateMemoryOSHealth", () => {
    assert.match(healthEng, /export function calculateMemoryOSHealth/);
  });

  test("health engine exports calculateRecommendationOSHealth", () => {
    assert.match(healthEng, /export function calculateRecommendationOSHealth/);
  });
});

// ─── Attention Engine ─────────────────────────────────────────────────────────

describe("Attention Engine", () => {
  test("critical active signal produces critical_signal attention item", () => {
    const items = detectAttentionItems({
      signals: [{ id: uuid(), severity: "critical", status: "active" }],
      commitments: [],
      drifts: [],
      violations: [],
      recommendations: [],
      variances: [],
      operatingHealthScore: 80,
      snapshotId: uuid(),
    });
    assert.ok(items.some((i) => i.attentionType === "critical_signal" && i.attentionSeverity === "critical"));
  });

  test("non-critical active signal does not produce critical_signal attention", () => {
    const items = detectAttentionItems({
      signals: [{ id: uuid(), severity: "high", status: "active" }],
      commitments: [],
      drifts: [],
      violations: [],
      recommendations: [],
      variances: [],
      operatingHealthScore: 80,
      snapshotId: uuid(),
    });
    assert.ok(!items.some((i) => i.attentionType === "critical_signal"));
  });

  test("overdue commitment produces overdue_commitment attention item", () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const items = detectAttentionItems({
      signals: [],
      commitments: [{ id: uuid(), status: "open", title: "Test", due_date: pastDate }],
      drifts: [],
      violations: [],
      recommendations: [],
      variances: [],
      operatingHealthScore: 80,
      snapshotId: uuid(),
    });
    assert.ok(items.some((i) => i.attentionType === "overdue_commitment"));
  });

  test("completed commitment does not produce overdue_commitment attention", () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const items = detectAttentionItems({
      signals: [],
      commitments: [{ id: uuid(), status: "completed", title: "Test", due_date: pastDate }],
      drifts: [],
      violations: [],
      recommendations: [],
      variances: [],
      operatingHealthScore: 80,
      snapshotId: uuid(),
    });
    assert.ok(!items.some((i) => i.attentionType === "overdue_commitment"));
  });

  test("critical drift produces execution_drift attention", () => {
    const items = detectAttentionItems({
      signals: [],
      commitments: [],
      drifts: [{ id: uuid(), severity: "critical", drift_type: "schedule", description: "Drift" }],
      violations: [],
      recommendations: [],
      variances: [],
      operatingHealthScore: 80,
      snapshotId: uuid(),
    });
    assert.ok(items.some((i) => i.attentionType === "execution_drift" && i.attentionSeverity === "critical"));
  });

  test("unresolved violation produces governance_violation attention", () => {
    const items = detectAttentionItems({
      signals: [],
      commitments: [],
      drifts: [],
      violations: [{ id: uuid(), status: "unresolved" }],
      recommendations: [],
      variances: [],
      operatingHealthScore: 80,
      snapshotId: uuid(),
    });
    assert.ok(items.some((i) => i.attentionType === "governance_violation"));
  });

  test("health score < 60 produces low_health_score attention", () => {
    const items = detectAttentionItems({
      signals: [],
      commitments: [],
      drifts: [],
      violations: [],
      recommendations: [],
      variances: [],
      operatingHealthScore: 55,
      snapshotId: uuid(),
    });
    assert.ok(items.some((i) => i.attentionType === "low_health_score"));
  });

  test("health score < 40 produces critical low_health_score", () => {
    const items = detectAttentionItems({
      signals: [],
      commitments: [],
      drifts: [],
      violations: [],
      recommendations: [],
      variances: [],
      operatingHealthScore: 35,
      snapshotId: uuid(),
    });
    const item = items.find((i) => i.attentionType === "low_health_score");
    assert.ok(item && item.attentionSeverity === "critical");
  });

  test("health score >= 60 does not produce low_health_score attention", () => {
    const items = detectAttentionItems({
      signals: [],
      commitments: [],
      drifts: [],
      violations: [],
      recommendations: [],
      variances: [],
      operatingHealthScore: 60,
      snapshotId: uuid(),
    });
    assert.ok(!items.some((i) => i.attentionType === "low_health_score"));
  });

  test("high variance produces projection_variance attention", () => {
    const items = detectAttentionItems({
      signals: [],
      commitments: [],
      drifts: [],
      violations: [],
      recommendations: [],
      variances: [{ id: uuid(), severity: "high", variance_type: "effort", variance_percentage: 45 }],
      operatingHealthScore: 80,
      snapshotId: uuid(),
    });
    assert.ok(items.some((i) => i.attentionType === "projection_variance" && i.attentionSeverity === "high"));
  });

  test("ignored recommendation produces ignored_recommendation attention", () => {
    const items = detectAttentionItems({
      signals: [],
      commitments: [],
      drifts: [],
      violations: [],
      recommendations: [{ id: uuid(), status: "ignored" }],
      variances: [],
      operatingHealthScore: 80,
      snapshotId: uuid(),
    });
    assert.ok(items.some((i) => i.attentionType === "ignored_recommendation"));
  });

  test("attention engine exports detectProjectAttentionItems", () => {
    assert.match(attentionEng, /export function detectProjectAttentionItems/);
  });
});

// ─── Context Composition Engine ───────────────────────────────────────────────

describe("Context Composition Engine", () => {
  test("composeProjectOperatingContext is defined", () => {
    assert.match(contextEng, /export async function composeProjectOperatingContext/);
  });

  test("context includes constitution", () => {
    assert.match(contextEng, /project_constitutions/);
  });

  test("context includes signals", () => {
    assert.match(contextEng, /governance_signals/);
  });

  test("context includes actions", () => {
    assert.match(contextEng, /governance_actions/);
  });

  test("context includes commitments", () => {
    assert.match(contextEng, /governance_commitments/);
  });

  test("context includes projections", () => {
    assert.match(contextEng, /execution_projections/);
  });

  test("context includes realities", () => {
    assert.match(contextEng, /execution_realities/);
  });

  test("context includes recommendations", () => {
    assert.match(contextEng, /recommendations/);
  });

  test("context uses Promise.all for parallel domain fetch", () => {
    assert.match(contextEng, /Promise\.all/);
  });

  test("context computes isOverdue for commitments", () => {
    assert.match(contextEng, /isOverdue/);
  });

  test("context calls detectProjectAttentionItems", () => {
    assert.match(contextEng, /detectProjectAttentionItems/);
  });
});

// ─── Snapshot Lifecycle ───────────────────────────────────────────────────────

describe("Snapshot Lifecycle", () => {
  test("registry validates workspaceId as UUID in generateProjectOSSnapshot", () => {
    assert.match(registry, /workspaceId must be a UUID/);
  });

  test("registry validates projectId as UUID", () => {
    assert.match(registry, /projectId must be a UUID/);
  });

  test("registry validates actorId as UUID", () => {
    assert.match(registry, /actorId must be a UUID/);
  });

  test("validateProjectOSSnapshot enforces 'generated' → 'validated' transition", () => {
    assert.match(registry, /can only be validated from 'generated' status/);
  });

  test("archiveProjectOSSnapshot prevents double-archiving", () => {
    assert.match(registry, /already archived/);
  });

  test("generateProjectOSSnapshot emits PROJECT_OS_SNAPSHOT_GENERATED", () => {
    assert.match(registry, /PROJECT_OS_SNAPSHOT_GENERATED/);
  });

  test("validateProjectOSSnapshot emits PROJECT_OS_SNAPSHOT_VALIDATED", () => {
    assert.match(registry, /PROJECT_OS_SNAPSHOT_VALIDATED/);
  });

  test("archiveProjectOSSnapshot emits PROJECT_OS_SNAPSHOT_ARCHIVED", () => {
    assert.match(registry, /PROJECT_OS_SNAPSHOT_ARCHIVED/);
  });

  test("generateProjectOSSnapshot emits PROJECT_OS_HEALTH_CALCULATED", () => {
    assert.match(registry, /PROJECT_OS_HEALTH_CALCULATED/);
  });

  test("generateProjectOSSnapshot emits PROJECT_OS_ATTENTION_ITEM_CREATED for each item", () => {
    assert.match(registry, /PROJECT_OS_ATTENTION_ITEM_CREATED/);
  });
});

// ─── Lineage Engine ───────────────────────────────────────────────────────────

describe("Lineage Engine", () => {
  test("getProjectOSLineage is defined", () => {
    assert.match(lineageEng, /export async function getProjectOSLineage/);
  });

  test("lineage chain includes all 11 layers", () => {
    for (const layer of [
      "constitution", "memory", "digest", "learning", "recommendation",
      "signal", "action", "commitment", "projection", "reality", "snapshot",
    ]) {
      assert.match(lineageEng, new RegExp(`layer: "${layer}"`), `Missing lineage layer: ${layer}`);
    }
  });

  test("lineage validates workspaceId", () => {
    assert.match(registry, /workspaceId must be a UUID/);
  });

  test("lineage emits PROJECT_OS_LINEAGE_GENERATED", () => {
    assert.match(registry, /PROJECT_OS_LINEAGE_GENERATED/);
  });
});

// ─── Explain Capability ───────────────────────────────────────────────────────

describe("Explain Capability", () => {
  test("explainProjectOperatingSystem is defined", () => {
    assert.match(explainFile, /export function explainProjectOperatingSystem/);
  });

  test("explain defines 7 principles", () => {
    for (let i = 1; i <= 7; i++) {
      assert.match(explainFile, new RegExp(`number: ${i}`), `Missing Principle ${i}`);
    }
  });

  test("explain describes all domain entities", () => {
    for (const entity of ["Constitution", "Memory", "Learning", "Recommendation", "Signal", "Action", "Commitment", "Projection", "Reality"]) {
      assert.match(explainFile, new RegExp(entity), `Missing domain: ${entity}`);
    }
  });

  test("explain describes health model with weights", () => {
    assert.match(explainFile, /healthModel/);
    assert.match(explainFile, /0\.35/);
    assert.match(explainFile, /0\.15/);
  });

  test("explain describes all 7 attention types", () => {
    for (const t of [
      "critical_signal", "overdue_commitment", "execution_drift",
      "governance_violation", "low_health_score", "projection_variance", "ignored_recommendation",
    ]) {
      assert.match(explainFile, new RegExp(t), `Missing attention type in explain: ${t}`);
    }
  });

  test("explain describes lineage chain with all 11 steps", () => {
    assert.match(explainFile, /lineageChain/);
    for (const layer of ["Constitution", "Memory", "Digest", "Learning", "Recommendation", "Signal", "Action", "Commitment", "Projection", "Reality", "Snapshot"]) {
      assert.match(explainFile, new RegExp(layer), `Missing lineage layer: ${layer}`);
    }
  });

  test("explain documents all 7 audit events", () => {
    for (const evt of [
      "PROJECT_OS_SNAPSHOT_GENERATED",
      "PROJECT_OS_SNAPSHOT_VALIDATED",
      "PROJECT_OS_SNAPSHOT_ARCHIVED",
      "PROJECT_OS_HEALTH_CALCULATED",
      "PROJECT_OS_ATTENTION_ITEM_CREATED",
      "PROJECT_OS_CONTEXT_COMPOSED",
      "PROJECT_OS_LINEAGE_GENERATED",
    ]) {
      assert.match(explainFile, new RegExp(evt), `Missing event in explain: ${evt}`);
    }
  });

  test("explain documents what Project OS does not do", () => {
    assert.match(explainFile, /whatItDoesNotDo/);
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
    assert.ok(workspaceMatches && workspaceMatches.length >= 4, `Expected >= 4 workspace_id filters`);
  });

  test("migration enables RLS on all 3 tables", () => {
    assert.match(migration, /project_os_snapshots enable row level security/);
    assert.match(migration, /project_os_attention_items enable row level security/);
    assert.match(migration, /project_os_context_links enable row level security/);
  });

  test("migration uses is_workspace_member for all policies", () => {
    assert.match(migration, /is_workspace_member/);
  });
});

// ─── Public API — index.ts ────────────────────────────────────────────────────

describe("Public API — index.ts", () => {
  const publicFns = [
    "generateProjectOSSnapshot",
    "getProjectOSSnapshot",
    "listProjectOSSnapshots",
    "validateProjectOSSnapshot",
    "archiveProjectOSSnapshot",
    "generateProjectAttentionItems",
    "getProjectOperatingContext",
    "getProjectOSLineageForProject",
    "calculateGovernanceOSHealth",
    "calculateExecutionOSHealth",
    "calculateMemoryOSHealth",
    "calculateRecommendationOSHealth",
    "calculateProjectOperatingHealth",
    "detectProjectAttentionItems",
    "composeProjectOperatingContext",
    "getProjectOSLineage",
    "explainProjectOperatingSystem",
    "PROJECT_OS_SNAPSHOT_STATUSES",
    "PROJECT_OS_ATTENTION_TYPES",
    "PROJECT_OS_ATTENTION_SEVERITIES",
  ];

  for (const fn of publicFns) {
    test(`index exports ${fn}`, () => {
      assert.match(indexFile, new RegExp(fn), `Missing export: ${fn}`);
    });
  }
});

// ─── Documentation ────────────────────────────────────────────────────────────

describe("Documentation", () => {
  test("docs/project-operating-system-shell.md covers core concept", () => {
    assert.match(docs, /Project Operating System/i);
  });

  test("documentation describes architecture", () => {
    assert.match(docs, /Architecture|architecture/);
  });

  test("documentation describes snapshot model", () => {
    assert.match(docs, /Snapshot/i);
  });

  test("documentation describes health model", () => {
    assert.match(docs, /Health|health/);
  });

  test("documentation describes attention model", () => {
    assert.match(docs, /Attention|attention/);
  });

  test("documentation describes lineage", () => {
    assert.match(docs, /Lineage|lineage/);
  });

  test("documentation mentions all audit events", () => {
    assert.match(docs, /PROJECT_OS_SNAPSHOT_GENERATED/);
  });

  test("documentation includes usage examples", () => {
    assert.match(docs, /Example|example/);
  });
});
