import type {
  ConstitutionalRatificationEventType,
} from "@/lib/platform-events/types";
import type {
  RatifiableEntityType,
  SignatureAuthorityType,
  SignatureStatus,
  SignatureRequestStatus,
} from "@/lib/db/database-contract";

export type { RatifiableEntityType, SignatureAuthorityType, SignatureStatus, SignatureRequestStatus };

export type RatificationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: "validation_failed" | "not_found" | "persistence_failed" | "event_emission_failed" | "governance_violation" };

// ─── Signature record ────────────────────────────────────────────────────────

export type ConstitutionalSignatureRecord = {
  id: string;
  workspace_id: string;
  entity_type: RatifiableEntityType;
  entity_id: string;
  entity_version: number;
  authority_type: SignatureAuthorityType;
  authority_id: string;
  status: SignatureStatus;
  signature_hash: string | null;
  comments: string | null;
  requested_at: string;
  signed_at: string | null;
  rejected_at: string | null;
  expired_at: string | null;
  withdrawn_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

// ─── Signature request record ────────────────────────────────────────────────

export type ConstitutionalSignatureRequestRecord = {
  id: string;
  workspace_id: string;
  entity_type: RatifiableEntityType;
  entity_id: string;
  requested_authority: SignatureAuthorityType;
  requested_by: string;
  status: SignatureRequestStatus;
  deadline: string | null;
  created_at: string;
  updated_at: string;
};

// ─── Ratification policy record ──────────────────────────────────────────────

export type ConstitutionalRatificationPolicyRecord = {
  id: string;
  workspace_id: string;
  entity_type: RatifiableEntityType;
  minimum_signatures: number;
  required_authorities: SignatureAuthorityType[];
  allow_unanimous_override: boolean;
  created_at: string;
};

// ─── Legitimacy status ───────────────────────────────────────────────────────

export type LegitimacyStatus =
  | "unratified"
  | "partially_ratified"
  | "ratified"
  | "rejected"
  | "expired";

export type LegitimacyAssessment = {
  entityType: RatifiableEntityType;
  entityId: string;
  status: LegitimacyStatus;
  signedCount: number;
  rejectedCount: number;
  pendingCount: number;
  minimumRequired: number;
  requiredAuthoritiesMet: boolean;
  missingAuthorities: SignatureAuthorityType[];
  signatures: ConstitutionalSignatureRecord[];
  assessedAt: string;
};

// ─── Ratification validation result ─────────────────────────────────────────

export type RatificationValidationResult = {
  valid: boolean;
  reason: string;
  signedCount: number;
  minimumRequired: number;
  requiredAuthoritiesMet: boolean;
  missingAuthorities: SignatureAuthorityType[];
};

// ─── Input types ─────────────────────────────────────────────────────────────

export type RequestSignatureInput = {
  workspaceId: string;
  entityType: RatifiableEntityType;
  entityId: string;
  entityVersion: number;
  authorityType: SignatureAuthorityType;
  authorityId: string;
  requestedBy: string;
  deadline?: string | null;
  comments?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
};

export type SignEntityInput = {
  workspaceId: string;
  signatureId: string;
  actorId: string;
  comments?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
};

export type RejectSignatureInput = {
  workspaceId: string;
  signatureId: string;
  actorId: string;
  comments?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
};

export type WithdrawSignatureInput = {
  workspaceId: string;
  signatureId: string;
  actorId: string;
  comments?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
};

export type ExpireSignatureInput = {
  workspaceId: string;
  signatureId: string;
  actorId: string;
  correlationId?: string | null;
  causationId?: string | null;
};

export type GetSignatureStatusInput = {
  workspaceId: string;
  entityType: RatifiableEntityType;
  entityId: string;
};

export type ValidateRatificationInput = {
  workspaceId: string;
  entityType: RatifiableEntityType;
  entityId: string;
};

export type RatifyEntityInput = {
  workspaceId: string;
  entityType: RatifiableEntityType;
  entityId: string;
  actorId: string;
  correlationId?: string | null;
  causationId?: string | null;
};

export type UpsertRatificationPolicyInput = {
  workspaceId: string;
  entityType: RatifiableEntityType;
  minimumSignatures: number;
  requiredAuthorities: SignatureAuthorityType[];
  allowUnanimousOverride?: boolean;
};

// ─── Explain output ──────────────────────────────────────────────────────────

export type RatificationEventName = ConstitutionalRatificationEventType;

export type ConstitutionalRatificationExplanation = {
  overview: string;
  ratifiableEntities: RatifiableEntityType[];
  signatureAuthorities: SignatureAuthorityType[];
  signatureStates: SignatureStatus[];
  legitimacyStates: LegitimacyStatus[];
  nonRepudiation: {
    description: string;
    guarantees: string[];
  };
  ratificationProcess: string[];
  hashingDescription: string;
  policies: string;
  auditEvents: RatificationEventName[];
  businessRules: string[];
};
