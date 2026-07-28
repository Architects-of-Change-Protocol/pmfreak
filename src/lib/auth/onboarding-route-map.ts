import type { OnboardingState } from "./resolve-onboarding-state";

/**
 * Single mapping from OnboardingState to redirect URL.
 * All consumers must use this to stay in sync with route changes.
 *
 * No state maps to the retired legacy wizard route (/workspace/setup) or to
 * a PMO/Command Center creation route — Project creation is always reachable
 * directly from "needs_project", with no precondition above Project.
 */
export function getOnboardingRedirect(state: OnboardingState): string {
  switch (state) {
    case "no_workspace":
      // Defensive fallback only (see resolveOnboardingState) — workspace
      // bootstrap is automatic and atomic before this state is ever read in
      // practice. Project creation itself resolves/bootstraps the write
      // workspace, so this is a safe destination even in that edge case.
      return "/projects/new";
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
