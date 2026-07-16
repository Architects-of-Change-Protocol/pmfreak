import { NextRequest, NextResponse } from "next/server";
import {
  activateFounderParticipant,
  applyFounderLifecycleAction,
  reviewFounderParticipant,
  setFounderParticipantInternalFields,
  type FounderLifecycleAction,
  type FounderReviewDecision,
} from "@/lib/founder-program/admission";
import { founderProgramFeatureDisabledResponse, requireFounderProgramOperator } from "@/lib/founder-program/authz";
import { abuseDenyResponse, enforceAbuseLimit } from "@/lib/security/abuse-protection";
import { logSecurityEvent } from "@/lib/security/telemetry";
import { logger, safeErrorMessage } from "@/lib/observability/logger";

const ROUTE_ID = "/api/founder-program/operator/participants/actions";

const REVIEW_ACTIONS: readonly FounderReviewDecision[] = ["start_review", "approve", "reject", "waitlist"];
const LIFECYCLE_ACTIONS: readonly FounderLifecycleAction[] = ["pause", "resume", "revoke", "complete"];

const failureStatus: Record<string, number> = {
  participant_not_found: 404,
  capacity_reached: 409,
  state_conflict: 409,
  reason_required: 400,
  invalid_transition: 409,
  actor_not_allowed: 403,
  terminal_state: 409,
  not_ready_for_activation: 409,
  agreement_not_accepted: 409,
  no_bound_user: 409,
};

// Every operator mutation on a participant flows through this route:
// founder/internal authorization first (before body parse), explicit action
// allowlist, per-operator rate limit, and a security event per action. The
// underlying transition policy + capacity RPC do the state enforcement.
export async function POST(request: NextRequest) {
  const gate = await requireFounderProgramOperator(ROUTE_ID);
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const action = String(body.action ?? "");
  const participantId = typeof body.participantId === "string" ? body.participantId.trim() : "";
  if (!participantId) {
    return NextResponse.json({ error: "participantId is required." }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason : null;

  const abuseDecision = await enforceAbuseLimit({
    scope: "founder_program.operator_participant_action",
    action,
    identifier: gate.user.id,
    limit: 60,
    windowSeconds: 3600,
  });
  if (!abuseDecision.allowed) return abuseDenyResponse(abuseDecision);

  try {
    let outcome: { ok: boolean; code?: string; extra?: Record<string, unknown> };

    if ((REVIEW_ACTIONS as readonly string[]).includes(action)) {
      const result = await reviewFounderParticipant({
        participantId,
        operatorUserId: gate.user.id,
        decision: action as FounderReviewDecision,
        reason,
        capacityOverride: body.capacityOverride === true,
      });
      outcome = result.ok ? { ok: true, extra: { state: result.state } } : { ok: false, code: result.code };
    } else if (action === "activate") {
      if (!gate.config.flags.activationEnabled) {
        return founderProgramFeatureDisabledResponse("activationEnabled");
      }
      const result = await activateFounderParticipant({
        participantId,
        operatorUserId: gate.user.id,
        settings: gate.config.settings,
      });
      outcome = result.ok
        ? { ok: true, extra: { workspaceId: result.workspaceId, alreadyActive: result.alreadyActive, state: "onboarding_active" } }
        : { ok: false, code: result.code };
    } else if ((LIFECYCLE_ACTIONS as readonly string[]).includes(action)) {
      const result = await applyFounderLifecycleAction({
        participantId,
        operatorUserId: gate.user.id,
        action: action as FounderLifecycleAction,
        reason,
      });
      outcome = result.ok ? { ok: true, extra: { state: result.state } } : { ok: false, code: result.code };
    } else if (action === "set_internal_fields") {
      const result = await setFounderParticipantInternalFields({
        participantId,
        operatorUserId: gate.user.id,
        internalOwnerUserId: typeof body.internalOwnerUserId === "string" ? body.internalOwnerUserId : body.internalOwnerUserId === null ? null : undefined,
        cohort: typeof body.cohort === "string" ? body.cohort : body.cohort === null ? null : undefined,
      });
      outcome = result.ok ? { ok: true } : { ok: false, code: "update_failed" };
    } else {
      return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    }

    await logSecurityEvent("founder_program_operator_action", {
      actorUserId: gate.user.id,
      routeId: ROUTE_ID,
      resourceType: "founder_participant",
      resourceId: participantId,
      metadata: { action, ok: outcome.ok, code: outcome.code ?? null },
    });

    if (!outcome.ok) {
      const status = failureStatus[outcome.code ?? ""] ?? 400;
      return NextResponse.json({ error: "The action could not be applied.", code: outcome.code }, { status });
    }
    return NextResponse.json({ ok: true, ...(outcome.extra ?? {}) });
  } catch (error) {
    logger.error("route_internal_error", { route: ROUTE_ID, error_detail: safeErrorMessage(error) });
    return NextResponse.json({ error: "Unable to perform the participant action." }, { status: 500 });
  }
}
