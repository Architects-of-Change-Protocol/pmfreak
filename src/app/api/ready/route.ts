import { NextResponse } from "next/server";
import { getRequestId } from "@/lib/api/http";
import { hasSupabaseEnv, getSupabaseEnv } from "@/lib/supabase/env";
import { logger, safeErrorMessage } from "@/lib/observability/logger";
import { checkGovernanceCapabilityConfiguration } from "@/lib/security/governance-capability";

// Perilla 11 — readiness probe, distinct from /api/health:
//   /api/health → liveness: the process is up and the AOC runtime composes.
//   /api/ready  → readiness: minimum dependencies (configuration + database)
//                 are actually reachable, so the instance may take traffic.
//
// Reports pass/fail per check and names missing env VARS (never values).
// No secrets, no internals, no stack traces in the response.

const DEFAULT_DATABASE_TIMEOUT_MS = 3_000;

function resolveDatabaseTimeoutMs(): number {
  const raw = process.env.HEALTHCHECK_DATABASE_TIMEOUT_MS;
  if (!raw) return DEFAULT_DATABASE_TIMEOUT_MS;
  const parsed = Number(raw.trim());
  if (!Number.isInteger(parsed) || parsed < 100 || parsed > 30_000) return DEFAULT_DATABASE_TIMEOUT_MS;
  return parsed;
}

type ReadinessCheck = { name: string; status: "pass" | "fail"; detail?: string };

function checkConfiguration(): ReadinessCheck {
  const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const productionRequired = ["SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_APP_URL"];
  const missing = required.filter((name) => !process.env[name]);
  if (process.env.NODE_ENV === "production") {
    missing.push(...productionRequired.filter((name) => !process.env[name]));
  }
  if (missing.length > 0) {
    return { name: "configuration", status: "fail", detail: `missing: ${missing.join(", ")}` };
  }
  return { name: "configuration", status: "pass" };
}

async function checkDatabase(): Promise<ReadinessCheck> {
  if (!hasSupabaseEnv) {
    return { name: "database", status: "fail", detail: "supabase env not configured" };
  }
  const { url, anonKey } = getSupabaseEnv();
  const controller = new AbortController();
  const timeoutMs = resolveDatabaseTimeoutMs();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Anon-key REST ping: proves the Supabase endpoint is reachable and
    // accepting requests without touching any tenant data or privileged key.
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
      method: "HEAD",
      headers: { apikey: anonKey },
      signal: controller.signal,
      cache: "no-store",
    });
    if (response.status >= 500) {
      return { name: "database", status: "fail", detail: `upstream ${response.status}` };
    }
    return { name: "database", status: "pass" };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return { name: "database", status: "fail", detail: aborted ? `timeout after ${timeoutMs}ms` : "unreachable" };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const startedAt = Date.now();
  try {
    const checks = [checkConfiguration(), checkGovernanceCapabilityConfiguration(), await checkDatabase()];
    const ready = checks.every((check) => check.status === "pass");
    if (!ready) {
      logger.warn("readiness_check_failed", {
        request_id: requestId,
        route: "/api/ready",
        duration_ms: Date.now() - startedAt,
        checks: checks.filter((check) => check.status === "fail"),
      });
    }
    return NextResponse.json(
      { status: ready ? "ready" : "not_ready", checks, timestamp: new Date().toISOString() },
      { status: ready ? 200 : 503, headers: { "x-request-id": requestId } },
    );
  } catch (error) {
    logger.error("readiness_check_error", {
      request_id: requestId,
      route: "/api/ready",
      duration_ms: Date.now() - startedAt,
      error_code: safeErrorMessage(error),
    });
    return NextResponse.json(
      { status: "not_ready", checks: [], timestamp: new Date().toISOString() },
      { status: 503, headers: { "x-request-id": requestId } },
    );
  }
}
