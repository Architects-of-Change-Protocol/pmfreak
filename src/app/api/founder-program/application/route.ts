import { NextRequest, NextResponse } from "next/server";
import { submitFounderApplication, validateFounderApplicationInput } from "@/lib/founder-program/applications";
import { founderProgramFeatureDisabledResponse, requireFounderProgramParticipantContext } from "@/lib/founder-program/authz";
import { abuseDenyResponse, enforceAbuseLimit } from "@/lib/security/abuse-protection";
import { logger, safeErrorMessage } from "@/lib/observability/logger";

// Invite-bound application intake. Authorization/config gates run before the
// body is parsed; all fields are validated server-side with bounded enums
// and hard length caps (docs/founder-program/02). The invitation token in
// the body proves invitation possession only — identity comes exclusively
// from the authenticated session, and the invitation email must match it.
export async function POST(request: NextRequest) {
  try {
    const gate = await requireFounderProgramParticipantContext();
    if (!gate.ok) return gate.response;
    if (!gate.config.flags.applicationsEnabled || !gate.config.settings.applicationsEnabled) {
      return founderProgramFeatureDisabledResponse("applicationsEnabled");
    }

    const abuseDecision = await enforceAbuseLimit({
      scope: "founder_program.application_submit",
      identifier: gate.user.id,
      limit: 5,
      windowSeconds: 3600,
    });
    if (!abuseDecision.allowed) return abuseDenyResponse(abuseDecision);

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
    }

    const token = typeof body.token === "string" ? body.token : "";
    if (!token) {
      return NextResponse.json({ error: "An invitation token is required.", code: "missing_token" }, { status: 400 });
    }

    const validation = validateFounderApplicationInput(body);
    if (!validation.ok) {
      return NextResponse.json(
        { error: "Application validation failed.", code: "invalid_application", field: validation.field, problem: validation.problem },
        { status: 400 },
      );
    }

    const result = await submitFounderApplication({
      token,
      userId: gate.user.id,
      userEmail: gate.user.email ?? "",
      application: validation.value,
    });

    if (!result.ok) {
      switch (result.code) {
        case "invalid_or_expired_invitation":
          return NextResponse.json({ error: "This invitation link is invalid or has expired.", code: "invalid_or_expired" }, { status: 404 });
        case "email_mismatch":
          return NextResponse.json({ error: "This invitation was issued to a different email address.", code: "email_mismatch" }, { status: 403 });
        case "already_applied":
          return NextResponse.json({ error: "An application was already submitted for this invitation.", code: "already_applied" }, { status: 409 });
        case "user_already_bound":
          return NextResponse.json({ error: "This account is already associated with a founder program record.", code: "already_participant" }, { status: 409 });
        default:
          return NextResponse.json({ error: "Unable to submit the application right now." }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, state: "applied" }, { status: 201 });
  } catch (error) {
    logger.error("route_internal_error", { route: "/api/founder-program/application", error_detail: safeErrorMessage(error) });
    return NextResponse.json({ error: "Unable to submit the application right now." }, { status: 500 });
  }
}
