// PMFreak AOC Read-Only Integration Surface v1 — surface descriptor

import {
  PMFREAK_AOC_CONSUMER_SYSTEM_ID,
  PMFREAK_AOC_FORBIDDEN_SURFACE_OPERATIONS,
  PMFREAK_AOC_PROVIDER_SYSTEM_ID,
  PMFREAK_AOC_READ_ONLY_SURFACE_CAPABILITIES,
  PMFREAK_AOC_READ_ONLY_SURFACE_DISCLAIMERS,
  PMFREAK_AOC_READ_ONLY_SURFACE_ID,
  PMFREAK_AOC_READ_ONLY_SURFACE_NAME,
  PMFREAK_AOC_READ_ONLY_SURFACE_SAFE_LABELS,
} from "./pmfreak-aoc-read-only-surface-constants";
import type { PMFreakAocReadOnlySurfaceDescriptor } from "./pmfreak-aoc-read-only-surface-types";

export function createPMFreakAocReadOnlySurfaceDescriptor(): PMFreakAocReadOnlySurfaceDescriptor {
  return {
    surfaceId: PMFREAK_AOC_READ_ONLY_SURFACE_ID,
    surfaceName: PMFREAK_AOC_READ_ONLY_SURFACE_NAME,
    providerId: PMFREAK_AOC_PROVIDER_SYSTEM_ID,
    consumerId: PMFREAK_AOC_CONSUMER_SYSTEM_ID,
    version: "v1",
    mode: "read_only",
    demoCompatible: true,
    productionMutationCapable: false,
    governanceDecisionCapable: false,
    capabilities: Object.values(PMFREAK_AOC_READ_ONLY_SURFACE_CAPABILITIES),
    forbiddenOperations: [...PMFREAK_AOC_FORBIDDEN_SURFACE_OPERATIONS],
    safeLabels: [...PMFREAK_AOC_READ_ONLY_SURFACE_SAFE_LABELS],
    disclaimers: [...PMFREAK_AOC_READ_ONLY_SURFACE_DISCLAIMERS],
  };
}
