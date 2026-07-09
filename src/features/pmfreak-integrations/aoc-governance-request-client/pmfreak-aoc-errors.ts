export type PMFreakAocGovernanceClientErrorCode =
  | "invalid_config"
  | "invalid_request"
  | "transport_unavailable"
  | "unsupported_remote_transport"
  | "evaluation_failed"
  | "mutation_not_allowed"
  | "redaction_failed"
  | "unsafe_claim"
  | "unknown_error";

export type PMFreakAocGovernanceClientErrorDetails = {
  code: PMFreakAocGovernanceClientErrorCode;
  message: string;
  safe: true;
  context?: Record<string, unknown>;
};

export class PMFreakAocGovernanceClientError extends Error {
  readonly code: PMFreakAocGovernanceClientErrorCode;
  readonly safe = true as const;
  readonly context?: Record<string, unknown>;

  constructor(code: PMFreakAocGovernanceClientErrorCode, message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = "PMFreakAocGovernanceClientError";
    this.code = code;
    this.context = context;
  }

  toSafeDetails(): PMFreakAocGovernanceClientErrorDetails {
    return {
      code: this.code,
      message: this.message,
      safe: true,
      context: this.context,
    };
  }
}

export function createPMFreakAocGovernanceClientError(
  code: PMFreakAocGovernanceClientErrorCode,
  message: string,
  context?: Record<string, unknown>,
): PMFreakAocGovernanceClientError {
  return new PMFreakAocGovernanceClientError(code, message, context);
}
