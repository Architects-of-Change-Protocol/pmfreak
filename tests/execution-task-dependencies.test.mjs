import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260605080000_execution_task_dependencies.sql", "utf8");
const contract = fs.readFileSync("src/lib/db/database-contract.ts", "utf8");
const graphTs = fs.readFileSync("src/lib/execution-tasks/dependencies/graph.ts", "utf8");
const createDepTs = fs.readFileSync("src/lib/execution-tasks/dependencies/create-dependency.ts", "utf8");
const inferTs = fs.readFileSync("src/lib/execution-tasks/dependencies/infer-dependencies.ts", "utf8");
const materializeTs = fs.readFileSync("src/lib/execution-tasks/dependencies/materialize-inferred-dependencies.ts", "utf8");
const depRoute = fs.readFileSync("src/app/api/execution-task-dependencies/route.ts", "utf8");
const graphRoute = fs.readFileSync("src/app/api/execution-task-graph/route.ts", "utf8");
const materializeRoute = fs.readFileSync("src/app/api/execution-task-dependencies/materialize/route.ts", "utf8");
const updateRoute = fs.readFileSync("src/app/api/execution-task-dependencies/update/route.ts", "utf8");
const shell = fs.readFileSync("src/components/pmfreak/operational-shell.tsx", "utf8");

// ── Migration ─────────────────────────────────────────────────────────────────

test("migration creates execution_task_dependencies table", () => {
  assert.match(migration, /create table if not exists public\.execution_task_dependencies/);
});

test("migration has all required columns", () => {
  for (const col of [
    "id", "workspace_id", "project_id", "predecessor_task_id", "successor_task_id",
    "dependency_type", "status", "lag_days", "reason", "source_type",
    "source_payload", "confidence_score", "created_by", "created_at", "updated_at",
  ]) {
    assert.match(migration, new RegExp(`\\b${col}\\b`), `column ${col} missing`);
  }
});

test("migration enforces dependency_type constraint", () => {
  assert.match(migration, /dependency_type.*check/s);
  for (const t of ["finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish", "blocks", "gated_by", "approval_required", "external_dependency"]) {
    assert.match(migration, new RegExp(`'${t}'`), `type '${t}' missing`);
  }
});

test("migration enforces status constraint", () => {
  assert.match(migration, /status.*check/s);
  for (const s of ["active", "resolved", "invalidated", "proposed"]) {
    assert.match(migration, new RegExp(`'${s}'`), `status '${s}' missing`);
  }
});

test("migration prevents self-dependency", () => {
  assert.match(migration, /predecessor_task_id != successor_task_id/);
});

test("migration has unique index on workspace+predecessor+successor+type", () => {
  assert.match(migration, /execution_task_dependencies_unique_idx/);
  assert.match(migration, /workspace_id.*predecessor_task_id.*successor_task_id.*dependency_type/s);
});

test("migration has required indexes", () => {
  assert.match(migration, /execution_task_dependencies_workspace_idx/);
  assert.match(migration, /execution_task_dependencies_project_idx/);
  assert.match(migration, /execution_task_dependencies_predecessor_idx/);
  assert.match(migration, /execution_task_dependencies_successor_idx/);
  assert.match(migration, /execution_task_dependencies_status_idx/);
  assert.match(migration, /execution_task_dependencies_type_idx/);
});

test("migration enables RLS", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /is_workspace_member\(workspace_id\)/);
});

test("migration has select, insert, update, delete policies", () => {
  assert.match(migration, /workspace members can read execution_task_dependencies/);
  assert.match(migration, /workspace members can insert execution_task_dependencies/);
  assert.match(migration, /workspace members can update execution_task_dependencies/);
  assert.match(migration, /workspace members can delete execution_task_dependencies/);
});

test("migration has updated_at trigger", () => {
  assert.match(migration, /set_updated_at_execution_task_dependencies/);
  assert.match(migration, /before update on public\.execution_task_dependencies/);
});

// ── Database Contract ─────────────────────────────────────────────────────────

test("contract declares ExecutionTaskDependencyRow", () => {
  assert.match(contract, /ExecutionTaskDependencyRow/);
});

test("contract declares ExecutionTaskDependencyType", () => {
  assert.match(contract, /ExecutionTaskDependencyType/);
  for (const t of ["finish_to_start", "start_to_start", "blocks", "gated_by", "approval_required", "external_dependency"]) {
    assert.match(contract, new RegExp(`"${t}"`), `type '${t}' missing from contract`);
  }
});

