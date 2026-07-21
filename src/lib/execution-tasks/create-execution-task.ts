import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser, requireProjectAccess } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/lib/security/access-guards";
import type { ExecutionTaskPriority, ExecutionTaskRow } from "@/lib/db/database-contract";

/**
 * Direct ("Quick Add Task") execution task creation — the canonical entity,
 * skipping the RAID → Recommended Action → Task Draft chain entirely rather
 * than fabricating a synthetic draft/recommendation to satisfy it. Manual
 * tasks are tagged in source_payload so their origin is distinguishable
 * without changing behavior (see convertTaskDraftToExecutionTask for the
 * advanced path, which this does not modify).
 */

const TASK_PRIORITIES: readonly ExecutionTaskPriority[] = ["low", "medium", "high", "critical"];
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 4000;

export function normalizeTaskPriority(value: unknown): ExecutionTaskPriority | null {
  return TASK_PRIORITIES.includes(value as ExecutionTaskPriority) ? (value as ExecutionTaskPriority) : null;
}

export type CreateExecutionTaskInput = {
  projectId: string;
  title: string;
  description?: string | null;
  assigneeId?: string | null;
  dueDate?: string | null;
  priority?: string | null;
};

export type ValidatedCreateExecutionTaskInput = {
  projectId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  priority: ExecutionTaskPriority;
};

export type CreateExecutionTaskValidationError = {
  field: "projectId" | "title" | "description" | "dueDate" | "priority";
  message: string;
};

/**
 * Pure validation — no I/O. Returns either a normalized input or a list of
 * field-level errors so the caller (API route) can render inline errors
 * rather than a single opaque failure.
 */
