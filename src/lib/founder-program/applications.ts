/**
 * Founder Circle Program — invite-bound application intake.
 *
 * All input is validated server-side with bounded enums and hard length
 * caps (docs/founder-program/02). Submission binds the authenticated user to
 * the participant record after an email-binding check (the invitation email
 * must match the authenticated account — early-access precedent).
 * Participants cannot approve themselves, edit after submission, or touch
 * review fields; withdrawal is allowed before and after approval.
 */
import { recordFounderProgramEvent } from "@/lib/founder-program/analytics";
import { recordFounderCheckpoint } from "@/lib/founder-program/checkpoints";
import { createFounderProgramDbClient } from "@/lib/founder-program/db";
import { hashFounderInviteToken } from "@/lib/founder-program/invitations";
import { type FounderLifecycleState } from "@/lib/founder-program/lifecycle";
import { applyFounderProgramTransition } from "@/lib/founder-program/transitions";

const COMPANY_STATUS = ["company", "independent", "other"] as const;
const EXPERIENCE_RANGES = ["lt_2", "2_5", "5_10", "10_plus"] as const;
const ACTIVE_PROJECTS_RANGES = ["1_2", "3_5", "6_10", "10_plus"] as const;
const FEEDBACK_AVAILABILITY = ["weekly", "biweekly", "monthly", "async_only"] as const;

export type FounderApplicationInput = {
  fullName: string;
  roleTitle: string;
  companyStatus: (typeof COMPANY_STATUS)[number];
  experienceRange: (typeof EXPERIENCE_RANGES)[number];
  painPoint: string;
  currentTools: string | null;
  activeProjectsRange: (typeof ACTIVE_PROJECTS_RANGES)[number];
  joiningReason: string;
  consentContact: true;
  feedbackAvailability: (typeof FEEDBACK_AVAILABILITY)[number];
  referralSource: string | null;
  linkedinUrl: string | null;
  timezone: string | null;
};

export type FounderApplicationValidation =
  | { readonly ok: true; readonly value: FounderApplicationInput }
  | { readonly ok: false; readonly field: string; readonly problem: string };

const boundedText = (value: unknown, min: number, max: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) return null;
  return trimmed;
};

const optionalBoundedText = (value: unknown, max: number): string | null | undefined => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined; // undefined = invalid
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > max) return undefined;
  return trimmed;
};

const oneOf = <T extends readonly string[]>(value: unknown, options: T): T[number] | null =>
  typeof value === "string" && (options as readonly string[]).includes(value) ? (value as T[number]) : null;

export function validateFounderApplicationInput(body: Record<string, unknown>): FounderApplicationValidation {
  const fullName = boundedText(body.fullName, 1, 120);
  if (!fullName) return { ok: false, field: "fullName", problem: "1-120 characters required" };
  const roleTitle = boundedText(body.roleTitle, 1, 120);
  if (!roleTitle) return { ok: false, field: "roleTitle", problem: "1-120 characters required" };
  const companyStatus = oneOf(body.companyStatus, COMPANY_STATUS);
  if (!companyStatus) return { ok: false, field: "companyStatus", problem: "invalid option" };
  const experienceRange = oneOf(body.experienceRange, EXPERIENCE_RANGES);
  if (!experienceRange) return { ok: false, field: "experienceRange", problem: "invalid option" };
  const painPoint = boundedText(body.painPoint, 1, 1000);
  if (!painPoint) return { ok: false, field: "painPoint", problem: "1-1000 characters required" };
  const currentTools = optionalBoundedText(body.currentTools, 500);
  if (currentTools === undefined) return { ok: false, field: "currentTools", problem: "max 500 characters" };
  const activeProjectsRange = oneOf(body.activeProjectsRange, ACTIVE_PROJECTS_RANGES);
  if (!activeProjectsRange) return { ok: false, field: "activeProjectsRange", problem: "invalid option" };
  const joiningReason = boundedText(body.joiningReason, 1, 1000);
  if (!joiningReason) return { ok: false, field: "joiningReason", problem: "1-1000 characters required" };
  if (body.consentContact !== true) return { ok: false, field: "consentContact", problem: "explicit consent is required to participate" };
  const feedbackAvailability = oneOf(body.feedbackAvailability, FEEDBACK_AVAILABILITY);
  if (!feedbackAvailability) return { ok: false, field: "feedbackAvailability", problem: "invalid option" };
  const referralSource = optionalBoundedText(body.referralSource, 200);
  if (referralSource === undefined) return { ok: false, field: "referralSource", problem: "max 200 characters" };
  const timezone = optionalBoundedText(body.timezone, 60);
  if (timezone === undefined) return { ok: false, field: "timezone", problem: "max 60 characters" };

  let linkedinUrl: string | null = null;
  if (body.linkedinUrl !== null && body.linkedinUrl !== undefined && body.linkedinUrl !== "") {
    if (typeof body.linkedinUrl !== "string" || body.linkedinUrl.length > 300) {
      return { ok: false, field: "linkedinUrl", problem: "max 300 characters" };
    }
    try {
      const parsed = new URL(body.linkedinUrl);
      if (parsed.protocol !== "https:") return { ok: false, field: "linkedinUrl", problem: "https URL required" };
      linkedinUrl = parsed.toString();
    } catch {
      return { ok: false, field: "linkedinUrl", problem: "invalid URL" };
    }
  }

  return {
    ok: true,
    value: {
      fullName,
      roleTitle,
      companyStatus,
      experienceRange,
      painPoint,
      currentTools,
      activeProjectsRange,
      joiningReason,
      consentContact: true,
      feedbackAvailability,
      referralSource,
      linkedinUrl,
      timezone,
    },
  };
}

