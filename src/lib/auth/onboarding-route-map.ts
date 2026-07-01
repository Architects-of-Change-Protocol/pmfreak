import type { OnboardingState } from "./resolve-onboarding-state";

/**
 * Single mapping from OnboardingState to redirect URL.
 * All consumers must use this to stay in sync with route changes.
 */
export function getOnboardingRedirect(state: OnboardingState): string {
  switch (state) {
    case "no_workspace":
      return "/workspace/setup";
    case "needs_pmo_setup":
      return "/workspace/setup";
    case "needs_project":
      return "/projects/new";
    case "active":
      return "/command-center";
    case "trial_blocked":
      return "/trial-inactive";
  }
}

export function isOnboardingComplete(state: OnboardingState): boolean {
  return state === "active";
}
