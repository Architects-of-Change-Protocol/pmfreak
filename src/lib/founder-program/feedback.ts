/**
 * Founder Circle Program — structured feedback (docs/founder-program/09).
 *
 * Participants submit bounded, typed feedback and can read ONLY their own
 * submissions (route-layer self-scoping on top of the RLS self-select
 * policy; internal triage fields are excluded by the column-scoped grant).
 * Operators triage all program feedback. This is deliberately NOT a
 * general-purpose issue tracker.
 */
import { recordFounderProgramEvent } from "@/lib/founder-program/analytics";
import { recordFounderCheckpoint } from "@/lib/founder-program/checkpoints";
import { createFounderProgramDbClient } from "@/lib/founder-program/db";
import { type FounderLifecycleState } from "@/lib/founder-program/lifecycle";
import { applyFounderProgramTransition } from "@/lib/founder-program/transitions";

export const FOUNDER_FEEDBACK_TYPES = [
  "onboarding_friction",
  "defect",
  "usability",
  "feature_request",
  "missing_integration",
  "pricing_value",
  "workflow_outcome",
  "general",
] as const;
export type FounderFeedbackType = (typeof FOUNDER_FEEDBACK_TYPES)[number];

export const FOUNDER_FEEDBACK_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export const FOUNDER_FEEDBACK_STATUSES = ["new", "triaged", "planned", "declined", "resolved", "duplicate"] as const;
export type FounderFeedbackStatus = (typeof FOUNDER_FEEDBACK_STATUSES)[number];

type SupabaseLike = ReturnType<typeof createFounderProgramDbClient>;

export type FounderFeedbackValidation =
  | { readonly ok: true; readonly value: { feedbackType: FounderFeedbackType; severity: (typeof FOUNDER_FEEDBACK_SEVERITIES)[number]; productArea: string | null; body: string; allowContact: boolean; workspaceId: string | null } }
  | { readonly ok: false; readonly field: string; readonly problem: string };

export function validateFounderFeedbackInput(body: Record<string, unknown>): FounderFeedbackValidation {
  const feedbackType = typeof body.feedbackType === "string" && (FOUNDER_FEEDBACK_TYPES as readonly string[]).includes(body.feedbackType)
    ? (body.feedbackType as FounderFeedbackType)
    : null;
  if (!feedbackType) return { ok: false, field: "feedbackType", problem: "invalid option" };

  const severity = typeof body.severity === "string" && (FOUNDER_FEEDBACK_SEVERITIES as readonly string[]).includes(body.severity)
    ? (body.severity as (typeof FOUNDER_FEEDBACK_SEVERITIES)[number])
    : "medium";

  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (text.length < 1 || text.length > 4000) return { ok: false, field: "body", problem: "1-4000 characters required" };

  let productArea: string | null = null;
  if (body.productArea !== undefined && body.productArea !== null && body.productArea !== "") {
    if (typeof body.productArea !== "string" || body.productArea.trim().length > 120) {
      return { ok: false, field: "productArea", problem: "max 120 characters" };
    }
    productArea = body.productArea.trim();
  }

  let workspaceId: string | null = null;
  if (typeof body.workspaceId === "string" && body.workspaceId.trim()) {
    workspaceId = body.workspaceId.trim();
  }

  return {
    ok: true,
    value: { feedbackType, severity, productArea, body: text, allowContact: body.allowContact === true, workspaceId },
  };
}

export type SubmitFounderFeedbackResult =
  | { readonly ok: true; readonly feedbackId: string }
  | { readonly ok: false; readonly code: "not_a_participant" | "not_eligible" | "submit_failed" };

/** Feedback is open to admitted participants (applied onward, non-terminal). */
const FEEDBACK_ELIGIBLE_STATES: readonly FounderLifecycleState[] = [
  "applied", "under_review", "approved", "waitlisted", "agreement_pending",
  "agreement_accepted", "onboarding_pending", "onboarding_active", "activated",
  "feedback_active", "paused",
];

