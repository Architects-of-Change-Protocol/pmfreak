import type { OnboardingState } from "./resolve-onboarding-state";
import { getOnboardingRedirect, isOnboardingComplete } from "./onboarding-route-map";

export type PostAuthContext = {
  isAuthenticated: boolean;
  /**
   * Full canonical onboarding state. When provided it takes precedence over
   * `onboardingCompleted` for all routing decisions.
   */
  onboardingState?: OnboardingState;
  /**
   * @deprecated Prefer `onboardingState`. This boolean is still accepted from
   * Edge middleware (proxy.ts) which cannot run async DB resolvers, but all
   * server-side callers should pass `onboardingState` instead.
   */
  onboardingCompleted?: boolean;
  requestedRoute?: string | null;
  isRequestedRouteSafe?: boolean;
};

export type PostAuthDecision = {
  destination: string;
  reason: "requested-route" | "onboarding-required" | "command-center-default" | "unauthenticated";
};

export function resolvePostAuthDestination(context: PostAuthContext): PostAuthDecision {
  if (!context.isAuthenticated) {
    return { destination: "/login", reason: "unauthenticated" };
  }

  // Resolve effective onboarding completeness from canonical state or legacy boolean
  const state: OnboardingState | undefined = context.onboardingState;
  const completed: boolean =
    state != null ? isOnboardingComplete(state) : (context.onboardingCompleted ?? false);

  if (!completed) {
    const destination = state != null ? getOnboardingRedirect(state) : "/workspace/setup";
    return { destination, reason: "onboarding-required" };
  }

  // Phase 4: canonical state always wins — even if continuation route is safe,
  // a non-active state overrides it.
  if (context.requestedRoute && context.isRequestedRouteSafe) {
    if (state != null && !isOnboardingComplete(state)) {
      return { destination: getOnboardingRedirect(state), reason: "onboarding-required" };
    }
    return { destination: context.requestedRoute, reason: "requested-route" };
  }

  return { destination: "/command-center", reason: "command-center-default" };
}
