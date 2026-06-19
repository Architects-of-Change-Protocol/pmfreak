import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignatureStatus } from "./signature-engine";
import type {
  ConstitutionalRatificationPolicyRecord,
  RatificationResult,
  RatificationValidationResult,
  RatifyEntityInput,
  SignatureAuthorityType,
  UpsertRatificationPolicyInput,
  ValidateRatificationInput,
} from "./types";

// ─── Column projection ───────────────────────────────────────────────────────

const policyColumns =
  "id,workspace_id,entity_type,minimum_signatures,required_authorities,allow_unanimous_override,created_at";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(v);
}

function validation<T>(error: string): RatificationResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

function failed<T>(error: string, failureClass: Extract<RatificationResult<never>, { ok: false }>["failureClass"] = "persistence_failed"): RatificationResult<T> {
  return { ok: false, error, failureClass };
}

// ─── getRatificationPolicy ───────────────────────────────────────────────────

export async function getRatificationPolicy(input: {
  workspaceId: string;
  entityType: "constitution" | "amendment" | "decision";
}): Promise<RatificationResult<ConstitutionalRatificationPolicyRecord | null>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_ratification_policies")
    .select(policyColumns)
    .eq("workspace_id", input.workspaceId)
    .eq("entity_type", input.entityType)
    .maybeSingle<ConstitutionalRatificationPolicyRecord>();

  if (error) return failed("Unable to retrieve ratification policy.");
  return { ok: true, data: data ?? null };
}

// ─── upsertRatificationPolicy ────────────────────────────────────────────────

export async function upsertRatificationPolicy(
  input: UpsertRatificationPolicyInput,
): Promise<RatificationResult<ConstitutionalRatificationPolicyRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (input.minimumSignatures < 1) return validation("minimumSignatures must be >= 1.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_ratification_policies")
    .upsert(
      {
        workspace_id: input.workspaceId,
        entity_type: input.entityType,
        minimum_signatures: input.minimumSignatures,
        required_authorities: input.requiredAuthorities,
        allow_unanimous_override: input.allowUnanimousOverride ?? false,
      },
      { onConflict: "workspace_id,entity_type" },
    )
    .select(policyColumns)
    .single<ConstitutionalRatificationPolicyRecord>();

  if (error || !data) return failed("Unable to upsert ratification policy.");
  return { ok: true, data };
}

// ─── validateRatification ────────────────────────────────────────────────────

export async function validateRatification(
  input: ValidateRatificationInput,
): Promise<RatificationResult<RatificationValidationResult>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.entityId)) return validation("entityId must be a UUID.");

  const signaturesResult = await getSignatureStatus({
    workspaceId: input.workspaceId,
    entityType: input.entityType,
    entityId: input.entityId,
  });
  if (!signaturesResult.ok) return signaturesResult;

  const signatures = signaturesResult.data;

  // Rule 4: withdrawn signatures do not count toward ratification
  const signedSignatures = signatures.filter((s) => s.status === "signed");
  const signedCount = signedSignatures.length;

  const policyResult = await getRatificationPolicy({
    workspaceId: input.workspaceId,
    entityType: input.entityType,
  });
  if (!policyResult.ok) return policyResult;

  // Default policy: 1 signature required, no specific authority required
  const policy = policyResult.data;
  const minimumRequired = policy?.minimum_signatures ?? 1;
  const requiredAuthorities: SignatureAuthorityType[] = policy?.required_authorities ?? [];

  const signedAuthorityTypes = new Set(signedSignatures.map((s) => s.authority_type));

  const missingAuthorities = requiredAuthorities.filter(
    (a) => !signedAuthorityTypes.has(a),
  );

  const requiredAuthoritiesMet = missingAuthorities.length === 0;

  // Unanimous override: if ALL pending/signed are signed, override min requirement
  const unanimousOverride =
    (policy?.allow_unanimous_override ?? false) &&
    signatures.length > 0 &&
    signatures.every((s) => s.status === "signed");

  const meetsMinimum = unanimousOverride || signedCount >= minimumRequired;
  const valid = meetsMinimum && requiredAuthoritiesMet;

  return {
    ok: true,
    data: {
      valid,
      reason: valid
        ? "Ratification requirements are met."
        : !meetsMinimum
          ? `Insufficient signatures: ${signedCount} of ${minimumRequired} required.`
          : `Missing required authorities: ${missingAuthorities.join(", ")}.`,
      signedCount,
      minimumRequired,
      requiredAuthoritiesMet,
      missingAuthorities,
    },
  };
}

// ─── ratifyEntity ────────────────────────────────────────────────────────────

export async function ratifyEntity(
  input: RatifyEntityInput,
): Promise<RatificationResult<{ entityType: string; entityId: string; ratifiedAt: string }>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.entityId)) return validation("entityId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  // Rule 5: ratification requires fulfilling the policy
  const validationResult = await validateRatification({
    workspaceId: input.workspaceId,
    entityType: input.entityType,
    entityId: input.entityId,
  });
  if (!validationResult.ok) return validationResult;

  if (!validationResult.data.valid) {
    // Emit ratification failed event
    await createPlatformEvent({
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      actorType: "user",
      eventType: "CONSTITUTIONAL_RATIFICATION_FAILED",
      eventCategory: "governance",
      source: "user_action",
      correlationId: input.entityId,
      causationId: input.correlationId ?? null,
      rawReferenceTable: entityTypeToTable(input.entityType),
      rawReferenceId: input.entityId,
      learningEligible: false,
      visibility: "workspace",
      sensitivityLevel: "internal",
      eventPayload: {
        entityType: input.entityType,
        entityId: input.entityId,
        reason: validationResult.data.reason,
        signedCount: validationResult.data.signedCount,
        minimumRequired: validationResult.data.minimumRequired,
        missingAuthorities: validationResult.data.missingAuthorities,
      },
    });

    return failed(validationResult.data.reason, "governance_violation");
  }

  const ratifiedAt = new Date().toISOString();

  // Emit ratification succeeded event
  const event = await createPlatformEvent({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    actorType: "user",
    eventType: "CONSTITUTIONAL_ENTITY_RATIFIED",
    eventCategory: "governance",
    source: "user_action",
    correlationId: input.entityId,
    causationId: input.correlationId ?? null,
    rawReferenceTable: entityTypeToTable(input.entityType),
    rawReferenceId: input.entityId,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: {
      entityType: input.entityType,
      entityId: input.entityId,
      signedCount: validationResult.data.signedCount,
      ratifiedAt,
    },
  });

  if (!event.ok) return failed(event.error, "event_emission_failed");

  return { ok: true, data: { entityType: input.entityType, entityId: input.entityId, ratifiedAt } };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function entityTypeToTable(entityType: string): string {
  switch (entityType) {
    case "constitution": return "project_constitutions";
    case "amendment": return "constitution_amendments";
    case "decision": return "constitutional_decisions";
    default: return entityType;
  }
}
