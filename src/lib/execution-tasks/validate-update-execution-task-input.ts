import { isValidStatusTransition } from "./lifecycle";
import { normalizeTaskPriority } from "./create-execution-task";
import type { ExecutionTaskPriority, ExecutionTaskStatus } from "@/lib/db/database-contract";

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 4000;

const STATUSES: readonly ExecutionTaskStatus[] = ["not_started", "in_progress", "blocked", "completed", "cancelled"];

export type UpdateExecutionTaskField = "title" | "description" | "status" | "priority" | "assigneeId" | "dueDate";

export type ValidatedUpdateExecutionTaskInput = {
  title?: string;
  description?: string | null;
  status?: ExecutionTaskStatus;
  priority?: ExecutionTaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
};

export type UpdateExecutionTaskValidationError = { field: UpdateExecutionTaskField; message: string };

/**
 * Pure partial-update validator for Task Detail edits. Every field is
 * optional (PATCH semantics) — only fields present on the raw input are
 * validated and echoed back, so an omitted field is left untouched by the
 * caller. Unknown fields are silently ignored (explicit whitelist below),
 * never mass-assigned into the update.
 *
 * currentStatus is required to validate a requested status transition
 * against the domain's real state machine (see lifecycle.ts) — this stays
 * a pure function since currentStatus is just another input, not I/O.
 */
export function validateUpdateExecutionTaskInput(
  input: unknown,
  currentStatus: ExecutionTaskStatus,
): { ok: true; data: ValidatedUpdateExecutionTaskInput } | { ok: false; errors: UpdateExecutionTaskValidationError[] } {
  const errors: UpdateExecutionTaskValidationError[] = [];
  const body = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const data: ValidatedUpdateExecutionTaskInput = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string") {
      errors.push({ field: "title", message: "Title must be text." });
    } else {
      const trimmed = body.title.trim();
      if (!trimmed) errors.push({ field: "title", message: "Task title is required." });
      else if (trimmed.length > MAX_TITLE_LENGTH) errors.push({ field: "title", message: `Task title must be ${MAX_TITLE_LENGTH} characters or fewer.` });
      else data.title = trimmed;
    }
  }

  if (body.description !== undefined) {
    if (body.description === null) {
      data.description = null;
    } else if (typeof body.description !== "string") {
      errors.push({ field: "description", message: "Description must be text." });
    } else {
      const trimmed = body.description.trim();
      if (trimmed.length > MAX_DESCRIPTION_LENGTH) errors.push({ field: "description", message: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.` });
      else data.description = trimmed;
    }
  }

  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !STATUSES.includes(body.status as ExecutionTaskStatus)) {
      errors.push({ field: "status", message: "Status must be one of not_started, in_progress, blocked, completed, cancelled." });
    } else {
      const nextStatus = body.status as ExecutionTaskStatus;
      if (nextStatus !== currentStatus && !isValidStatusTransition(currentStatus, nextStatus)) {
        errors.push({ field: "status", message: `Invalid status transition: ${currentStatus} → ${nextStatus}.` });
      } else {
        data.status = nextStatus;
      }
    }
  }

  if (body.priority !== undefined) {
    const normalized = normalizeTaskPriority(body.priority);
    if (!normalized) errors.push({ field: "priority", message: "Priority must be one of low, medium, high, critical." });
    else data.priority = normalized;
  }

  if (body.assigneeId !== undefined) {
    if (body.assigneeId === null || body.assigneeId === "") {
      data.assigneeId = null;
    } else if (typeof body.assigneeId !== "string") {
      errors.push({ field: "assigneeId", message: "Assignee is invalid." });
    } else {
      data.assigneeId = body.assigneeId.trim();
    }
  }

  if (body.dueDate !== undefined) {
    if (body.dueDate === null || body.dueDate === "") {
      data.dueDate = null;
    } else if (typeof body.dueDate !== "string" || Number.isNaN(Date.parse(body.dueDate))) {
      errors.push({ field: "dueDate", message: "Due date must be a valid date." });
    } else {
      data.dueDate = new Date(body.dueDate).toISOString();
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data };
}
