"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSafeContinuationRoute } from "@/lib/auth/validate-continuation-route";
import { resolvePostAuthDestination } from "@/lib/auth/resolve-post-auth-destination";
import { resolveOnboardingState } from "@/lib/auth/resolve-onboarding-state";
import { resolveCanonicalWorkspace } from "@/lib/workspaces/canonical-workspace-resolver";
import { buildSignupProfile } from "./build-signup-profile";
import { buildAbuseKey, enforceAbuseLimit, getClientIpFromHeaders } from "@/lib/security/abuse-protection";

export async function signupAction(formData: FormData) {
  const { email, password, fullName, companyName, requestedRoute, role } = buildSignupProfile(formData);

  if (!email || !password || !fullName || !companyName) {
    redirect("/signup?error=Please+complete+all+required+fields");
  }

  // Abuse protection is separate from authorization: signup is intentionally
  // public, but unlimited account creation still floods Supabase Auth and
  // workspace bootstrap. See docs/security/abuse-protection-boundary.md
  // ("signup.create_account").
  const headersList = await headers();
  const clientIp = getClientIpFromHeaders(headersList);
  const abuseDecision = await enforceAbuseLimit({
    scope: "signup.create_account",
    identifier: buildAbuseKey([clientIp, email]),
    limit: 8,
    windowSeconds: 3600,
  });
  if (!abuseDecision.allowed) {
    redirect("/signup?error=Too+many+signup+attempts.+Please+try+again+later.");
  }

  const supabase = await createSupabaseServerClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      data: {
        full_name: fullName,
        company_name: companyName,
        role,
      },
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  if (!data.session) {
    redirect(`/signup/confirm-email?email=${encodeURIComponent(email)}`);
  }

  const safe = requestedRoute ? isSafeContinuationRoute(requestedRoute) : false;
  // Built directly from signUp's own response (data.user), never from a
  // subsequent getAuthUser()/cookie-backed session read: cookies() is
  // documented to share a mutable, request-scoped store across sequential
  // calls within one Server Action, but this destination decision doesn't
  // need to depend on that at all when the identity is already in hand —
  // see "Login/signup session-visibility verification" in
  // docs/audits/remediation/pmf-001-002-canonical-onboarding-honest-activation.md.
  // resolveOnboardingState/resolveCanonicalWorkspace both use the
  // service-role client (keyed by userId), independent of session cookies.
  const authUser = data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
  const onboardingState = authUser
    ? await resolveOnboardingState(authUser, (await resolveCanonicalWorkspace(authUser.id)).workspaceId)
    : undefined;
  const decision = resolvePostAuthDestination({
    isAuthenticated: Boolean(data.user),
    onboardingState,
    requestedRoute,
    isRequestedRouteSafe: safe,
  });
  redirect(decision.destination);
}
