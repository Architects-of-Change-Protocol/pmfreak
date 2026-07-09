import type { PMFreakAocRemoteEndpointErrorBody, PMFreakAocRemoteEndpointSuccessBody } from "./pmfreak-aoc-remote-governance-endpoint-types";

export type PMFreakAocRemoteGovernanceParsedEndpointBody =
  | { ok: true; body: PMFreakAocRemoteEndpointSuccessBody }
  | { ok: false; body: PMFreakAocRemoteEndpointErrorBody };

function buildInvalidResponseBody(message: string): PMFreakAocRemoteEndpointErrorBody {
  return {
    ok: false,
    endpointId: "unknown",
    error: { code: "invalid_response", message, safe: true },
    safeLabels: [],
    warnings: [],
  };
}

function toSafeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

// Parses an AOC remote governance endpoint response body (already-parsed
// JSON, a raw JSON string, or an otherwise-unexpected value) into a safe,
// well-typed envelope. Never throws a raw JSON parse error and never
// echoes the raw input body back in an error message.
export function parsePMFreakAocRemoteGovernanceEndpointBody(body: unknown): PMFreakAocRemoteGovernanceParsedEndpointBody {
  let parsed: unknown = body;

  if (typeof body === "string") {
    try {
      parsed = JSON.parse(body);
    } catch {
      return { ok: false, body: buildInvalidResponseBody("AOC remote governance response body is not valid JSON.") };
    }
  }

  if (parsed === null || parsed === undefined || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, body: buildInvalidResponseBody("AOC remote governance response body is not a JSON object.") };
  }

  const candidate = parsed as Record<string, unknown>;

  if (candidate.ok === true) {
    if (typeof candidate.endpointId !== "string" || typeof candidate.response !== "object" || candidate.response === null) {
      return { ok: false, body: buildInvalidResponseBody("AOC remote governance success response body is missing required fields.") };
    }
    return {
      ok: true,
      body: {
        ok: true,
        endpointId: candidate.endpointId,
        response: candidate.response as PMFreakAocRemoteEndpointSuccessBody["response"],
        safeLabels: toSafeStringArray(candidate.safeLabels),
        warnings: toSafeStringArray(candidate.warnings),
      },
    };
  }

  if (candidate.ok === false) {
    const error = candidate.error as Record<string, unknown> | undefined;
    if (!error || typeof error.code !== "string" || typeof error.message !== "string") {
      return { ok: false, body: buildInvalidResponseBody("AOC remote governance error response body is missing required fields.") };
    }
    return {
      ok: false,
      body: {
        ok: false,
        endpointId: typeof candidate.endpointId === "string" ? candidate.endpointId : "unknown",
        error: {
          code: error.code,
          message: error.message,
          safe: true,
          details:
            error.details && typeof error.details === "object" && !Array.isArray(error.details)
              ? (error.details as Record<string, unknown>)
              : undefined,
        },
        safeLabels: toSafeStringArray(candidate.safeLabels),
        warnings: toSafeStringArray(candidate.warnings),
      },
    };
  }

  return {
    ok: false,
    body: buildInvalidResponseBody('AOC remote governance response body does not have a recognized "ok" envelope shape.'),
  };
}
