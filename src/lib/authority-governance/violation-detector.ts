import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveAuthority } from "./authority-registry";
import { getActiveDelegation, getDelegationChain } from "./delegation-engine";
import type {
  AuthorityResult,
  GovernanceViolationRecord,
  DetectViolationInput,
  ResolveViolationInput,
  AuthorityCheckContext,
  ViolationCheckResult,
  AuthorityType,
} from "./types";

const COLUMNS =
  "id,workspace_id,violation_type,action_type,action_entity_type,action_entity_id,actor_id,actor_authority,required_authority,authority_id,severity,status,resolved_at,resolved_by,resolution_notes,detected_at,created_at,updated_at";

function validUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function validation<T>(error: string): AuthorityResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

function failed<T>(error: string, failureClass: Extract<AuthorityResult<never>, { ok: false }>["failureClass"] = "persistence_failed"): AuthorityResult<T> {
  return { ok: false, error, failureClass };
}

// ─── checkAuthorityForAction ─────────────────────────────────────────────────
//
// Core gate: determines if an actor is authorized for an action.
// Returns a ViolationCheckResult without persisting anything.

export async function checkAuthorityForAction(
  ctx: AuthorityCheckContext,
): Promise<AuthorityResult<ViolationCheckResult>> {
  if (!validUuid(ctx.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(ctx.actorId)) return validation("actorId must be a UUID.");

  const atTime = ctx.atTime ?? new Date().toISOString();

  // Check direct registration
  const directAuth = await getActiveAuthority({
    workspaceId: ctx.workspaceId,
    actorId: ctx.actorId,
    authorityType: ctx.claimedAuthority,
    projectId: ctx.projectId,
    atTime,
  });

  if (!directAuth.ok) return directAuth;

  if (directAuth.data) {
    // Verify not expired (valid_until check already in getActiveAuthority)
    return {
      ok: true,
      data: {
        authorized: true,
        violationType: null,
        reason: `Actor holds active ${ctx.claimedAuthority} authority.`,
        authorityRegistration: directAuth.data,
      },
    };
  }

  // Check delegation
  const delegation = await getActiveDelegation({
    workspaceId: ctx.workspaceId,
    delegateId: ctx.actorId,
    delegateAuthority: ctx.claimedAuthority,
    projectId: ctx.projectId,
    atTime,
  });

  if (!delegation.ok) return delegation;

  if (delegation.data) {
    // Validate the full delegation lineage: every link in the chain must still be
    // active, and the root must trace back to an active direct registration.
    const chainResult = await getDelegationChain({
      workspaceId: ctx.workspaceId,
      delegationId: delegation.data.id,
    });

    if (chainResult.ok && chainResult.data.length > 0) {
      const root = chainResult.data[0];
      const rootAuth = await getActiveAuthority({
        workspaceId: ctx.workspaceId,
        actorId: root.delegator_id,
        authorityType: root.delegator_authority as typeof ctx.claimedAuthority,
        projectId: ctx.projectId,
        atTime,
      });

      // All links must be active (getDelegationChain only returns linked rows; each
      // was stored with status but we re-check the chain nodes here)
      const allLinksActive = chainResult.data.every(
        (link) =>
          link.status === "active" &&
          (link.valid_until == null || link.valid_until > atTime),
      );

      if (rootAuth.ok && rootAuth.data && allLinksActive) {
        return {
          ok: true,
          data: {
            authorized: true,
            violationType: null,
            reason: `Actor holds ${ctx.claimedAuthority} authority via validated delegation chain.`,
            authorityRegistration: null,
          },
        };
      }

      // Chain is broken or root registration is gone
      return {
        ok: true,
        data: {
          authorized: false,
          violationType: "revoked_authority",
          reason: `Delegation chain for ${ctx.claimedAuthority} is no longer valid (root or intermediate authority revoked/expired).`,
          authorityRegistration: null,
        },
      };
    }
  }

  // Check if actor ever had the authority but it's now revoked/expired
  const supabase = await createSupabaseServerClient();
  const { data: historicAuth } = await supabase
    .from("authority_registrations")
    .select("id,status,valid_until")
    .eq("workspace_id", ctx.workspaceId)
    .eq("actor_id", ctx.actorId)
    .eq("authority_type", ctx.claimedAuthority)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; status: string; valid_until: string | null }>();

  if (historicAuth) {
    if (historicAuth.status === "revoked") {
      return {
        ok: true,
        data: {
          authorized: false,
          violationType: "revoked_authority",
          reason: `Actor's ${ctx.claimedAuthority} authority has been revoked.`,
          authorityRegistration: null,
        },
      };
    }
    if (historicAuth.valid_until && historicAuth.valid_until < atTime) {
      return {
        ok: true,
        data: {
          authorized: false,
          violationType: "expired_authority",
          reason: `Actor's ${ctx.claimedAuthority} authority expired at ${historicAuth.valid_until}.`,
          authorityRegistration: null,
        },
      };
    }
  }

  return {
    ok: true,
    data: {
      authorized: false,
      violationType: "missing_authority_registration",
      reason: `Actor has no ${ctx.claimedAuthority} authority registration.`,
      authorityRegistration: null,
    },
  };
}

