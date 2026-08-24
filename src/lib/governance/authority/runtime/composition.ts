// PMFreak governance runtime — composition root.
// OWNERSHIP: PMFreak. Not Soberania Protocol, not Frontera.
// The only module in this layer permitted to read the adapter registry. All
// orchestration modules receive RuntimeContext explicitly.

import type { CapabilityClaimPorts } from "@/lib/governance/authority/ports/capability-verification";
import type { RuntimeContext } from "./context";
import {
  runtimeContextToCapabilityClaimPorts,
  runtimeContextToCapabilityVerificationPorts,
  type RuntimeMetadata,
} from "./context";

export type ComposeRuntimeContextOptions = {
  metadata?: Partial<RuntimeMetadata>;
  adapters: Pick<
    RuntimeContext,
    | "trustDomain"
    | "trustCoordination"
    | "securityAudit"
    | "privilegedDb"
    | "accessVerification"
    | "agentAttestation"
    | "policyEvaluator"
  >;
};

export function composeRuntimeContext(options: ComposeRuntimeContextOptions): RuntimeContext {
  const { adapters } = options;
  const trustDomain = adapters.trustDomain;
  const trustCoordination = adapters.trustCoordination;
  const securityAudit = adapters.securityAudit;
  const privilegedDb = adapters.privilegedDb;
  const accessVerification = adapters.accessVerification;
  const agentAttestation = adapters.agentAttestation;
  const policyEvaluator = adapters.policyEvaluator;
  const signer = {
    resolvePrivateSigningKey({ key }: Parameters<CapabilityClaimPorts["signer"]["resolvePrivateSigningKey"]>[0]) {
      if (!key.secret_ref) return null;
      return process.env[key.secret_ref] ?? null;
    },
  };

  return {
    trustDomain,
    trustCoordination,
    privilegedDb,
    securityAudit,
    accessVerification,
    agentAttestation,
    policyEvaluator,
    signer,
    security: {
      securityAudit,
      accessVerification,
      agentAttestation,
      signer,
    },
    governance: {
      policyEvaluator,
      privilegedDb,
    },
    capability: {
      trustDomain,
      trustCoordination,
    },
    audit: {
      securityAudit,
    },
    metadata: {
      runtimeName: options.metadata?.runtimeName ?? "aoc-enterprise-runtime",
      compositionRoot: options.metadata?.compositionRoot ?? "aoc-enterprise/runtime/composition",
      composedAt: options.metadata?.composedAt ?? new Date().toISOString(),
    },
  };
}

export function composeCapabilityClaimPorts(runtime: RuntimeContext): CapabilityClaimPorts {
  return runtimeContextToCapabilityClaimPorts(runtime);
}

export function composeCapabilityVerificationPorts(
  runtime: RuntimeContext,
): Pick<CapabilityClaimPorts, "trustDomain" | "trustCoordination"> {
  return runtimeContextToCapabilityVerificationPorts(runtime);
}
