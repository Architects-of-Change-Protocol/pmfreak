// PMFreak port: agent attestation verification.
// OWNERSHIP: PMFreak. Not Soberania Protocol, not Frontera.
// No public upstream export. Covers token signature, replay protection, revocation
// and scope binding for PMFreak agents.

export interface AgentAttestationPort {
  verifyAttestation(input: {
    token: string;
    expectedAgentId: string;
    workspaceId: string;
    permission: string;
    projectId?: string;
  }): Promise<{ agentId: string; workspaceId: string }>;
}