// ─── detectViolation ─────────────────────────────────────────────────────────

export async function detectViolation(
  input: DetectViolationInput,
): Promise<AuthorityResult<GovernanceViolationRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("governance_violations")
    .insert({
      workspace_id: input.workspaceId,
      violation_type: input.violationType,
      action_type: input.actionType,
      action_entity_type: input.actionEntityType,
      action_entity_id: input.actionEntityId,
      actor_id: input.actorId,
      actor_authority: input.actorAuthority ?? null,
      required_authority: input.requiredAuthority ?? null,
      authority_id: input.authorityId ?? null,
      severity: input.severity ?? "high",
      status: "open",
      detected_at: now,
    })
    .select(COLUMNS)
    .single<GovernanceViolationRecord>();

  if (error || !data) return failed("Unable to record governance violation.");

  await createPlatformEvent({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    actorType: "user",
    eventType: "GOVERNANCE_VIOLATION_DETECTED",
    eventCategory: "governance",
    source: "system",
    correlationId: input.correlationId ?? null,
    causationId: input.causationId ?? null,
    rawReferenceTable: "governance_violations",
    rawReferenceId: data.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "confidential",
    eventPayload: {
      violationId: data.id,
      violationType: input.violationType,
      actionType: input.actionType,
      actionEntityType: input.actionEntityType,
      actionEntityId: input.actionEntityId,
      actorId: input.actorId,
      severity: data.severity,
    },
  });

  return { ok: true, data };
}

// ─── resolveViolation ────────────────────────────────────────────────────────

export async function resolveViolation(
  input: ResolveViolationInput,
): Promise<AuthorityResult<GovernanceViolationRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.violationId)) return validation("violationId must be a UUID.");
  if (!validUuid(input.resolvedBy)) return validation("resolvedBy must be a UUID.");

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("governance_violations")
    .update({
      status: "resolved",
      resolved_at: now,
      resolved_by: input.resolvedBy,
      resolution_notes: input.resolutionNotes ?? null,
      updated_at: now,
    })
    .eq("id", input.violationId)
    .eq("workspace_id", input.workspaceId)
    .select(COLUMNS)
    .single<GovernanceViolationRecord>();

  if (error || !data) return failed("Unable to resolve governance violation.");

  await createPlatformEvent({
    workspaceId: input.workspaceId,
    actorId: input.resolvedBy,
    actorType: "user",
    eventType: "GOVERNANCE_VIOLATION_RESOLVED",
    eventCategory: "governance",
    source: "user_action",
    correlationId: input.correlationId ?? null,
    causationId: input.causationId ?? null,
    rawReferenceTable: "governance_violations",
    rawReferenceId: data.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: {
      violationId: data.id,
      resolvedBy: input.resolvedBy,
      resolutionNotes: input.resolutionNotes ?? null,
    },
  });

  return { ok: true, data };
}

// ─── listOpenViolations ──────────────────────────────────────────────────────

export async function listOpenViolations(input: {
  workspaceId: string;
  severity?: "low" | "medium" | "high" | "critical";
}): Promise<AuthorityResult<GovernanceViolationRecord[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("governance_violations")
    .select(COLUMNS)
    .eq("workspace_id", input.workspaceId)
    .in("status", ["open", "acknowledged"]);

  if (input.severity) query = query.eq("severity", input.severity);

  const { data, error } = await query
    .order("detected_at", { ascending: false })
    .returns<GovernanceViolationRecord[]>();

  if (error) return failed("Unable to list violations.");
  return { ok: true, data: data ?? [] };
}

// ─── checkAndDetectViolation ─────────────────────────────────────────────────
// One-shot: checks authority and records a violation if unauthorized.

export async function checkAndDetectViolation(
  ctx: AuthorityCheckContext,
): Promise<AuthorityResult<{ authorized: boolean; violationId: string | null; reason: string }>> {
  const check = await checkAuthorityForAction(ctx);
  if (!check.ok) return check;

  if (check.data.authorized) {
    return { ok: true, data: { authorized: true, violationId: null, reason: check.data.reason } };
  }

  // Map action type to violation type
  const violationTypeMap: Record<string, Extract<GovernanceViolationRecord["violation_type"], string>> = {
    approve_decision: "unauthorized_approval",
    ratify_constitution: "unauthorized_ratification",
    ratify_amendment: "unauthorized_ratification",
    ratify_decision: "unauthorized_ratification",
    amend_constitution: "unauthorized_amendment",
  };

  const violationType =
    check.data.violationType ??
    violationTypeMap[ctx.actionType] ??
    "missing_authority_registration";

  const violation = await detectViolation({
    workspaceId: ctx.workspaceId,
    violationType,
    actionType: ctx.actionType,
    actionEntityType: ctx.actionEntityType,
    actionEntityId: ctx.actionEntityId,
    actorId: ctx.actorId,
    actorAuthority: ctx.claimedAuthority,
    requiredAuthority: ctx.claimedAuthority,
    severity: "high",
  });

  if (!violation.ok) return violation;

  return {
    ok: true,
    data: { authorized: false, violationId: violation.data.id, reason: check.data.reason },
  };
}
