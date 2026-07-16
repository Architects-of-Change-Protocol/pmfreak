import { NextRequest, NextResponse } from "next/server";
import { requireFounderProgramParticipantContext } from "@/lib/founder-program/authz";
import { recordFounderCheckpoint } from "@/lib/founder-program/checkpoints";
import { markFounderInvitationViewed, resolveFounderInvitationByToken } from "@/lib/founder-program/invitations";
import { abuseDenyResponse, buildAbuseKey, enforceAbuseLimit, getClientIp } from "@/lib/security/abuse-protection";
import { logger, safeErrorMessage } from "@/lib/observability/logger";

// Participant-facing invitation resolution. Authentication is required (the
// token is NOT a session — Perilla-style bearer-credential hygiene); the
// invitation email must match the authenticated account before any
// invitation details beyond a generic validity signal are returned.
// Unknown, revoked, and expired tokens are indistinguishable to the caller
// (enumeration resistance) and additionally rate-limited per IP+token.
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const gate = await requireFounderProgramParticipantContext();
    if (!gate.ok) return gate.response;

    const { token } = await params;
    const abuseDecision = await enforceAbuseLimit({
      scope: "founder_program.invitation_view",
      identifier: buildAbuseKey([getClientIp(request), token.slice(0, 16)]),
      limit: 30,
      windowSeconds: 3600,
    });
    if (!abuseDecision.allowed) return abuseDenyResponse(abuseDecision);

    const resolved = await resolveFounderInvitationByToken(token);
    if (!resolved || resolved.status === "revoked" || resolved.status === "expired") {
      return NextResponse.json({ error: "This invitation link is invalid or has expired.", code: "invalid_or_expired" }, { status: 404 });
    }

    const emailMatches = resolved.email === (gate.user.email ?? "").trim().toLowerCase();
    if (emailMatches && resolved.status === "pending") {
      await markFounderInvitationViewed(resolved);
      await recordFounderCheckpoint({ participantId: resolved.participantId, userId: gate.user.id, checkpoint: "invite_opened" });
    }

    const applicationsOpen = gate.config.flags.applicationsEnabled && gate.config.settings.applicationsEnabled;
    return NextResponse.json({
      programName: gate.config.settings.displayName,
      supportContact: gate.config.settings.supportContact,
      status: resolved.status === "pending" ? "viewed" : resolved.status,
      participantState: resolved.participantState === "invited" ? "invite_viewed" : resolved.participantState,
      expiresAt: resolved.expiresAt,
      emailMatches,
      canApply: emailMatches && applicationsOpen && ["pending", "viewed"].includes(resolved.status),
      applicationsOpen,
    });
  } catch (error) {
    logger.error("route_internal_error", { route: "/api/founder-program/invitation/[token]", error_detail: safeErrorMessage(error) });
    return NextResponse.json({ error: "Unable to resolve this invitation right now." }, { status: 500 });
  }
}
