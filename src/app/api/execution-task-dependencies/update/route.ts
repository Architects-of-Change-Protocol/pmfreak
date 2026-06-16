import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser, requireProjectAccess } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import type { ExecutionTaskDependencyRow } from "@/lib/db/database-contract";

const VALID_TRANSITIONS: Record<string, string[]> = {
  proposed: ["active", "invalidated"],
  active: ["resolved", "invalidated"],
  resolved: ["invalidated"],
  invalidated: [],
};

const EVENT_TYPE_MAP: Record<string, string> = {
  active: "dependency_activated",
  resolved: "dependency_resolved",
  invalidated: "dependency_invalidated",
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  let userId: string;
  try {
    const { user } = await requireAuthenticatedUser();
    userId = user.id;
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthenticated." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const { dependencyId, status, reason } = body;
  if (!dependencyId || typeof dependencyId !== "string") {
    return NextResponse.json({ ok: false, error: "dependencyId is required." }, { status: 400 });
  }
  if (!status || typeof status !== "string") {
    return NextResponse.json({ ok: false, error: "status is required." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: dep, error: loadError } = await supabase
    .from("execution_task_dependencies")
    .select("id,workspace_id,project_id,predecessor_task_id,successor_task_id,dependency_type,status,lag_days,reason,source_type,source_payload,confidence_score,created_by,created_at,updated_at")
    .eq("id", dependencyId)
    .maybeSingle<ExecutionTaskDependencyRow>();

  if (loadError) {
    return NextResponse.json({ ok: false, error: "Unable to load dependency." }, { status: 500 });
  }
  if (!dep) {
    return NextResponse.json({ ok: false, error: "Dependency not found." }, { status: 404 });
  }

  try {
    await requireProjectAccess(dep.project_id, "read");
  } catch (error) {
    if (error instanceof Error && error.message.includes("denied")) {
      return NextResponse.json({ ok: false, error: "Access denied." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: "Authorization failed." }, { status: 403 });
  }

  const allowed = VALID_TRANSITIONS[dep.status] ?? [];
  if (!allowed.includes(status)) {
    return NextResponse.json(
      { ok: false, error: `Cannot transition from ${dep.status} to ${status}.` },
      { status: 400 }
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("execution_task_dependencies")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", dependencyId)
    .select("id,workspace_id,project_id,predecessor_task_id,successor_task_id,dependency_type,status,lag_days,reason,source_type,source_payload,confidence_score,created_by,created_at,updated_at")
    .single<ExecutionTaskDependencyRow>();

  if (updateError || !updated) {
    return NextResponse.json({ ok: false, error: "Unable to update dependency." }, { status: 500 });
  }

  const eventType = EVENT_TYPE_MAP[status] ?? "dependency_updated";
  await supabase.from("execution_task_events").insert({
    workspace_id: dep.workspace_id,
    project_id: dep.project_id,
    task_id: dep.predecessor_task_id,
    event_type: eventType,
    event_payload: {
      dependencyId: dep.id,
      predecessorTaskId: dep.predecessor_task_id,
      successorTaskId: dep.successor_task_id,
      dependencyType: dep.dependency_type,
      previousStatus: dep.status,
      newStatus: status,
      actorUserId: userId,
      reason: reason ?? null,
    },
    actor_user_id: userId,
  });

  return NextResponse.json({ ok: true, dependency: updated });
}
