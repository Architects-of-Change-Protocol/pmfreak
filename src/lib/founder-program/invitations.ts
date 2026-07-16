/**
 * Founder Circle Program — operator-controlled invitations.
 *
 * Token model (docs/founder-program/06): 24 CSPRNG bytes (192 bits),
 * base64url; only sha256(token) is stored. The plaintext exists exactly once
 * in the invite link returned to the operator / emailed to the candidate.
 * Tokens are single-purpose (resolve one invitation), expire, are revocable,
 * rotate on resend, and stop opening the application once one is submitted.
 * They are never logged and never appear in analytics.
 */
import crypto from "node:crypto";
import { recordFounderProgramEvent } from "@/lib/founder-program/analytics";
import { type FounderProgramSettings } from "@/lib/founder-program/config";
import { createFounderProgramDbClient } from "@/lib/founder-program/db";
import { isFounderArchetype, type FounderArchetype, type FounderLifecycleState } from "@/lib/founder-program/lifecycle";
import { applyFounderProgramTransition } from "@/lib/founder-program/transitions";
import { buildFounderInvitationEmail } from "@/lib/email/templates/founder-program";
import { sendEmail } from "@/lib/email/provider";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NOTE_LENGTH = 1000;

export const createFounderInviteToken = (): string => crypto.randomBytes(24).toString("base64url");
export const hashFounderInviteToken = (token: string): string => crypto.createHash("sha256").update(token).digest("hex");

export function buildFounderInviteLink(token: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const appUrl = configured && /^https?:\/\//.test(configured) ? configured : "http://localhost:3000";
  return `${appUrl.replace(/\/$/, "")}/founder-circle/invite/${encodeURIComponent(token)}`;
}

export function isValidFounderInviteEmail(value: unknown): value is string {
  return typeof value === "string" && EMAIL_SHAPE.test(value.trim());
}

type SupabaseLike = ReturnType<typeof createFounderProgramDbClient>;

export type CreateFounderInvitationInput = {
  email: string;
  archetype: FounderArchetype;
  nominationNote?: string | null;
  /** false = record as `nominated` without sending (link still generated on demand via resend). */
  send?: boolean;
  createdByUserId: string;
  batchId?: string | null;
  settings: FounderProgramSettings;
};

export type CreateFounderInvitationResult = {
  invitationId: string;
  participantId: string;
  expiresAt: string;
  /** Plaintext link — returned once; never persisted or logged. */
  inviteLink: string;
  emailDelivery: { attempted: boolean; ok: boolean; provider?: string | null };
};

export async function createFounderInvitation(
  input: CreateFounderInvitationInput,
  deps: { client?: SupabaseLike } = {},
): Promise<CreateFounderInvitationResult> {
  if (!isValidFounderInviteEmail(input.email)) {
    throw new Error("invalid_email::A valid invitation email is required.");
  }
  if (!isFounderArchetype(input.archetype)) {
    throw new Error("invalid_archetype::Unknown participant archetype.");
  }
  const email = input.email.trim().toLowerCase();
  const note = typeof input.nominationNote === "string" ? input.nominationNote.trim().slice(0, MAX_NOTE_LENGTH) || null : null;
  const client = deps.client ?? createFounderProgramDbClient({ operation: "create_invitation", actorUserId: input.createdByUserId });

  const token = createFounderInviteToken();
  const tokenHash = hashFounderInviteToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * input.settings.invitationExpiryDays).toISOString();

  const { data: invitation, error: invitationError } = await client
    .from("founder_invitations")
    .insert({
      email,
      token_hash: tokenHash,
      archetype: input.archetype,
      nomination_note: note,
      status: "pending",
      expires_at: expiresAt,
      batch_id: input.batchId ?? null,
      created_by_user_id: input.createdByUserId,
    })
    .select("id, expires_at")
    .single();

  if (invitationError || !invitation) {
    if (invitationError?.code === "23505") {
      throw new Error("duplicate_invitation::A live invitation already exists for this email.");
    }
    throw new Error(`Unable to create invitation: ${invitationError?.message ?? "unknown"}`);
  }

  const { data: participant, error: participantError } = await client
    .from("founder_participants")
    .insert({
      invitation_id: invitation.id,
      email,
      archetype: input.archetype,
      lifecycle_state: "nominated",
    })
    .select("id")
    .single();

  if (participantError || !participant) {
    throw new Error(`Unable to create participant record: ${participantError?.message ?? "unknown"}`);
  }

  const inviteLink = buildFounderInviteLink(token);
  let emailDelivery: CreateFounderInvitationResult["emailDelivery"] = { attempted: false, ok: false };

  if (input.send !== false) {
    await applyFounderProgramTransition({
      participantId: participant.id,
      from: "nominated",
      to: "invited",
      actor: "operator",
      actorUserId: input.createdByUserId,
    }, { client });
    const template = buildFounderInvitationEmail({
      recipientEmail: email,
      programName: input.settings.displayName,
      inviteLink,
      expiresAt: invitation.expires_at,
      supportContact: input.settings.supportContact,
    });
    const delivery = await sendEmail({ to: email, subject: template.subject, html: template.html, text: template.text });
    emailDelivery = { attempted: true, ok: delivery.ok, provider: delivery.provider ?? null };
  }

  await recordFounderProgramEvent({
    eventName: "founder_invitation_created",
    participantId: participant.id,
    properties: { archetype: input.archetype },
  });

  return {
    invitationId: invitation.id,
    participantId: participant.id,
    expiresAt: invitation.expires_at,
    inviteLink,
    emailDelivery,
  };
}

