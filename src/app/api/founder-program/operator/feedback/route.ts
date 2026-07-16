import { NextRequest, NextResponse } from "next/server";
import { requireFounderProgramOperator } from "@/lib/founder-program/authz";
import { createFounderProgramDbClient } from "@/lib/founder-program/db";
import { FOUNDER_FEEDBACK_STATUSES, triageFounderFeedback, type FounderFeedbackStatus } from "@/lib/founder-program/feedback";
import { abuseDenyResponse, enforceAbuseLimit } from "@/lib/security/abuse-protection";
import { logSecurityEvent } from "@/lib/security/telemetry";
import { logger, safeErrorMessage } from "@/lib/observability/logger";

const ROUTE_ID = "/api/founder-program/operator/feedback";

// Operator triage over ALL program feedback (participants never reach this
// route). Founder/internal authorization first; triage mutations audited.
export async function GET(request: NextRequest) {
  try {
    const gate = await requireFounderProgramOperator(ROUTE_ID);
    if (!gate.ok) return gate.response;

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status");
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") ?? "50", 10) || 50));

    const client = createFounderProgramDbClient({ operation: "list_feedback", actorUserId: gate.user.id });
    let query = client
      .from("founder_feedback")
      .select(
        "id, participant_id, user_id, workspace_id, feedback_type, severity, product_area, body, allow_contact, status, internal_owner_user_id, internal_notes, resolution_ref, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (statusFilter && (FOUNDER_FEEDBACK_STATUSES as readonly string[]).includes(statusFilter)) {
      query = query.eq("status", statusFilter);
    }
    const { data, error } = await query;
    if (error) {
      logger.error("route_internal_error", { route: ROUTE_ID, error_detail: safeErrorMessage(error) });
      return NextResponse.json({ error: "Unable to list feedback." }, { status: 500 });
    }
    return NextResponse.json({ page, pageSize, feedback: data ?? [] });
  } catch (error) {
    logger.error("route_internal_error", { route: ROUTE_ID, error_detail: safeErrorMessage(error) });
    return NextResponse.json({ error: "Unable to list feedback." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireFounderProgramOperator(ROUTE_ID);
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const feedbackId = typeof body.feedbackId === "string" ? body.feedbackId.trim() : "";
  if (!feedbackId) return NextResponse.json({ error: "feedbackId is required." }, { status: 400 });

  const abuseDecision = await enforceAbuseLimit({
    scope: "founder_program.operator_feedback_triage",
    identifier: gate.user.id,
    limit: 60,
    windowSeconds: 3600,
  });
  if (!abuseDecision.allowed) return abuseDenyResponse(abuseDecision);

  try {
    const result = await triageFounderFeedback({
      feedbackId,
      operatorUserId: gate.user.id,
      status: typeof body.status === "string" ? (body.status as FounderFeedbackStatus) : undefined,
      internalOwnerUserId: typeof body.internalOwnerUserId === "string" ? body.internalOwnerUserId : body.internalOwnerUserId === null ? null : undefined,
      internalNotes: typeof body.internalNotes === "string" ? body.internalNotes : body.internalNotes === null ? null : undefined,
      resolutionRef: typeof body.resolutionRef === "string" ? body.resolutionRef : body.resolutionRef === null ? null : undefined,
    });

    await logSecurityEvent("founder_program_operator_action", {
      actorUserId: gate.user.id,
      routeId: ROUTE_ID,
      resourceType: "founder_feedback",
      resourceId: feedbackId,
      metadata: { action: "triage", ok: result.ok, code: result.code ?? null },
    });

    if (!result.ok) {
      const status = result.code === "not_found" ? 404 : 400;
      return NextResponse.json({ error: "Unable to triage this feedback.", code: result.code }, { status });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("route_internal_error", { route: ROUTE_ID, error_detail: safeErrorMessage(error) });
    return NextResponse.json({ error: "Unable to triage feedback." }, { status: 500 });
  }
}
