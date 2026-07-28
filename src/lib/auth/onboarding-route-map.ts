import type { OnboardingState } from "./resolve-onboarding-state";

/**
 * Single mapping from OnboardingState to redirect URL.
 * All consumers must use this to stay in sync with route changes.
 *
 * No state maps to the retired legacy wizard route (/workspace/setup) or to
 * a PMO/Command Center creation route as a Project-creation precondition —
 * Project creation is always reachable directly from "needs_project", with
 * no precondition above Project.
 *
 * "needs_task", "execution_started" and "active" all resolve to
 * /command-center: it is the canonical surface that already hosts both the
 * first-task CTA (evidence-derived `WorkspaceOnboardingPanel`/
 * `CommandCenterEmptyState`, unchanged by this reconciliation) and the
 * Command Center activation CTA. The states remain distinct in the
 * OnboardingState value itself (see resolve-onboarding-state.ts) even though
 * their redirect destination is shared — this is the explicitly-allowed
 * "activation steps hosted inside /command-center" design, not a collapse of
 * the states themselves.
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
    case "needs_task":
      return "/command-center";
    case "execution_started":
      return "/command-center";
    case "active":
      return "/command-center";
    case "trial_blocked":
      return "/trial-inactive";
  }
}

/**
 * Whether onboarding is FULLY complete — Command Center is active (a real,
 * PMF-004-backed `pmos` row exists). Deliberately does NOT report true
 * merely because a Project (or even a Project + task) exists: conflating
 * "a Project exists" with "fully activated" was exactly the state-collapse
 * this reconciliation corrects. Used for:
 *   - the post-auth landing decision (resolve-post-auth-destination.ts) —
 *     freshly authenticated/incomplete users are funneled toward
 *     /command-center until Command Center is truly active;
 *   - display/reporting contexts that need a strict "is onboarding done"
 *     boolean.
 * Do NOT use this for the persistent route-access gate — see
 * `hasWorkspaceAccess` below.
 */
export function isOnboardingComplete(state: OnboardingState): boolean {
  return state === "active";
}

/**
 * Whether the workspace has cleared the minimum bar for general app
 * navigation — a real Project exists. Deliberately distinct from
 * `isOnboardingComplete`: this sprint's ratified rule (and ADR-PMF-006) is
 * that a Project may exist, and a user may freely navigate the rest of the
 * app, BEFORE Command Center is activated. Only "no_workspace",
 * "needs_project" and "trial_blocked" block general navigation; "needs_task",
 * "execution_started" and "active" all grant it — they differ only in what
 * /command-center itself shows as the next recommended action, never in
 * whether other routes (e.g. /team, /billing, /dashboard) are reachable.
 * Used exclusively by (protected)/layout.tsx's persistent route gate — never
 * by the post-auth landing decision, which intentionally funnels toward full
 * completion via `isOnboardingComplete` instead.
 */
export function hasWorkspaceAccess(state: OnboardingState): boolean {
  return state !== "no_workspace" && state !== "needs_project" && state !== "trial_blocked";
}
