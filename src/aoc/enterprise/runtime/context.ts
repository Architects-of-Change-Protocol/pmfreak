// AOC Enterprise Runtime: explicit runtime composition context.
// Runtime internals consume this object instead of resolving adapters from the
// process-wide registry. The composition root is responsible for building it.

import type { AccessVerificationPort } from "@pmfreak/aoc-protocol-internal/ports/access-verification";
import type { AgentAttestationPort } from "@pmfreak/aoc-protocol-internal/ports/agent-attestation";
import type { CapabilityClaimPorts } from "@pmfreak/aoc-protocol-internal/ports/capability-verification";
import type { PolicyEvaluatorPort } from "@pmfreak/aoc-protocol-internal/ports/policy-evaluation";
import type { PrivilegedDbPort } from "@pmfreak/aoc-protocol-internal/ports/privileged-db";
import type { SecurityAuditPort } from "@pmfreak/aoc-protocol-internal/ports/security-audit";
import type { TrustCoordinationPort } from "@pmfreak/aoc-protocol-internal/ports/trust-coordination";
import type { TrustDomainPort } from "@pmfreak/aoc-protocol-internal/ports/trust-domain";

export type RuntimeSignerContext = CapabilityClaimPorts["signer"];

export interface RuntimeSecurityContext {
  securityAudit: SecurityAuditPort;
  accessVerification: AccessVerificationPort;
  agentAttestation: AgentAttestationPort;
  signer: RuntimeSignerContext;
}

export interface RuntimeGovernanceContext {
  policyEvaluator: PolicyEvaluatorPort;
  privilegedDb: PrivilegedDbPort;
}

export interface RuntimeCapabilityContext {
  trustDomain: TrustDomainPort;
  trustCoordination: TrustCoordinationPort;
}

export interface RuntimeAuditContext {
  securityAudit: SecurityAuditPort;
}

export interface RuntimeMetadata {
  runtimeName: string;
  compositionRoot: "aoc-enterprise/runtime/composition" | string;
  composedAt: string;
}

export interface RuntimeContext {
  trustDomain: TrustDomainPort;
  trustCoordination: TrustCoordinationPort;
  privilegedDb: PrivilegedDbPort;
  securityAudit: SecurityAuditPort;
  accessVerification: AccessVerificationPort;
  agentAttestation: AgentAttestationPort;
  policyEvaluator: PolicyEvaluatorPort;
  signer: RuntimeSignerContext;
  security: RuntimeSecurityContext;
  governance: RuntimeGovernanceContext;
  capability: RuntimeCapabilityContext;
  audit: RuntimeAuditContext;
  metadata: RuntimeMetadata;
}

export function runtimeContextToCapabilityClaimPorts(runtime: RuntimeContext): CapabilityClaimPorts {
  return {
    trustDomain: runtime.trustDomain,
    trustCoordination: runtime.trustCoordination,
    securityAudit: runtime.securityAudit,
    signer: runtime.signer,
  };
}

export function runtimeContextToCapabilityVerificationPorts(
  runtime: RuntimeContext,
): Pick<CapabilityClaimPorts, "trustDomain" | "trustCoordination"> {
  return {
    trustDomain: runtime.trustDomain,
    trustCoordination: runtime.trustCoordination,
  };
}
