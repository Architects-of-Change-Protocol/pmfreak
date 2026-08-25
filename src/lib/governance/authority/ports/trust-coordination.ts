// PMFreak port: revocation lookup across claims, keys, delegations and grants.
// OWNERSHIP: PMFreak. Not Soberania Protocol, not Frontera.
// Upstream's nearest surface is RevocationLookup, reachable only via a @deprecated
// alias and differently shaped. Not adopted. Revocation is fail-closed and backed
// by PMFreak tables.

export interface TrustCoordinationPort {
  getRevocationReason(input: {
    trustDomain: string;
    keyId?: string;
    claimHash?: string;
    delegationId?: string;
    grantId?: string;
  }): Promise<string | null>;
}
