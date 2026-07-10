/**
 * Abuse protection — Perilla 9 (Invite / Signup / Billing Abuse Protection
 * Hardening).
 *
 * This module answers a different question than the rest of `@/lib/security`:
 * not "who may do this" (authorization — Perillas 1-8) but "how often, how
 * safely, and under what replay/cost limits may this be done" (abuse
 * protection). A correctly-authorized caller (a real workspace owner, a real
 * founder, a real external verifier) can still exhaust Stripe/AI/storage
 * cost, brute-force a token, or flood a public endpoint. Every route that
 * uses this module has already passed its own authorization guard — this is
 * an additional layer, not a replacement for one.
 *
 * See docs/security/abuse-protection-boundary.md for the full trust model,
 * and src/lib/security/abuse-protection-registry.ts for the declarative
 * inventory of which routes use which policy.
 */

import { createHash } from "node:crypto";
import { hasSupabaseServiceRoleEnv } from "@/lib/supabase/env";
import { createPrivilegedSupabaseClient } from "@/lib/security/privileged-access";
import { logSecurityEvent } from "@/lib/security/telemetry";

export type AbuseProtectionDecision =
  | {
      allowed: true;
      key: string;
      remaining?: number;
      resetAt?: string;
    }
  | {
      allowed: false;
      key: string;
      reason: "rate_limited" | "cooldown" | "invalid_key";
      retryAfterSeconds?: number;
      resetAt?: string;
    };

// ── Identifier handling — never persist a raw token/email/secret ───────────

/**
 * Normalizes an identifier before hashing: trims, lowercases (so
 * "USER@Example.COM" and "user@example.com" collapse to the same bucket),
 * and maps empty/missing input to a fixed "anonymous" bucket rather than
 * throwing — a missing IP/email must still be rate-limited (fail closed),
 * not bypass rate limiting.
 */
export function normalizeAbuseIdentifier(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : "anonymous";
}

// Static domain-separation prefix so this hash space never collides with
// other sha256 usages in the codebase (e.g. invite token hashes). Not a
// secret — this is a bucketing hash for rate-limit keys, not a credential.
// ABUSE_HASH_PEPPER (optional) adds a server-side pepper so the hash space
// isn't trivially reversible via a public rainbow table of common
// emails/IPs; unset in local/test, expected to be set in production.
const HASH_PEPPER = process.env.ABUSE_HASH_PEPPER ?? "pmfreak-abuse-v1";

/**
 * Hashes an identifier (token, email, IP, user id) for use in a rate-limit
 * key or as stored `identifier_hash`. The input value never appears in the
 * output or in any persisted record — see hashAbuseIdentifier("secret-token")
 * test in tests/abuse-protection-boundary.test.mjs.
 */
export function hashAbuseIdentifier(value: string | null | undefined): string {
  const normalized = normalizeAbuseIdentifier(value);
  return createHash("sha256").update(`${HASH_PEPPER}:${normalized}`).digest("hex");
}

/** Joins non-empty parts into a stable rate-limit key. */
export function buildAbuseKey(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => typeof part === "string" && part.length > 0).join(":");
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real?.trim()) return real.trim();
  return "unknown";
}

/** Same extraction, for server actions / RSC contexts using next/headers' headers(). */
export function getClientIpFromHeaders(headersList: Headers): string {
  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headersList.get("x-real-ip");
  if (real?.trim()) return real.trim();
  return "unknown";
}

// ── Metadata redaction ──────────────────────────────────────────────────────

const REDACTED_METADATA_KEY_FRAGMENTS = ["token", "email", "secret", "password", "authorization", "cookie"];

/**
 * Strips any metadata key that looks like it could carry a raw
 * token/email/secret before it's logged or persisted. Abuse tracking only
 * ever needs hashed identifiers plus non-identifying context (routeId,
 * action, counts) — see tests/abuse-protection-boundary.test.mjs #23.
 */
function redactAbuseMetadata(metadata: Record<string, unknown> = {}): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !REDACTED_METADATA_KEY_FRAGMENTS.some((fragment) => key.toLowerCase().includes(fragment))),
  );
}

// ── Store abstraction ───────────────────────────────────────────────────────

export type AbuseStoreIncrementInput = {
  /** Policy scope, e.g. "billing.create_checkout_session" or "billing.create_checkout_session:resend". */
  scope: string;
  /** Already-hashed identifier — never a raw token/email/IP. */
  identifierHash: string;
  windowSeconds: number;
  now: number;
  metadata?: Record<string, unknown>;
};

export type AbuseStoreIncrementResult = { count: number; windowStart: number };

export type AbuseStore = {
  increment(input: AbuseStoreIncrementInput): Promise<AbuseStoreIncrementResult>;
};

function computeWindowStart(now: number, windowSeconds: number): number {
  const windowMs = windowSeconds * 1000;
  return Math.floor(now / windowMs) * windowMs;
}

/**
 * In-memory fixed-window counter. This is the fallback used whenever no
 * persistent store is configured (local dev, unit tests, or a production
 * deployment that hasn't set Supabase service-role env vars) — see
 * docs/security/abuse-protection-boundary.md "Known residual risks" for why
 * this is not sufficient on its own across multiple serverless instances.
 */
export function createInMemoryAbuseStore(): AbuseStore {
  const counters = new Map<string, AbuseStoreIncrementResult>();
  return {
    async increment({ scope, identifierHash, windowSeconds, now }) {
      const mapKey = `${scope}::${identifierHash}`;
      const windowStart = computeWindowStart(now, windowSeconds);
      const existing = counters.get(mapKey);
      if (existing && existing.windowStart === windowStart) {
        existing.count += 1;
        return { ...existing };
      }
      const next = { count: 1, windowStart };
      counters.set(mapKey, next);
      return { ...next };
    },
  };
}

