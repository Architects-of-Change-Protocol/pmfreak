import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { isFounderOrInternalUser } from "@/lib/auth";
import { collectWorkspaceActivationEvidence } from "@/lib/workspace-activation/evaluate-workspace-activation";

export type OnboardingState =
  | "no_workspace"
  | "needs_project"
  | "needs_task"
  | "execution_started"
  | "active"
  | "trial_blocked";

/**
 * Minimal identity resolveOnboardingState actually depends on — not the
 * full AuthUserContext. This lets a caller resolving destination immediately
 * after a fresh sign-in/sign-up build the input directly from that
 * operation's own response (`data.user.id`/`data.user.email`), with no
 * dependency on a subsequent cookie-backed session read succeeding in the
 * same request. See "Login/signup session-visibility verification" in
 * docs/audits/remediation/pmf-001-002-canonical-onboarding-honest-activation.md.
 */
export type OnboardingStateUser = { id: string; email: string | null };

type OnboardingStateQueryClient = Pick<ReturnType<typeof createSupabaseServiceRoleClient>, "from">;

/**
 * Canonical resolver for onboarding/activation state. This is the single
 * source of truth for all routing decisions related to onboarding/access
 * gating — including Edge middleware (src/proxy.ts performs no
 * onboarding-state redirects of its own; (protected)/layout.tsx is the sole
 * caller that redirects on state).
 *
 * State is derived exclusively from real persisted entities, and — critically
 * — from the SAME evidence source the PR #547 workspace-activation engine
 * uses (`collectWorkspaceActivationEvidence`), not a second, independently-
 * queried state machine with its own overlapping semantics:
 *   - "no_workspace": no resolvable workspace for this user (defensive —
 *     resolveWriteWorkspace/ensureUserWorkspace bootstrap a workspace before
 *     this is normally called, so this is effectively unreachable in the
 *     (protected) layout, but is handled honestly rather than assumed away).
 *   - "needs_project": a workspace exists but has zero real, non-archived
 *     Projects.
 *   - "needs_task": a real Project exists but zero real execution tasks do.
 *   - "execution_started": a real Project AND a real execution task exist,
 *     but Command Center is not yet active (no PMF-004-backed default PMO).
 *   - "active": Command Center is active — a real `pmos` row exists,
 *     produced by PMF-004's idempotent `ensure_default_pmo`/`savePmoTenant`
 *     path. This is deliberately independent of task existence: Command
 *     Center activation (`activateContextAction`) can create a Project and
 *     PMO together without a task ever existing first, and once Command
 *     Center is active that is the terminal onboarding state regardless.
 *   - "trial_blocked": an expired/revoked trial license blocks access.
 *
 * A PMO/Command Center is explicitly NOT a precondition for reaching
 * "needs_task"/"execution_started" — ADR-PMF-006 Rule 11 requires that no
 * onboarding flow gate Project (or task) creation behind creation of a level
 * above Project. "active" specifically means Command Center is active, never
 * merely "a Project exists" — see `isOnboardingComplete` vs
 * `hasWorkspaceAccess` in `onboarding-route-map.ts` for how this distinction
 * is used by two different callers (persistent route gate vs. post-auth
 * landing) without duplicating vocabulary.
 *
 * There is no persisted "onboardingComplete"-style flag anywhere in this
 * resolution: every branch reads real rows.
 *
 * NOTE: This function uses service-role DB access exclusively (both for its
 * own trial/workspace queries and, by passing the same client through to
 * `collectWorkspaceActivationEvidence`, for evidence collection) — never the
 * cookie/RLS-scoped client that function defaults to. This resolver must be
 * reliable in every calling context, including immediately after a fresh
 * sign-in/sign-up in the same request (see `OnboardingStateUser` above), so
 * it never depends on a session cookie having propagated. It is intended for
 * server-side surfaces only (Server Components, Route Handlers, Server
 * Actions). Do NOT use this in Edge middleware (proxy.ts), which cannot
 * perform async DB calls.
 */
export async function resolveOnboardingState(
  user: OnboardingStateUser,
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

  // Post-workspace-existence state reuses the exact evidence probes the PR
  // #547 engine uses — the service-role client already constructed above is
  // passed through so this never depends on the cookie/RLS-scoped default.
  // `role: "viewer"` is a functionally inert placeholder: it is only
  // threaded into `evidence.role` (used for per-step `actionAllowed` display
  // logic and activation-mode derivation), neither of which this routing
  // resolver reads — it consumes only projectExists/taskExists/pmoExists.
  const evidence = await collectWorkspaceActivationEvidence({
    workspaceId,
    userId: user.id,
    role: "viewer",
    getClient: async () => supabase,
  });

  if (!evidence.projectExists) return "needs_project";
  if (evidence.pmoExists) return "active";
  if (!evidence.taskExists) return "needs_task";
  return "execution_started";
}
