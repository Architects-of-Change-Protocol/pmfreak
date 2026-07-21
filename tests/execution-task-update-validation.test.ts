// Task Detail — partial update validation (validateUpdateExecutionTaskInput).
//
// Pure PATCH-semantics validator: every field is optional, unknown fields
// are ignored (explicit whitelist), and a requested status must be a real
// transition from the task's current status (see lifecycle.ts).

import test from "node:test";
import assert from "node:assert/strict";
import { validateUpdateExecutionTaskInput } from "../src/lib/execution-tasks/validate-update-execution-task-input";

test("valid partial update: only title provided", () => {
  const result = validateUpdateExecutionTaskInput({ title: "Renamed task" }, "not_started");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.title, "Renamed task");
    assert.equal(Object.keys(result.data).length, 1, "must not echo untouched fields");
  }
});

test("unknown field is silently ignored, not mass-assigned", () => {
  const result = validateUpdateExecutionTaskInput({ title: "T", isAdmin: true, workspaceId: "foreign-ws" }, "not_started");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(!("isAdmin" in result.data));
    assert.ok(!("workspaceId" in result.data));
  }
});

test("empty body is valid (no-op) — caller decides whether zero fields is an error", () => {
  const result = validateUpdateExecutionTaskInput({}, "not_started");
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.data, {});
});

test("title: empty/whitespace-only is rejected", () => {
  const result = validateUpdateExecutionTaskInput({ title: "   " }, "not_started");
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((e) => e.field === "title"));
});

test("title: over max length is rejected", () => {
  const result = validateUpdateExecutionTaskInput({ title: "x".repeat(201) }, "not_started");
  assert.equal(result.ok, false);
});

test("title: trims whitespace", () => {
  const result = validateUpdateExecutionTaskInput({ title: "  Padded  " }, "not_started");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.title, "Padded");
});

test("description: null clears it", () => {
  const result = validateUpdateExecutionTaskInput({ description: null }, "not_started");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.description, null);
});

test("description: over max length is rejected", () => {
  const result = validateUpdateExecutionTaskInput({ description: "x".repeat(4001) }, "not_started");
  assert.equal(result.ok, false);
});

test("status: invalid enum value is rejected", () => {
  const result = validateUpdateExecutionTaskInput({ status: "archived" }, "not_started");
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((e) => e.field === "status"));
});

test("status: valid transition passes (not_started -> in_progress)", () => {
  const result = validateUpdateExecutionTaskInput({ status: "in_progress" }, "not_started");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.status, "in_progress");
});

test("status: invalid transition is rejected (not_started -> completed, must go through in_progress)", () => {
  const result = validateUpdateExecutionTaskInput({ status: "completed" }, "not_started");
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.find((e) => e.field === "status")?.message ?? "", /Invalid status transition/);
});

test("status: setting the same status as current is a no-op pass-through, not an invalid transition", () => {
  const result = validateUpdateExecutionTaskInput({ status: "in_progress" }, "in_progress");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.status, "in_progress");
});

test("status: transition out of a terminal status is rejected", () => {
  const result = validateUpdateExecutionTaskInput({ status: "in_progress" }, "completed");
  assert.equal(result.ok, false);
});

test("priority: invalid value is rejected", () => {
  const result = validateUpdateExecutionTaskInput({ priority: "urgent" }, "not_started");
  assert.equal(result.ok, false);
});

test("priority: every valid enum value passes", () => {
  for (const priority of ["low", "medium", "high", "critical"]) {
    const result = validateUpdateExecutionTaskInput({ priority }, "not_started");
    assert.equal(result.ok, true, `priority ${priority} should be valid`);
  }
});

test("assigneeId: null unassigns", () => {
  const result = validateUpdateExecutionTaskInput({ assigneeId: null }, "not_started");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.assigneeId, null);
});

test("assigneeId: non-string is rejected (format-level; real membership is checked server-side with I/O)", () => {
  const result = validateUpdateExecutionTaskInput({ assigneeId: 12345 }, "not_started");
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((e) => e.field === "assigneeId"));
});

test("dueDate: invalid date string is rejected", () => {
  const result = validateUpdateExecutionTaskInput({ dueDate: "not-a-date" }, "not_started");
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((e) => e.field === "dueDate"));
});

test("dueDate: null clears it", () => {
  const result = validateUpdateExecutionTaskInput({ dueDate: null }, "not_started");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.dueDate, null);
});

test("dueDate: valid date normalizes to ISO", () => {
  const result = validateUpdateExecutionTaskInput({ dueDate: "2026-09-01" }, "not_started");
  assert.equal(result.ok, true);
  if (result.ok) assert.match(result.data.dueDate!, /^2026-09-01T/);
});

test("multiple fields update together, only valid ones need to be present", () => {
  const result = validateUpdateExecutionTaskInput(
    { title: "New title", priority: "high", status: "in_progress", assigneeId: "user-2" },
    "not_started",
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.title, "New title");
    assert.equal(result.data.priority, "high");
    assert.equal(result.data.status, "in_progress");
    assert.equal(result.data.assigneeId, "user-2");
  }
});

test("one invalid field among several valid ones fails the whole update with a field-scoped error", () => {
  const result = validateUpdateExecutionTaskInput({ title: "OK", priority: "not-real" }, "not_started");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].field, "priority");
  }
});
