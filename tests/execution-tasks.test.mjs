import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260605070000_execution_tasks.sql", "utf8");
const converter = fs.readFileSync("src/lib/execution-tasks/convert-task-draft.ts", "utf8");
const lifecycle = fs.readFileSync("src/lib/execution-tasks/lifecycle.ts", "utf8");
const indexFile = fs.readFileSync("src/lib/execution-tasks/index.ts", "utf8");
const convertRoute = fs.readFileSync("src/app/api/execution-tasks/convert/route.ts", "utf8");
const listRoute = fs.readFileSync("src/app/api/execution-tasks/route.ts", "utf8");
const updateRoute = fs.readFileSync("src/app/api/execution-tasks/update/route.ts", "utf8");
const activityRoute = fs.readFileSync("src/app/api/execution-tasks/activity/route.ts", "utf8");
const shell = fs.readFileSync("src/components/pmfreak/operational-shell.tsx", "utf8");
const contract = fs.readFileSync("src/lib/db/database-contract.ts", "utf8");

// ── Migration: execution_tasks ────────────────────────────────────────────────

test("execution_tasks migration creates table", () => {
  assert.match(migration, /create table if not exists public\.execution_tasks/);
});

test("execution_tasks migration has all required columns", () => {
  for (const col of [
    "id", "workspace_id", "project_id", "task_draft_id", "recommended_action_id",
    "raid_item_id", "title", "description", "status", "priority",
    "owner_user_id", "owner_name", "start_date", "due_date", "completed_at",
    "progress_percent", "acceptance_criteria", "checklist", "confidence_score",
    "source_payload", "created_by", "created_at", "updated_at",
  ]) {
    assert.match(migration, new RegExp(`\\b${col}\\b`), `column ${col} missing from execution_tasks`);
  }
});

test("execution_tasks migration enforces status constraint", () => {
  assert.match(migration, /status in/);
  for (const s of ["not_started", "in_progress", "blocked", "completed", "cancelled"]) {
    assert.match(migration, new RegExp(`'${s}'`), `status '${s}' missing`);
  }
});

test("execution_tasks migration enforces priority constraint", () => {
  assert.match(migration, /priority in/);
  for (const p of ["low", "medium", "high", "critical"]) {
    assert.match(migration, new RegExp(`'${p}'`), `priority '${p}' missing`);
  }
});

test("execution_tasks migration enforces progress_percent range", () => {
  assert.match(migration, /progress_percent >= 0/);
  assert.match(migration, /progress_percent <= 100/);
});

test("execution_tasks migration has unique index on task_draft_id", () => {
  assert.match(migration, /execution_tasks_draft_uidx/);
  assert.match(migration, /task_draft_id/);
});

test("execution_tasks migration has required indexes", () => {
  assert.match(migration, /execution_tasks_workspace_idx/);
  assert.match(migration, /execution_tasks_project_idx/);
  assert.match(migration, /execution_tasks_status_idx/);
  assert.match(migration, /execution_tasks_priority_idx/);
  assert.match(migration, /execution_tasks_due_date_idx/);
});

test("execution_tasks migration enables RLS", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /is_workspace_member\(workspace_id\)/);
});

test("execution_tasks migration has select, insert, and update policies", () => {
  assert.match(migration, /workspace members can read execution_tasks/);
  assert.match(migration, /workspace members can insert execution_tasks/);
  assert.match(migration, /workspace members can update execution_tasks/);
});

test("execution_tasks migration has updated_at trigger", () => {
  assert.match(migration, /set_updated_at/);
  assert.match(migration, /before update on public\.execution_tasks/);
});

// ── Migration: execution_task_events ─────────────────────────────────────────

test("execution_task_events migration creates table", () => {
  assert.match(migration, /create table if not exists public\.execution_task_events/);
});

test("execution_task_events migration has all required columns", () => {
  for (const col of [
    "id", "workspace_id", "project_id", "task_id",
    "event_type", "event_payload", "actor_user_id", "created_at",
  ]) {
    assert.match(migration, new RegExp(`\\b${col}\\b`), `column ${col} missing from execution_task_events`);
  }
});

test("execution_task_events migration has required indexes", () => {
  assert.match(migration, /execution_task_events_task_idx/);
  assert.match(migration, /execution_task_events_project_idx/);
  assert.match(migration, /execution_task_events_created_at_idx/);
});

test("execution_task_events migration enables RLS", () => {
  assert.match(migration, /workspace members can read execution_task_events/);
  assert.match(migration, /workspace members can insert execution_task_events/);
});

// ── Database Contract ─────────────────────────────────────────────────────────

test("database contract declares ExecutionTaskRow", () => {
  assert.match(contract, /ExecutionTaskRow/);
});

test("database contract declares ExecutionTaskStatus", () => {
  assert.match(contract, /ExecutionTaskStatus/);
  for (const s of ["not_started", "in_progress", "blocked", "completed", "cancelled"]) {
    assert.match(contract, new RegExp(`"${s}"`), `status '${s}' missing from contract`);
  }
});

test("database contract declares ExecutionTaskPriority", () => {
  assert.match(contract, /ExecutionTaskPriority/);
});

