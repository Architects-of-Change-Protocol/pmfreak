import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { resolvePreferredWorkspace } from "@/lib/workspaces/preferred-workspace";
import type { ExecutionTaskPriority, ExecutionTaskRow, ExecutionTaskStatus } from "@/lib/db/database-contract";

const TASK_COLUMNS =
  "id,workspace_id,project_id,task_draft_id,recommended_action_id,raid_item_id,title,description,status,priority,owner_user_id,owner_name,start_date,due_date,completed_at,progress_percent,acceptance_criteria,checklist,confidence_score,source_payload,created_by,created_at,updated_at";

const STATUSES: readonly ExecutionTaskStatus[] = ["not_started", "in_progress", "blocked", "completed", "cancelled"];
const PRIORITIES: readonly ExecutionTaskPriority[] = ["low", "medium", "high", "critical"];

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

export type DailyExecutionTaskRow = ExecutionTaskRow & { project_name: string };

/**
 * Workspace-wide task listing for the Daily Execution Workspace — spans
 * every project in the caller's own workspace, unlike GET
 * /api/execution-tasks which is scoped to a single project. The workspace
 * is resolved server-side from the session (resolvePreferredWorkspace),
 * never accepted from the client; an optional projectId filter is checked
 * against that resolved workspace before being applied, so a foreign
 * project id can only ever yield zero rows, never another workspace's
 * tasks.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  let userId: string;
  try {
    const { user } = await requireAuthenticatedUser();
    userId = user.id;
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthenticated.", failureClass: "unauthenticated" }, { status: 401 });
  }

  const resolution = await resolvePreferredWorkspace(userId);
  const workspaceId = resolution.workspaceId;
  if (!workspaceId) {
    return NextResponse.json({ ok: false, error: "Workspace context required.", failureClass: "validation_failed" }, { status: 400 });
  }

  try {
    await requireWorkspaceMember(workspaceId);
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ ok: false, error: "Access denied.", failureClass: "unauthorized" }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: "Authorization check failed.", failureClass: "unauthorized" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const { searchParams } = request.nextUrl;

  const { data: workspaceProjects, error: projectsError } = await supabase
    .from("projects")
    .select("id,name")
    .eq("workspace_id", workspaceId)
    .returns<Array<{ id: string; name: string }>>();

  if (projectsError) {
    return NextResponse.json({ ok: false, error: "Unable to load projects.", failureClass: "persistence_failed" }, { status: 500 });
  }

  const projectNameById = new Map((workspaceProjects ?? []).map((p) => [p.id, p.name]));
  const projectIdsInWorkspace = Array.from(projectNameById.keys());

  if (projectIdsInWorkspace.length === 0) {
    return NextResponse.json({ ok: true, data: { tasks: [], projects: [], workspaceId, hasMore: false } });
  }

  const requestedProjectId = searchParams.get("projectId");
  if (requestedProjectId && !projectNameById.has(requestedProjectId)) {
    // A projectId that does not belong to this workspace is not an error to
    // leak the existence of — it is simply not a valid filter here, so it
    // yields the empty set rather than any other workspace's tasks.
    return NextResponse.json({
      ok: true,
      data: { tasks: [], projects: Array.from(projectNameById, ([id, name]) => ({ id, name })), workspaceId, hasMore: false },
    });
  }

  let query = supabase
    .from("execution_tasks")
    .select(TASK_COLUMNS)
    .in("project_id", requestedProjectId ? [requestedProjectId] : projectIdsInWorkspace);

  const status = searchParams.get("status");
  if (status && (STATUSES as readonly string[]).includes(status)) query = query.eq("status", status);

  const priority = searchParams.get("priority");
  if (priority && (PRIORITIES as readonly string[]).includes(priority)) query = query.eq("priority", priority);

  const assigneeParam = searchParams.get("assigneeId");
  if (assigneeParam === "me") query = query.eq("owner_user_id", userId);
  else if (assigneeParam === "unassigned") query = query.is("owner_user_id", null);
  else if (assigneeParam) query = query.eq("owner_user_id", assigneeParam);

  const search = searchParams.get("search")?.trim();
  if (search) {
    const escaped = search.replace(/[%_]/g, (c) => `\\${c}`);
    const matchingProjectIds = (workspaceProjects ?? [])
      .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
      .map((p) => p.id)
      .filter((id) => !requestedProjectId || id === requestedProjectId);
    const clauses = [`title.ilike.%${escaped}%`, `description.ilike.%${escaped}%`];
    if (matchingProjectIds.length > 0) clauses.push(`project_id.in.(${matchingProjectIds.join(",")})`);
    query = query.or(clauses.join(","));
  }

  const limitParam = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_LIMIT) : DEFAULT_LIMIT;
  const cursorParam = Number.parseInt(searchParams.get("cursor") ?? "", 10);
  const offset = Number.isFinite(cursorParam) && cursorParam > 0 ? cursorParam : 0;

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit) // fetch one extra row to detect hasMore
    .returns<ExecutionTaskRow[]>();

  if (error) {
    return NextResponse.json({ ok: false, error: "Unable to load execution tasks.", failureClass: "persistence_failed" }, { status: 500 });
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const tasks: DailyExecutionTaskRow[] = page.map((task) => ({
    ...task,
    project_name: projectNameById.get(task.project_id) ?? "Unknown project",
  }));

  return NextResponse.json({
    ok: true,
    data: {
      tasks,
      projects: Array.from(projectNameById, ([id, name]) => ({ id, name })),
      workspaceId,
      hasMore,
      nextCursor: hasMore ? offset + limit : null,
    },
  });
}
