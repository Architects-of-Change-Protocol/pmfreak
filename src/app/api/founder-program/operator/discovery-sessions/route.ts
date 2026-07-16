import { NextRequest, NextResponse } from "next/server";
import { requireFounderProgramOperator } from "@/lib/founder-program/authz";
import { listFounderDiscoverySessions, recordFounderDiscoverySession } from "@/lib/founder-program/discovery";
import { abuseDenyResponse, enforceAbuseLimit } from "@/lib/security/abuse-protection";
import { logSecurityEvent } from "@/lib/security/telemetry";
import { logger, safeErrorMessage } from "@/lib/observability/logger";

const ROUTE_ID = "/api/founder-program/operator/discovery-sessions";

// Operator-recorded discovery evidence. No recordings are uploaded or
// stored — evidence_ref is a reference only, and consent status is explicit.
export async function GET(request: NextRequest) {
  try {
    const gate = await requireFounderProgramOperator(ROUTE_ID);
    if (!gate.ok) return gate.response;
    const url = new URL(request.url);
    const sessions = await listFounderDiscoverySessions({
      operatorUserId: gate.user.id,
      participantId: url.searchParams.get("participantId"),
    });
    return NextResponse.json({ sessions });
  } catch (error) {
    logger.error("route_internal_error", { route: ROUTE_ID, error_detail: safeErrorMessage(error) });
    return NextResponse.json({ error: "Unable to list discovery sessions." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireFounderProgramOperator(ROUTE_ID);
  if (!gate.ok) return gate.response;

  const abuseDecision = await enforceAbuseLimit({
    scope: "founder_program.operator_discovery_record",
    identifier: gate.user.id,
    limit: 30,
    windowSeconds: 3600,
  });
  if (!abuseDecision.allowed) return abuseDenyResponse(abuseDecision);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  try {
    const result = await recordFounderDiscoverySession({ operatorUserId: gate.user.id, body });
    if (!result.ok) {
      const status = result.code === "participant_not_found" ? 404 : result.code === "invalid_input" ? 400 : 500;
      return NextResponse.json({ error: "Unable to record the session.", code: result.code, field: result.field ?? null }, { status });
    }
    await logSecurityEvent("founder_program_operator_action", {
      actorUserId: gate.user.id,
      routeId: ROUTE_ID,
      resourceType: "founder_discovery_session",
      resourceId: result.sessionId,
      metadata: { action: "record" },
    });
    return NextResponse.json({ ok: true, sessionId: result.sessionId }, { status: 201 });
  } catch (error) {
    logger.error("route_internal_error", { route: ROUTE_ID, error_detail: safeErrorMessage(error) });
    return NextResponse.json({ error: "Unable to record the session." }, { status: 500 });
  }
}
