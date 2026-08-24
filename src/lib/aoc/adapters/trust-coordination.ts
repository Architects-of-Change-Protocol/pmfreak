// PMFreak adapter: TrustCoordinationPort implementation.
// Delegates to PMFreak's trust-coordination module for revocation registry lookups.
import { getRevocationReason } from "@/lib/security/trust-coordination";
import type { TrustCoordinationPort } from "@/lib/governance/authority/ports/trust-coordination";

export class PmfreakTrustCoordinationAdapter implements TrustCoordinationPort {
  async getRevocationReason(input: {
    trustDomain: string;
    keyId?: string;
    claimHash?: string;
    delegationId?: string;
    grantId?: string;
  }): Promise<string | null> {
    return getRevocationReason(input);
  }
}
