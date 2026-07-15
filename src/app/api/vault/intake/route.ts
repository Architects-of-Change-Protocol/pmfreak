import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseVaultIntakeStore, ingestVaultDocument, type VaultDocumentSourceType } from "@/lib/vault/intake";

const ROUTE_ID = "/api/vault/intake";

const SOURCE_TYPES = new Set<VaultDocumentSourceType>([
  "meeting_notes",
  "transcript",
  "email",
  "project_update",
  "risk_log",
  "issue_log",
  "action_log",
  "decision_log",
  "generic_note",
]);

export type VaultIntakeDeps = {
  getAuthUser: typeof getAuthUser;
  requireWorkspaceMember: typeof requireWorkspaceMember;
  createSupabaseServerClient: typeof createSupabaseServerClient;
  ingestVaultDocument: typeof ingestVaultDocument;
};

const defaultDeps: VaultIntakeDeps = {
  getAuthUser,
  requireWorkspaceMember,
  createSupabaseServerClient,
  ingestVaultDocument,
};

/**
 * Testable core of the route handler (same DI pattern as the billing
 * routes): `deps` defaults to the real implementations; tests inject fakes
 * so the authorization ordering can be verified without a live backend.
 */
export async function handleVaultIntake(request: Request, depsOverride: Partial<VaultIntakeDeps> = {}): Promise<Response> {
  const deps: VaultIntakeDeps = { ...defaultDeps, ...depsOverride };
  const user = await deps.getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
  const projectId = typeof body.projectId === "string" ? body.projectId : null;
  const rawContent = typeof body.rawContent === "string" ? body.rawContent : "";
  const title = typeof body.title === "string" ? body.title : undefined;
  const requestedSourceType = typeof body.sourceType === "string" && SOURCE_TYPES.has(body.sourceType as VaultDocumentSourceType)
    ? body.sourceType as VaultDocumentSourceType
    : "meeting_notes";

  if (!workspaceId || !rawContent.trim()) return NextResponse.json({ error: "workspace_and_content_required" }, { status: 400 });

  // F-13 (Pilot Gate Sprint 01): explicit app-layer membership check on the
  // client-supplied workspaceId, before any DB access — defense-in-depth on
  // top of RLS, matching the pm-registry/execution-tasks route pattern.
  try {
    await deps.requireWorkspaceMember(workspaceId);
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: "workspace_access_denied" }, { status: 403 });
    }
    return safeInternalErrorResponse(ROUTE_ID, error);
  }

  const supabase = await deps.createSupabaseServerClient();
  if (projectId) {
    const { data: project, error } = await supabase
      .from("projects")
      .select("id, workspace_id")
      .eq("id", projectId)
      .maybeSingle<{ id: string; workspace_id: string }>();
    if (error || !project) return NextResponse.json({ error: "project_not_found" }, { status: 404 });
    if (project.workspace_id !== workspaceId) return NextResponse.json({ error: "workspace_mismatch" }, { status: 403 });
  }

  const result = await deps.ingestVaultDocument({
    workspaceId,
    companyId: user.companyId,
    projectId,
    rawContent,
    title,
    sourceType: requestedSourceType,
    createdBy: user.id,
    store: createSupabaseVaultIntakeStore(supabase),
  });

  const status = result.ingestionStatus === "document_persistence_failed" ? 500 : 200;
  return NextResponse.json(result, { status });
}

export async function POST(request: Request) {
  return handleVaultIntake(request);
}
