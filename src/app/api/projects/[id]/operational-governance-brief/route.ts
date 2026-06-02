import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateAndPersistOperationalGovernanceBrief } from "@/lib/projects/first-insight";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id: projectId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const requestedWorkspaceId = typeof body.workspaceId === "string" ? body.workspaceId : null;
  const supabase = await createSupabaseServerClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, workspace_id, onboarding_payload")
    .eq("id", projectId)
    .maybeSingle<{ id: string; workspace_id: string; onboarding_payload: Record<string, unknown> | null }>();

  if (error || !project) return NextResponse.json({ error: "project_not_found" }, { status: 404 });
  if (requestedWorkspaceId && requestedWorkspaceId !== project.workspace_id) {
    return NextResponse.json({ error: "workspace_mismatch" }, { status: 403 });
  }

  const result = await generateAndPersistOperationalGovernanceBrief({
    workspaceId: project.workspace_id,
    projectId: project.id,
    projectOnboardingPayload: project.onboarding_payload,
    createdBy: user.id,
    supabase,
  });

  if (!result.ok) return NextResponse.json({ error: result.error, brief: result.brief }, { status: 500 });
  return NextResponse.json({ brief: result.brief });
}
