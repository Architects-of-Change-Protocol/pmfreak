// PMFreak governance ports — dependency-inversion boundary.
// OWNERSHIP: PMFreak. Not Soberania Protocol, not Frontera.
// Each port states what PMFreak's governance domain needs from PMFreak's own
// infrastructure (Supabase, audit store, key material). They are NOT upstream
// contracts: where a same-named upstream provider exists it is reachable only
// through an alias upstream marks @deprecated and is differently shaped, so none
// was adopted. See governance-ownership.lock.json.
// Implementations live in @/lib/aoc/adapters.

export type { SecurityAuditPort, GovernanceAuditEventType, GovernanceAuditEventPayload } from "./security-audit";
export type { PrivilegedDbPort, PrivilegedDbContext, PrivilegedDbClient } from "./privileged-db";
export type { AccessVerificationPort } from "./access-verification";
export { GovernanceAccessDeniedError } from "./access-verification";
export type { AgentAttestationPort } from "./agent-attestation";
export type { PolicyEvaluatorPort, PolicyEvaluationOutcome, PolicyEvaluationInput, PolicyEvaluationResult } from "./policy-evaluation";
export type { TrustDomainPort, TrustKeyRecord, TrustDomainRecord, TrustVerificationResult } from "./trust-domain";
export type { TrustCoordinationPort } from "./trust-coordination";

export type { CapabilityClaimPorts, CapabilitySignerPort } from "./capability-verification";
