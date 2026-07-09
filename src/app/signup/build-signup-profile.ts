import { DEFAULT_SIGNUP_ROLE } from "@/lib/auth";

/**
 * Extracts the fields signup persists. Pure and exported for testing.
 *
 * SECURITY: `role` is never read from the submitted FormData. Public signup
 * always grants the minimum-privilege role — any `role` field an attacker
 * appends via DevTools, curl, or a modified request is silently ignored.
 * Elevated roles can only be granted server-side, via a validated workspace
 * invite (see `@/lib/workspace-team`) or explicit admin action.
 */
export function buildSignupProfile(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? "").trim(),
    fullName: String(formData.get("fullName") ?? "").trim(),
    companyName: String(formData.get("companyName") ?? "").trim(),
    requestedRoute: String(formData.get("next") ?? "").trim() || null,
    role: DEFAULT_SIGNUP_ROLE,
  };
}
