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

/**
 * Gates founder/internal-only surfaces (early access administration, trial
 * bypass, etc). Deliberately does NOT consult `user.role` — that field is
 * sourced from client-writable `user_metadata` at signup and must never be
 * treated as an authorization signal. The only trusted sources here are the
 * server-controlled internal email domains and the `FOUNDER_EMAIL_ALLOWLIST`
 * environment variable, neither of which a signing-up user can influence.
 */
export const isFounderOrInternalUser = (user: AuthUserContext) => {
  const email = user.email.toLowerCase();

  const internalDomain = INTERNAL_EMAIL_DOMAINS.some((domain) => email.endsWith(domain));
  const allowlisted = founderEmailAllowlist().has(email);

  return internalDomain || allowlisted;
};
