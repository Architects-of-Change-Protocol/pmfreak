import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { resolvePostAuthDestination } from "@/lib/auth/resolve-post-auth-destination";
import { resolveOnboardingStateFromJwt } from "@/lib/auth/resolve-onboarding-state";
import { getOnboardingRedirect, isOnboardingComplete } from "@/lib/auth/onboarding-route-map";
import { isSafeContinuationRoute } from "@/lib/auth/validate-continuation-route";
import {
  getRouteAccessPolicy,
  isAuthRoute,
  isInternalDebugRoute,
  isProtectedPageRoute,
  isSetupRoute,
  requiresOnboardingCompletion,
} from "@/lib/auth/route-policy-registry";

// ─── Policy table ────────────────────────────────────────────────────────────
// Public routes        → passthrough (no auth required)
// Auth routes          → redirect authenticated users away; accept ?next param
// Protected routes     → unauthenticated → /login?next=<path>
// Setup/onboarding     → authenticated + complete → /command-center
// Workspace routes     → incomplete onboarding → getOnboardingRedirect(state)
// /workspace            → always → /command-center (legacy shell quarantined)
// Active               → passthrough
// trial_blocked        → /trial-inactive  (via getOnboardingRedirect)
// API routes           → passthrough (handled by route handlers)
// Assets/_next         → excluded by matcher; never reach this function
// ─────────────────────────────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;
  const policy = getRouteAccessPolicy(pathname);

  // API routes: let route handlers own authentication
  if (policy === "api") {
    return response;
  }

  // Debug routes blocked in production
  if (isInternalDebugRoute(pathname) && process.env.NODE_ENV === "production") {
    return NextResponse.redirect(new URL("/command-center", request.url));
  }

  // Unauthenticated access to protected route → /login?next=<path>
  if (isProtectedPageRoute(pathname) && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user) {
    // Use sync JWT-based state resolver — middleware cannot do async DB calls.
    const jwtOnboardingCompleted = user.user_metadata?.onboarding_completed === true;
    const onboardingState = resolveOnboardingStateFromJwt(jwtOnboardingCompleted);
    const onboardingCompleted = isOnboardingComplete(onboardingState);

    // Authenticated user on auth route → resolve post-auth destination
    if (isAuthRoute(pathname)) {
      const requestedRoute = request.nextUrl.searchParams.get("next");
      const decision = resolvePostAuthDestination({
        isAuthenticated: true,
        onboardingState,
        requestedRoute,
        isRequestedRouteSafe: requestedRoute ? isSafeContinuationRoute(requestedRoute) : false,
      });
      return NextResponse.redirect(new URL(decision.destination, request.url));
    }

    // Completed onboarding user on setup route → /command-center
    if (isSetupRoute(pathname) && onboardingCompleted) {
      return NextResponse.redirect(new URL("/command-center", request.url));
    }

    // Incomplete onboarding on workspace route → state-specific redirect
    if (requiresOnboardingCompletion(pathname) && !onboardingCompleted && pathname !== "/logout") {
      const dest = getOnboardingRedirect(onboardingState);
      // Guard: never redirect to the current path (loop prevention)
      if (dest !== pathname) {
        return NextResponse.redirect(new URL(dest, request.url));
      }
    }

    // Quarantine the legacy dark /workspace shell — always bounce authenticated
    // users to the premium light Command Center instead of rendering it.
    if (pathname === "/workspace") {
      return NextResponse.redirect(new URL("/command-center", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|apple-icon.png|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
