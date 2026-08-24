// AOC Runtime: adapter registry.
// Future extraction boundary: this registry is the single wiring point between
// AOC runtime code and its host application. When AOC is extracted to a standalone
// package, the host calls registerAocAdapters() during application bootstrap before
// invoking any AOC governance functions.
//
// Forbidden: AOC internal modules must NEVER call registerAocAdapters() themselves.
// Only the host application (e.g. PMFreak) provides adapter implementations.

import type { SecurityAuditPort } from "@pmfreak/aoc-protocol-internal/ports/security-audit";
import type { PrivilegedDbPort } from "@pmfreak/aoc-protocol-internal/ports/privileged-db";
import type { AccessVerificationPort } from "@pmfreak/aoc-protocol-internal/ports/access-verification";
import type { AgentAttestationPort } from "@pmfreak/aoc-protocol-internal/ports/agent-attestation";
import type { PolicyEvaluatorPort } from "@pmfreak/aoc-protocol-internal/ports/policy-evaluation";
import type { TrustDomainPort } from "@pmfreak/aoc-protocol-internal/ports/trust-domain";
import type { TrustCoordinationPort } from "@pmfreak/aoc-protocol-internal/ports/trust-coordination";

export interface AocAdapters {
  securityAudit: SecurityAuditPort;
  privilegedDb: PrivilegedDbPort;
  accessVerification: AccessVerificationPort;
  agentAttestation: AgentAttestationPort;
  policyEvaluator: PolicyEvaluatorPort;
  trustDomain: TrustDomainPort;
  trustCoordination: TrustCoordinationPort;
}

let _registry: Partial<AocAdapters> = {};

export function registerAocAdapters(adapters: Partial<AocAdapters>): void {
  _registry = { ..._registry, ...adapters };
}

export function getAocAdapter<K extends keyof AocAdapters>(name: K): AocAdapters[K] {
  const adapter = _registry[name];
  if (!adapter) {
    throw new Error(
      `AOC adapter '${name}' is not registered. ` +
        `Call registerAocAdapters() with a host-provided implementation before invoking AOC runtime functions.`
    );
  }
  return adapter;
}
