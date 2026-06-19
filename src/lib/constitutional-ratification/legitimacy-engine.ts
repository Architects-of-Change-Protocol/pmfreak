import { createPlatformEvent } from "@/lib/platform-events";
import { getSignatureStatus } from "./signature-engine";
import { getRatificationPolicy } from "./ratification-engine";
import type {
  LegitimacyAssessment,
  LegitimacyStatus,
  RatifiableEntityType,
  RatificationResult,
  SignatureAuthorityType,
} from "./types";

// ─── calculateLegitimacyStatus ───────────────────────────────────────────────

export async function calculateLegitimacyStatus(input: {
  workspaceId: string;
  entityType: RatifiableEntityType;
  entityId: string;
  actorId?: string;
  emitEvent?: boolean;
}): Promise<RatificationResult<LegitimacyAssessment>> {
  const signaturesResult = await getSignatureStatus({
    workspaceId: input.workspaceId,
    entityType: input.entityType,
    entityId: input.entityId,
  });
  if (!signaturesResult.ok) return signaturesResult;

  const signatures = signaturesResult.data;

  if (signatures.length === 0) {
    const assessment: LegitimacyAssessment = {
      entityType: input.entityType,
      entityId: input.entityId,
      status: "unratified",
      signedCount: 0,
      rejectedCount: 0,
      pendingCount: 0,
      minimumRequired: 1,
      requiredAuthoritiesMet: false,
      missingAuthorities: [],
      signatures: [],
      assessedAt: new Date().toISOString(),
    };
    return { ok: true, data: assessment };
  }

  const policyResult = await getRatificationPolicy({
    workspaceId: input.workspaceId,
    entityType: input.entityType,
  });
  if (!policyResult.ok) return policyResult;

  const policy = policyResult.data;
  const minimumRequired = policy?.minimum_signatures ?? 1;
  const requiredAuthorities: SignatureAuthorityType[] = policy?.required_authorities ?? [];

  const signedSignatures = signatures.filter((s) => s.status === "signed");
  const rejectedSignatures = signatures.filter((s) => s.status === "rejected");
  const pendingSignatures = signatures.filter((s) => s.status === "pending");
  const expiredSignatures = signatures.filter((s) => s.status === "expired");

  const signedCount = signedSignatures.length;
  const rejectedCount = rejectedSignatures.length;
  const pendingCount = pendingSignatures.length;

  const signedAuthorityTypes = new Set(signedSignatures.map((s) => s.authority_type));
  const missingAuthorities = requiredAuthorities.filter((a) => !signedAuthorityTypes.has(a));
  const requiredAuthoritiesMet = missingAuthorities.length === 0;

  // Unanimous override
  const unanimousOverride =
    (policy?.allow_unanimous_override ?? false) &&
    signatures.length > 0 &&
    signatures.every((s) => s.status === "signed");

  const meetsMinimum = unanimousOverride || signedCount >= minimumRequired;

  let status: LegitimacyStatus;

  if (expiredSignatures.length === signatures.length) {
    status = "expired";
  } else if (rejectedSignatures.length > 0 && signedCount === 0 && pendingCount === 0) {
    status = "rejected";
  } else if (meetsMinimum && requiredAuthoritiesMet) {
    status = "ratified";
  } else if (signedCount > 0 && signedCount < minimumRequired) {
    status = "partially_ratified";
  } else if (signedCount === 0) {
    status = "unratified";
  } else {
    // Has enough signatures but missing required authorities
    status = "partially_ratified";
  }

  const assessedAt = new Date().toISOString();
  const assessment: LegitimacyAssessment = {
    entityType: input.entityType,
    entityId: input.entityId,
    status,
    signedCount,
    rejectedCount,
    pendingCount,
    minimumRequired,
    requiredAuthoritiesMet,
    missingAuthorities,
    signatures,
    assessedAt,
  };

  if (input.emitEvent && input.actorId) {
    await createPlatformEvent({
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      actorType: "user",
      eventType: "CONSTITUTIONAL_LEGITIMACY_UPDATED",
      eventCategory: "governance",
      source: "user_action",
      correlationId: input.entityId,
      causationId: null,
      rawReferenceTable: null,
      rawReferenceId: input.entityId,
      learningEligible: false,
      visibility: "workspace",
      sensitivityLevel: "internal",
      eventPayload: {
        entityType: input.entityType,
        entityId: input.entityId,
        legitimacyStatus: status,
        signedCount,
        minimumRequired,
        assessedAt,
      },
    });
  }

  return { ok: true, data: assessment };
}
