import { NextRequest, NextResponse } from "next/server";
import { requireFounderProgramOperator } from "@/lib/founder-program/authz";
import { listFounderProgramDecisions, recordFounderProgramDecision } from "@/lib/founder-program/decisions";
import { abuseDenyResponse, enforceAbuseLimit } from "@/lib/security/abuse-protection";
import { logSecurityEvent } from "@/lib/security/telemetry";
import { logger, safeErrorMessage } from "@/lib/observability/logger";

const ROUTE_ID = "/api/founder-program/operator/decisions";

// Program decision gate: append-only records ratified BY A HUMAN operator.
// Participant/activation counts are computed server-side from real records
// at ratification time; the route never auto-decides anything.
export async function GET() {
  try {
    const gate = await requireFounderProgramOperator(ROUTE_ID);
    if (!gate.ok) return gate.response;
    const decisions = await listFounderProgramDecisions(gate.user.id);
    return NextResponse.json({ decisions });
  } catch (error) {
    logger.error("route_internal_error", { route: ROUTE_ID, error_detail: safeErrorMessage(error) });
    return NextResponse.json({ error: "Unable to list decisions." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireFounderProgramOperator(ROUTE_ID);
  if (!gate.ok) return gate.response;

  const abuseDecision = await enforceAbuseLimit({
    scope: "founder_program.operator_decision_record",
    identifier: gate.user.id,
    limit: 10,
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
    const result = await recordFounderProgramDecision({ operatorUserId: gate.user.id, body });
    if (!result.ok) {
      const status = result.code === "invalid_input" ? 400 : 500;
      return NextResponse.json({ error: "Unable to record the decision.", code: result.code, field: result.field ?? null }, { status });
    }
    await logSecurityEvent("founder_program_operator_action", {
      actorUserId: gate.user.id,
      routeId: ROUTE_ID,
      resourceType: "founder_program_decision",
      resourceId: result.decisionId,
      metadata: { action: "record_decision" },
    });
    return NextResponse.json({ ok: true, decisionId: result.decisionId }, { status: 201 });
  } catch (error) {
    logger.error("route_internal_error", { route: ROUTE_ID, error_detail: safeErrorMessage(error) });
    return NextResponse.json({ error: "Unable to record the decision." }, { status: 500 });
  }
}
