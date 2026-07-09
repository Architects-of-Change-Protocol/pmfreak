// PMFreak AOC Read-Only Integration Surface v1 — no-mutation guard
//
// A guardrail only: it recognizes forbidden operation names and throws.
// It does not implement any executor or writeback path — there is nothing
// behind this guard to bypass.

import { PMFREAK_AOC_FORBIDDEN_SURFACE_OPERATIONS } from "./pmfreak-aoc-read-only-surface-constants";
import { createPMFreakAocSurfaceError } from "./pmfreak-aoc-surface-errors";
import type { PMFreakAocSurfaceError } from "./pmfreak-aoc-read-only-surface-types";

const FORBIDDEN_OPERATIONS = new Set<string>(PMFREAK_AOC_FORBIDDEN_SURFACE_OPERATIONS);

export function isPMFreakAocForbiddenSurfaceOperation(operationName: string): boolean {
  return FORBIDDEN_OPERATIONS.has(operationName);
}

export class PMFreakAocMutationNotAllowedError extends Error {
  readonly surfaceError: PMFreakAocSurfaceError;

  constructor(surfaceError: PMFreakAocSurfaceError) {
    super(surfaceError.message);
    this.name = "PMFreakAocMutationNotAllowedError";
    this.surfaceError = surfaceError;
  }
}

export function assertPMFreakAocReadOnlyOperation(operationName: string): void {
  if (isPMFreakAocForbiddenSurfaceOperation(operationName)) {
    throw new PMFreakAocMutationNotAllowedError(
      createPMFreakAocSurfaceError(
        "mutation_not_allowed",
        `Operation "${operationName}" is forbidden: the PMFreak AOC Read-Only Integration Surface never mutates PMFreak data.`,
        { operationName }
      )
    );
  }
}
