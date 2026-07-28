import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolvePostAuthDestination } from "@/lib/auth/resolve-post-auth-destination";
import { isSafeContinuationRoute } from "@/lib/auth/validate-continuation-route";
import { debugAuthDecision } from "@/lib/auth/auth-decision-debug";
import { resolveOnboardingState } from "@/lib/auth/resolve-onboarding-state";
import { resolveCanonicalWorkspace } from "@/lib/workspaces/canonical-workspace-resolver";
import { getAuthUser } from "@/lib/auth";

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const requestedRouteFromForm = String(formData.get("next") ?? "").trim();
  const requestedRouteFromQuery = requestUrl.searchParams.get("next")?.trim() ?? "";
  const requestedRoute = requestedRouteFromForm || requestedRouteFromQuery || null;

  if (!email || !password) {
    return NextResponse.redirect(new URL("/login?error=Email+and+password+are+required", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error, data } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const isUnverified = error.message.toLowerCase().includes("email not confirmed");
    const message = isUnverified ? "Please verify your email before logging in." : error.message;
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, request.url));
  }

  const safe = requestedRoute ? isSafeContinuationRoute(requestedRoute) : false;
  const authUser = await getAuthUser();
  const onboardingState = authUser
    ? await resolveOnboardingState(authUser, (await resolveCanonicalWorkspace(authUser.id)).workspaceId)
    : undefined;
  const decision = resolvePostAuthDestination({
    isAuthenticated: Boolean(data.user),
    onboardingState,
    requestedRoute,
    isRequestedRouteSafe: safe,
  });

  debugAuthDecision({ requestedRoute, onboardingCompleted: onboardingState != null && onboardingState === "active", decision });
  return NextResponse.redirect(new URL(decision.destination, request.url));
}
