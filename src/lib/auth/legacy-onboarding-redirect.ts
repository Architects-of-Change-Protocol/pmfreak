import { redirect } from "next/navigation";
import { requireAuthUser } from "@/lib/auth";
import { resolveWriteWorkspace } from "@/lib/workspaces/resolve-write-workspace";
import { resolveOnboardingState } from "@/lib/auth/resolve-onboarding-state";
import { getOnboardingRedirect } from "@/lib/auth/onboarding-route-map";

/**
 * Retired legacy onboarding entry points (/workspace/setup, /getting-started,
 * /onboarding) render nothing — they resolve real, current onboarding state
 * and redirect to the canonical destination. Never hardcodes a destination,
 * so a bookmarked legacy URL always lands wherever this account actually
 * needs to go next, with tenant authorization enforced by the same
 * resolver every other canonical entry point uses.
 */
export async function redirectToCanonicalOnboardingDestination(): Promise<never> {
  const user = await requireAuthUser();
  const workspace = await resolveWriteWorkspace(user.id);
  const state = await resolveOnboardingState(user, workspace.workspaceId, { isRecovered: workspace.bootstrapped });
  redirect(getOnboardingRedirect(state));
}
