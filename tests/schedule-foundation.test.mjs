import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260605090000_milestones_schedule_foundation.sql", "utf8");
const contract = fs.readFileSync("src/lib/db/database-contract.ts", "utf8");
const checkScript = fs.readFileSync("scripts/check-db-schema-contract.mjs", "utf8");
const milestonesTs = fs.readFileSync("src/lib/schedule/milestones.ts", "utf8");
const taskScheduleTs = fs.readFileSync("src/lib/schedule/task-schedule.ts", "utf8");
const healthTs = fs.readFileSync("src/lib/schedule/health.ts", "utf8");
const repositoryTs = fs.readFileSync("src/lib/schedule/repository.ts", "utf8");
const scheduleRoute = fs.readFileSync("src/app/api/schedule/route.ts", "utf8");
const milestonesRoute = fs.readFileSync("src/app/api/schedule/milestones/route.ts", "utf8");
const milestonesUpdateRoute = fs.readFileSync("src/app/api/schedule/milestones/update/route.ts", "utf8");
const tasksUpdateRoute = fs.readFileSync("src/app/api/schedule/tasks/update/route.ts", "utf8");
const shell = fs.readFileSync("src/components/pmfreak/operational-shell.tsx", "utf8");

// ── Migration: project_milestones ─────────────────────────────────────────────

test("migration creates project_milestones table", () => {
  assert.match(migration, /create table if not exists public\.project_milestones/);
});

test("migration has all required columns", () => {
  for (const col of [
    "id", "workspace_id", "project_id", "title", "description",
    "milestone_type", "status", "target_date", "baseline_date",
    "forecast_date", "completed_at", "confidence_score",
    "source_type", "source_payload", "created_by", "created_at", "updated_at",
  ]) {
    assert.match(migration, new RegExp(`\\b${col}\\b`), `column ${col} missing`);
  }
});

test("migration enforces milestone_type constraint", () => {
  assert.match(migration, /milestone_type.*check/s);
  for (const t of ["kickoff", "discovery", "design", "approval", "delivery", "deployment", "training", "acceptance", "go_live", "handover", "other"]) {
    assert.match(migration, new RegExp(`'${t}'`), `type '${t}' missing`);
  }
});

test("migration enforces milestone status constraint", () => {
  assert.match(migration, /project_milestones_status_check/);
  for (const s of ["planned", "at_risk", "blocked", "completed", "cancelled"]) {
    assert.match(migration, new RegExp(`'${s}'`), `status '${s}' missing`);
  }
});

test("migration has required indexes on project_milestones", () => {
  assert.match(migration, /project_milestones_workspace_idx/);
  assert.match(migration, /project_milestones_project_idx/);
  assert.match(migration, /project_milestones_status_idx/);
  assert.match(migration, /project_milestones_target_date_idx/);
  assert.match(migration, /project_milestones_type_idx/);
});

test("migration enables RLS on project_milestones", () => {
  assert.match(migration, /alter table public\.project_milestones enable row level security/);
  assert.match(migration, /is_workspace_member\(workspace_id\)/);
});

test("migration has select, insert, update, delete policies on project_milestones", () => {
  assert.match(migration, /workspace members can read project_milestones/);
  assert.match(migration, /workspace members can insert project_milestones/);
  assert.match(migration, /workspace members can update project_milestones/);
  assert.match(migration, /workspace members can delete project_milestones/);
});

test("migration has updated_at trigger for project_milestones", () => {
  assert.match(migration, /set_updated_at_project_milestones/);
  assert.match(migration, /before update on public\.project_milestones/);
});

// ── Migration: execution_tasks schedule fields ────────────────────────────────

test("migration adds schedule columns to execution_tasks", () => {
  assert.match(migration, /alter table public\.execution_tasks/);
  for (const col of [
    "planned_start_date", "planned_finish_date",
    "baseline_start_date", "baseline_finish_date",
    "forecast_start_date", "forecast_finish_date",
    "milestone_id", "schedule_status", "schedule_confidence",
  ]) {
    assert.match(migration, new RegExp(`add column if not exists ${col}`), `alter column ${col} missing`);
  }
});

test("migration enforces schedule_status constraint on execution_tasks", () => {
  assert.match(migration, /execution_tasks_schedule_status_check/);
  for (const s of ["unscheduled", "scheduled", "at_risk", "delayed", "completed", "cancelled"]) {
    assert.match(migration, new RegExp(`'${s}'`), `schedule_status '${s}' missing`);
  }
});

