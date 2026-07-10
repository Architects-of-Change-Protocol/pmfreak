import { NextResponse } from "next/server";
import { isFounderOrInternalUser, requireAuthUser } from "@/lib/auth";
import { computeRemainingTrialDays } from "@/lib/early-access";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";

export async function GET() {
  const user = await requireAuthUser();
  if (!isFounderOrInternalUser(user)) return NextResponse.json({ error: "Founder access is required." }, { status: 403 });
  const supabase = createSupabaseServiceRoleClient({ routeId: "/api/early-access/summary", operation: "service_role_query", reason: "existing_privileged_flow", systemActor: "system", actorUserId: user.id });

  await supabase
    .from("trial_licenses")
    .update({ trial_status: "expired" })
    .eq("trial_status", "active")
    .lt("trial_end_at", new Date().toISOString());

  const [{ data: invites }, { data: trials }, { data: activations }, { data: events }] = await Promise.all([
    supabase.from("early_access_invites").select("id, invite_email, expires_at, accepted_at, revoked_at, created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("trial_licenses").select("id, trial_status, trial_end_at, workspace_id, created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("workspace_activations").select("id, workspace_id, activated_at, initialization_status").order("activated_at", { ascending: false }).limit(50),
    supabase.from("early_access_events").select("event_type, created_at").order("created_at", { ascending: false }).limit(200),
  ]);

  const usageByEvent = (events ?? []).reduce<Record<string, number>>((acc, event) => {
    acc[event.event_type] = (acc[event.event_type] ?? 0) + 1;
    return acc;
  }, {});

  const activeTrials = (trials ?? []).filter((trial) => trial.trial_status === "active").map((trial) => ({ ...trial, remainingDays: computeRemainingTrialDays(trial.trial_end_at) }));

  return NextResponse.json({
    pendingInvites: (invites ?? []).filter((invite) => !invite.accepted_at && !invite.revoked_at),
    expiredTrials: (trials ?? []).filter((trial) => trial.trial_status === "expired"),
    activeTrials,
    activatedWorkspaces: activations ?? [],
    usageSummary: usageByEvent,
  });
}