export async function submitFounderFeedback(
  input: { userId: string; feedback: Extract<FounderFeedbackValidation, { ok: true }>["value"] },
  deps: { client?: SupabaseLike } = {},
): Promise<SubmitFounderFeedbackResult> {
  const client = deps.client ?? createFounderProgramDbClient({ operation: "submit_feedback", actorUserId: input.userId });
  const { data: participant } = await client
    .from("founder_participants")
    .select("id, lifecycle_state, workspace_id")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!participant) return { ok: false, code: "not_a_participant" };
  if (!FEEDBACK_ELIGIBLE_STATES.includes(participant.lifecycle_state as FounderLifecycleState)) {
    return { ok: false, code: "not_eligible" };
  }

  // The related workspace may only ever be the participant's own program
  // workspace — a client-supplied foreign workspace id is discarded.
  const workspaceId = participant.workspace_id ?? null;

  const { data: row, error } = await client
    .from("founder_feedback")
    .insert({
      participant_id: participant.id,
      user_id: input.userId,
      workspace_id: workspaceId ?? null,
      feedback_type: input.feedback.feedbackType,
      severity: input.feedback.severity,
      product_area: input.feedback.productArea,
      body: input.feedback.body,
      allow_contact: input.feedback.allowContact,
      status: "new",
    })
    .select("id")
    .single();
  if (error || !row) return { ok: false, code: "submit_failed" };

  await recordFounderCheckpoint({ participantId: participant.id, userId: input.userId, checkpoint: "first_feedback_submitted" }, { client });
  if (participant.lifecycle_state === "activated") {
    await applyFounderProgramTransition(
      { participantId: participant.id, from: "activated", to: "feedback_active", actor: "system" },
      { client },
    );
  }
  await recordFounderProgramEvent({
    eventName: "founder_feedback_submitted",
    participantId: participant.id,
    properties: { feedback_type: input.feedback.feedbackType, severity: input.feedback.severity },
  });

  return { ok: true, feedbackId: row.id };
}

/** Participant-visible projection — internal triage fields never leave the server. */
export async function listOwnFounderFeedback(
  userId: string,
  deps: { client?: SupabaseLike } = {},
): Promise<readonly Record<string, unknown>[]> {
  const client = deps.client ?? createFounderProgramDbClient({ operation: "list_own_feedback", actorUserId: userId });
  const { data } = await client
    .from("founder_feedback")
    .select("id, feedback_type, severity, product_area, body, allow_contact, status, resolution_ref, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export type TriageFounderFeedbackResult = { readonly ok: boolean; readonly code?: "not_found" | "invalid_status" };

export async function triageFounderFeedback(
  input: {
    feedbackId: string;
    operatorUserId: string;
    status?: FounderFeedbackStatus;
    internalOwnerUserId?: string | null;
    internalNotes?: string | null;
    resolutionRef?: string | null;
  },
  deps: { client?: SupabaseLike } = {},
): Promise<TriageFounderFeedbackResult> {
  const client = deps.client ?? createFounderProgramDbClient({ operation: "triage_feedback", actorUserId: input.operatorUserId });
  const patch: Record<string, unknown> = {};
  if (input.status !== undefined) {
    if (!(FOUNDER_FEEDBACK_STATUSES as readonly string[]).includes(input.status)) return { ok: false, code: "invalid_status" };
    patch.status = input.status;
  }
  if (input.internalOwnerUserId !== undefined) patch.internal_owner_user_id = input.internalOwnerUserId;
  if (input.internalNotes !== undefined) patch.internal_notes = typeof input.internalNotes === "string" ? input.internalNotes.slice(0, 4000) : null;
  if (input.resolutionRef !== undefined) patch.resolution_ref = typeof input.resolutionRef === "string" ? input.resolutionRef.slice(0, 300) : null;
  if (Object.keys(patch).length === 0) return { ok: true };

  const { data } = await client.from("founder_feedback").update(patch).eq("id", input.feedbackId).select("id, participant_id");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, code: "not_found" };

  if (patch.status) {
    await recordFounderProgramEvent({
      eventName: "founder_feedback_triaged",
      participantId: (row as { participant_id?: string }).participant_id ?? null,
      properties: { status: String(patch.status) },
    });
  }
  return { ok: true };
}