const sharedInMemoryAbuseStore = createInMemoryAbuseStore();

/**
 * Supabase-backed fixed-window counter. Persists to `public.abuse_rate_limits`
 * via the `abuse_rate_limit_increment` RPC (atomic upsert — see
 * supabase/migrations/20260819000000_abuse_rate_limits.sql), so concurrent
 * requests across serverless instances share one counter. Service-role only:
 * the table has no authenticated-role policy at all.
 */
function createSupabaseAbuseStore(): AbuseStore {
  return {
    async increment({ scope, identifierHash, windowSeconds, now, metadata }) {
      const windowStartMs = computeWindowStart(now, windowSeconds);
      const supabase = createPrivilegedSupabaseClient({
        routeId: "security.abuse-protection",
        operation: "increment_rate_limit",
        reason: "abuse_rate_limit_tracking",
        systemActor: "system",
      });

      const { data, error } = await supabase.rpc("abuse_rate_limit_increment", {
        p_scope: scope,
        p_identifier_hash: identifierHash,
        p_window_start: new Date(windowStartMs).toISOString(),
        p_metadata: redactAbuseMetadata(metadata),
      });

      if (error) {
        throw new Error(`Unable to increment abuse rate limit: ${error.message}`);
      }

      return { count: typeof data === "number" ? data : Number(data), windowStart: windowStartMs };
    },
  };
}

let sharedSupabaseAbuseStore: AbuseStore | null = null;

function selectAbuseStore(): AbuseStore {
  if (hasSupabaseServiceRoleEnv) {
    if (!sharedSupabaseAbuseStore) sharedSupabaseAbuseStore = createSupabaseAbuseStore();
    return sharedSupabaseAbuseStore;
  }
  return sharedInMemoryAbuseStore;
}

// ── Public API ───────────────────────────────────────────────────────────────

export type EnforceAbuseLimitInput = {
  /** Coarse category, e.g. "billing.create_checkout_session" — must match an id in abuse-protection-registry.ts. */
  scope: string;
  /** The thing being rate-limited: a user id, workspace id, email, IP, or token. Never persisted raw. */
  identifier: string;
  /** Max attempts allowed within the window. */
  limit: number;
  windowSeconds: number;
  /** Optional secondary discriminator when a scope covers more than one action (e.g. early-access founder actions). */
  action?: string;
  /** Non-identifying context for observability; token/email/secret-like keys are stripped before use. */
  metadata?: Record<string, unknown>;
};

export type EnforceAbuseLimitDeps = {
  store?: AbuseStore;
  now?: () => number;
};

/**
 * Core abuse-protection gate. Fails closed: an invalid limit/window config,
 * or a store error (e.g. a transient Supabase outage), both deny the
 * request rather than silently allowing it through. Callers that need a
 * different failure posture must handle that explicitly at the call site —
 * this module never fails open.
 */
export async function enforceAbuseLimit(
  input: EnforceAbuseLimitInput,
  deps: EnforceAbuseLimitDeps = {},
): Promise<AbuseProtectionDecision> {
  const now = deps.now ?? Date.now;
  const identifierHash = hashAbuseIdentifier(input.identifier);
  const key = buildAbuseKey([input.scope, input.action, identifierHash]);

  if (!Number.isFinite(input.limit) || input.limit <= 0 || !Number.isFinite(input.windowSeconds) || input.windowSeconds <= 0) {
    return { allowed: false, key, reason: "invalid_key" };
  }

  const store = deps.store ?? selectAbuseStore();
  const nowMs = now();
  const scope = buildAbuseKey([input.scope, input.action]);

  let result: AbuseStoreIncrementResult;
  try {
    result = await store.increment({ scope, identifierHash, windowSeconds: input.windowSeconds, now: nowMs, metadata: { scope: input.scope, action: input.action ?? null, ...input.metadata } });
  } catch (error) {
    console.error("[abuse-protection] store_increment_failed", { scope: input.scope, action: input.action ?? null, error: error instanceof Error ? error.message : "unknown" });
    return { allowed: false, key, reason: "rate_limited" };
  }

  const resetAt = new Date(result.windowStart + input.windowSeconds * 1000).toISOString();

  if (result.count > input.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((result.windowStart + input.windowSeconds * 1000 - nowMs) / 1000));
    void logSecurityEvent("abuse_rate_limited", {
      routeId: input.scope,
      metadata: { key, action: input.action ?? null, limit: input.limit, windowSeconds: input.windowSeconds, count: result.count },
    });
    return { allowed: false, key, reason: "rate_limited", retryAfterSeconds, resetAt };
  }

  return { allowed: true, key, remaining: Math.max(0, input.limit - result.count), resetAt };
}

/**
 * Builds a generic 429 Response for a denied AbuseProtectionDecision. Never
 * leaks the underlying reason beyond rate_limited/cooldown/invalid_key —
 * callers should not add anything more specific to the body.
 */
export function abuseDenyResponse(decision: Extract<AbuseProtectionDecision, { allowed: false }>, message = "Too many requests. Please try again later."): Response {
  const headers = new Headers({ "content-type": "application/json" });
  if (decision.retryAfterSeconds) headers.set("Retry-After", String(decision.retryAfterSeconds));
  return new Response(JSON.stringify({ error: message, code: decision.reason }), { status: 429, headers });
}