test("migration has schedule field indexes on execution_tasks", () => {
  assert.match(migration, /execution_tasks_planned_start_idx/);
  assert.match(migration, /execution_tasks_planned_finish_idx/);
  assert.match(migration, /execution_tasks_milestone_idx/);
  assert.match(migration, /execution_tasks_schedule_status_idx/);
});

// ── Database Contract ─────────────────────────────────────────────────────────

test("contract declares ProjectMilestoneRow", () => {
  assert.match(contract, /ProjectMilestoneRow/);
});

test("contract declares PROJECT_MILESTONE_SELECTABLE_COLUMNS", () => {
  assert.match(contract, /PROJECT_MILESTONE_SELECTABLE_COLUMNS/);
});

test("contract declares ProjectMilestoneType", () => {
  assert.match(contract, /ProjectMilestoneType/);
  for (const t of ["kickoff", "discovery", "delivery", "go_live", "training", "acceptance", "deployment", "handover"]) {
    assert.match(contract, new RegExp(`"${t}"`), `type '${t}' missing`);
  }
});

test("contract declares ProjectMilestoneStatus", () => {
  assert.match(contract, /ProjectMilestoneStatus/);
  for (const s of ["planned", "at_risk", "blocked", "completed", "cancelled"]) {
    assert.match(contract, new RegExp(`"${s}"`), `status '${s}' missing`);
  }
});

test("contract declares TaskScheduleStatus", () => {
  assert.match(contract, /TaskScheduleStatus/);
  for (const s of ["unscheduled", "scheduled", "at_risk", "delayed"]) {
    assert.match(contract, new RegExp(`"${s}"`), `schedule_status '${s}' missing`);
  }
});

test("contract ExecutionTaskRow includes all schedule fields", () => {
  for (const col of [
    "planned_start_date", "planned_finish_date",
    "baseline_start_date", "baseline_finish_date",
    "forecast_start_date", "forecast_finish_date",
    "milestone_id", "schedule_status", "schedule_confidence",
  ]) {
    assert.match(contract, new RegExp(`${col}`), `field ${col} missing from ExecutionTaskRow`);
  }
});

test("check script registers project_milestones", () => {
  assert.match(checkScript, /project_milestones/);
  assert.match(checkScript, /PROJECT_MILESTONE_SELECTABLE_COLUMNS/);
});

// ── Milestone Engine ──────────────────────────────────────────────────────────

test("milestone engine exports createProjectMilestone", () => {
  assert.match(milestonesTs, /export async function createProjectMilestone/);
});

test("milestone engine exports updateProjectMilestone", () => {
  assert.match(milestonesTs, /export async function updateProjectMilestone/);
});

test("milestone engine exports completeProjectMilestone", () => {
  assert.match(milestonesTs, /export async function completeProjectMilestone/);
});

test("milestone engine exports cancelProjectMilestone", () => {
  assert.match(milestonesTs, /export async function cancelProjectMilestone/);
});

test("milestone engine exports listProjectMilestones", () => {
  assert.match(milestonesTs, /export async function listProjectMilestones/);
});

test("milestone engine validates title", () => {
  assert.match(milestonesTs, /title is required/);
});

test("milestone engine validates milestone_type", () => {
  assert.match(milestonesTs, /Invalid milestone_type/);
});

test("milestone engine validates target_date", () => {
  assert.match(milestonesTs, /targetDate is not a valid date/);
});

test("milestone engine sets completed_at on complete", () => {
  assert.match(milestonesTs, /completed_at/);
  assert.match(milestonesTs, /status.*completed/s);
});

test("milestone engine sets cancelled status without deleting", () => {
  assert.match(milestonesTs, /status.*cancelled/s);
  assert.doesNotMatch(milestonesTs, /\.delete\(\)/);
});

test("milestone engine handles all failure classes", () => {
  for (const fc of ["unauthenticated", "unauthorized", "validation_failed", "not_found", "persistence_failed"]) {
    assert.match(milestonesTs, new RegExp(fc), `failureClass '${fc}' missing`);
  }
});

test("milestone engine returns ok:true with milestone on success", () => {
  assert.match(milestonesTs, /ok: true.*milestone|milestone.*ok: true/s);
});