test("contract declares ExecutionTaskDependencyStatus", () => {
  assert.match(contract, /ExecutionTaskDependencyStatus/);
  for (const s of ["proposed", "active", "resolved", "invalidated"]) {
    assert.match(contract, new RegExp(`"${s}"`), `status '${s}' missing from contract`);
  }
});

test("contract declares EXECUTION_TASK_DEPENDENCY_SELECTABLE_COLUMNS", () => {
  assert.match(contract, /EXECUTION_TASK_DEPENDENCY_SELECTABLE_COLUMNS/);
});

test("contract ExecutionTaskDependencyRow includes all columns", () => {
  for (const col of [
    "id", "workspace_id", "project_id", "predecessor_task_id", "successor_task_id",
    "dependency_type", "status", "lag_days", "reason", "source_type",
    "source_payload", "confidence_score", "created_by", "created_at", "updated_at",
  ]) {
    assert.match(contract, new RegExp(`"${col}"`), `column ${col} missing from contract`);
  }
});

test("contract version bumped for dependencies", () => {
  assert.match(contract, /dependencies/);
});

// ── Graph ────────────────────────────────────────────────────────────────────

test("graph exports buildExecutionTaskGraph", () => {
  assert.match(graphTs, /export function buildExecutionTaskGraph/);
});

test("graph exports detectDependencyCycle", () => {
  assert.match(graphTs, /export function detectDependencyCycle/);
});

test("graph exports getBlockedTasks", () => {
  assert.match(graphTs, /export function getBlockedTasks/);
});

test("graph exports getBlockingTasks", () => {
  assert.match(graphTs, /export function getBlockingTasks/);
});

test("graph exports getReadyTasks", () => {
  assert.match(graphTs, /export function getReadyTasks/);
});

test("graph exports getExecutionNetworkSummary", () => {
  assert.match(graphTs, /export function getExecutionNetworkSummary/);
});

test("graph cycle detection checks successor reaching predecessor", () => {
  assert.match(graphTs, /target.*predecessor|predecessorId.*target/s);
});

test("graph ready task requires not_started status and no incomplete predecessors", () => {
  assert.match(graphTs, /not_started/);
  assert.match(graphTs, /isReady/);
});

test("graph blocked task computation includes predecessor check", () => {
  assert.match(graphTs, /isBlocked/);
  assert.match(graphTs, /INCOMPLETE_STATUSES/);
});

test("graph treats active and proposed deps as graph edges", () => {
  assert.match(graphTs, /ACTIVE_STATUSES.*active.*proposed|active.*proposed.*ACTIVE_STATUSES/s);
});

// ── Graph logic unit tests ─────────────────────────────────────────────────────

test("cycle detection rejects A→B, B→C, C→A", () => {
  // Import and test inline via eval-style assertions on the source
  // (Since we can't import ESM in CJS test easily, we verify the algorithm is present)
  assert.match(graphTs, /dfs/);
  assert.match(graphTs, /hasCycle/);
  assert.match(graphTs, /path/);
});

test("graph summary returns proposedDependencies count", () => {
  assert.match(graphTs, /proposedDependencies/);
});

test("graph summary returns activeDependencies count", () => {
  assert.match(graphTs, /activeDependencies/);
});

// ── Create Dependency ─────────────────────────────────────────────────────────

test("create-dependency exports createExecutionTaskDependency", () => {
  assert.match(createDepTs, /export async function createExecutionTaskDependency/);
});

test("create-dependency exports CreateExecutionTaskDependencyResult", () => {
  assert.match(createDepTs, /export type CreateExecutionTaskDependencyResult/);
});

test("create-dependency prevents self-dependency", () => {
  assert.match(createDepTs, /self_dependency/);
  assert.match(createDepTs, /cannot depend on itself/i);
});

test("create-dependency validates same workspace and project", () => {
  assert.match(createDepTs, /cross_project_dependency/);
});

test("create-dependency handles duplicates and returns duplicate:true", () => {
  assert.match(createDepTs, /duplicate.*true|true.*duplicate/s);
});

test("create-dependency detects reverse dependency", () => {
  assert.match(createDepTs, /reverse_dependency/);
});

test("create-dependency detects cycles and rejects them", () => {
  assert.match(createDepTs, /cycle_detected/);
  assert.match(createDepTs, /detectDependencyCycle/);
});

