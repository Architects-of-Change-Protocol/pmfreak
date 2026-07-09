import { PMFREAK_AOC_GOVERNANCE_SAFE_LABELS } from "./pmfreak-aoc-governance-client-constants";
import type { PMFreakAocGovernanceRequestClientConfig } from "./pmfreak-aoc-governance-client-config";
import type { PMFreakAocGovernanceClientEnvironment, PMFreakAocGovernanceTransportKind } from "./pmfreak-aoc-governance-client-types";
import type { PMFreakAocGovernanceTransport } from "./pmfreak-aoc-transport";

export type PMFreakAocGovernanceClientHealthStatus = "healthy" | "degraded" | "unavailable";

export type PMFreakAocGovernanceClientHealthCheck = {
  checkId: string;
  label: string;
  status: "passed" | "warning" | "failed";
  detail: string;
};

export type PMFreakAocGovernanceClientHealth = {
  clientId: string;
  status: PMFreakAocGovernanceClientHealthStatus;
  environment: PMFreakAocGovernanceClientEnvironment;
  transportKind: PMFreakAocGovernanceTransportKind;
  checks: PMFreakAocGovernanceClientHealthCheck[];
  warnings: string[];
  errors: string[];
  safeLabels: string[];
};

export function createPMFreakAocGovernanceClientHealth(input: {
  config: PMFreakAocGovernanceRequestClientConfig;
  transport: PMFreakAocGovernanceTransport;
}): PMFreakAocGovernanceClientHealth {
  const { config, transport } = input;
  const checks: PMFreakAocGovernanceClientHealthCheck[] = [];
  const errors: string[] = [];
  const warnings: string[] = [...config.warnings];

  checks.push({
    checkId: "transport_kind_matches_config",
    label: "Transport kind matches configuration",
    status: transport.transportKind === config.transportKind ? "passed" : "warning",
    detail:
      transport.transportKind === config.transportKind
        ? `Configured transport kind "${config.transportKind}" matches the active transport.`
        : `Configured transport kind "${config.transportKind}" differs from the active transport "${transport.transportKind}".`,
  });

  if (transport.transportKind === "unsupported_remote") {
    warnings.push("Active transport is unsupported_remote: no real AOC network transport exists in this repository yet.");
  }

  checks.push({
    checkId: "non_mutating_config",
    label: "Config forbids production mutation, execution and writeback",
    status:
      config.allowProductionMutations === false && config.allowActionExecution === false && config.allowDecisionWriteback === false
        ? "passed"
        : "failed",
    detail: "PMFreak AOC Governance Request Client v1 must never allow production mutation, action execution or decision writeback.",
  });

  const status: PMFreakAocGovernanceClientHealthStatus =
    transport.transportKind === "unsupported_remote" || errors.length > 0
      ? "unavailable"
      : warnings.length > 0
        ? "degraded"
        : "healthy";

  return {
    clientId: config.clientId,
    status,
    environment: config.environment,
    transportKind: transport.transportKind,
    checks,
    warnings,
    errors,
    safeLabels: [...PMFREAK_AOC_GOVERNANCE_SAFE_LABELS],
  };
}
