import { notFound } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { isFounderOrInternalUser, requireAuthUser } from "@/lib/auth";
import { computeRemainingTrialDays } from "@/lib/early-access";

type InviteRow = {
  id: string;
  invite_email: string;
  invite_note: string | null;
  created_at: string;
  accepted_at: string | null;
  expires_at: string;
  revoked_at: string | null;
  requires_approval: boolean;
  approved_at: string | null;
};

type TrialRow = {
  id: string;
  trial_status: "pending" | "active" | "expired" | "revoked";
  trial_end_at: string | null;
  workspace_id: string | null;
};

type InviteEventRow = {
  invite_id: string;
  event_type: string;
  event_payload: Record<string, unknown> | null;
  created_at: string;
};

type ActivationRow = {
  workspace_id: string;
  activated_at: string;
  initialization_status: "pending" | "active" | "issue" | string;
};

const statusBadgeStyles: Record<string, string> = {
  pending: "border-amber-300/40 bg-amber-200/10 text-amber-800",
  active: "border-emerald-300/40 bg-emerald-200/10 text-emerald-800",
  expired: "border-slate-300/30 bg-slate-300/10 text-slate-800",
  revoked: "border-rose-300/40 bg-rose-200/10 text-rose-800",
  accepted: "border-sky-300/40 bg-sky-200/10 text-sky-800",
  issue: "border-orange-300/50 bg-orange-200/10 text-orange-800",
};

