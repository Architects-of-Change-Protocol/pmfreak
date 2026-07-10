/**
 * Origin / CORS / redirect safety — Perilla 10 (Production Secrets / Env /
 * CORS / Deployment Boundary Hardening).
 *
 * Centralizes every place PMFreak needs to answer "is this origin allowed"
 * or "is this a safe place to send the browser". Nothing outside this file
 * should set `Access-Control-Allow-Origin` from a raw request header, and
 * nothing should call `redirect()`/build a Location URL from unvalidated
 * user input — see docs/security/production-deployment-boundary.md.
 */

import { getRuntimeEnvironment, isLocalhostUrl } from "./environment";

const STATIC_ALLOWED_ORIGINS = ["https://pmfreak-mu.vercel.app"];
const DEV_ONLY_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];
const DEV_ONLY_ORIGIN_PATTERN = /^https:\/\/[a-z0-9-]+\.(app\.)?github\.dev$/i;

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * All origins this deployment trusts right now, given its current
 * environment. Never includes localhost/127.0.0.1 or the *.github.dev
 * Codespaces preview pattern when running in production.
 */
export function getAllowedOrigins(): string[] {
  const env = getRuntimeEnvironment();
  const origins = new Set<string>();

  for (const raw of [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXT_PUBLIC_SITE_URL, process.env.APP_URL]) {
    const origin = normalizeOrigin(raw);
    if (origin) origins.add(origin);
  }

  for (const origin of STATIC_ALLOWED_ORIGINS) origins.add(origin);

  if (env === "preview" && process.env.VERCEL_URL) {
    const previewOrigin = normalizeOrigin(`https://${process.env.VERCEL_URL}`);
    if (previewOrigin) origins.add(previewOrigin);
  }

  if (env !== "production") {
    for (const origin of DEV_ONLY_ORIGINS) origins.add(origin);
  }

  return Array.from(origins);
}

/**
 * Whether `origin` (the literal value of a request's `Origin` header, or
 * any candidate redirect target's origin) is trusted in the current
 * environment. Returns false for null/malformed/non-http(s) input — callers
 * must never reflect an origin back without checking this first.
 */
export function isAllowedOrigin(origin: string | null | undefined): boolean {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;

  const env = getRuntimeEnvironment();
  if (env === "production" && isLocalhostUrl(normalized)) return false;

  if (env !== "production" && DEV_ONLY_ORIGIN_PATTERN.test(normalized)) return true;

  return getAllowedOrigins().includes(normalized);
}

/**
 * The canonical origin to use when building absolute URLs server-side
 * (email links, Stripe success/cancel URLs, etc.) and no trustworthy
 * request-scoped origin is available. Fails closed in production rather
 * than silently falling back to localhost.
 */
export function getAppBaseUrl(): string {
  const configured = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || null);
  const env = getRuntimeEnvironment();

  if (configured && !(env === "production" && isLocalhostUrl(configured))) {
    return configured;
  }

  if (env === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL (or NEXT_PUBLIC_SITE_URL) must be set to a valid non-localhost https URL in production.");
  }

  return "http://localhost:3000";
}

/**
 * Resolves a request-supplied origin (e.g. the `Origin` header on a
 * same-site POST that needs to build an absolute redirect URL, like Stripe
 * Checkout success/cancel URLs) against the allowlist, falling back to the
 * canonical app origin instead of ever trusting the raw header value.
 */
export function resolveTrustedOrigin(requestOrigin: string | null | undefined): string {
  if (isAllowedOrigin(requestOrigin)) {
    return normalizeOrigin(requestOrigin) as string;
  }
  return getAppBaseUrl();
}

export type BuildCorsHeadersInput = {
  origin: string | null | undefined;
  allowCredentials?: boolean;
  methods?: string[];
  headers?: string[];
};

/**
 * Builds CORS response headers for an origin, allowlist-checked. Never
 * emits a wildcard, and never reflects an origin that isn't allowlisted —
 * if `origin` isn't allowed, the returned headers omit
 * Access-Control-Allow-Origin entirely (the browser then blocks the
 * cross-origin read, which is the desired default-deny behavior).
 */
export function buildCorsHeaders(input: BuildCorsHeadersInput): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": (input.methods ?? ["GET", "POST", "OPTIONS"]).join(", "),
    "Access-Control-Allow-Headers": (input.headers ?? ["Content-Type", "Authorization"]).join(", "),
  };

  if (isAllowedOrigin(input.origin)) {
    headers["Access-Control-Allow-Origin"] = normalizeOrigin(input.origin) as string;
    headers["Vary"] = "Origin";
    if (input.allowCredentials) {
      headers["Access-Control-Allow-Credentials"] = "true";
    }
  }

  return headers;
}

export type ResolveSafeRedirectUrlInput = {
  requestedUrl: string | null | undefined;
  fallbackPath?: string;
  baseUrl?: string;
};

/**
 * Validates a candidate redirect/continuation URL. Allows same-origin
 * relative paths (a single leading `/`, not `//`) and absolute URLs whose
 * origin is allowlisted; blocks everything else (javascript:, data:,
 * protocol-relative //host, unlisted external origins) by returning
 * `fallbackPath` instead.
 *
 * For PMFreak's own internal post-auth continuation routes, prefer the
 * narrower `isSafeContinuationRoute` (src/lib/auth/validate-continuation-route.ts),
 * which also enforces an explicit internal-route allowlist. This helper is
 * the general-purpose version for any redirect target, internal or external.
 */
export function resolveSafeRedirectUrl(input: ResolveSafeRedirectUrlInput): string {
  const fallbackPath = input.fallbackPath ?? "/";
  const requested = input.requestedUrl?.trim();

  if (!requested) return fallbackPath;
  if (/[\r\n\t]/.test(requested)) return fallbackPath;
  if (requested.startsWith("//")) return fallbackPath;

  if (requested.startsWith("/")) {
    try {
      const parsed = new URL(requested, "http://internal.invalid");
      if (parsed.origin !== "http://internal.invalid") return fallbackPath;
      return requested;
    } catch {
      return fallbackPath;
    }
  }

  try {
    const parsed = new URL(requested, input.baseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return fallbackPath;
    if (!isAllowedOrigin(parsed.origin)) return fallbackPath;
    return parsed.toString();
  } catch {
    return fallbackPath;
  }
}
