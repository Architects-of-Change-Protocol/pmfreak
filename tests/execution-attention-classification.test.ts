// Daily Execution Workspace — attention model.
//
// Pure, deterministic classification of execution_tasks into attention
// reasons/severity/section. No AI, no opaque score — every assertion here
// pins a rule back to a real column (status, priority, owner_user_id,
// due_date) so a future change that quietly fabricates a reason breaks a
// test immediately.

import test from "node:test";
import assert from "node:assert/strict";
import { classifyTaskAttention, isTaskDueToday, isTaskOverdue, isTaskUpcoming } from "../src/lib/execution-attention/classify-task-attention";
import { resolveExecutionSection } from "../src/lib/execution-attention/resolve-execution-section";
import { classifyExecutionTasks } from "../src/lib/execution-attention/classify-execution-tasks";
import { sortExecutionTasks } from "../src/lib/execution-attention/sort-execution-tasks";
import { summarizeExecutionAttention } from "../src/lib/execution-attention/execution-attention-summary";
import { matchesAttentionFilter } from "../src/lib/execution-attention/matches-attention-filter";
import type { ExecutionTaskRow } from "../src/lib/db/database-contract";

const NOW = new Date(2026, 6, 21, 9, 0, 0); // 2026-07-21 local, matches session "today"

function makeTask(overrides: Partial<ExecutionTaskRow> = {}): ExecutionTaskRow {
  return {
    id: "task-1",
    workspace_id: "ws-1",
    project_id: "proj-1",
    task_draft_id: null,
    recommended_action_id: null,
    raid_item_id: null,
    title: "Confirm migration scope",
    description: "",
    status: "not_started",
    priority: "medium",
    owner_user_id: "user-1",
    owner_name: "Alex",
    start_date: null,
    due_date: null,
    completed_at: null,
    progress_percent: 0,
    acceptance_criteria: [],
    checklist: [],
    confidence_score: null,
    source_payload: {},
    created_by: "user-1",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    planned_start_date: null,
    planned_finish_date: null,
    baseline_start_date: null,
    baseline_finish_date: null,
    forecast_start_date: null,
    forecast_finish_date: null,
    milestone_id: null,
    schedule_status: "unscheduled",
    schedule_confidence: null,
    is_critical: false,
    early_start: null,
    early_finish: null,
    late_start: null,
    late_finish: null,
    total_float: null,
    free_float: null,
    variance_days: null,
    criticality_score: null,
    ...overrides,
  };
}

function isoDaysFromNow(days: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ─── isTaskOverdue / isTaskDueToday / isTaskUpcoming ───────────────────────

test("overdue: due_date in the past and status not terminal", () => {
  const task = makeTask({ due_date: isoDaysFromNow(-2), status: "in_progress" });
  assert.equal(isTaskOverdue(task, NOW), true);
});

test("overdue: completed task with a past due_date is never overdue", () => {
  const task = makeTask({ due_date: isoDaysFromNow(-5), status: "completed", completed_at: isoDaysFromNow(-1) });
  assert.equal(isTaskOverdue(task, NOW), false);
});

test("overdue: cancelled task with a past due_date is never overdue", () => {
  const task = makeTask({ due_date: isoDaysFromNow(-5), status: "cancelled" });
  assert.equal(isTaskOverdue(task, NOW), false);
});

test("overdue: no due_date is never overdue", () => {
  const task = makeTask({ due_date: null });
  assert.equal(isTaskOverdue(task, NOW), false);
});

test("due today: due_date falls on the same calendar day as now", () => {
  const dueToday = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), 23, 0, 0).toISOString();
  const task = makeTask({ due_date: dueToday });
  assert.equal(isTaskDueToday(task, NOW), true);
  assert.equal(isTaskOverdue(task, NOW), false, "due today must not also read as overdue");
});

test("timezone boundary: due_date stored just after local midnight today still reads as due today, not overdue", () => {
  const justAfterMidnight = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), 0, 5, 0).toISOString();
  const task = makeTask({ due_date: justAfterMidnight });
  assert.equal(isTaskDueToday(task, NOW), true);
});

