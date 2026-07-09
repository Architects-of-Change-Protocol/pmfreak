import type { PMFreakAocRemoteGovernanceTransportConfig } from "./pmfreak-aoc-remote-governance-transport-config";

export type PMFreakAocRemoteGovernanceTransportHealthStatus = "healthy" | "degraded" | "unavailable";

export type PMFreakAocRemoteGovernanceTransportHealth = {
  transportId: string;
  transportKind: "remote_http";
  endpointPath: string;
  status: PMFreakAocRemoteGovernanceTransportHealthStatus;
  actionExecutionCapable: false;
  productionMutationCapable: false;
  decisionWritebackCapable: false;
  invoiceCreationCapable: false;
  communicationCapable: false;
  warnings: string[];
  errors: string[];
};

// No real network health check is performed in v1 — status is derived
// purely from configuration warnings/errors already collected by the
// caller.
export function createPMFreakAocRemoteGovernanceTransportHealth(input: {
  config: PMFreakAocRemoteGovernanceTransportConfig;
  warnings?: string[];
  errors?: string[];
}): PMFreakAocRemoteGovernanceTransportHealth {
  const warnings = [...input.config.warnings, ...(input.warnings ?? [])];
  const errors = [...(input.errors ?? [])];

  const status: PMFreakAocRemoteGovernanceTransportHealthStatus =
    errors.length > 0 ? "unavailable" : warnings.length > 0 ? "degraded" : "healthy";

  return {
    transportId: input.config.transportId,
    transportKind: "remote_http",
    endpointPath: input.config.endpointPath,
    status,
    actionExecutionCapable: false,
    productionMutationCapable: false,
    decisionWritebackCapable: false,
    invoiceCreationCapable: false,
    communicationCapable: false,
    warnings,
    errors,
  };
}