export type ResolvedFounderInvitation = {
  invitationId: string;
  participantId: string;
  participantState: FounderLifecycleState;
  status: "pending" | "viewed" | "applied" | "expired" | "revoked";
  email: string;
  archetype: FounderArchetype;
  expiresAt: string;
};

/**
 * Resolves a token to its invitation, lazily expiring stale ones (invitation
 * status → expired; participant → revoked with system reason
 * `invitation_expired`). Returns null for unknown tokens — callers answer
 * with a generic invalid-or-expired response (enumeration resistance).
 */
export async function resolveFounderInvitationByToken(
  token: string,
  deps: { client?: SupabaseLike } = {},
): Promise<ResolvedFounderInvitation | null> {
  if (typeof token !== "string" || token.length < 16 || token.length > 128) return null;
  const client = deps.client ?? createFounderProgramDbClient({ operation: "resolve_invitation" });
  const tokenHash = hashFounderInviteToken(token);

  const { data: invitation, error } = await client
    .from("founder_invitations")
    .select("id, email, archetype, status, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !invitation) return null;

  const { data: participant } = await client
    .from("founder_participants")
    .select("id, lifecycle_state")
    .eq("invitation_id", invitation.id)
    .maybeSingle();

  if (!participant) return null;

  let status = invitation.status as ResolvedFounderInvitation["status"];
  if ((status === "pending" || status === "viewed") && new Date(invitation.expires_at).getTime() < Date.now()) {
    await client.from("founder_invitations").update({ status: "expired" }).eq("id", invitation.id).eq("status", status);
    await applyFounderProgramTransition({
      participantId: participant.id,
      from: participant.lifecycle_state as FounderLifecycleState,
      to: "revoked",
      actor: "system",
      reason: "invitation_expired",
    }, { client });
    await recordFounderProgramEvent({ eventName: "founder_invitation_expired", participantId: participant.id });
    status = "expired";
  }

  return {
    invitationId: invitation.id,
    participantId: participant.id,
    participantState: participant.lifecycle_state as FounderLifecycleState,
    status,
    email: invitation.email,
    archetype: invitation.archetype as FounderArchetype,
    expiresAt: invitation.expires_at,
  };
}

/** First authenticated open: pending → viewed (+ lifecycle + checkpoint handled by caller). */
export async function markFounderInvitationViewed(
  resolved: ResolvedFounderInvitation,
  deps: { client?: SupabaseLike } = {},
): Promise<void> {
  if (resolved.status !== "pending") return;
  const client = deps.client ?? createFounderProgramDbClient({ operation: "mark_invitation_viewed" });
  await client
    .from("founder_invitations")
    .update({ status: "viewed", viewed_at: new Date().toISOString() })
    .eq("id", resolved.invitationId)
    .eq("status", "pending");
  if (resolved.participantState === "invited") {
    await applyFounderProgramTransition({
      participantId: resolved.participantId,
      from: "invited",
      to: "invite_viewed",
      actor: "system",
    }, { client });
  }
  await recordFounderProgramEvent({ eventName: "founder_invitation_viewed", participantId: resolved.participantId });
}

export async function revokeFounderInvitation(
  input: { invitationId: string; operatorUserId: string; reason: string },
  deps: { client?: SupabaseLike } = {},
): Promise<void> {
  const invitationId = requireNonEmptyString(input.invitationId, "invitationId");
  const reason = requireNonEmptyString(input.reason, "reason").slice(0, 500);
  const client = deps.client ?? createFounderProgramDbClient({ operation: "revoke_invitation", actorUserId: input.operatorUserId });

  const { data: invitation } = await client
    .from("founder_invitations")
    .select("id, status")
    .eq("id", invitationId)
    .maybeSingle();
  if (!invitation) throw new Error("not_found::Invitation not found.");
  if (invitation.status === "applied") throw new Error("already_used::An application was already submitted; manage the participant instead.");
  if (invitation.status === "revoked") return; // idempotent

  const { data: participant } = await client
    .from("founder_participants")
    .select("id, lifecycle_state")
    .eq("invitation_id", invitationId)
    .maybeSingle();

  await client
    .from("founder_invitations")
    .update({ status: "revoked", revoked_at: new Date().toISOString(), revoke_reason: reason })
    .eq("id", invitationId)
    .in("status", ["pending", "viewed", "expired"]);

  if (participant && ["nominated", "invited", "invite_viewed"].includes(participant.lifecycle_state)) {
    await applyFounderProgramTransition({
      participantId: participant.id,
      from: participant.lifecycle_state as FounderLifecycleState,
      to: "revoked",
      actor: "operator",
      actorUserId: input.operatorUserId,
      reason,
    }, { client });
  }
  await recordFounderProgramEvent({ eventName: "founder_invitation_revoked", participantId: participant?.id ?? null });
}

/**
 * Rotates the token (old link stops working immediately) and re-sends.
 * Only pending/viewed/expired invitations can be resent; an expired one is
 * re-armed with a fresh expiry window.
 */
export async function resendFounderInvitation(
  input: { invitationId: string; operatorUserId: string; settings: FounderProgramSettings },
  deps: { client?: SupabaseLike } = {},
): Promise<{ inviteLink: string; expiresAt: string; emailDelivery: { attempted: boolean; ok: boolean; provider?: string | null } }> {
  const invitationId = requireNonEmptyString(input.invitationId, "invitationId");
  const client = deps.client ?? createFounderProgramDbClient({ operation: "resend_invitation", actorUserId: input.operatorUserId });

  const { data: invitation } = await client
    .from("founder_invitations")
    .select("id, email, status")
    .eq("id", invitationId)
    .maybeSingle();
  if (!invitation) throw new Error("not_found::Invitation not found.");
  if (invitation.status === "applied" || invitation.status === "revoked") {
    throw new Error("not_resendable::Only unused invitations can be resent.");
  }

  const token = createFounderInviteToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * input.settings.invitationExpiryDays).toISOString();
  const { error: updateError } = await client
    .from("founder_invitations")
    .update({ token_hash: hashFounderInviteToken(token), expires_at: expiresAt, status: "pending", viewed_at: null })
    .eq("id", invitationId);
  if (updateError) throw new Error(`Unable to rotate invitation token: ${updateError.message}`);

  const { data: participant } = await client
    .from("founder_participants")
    .select("id, lifecycle_state")
    .eq("invitation_id", invitationId)
    .maybeSingle();

  // A nominated candidate becomes invited on first send; a revoked-by-expiry
  // participant is NOT silently resurrected — operators see state_conflict
  // surfaced as a controlled error from the transition layer if they try.
  if (participant?.lifecycle_state === "nominated") {
    await applyFounderProgramTransition({
      participantId: participant.id,
      from: "nominated",
      to: "invited",
      actor: "operator",
      actorUserId: input.operatorUserId,
    }, { client });
  }

  const inviteLink = buildFounderInviteLink(token);
  const template = buildFounderInvitationEmail({
    recipientEmail: invitation.email,
    programName: input.settings.displayName,
    inviteLink,
    expiresAt,
    supportContact: input.settings.supportContact,
  });
  const delivery = await sendEmail({ to: invitation.email, subject: template.subject, html: template.html, text: template.text });

  await recordFounderProgramEvent({ eventName: "founder_invitation_resent", participantId: participant?.id ?? null });

  return { inviteLink, expiresAt, emailDelivery: { attempted: true, ok: delivery.ok, provider: delivery.provider ?? null } };
}

export function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`missing_field::${label} is required.`);
  }
  return value.trim();
}
