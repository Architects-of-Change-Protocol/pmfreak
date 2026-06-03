// PMFreak adapter: AgentAttestationPort implementation.
// Delegates to PMFreak's verifyAgentAttestation including replay protection and revocation.
import { verifyAgentAttestation } from "@/lib/security/agent-attestation";
import { AccessDeniedError } from "@/lib/security/access-guards";
import type { Permission } from "@/lib/security/rbac";
import type { AgentAttestationPort } from "@/aoc/protocol/ports/agent-attestation";
import { AocAccessDeniedError } from "@/aoc/protocol/ports/access-verification";

export class PmfreakAgentAttestationAdapter implements AgentAttestationPort {
  async verifyAttestation(input: {
    token: string;
    expectedAgentId: string;
    workspaceId: string;
    permission: string;
    projectId?: string;
  }) {
    try {
      const claims = await verifyAgentAttestation({
        token: input.token,
        expectedAgentId: input.expectedAgentId,
        workspaceId: input.workspaceId,
        permission: input.permission as Permission,
        projectId: input.projectId,
      });
      return { agentId: claims.agentId, workspaceId: claims.workspaceId };
    } catch (error) {
      if (error instanceof AccessDeniedError) {
        throw new AocAccessDeniedError(error.message, error.metadata);
      }
      throw error;
    }
  }
}
