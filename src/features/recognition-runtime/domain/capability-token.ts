// AOC Recognition Runtime — Recognition Capability Token domain model
//
// RecognitionCapabilityToken is the canonical capability token type for
// Recognition Runtime. Do not rename this type and do not redefine it
// elsewhere — later sprints (Authority Graph, Approval Runtime) reference
// it by this name.

export type CapabilityTokenStatus = "active" | "revoked" | "expired";

export type RecognitionCapabilityToken = {
  id: string;

  actorId: string;
  trustDomainId: string;
  passportId: string;

  capability: string;
  resourceScope: string;

  status: CapabilityTokenStatus;

  issuedAt: string;
  expiresAt?: string;
  revokedAt?: string;

  metadata?: Record<string, unknown>;
};
