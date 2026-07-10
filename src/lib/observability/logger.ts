// Perilla 11 — centralized structured logger.
//
// One JSON line per event, always passed through the Perilla 10 redaction
// layer (src/lib/security/redaction.ts) so secret-shaped values and
// sensitive keys (token/secret/authorization/cookie/…) can never reach the
// log stream, whatever a caller passes in. LOG_LEVEL gates verbosity
// (debug < info < warn < error; default info; unknown values fall back to
// info rather than silencing errors).
//
// Fields every event may carry (see docs/release/pilot-operational-runbook.md):
//   timestamp, level, message, request_id, workspace_id, user_id, route,
//   operation, duration_ms, status, error_code — all optional except
//   timestamp/level/message. Errors should be stringified with
//   safeErrorMessage() before being attached (no stack traces).
//
// Adoption is incremental: new/updated code paths (readiness, invites, AI
// guardrails) log through here; legacy console call sites are tracked as a
// residual item in docs/release/residual-risk-register.md.

import { redactSecretLikeValues, safeErrorMessage } from "@/lib/security/redaction";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type LogFields = {
  request_id?: string;
  workspace_id?: string;
  user_id?: string;
  route?: string;
  operation?: string;
  duration_ms?: number;
  status?: string | number;
  error_code?: string;
  [key: string]: unknown;
};

export function resolveLogLevel(raw: string | undefined = process.env.LOG_LEVEL): LogLevel {
  const normalized = raw?.trim().toLowerCase();
  return normalized && normalized in LEVEL_ORDER ? (normalized as LogLevel) : "info";
}

function shouldLog(level: LogLevel, threshold: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[threshold];
}

type LogSink = (line: string) => void;

const defaultSinks: Record<LogLevel, LogSink> = {
  debug: (line) => console.debug(line),
  info: (line) => console.info(line),
  warn: (line) => console.warn(line),
  error: (line) => console.error(line),
};

/**
 * Emits one structured, redacted JSON log line. Never throws: a logging
 * failure (unserializable field, sink error) must not break the request
 * being logged.
 */
export function logEvent(level: LogLevel, message: string, fields: LogFields = {}, deps: { threshold?: LogLevel; sink?: LogSink } = {}): void {
  try {
    const threshold = deps.threshold ?? resolveLogLevel();
    if (!shouldLog(level, threshold)) return;
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(redactSecretLikeValues(fields) as Record<string, unknown>),
    };
    const sink = deps.sink ?? defaultSinks[level];
    sink(JSON.stringify(payload));
  } catch {
    // Deliberately swallowed — see docstring.
  }
}

export const logger = {
  debug: (message: string, fields?: LogFields) => logEvent("debug", message, fields),
  info: (message: string, fields?: LogFields) => logEvent("info", message, fields),
  warn: (message: string, fields?: LogFields) => logEvent("warn", message, fields),
  error: (message: string, fields?: LogFields) => logEvent("error", message, fields),
};

export { safeErrorMessage };