function StatusBadge({ label, tone }: { label: string; tone: keyof typeof statusBadgeStyles }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeStyles[tone]}`}>
      {label}
    </span>
  );
}

function formatTrialStatus(trial: TrialRow) {
  const daysRemaining = computeRemainingTrialDays(trial.trial_end_at);
  if (trial.trial_status === "revoked") return { label: "Access withdrawn", tone: "revoked" as const };
  if (trial.trial_status === "expired" || daysRemaining <= 0) return { label: "Access expired", tone: "expired" as const };
  if (trial.trial_status === "pending") return { label: "Pending approval", tone: "pending" as const };
  if (daysRemaining <= 5) return { label: `Trial ending soon · ${daysRemaining} days remaining`, tone: "pending" as const };
  return { label: `Trial active · ${daysRemaining} days remaining`, tone: "active" as const };
}

export default async function EarlyAccessPage() {
  const user = await requireAuthUser();
  // This page reads cross-workspace founder operations data (all invites,
  // trial licenses, activations, telemetry) via the service role client. A
  // normal authenticated user must never reach it — turned away below rather
  // than redirected, so the page's existence/data isn't distinguishable to them.
  if (!isFounderOrInternalUser(user)) {
    notFound();
  }
  const supabase = createSupabaseServiceRoleClient({ routeId: "/early-access/page", operation: "service_role_query", reason: "existing_privileged_flow", systemActor: "system", actorUserId: user.id });

  const [{ data: invites }, { data: trials }, { data: activations }, { data: events }, { data: telemetry }] = await Promise.all([
    supabase.from("early_access_invites").select("id, invite_email, invite_note, created_at, accepted_at, expires_at, revoked_at, requires_approval, approved_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("trial_licenses").select("id, trial_status, trial_end_at, workspace_id").order("created_at", { ascending: false }).limit(20),
    supabase.from("workspace_activations").select("workspace_id, activated_at, initialization_status").order("activated_at", { ascending: false }).limit(20),
    supabase.from("early_access_events").select("invite_id, event_type, event_payload, created_at").in("event_type", ["invite_email_send_attempted", "invite_email_sent", "invite_email_failed"]).order("created_at", { ascending: false }).limit(200),
    supabase.from("first_user_telemetry_events").select("event_type, created_at, user_id").order("created_at", { ascending: false }).limit(400),
  ]);

  const typedInvites = (invites ?? []) as InviteRow[];
  const typedTrials = (trials ?? []) as TrialRow[];
  const typedActivations = (activations ?? []) as ActivationRow[];
  const typedEvents = (events ?? []) as InviteEventRow[];

  const deliveryByInvite = new Map<string, { label: string; tone: keyof typeof statusBadgeStyles; detail?: string }>();
  for (const event of typedEvents) {
    if (deliveryByInvite.has(event.invite_id)) continue;
    if (event.event_type === "invite_email_sent") {
      deliveryByInvite.set(event.invite_id, { label: "Email sent", tone: "active", detail: `Sent ${new Date(event.created_at).toLocaleString()}` });
    } else if (event.event_type === "invite_email_failed") {
      const reason = typeof event.event_payload?.reason === "string" ? event.event_payload.reason : "Delivery failed";
      deliveryByInvite.set(event.invite_id, { label: "Email failed", tone: "issue", detail: reason });
    } else if (event.event_type === "invite_email_send_attempted") {
      deliveryByInvite.set(event.invite_id, { label: "Sending", tone: "pending" });
    }
  }

  const telemetryEvents = telemetry ?? [];
  const eventCount = (eventType: string) => telemetryEvents.filter((event) => event.event_type === eventType).length;
  const pendingInvites = typedInvites.filter((invite) => !invite.accepted_at);
  const activeTrials = typedTrials.filter((trial) => trial.trial_status === "active" || trial.trial_status === "pending" || trial.trial_status === "expired" || trial.trial_status === "revoked");

  return (
    <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-900 md:p-8">
      <header className="space-y-2 border-b border-slate-200 pb-5">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-600">Founder rollout operations</p>
        <h1 className="text-2xl font-semibold">Early Access Command View</h1>
        <p className="max-w-3xl text-slate-700">A calm operational snapshot of invitations, trial access health, and workspace readiness for your first users.</p>
      </header>


      <section className="space-y-3">
        <h2 className="text-base font-medium">First-user telemetry</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">Onboarding completion: {eventCount("onboarding_completed")}/{Math.max(eventCount("onboarding_started"), eventCount("onboarding_completed"))}</div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">Invite conversion: {eventCount("invite_activation_completed")}/{Math.max(eventCount("invite_link_opened"), 1)}</div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">Activation failures: {eventCount("invite_activation_failed")}</div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">Runtime initialization issues: {eventCount("runtime_initialization_issue")}</div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">First workspace loads: {eventCount("first_workspace_loaded")}</div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">Friction hotspots: activation failure + runtime issues</div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium">Trial Access</h2>
        {activeTrials.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-slate-700">No trial workspaces are active yet. New activations will appear here with status and remaining time.</div>
        ) : (
          <ul className="space-y-3">
            {activeTrials.map((trial) => {
              const status = formatTrialStatus(trial);
              return (
                <li key={trial.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">Workspace {trial.workspace_id ?? "Pending workspace"}</p>
                    <StatusBadge label={status.label} tone={status.tone} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-700">
                    <form method="post" action="/api/early-access/founder-actions">
                      <input type="hidden" name="action" value="revoke_trial" />
                      <input type="hidden" name="trialId" value={trial.id} />
                      <button className="underline underline-offset-4">Withdraw access</button>
                    </form>
                    <form method="post" action="/api/early-access/founder-actions">
                      <input type="hidden" name="action" value="extend_trial" />
                      <input type="hidden" name="trialId" value={trial.id} />
                      <input type="hidden" name="extensionDays" value="7" />
                      <button className="underline underline-offset-4">Extend +7 days</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium">Invite Queue</h2>
        {pendingInvites.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-slate-700">No pending invites right now. Approved founder invites will show here until accepted or withdrawn.</div>
        ) : (
          <ul className="space-y-3">
            {pendingInvites.map((invite) => {
              const statusTone = invite.revoked_at ? "revoked" : invite.requires_approval && !invite.approved_at ? "pending" : "active";
              const statusLabel = invite.revoked_at
                ? "Access withdrawn"
                : invite.requires_approval && !invite.approved_at
                  ? "Pending approval"
                  : "Active";

              return (
                <li key={invite.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{invite.invite_email}</p>
                    <StatusBadge label={statusLabel} tone={statusTone} />
                    {invite.accepted_at ? <StatusBadge label="Activated" tone="accepted" /> : null}
                  </div>
                  <p className="mt-2 text-xs text-slate-700">Expires {new Date(invite.expires_at).toLocaleDateString()}</p>
                  {deliveryByInvite.get(invite.id) ? (
                    <p className="mt-1 text-xs text-slate-700">Delivery: {deliveryByInvite.get(invite.id)?.label} · {deliveryByInvite.get(invite.id)?.detail ?? "No provider details"}</p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-700">Delivery: Manual link fallback</p>
                  )}
                  {invite.invite_note ? (
                    <div className="mt-3 rounded-xl border border-sky-200/20 bg-sky-100/5 p-3 text-sky-900">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-sky-200/90">Why you received access</p>
                      <p className="mt-1 text-sm text-sky-100/95">{invite.invite_note}</p>
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-700">
                    {invite.requires_approval && !invite.approved_at ? (
                      <form method="post" action="/api/early-access/founder-actions">
                        <input type="hidden" name="action" value="approve_invite" />
                        <input type="hidden" name="inviteId" value={invite.id} />
                        <button className="underline underline-offset-4">Approve access</button>
                      </form>
                    ) : null}
                    <form method="post" action="/api/early-access/founder-actions">
                      <input type="hidden" name="action" value="revoke_invite" />
                      <input type="hidden" name="inviteId" value={invite.id} />
                      <button className="underline underline-offset-4">Withdraw invite</button>
                    </form>
                    {!invite.revoked_at ? (
                      <form method="post" action="/api/early-access/founder-actions">
                        <input type="hidden" name="action" value="resend_invite_email" />
                        <input type="hidden" name="inviteId" value={invite.id} />
                        <button className="underline underline-offset-4">Resend invite email</button>
                      </form>
                    ) : null
                    }
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium">Activated Workspaces</h2>
        {typedActivations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-slate-700">No activations yet. Once an invite is accepted, workspace readiness will appear here.</div>
        ) : (
          <ul className="space-y-3">
            {typedActivations.map((activation) => {
              const issue = activation.initialization_status !== "active";
              return (
                <li key={activation.workspace_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">Workspace {activation.workspace_id}</p>
                    <StatusBadge label={issue ? "Initialization issue" : "Activated"} tone={issue ? "issue" : "accepted"} />
                    <p className="text-xs text-slate-600">Activated {new Date(activation.activated_at).toLocaleDateString()}</p>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-700 md:grid-cols-2">
                    <p>✓ Workspace initialized</p>
                    <p>✓ Runtime connected</p>
                    <p>✓ Operational memory active</p>
                    <p>✓ Explainability enabled</p>
                  </div>
                  {issue ? <p className="mt-3 text-xs text-orange-800">Workspace initialization requires attention before the team can rely on the environment.</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
