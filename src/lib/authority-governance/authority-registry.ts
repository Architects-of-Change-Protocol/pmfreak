import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AuthorityResult,
  AuthorityRegistrationRecord,
  RegisterAuthorityInput,
  RevokeAuthorityInput,
  CheckAuthorityInput,
  AuthorityType,
} from "./types";

const COLUMNS =
  "id,workspace_id,actor_id,authority_type,authority_scope,project_id,valid_from,valid_until,status,revoked_at,revoked_by,revocation_reason,granted_by,created_at,updated_at";

function validUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function validation<T>(error: string): AuthorityResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

function failed<T>(error: string, failureClass: Extract<AuthorityResult<never>, { ok: false }>["failureClass"] = "persistence_failed"): AuthorityResult<T> {
  return { ok: false, error, failureClass };
}

// ─── registerAuthority ───────────────────────────────────────────────────────

export async function registerAuthority(
  input: RegisterAuthorityInput,
): Promise<AuthorityResult<AuthorityRegistrationRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");
  if (!validUuid(input.grantedBy)) return validation("grantedBy must be a UUID.");

  // Rule: scope/projectId must be consistent
  if (input.authorityScope === "project" && !input.projectId) {
    return validation("projectId is required for project-scoped authority.");
  }
  if (input.authorityScope === "workspace" && input.projectId) {
    return validation("projectId must be omitted for workspace-scoped authority.");
  }
  if (input.projectId && !validUuid(input.projectId)) return validation("projectId must be a UUID.");

  const now = new Date().toISOString();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("authority_registrations")
    .insert({
      workspace_id: input.workspaceId,
      actor_id: input.actorId,
      authority_type: input.authorityType,
      authority_scope: input.authorityScope,
      project_id: input.projectId ?? null,
      valid_from: input.validFrom ?? now,
      valid_until: input.validUntil ?? null,
      status: "active",
      granted_by: input.grantedBy,
    })
    .select(COLUMNS)
    .single<AuthorityRegistrationRecord>();

  if (error || !data) return failed("Unable to register authority.");

  const event = await createPlatformEvent({
    workspaceId: input.workspaceId,
    actorId: input.grantedBy,
    actorType: "user",
    eventType: "AUTHORITY_REGISTERED",
    eventCategory: "governance",
    source: "user_action",
    correlationId: input.correlationId ?? null,
    causationId: input.causationId ?? null,
    rawReferenceTable: "authority_registrations",
    rawReferenceId: data.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: {
      registrationId: data.id,
      actorId: input.actorId,
      authorityType: input.authorityType,
      authorityScope: input.authorityScope,
      projectId: input.projectId ?? null,
    },
  });

  if (!event.ok) return failed("Authority registered but audit event could not be recorded.", "event_emission_failed");

  return { ok: true, data };
}

// ─── revokeAuthority ────────────────────────────────────────────────────────

export async function revokeAuthority(
  input: RevokeAuthorityInput,
): Promise<AuthorityResult<AuthorityRegistrationRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.registrationId)) return validation("registrationId must be a UUID.");
  if (!validUuid(input.revokedBy)) return validation("revokedBy must be a UUID.");

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("authority_registrations")
    .select(COLUMNS)
    .eq("id", input.registrationId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle<AuthorityRegistrationRecord>();

  if (!existing) return failed("Authority registration not found.", "not_found");
  if (existing.status !== "active") return validation("Authority registration is not active.");

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("authority_registrations")
    .update({
      status: "revoked",
      revoked_at: now,
      revoked_by: input.revokedBy,
      revocation_reason: input.revocationReason ?? null,
      updated_at: now,
    })
    .eq("id", input.registrationId)
    .eq("workspace_id", input.workspaceId)
    .select(COLUMNS)
    .single<AuthorityRegistrationRecord>();

  if (error || !data) return failed("Unable to revoke authority.");

  const event = await createPlatformEvent({
    workspaceId: input.workspaceId,
    actorId: input.revokedBy,
    actorType: "user",
    eventType: "AUTHORITY_REVOKED",
    eventCategory: "governance",
    source: "user_action",
    correlationId: input.correlationId ?? null,
    causationId: input.causationId ?? null,
    rawReferenceTable: "authority_registrations",
    rawReferenceId: data.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: {
      registrationId: data.id,
      actorId: existing.actor_id,
      authorityType: existing.authority_type,
      revocationReason: input.revocationReason ?? null,
    },
  });

  if (!event.ok) return failed("Authority revoked but audit event could not be recorded.", "event_emission_failed");

  return { ok: true, data };
}

// ─── getActiveAuthority ──────────────────────────────────────────────────────

export async function getActiveAuthority(
  input: CheckAuthorityInput,
): Promise<AuthorityResult<AuthorityRegistrationRecord | null>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const atTime = input.atTime ?? new Date().toISOString();

  const supabase = await createSupabaseServerClient();

  // Try project-scoped first, then workspace-scoped
  const scopes: Array<{ scope: string; projectId: string | null }> = input.projectId
    ? [
        { scope: "project", projectId: input.projectId },
        { scope: "workspace", projectId: null },
      ]
    : [{ scope: "workspace", projectId: null }];

  for (const { scope, projectId } of scopes) {
    let query = supabase
      .from("authority_registrations")
      .select(COLUMNS)
      .eq("workspace_id", input.workspaceId)
      .eq("actor_id", input.actorId)
      .eq("authority_type", input.authorityType)
      .eq("authority_scope", scope)
      .eq("status", "active")
      .lte("valid_from", atTime);

    if (projectId) {
      query = query.eq("project_id", projectId);
    } else {
      query = query.is("project_id", null);
    }

    const { data } = await query.maybeSingle<AuthorityRegistrationRecord>();

    if (data) {
      if (data.valid_until && data.valid_until < atTime) continue;
      return { ok: true, data };
    }
  }

  return { ok: true, data: null };
}

// ─── listAuthoritiesForActor ─────────────────────────────────────────────────

export async function listAuthoritiesForActor(input: {
  workspaceId: string;
  actorId: string;
}): Promise<AuthorityResult<AuthorityRegistrationRecord[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("authority_registrations")
    .select(COLUMNS)
    .eq("workspace_id", input.workspaceId)
    .eq("actor_id", input.actorId)
    .order("created_at", { ascending: false })
    .returns<AuthorityRegistrationRecord[]>();

  if (error) return failed("Unable to list authorities.");
  return { ok: true, data: data ?? [] };
}

// ─── listAllAuthorities ──────────────────────────────────────────────────────

export async function listAllAuthorities(input: {
  workspaceId: string;
  authorityType?: AuthorityType;
  status?: "active" | "revoked" | "expired";
}): Promise<AuthorityResult<AuthorityRegistrationRecord[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("authority_registrations")
    .select(COLUMNS)
    .eq("workspace_id", input.workspaceId);

  if (input.authorityType) query = query.eq("authority_type", input.authorityType);
  if (input.status) query = query.eq("status", input.status);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .returns<AuthorityRegistrationRecord[]>();

  if (error) return failed("Unable to list authorities.");
  return { ok: true, data: data ?? [] };
}