export function validateCreateExecutionTaskInput(
  input: unknown,
): { ok: true; data: ValidatedCreateExecutionTaskInput } | { ok: false; errors: CreateExecutionTaskValidationError[] } {
  const errors: CreateExecutionTaskValidationError[] = [];
  const body = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  if (!projectId) errors.push({ field: "projectId", message: "Project is required." });

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) errors.push({ field: "title", message: "Task title is required." });
  else if (title.length > MAX_TITLE_LENGTH) {
    errors.push({ field: "title", message: `Task title must be ${MAX_TITLE_LENGTH} characters or fewer.` });
  }

  let description: string | null = null;
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== "string") {
      errors.push({ field: "description", message: "Description must be text." });
    } else {
      const trimmed = body.description.trim();
      if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
        errors.push({ field: "description", message: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.` });
      } else {
        description = trimmed.length > 0 ? trimmed : null;
      }
    }
  }

  let assigneeId: string | null = null;
  if (body.assigneeId !== undefined && body.assigneeId !== null && body.assigneeId !== "") {
    if (typeof body.assigneeId !== "string") {
      errors.push({ field: "projectId", message: "Assignee is invalid." });
    } else {
      assigneeId = body.assigneeId.trim();
    }
  }

  let dueDate: string | null = null;
  if (body.dueDate !== undefined && body.dueDate !== null && body.dueDate !== "") {
    if (typeof body.dueDate !== "string" || Number.isNaN(Date.parse(body.dueDate))) {
      errors.push({ field: "dueDate", message: "Due date must be a valid date." });
    } else {
      dueDate = new Date(body.dueDate).toISOString();
    }
  }

  let priority: ExecutionTaskPriority = "medium";
  if (body.priority !== undefined && body.priority !== null && body.priority !== "") {
    const normalized = normalizeTaskPriority(body.priority);
    if (!normalized) errors.push({ field: "priority", message: "Priority must be one of low, medium, high, critical." });
    else priority = normalized;
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: { projectId, title, description, assigneeId, dueDate, priority },
  };
}

export type CreateExecutionTaskResult =
  | { ok: true; task: ExecutionTaskRow }
  | { ok: false; error: string; failureClass: string; fieldErrors?: CreateExecutionTaskValidationError[] };

/**
 * Creates an execution_tasks row directly, without a task_drafts row.
 * task_draft_id / recommended_action_id / raid_item_id are all null —
 * source_payload.source = "manual" is the only origin marker, distinguishing
 * this from a converted draft without changing execution_tasks' shape.
 */
export async function createExecutionTaskDirect(rawInput: unknown): Promise<CreateExecutionTaskResult> {
  const validated = validateCreateExecutionTaskInput(rawInput);
  if (!validated.ok) {
    return { ok: false, error: "Invalid task input.", failureClass: "validation_failed", fieldErrors: validated.errors };
  }
  const input = validated.data;

  let userId: string;
  try {
    const { user } = await requireAuthenticatedUser();
    userId = user.id;
  } catch {
    return { ok: false, error: "Unauthenticated.", failureClass: "unauthenticated" };
  }

  const supabase = await createSupabaseServerClient();

  // The project's own workspace_id is the authoritative tenancy scope —
  // never trust a client-supplied workspaceId for an entity that carries
  // its own (same rule as getProjectWorkspaceId).
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,workspace_id,status")
    .eq("id", input.projectId)
    .maybeSingle<{ id: string; workspace_id: string; status: string }>();

  if (projectError) {
    return { ok: false, error: "Unable to load project.", failureClass: "persistence_failed" };
  }
  if (!project) {
    return { ok: false, error: "Project not found.", failureClass: "not_found" };
  }
  if (project.status === "archived") {
    return { ok: false, error: "Cannot add tasks to an archived project.", failureClass: "invalid_state" };
  }

  try {
    await requireProjectAccess(project.id, "write");
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { ok: false, error: "Access denied.", failureClass: "unauthorized" };
    }
    return { ok: false, error: "Authorization check failed.", failureClass: "unauthorized" };
  }

  // Assignee must be a real member of this project's workspace — never a
  // foreign-workspace user, never a fabricated name.
  if (input.assigneeId) {
    const { data: membership, error: membershipError } = await supabase
      .from("workspace_memberships")
      .select("user_id")
      .eq("workspace_id", project.workspace_id)
      .eq("user_id", input.assigneeId)
      .maybeSingle<{ user_id: string }>();
    if (membershipError) {
      return { ok: false, error: "Unable to verify assignee.", failureClass: "persistence_failed" };
    }
    if (!membership) {
      return {
        ok: false,
        error: "Assignee must be a member of this workspace.",
        failureClass: "validation_failed",
        fieldErrors: [{ field: "projectId", message: "Assignee must be a member of this workspace." }],
      };
    }
  }

  const sourcePayload = { source: "manual", createdVia: "quick_add_task" };

  const { data: task, error: insertError } = await supabase
    .from("execution_tasks")
    .insert({
      workspace_id: project.workspace_id,
      project_id: project.id,
      task_draft_id: null,
      recommended_action_id: null,
      raid_item_id: null,
      title: input.title,
      description: input.description ?? "",
      status: "not_started",
      priority: input.priority,
      owner_user_id: input.assigneeId,
      due_date: input.dueDate,
      source_payload: sourcePayload,
      created_by: userId,
    })
    .select(
      "id,workspace_id,project_id,task_draft_id,recommended_action_id,raid_item_id,title,description,status,priority,owner_user_id,owner_name,start_date,due_date,completed_at,progress_percent,acceptance_criteria,checklist,confidence_score,source_payload,created_by,created_at,updated_at",
    )
    .single<ExecutionTaskRow>();

  if (insertError || !task) {
    console.error("execution_task.manual_create.failed", {
      workspaceId: project.workspace_id,
      projectId: project.id,
      error: insertError?.message ?? "insert returned no data",
    });
    return { ok: false, error: "Unable to create task.", failureClass: "persistence_failed" };
  }

  await supabase.from("execution_task_events").insert({
    workspace_id: task.workspace_id,
    project_id: task.project_id,
    task_id: task.id,
    event_type: "task_created",
    event_payload: {
      source: "manual",
      title: task.title,
      priority: task.priority,
      status: task.status,
    },
    actor_user_id: userId,
  });

  console.info("execution_task.manual_create.created", {
    workspaceId: task.workspace_id,
    projectId: task.project_id,
    taskId: task.id,
    status: task.status,
  });

  return { ok: true, task };
}
