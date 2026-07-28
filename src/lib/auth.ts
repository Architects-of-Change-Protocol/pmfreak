import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UserRole = "owner" | "admin" | "pm" | "viewer";

export type AuthUserContext = {
  id: string;
  email: string;
  fullName: string;
  companyId: string;
  companyName: string;
  /**
   * DISPLAY role only — sourced from `user_metadata.role`, which is written at
   * signup and is informational, never authoritative. It is intentionally
   * clamped so it can never read back as "owner" or "admin": those values are
   * never written to metadata by any legitimate code path, so if one is ever
   * present (historical data, a tampered client, direct DB edits) it is
   * degraded to the minimum-privilege role rather than trusted.
   *
   * Never branch authorization logic on this field. The trustworthy sources
   * for elevated privilege are workspace membership (`workspace_memberships.role`,
   * see `@/lib/workspace-access`) and the founder/internal allowlist
   * (`isFounderOrInternalUser` below).
   */
  role: UserRole;
  /**
   * @deprecated Stale, non-authoritative. Reflects the legacy
   * `user_metadata.onboarding_completed` flag, which no production code path
   * writes as `true` anymore (see
   * docs/audits/remediation/pmf-001-002-canonical-onboarding-honest-activation.md).
   * Never use this for routing or activation-state decisions — use
   * `resolveOnboardingState` (derives from real workspace/project rows)
   * instead. Retained only so existing display-only consumers keep
   * compiling; do not add new reads of this field.
   */
  onboardingCompleted: boolean;
};

/** Minimum-privilege role assigned to every publicly self-registered account. */
export const DEFAULT_SIGNUP_ROLE: UserRole = "viewer";

/**
 * Maps informational `user_metadata.role` to a display role. "owner" and
 * "admin" are excluded on purpose — they must never be derivable from
 * client-controlled metadata. See `AuthUserContext.role` for the trust
 * boundary this enforces.
 */
export const toDisplayRole = (role: unknown): UserRole => {
  if (role === "pm" || role === "viewer") {
    return role;
  }

  return DEFAULT_SIGNUP_ROLE;
};

export const getAuthUser = cache(async (): Promise<AuthUserContext | null> => {
  if (!hasSupabaseEnv) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return null;
  }

  const metadata = user.user_metadata ?? {};

  return {
    id: user.id,
    email: user.email,
    fullName: typeof metadata.full_name === "string" ? metadata.full_name : user.email,
    companyId: typeof metadata.company_id === "string" ? metadata.company_id : user.id,
    companyName: typeof metadata.company_name === "string" ? metadata.company_name : "Independent",
    role: toDisplayRole(metadata.role),
    onboardingCompleted: metadata.onboarding_completed === true,
  };
});

export const requireAuthUser = async () => {
  const user = await getAuthUser();
  if (!user) {
    const headersList = await headers();
    const currentPath = headersList.get("x-pathname") ?? "/command-center";
    const nextParam = encodeURIComponent(currentPath || "/command-center");
    redirect(`/login?next=${nextParam}`);
  }
  return user;
};

const INTERNAL_EMAIL_DOMAINS = ["@pmfreak.ai", "@onchainfest.xyz"];

const founderEmailAllowlist = (): Set<string> =>
  new Set(
    (process.env.FOUNDER_EMAIL_ALLOWLIST ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );

// Requires a "local@domain.tld"-shaped string. Deliberately rejects anything
// that doesn't have a dot in the domain part, so a missing/garbage email
// value fails closed at `deny_invalid_email` rather than reaching the
// endsWith/Set comparisons below with unpredictable input.
const EMAIL_SHAPE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FounderAccessDecision =
  | "allow"
  | "deny_missing_email"
  | "deny_invalid_email"
  | "deny_not_founder_or_internal";

export type FounderAccessResult = {
  allowed: boolean;
  decision: FounderAccessDecision;
  normalizedEmail?: string;
  source?: "internal_domain" | "allowlist";
};

/**
 * Centralized founder/internal access decision. This is the ONLY function
 * that may authorize founder/internal-only surfaces (early access
 * administration, trial license mutations, internal summaries, trial-expiry
 * bypass). Its input shape is deliberately `{ email }` only — there is no
 * `role`, `actorRole`, `isFounder`, `isAdmin`, or `permissions` parameter for
 * a caller to smuggle elevated identity through, and the function never
 * reads `user_metadata`, a display role, or anything from a request body.
 *
 * The only trusted sources are:
 *   - `INTERNAL_EMAIL_DOMAINS`: a fixed, server-controlled list of internal
 *     domains, matched with `endsWith("@domain")` — the "@" is part of the
 *     match, so "attacker@evilpmfreak.ai" and "attacker@pmfreak.ai.evil.com"
 *     both fail (neither ends with the literal "@pmfreak.ai").
 *   - `FOUNDER_EMAIL_ALLOWLIST`: a server-only environment variable, parsed
 *     into a `Set` of trimmed/lowercased exact emails — membership is exact
 *     equality, never substring or prefix matching.
 *
 * Fails closed: missing, non-string, or malformed email input is denied
 * before either trusted source is even consulted.
 */
export const evaluateFounderOrInternalAccess = (input: { email?: string | null }): FounderAccessResult => {
  const raw = input.email;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { allowed: false, decision: "deny_missing_email" };
  }

  const normalizedEmail = raw.trim().toLowerCase();
  if (!EMAIL_SHAPE_PATTERN.test(normalizedEmail)) {
    return { allowed: false, decision: "deny_invalid_email" };
  }

  const internalDomain = INTERNAL_EMAIL_DOMAINS.some((domain) => normalizedEmail.endsWith(domain));
  if (internalDomain) {
    return { allowed: true, decision: "allow", normalizedEmail, source: "internal_domain" };
  }

  if (founderEmailAllowlist().has(normalizedEmail)) {
    return { allowed: true, decision: "allow", normalizedEmail, source: "allowlist" };
  }

  return { allowed: false, decision: "deny_not_founder_or_internal", normalizedEmail };
};

/**
 * Gates founder/internal-only surfaces (early access administration, trial
 * bypass, etc). Deliberately does NOT consult `user.role` — that field is
 * sourced from client-writable `user_metadata` at signup and must never be
 * treated as an authorization signal. Thin wrapper over
 * `evaluateFounderOrInternalAccess`, which is the actual decision logic and
 * the seam covered by direct unit tests.
 */
export const isFounderOrInternalUser = (user: AuthUserContext) =>
  evaluateFounderOrInternalAccess({ email: user.email }).allowed;