// ── Task Schedule Engine ──────────────────────────────────────────────────────

test("task schedule engine exports updateExecutionTaskSchedule", () => {
  assert.match(taskScheduleTs, /export async function updateExecutionTaskSchedule/);
});

test("task schedule engine validates planned start <= finish", () => {
  assert.match(taskScheduleTs, /planned_start_date must be <= planned_finish_date/);
});

test("task schedule engine validates baseline start <= finish", () => {
  assert.match(taskScheduleTs, /baseline_start_date must be <= baseline_finish_date/);
});

test("task schedule engine validates forecast start <= finish", () => {
  assert.match(taskScheduleTs, /forecast_start_date must be <= forecast_finish_date/);
});

test("task schedule engine validates milestone belongs to same project", () => {
  assert.match(taskScheduleTs, /Milestone belongs to a different project/);
});

test("task schedule engine does not change lifecycle status", () => {
  assert.doesNotMatch(taskScheduleTs, /updates\.status\s*=/);
});

test("task schedule engine writes schedule_updated event", () => {
  assert.match(taskScheduleTs, /schedule_updated/);
});

test("task schedule engine writes milestone_linked event", () => {
  assert.match(taskScheduleTs, /milestone_linked/);
});

test("task schedule engine writes milestone_unlinked event", () => {
  assert.match(taskScheduleTs, /milestone_unlinked/);
});

// ── Schedule Health ───────────────────────────────────────────────────────────

test("health engine exports computeScheduleHealth", () => {
  assert.match(healthTs, /export function computeScheduleHealth/);
});

test("health engine counts scheduled vs unscheduled tasks", () => {
  assert.match(healthTs, /scheduledTasks/);
  assert.match(healthTs, /unscheduledTasks/);
});

test("health engine detects overdue tasks", () => {
  assert.match(healthTs, /overdueTasks/);
  assert.match(healthTs, /planned_finish_date.*now|now.*planned_finish_date/s);
});

test("health engine detects due soon tasks", () => {
  assert.match(healthTs, /dueSoonTasks/);
  assert.match(healthTs, /DUE_SOON_DAYS/);
});

test("health engine detects delayed tasks", () => {
  assert.match(healthTs, /delayedTasks/);
  assert.match(healthTs, /delayed/);
});

test("health engine detects at-risk tasks", () => {
  assert.match(healthTs, /atRiskTasks/);
  assert.match(healthTs, /at_risk/);
});

test("health engine detects at-risk milestones", () => {
  assert.match(healthTs, /atRiskMilestones/);
  assert.match(healthTs, /target_date/);
});

test("health engine returns scheduleConfidence", () => {
  assert.match(healthTs, /scheduleConfidence/);
});

test("health engine returns signals array", () => {
  assert.match(healthTs, /signals/);
});

// ── API Routes ────────────────────────────────────────────────────────────────

test("GET /api/schedule requires projectId", () => {
  assert.match(scheduleRoute, /projectId is required/);
});

test("GET /api/schedule returns milestones, tasks, dependencies, health", () => {
  assert.match(scheduleRoute, /milestones/);
  assert.match(scheduleRoute, /tasks/);
  assert.match(scheduleRoute, /dependencies/);
  assert.match(scheduleRoute, /health/);
});

test("GET /api/schedule returns 401 on unauthenticated", () => {
  assert.match(scheduleRoute, /status.*401|401.*status/s);
});

test("POST /api/schedule/milestones requires projectId", () => {
  assert.match(milestonesRoute, /projectId is required/);
});

test("POST /api/schedule/milestones requires title", () => {
  assert.match(milestonesRoute, /title is required/);
});

test("POST /api/schedule/milestones returns 201 on created", () => {
  assert.match(milestonesRoute, /status: 201/);
});

test("POST /api/schedule/milestones/update requires milestoneId", () => {
  assert.match(milestonesUpdateRoute, /milestoneId is required/);
});

test("POST /api/schedule/milestones/update handles complete/cancel shortcuts", () => {
  assert.match(milestonesUpdateRoute, /completeProjectMilestone/);
  assert.match(milestonesUpdateRoute, /cancelProjectMilestone/);
});

test("POST /api/schedule/tasks/update requires taskId", () => {
  assert.match(tasksUpdateRoute, /taskId is required/);
});

