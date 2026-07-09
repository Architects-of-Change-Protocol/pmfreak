export type PMFreakAocRemoteGovernanceTransportErrorCode =
  | "invalid_config"
  | "invalid_request"
  | "payload_too_large"
  | "transport_unavailable"
  | "timeout"
  | "endpoint_error"
  | "invalid_response"
  | "unsafe_claim"
  | "mutation_not_allowed"
  | "unknown_error";

export type PMFreakAocRemoteGovernanceTransportErrorDetails = {
  code: PMFreakAocRemoteGovernanceTransportErrorCode;
  message: string;
  safe: true;
  details?: Record<string, unknown>;
};

// `safe: true` records that `message`/`details` have already been kept free
// of secrets, tokens, authorization headers, connection strings and raw
// request/response bodies by every call site in this module.
export class PMFreakAocRemoteGovernanceTransportError extends Error {
  readonly code: PMFreakAocRemoteGovernanceTransportErrorCode;
  readonly safe = true as const;
  readonly details?: Record<string, unknown>;

  constructor(code: PMFreakAocRemoteGovernanceTransportErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "PMFreakAocRemoteGovernanceTransportError";
    this.code = code;
    this.details = details;
  }

  toSafeDetails(): PMFreakAocRemoteGovernanceTransportErrorDetails {
    return {
      code: this.code,
      message: this.message,
      safe: true,
      details: this.details,
    };
  }
}

export function createPMFreakAocRemoteGovernanceTransportError(
  code: PMFreakAocRemoteGovernanceTransportErrorCode,
  message: string,
  details?: Record<string, unknown>,
): PMFreakAocRemoteGovernanceTransportError {
  return new PMFreakAocRemoteGovernanceTransportError(code, message, details);
}
