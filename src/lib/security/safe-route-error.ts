/**
 * Pilot Gate Sprint 01 — Task 3 (Error Leakage Sweep, F-07).
 *
 * Single boundary for turning a caught route-handler error into a client
 * response that never leaks raw driver/provider internals (Postgres error
 * text, table/column/constraint names, stack traces, upstream provider
 * bodies). The full error is preserved server-side through the structured
 * redacting logger; the client gets a stable, generic envelope.
 *
 * Use this in every route-handler catch-all instead of returning
 * `error.message` / `err.message` to the caller. Messages that ARE meant
 * for users (validation vocabulary, explicit domain errors) must be
 * returned via their own explicit branches before falling through to this.
 */

import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/lib/security/access-guards";
import { logger, safeErrorMessage } from "@/lib/observability/logger";

export const GENERIC_INTERNAL_ERROR_MESSAGE = "Internal error. Please retry, and contact support if the problem persists.";
export const GENERIC_ACCESS_DENIED_MESSAGE = "Access denied.";
export const GENERIC_UNAUTHORIZED_MESSAGE = "Unauthorized.";

/**
 * Standard catch-all for JSON API route handlers.
 *
 * - `AccessDeniedError` (thrown by requireAuthenticatedUser /
 *   requireWorkspaceMember / evaluateCapability) maps to an honest
 *   401/403 instead of a misleading 500 — with a generic message.
 * - Everything else logs the real (secret-redacted) error internally and
 *   returns a generic 500. The raw message never reaches the client.
 */
export function safeInternalErrorResponse(routeId: string, error: unknown): NextResponse {
  if (error instanceof AccessDeniedError) {
    const reason = String(error.metadata?.reason ?? "access_denied");
    if (reason === "unauthorized") {
      return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: GENERIC_UNAUTHORIZED_MESSAGE } }, { status: 401 });
    }
    // Denial telemetry already emitted by the guard that threw.
    return NextResponse.json({ ok: false, error: { code: "ACCESS_DENIED", message: GENERIC_ACCESS_DENIED_MESSAGE } }, { status: 403 });
  }

  logger.error("route_internal_error", { route: routeId, error_detail: safeErrorMessage(error) });
  return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: GENERIC_INTERNAL_ERROR_MESSAGE } }, { status: 500 });
}

/**
 * Variant for the older `{ error: string }` response shape used by the
 * governance/operational route families. Same guarantees, legacy envelope.
 */
export function safeLegacyErrorResponse(routeId: string, error: unknown, clientMessage = GENERIC_INTERNAL_ERROR_MESSAGE): Response {
  logger.error("route_internal_error", { route: routeId, error_detail: safeErrorMessage(error) });
  return Response.json({ error: clientMessage }, { status: 500 });
}

export const GENERIC_DB_UNAVAILABLE_MESSAGE = "Database temporarily unavailable. Please retry in a few moments.";

/**
 * Variant for SDK envelope routes that previously returned the raw
 * Supabase driver `error.message` inside `sdkRuntimeError`. Logs the real
 * error server-side and returns the same envelope shape with a generic
 * message.
 */
export function sdkDatabaseErrorBody(routeId: string, error: unknown): { message: string } {
  logger.error("route_internal_error", { route: routeId, error_detail: safeErrorMessage(error) });
  return { message: GENERIC_DB_UNAVAILABLE_MESSAGE };
}
