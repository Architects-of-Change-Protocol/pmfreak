import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireProjectAccess } from "@/lib/security/server-authorization";
import { createEvidenceItem, getOperationalSummary, recordHumanDecision, runEvidenceDecisionChain } from "@/lib/operational-flow/operational-flow-service";

const ROUTE_ID = "/api/operational-flow";
const SOURCE_TYPES = new Set(["manual_note", "email", "meeting_minutes", "ticket", "conversation", "document_reference"]);
const DECISION_STATUSES = new Set(["accepted", "rejected", "modified", "escalated", "needs_more_evidence"]);

async function authorize(projectId: string, workspaceId: string, permission: "read" | "write") {
  let userId: string | null = null;
  try {
    const { user } = await requireAuthenticatedUser();
    userId = user.id;
    await requireProjectAccess(projectId, permission);
    const supabase = await createSupabaseServerClient();
    const [{ data: project }, { data: membership }] = await Promise.all([
      supabase.from("projects").select("workspace_id").eq("id", projectId).eq("workspace_id", workspaceId).maybeSingle(),
      supabase.from("workspace_memberships").select("role").eq("workspace_id", workspaceId).eq("user_id", user.id).maybeSingle(),
    ]);
    if (!project || !membership?.role) throw new AccessDeniedError("Project workspace mismatch.", { reason: "project_scope_violation" });
    if (permission === "write" && !["owner", "admin", "pm"].includes(String(membership.role))) {
      throw new AccessDeniedError("Operational write role denied.", { reason: "role_missing_write_permission" });
    }
    return { user, supabase, role: String(membership.role) };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") return denyResponse({ status: 401, routeId: ROUTE_ID, message: "Unauthorized", reason: "unauthorized" });
      return denyFromAccessError(error, { status: 403, routeId: ROUTE_ID, message: "Operational flow access denied.", actorUserId: userId, workspaceId, projectId, requestedPermission: permission, deniedPermission: permission, eventType: "project_scope_violation" });
    }
    throw error;
  }
}

function scopeFromUrl(request: Request) {
  const url = new URL(request.url);
  return { workspaceId: url.searchParams.get("workspaceId")?.trim() ?? "", projectId: url.searchParams.get("projectId")?.trim() ?? "" };
}

export async function GET(request: Request) {
  const { workspaceId, projectId } = scopeFromUrl(request);
  if (!workspaceId || !projectId) return Response.json({ error: "workspaceId and projectId are required." }, { status: 400 });
  const authorized = await authorize(projectId, workspaceId, "read");
  if (authorized instanceof Response) return authorized;
  try {
    return Response.json(await getOperationalSummary(authorized.supabase, workspaceId, projectId, authorized.user.id));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load operational flow." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: "Malformed JSON body." }, { status: 400 }); }
  const workspaceId = String(body.workspaceId ?? "").trim();
  const projectId = String(body.projectId ?? "").trim();
  const operation = String(body.operation ?? "").trim();
  if (!workspaceId || !projectId || !operation) return Response.json({ error: "workspaceId, projectId and operation are required." }, { status: 400 });
  if (!["create_evidence", "run_chain", "record_decision"].includes(operation)) return Response.json({ error: "Unsupported public operation." }, { status: 400 });
  const authorized = await authorize(projectId, workspaceId, "write");
  if (authorized instanceof Response) return authorized;
  const scope = { workspaceId, projectId, userId: authorized.user.id, role: authorized.role };

  try {
    if (operation === "create_evidence") {
      const sourceType = String(body.sourceType ?? "");
      if (!SOURCE_TYPES.has(sourceType)) return Response.json({ error: "Invalid sourceType." }, { status: 400 });
      return Response.json({ evidence: await createEvidenceItem(authorized.supabase, scope, {
        sourceType: sourceType as "manual_note" | "email" | "meeting_minutes" | "ticket" | "conversation" | "document_reference",
        title: String(body.title ?? ""), content: String(body.content ?? ""), sourceReference: body.sourceReference ? String(body.sourceReference) : null,
        confidenceLevel: (["low", "medium", "high"].includes(String(body.confidenceLevel)) ? String(body.confidenceLevel) : "medium") as "low" | "medium" | "high",
        metadata: body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata as Record<string, unknown> : {},
      }) }, { status: 201 });
    }
    if (operation === "run_chain") return Response.json(await runEvidenceDecisionChain(authorized.supabase, scope, String(body.evidenceItemId ?? "")));
    const decisionStatus = String(body.decisionStatus ?? "");
    if (!DECISION_STATUSES.has(decisionStatus)) return Response.json({ error: "Invalid decisionStatus." }, { status: 400 });
    return Response.json(await recordHumanDecision(authorized.supabase, scope, {
      recommendationId: body.recommendationId ? String(body.recommendationId) : null,
      manualEvidenceItemId: body.manualEvidenceItemId ? String(body.manualEvidenceItemId) : null,
      decision: String(body.decision ?? ""), decisionStatus: decisionStatus as "accepted" | "rejected" | "modified" | "escalated" | "needs_more_evidence",
      rationale: String(body.rationale ?? ""),
    }), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Operational flow failed.";
    const status = /denied|authority|access/.test(message) ? 403 : /required|mismatch|invalid|not_found|incomplete/.test(message) ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