test("timezone boundary: due_date just before local midnight yesterday reads as overdue, not due today", () => {
  const yesterday = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - 1, 23, 55, 0).toISOString();
  const task = makeTask({ due_date: yesterday });
  assert.equal(isTaskOverdue(task, NOW), true);
  assert.equal(isTaskDueToday(task, NOW), false);
});

test("upcoming: due_date strictly in the future", () => {
  const task = makeTask({ due_date: isoDaysFromNow(3) });
  assert.equal(isTaskUpcoming(task, NOW), true);
  assert.equal(isTaskOverdue(task, NOW), false);
  assert.equal(isTaskDueToday(task, NOW), false);
});

test("no due date is never upcoming", () => {
  assert.equal(isTaskUpcoming(makeTask({ due_date: null }), NOW), false);
});

// ─── classifyTaskAttention ──────────────────────────────────────────────────

test("archived-equivalent (cancelled) task never requires attention regardless of other fields", () => {
  const task = makeTask({ status: "cancelled", due_date: isoDaysFromNow(-10), owner_user_id: null, priority: "critical" });
  const result = classifyTaskAttention(task, NOW);
  assert.equal(result.requiresAttention, false);
  assert.deepEqual(result.reasons, []);
});

test("completed task never requires attention even if it was overdue when completed", () => {
  const task = makeTask({ status: "completed", due_date: isoDaysFromNow(-10), completed_at: isoDaysFromNow(-1) });
  const result = classifyTaskAttention(task, NOW);
  assert.equal(result.requiresAttention, false);
});

test("blocked task requires attention with reason 'blocked'", () => {
  const task = makeTask({ status: "blocked" });
  const result = classifyTaskAttention(task, NOW);
  assert.equal(result.requiresAttention, true);
  assert.ok(result.reasons.includes("blocked"));
});

test("unassigned task requires attention with reason 'unassigned'", () => {
  const task = makeTask({ owner_user_id: null });
  const result = classifyTaskAttention(task, NOW);
  assert.equal(result.requiresAttention, true);
  assert.deepEqual(result.reasons, ["unassigned"]);
});

test("high priority task requires attention with reason 'high_priority'", () => {
  const task = makeTask({ priority: "high" });
  const result = classifyTaskAttention(task, NOW);
  assert.ok(result.reasons.includes("high_priority"));
});

test("critical priority task also produces 'high_priority' reason (no separate critical reason)", () => {
  const task = makeTask({ priority: "critical" });
  const result = classifyTaskAttention(task, NOW);
  assert.ok(result.reasons.includes("high_priority"));
});

test("low/medium priority, assigned, no due date, not started never requires attention", () => {
  const task = makeTask({ priority: "low", owner_user_id: "user-1", due_date: null, status: "not_started" });
  assert.equal(classifyTaskAttention(task, NOW).requiresAttention, false);
});

test("multiple simultaneous reasons: overdue + blocked + unassigned all appear", () => {
  const task = makeTask({ status: "blocked", due_date: isoDaysFromNow(-3), owner_user_id: null });
  const result = classifyTaskAttention(task, NOW);
  assert.ok(result.reasons.includes("overdue"));
  assert.ok(result.reasons.includes("blocked"));
  assert.ok(result.reasons.includes("unassigned"));
});

// ─── Severity ────────────────────────────────────────────────────────────

test("severity critical: overdue and blocked", () => {
  const task = makeTask({ status: "blocked", due_date: isoDaysFromNow(-1) });
  assert.equal(classifyTaskAttention(task, NOW).severity, "critical");
});

test("severity critical: overdue and critical priority", () => {
  const task = makeTask({ status: "in_progress", due_date: isoDaysFromNow(-1), priority: "critical" });
  assert.equal(classifyTaskAttention(task, NOW).severity, "critical");
});

test("severity high: overdue alone (not blocked, not critical priority)", () => {
  const task = makeTask({ status: "in_progress", due_date: isoDaysFromNow(-1), priority: "medium" });
  assert.equal(classifyTaskAttention(task, NOW).severity, "high");
});

