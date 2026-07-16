import { NextResponse } from "next/server";
import { reconcileFounderAgreementVersion } from "@/lib/founder-program/admission";
import { recordFounderProgramEvent } from "@/lib/founder-program/analytics";
import { requireFounderProgramParticipantContext } from "@/lib/founder-program/authz";
import { getFounderCheckpoints, reconcileFounderUsageCheckpoints, recordFounderCheckpoint } from "@/lib/founder-program/checkpoints";
import { createFounderProgramDbClient } from "@/lib/founder-program/db";
import { grantsProgramAccess, type FounderLifecycleState } from "@/lib/founder-program/lifecycle";
import { logger, safeErrorMessage } from "@/lib/observability/logger";

const ROUTE_ID = "/api/founder-program/status";

// Participant self-status: strictly self-scoped (resolved from the
// authenticated user id; internal operator fields never selected). Visiting
// while active records the first_login checkpoint (concrete product entry)
// and a return-visit analytics event for honest retention computation.
export async function GET() {
  try {
    const gate = await requireFounderProgramParticipantContext();
    if (!gate.ok) return gate.response;

    const client = createFounderProgramDbClient({ operation: "participant_status", actorUserId: gate.user.id });
    const { data: participant } = await client
      .from("founder_participants")
      .select("id, user_id, lifecycle_state, archetype, cohort, workspace_id, agreement_version_accepted, activated_at, paused_at, completed_at, created_at")
      .eq("user_id", gate.user.id)
      .maybeSingle();

    if (!participant) {
      return NextResponse.json({ participant: null, programName: gate.config.settings.displayName });
    }

    // Agreement-version change: pre-access states regress to
    // agreement_pending; access states are flagged for renewal only.
    const reconciled = await reconcileFounderAgreementVersion(
      participant as { id: string; lifecycle_state: FounderLifecycleState; agreement_version_accepted: string | null },
      gate.config.settings.requiredAgreementVersion,
      { client },
    );
    const state = (reconciled ? "agreement_pending" : participant.lifecycle_state) as FounderLifecycleState;

    if (grantsProgramAccess(state)) {
      await recordFounderCheckpoint({ participantId: participant.id, userId: gate.user.id, checkpoint: "first_login" }, { client });
      await reconcileFounderUsageCheckpoints(
        { id: participant.id, user_id: participant.user_id, workspace_id: participant.workspace_id },
        { client },
      );
      await recordFounderProgramEvent({ eventName: "founder_return_visit", participantId: participant.id });
    }

    const checkpoints = await getFounderCheckpoints(participant.id, { client });
    const agreementCurrent = participant.agreement_version_accepted === gate.config.settings.requiredAgreementVersion;

    return NextResponse.json({
      programName: gate.config.settings.displayName,
      supportContact: gate.config.settings.supportContact,
      participant: {
        state,
        archetype: participant.archetype,
        cohort: participant.cohort,
        workspaceId: participant.workspace_id,
        hasProgramAccess: grantsProgramAccess(state),
        agreement: {
          requiredVersion: gate.config.settings.requiredAgreementVersion,
          acceptedVersion: participant.agreement_version_accepted,
          current: agreementCurrent,
          renewalRequired: grantsProgramAccess(state) && !agreementCurrent,
        },
        checkpoints,
        feedbackEnabled: gate.config.flags.feedbackEnabled,
      },
    });
  } catch (error) {
    logger.error("route_internal_error", { route: ROUTE_ID, error_detail: safeErrorMessage(error) });
    return NextResponse.json({ error: "Unable to load the program status." }, { status: 500 });
  }
}
