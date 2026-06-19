import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateSignatureHash } from "./hash-engine";
import type {
  ConstitutionalSignatureRecord,
  ExpireSignatureInput,
  GetSignatureStatusInput,
  RatificationResult,
  RejectSignatureInput,
  RequestSignatureInput,
  SignEntityInput,
  WithdrawSignatureInput,
} from "./types";

// ─── Column projection ───────────────────────────────────────────────────────

const signatureColumns =
  "id,workspace_id,entity_type,entity_id,entity_version,authority_type,authority_id,status,signature_hash,comments,requested_at,signed_at,rejected_at,expired_at,withdrawn_at,created_by,created_at,updated_at";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(v);
}

function validation<T>(error: string): RatificationResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

function failed<T>(error: string, failureClass: Extract<RatificationResult<never>, { ok: false }>["failureClass"] = "persistence_failed"): RatificationResult<T> {
  return { ok: false, error, failureClass };
}

// ─── Internal: get signature ─────────────────────────────────────────────────

async function getSignatureById(
  signatureId: string,
  workspaceId: string,
): Promise<RatificationResult<ConstitutionalSignatureRecord>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_signatures")
    .select(signatureColumns)
    .eq("id", signatureId)
    .eq("workspace_id", workspaceId)
    .single<ConstitutionalSignatureRecord>();

  if (error || !data) return failed("Signature not found.", "not_found");
  return { ok: true, data };
}

// ─── Internal: emit event ────────────────────────────────────────────────────

async function emitSignatureEvent(
  sig: ConstitutionalSignatureRecord,
  eventType: string,
  actorId: string,
  extra: Record<string, unknown> = {},
): Promise<RatificationResult<ConstitutionalSignatureRecord>> {
  const event = await createPlatformEvent({
    workspaceId: sig.workspace_id,
    actorId,
    actorType: "user",
    eventType,
    eventCategory: "governance",
    source: "user_action",
    correlationId: sig.entity_id,
    causationId: null,
    rawReferenceTable: "constitutional_signatures",
    rawReferenceId: sig.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: {
      signatureId: sig.id,
      entityType: sig.entity_type,
      entityId: sig.entity_id,
      entityVersion: sig.entity_version,
      authorityType: sig.authority_type,
      authorityId: sig.authority_id,
      ...extra,
    },
  });
  if (!event.ok) return failed(event.error, "event_emission_failed");
  return { ok: true, data: sig };
}

// ─── requestSignature ────────────────────────────────────────────────────────

export async function requestSignature(
  input: RequestSignatureInput,
): Promise<RatificationResult<ConstitutionalSignatureRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.entityId)) return validation("entityId must be a UUID.");
  if (!validUuid(input.authorityId)) return validation("authorityId must be a UUID.");
  if (!validUuid(input.requestedBy)) return validation("requestedBy must be a UUID.");
  if (!["constitution", "amendment", "decision"].includes(input.entityType)) {
    return validation("entityType must be constitution, amendment, or decision.");
  }
  if (input.entityVersion < 1) return validation("entityVersion must be >= 1.");

  const supabase = await createSupabaseServerClient();

  // Rule 2: cannot sign same authority + entity twice
  const { data: existing } = await supabase
    .from("constitutional_signatures")
    .select("id,status")
    .eq("workspace_id", input.workspaceId)
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId)
    .eq("authority_id", input.authorityId)
    .maybeSingle();

  if (existing) {
    return failed(
      `A signature record already exists for this authority on this entity (status: ${(existing as { status: string }).status}).`,
      "governance_violation",
    );
  }

  const { data, error } = await supabase
    .from("constitutional_signatures")
    .insert({
      workspace_id: input.workspaceId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      entity_version: input.entityVersion,
      authority_type: input.authorityType,
      authority_id: input.authorityId,
      status: "pending",
      comments: input.comments ?? null,
      created_by: input.requestedBy,
    })
    .select(signatureColumns)
    .single<ConstitutionalSignatureRecord>();

  if (error || !data) return failed("Unable to create signature request.");

  // Also insert a signature_request record for traceability
  await supabase.from("constitutional_signature_requests").insert({
    workspace_id: input.workspaceId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    requested_authority: input.authorityType,
    requested_by: input.requestedBy,
    status: "pending",
    deadline: input.deadline ?? null,
  });

  return emitSignatureEvent(data, "CONSTITUTIONAL_SIGNATURE_REQUESTED", input.requestedBy);
}

// ─── signEntity ──────────────────────────────────────────────────────────────

