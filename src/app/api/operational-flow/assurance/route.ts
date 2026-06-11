import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser, requireProjectAccess } from "@/lib/security/server-authorization";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId")?.trim() ?? "";
  const projectId = url.searchParams.get("projectId")?.trim() ?? "";
  if (!workspaceId || !projectId) return Response.json({ error: "workspaceId and projectId are required." }, { status: 400 });
  try {
    await requireAuthenticatedUser();
    await requireProjectAccess(projectId, "read");
    const supabase = await createSupabaseServerClient();
    const { data: project } = await supabase.from("projects").select("id").eq("id", projectId).eq("workspace_id", workspaceId).maybeSingle();
    if (!project) return Response.json({ error: "Invalid project context." }, { status: 403 });
    const { data, error } = await supabase.rpc("get_operational_assurance_summary", { p_workspace_id: workspaceId, p_project_id: projectId });
    if (error || !data) return Response.json({ error: error?.message ?? "Unable to load project assurance summary." }, { status: 500 });
    return Response.json({ assurance: data });
  } catch (error) {
    if (error instanceof AccessDeniedError) return Response.json({ error: String(error.metadata.reason) === "unauthorized" ? "Unauthorized" : "Access denied" }, { status: String(error.metadata.reason) === "unauthorized" ? 401 : 403 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load project assurance summary." }, { status: 500 });
  }
}
