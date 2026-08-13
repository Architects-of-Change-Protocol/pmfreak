/**
 * Centralized security response headers — Perilla 10 (Production Secrets /
 * Env / CORS / Deployment Boundary Hardening).
 *
 * Applied via `next.config.ts`'s `headers()` so every response (pages,
 * API routes, assets excluded per Next's own caching headers) gets a
 * consistent baseline without each route handler remembering to set them.
 * See docs/security/production-deployment-boundary.md for the CSP residual
 * and why a full nonce-based CSP is out of scope for this pass.
 */

import { getRuntimeEnvironment, type RuntimeEnvironment } from "./environment";

const BASE_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  // Next.js requires 'unsafe-inline' for its inline hydration/runtime scripts
  // and 'unsafe-eval' in dev (Fast Refresh); documented residual below.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
].join("; ");

export function getSecurityHeaders(input?: { environment?: RuntimeEnvironment }): Record<string, string> {
  const environment = input?.environment ?? getRuntimeEnvironment();
  const contentSecurityPolicy =
    environment === "development"
      ? BASE_CONTENT_SECURITY_POLICY.replace(
          "script-src 'self' 'unsafe-inline'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        )
      : BASE_CONTENT_SECURITY_POLICY;

  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(self), usb=(), interest-cohort=()",
    "Content-Security-Policy": contentSecurityPolicy,
    "X-DNS-Prefetch-Control": "off",
  };

  if (environment === "production" || environment === "preview") {
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
  }

  return headers;
}
