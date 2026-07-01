import { requireAuthUser } from "@/lib/auth";
import { assertRuntimeAuthContinuity } from "@/lib/auth/runtime-auth-continuity";
import { resolveCanonicalWorkspace } from "@/lib/workspaces/canonical-workspace-resolver";
import { OperationalShell } from "@/components/pmfreak/operational-shell";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { ensureUserWorkspace } from "@/lib/workspaces";
import { resolvePostAuthDestination } from "@/lib/auth/resolve-post-auth-destination";
import { isSafeContinuationRoute } from "@/lib/auth/validate-continuation-route";
import { headers } from "next/headers";
import { resolveOnboardingState } from "@/lib/auth/resolve-onboarding-state";
import { getOnboardingRedirect, isOnboardingComplete } from "@/lib/auth/onboarding-route-map";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const continuity = await assertRuntimeAuthContinuity();
  if (!continuity.ok) {
    const headersList = await headers();
    const currentPath = headersList.get("x-pathname") ?? "/command-center";
    const nextParam = isSafeContinuationRoute(currentPath) ? currentPath : "/command-center";
    const decision = resolvePostAuthDestination({ isAuthenticated: false, onboardingCompleted: false });
    console.log("[protected-layout] continuity check failed, redirecting to login. path:", currentPath, "issues:", continuity.issues);
    redirect(`${decision.destination}?next=${encodeURIComponent(nextParam)}`);
  }

  const user = await requireAuthUser();
  let resolvedWorkspace = await resolveCanonicalWorkspace(user.id);
  console.log("[protected-layout] workspace resolution status:", resolvedWorkspace.status, "workspaceId:", resolvedWorkspace.workspaceId ?? "(none)");

  if (!resolvedWorkspace.workspaceId) {
    const ensured = await ensureUserWorkspace(user.id);
    resolvedWorkspace = { workspaceId: ensured.workspaceId, role: ensured.role, status: "resolved", recovered: true, issues: [] };
    console.log("[protected-layout] workspace bootstrapped:", ensured.workspaceId);
  }

  // Canonical onboarding state — single source of truth for all routing decisions.
  // Trial gating, PMO check, project check, and internal-user bypass all live
  // exclusively inside resolveOnboardingState(). No local gates here.
  const onboardingState = await resolveOnboardingState(user, resolvedWorkspace.workspaceId, { isRecovered: resolvedWorkspace.recovered });
  console.log("[protected-layout] onboarding state:", onboardingState);

  if (onboardingState === "trial_blocked") {
    const supabase = createSupabaseServiceRoleClient({ routeId: "(protected)/layout", operation: "service_role_query", reason: "access_blocked_event_log", systemActor: "system" });
    const { data: memberships } = await supabase.from("workspace_memberships").select("workspace_id").eq("user_id", user.id).limit(20);
    const workspaceIds = (memberships ?? []).map((m: { workspace_id: string }) => m.workspace_id);
    const { data: trial } = await supabase.from("trial_licenses").select("id, invite_id, workspace_id").in("workspace_id", workspaceIds.length ? workspaceIds : ["00000000-0000-0000-0000-000000000000"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    await supabase.from("early_access_events").insert({ invite_id: trial?.invite_id ?? null, trial_license_id: trial?.id ?? null, workspace_id: trial?.workspace_id ?? null, event_type: "access_blocked_trial_inactive", event_payload: { userId: user.id } });
    redirect(getOnboardingRedirect(onboardingState));
  }

  if (!isOnboardingComplete(onboardingState)) {
    const headersList = await headers();
    const currentPath = headersList.get("x-pathname") ?? "";
    if (currentPath.startsWith("/command-center") || currentPath.startsWith("/workspace/setup")) {
      const shellMarker = currentPath.startsWith("/workspace/setup") ? "pmfreak-light-workspace-setup" : "pmfreak-light-command-center";
      return <div data-shell={shellMarker} className="min-h-screen bg-[#FCFBF9] px-3 py-4 md:px-5 md:py-6">{children}</div>;
    }
    return <div className="min-h-screen bg-slate-950 text-slate-100"><main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">{children}</main></div>;
  }

  const headersList = await headers();
  const currentPath = headersList.get("x-pathname") ?? "";
  if (currentPath.startsWith("/workspace/setup")) {
    return <div data-shell="pmfreak-light-workspace-setup" className="min-h-screen bg-[#FCFBF9] px-3 py-4 md:px-5 md:py-6">{children}</div>;
  }

  return <OperationalShell user={{ fullName: user.fullName, role: user.role, companyName: user.companyName }}>{children}</OperationalShell>;
}
