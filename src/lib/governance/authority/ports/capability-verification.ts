// PMFreak port bundle for capability-claim issuance and verification.
// OWNERSHIP: PMFreak. Not Soberania Protocol, not Frontera.
// No upstream claim-signing port bundle exists. Aggregates the four ports claim
// issuance and verification require.

import type { SecurityAuditPort } from "./security-audit";
import type { TrustCoordinationPort } from "./trust-coordination";
import type { TrustDomainPort, TrustKeyRecord } from "./trust-domain";

export interface CapabilitySignerPort {
  resolvePrivateSigningKey(input: {
    trustDomain: string;
    key: TrustKeyRecord;
  }): unknown;
}

export interface CapabilityClaimPorts {
  trustDomain: TrustDomainPort;
  trustCoordination: TrustCoordinationPort;
  securityAudit: Pick<SecurityAuditPort, "logEvent">;
  signer: CapabilitySignerPort;
}
