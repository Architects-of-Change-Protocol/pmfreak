import { NextRequest, NextResponse } from "next/server";
import { founderProgramFeatureDisabledResponse, requireFounderProgramParticipantContext } from "@/lib/founder-program/authz";
import { listOwnFounderFeedback, submitFounderFeedback, validateFounderFeedbackInput } from "@/lib/founder-program/feedback";
import { abuseDenyResponse, enforceAbuseLimit } from "@/lib/security/abuse-protection";
import { logger, safeErrorMessage } from "@/lib/observability/logger";

const ROUTE_ID = "/api/founder-program/feedback";

// Participant feedback: submissions are validated with bounded enums and
// hard caps; reads are strictly self-scoped (the participant sees only their
// own rows, and never the internal triage fields — enforced by the query
// projection here, by RLS, and by the column-scoped grant).
export async function GET() {
  try {
    const gate = await requireFounderProgramParticipantContext();
    if (!gate.ok) return gate.response;
    if (!gate.config.flags.feedbackEnabled) return founderProgramFeatureDisabledResponse("feedbackEnabled");
    const feedback = await listOwnFounderFeedback(gate.user.id);
    return NextResponse.json({ feedback });
  } catch (error) {
    logger.error("route_internal_error", { route: ROUTE_ID, error_detail: safeErrorMessage(error) });
    return NextResponse.json({ error: "Unable to load feedback." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireFounderProgramParticipantContext();
    if (!gate.ok) return gate.response;
    if (!gate.config.flags.feedbackEnabled) return founderProgramFeatureDisabledResponse("feedbackEnabled");

    const abuseDecision = await enforceAbuseLimit({
      scope: "founder_program.feedback_submit",
      identifier: gate.user.id,
      limit: 20,
      windowSeconds: 3600,
    });
    if (!abuseDecision.allowed) return abuseDenyResponse(abuseDecision);

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
    }

    const validation = validateFounderFeedbackInput(body);
    if (!validation.ok) {
      return NextResponse.json(
        { error: "Feedback validation failed.", code: "invalid_feedback", field: validation.field, problem: validation.problem },
        { status: 400 },
      );
    }

    const result = await submitFounderFeedback({ userId: gate.user.id, feedback: validation.value });
    if (!result.ok) {
      if (result.code === "not_a_participant") {
        return NextResponse.json({ error: "No founder program record found for this account.", code: "not_a_participant" }, { status: 404 });
      }
      if (result.code === "not_eligible") {
        return NextResponse.json({ error: "Feedback is not available from the current program state.", code: "not_eligible" }, { status: 409 });
      }
      return NextResponse.json({ error: "Unable to submit feedback right now." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, feedbackId: result.feedbackId }, { status: 201 });
  } catch (error) {
    logger.error("route_internal_error", { route: ROUTE_ID, error_detail: safeErrorMessage(error) });
    return NextResponse.json({ error: "Unable to submit feedback right now." }, { status: 500 });
  }
}