test("POST /api/schedule/tasks/update validates scheduleStatus", () => {
  assert.match(tasksUpdateRoute, /Invalid scheduleStatus/);
});

test("POST /api/schedule/tasks/update returns typed errors", () => {
  assert.match(tasksUpdateRoute, /ok: false/);
  assert.match(tasksUpdateRoute, /error/);
});

// ── UI: Operational Shell ─────────────────────────────────────────────────────

test("shell has Schedule Foundation Panel heading", () => {
  assert.match(shell, /Schedule Foundation/);
});

test("shell has schedule summary counters", () => {
  assert.match(shell, /scheduledTasks/);
  assert.match(shell, /unscheduledTasks/);
  assert.match(shell, /overdueTasks/);
  assert.match(shell, /dueSoonTasks/);
  assert.match(shell, /delayedTasks/);
  assert.match(shell, /atRiskTasks/);
  assert.match(shell, /scheduleConfidence/);
});

test("shell shows milestone list", () => {
  assert.match(shell, /scheduleMilestones/);
  assert.match(shell, /milestone_type/);
  assert.match(shell, /target_date/);
});

test("shell shows task schedule badges", () => {
  assert.match(shell, /schedule_status/);
  assert.match(shell, /Overdue/);
  assert.match(shell, /Due soon/);
  assert.match(shell, /Delayed/);
});

test("shell has Create Milestone control", () => {
  assert.match(shell, /\+ Milestone|Create.*Milestone|Milestone.*Create/s);
});

test("shell has Mark milestone complete control", () => {
  assert.match(shell, /handleMilestoneAction.*completed|completed.*handleMilestoneAction/s);
});

test("shell has Mark milestone at risk control", () => {
  assert.match(shell, /At Risk/);
});

test("shell loads schedule from /api/schedule", () => {
  assert.match(shell, /\/api\/schedule/);
});

test("shell does not mention Gantt (H9 adds Critical Path panel)", () => {
  assert.doesNotMatch(shell, /[Gg]antt/);
});

// ── Schedule Health: Hardening (H8.5) ─────────────────────────────────────────

// A. Proposed dependencies must not appear in the blocker filter
test("health engine only uses active dependencies as blockers (not proposed)", () => {
  // The filter must use d.status === "active" exclusively — proposed is intentionally excluded.
  assert.match(healthTs, /\.filter\(d => d\.status === "active"\)/);
  assert.doesNotMatch(healthTs, /d\.status === "proposed"/);
});

// B. Active dependency blocker path still present
test("health engine still uses blockedTaskIds to compute at-risk tasks", () => {
  assert.match(healthTs, /blockedTaskIds/);
  assert.match(healthTs, /blockedTaskIds\.has\(t\.id\)/);
});

// C. Double counting prevention — problem tasks stored in ID sets before counting
test("health engine tracks delayed tasks as a Set of IDs (delayedTaskIds)", () => {
  assert.match(healthTs, /delayedTaskIds/);
  assert.match(healthTs, /new Set/);
});

test("health engine tracks at-risk tasks as a Set of IDs (atRiskTaskIds)", () => {
  assert.match(healthTs, /atRiskTaskIds/);
});

test("health engine builds uniqueProblemTaskIds as union of problem sets", () => {
  assert.match(healthTs, /uniqueProblemTaskIds/);
  // Must spread multiple sets into the union
  assert.match(healthTs, /\.\.\.(delayedTaskIds|atRiskTaskIds|overdueTaskIds)/);
});

test("health engine passes uniqueProblemTaskCount to computeConfidence", () => {
  assert.match(healthTs, /uniqueProblemTaskCount/);
});

// D. Confidence formula is explicit and weighted
test("confidence formula uses 45-point task completeness component", () => {
  assert.match(healthTs, /45 \*/);
});

test("confidence formula uses 25-point milestone completeness component", () => {
  assert.match(healthTs, /25 \*/);
});

test("confidence formula uses 30-point execution health component", () => {
  assert.match(healthTs, /30 \*/);
});

test("confidence formula references uniqueProblemRate", () => {
  assert.match(healthTs, /uniqueProblemRate/);
});

test("confidence result is clamped 0-100 and rounded", () => {
  assert.match(healthTs, /Math\.round/);
  assert.match(healthTs, /Math\.max\(0/);
  assert.match(healthTs, /Math\.min\(100/);
});