type SupabaseLike = ReturnType<typeof createFounderProgramDbClient>;

export type SubmitFounderApplicationResult =
  | { readonly ok: true; readonly participantId: string }
  | {
      readonly ok: false;
      readonly code:
        | "invalid_or_expired_invitation"
        | "email_mismatch"
        | "already_applied"
        | "user_already_bound"
        | "submit_failed";
    };

export async function submitFounderApplication(
  input: { token: string; userId: string; userEmail: string; application: FounderApplicationInput },
  deps: { client?: SupabaseLike } = {},
): Promise<SubmitFounderApplicationResult> {
  const client = deps.client ?? createFounderProgramDbClient({ operation: "submit_application", actorUserId: input.userId });
  const tokenHash = hashFounderInviteToken(input.token);

  const { data: invitation } = await client
    .from("founder_invitations")
    .select("id, email, status, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!invitation) return { ok: false, code: "invalid_or_expired_invitation" };
  if (invitation.status === "applied") return { ok: false, code: "already_applied" };
  if (!["pending", "viewed"].includes(invitation.status) || new Date(invitation.expires_at).getTime() < Date.now()) {
    return { ok: false, code: "invalid_or_expired_invitation" };
  }
  if (invitation.email !== input.userEmail.trim().toLowerCase()) {
    return { ok: false, code: "email_mismatch" };
  }

  const { data: participant } = await client
    .from("founder_participants")
    .select("id, lifecycle_state, user_id")
    .eq("invitation_id", invitation.id)
    .maybeSingle();
  if (!participant) return { ok: false, code: "invalid_or_expired_invitation" };
  if (!["invited", "invite_viewed"].includes(participant.lifecycle_state)) {
    return { ok: false, code: "already_applied" };
  }
  if (participant.user_id && participant.user_id !== input.userId) {
    return { ok: false, code: "user_already_bound" };
  }

  // A single account can hold at most one participant record (unique
  // user_id); binding is rejected before any write if the account already
  // belongs to a different participant.
  const { data: existingForUser } = await client
    .from("founder_participants")
    .select("id")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (existingForUser && existingForUser.id !== participant.id) {
    return { ok: false, code: "user_already_bound" };
  }

  const { data: applicationRow, error: applicationError } = await client
    .from("founder_applications")
    .insert({
      participant_id: participant.id,
      user_id: input.userId,
      full_name: input.application.fullName,
      role_title: input.application.roleTitle,
      company_status: input.application.companyStatus,
      experience_range: input.application.experienceRange,
      pain_point: input.application.painPoint,
      current_tools: input.application.currentTools,
      active_projects_range: input.application.activeProjectsRange,
      joining_reason: input.application.joiningReason,
      consent_contact: true,
      feedback_availability: input.application.feedbackAvailability,
      referral_source: input.application.referralSource,
      linkedin_url: input.application.linkedinUrl,
      timezone: input.application.timezone,
    })
    .select("id")
    .single();

  if (applicationError || !applicationRow) {
    // unique participant_id violation = concurrent double-submit
    if (applicationError?.code === "23505") return { ok: false, code: "already_applied" };
    return { ok: false, code: "submit_failed" };
  }

  const { error: bindError } = await client
    .from("founder_participants")
    .update({ user_id: input.userId, full_name: input.application.fullName, application_id: applicationRow.id })
    .eq("id", participant.id);
  if (bindError) return { ok: false, code: "submit_failed" };

  const transition = await applyFounderProgramTransition({
    participantId: participant.id,
    from: participant.lifecycle_state as FounderLifecycleState,
    to: "applied",
    actor: "participant",
    actorUserId: input.userId,
  }, { client });
  if (!transition.ok) {
    return { ok: false, code: transition.code === "state_conflict" ? "already_applied" : "submit_failed" };
  }

  await client
    .from("founder_invitations")
    .update({ status: "applied", applied_at: new Date().toISOString() })
    .eq("id", invitation.id)
    .in("status", ["pending", "viewed"]);

  await recordFounderCheckpoint({ participantId: participant.id, userId: input.userId, checkpoint: "application_submitted" }, deps);
  await recordFounderProgramEvent({ eventName: "founder_application_submitted", participantId: participant.id });

  return { ok: true, participantId: participant.id };
}

export type WithdrawFounderApplicationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: "not_a_participant" | "not_withdrawable" };

export async function withdrawFounderApplication(
  input: { userId: string },
  deps: { client?: SupabaseLike } = {},
): Promise<WithdrawFounderApplicationResult> {
  const client = deps.client ?? createFounderProgramDbClient({ operation: "withdraw_application", actorUserId: input.userId });
  const { data: participant } = await client
    .from("founder_participants")
    .select("id, lifecycle_state")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!participant) return { ok: false, code: "not_a_participant" };

  const transition = await applyFounderProgramTransition({
    participantId: participant.id,
    from: participant.lifecycle_state as FounderLifecycleState,
    to: "withdrawn",
    actor: "participant",
    actorUserId: input.userId,
  }, { client });
  if (!transition.ok) return { ok: false, code: "not_withdrawable" };

  await client
    .from("founder_applications")
    .update({ withdrawn_at: new Date().toISOString() })
    .eq("participant_id", participant.id)
    .is("withdrawn_at", null);

  await recordFounderProgramEvent({ eventName: "founder_application_withdrawn", participantId: participant.id });
  return { ok: true };
}
