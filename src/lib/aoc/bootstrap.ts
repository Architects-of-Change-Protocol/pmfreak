import { registerPmfreakAocAdapters } from "@/lib/aoc/adapters";
import { ensureInProcessAuthorityDependenciesRegistered } from "@/lib/aoc/runtime-composition/in-process-authority-dependencies";

let _registered = false;

export function ensurePmfreakAocAdaptersRegistered(): void {
  if (_registered) return;

  // Composition order is intentional:
  // 1. host adapters must exist before the in-process authority can compose;
  // 2. authority dependencies are then registered against that completed host boundary.
  registerPmfreakAocAdapters();
  ensureInProcessAuthorityDependenciesRegistered();

  _registered = true;
}


import { getAocAdapter } from "@/aoc/runtime/adapters";

export function getEnterpriseRuntimeComposeOptions() {
  return {
    adapters: {
      trustDomain: getAocAdapter("trustDomain"),
      trustCoordination: getAocAdapter("trustCoordination"),
      securityAudit: getAocAdapter("securityAudit"),
      privilegedDb: getAocAdapter("privilegedDb"),
      accessVerification: getAocAdapter("accessVerification"),
      agentAttestation: getAocAdapter("agentAttestation"),
      policyEvaluator: getAocAdapter("policyEvaluator"),
    },
  };
}
