// PMFreak AOC Read-Only Integration Surface v1 — error model
//
// Surface errors are deterministic and safe: `safe: true` is a structural
// promise that `message`/`details` never carry secrets, tokens,
// authorization headers, raw connection strings, or private customer
// data. Callers constructing `details` are responsible for only passing
// already-safe values (ids, counts, source kinds).

import type { PMFreakAocSurfaceError, PMFreakAocSurfaceErrorCode } from "./pmfreak-aoc-read-only-surface-types";

export function createPMFreakAocSurfaceError(
  code: PMFreakAocSurfaceErrorCode,
  message: string,
  details?: Record<string, unknown>
): PMFreakAocSurfaceError {
  return {
    code,
    message,
    safe: true,
    details,
  };
}
