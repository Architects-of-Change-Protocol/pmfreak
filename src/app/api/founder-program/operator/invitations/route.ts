import { NextRequest, NextResponse } from "next/server";
import { founderProgramFeatureDisabledResponse, requireFounderProgramOperator } from "@/lib/founder-program/authz";
import {
  createFounderInvitation,
  isValidFounderInviteEmail,
  resendFounderInvitation,
  revokeFounderInvitation,
} from "@/lib/founder-program/invitations";
import { isFounderArchetype } from "@/lib/founder-program/lifecycle";
import { abuseDenyResponse, enforceAbuseLimit } from "@/lib/security/abuse-protection";
import { logSecurityEvent } from "@/lib/security/telemetry";
import { logger, safeErrorMessage } from "@/lib/observability/logger";
import crypto from "node:crypto";

const ROUTE_ID = "/api/founder-program/operator/invitations";

// Founder/internal authorization is resolved BEFORE the body is parsed; no
// role/founder/admin field is ever read from the request body (Perilla 5/8
// conventions). Responses may carry a plaintext invite link exactly once —
// links are never persisted or logged.
export async function GET(request: NextRequest) {
  try {
    const gate = await requireFounderProgramOperator(ROUTE_ID);
    if (!gate.ok) return gate.response;

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status");
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") ?? "50", 10) || 50));

    const { createFounderProgramDbClient } = await import("@/lib/founder-program/db");
    const client = createFounderProgramDbClient({ operation: "list_invitations", actorUserId: gate.user.id });

    let query = client
      .from("founder_invitations")
      // token_hash is intentionally absent from this selection.
      .select("id, email, archetype, status, expires_at, viewed_at, applied_at, revoked_at, revoke_reason, nomination_note, batch_id, created_at")
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (statusFilter && ["pending", "viewed", "applied", "expired", "revoked"].includes(statusFilter)) {
      query = query.eq("status", statusFilter);
    }
    const { data: invitations, error } = await query;
    if (error) {
      logger.error("route_internal_error", { route: ROUTE_ID, error_detail: safeErrorMessage(error) });
      return NextResponse.json({ error: "Unable to list invitations." }, { status: 500 });
    }

    const invitationIds = (invitations ?? []).map((row: { id: string }) => row.id);
    const { data: participants } = invitationIds.length
      ? await client
          .from("founder_participants")
          .select("id, invitation_id, lifecycle_state, agreement_version_accepted, activated_at")
          .in("invitation_id", invitationIds)
      : { data: [] };

    const byInvitation = new Map((participants ?? []).map((p: { invitation_id: string }) => [p.invitation_id, p]));
    return NextResponse.json({
      page,
      pageSize,
      invitations: (invitations ?? []).map((row: Record<string, unknown>) => ({
        ...row,
        participant: byInvitation.get(row.id as string) ?? null,
      })),
    });
  } catch (error) {
    logger.error("route_internal_error", { route: ROUTE_ID, error_detail: safeErrorMessage(error) });
    return NextResponse.json({ error: "Unable to list invitations." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireFounderProgramOperator(ROUTE_ID);
  if (!gate.ok) return gate.response;
  if (!gate.config.flags.invitationsEnabled) {
    return founderProgramFeatureDisabledResponse("invitationsEnabled");
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const action = String(body.action ?? "");
  const abuseDecision = await enforceAbuseLimit({
    scope: "founder_program.operator_invitation",
    action,
    identifier: gate.user.id,
    limit: 30,
    windowSeconds: 3600,
  });
  if (!abuseDecision.allowed) return abuseDenyResponse(abuseDecision);

  try {
    if (action === "create") {
      const result = await createFounderInvitation({
        email: String(body.email ?? ""),
        archetype: isFounderArchetype(body.archetype) ? body.archetype : ("" as never),
        nominationNote: typeof body.nominationNote === "string" ? body.nominationNote : null,
        send: body.send !== false,
        createdByUserId: gate.user.id,
        settings: gate.config.settings,
      });
      await logSecurityEvent("founder_program_operator_action", {
        actorUserId: gate.user.id,
        routeId: ROUTE_ID,
        resourceType: "founder_invitation",
        resourceId: result.invitationId,
        metadata: { action: "create" },
      });
      return NextResponse.json({ ok: true, ...result }, { status: 201 });
    }

    if (action === "create_batch") {
      const rawEntries = Array.isArray(body.invitations) ? body.invitations : [];
      if (rawEntries.length === 0) {
        return NextResponse.json({ error: "invitations[] is required for create_batch." }, { status: 400 });
      }
      if (rawEntries.length > gate.config.settings.maxInvitationsPerBatch) {
        return NextResponse.json(
          { error: `Batch exceeds the configured maximum of ${gate.config.settings.maxInvitationsPerBatch} invitations.`, code: "batch_too_large" },
          { status: 400 },
        );
      }
      for (const entry of rawEntries) {
        const candidate = entry as Record<string, unknown>;
        if (!isValidFounderInviteEmail(candidate.email) || !isFounderArchetype(candidate.archetype)) {
          return NextResponse.json({ error: "Every batch entry needs a valid email and archetype.", code: "invalid_batch_entry" }, { status: 400 });
        }
      }
      const batchId = crypto.randomUUID();
      const results = [];
      for (const entry of rawEntries) {
        const candidate = entry as Record<string, unknown>;
        results.push(
          await createFounderInvitation({
            email: String(candidate.email),
            archetype: candidate.archetype as never,
            nominationNote: typeof candidate.nominationNote === "string" ? candidate.nominationNote : null,
            send: body.send !== false,
            createdByUserId: gate.user.id,
            batchId,
            settings: gate.config.settings,
          }),
        );
      }
      await logSecurityEvent("founder_program_operator_action", {
        actorUserId: gate.user.id,
        routeId: ROUTE_ID,
        resourceType: "founder_invitation_batch",
        resourceId: batchId,
        metadata: { action: "create_batch", batch_size: results.length },
      });
      return NextResponse.json({ ok: true, batchId, invitations: results }, { status: 201 });
    }

    if (action === "revoke") {
      await revokeFounderInvitation({
        invitationId: String(body.invitationId ?? ""),
        operatorUserId: gate.user.id,
        reason: String(body.reason ?? ""),
      });
      await logSecurityEvent("founder_program_operator_action", {
        actorUserId: gate.user.id,
        routeId: ROUTE_ID,
        resourceType: "founder_invitation",
        resourceId: String(body.invitationId ?? ""),
        metadata: { action: "revoke" },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "resend") {
      const result = await resendFounderInvitation({
        invitationId: String(body.invitationId ?? ""),
        operatorUserId: gate.user.id,
        settings: gate.config.settings,
      });
      await logSecurityEvent("founder_program_operator_action", {
        actorUserId: gate.user.id,
        routeId: ROUTE_ID,
        resourceType: "founder_invitation",
        resourceId: String(body.invitationId ?? ""),
        metadata: { action: "resend" },
      });
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    // Only the domain's own `code::message` vocabulary is user-facing; any
    // other message may carry raw driver text and stays server-side.
    if (!raw.includes("::")) {
      logger.error("route_internal_error", { route: ROUTE_ID, error_detail: safeErrorMessage(error) });
      return NextResponse.json({ error: "Unable to perform the invitation action. Please retry." }, { status: 400 });
    }
    return NextResponse.json({ error: raw.split("::", 2)[1], code: raw.split("::", 2)[0] }, { status: 400 });
  }
}
