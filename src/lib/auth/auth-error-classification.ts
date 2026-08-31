export type AuthErrorLike = { name?: string; status?: number; message?: string } | null | undefined;

export type AuthErrorClassification = "none" | "session_missing" | "retryable_transport" | "auth_rejection" | "auth_api_error" | "unknown";

/**
 * Classify the installed auth-js contract by its typed error identity. Names
 * are intentionally used instead of instanceof so the result survives the
 * separate server/edge auth-js bundles used by Next.js.
 */
export function classifyAuthError(error: AuthErrorLike): AuthErrorClassification {
  if (!error) return "none";
  if (error.name === "AuthSessionMissingError") return "session_missing";
  if (error.name === "AuthRetryableFetchError") return "retryable_transport";
  if (error.name === "AuthApiError") {
    return error.status === 401 || error.status === 403 ? "auth_rejection" : "auth_api_error";
  }
  return "unknown";
}

export function isRetryableAuthTransportError(error: AuthErrorLike): boolean {
  return classifyAuthError(error) === "retryable_transport";
}
