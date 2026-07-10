import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { loadPmoTenant } from "@/lib/pmo/load-pmo-tenant";
import { isFounderOrInternalUser } from "@/lib/auth";
import type { AuthUserContext } from "@/lib/auth";

export type OnboardingState =
  | "no_workspace"
  | "needs_pmo_setup"
  | "needs_project"
  | "active"
  | "trial_blocked";

/**
 * Canonical resolver for onboarding state. This is the single source of truth
 * for all routing decisions related to onboarding/access gating.
 *
 * NOTE: This function uses service-role DB access. It is intended for
 * server-side surfaces only (Server Components, Route Handlers, Server Actions).
 * Do NOT use this in Edge middleware (proxy.ts) — use the sync JWT-based helper instead.
 */
export async function resolveOnboardingState(
  user: AuthUserContext,
  workspaceId: string | null,
  opts?: { isRecovered?: boolean }
): Promise<OnboardingState> {
  if (!workspaceId) return "no_workspace";

  const supabase = createSupabaseServiceRoleClient({
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

  // Check PMO governance (schema v2 required)
  const pmoResult = await loadPmoTenant(workspaceId);
  if (!pmoResult.found) return "needs_pmo_setup";

  // Check project existence
  const { data: projects } = await supabase
    .from("projects")
    .select("id")
    .eq("workspace_id", workspaceId)
    .limit(1);

  if (!projects || projects.length === 0) return "needs_project";

  return "active";
}

/**
 * Lightweight sync version for Edge middleware (proxy.ts).
 * Maps the JWT boolean flag to a coarse OnboardingState without DB access.
 * The full async resolver should be preferred on server-side surfaces.
 */
export function resolveOnboardingStateFromJwt(
  onboardingCompleted: boolean
): Extract<OnboardingState, "needs_pmo_setup" | "active"> {
  return onboardingCompleted ? "active" : "needs_pmo_setup";
}
