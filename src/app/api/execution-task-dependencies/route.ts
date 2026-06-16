import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser, requireProjectAccess } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { createExecutionTaskDependency } from "@/lib/execution-tasks/dependencies/create-dependency";
import type { ExecutionTaskDependencyRow, ExecutionTaskDependencyType, ExecutionTaskDependencyStatus } from "@/lib/db/database-contract";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthenticated." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const { predecessorTaskId, successorTaskId, dependencyType, reason, lagDays, status } = body;

  if (!predecessorTaskId || typeof predecessorTaskId !== "string") {
    return NextResponse.json({ ok: false, error: "predecessorTaskId is required." }, { status: 400 });
  }
  if (!successorTaskId || typeof successorTaskId !== "string") {
    return NextResponse.json({ ok: false, error: "successorTaskId is required." }, { status: 400 });
  }

  const VALID_TYPES: ExecutionTaskDependencyType[] = [
    "finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish",
    "blocks", "gated_by", "approval_required", "external_dependency",
  ];
  if (dependencyType && !VALID_TYPES.includes(dependencyType as ExecutionTaskDependencyType)) {
    return NextResponse.json({ ok: false, error: `Invalid dependencyType. Valid: ${VALID_TYPES.join(", ")}.` }, { status: 400 });
  }

  const VALID_STATUSES = ["active", "proposed"];
  if (status && !VALID_STATUSES.includes(status as string)) {
    return NextResponse.json({ ok: false, error: "status must be active or proposed." }, { status: 400 });
  }

  const result = await createExecutionTaskDependency({
    predecessorTaskId,
    successorTaskId,
    dependencyType: dependencyType as ExecutionTaskDependencyType | undefined,
    reason: typeof reason === "string" ? reason : undefined,
    lagDays: typeof lagDays === "number" ? lagDays : undefined,
    status: status as "active" | "proposed" | undefined,
  });

  if (!result.ok) {
    const statusCode =
      result.failureClass === "unauthenticated" ? 401 :
      result.failureClass === "unauthorized" ? 403 :
      result.failureClass === "not_found" ? 404 :
      result.failureClass === "duplicate_dependency" ? 409 :
      400;
    return NextResponse.json({ ok: false, error: result.error }, { status: statusCode });
  }

  if (result.duplicate) {
    return NextResponse.json({ ok: true, dependency: result.dependency, duplicate: true }, { status: 200 });
  }
  return NextResponse.json({ ok: true, dependency: result.dependency, duplicate: false }, { status: 201 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const taskId = searchParams.get("taskId");
  const status = searchParams.get("status");
  const dependencyType = searchParams.get("dependencyType");

  if (!projectId) {
    return NextResponse.json({ ok: false, error: "projectId is required." }, { status: 400 });
  }

  try {
    await requireProjectAccess(projectId, "read");
  } catch (error) {
    if (error instanceof Error && error.message.includes("denied")) {
      return NextResponse.json({ ok: false, error: "Access denied." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: "Authorization failed." }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("execution_task_dependencies")
    .select("id,workspace_id,project_id,predecessor_task_id,successor_task_id,dependency_type,status,lag_days,reason,source_type,source_payload,confidence_score,created_by,created_at,updated_at")
    .eq("project_id", projectId);

  if (taskId) {
    query = query.or(`predecessor_task_id.eq.${taskId},successor_task_id.eq.${taskId}`);
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (dependencyType) {
    query = query.eq("dependency_type", dependencyType);
  }

  const { data, error } = await query.order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: "Unable to load dependencies." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, dependencies: (data ?? []) as ExecutionTaskDependencyRow[] });
}
