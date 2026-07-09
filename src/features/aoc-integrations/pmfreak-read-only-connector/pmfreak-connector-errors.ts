// AOC PMFreak Read-Only Connector v1 — error model
//
// Connector errors are deterministic and safe: `safe: true` is a
// structural promise that `message`/`details` never carry secrets,
// tokens, authorization headers, raw connection strings, or private
// customer data. Callers constructing `details` are responsible for only
// passing already-safe values (ids, counts, source kinds).

import type { AocPMFreakConnectorError, AocPMFreakConnectorErrorCode } from "./pmfreak-read-only-connector-types";

export function createAocPMFreakConnectorError(
  code: AocPMFreakConnectorErrorCode,
  message: string,
  details?: Record<string, unknown>
): AocPMFreakConnectorError {
  return {
    code,
    message,
    safe: true,
    details,
  };
}
