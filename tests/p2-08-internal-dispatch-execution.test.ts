import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260905000000_p2_08_internal_dispatch_execution.sql",
  "utf8",
);
const provider = readFileSync(
  "src/lib/execution-tasks/internal-execution-provider.ts",
  "utf8",
);
const route = readFileSync(
  "src/app/api/execution-tasks/internal-execution/route.ts",
  "utf8",
);
const legacyUpdate = readFileSync(
  "src/app/api/execution-tasks/update/route.ts",
  "utf8",
);
const detailRoute = readFileSync(
  "src/app/api/execution-tasks/[taskId]/route.ts",
  "utf8",
);
const projectList = readFileSync(
  "src/components/pmfreak/tasks/project-task-list.tsx",
  "utf8",
);
const drawer = readFileSync(
  "src/components/pmfreak/execution/task-detail-drawer.tsx",
  "utf8",
);
const control = readFileSync(
  "src/components/pmfreak/tasks/internal-execution-control.tsx",
  "utf8",
);
const contract = readFileSync(
  "src/lib/db/database-contract.ts",
  "utf8",
);

test("P2-08 preserves execution_tasks as the canonical Task and adds only a bounded execution record", () => {
  assert.match(migration, /create table public\.internal_task_executions/);
  assert.doesNotMatch(migration, /create table public\.(?:canonical_)?tasks\b/i);
  assert.match(migration, /task_id uuid not null references public\.execution_tasks/);
});

test("P2-08 has one execution per Task and server-owned idempotency", () => {
  assert.match(migration, /unique \(workspace_id, task_id\)/);
  assert.match(migration, /unique \(workspace_id, idempotency_key\)/);
  assert.match(migration, /'internal-execution:' \|\| v_task\.id::text/);
  assert.match(migration, /pg_advisory_xact_lock/);
});

test("P2-08 execution lifecycle is distinct from the legacy Task enum", () => {
  assert.match(migration, /'queued','running','blocked','failed','completed'/);
  assert.match(contract, /export type InternalTaskExecutionStatus/);
  assert.match(contract, /INTERNAL_TASK_EXECUTION_SELECTABLE_COLUMNS/);
  assert.doesNotMatch(
    contract.match(/export type ExecutionTaskStatus[\s\S]*?;/)?.[0] ?? "",
    /queued|failed/,
  );
});

test("P2-08 revalidates governance for queue, start/resume and retry", () => {
  assert.match(migration, /p2_08_validate_execution_governance/);
  assert.match(migration, /if v_command in \('start','retry'\)/);
  assert.match(migration, /governance_state not in \('authorized','not_required'\)/);
  assert.match(migration, /v_action\.expires_at <= pg_catalog\.now\(\)/);
  assert.match(migration, /governance_evaluation_stale/);
  assert.match(migration, /policy_or_grant_reference_missing/);
});

test("P2-08 keeps historical execution evidence while blocking new work after governance changes", () => {
  const dispatchBody =
    migration.match(/create or replace function public\.dispatch_internal_task_execution[\s\S]*?revoke all on function public\.dispatch_internal_task_execution/)?.[0] ?? "";
  assert.match(dispatchBody, /Historical dispatch replay wins before current governance/);
  assert.match(dispatchBody, /if v_existing\.id is not null then/);
  assert.match(migration, /governed_action_not_executable/);
});

test("P2-08 protects governed Task lifecycle and execution audit provenance", () => {
  assert.match(migration, /governed_task_lifecycle_requires_internal_execution/);
  assert.match(migration, /internal_execution_event_provenance_required/);
  assert.match(migration, /pmfreak\.p2_08_internal_execution/);
  assert.match(legacyUpdate, /governed_task_status_requires_internal_execution/);
  assert.match(detailRoute, /governed_task_status_requires_internal_execution/);
});

test("P2-08 API accepts taskId plus command and derives scope server-side", () => {
  assert.match(route, /taskId/);
  assert.match(route, /isInternalExecutionCommand/);
  assert.match(route, /workspace_memberships/);
  assert.match(route, /WRITE_ROLES/);
  assert.doesNotMatch(route, /requireProjectAccess/);
  assert.doesNotMatch(route, /body\.workspaceId|body\.projectId|body\.actionId|body\.providerKey/);
});

test("P2-08 internal provider is explicit and has no external provider calls", () => {
  assert.match(provider, /pmfreak\/internal-state-machine:v1/);
  assert.match(provider, /queueInternalTaskExecution/);
  assert.match(provider, /transitionInternalTaskExecution/);
  assert.doesNotMatch(provider, /asana|jira|linear|webhook|github|slack/i);
});

test("P2-08 UI exposes persisted execution states and no-Outcome truth", () => {
  assert.match(control, /Queue execution/);
  assert.match(control, /Running/);
  assert.match(control, /Blocked/);
  assert.match(control, /Failed/);
  assert.match(control, /Retry/);
  assert.match(control, /Complete/);
  assert.match(control, /Task completion does not create Outcome/);
  assert.match(projectList, /InternalExecutionControl/);
  assert.match(drawer, /InternalExecutionControl/);
});

test("P2-08 preserves legacy Task status controls for non-governed Tasks", () => {
  assert.match(projectList, /isGovernedTask\(task\) \?/);
  assert.match(projectList, /TASK_STATUS_LABELS/);
  assert.match(drawer, /governedTask \?/);
  assert.match(drawer, /TaskStatusControl/);
});

test("P2-08 audit is explicit and Outcome remains absent", () => {
  for (const event of [
    "internal_execution_queued",
    "internal_execution_started",
    "internal_execution_blocked",
    "internal_execution_failed",
    "internal_execution_retried",
    "internal_execution_completed",
  ]) {
    assert.match(migration, new RegExp(event));
  }
  assert.match(migration, /'outcomeCreated', false/);
  assert.doesNotMatch(migration, /insert into public\.[a-z0-9_]*outcome/i);
  assert.doesNotMatch(migration, /insert into public\.[a-z0-9_]*observation/i);
});

test("P2-08 preserves the remote AOC no-write boundary", () => {
  assert.match(migration, /'remoteAocWriteback',false/);
  assert.doesNotMatch(migration, /allowDecisionWriteback\s*=\s*true/);
});
test("P2-08 governed legacy lifecycle guard precedes runtime authorization", () => {
  const legacyGuard = legacyUpdate.indexOf("if (governedLifecycleMutation)");
  const legacyRuntimeGate = legacyUpdate.indexOf('await deps.requireProjectAccess(task.project_id, "write")');
  assert.ok(legacyGuard >= 0 && legacyRuntimeGate > legacyGuard);
  assert.match(legacyUpdate, /workspace_memberships/);
  assert.match(legacyUpdate, /\["owner", "admin", "pm"\]/);

  const detailPatch = detailRoute.slice(detailRoute.indexOf("export async function PATCH"));
  const detailGuard = detailPatch.indexOf("if (governedLifecycleMutation)");
  const detailRuntimeGate = detailPatch.indexOf('await requireProjectAccess(task.project_id, "write")');
  assert.ok(detailGuard >= 0 && detailRuntimeGate > detailGuard);
  assert.match(detailPatch, /workspace_memberships/);
  assert.match(detailPatch, /\["owner", "admin", "pm"\]/);
});