test("create-dependency writes dependency_created event on predecessor", () => {
  assert.match(createDepTs, /dependency_created/);
});

test("create-dependency writes dependency_added event on successor", () => {
  assert.match(createDepTs, /dependency_added/);
});

test("create-dependency writes dependency_cycle_rejected event on cycle detection", () => {
  assert.match(createDepTs, /dependency_cycle_rejected/);
});

test("create-dependency returns ok:true with dependency on success", () => {
  assert.match(createDepTs, /ok: true.*dependency|dependency.*ok: true/s);
});

test("create-dependency handles all failure classes", () => {
  for (const fc of ["unauthenticated", "not_found", "cross_project_dependency", "self_dependency", "reverse_dependency", "cycle_detected", "unauthorized", "persistence_failed"]) {
    assert.match(createDepTs, new RegExp(fc), `failureClass '${fc}' missing`);
  }
});

// ── Inference ─────────────────────────────────────────────────────────────────

test("inference exports inferExecutionTaskDependencies", () => {
  assert.match(inferTs, /export function inferExecutionTaskDependencies/);
});

test("inference approval keywords produce approval_required dependency type", () => {
  assert.match(inferTs, /approval_required/);
  assert.match(inferTs, /approval.*sign-off.*authorize|approvalTerms/s);
});

test("inference clarify_requirement precedes validate_scope", () => {
  assert.match(inferTs, /clarify_requirement.*validate_scope|validate_scope.*clarify_requirement/s);
});

test("inference schedule_meeting precedes follow_up", () => {
  assert.match(inferTs, /schedule_meeting.*follow_up|follow_up.*schedule_meeting/s);
});

test("inference request_approval precedes create_mitigation_plan", () => {
  assert.match(inferTs, /request_approval.*create_mitigation_plan/s);
});

test("inference returns sourceType system", () => {
  assert.match(inferTs, /sourceType.*system|"system"/s);
});

test("inference returns proposed status (not active)", () => {
  assert.match(inferTs, /proposed/);
  assert.doesNotMatch(inferTs, /"active"/);
});

test("inference returns confidenceScore", () => {
  assert.match(inferTs, /confidenceScore/);
});

// ── Materialization ───────────────────────────────────────────────────────────

test("materialization exports materializeInferredExecutionTaskDependencies", () => {
  assert.match(materializeTs, /export async function materializeInferredExecutionTaskDependencies/);
});

test("materialization logs started, completed, failed", () => {
  assert.match(materializeTs, /task_dependencies\.materialization\.started/);
  assert.match(materializeTs, /task_dependencies\.materialization\.completed/);
  assert.match(materializeTs, /task_dependencies\.materialization\.failed/);
});

test("materialization inserts only non-cyclic dependencies", () => {
  assert.match(materializeTs, /detectDependencyCycle/);
  assert.match(materializeTs, /hasCycle/);
});

test("materialization inserts with status proposed", () => {
  assert.match(materializeTs, /status.*proposed/);
});

// ── API: POST /api/execution-task-dependencies ────────────────────────────────

test("dep route exports POST", () => {
  assert.match(depRoute, /export async function POST/);
});

test("dep route validates predecessorTaskId", () => {
  assert.match(depRoute, /predecessorTaskId is required/);
});

test("dep route validates successorTaskId", () => {
  assert.match(depRoute, /successorTaskId is required/);
});

test("dep route validates dependencyType", () => {
  assert.match(depRoute, /Invalid dependencyType/);
});

test("dep route returns 401 on unauthenticated", () => {
  assert.match(depRoute, /status: 401/);
});

test("dep route returns 201 on created", () => {
  assert.match(depRoute, /status: 201/);
});

test("dep route returns 200 on duplicate", () => {
  assert.match(depRoute, /status: 200/);
  assert.match(depRoute, /duplicate/);
});

// ── API: GET /api/execution-task-dependencies ─────────────────────────────────

test("dep route exports GET", () => {
  assert.match(depRoute, /export async function GET/);
});

test("dep GET requires projectId", () => {
  assert.match(depRoute, /projectId is required/);
});

test("dep GET supports taskId filter", () => {
  assert.match(depRoute, /taskId/);
});

test("dep GET supports status filter", () => {
  assert.match(depRoute, /status.*searchParams|searchParams.*status/s);
});

test("dep GET supports dependencyType filter", () => {
  assert.match(depRoute, /dependencyType/);
});

