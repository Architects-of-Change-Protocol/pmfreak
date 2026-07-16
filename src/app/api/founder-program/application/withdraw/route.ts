import { NextResponse } from "next/server";
import { withdrawFounderApplication } from "@/lib/founder-program/applications";
import { requireFounderProgramParticipantContext } from "@/lib/founder-program/authz";
import { abuseDenyResponse, enforceAbuseLimit } from "@/lib/security/abuse-protection";
import { logger, safeErrorMessage } from "@/lib/observability/logger";

// Participant-driven withdrawal — allowed before and after approval
// (docs/founder-program/03). Self-scoped: the participant record is resolved
// from the authenticated user id only; no body fields are trusted.
export async function POST() {
  try {
    const gate = await requireFounderProgramParticipantContext();
    if (!gate.ok) return gate.response;

    const abuseDecision = await enforceAbuseLimit({
      scope: "founder_program.application_withdraw",
      identifier: gate.user.id,
      limit: 5,
      windowSeconds: 3600,
    });
    if (!abuseDecision.allowed) return abuseDenyResponse(abuseDecision);

    const result = await withdrawFounderApplication({ userId: gate.user.id });
    if (!result.ok) {
      if (result.code === "not_a_participant") {
        return NextResponse.json({ error: "No founder program record found for this account.", code: "not_a_participant" }, { status: 404 });
      }
      return NextResponse.json({ error: "Participation cannot be withdrawn from its current state.", code: "not_withdrawable" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, state: "withdrawn" });
  } catch (error) {
    logger.error("route_internal_error", { route: "/api/founder-program/application/withdraw", error_detail: safeErrorMessage(error) });
    return NextResponse.json({ error: "Unable to withdraw right now." }, { status: 500 });
  }
}
