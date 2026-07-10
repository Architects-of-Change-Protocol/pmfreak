/**
 * Environment / runtime-boundary validation — Perilla 10 (Production
 * Secrets / Env / CORS / Deployment Boundary Hardening).
 *
 * Perillas 1-9 hardened *application* trust boundaries (auth, membership,
 * billing authorization, webhooks, RLS, route guards, abuse limits). This
 * module hardens the boundary underneath all of them: does the running
 * process actually have the secrets it needs, is it running in the
 * environment it thinks it is, and does a missing/misconfigured value ever
 * silently degrade into an insecure default instead of failing closed?
 *
 * See docs/security/production-deployment-boundary.md.
 */

export type RuntimeEnvironment = "development" | "test" | "preview" | "production";

/**
 * Resolves the effective runtime environment. VERCEL_ENV is authoritative
 * when present (Vercel sets it to "production" | "preview" | "development"
 * regardless of NODE_ENV, which Next always sets to "production" for any
 * `next build`, including preview deploys) — falling back to NODE_ENV for
 * non-Vercel hosting and local scripts.
 */
export function getRuntimeEnvironment(): RuntimeEnvironment {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "production") return "production";
  if (vercelEnv === "preview") return "preview";
  if (vercelEnv === "development") return "development";

  if (process.env.NODE_ENV === "test") return "test";
  if (process.env.NODE_ENV === "production") return "production";
  return "development";
}

export function isProductionRuntime(): boolean {
  return getRuntimeEnvironment() === "production";
}

/** Server env var that is required to be present and non-empty everywhere it's read. Throws with a name-only message — never echoes any value. */
export function requireServerEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }
  return value;
}

export function getOptionalServerEnv(name: string): string | null {
  return process.env[name] ?? null;
}

/**
 * Secret-shaped NEXT_PUBLIC_* names — these must never exist, regardless of
 * whether a value is actually set, because the *name* is a promise to future
 * authors that this is safe to bundle into client JS.
 */
const FORBIDDEN_PUBLIC_ENV_FRAGMENTS = ["SECRET", "SERVICE_ROLE", "PRIVATE", "WEBHOOK", "TOKEN", "PASSWORD", "HMAC", "CREDENTIAL", "API_KEY"] as const;

export function isSecretLikePublicEnvName(name: string): boolean {
  if (!name.startsWith("NEXT_PUBLIC_")) return false;
  const upper = name.toUpperCase();
  return FORBIDDEN_PUBLIC_ENV_FRAGMENTS.some((fragment) => upper.includes(fragment));
}

/**
 * Throws if any currently-set NEXT_PUBLIC_* environment variable looks
 * secret-shaped by name. Cheap runtime tripwire in addition to the static
 * source-scan test — catches secrets injected only via the hosting
 * platform's env UI, which a source scan can never see.
 */
export function assertServerOnlyEnvBoundary(): void {
  const offenders = Object.keys(process.env).filter(isSecretLikePublicEnvName);
  if (offenders.length > 0) {
    throw new Error(`Secret-shaped NEXT_PUBLIC_ environment variable(s) present: ${offenders.join(", ")}. NEXT_PUBLIC_ variables are bundled into client JS — rename or remove.`);
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isLocalhostUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname.endsWith(".local");
  } catch {
    return false;
  }
}

/** Server-only secrets this repo actually reads. See deployment-boundary-registry.ts for the canonical, documented list. */
const PRODUCTION_REQUIRED_SERVER_SECRETS = ["SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] as const;

export type ProductionEnvSafetyViolation = { code: string; message: string };

/**
 * Production/preview-safe validation of the env contract. Never throws by
 * itself in development/test (local stubs and partial env are expected
 * there) — callers that want a hard boot-time failure should call
 * `assertProductionEnvSafety()`, which throws if this returns any violation
 * while `getRuntimeEnvironment() === "production"`.
 */
export function evaluateProductionEnvSafety(): ProductionEnvSafetyViolation[] {
  const violations: ProductionEnvSafetyViolation[] = [];
  const env = getRuntimeEnvironment();
  if (env !== "production") return violations;

  for (const name of PRODUCTION_REQUIRED_SERVER_SECRETS) {
    if (!process.env[name]) {
      violations.push({ code: "missing_required_secret", message: `${name} is required in production and is not set.` });
    }
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    violations.push({ code: "missing_supabase_public_env", message: "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required in production." });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!appUrl) {
    violations.push({ code: "missing_app_url", message: "NEXT_PUBLIC_APP_URL (or NEXT_PUBLIC_SITE_URL) is required in production for safe redirect/link generation." });
  } else if (!isHttpUrl(appUrl)) {
    violations.push({ code: "invalid_app_url", message: "NEXT_PUBLIC_APP_URL is not a valid http(s) URL." });
  } else if (isLocalhostUrl(appUrl)) {
    violations.push({ code: "localhost_app_url_in_production", message: "NEXT_PUBLIC_APP_URL resolves to localhost in production." });
  }

  for (const [name, value] of Object.entries(process.env)) {
    if (isSecretLikePublicEnvName(name) && value) {
      violations.push({ code: "secret_like_public_env", message: `${name} is a secret-shaped NEXT_PUBLIC_ variable.` });
    }
  }

  return violations;
}

/** Fail-closed boot check. Call once at server startup (or from a script gating deploys) — never from client-reachable request handlers, since it may throw. */
export function assertProductionEnvSafety(): void {
  const violations = evaluateProductionEnvSafety();
  if (violations.length > 0) {
    throw new Error(`Production environment safety check failed:\n${violations.map((v) => `  - [${v.code}] ${v.message}`).join("\n")}`);
  }
}