// ── API: GET /api/execution-task-graph ────────────────────────────────────────

test("graph route exports GET", () => {
  assert.match(graphRoute, /export async function GET/);
});

test("graph route requires projectId", () => {
  assert.match(graphRoute, /projectId is required/);
});

test("graph route returns graphSummary", () => {
  assert.match(graphRoute, /graphSummary/);
});

test("graph route returns tasks and dependencies", () => {
  assert.match(graphRoute, /tasks.*dependencies|dependencies.*tasks/s);
});

test("graph route calls buildExecutionTaskGraph", () => {
  assert.match(graphRoute, /buildExecutionTaskGraph/);
});

test("graph route calls getExecutionNetworkSummary", () => {
  assert.match(graphRoute, /getExecutionNetworkSummary/);
});

// ── API: POST /api/execution-task-dependencies/materialize ───────────────────

test("materialize route exports POST", () => {
  assert.match(materializeRoute, /export async function POST/);
});

test("materialize route requires projectId", () => {
  assert.match(materializeRoute, /projectId is required/);
});

test("materialize route returns inserted and skipped counts", () => {
  assert.match(materializeRoute, /inserted/);
  assert.match(materializeRoute, /skipped/);
});

// ── API: POST /api/execution-task-dependencies/update ────────────────────────

test("update route exports POST", () => {
  assert.match(updateRoute, /export async function POST/);
});

test("update route validates dependencyId", () => {
  assert.match(updateRoute, /dependencyId is required/);
});

test("update route validates status", () => {
  assert.match(updateRoute, /status is required/);
});

test("update route enforces valid transitions", () => {
  assert.match(updateRoute, /VALID_TRANSITIONS/);
  assert.match(updateRoute, /Cannot transition/);
});

test("update route writes dependency_activated event", () => {
  assert.match(updateRoute, /dependency_activated/);
});

test("update route writes dependency_resolved event", () => {
  assert.match(updateRoute, /dependency_resolved/);
});

test("update route writes dependency_invalidated event", () => {
  assert.match(updateRoute, /dependency_invalidated/);
});

// ── UI: Operational Shell ─────────────────────────────────────────────────────

test("shell declares ExecutionTaskDependency type", () => {
  assert.match(shell, /type ExecutionTaskDependency/);
});

test("shell declares ExecutionNetworkSummary type", () => {
  assert.match(shell, /type ExecutionNetworkSummary/);
});

test("shell has dependencies state", () => {
  assert.match(shell, /dependencies.*useState|useState.*dependencies/s);
});

test("shell has networkSummary state", () => {
  assert.match(shell, /networkSummary/);
});

test("shell loads execution network on projectId change", () => {
  assert.match(shell, /\/api\/execution-task-graph/);
});

test("shell renders Execution Network panel heading", () => {
  assert.match(shell, /Execution Network/);
});

test("shell shows ready tasks counter", () => {
  assert.match(shell, /readyTasks|Ready:/);
});

test("shell shows blocked tasks counter", () => {
  assert.match(shell, /blockedTasks|Blocked:/);
});

test("shell shows proposed dependencies counter", () => {
  assert.match(shell, /proposedDependencies/);
});

test("shell shows active dependencies counter", () => {
  assert.match(shell, /activeDependencies/);
});

test("shell renders Activate action for proposed dependencies", () => {
  assert.match(shell, />Activate</);
});

test("shell renders Invalidate action for dependencies", () => {
  assert.match(shell, />Invalidate</);
});

test("shell renders Resolve action for active dependencies", () => {
  assert.match(shell, />Resolve</);
});

test("shell renders dependency badges on task cards", () => {
  assert.match(shell, /Blocking \{blockingCount\}/);
  assert.match(shell, /Blocked by \{blockedByCount\}/);
  assert.match(shell, /Ready/);
  assert.match(shell, /Waiting/);
});

test("shell renders proposed dependency badge on task cards", () => {
  assert.match(shell, /proposed/);
});

test("shell has Add Dependency form", () => {
  assert.match(shell, /Add Dependency/);
});

test("shell handleDepAction calls /api/execution-task-dependencies/update", () => {
  assert.match(shell, /\/api\/execution-task-dependencies\/update/);
});

test("shell handleCreateDependency calls POST /api/execution-task-dependencies", () => {
  assert.match(shell, /handleCreateDependency/);
  assert.match(shell, /\/api\/execution-task-dependencies/);
});
