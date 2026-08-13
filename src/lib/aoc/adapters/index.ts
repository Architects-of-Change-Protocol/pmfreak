// PMFreak adapter bootstrap.
// Call registerPmfreakAocAdapters() during application startup before any AOC runtime
// functions are invoked. In Next.js this is typically done in a server-side bootstrap
// module that runs before route handlers execute.
//
// PMFreak is the host application and is permitted to depend on all its own internal modules.
// AOC runtime code must NEVER import from @/lib/security/* or other PMFreak modules directly.

import { registerAocAdapters } from "@/aoc/runtime/adapters";
import { PmfreakSecurityAuditAdapter } from "./security-audit";
import { PmfreakPrivilegedDbAdapter } from "./privileged-db";
import { PmfreakAccessVerificationAdapter } from "./access-verification";
import { PmfreakAgentAttestationAdapter } from "./agent-attestation";
import { PmfreakPolicyEvaluatorAdapter } from "./policy-evaluation";
import { PmfreakTrustDomainAdapter } from "./trust-domain";
import { PmfreakTrustCoordinationAdapter } from "./trust-coordination";

export function registerPmfreakAocAdapters(): void {
  registerAocAdapters({
    securityAudit: new PmfreakSecurityAuditAdapter(),
    privilegedDb: new PmfreakPrivilegedDbAdapter(),
    accessVerification: new PmfreakAccessVerificationAdapter(),
    agentAttestation: new PmfreakAgentAttestationAdapter(),
    policyEvaluator: new PmfreakPolicyEvaluatorAdapter(),
    trustDomain: new PmfreakTrustDomainAdapter(),
    trustCoordination: new PmfreakTrustCoordinationAdapter(),
  });
}

export { PmfreakSecurityAuditAdapter } from "./security-audit";
export { PmfreakPrivilegedDbAdapter } from "./privileged-db";
export { PmfreakAccessVerificationAdapter } from "./access-verification";
export { PmfreakAgentAttestationAdapter } from "./agent-attestation";
export { PmfreakPolicyEvaluatorAdapter, evaluatePolicyDecision } from "./policy-evaluation";
export { PmfreakTrustDomainAdapter } from "./trust-domain";
export { PmfreakTrustCoordinationAdapter } from "./trust-coordination";
