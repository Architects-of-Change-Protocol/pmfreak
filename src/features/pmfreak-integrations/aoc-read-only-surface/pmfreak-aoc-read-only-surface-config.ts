// PMFreak AOC Read-Only Integration Surface v1 — surface configuration
//
// createPMFreakAocReadOnlySurfaceConfig is the only supported way to
// build a surface config. `readOnly` and `allowMutations` are forced to
// their safe values regardless of what the caller passes in — an attempt
// to flip them is recorded as a deterministic warning, not silently
// dropped.

import { PMFREAK_AOC_READ_ONLY_SURFACE_ID } from "./pmfreak-aoc-read-only-surface-constants";
import type { PMFreakAocReadOnlySurfaceConfig } from "./pmfreak-aoc-read-only-surface-types";

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_RECORDS = 100;

export function createPMFreakAocReadOnlySurfaceConfig(
  input?: Partial<PMFreakAocReadOnlySurfaceConfig>
): PMFreakAocReadOnlySurfaceConfig {
  const warnings: string[] = [...(input?.warnings ?? [])];

  // `readOnly`/`allowMutations` are typed `true`/`false` (not `boolean`) on
  // PMFreakAocReadOnlySurfaceConfig, but `input` is a loosely-typed
  // Partial that a caller could still construct with the wrong literal via
  // an unsafe cast — check anyway so the factory fails safe rather than
  // trusting the type system alone.
  const inputReadOnly = input?.readOnly as unknown;
  const inputAllowMutations = input?.allowMutations as unknown;

  if (inputReadOnly !== undefined && inputReadOnly !== true) {
    warnings.push("readOnly was forced to true.");
  }
  if (inputAllowMutations !== undefined && inputAllowMutations !== false) {
    warnings.push("allowMutations was forced to false.");
  }

  return {
    surfaceId: input?.surfaceId ?? PMFREAK_AOC_READ_ONLY_SURFACE_ID,
    environment: input?.environment ?? "demo",
    sourceKind: input?.sourceKind ?? "in_memory",

    baseUrl: input?.baseUrl,
    projectId: input?.projectId,
    tenantId: input?.tenantId,
    workspaceId: input?.workspaceId,

    // Forced. Never derived from input.
    readOnly: true,
    allowMutations: false,

    timeoutMs: input?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRecords: input?.maxRecords ?? DEFAULT_MAX_RECORDS,

    redactionMode: input?.redactionMode ?? "safe_demo",

    notes: input?.notes ?? [],
    warnings,
  };
}