test("database contract declares EXECUTION_TASK_SELECTABLE_COLUMNS", () => {
  assert.match(contract, /EXECUTION_TASK_SELECTABLE_COLUMNS/);
});

test("database contract ExecutionTaskRow includes all columns", () => {
  for (const col of [
    "id", "workspace_id", "project_id", "task_draft_id", "recommended_action_id",
    "raid_item_id", "title", "description", "status", "priority",
    "owner_user_id", "owner_name", "start_date", "due_date", "completed_at",
    "progress_percent", "acceptance_criteria", "checklist", "confidence_score",
    "source_payload", "created_by", "created_at", "updated_at",
  ]) {
    assert.match(contract, new RegExp(`"${col}"`), `column ${col} missing from ExecutionTaskRow`);
  }
});

test("database contract declares ExecutionTaskEventRow", () => {
  assert.match(contract, /ExecutionTaskEventRow/);
});

test("database contract declares EXECUTION_TASK_EVENT_SELECTABLE_COLUMNS", () => {
  assert.match(contract, /EXECUTION_TASK_EVENT_SELECTABLE_COLUMNS/);
});

test("database contract has updated version for execution tasks", () => {
  assert.match(contract, /execution-tasks/);
});

// ── Lifecycle Validation ──────────────────────────────────────────────────────

test("lifecycle exports isValidStatusTransition", () => {
  assert.match(lifecycle, /export function isValidStatusTransition/);
});

test("lifecycle exports isTerminalStatus", () => {
  assert.match(lifecycle, /export function isTerminalStatus/);
});

test("lifecycle not_started can transition to in_progress", () => {
  assert.match(lifecycle, /not_started.*in_progress/s);
});

test("lifecycle not_started can transition to cancelled", () => {
  assert.match(lifecycle, /not_started.*cancelled/s);
});

test("lifecycle in_progress can transition to blocked", () => {
  assert.match(lifecycle, /in_progress.*blocked/s);
});

test("lifecycle in_progress can transition to completed", () => {
  assert.match(lifecycle, /in_progress.*completed/s);
});

test("lifecycle blocked can transition to in_progress", () => {
  assert.match(lifecycle, /blocked.*in_progress/s);
});

test("lifecycle completed is terminal", () => {
  assert.match(lifecycle, /completed.*\[\]/);
});

test("lifecycle cancelled is terminal", () => {
  assert.match(lifecycle, /cancelled.*\[\]/);
});

test("lifecycle isTerminalStatus covers completed and cancelled", () => {
  assert.match(lifecycle, /completed.*cancelled/s);
});

// ── Conversion Workflow ───────────────────────────────────────────────────────

test("converter exports convertTaskDraftToExecutionTask", () => {
  assert.match(converter, /export async function convertTaskDraftToExecutionTask/);
});

test("converter exports TaskConversionResult type", () => {
  assert.match(converter, /export type TaskConversionResult/);
});

test("converter validates draft_status = approved", () => {
  assert.match(converter, /draft_status.*approved/);
});

test("converter prevents duplicate conversion", () => {
  assert.match(converter, /already exists for this draft/);
});

test("converter writes task_created activity event", () => {
  assert.match(converter, /task_created/);
});

test("converter marks draft as converted_to_task", () => {
  assert.match(converter, /converted_to_task/);
});

test("converter returns ok: true with task on success", () => {
  assert.match(converter, /\{ ok: true, task \}/);
});

test("converter returns ok: false with error on failure", () => {
  assert.match(converter, /ok: false/);
});

test("converter preserves traceability — raid_item_id and recommended_action_id", () => {
  assert.match(converter, /recommended_action_id.*null/s);
  assert.match(converter, /raid_item_id.*null/s);
});

test("converter stores source_payload with lineage", () => {
  assert.match(converter, /taskDraftId/);
  assert.match(converter, /recommendedActionId/);
  assert.match(converter, /raidItemId/);
});

test("converter logs execution_task.created", () => {
  assert.match(converter, /execution_task\.created/);
});

test("converter handles invalid_transition failureClass", () => {
  assert.match(converter, /invalid_transition/);
});

test("converter handles duplicate failureClass", () => {
  assert.match(converter, /duplicate/);
});

// ── Index ─────────────────────────────────────────────────────────────────────

test("index exports convertTaskDraftToExecutionTask", () => {
  assert.match(indexFile, /convertTaskDraftToExecutionTask/);
});

test("index exports TaskConversionResult", () => {
  assert.match(indexFile, /TaskConversionResult/);
});

test("index exports lifecycle functions", () => {
  assert.match(indexFile, /isValidStatusTransition/);
  assert.match(indexFile, /isTerminalStatus/);
});

// ── API: Convert ─────────────────────────────────────────────────────────────

test("convert route exports POST", () => {
  assert.match(convertRoute, /export async function POST/);
});

test("convert route validates taskDraftId", () => {
  assert.match(convertRoute, /taskDraftId/);
});

test("convert route returns 400 on validation failure", () => {
  assert.match(convertRoute, /status: 400/);
});

test("convert route returns 401 on unauthenticated", () => {
  assert.match(convertRoute, /status: 401/);
});

