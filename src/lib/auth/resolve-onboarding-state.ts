import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { isFounderOrInternalUser } from "@/lib/auth";
import type { AuthUserContext } from "@/lib/auth";

export type OnboardingState =
  | "no_workspace"
  | "needs_project"
  | "active"
  | "trial_blocked";

type OnboardingStateQueryClient = Pick<ReturnType<typeof createSupabaseServiceRoleClient>, "from">;

/**
 * Canonical resolver for onboarding state. This is the single source of truth
 * for all routing decisions related to onboarding/access gating — including
 * Edge middleware (src/proxy.ts performs no onboarding-state redirects of its
 * own; (protected)/layout.tsx is the sole caller that redirects on state).
 *
 * State is derived exclusively from real persisted entities:
 *   - "no_workspace": no resolvable workspace for this user (defensive —
 *     resolveWriteWorkspace/ensureUserWorkspace bootstrap a workspace before
 *     this is normally called, so this is effectively unreachable in the
 *     (protected) layout, but is handled honestly rather than assumed away).
 *   - "needs_project": a workspace exists but has zero real Projects.
 *   - "active": the workspace has at least one real Project.
 *   - "trial_blocked": an expired/revoked trial license blocks access.
 *
 * A PMO/Command Center is explicitly NOT a precondition here — ADR-PMF-006
 * Rule 11 requires that no onboarding flow gate Project creation behind
 * creation of a level above Project. There is no persisted
 * "onboardingComplete"-style flag anywhere in this resolution: every branch
 * reads real rows.
 */
export async function resolveOnboardingState(
  user: AuthUserContext,
  workspaceId: string | null,
  opts?: { isRecovered?: boolean; getClient?: () => OnboardingStateQueryClient }
): Promise<OnboardingState> {
  if (!workspaceId) return "no_workspace";

  const supabase =
    opts?.getClient?.() ??
    createSupabaseServiceRoleClient({
      routeId: "auth/resolve-onboarding-state",
      operation: "select",
      reason: "onboarding_state_resolution",
      workspaceId,
      systemActor: "system",
      actorUserId: user.id,
    });

  // Check trial status — skip for newly-bootstrapped workspaces and internal users
  if (!isFounderOrInternalUser(user) && !opts?.isRecovered) {
    const { data: memberships } = await supabase
      .from("workspace_memberships")
      .select("workspace_id")
      .eq("user_id", user.id)
      .limit(20);

    const workspaceIds = (memberships ?? []).map((m: { workspace_id: string }) => m.workspace_id);

    const { data: activeTrial } = await supabase
      .from("trial_licenses")
      .select("id, invite_id, workspace_id, trial_status, trial_end_at")
      .in("workspace_id", workspaceIds.length ? workspaceIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeTrial?.id) {
      // Expire this trial if it has passed trial_end_at.
      await supabase
        .from("trial_licenses")
        .update({ trial_status: "expired" })
        .eq("id", activeTrial.id)
        .eq("trial_status", "active")
        .lt("trial_end_at", new Date().toISOString());
    }

    const { data: refreshedTrial } = activeTrial?.id
      ? await supabase
          .from("trial_licenses")
          .select("id, invite_id, workspace_id, trial_status")
          .eq("id", activeTrial.id)
          .maybeSingle()
      : { data: null };

    const inactive =
      !refreshedTrial ||
      refreshedTrial.trial_status === "revoked" ||
      refreshedTrial.trial_status === "expired";

    if (inactive) {
      return "trial_blocked";
    }
  }

  // Check project existence — the only precondition for "active". No PMO/
  // Command Center check: a workspace with zero PMOs and a real Project is
  // fully active (ADR-PMF-006 Rule 11; ratified onboarding decision).
  const { data: projects } = await supabase
    .from("projects")
    .select("id")
    .eq("workspace_id", workspaceId)
    .limit(1);

  if (!projects || projects.length === 0) return "needs_project";

  return "active";
}