export async function signEntity(
  input: SignEntityInput,
): Promise<RatificationResult<ConstitutionalSignatureRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.signatureId)) return validation("signatureId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const current = await getSignatureById(input.signatureId, input.workspaceId);
  if (!current.ok) return current;

  if (current.data.status !== "pending") {
    return failed(
      `Signature in status '${current.data.status}' cannot be signed; only pending signatures can be signed.`,
      "governance_violation",
    );
  }

  // Rule 3: a rejected signature is terminal — already guarded above via status check
  const now = new Date().toISOString();
  const hash = generateSignatureHash({
    entityType: current.data.entity_type,
    entityId: current.data.entity_id,
    entityVersion: current.data.entity_version,
    authorityType: current.data.authority_type,
    authorityId: current.data.authority_id,
    timestamp: now,
  });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_signatures")
    .update({
      status: "signed",
      signature_hash: hash,
      comments: input.comments ?? current.data.comments,
      signed_at: now,
      updated_at: now,
    })
    .eq("id", input.signatureId)
    .eq("workspace_id", input.workspaceId)
    .select(signatureColumns)
    .single<ConstitutionalSignatureRecord>();

  if (error || !data) return failed("Unable to record signature.");

  // Update signature request to fulfilled
  await supabase
    .from("constitutional_signature_requests")
    .update({ status: "fulfilled", updated_at: now })
    .eq("workspace_id", input.workspaceId)
    .eq("entity_type", data.entity_type)
    .eq("entity_id", data.entity_id)
    .eq("requested_authority", data.authority_type)
    .eq("status", "pending");

  return emitSignatureEvent(data, "CONSTITUTIONAL_SIGNATURE_SIGNED", input.actorId, {
    signatureHash: hash,
    signedAt: now,
  });
}

// ─── rejectSignature ─────────────────────────────────────────────────────────

export async function rejectSignature(
  input: RejectSignatureInput,
): Promise<RatificationResult<ConstitutionalSignatureRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.signatureId)) return validation("signatureId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const current = await getSignatureById(input.signatureId, input.workspaceId);
  if (!current.ok) return current;

  if (current.data.status !== "pending") {
    return failed(
      `Signature in status '${current.data.status}' cannot be rejected; only pending signatures can be rejected.`,
      "governance_violation",
    );
  }

  const now = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_signatures")
    .update({
      status: "rejected",
      comments: input.comments ?? current.data.comments,
      rejected_at: now,
      updated_at: now,
    })
    .eq("id", input.signatureId)
    .eq("workspace_id", input.workspaceId)
    .select(signatureColumns)
    .single<ConstitutionalSignatureRecord>();

  if (error || !data) return failed("Unable to reject signature.");

  await supabase
    .from("constitutional_signature_requests")
    .update({ status: "declined", updated_at: now })
    .eq("workspace_id", input.workspaceId)
    .eq("entity_type", data.entity_type)
    .eq("entity_id", data.entity_id)
    .eq("requested_authority", data.authority_type)
    .eq("status", "pending");

  return emitSignatureEvent(data, "CONSTITUTIONAL_SIGNATURE_REJECTED", input.actorId, {
    rejectedAt: now,
  });
}

// ─── withdrawSignature ───────────────────────────────────────────────────────

export async function withdrawSignature(
  input: WithdrawSignatureInput,
): Promise<RatificationResult<ConstitutionalSignatureRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.signatureId)) return validation("signatureId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const current = await getSignatureById(input.signatureId, input.workspaceId);
  if (!current.ok) return current;

  if (!["pending", "signed"].includes(current.data.status)) {
    return failed(
      `Signature in status '${current.data.status}' cannot be withdrawn.`,
      "governance_violation",
    );
  }

  const now = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_signatures")
    .update({
      status: "withdrawn",
      comments: input.comments ?? current.data.comments,
      withdrawn_at: now,
      updated_at: now,
    })
    .eq("id", input.signatureId)
    .eq("workspace_id", input.workspaceId)
    .select(signatureColumns)
    .single<ConstitutionalSignatureRecord>();

  if (error || !data) return failed("Unable to withdraw signature.");

  return emitSignatureEvent(data, "CONSTITUTIONAL_SIGNATURE_WITHDRAWN", input.actorId, {
    withdrawnAt: now,
  });
}

// ─── expireSignature ─────────────────────────────────────────────────────────

export async function expireSignature(
  input: ExpireSignatureInput,
): Promise<RatificationResult<ConstitutionalSignatureRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.signatureId)) return validation("signatureId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const current = await getSignatureById(input.signatureId, input.workspaceId);
  if (!current.ok) return current;

  if (current.data.status !== "pending") {
    return failed(
      `Only pending signatures can be expired; current status is '${current.data.status}'.`,
      "governance_violation",
    );
  }

  const now = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_signatures")
    .update({
      status: "expired",
      expired_at: now,
      updated_at: now,
    })
    .eq("id", input.signatureId)
    .eq("workspace_id", input.workspaceId)
    .select(signatureColumns)
    .single<ConstitutionalSignatureRecord>();

  if (error || !data) return failed("Unable to expire signature.");

  await supabase
    .from("constitutional_signature_requests")
    .update({ status: "expired", updated_at: now })
    .eq("workspace_id", input.workspaceId)
    .eq("entity_type", data.entity_type)
    .eq("entity_id", data.entity_id)
    .eq("requested_authority", data.authority_type)
    .eq("status", "pending");

  return emitSignatureEvent(data, "CONSTITUTIONAL_SIGNATURE_EXPIRED", input.actorId, {
    expiredAt: now,
  });
}

// ─── getSignatureStatus ──────────────────────────────────────────────────────

export async function getSignatureStatus(
  input: GetSignatureStatusInput,
): Promise<RatificationResult<ConstitutionalSignatureRecord[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.entityId)) return validation("entityId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_signatures")
    .select(signatureColumns)
    .eq("workspace_id", input.workspaceId)
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId)
    .order("created_at", { ascending: true });

  if (error) return failed("Unable to retrieve signature status.");
  return { ok: true, data: (data ?? []) as ConstitutionalSignatureRecord[] };
}