test("convert route returns 409 on duplicate", () => {
  assert.match(convertRoute, /status: 409/);
});

test("convert route returns 201 on success", () => {
  assert.match(convertRoute, /status: 201/);
});

// ── API: List ─────────────────────────────────────────────────────────────────

test("list route exports GET", () => {
  assert.match(listRoute, /export async function GET/);
});

test("list route requires projectId", () => {
  assert.match(listRoute, /projectId is required/);
});

test("list route supports status filter", () => {
  assert.match(listRoute, /status.*filter\b|filter.*status|\bstatus\b.*query/s);
});

test("list route sorts by priority then due date", () => {
  assert.match(listRoute, /PRIORITY_ORDER/);
  assert.match(listRoute, /due_date/);
});

// ── API: Update ───────────────────────────────────────────────────────────────

test("update route exports POST", () => {
  assert.match(updateRoute, /export async function POST/);
});

test("update route validates taskId", () => {
  assert.match(updateRoute, /taskId is required/);
});

test("update route enforces status transitions", () => {
  assert.match(updateRoute, /isValidStatusTransition/);
  assert.match(updateRoute, /invalid_transition/);
});

test("update route validates progress 0-100", () => {
  assert.match(updateRoute, /progressPercent.*0.*100|0.*100.*progressPercent/s);
});

test("update route sets completed_at on completion", () => {
  assert.match(updateRoute, /completed_at/);
});

test("update route sets progress to 100 on completion", () => {
  assert.match(updateRoute, /progress_percent = 100/);
});

test("update route writes activity events", () => {
  assert.match(updateRoute, /execution_task_events/);
  assert.match(updateRoute, /task_completed/);
  assert.match(updateRoute, /status_changed/);
  assert.match(updateRoute, /owner_changed/);
  assert.match(updateRoute, /progress_updated/);
});

test("update route logs execution_task.updated", () => {
  assert.match(updateRoute, /execution_task\.updated/);
});

test("update route logs execution_task.completed", () => {
  assert.match(updateRoute, /execution_task\.completed/);
});

// ── API: Activity ─────────────────────────────────────────────────────────────

test("activity route exports GET", () => {
  assert.match(activityRoute, /export async function GET/);
});

test("activity route requires taskId", () => {
  assert.match(activityRoute, /taskId is required/);
});

test("activity route returns ordered activity", () => {
  assert.match(activityRoute, /ascending.*true|order.*created_at/s);
});

test("activity route returns activity array", () => {
  assert.match(activityRoute, /activity.*events/s);
});

// ── Operational Shell ─────────────────────────────────────────────────────────

test("shell declares ExecutionTask type", () => {
  assert.match(shell, /type ExecutionTask/);
});

test("shell has executionTasks state", () => {
  assert.match(shell, /executionTasks/);
});

test("shell loads execution tasks on projectId change", () => {
  assert.match(shell, /\/api\/execution-tasks/);
});

test("shell renders Execution Tasks panel heading", () => {
  assert.match(shell, /Execution Tasks/);
});

test("shell renders task status badges", () => {
  assert.match(shell, /Overdue/);
  assert.match(shell, /Due Soon/);
  assert.match(shell, /Blocked/);
  assert.match(shell, /Completed/);
});

test("shell renders Start action", () => {
  assert.match(shell, />\s*Start\s*<\/button>/);
});

test("shell renders Block action", () => {
  assert.match(shell, />\s*Block\s*<\/button>/);
});

test("shell renders Complete action", () => {
  assert.match(shell, />\s*Complete\s*<\/button>/);
});

test("shell renders Cancel action", () => {
  assert.match(shell, />\s*Cancel\s*<\/button>/);
});

test("shell renders progress bar", () => {
  assert.match(shell, /progress_percent/);
});

test("shell renders traceability info", () => {
  assert.match(shell, /RAID.*Action.*Draft|Draft.*Action.*RAID/s);
});

test("shell renders Create Execution Task button for approved draft", () => {
  assert.match(shell, /Create Execution Task/);
});

test("shell calls handleConvertDraftToTask", () => {
  assert.match(shell, /handleConvertDraftToTask/);
});

test("shell renders task filter tabs including all, open, blocked, completed", () => {
  assert.match(shell, /executionTasksFilter/);
});

// ── Traceability Chain ────────────────────────────────────────────────────────

test("converter stores task_draft_id reference", () => {
  assert.match(converter, /task_draft_id.*draft\.id/s);
});

test("converter stores recommended_action_id from draft", () => {
  assert.match(converter, /recommended_action_id.*draft\.recommended_action_id/s);
});

test("converter stores raid_item_id from draft", () => {
  assert.match(converter, /raid_item_id.*draft\.raid_item_id/s);
});

test("migration task_draft_id references task_drafts", () => {
  assert.match(migration, /task_draft_id.*references public\.task_drafts/);
});

test("migration recommended_action_id references recommended_actions", () => {
  assert.match(migration, /recommended_action_id.*references public\.recommended_actions/);
});

test("migration raid_item_id references raid_items", () => {
  assert.match(migration, /raid_item_id.*references public\.raid_items/);
});