test("severity high: blocked alone", () => {
  const task = makeTask({ status: "blocked", priority: "low" });
  assert.equal(classifyTaskAttention(task, NOW).severity, "high");
});

test("severity high: due today with high priority", () => {
  const dueToday = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), 12).toISOString();
  const task = makeTask({ due_date: dueToday, priority: "high" });
  assert.equal(classifyTaskAttention(task, NOW).severity, "high");
});

test("severity normal: unassigned only", () => {
  const task = makeTask({ owner_user_id: null, priority: "medium" });
  assert.equal(classifyTaskAttention(task, NOW).severity, "normal");
});

test("severity normal: due today without high priority", () => {
  const dueToday = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), 12).toISOString();
  const task = makeTask({ due_date: dueToday, priority: "medium" });
  assert.equal(classifyTaskAttention(task, NOW).severity, "normal");
});

test("severity is never 'critical' as decoration — a plain not-started task is 'normal' by default computation path", () => {
  const task = makeTask({ status: "not_started", priority: "low", due_date: null, owner_user_id: "user-1" });
  const result = classifyTaskAttention(task, NOW);
  assert.equal(result.requiresAttention, false);
  assert.equal(result.severity, "normal");
});

// ─── Determinism ────────────────────────────────────────────────────────

test("classification is deterministic: same input always produces the same output", () => {
  const task = makeTask({ status: "blocked", due_date: isoDaysFromNow(-2), priority: "high", owner_user_id: null });
  const a = classifyTaskAttention(task, NOW);
  const b = classifyTaskAttention(task, NOW);
  assert.deepEqual(a, b);
});

// ─── Section placement ──────────────────────────────────────────────────

test("section: completed status always resolves to 'completed'", () => {
  const task = makeTask({ status: "completed", due_date: isoDaysFromNow(-5) });
  const attention = classifyTaskAttention(task, NOW);
  assert.equal(resolveExecutionSection(task, attention, NOW), "completed");
});

test("section: cancelled status always resolves to 'completed'", () => {
  const task = makeTask({ status: "cancelled" });
  const attention = classifyTaskAttention(task, NOW);
  assert.equal(resolveExecutionSection(task, attention, NOW), "completed");
});

test("section: attention wins over in_progress", () => {
  const task = makeTask({ status: "in_progress", due_date: isoDaysFromNow(-1) });
  const attention = classifyTaskAttention(task, NOW);
  assert.equal(resolveExecutionSection(task, attention, NOW), "needs_attention");
});

test("section: plain in_progress with no attention reasons resolves to 'in_progress'", () => {
  const task = makeTask({ status: "in_progress", priority: "low", owner_user_id: "user-1", due_date: null });
  const attention = classifyTaskAttention(task, NOW);
  assert.equal(attention.requiresAttention, false);
  assert.equal(resolveExecutionSection(task, attention, NOW), "in_progress");
});

test("section: not_started with a future due date resolves to 'upcoming'", () => {
  const task = makeTask({ status: "not_started", due_date: isoDaysFromNow(5), priority: "low", owner_user_id: "user-1" });
  const attention = classifyTaskAttention(task, NOW);
  assert.equal(resolveExecutionSection(task, attention, NOW), "upcoming");
});

test("section: not_started with no due date and no attention reasons resolves to 'backlog'", () => {
  const task = makeTask({ status: "not_started", due_date: null, priority: "low", owner_user_id: "user-1" });
  const attention = classifyTaskAttention(task, NOW);
  assert.equal(resolveExecutionSection(task, attention, NOW), "backlog");
});

// ─── Sorting ─────────────────────────────────────────────────────────────

test("sort by attention: overdue+blocked ranks before overdue-only, which ranks before blocked-only", () => {
  const overdueBlocked = makeTask({ id: "a", status: "blocked", due_date: isoDaysFromNow(-1) });
  const overdueOnly = makeTask({ id: "b", status: "in_progress", due_date: isoDaysFromNow(-1) });
  const blockedOnly = makeTask({ id: "c", status: "blocked", priority: "low" });
  const classified = classifyExecutionTasks([blockedOnly, overdueOnly, overdueBlocked], NOW);
  const sorted = sortExecutionTasks(classified, "attention");
  assert.deepEqual(sorted.map((c) => c.task.id), ["a", "b", "c"]);
});

