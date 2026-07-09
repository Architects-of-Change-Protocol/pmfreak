// PMFreak AOC Read-Only Integration Surface v1 — health/status model
//
// Deterministic from its inputs: errors win over warnings, warnings win
// over healthy. This helper does not perform network calls — a real
// source adapter would run its own safe read-only health check and pass
// the result in via `errors`/`warnings`.

import { PMFREAK_AOC_READ_ONLY_SURFACE_CAPABILITIES } from "./pmfreak-aoc-read-only-surface-constants";
import type { PMFreakAocSurfaceHealth, PMFreakAocReadOnlySurfaceConfig } from "./pmfreak-aoc-read-only-surface-types";

export type CreatePMFreakAocSurfaceHealthInput = {
  config: PMFreakAocReadOnlySurfaceConfig;
  warnings?: string[];
  errors?: string[];
};

export function createPMFreakAocSurfaceHealth(input: CreatePMFreakAocSurfaceHealthInput): PMFreakAocSurfaceHealth {
  const warnings = [...(input.warnings ?? [])];
  const errors = [...(input.errors ?? [])];

  const status = errors.length > 0 ? "unavailable" : warnings.length > 0 ? "degraded" : "healthy";

  return {
    surfaceId: input.config.surfaceId,
    sourceKind: input.config.sourceKind,
    status,
    readOnly: true,
    allowMutations: false,
    checkedCapabilities: Object.values(PMFREAK_AOC_READ_ONLY_SURFACE_CAPABILITIES),
    warnings,
    errors,
  };
}
