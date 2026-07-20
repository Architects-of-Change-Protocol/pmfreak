import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireProjectAccess } from "@/lib/security/server-authorization";
import { getProjectWorkspaceId } from "@/lib/projects/project-admin-service";
import { createDecision, listProjectDecisions, submitDecision } from "@/lib/decision-governance/service";
import type { DecisionEvidenceRelationship, DecisionType } from "@/lib/decision-governance/types";

const ROUTE_ID = "/api/projects/[id]/decisions";

async function authorize(projectId: string, permission: "read" | "write") {
  const { user } = await requireAuthenticatedUser();
  await requireProjectAccess(projectId, permission);
  return user;
}

function deny(error: unknown, projectId: string, userId: string | null, permission: "read" | "write") {
  if (error instanceof AccessDeniedError) {
    if (String(error.metadata.reason) === "unauthorized") {
      return denyResponse({ status: 401, routeId: ROUTE_ID, message: "Unauthorized", reason: "unauthorized" });
    }
    return denyFromAccessError(error, {
      status: 403,
      routeId: ROUTE_ID,
      message: "Invalid project context.",
      actorUserId: userId,
      projectId,
      requestedPermission: permission,
      deniedPermission: permission,
      eventType: "project_scope_violation",
    });
  }
  throw error;
}

/** ListDecisions (06-query-catalog.md) — Strong consistency (Decision status). */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await context.params;
  let userId: string | null = null;
  try {
    const user = await authorize(projectId, "read");
    userId = user.id;
  } catch (error) {
    return deny(error, projectId, userId, "read");
  }

  const result = await listProjectDecisions(projectId);
  if (!result.ok) return Response.json({ error: result.error }, { status: 500 });
  return Response.json({ decisions: result.data });
}

/**
 * RecordDecision (06-command-catalog.md) — adapter over the real,
 * previously-unwired decision-governance service. Creates the Decision in
 * draft, links evidence, then submits it for review so it appears in the
 * Command Center's Pending Decisions zone immediately.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await context.params;
  let userId: string | null = null;
  try {
    const user = await authorize(projectId, "write");
    userId = user.id;
  } catch (error) {
    return deny(error, projectId, userId, "write");
  }

  const body = (await request.json().catch(() => null)) as {
    decisionType?: DecisionType;
    title?: string;
    summary?: string;
    decisionRationale?: string | null;
    recommendationId?: string | null;
    evidenceLinks?: Array<{ evidenceId: string; evidenceType: string; relationshipType: DecisionEvidenceRelationship }>;
  } | null;

  if (!body?.decisionType || !body.title || !body.summary) {
    return Response.json({ error: "decisionType, title, and summary are required." }, { status: 400 });
  }

  const workspaceId = await getProjectWorkspaceId(projectId);
  if (!workspaceId) {
    return Response.json({ error: "Project not found." }, { status: 404 });
  }

  const created = await createDecision({
    workspaceId,
    projectId,
    decisionType: body.decisionType,
    title: body.title,
    summary: body.summary,
    createdBy: userId!,
    decisionRationale: body.decisionRationale ?? null,
    recommendationId: body.recommendationId ?? null,
    evidenceLinks: body.evidenceLinks,
  });
  if (!created.ok) return Response.json({ error: created.error }, { status: 422 });

  const submitted = await submitDecision(created.data.id, userId!);
  if (!submitted.ok) return Response.json({ error: submitted.error }, { status: 422 });

  return Response.json({ decision: submitted.data }, { status: 201 });
}
