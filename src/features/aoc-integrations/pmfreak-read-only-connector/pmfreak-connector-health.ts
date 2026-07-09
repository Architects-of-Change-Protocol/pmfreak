// AOC PMFreak Read-Only Connector v1 — health/status model
//
// Deterministic from its inputs: errors win over warnings, warnings win
// over healthy. This helper does not perform network calls — a real
// source adapter would run its own safe read-only health check and pass
// the result in via `errors`/`warnings`.

import { AOC_PMFREAK_READ_ONLY_CONNECTOR_CAPABILITIES } from "./pmfreak-read-only-connector-constants";
import type { AocPMFreakConnectorHealth, AocPMFreakReadOnlyConnectorConfig } from "./pmfreak-read-only-connector-types";

export type CreateAocPMFreakConnectorHealthInput = {
  config: AocPMFreakReadOnlyConnectorConfig;
  warnings?: string[];
  errors?: string[];
};

export function createAocPMFreakConnectorHealth(input: CreateAocPMFreakConnectorHealthInput): AocPMFreakConnectorHealth {
  const warnings = [...(input.warnings ?? [])];
  const errors = [...(input.errors ?? [])];

  const status = errors.length > 0 ? "unavailable" : warnings.length > 0 ? "degraded" : "healthy";

  return {
    connectorId: input.config.connectorId,
    sourceKind: input.config.sourceKind,
    status,
    readOnly: true,
    allowMutations: false,
    checkedCapabilities: Object.values(AOC_PMFREAK_READ_ONLY_CONNECTOR_CAPABILITIES),
    warnings,
    errors,
  };
}