test("sort by attention is a total, deterministic order independent of input order", () => {
  const tasks = [
    makeTask({ id: "1", status: "not_started", due_date: isoDaysFromNow(2), priority: "low" }),
    makeTask({ id: "2", status: "blocked", due_date: isoDaysFromNow(-1) }),
    makeTask({ id: "3", status: "in_progress", priority: "low", owner_user_id: "user-1" }),
  ];
  const orderA = sortExecutionTasks(classifyExecutionTasks(tasks, NOW), "attention").map((c) => c.task.id);
  const orderB = sortExecutionTasks(classifyExecutionTasks([...tasks].reverse(), NOW), "attention").map((c) => c.task.id);
  assert.deepEqual(orderA, orderB);
  assert.deepEqual(orderA, ["2", "1", "3"]);
});

test("sort by priority: critical first, low last, tie-broken by due date", () => {
  const tasks = [
    makeTask({ id: "low", priority: "low" }),
    makeTask({ id: "critical", priority: "critical" }),
    makeTask({ id: "high", priority: "high" }),
  ];
  const sorted = sortExecutionTasks(classifyExecutionTasks(tasks, NOW), "priority");
  assert.deepEqual(sorted.map((c) => c.task.id), ["critical", "high", "low"]);
});

test("sort by due_date: tasks with a due date come before tasks without one", () => {
  const tasks = [makeTask({ id: "none", due_date: null }), makeTask({ id: "soon", due_date: isoDaysFromNow(1) })];
  const sorted = sortExecutionTasks(classifyExecutionTasks(tasks, NOW), "due_date");
  assert.deepEqual(sorted.map((c) => c.task.id), ["soon", "none"]);
});

// ─── Summary ─────────────────────────────────────────────────────────────

test("summary counts are real lengths, not derived percentages", () => {
  const tasks = [
    makeTask({ id: "1", status: "blocked" }),
    makeTask({ id: "2", status: "in_progress", due_date: isoDaysFromNow(-1) }),
    makeTask({ id: "3", owner_user_id: null }),
    makeTask({ id: "4", status: "completed" }),
  ];
  const classified = classifyExecutionTasks(tasks, NOW);
  const summary = summarizeExecutionAttention(classified, NOW);
  assert.equal(summary.blocked, 1);
  assert.equal(summary.overdue, 1);
  assert.equal(summary.unassigned, 1);
  assert.equal(summary.needsAttention, 3);
  assert.equal(summary.inProgress, 1);
});

test("summary counts exclude archived-equivalent (cancelled/completed) tasks from attention buckets", () => {
  const tasks = [makeTask({ id: "1", status: "completed", due_date: isoDaysFromNow(-30) })];
  const classified = classifyExecutionTasks(tasks, NOW);
  const summary = summarizeExecutionAttention(classified, NOW);
  assert.equal(summary.overdue, 0);
  assert.equal(summary.needsAttention, 0);
});

// ─── matchesAttentionFilter agrees with the summary counters ─────────────

test("matchesAttentionFilter('overdue') agrees with isTaskOverdue for every task", () => {
  const tasks = [
    makeTask({ id: "1", due_date: isoDaysFromNow(-1) }),
    makeTask({ id: "2", due_date: isoDaysFromNow(1) }),
    makeTask({ id: "3", status: "completed", due_date: isoDaysFromNow(-1) }),
  ];
  for (const task of tasks) {
    const attention = classifyTaskAttention(task, NOW);
    assert.equal(matchesAttentionFilter(task, attention, "overdue", NOW), isTaskOverdue(task, NOW));
  }
});

test("matchesAttentionFilter('needs_attention') agrees with attention.requiresAttention", () => {
  const task = makeTask({ status: "blocked" });
  const attention = classifyTaskAttention(task, NOW);
  assert.equal(matchesAttentionFilter(task, attention, "needs_attention", NOW), true);
  assert.equal(attention.requiresAttention, true);
});
