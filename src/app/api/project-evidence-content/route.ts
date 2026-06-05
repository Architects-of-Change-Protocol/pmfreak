import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireProjectAccess } from "@/lib/security/server-authorization";
import { countWords } from "@/lib/project-evidence/evidence-processor";

type EvidenceContentRow = {
  id: string;
  evidence_id: string;
  project_id: string;
  workspace_id: string;
  source_file_name: string;
  source_file_type: string;
  source_uploaded_at: string;
  source_uploaded_by: string | null;
  extracted_text: string;
  content_hash: string;
  extraction_method: string;
  processing_started_at: string;
  processing_completed_at: string;
  created_at: string;
  updated_at: string;
  word_count: number;
  processing_duration_ms: number;
};

const normalizeProjectId = (request: Request) => new URL(request.url).searchParams.get("projectId")?.trim() ?? "";

export async function GET(request: Request) {
  let userId: string | null = null;
  const projectId = normalizeProjectId(request);

  if (!projectId) {
    return Response.json({ error: "projectId is required." }, { status: 400 });
  }

  try {
    const { user } = await requireAuthenticatedUser();
    userId = user.id;
    await requireProjectAccess(projectId, "read");
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: "/api/project-evidence-content", message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, {
        status: 403,
        routeId: "/api/project-evidence-content",
        message: "Invalid project context.",
        actorUserId: userId,
        projectId,
        requestedPermission: "read",
        deniedPermission: "read",
        eventType: "project_scope_violation",
      });
    }
    throw error;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("project_evidence_content")
    .select("id,evidence_id,project_id,workspace_id,source_file_name,source_file_type,source_uploaded_at,source_uploaded_by,extracted_text,content_hash,extraction_method,processing_started_at,processing_completed_at,created_at,updated_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: "Unable to load project evidence content." }, { status: 500 });
  }

  const content = (data ?? []).map((row) => ({
    ...row,
    word_count: countWords(row.extracted_text ?? ""),
    processing_duration_ms: Math.max(0, new Date(row.processing_completed_at).getTime() - new Date(row.processing_started_at).getTime()),
  })) as EvidenceContentRow[];

  return Response.json({ content });
}
