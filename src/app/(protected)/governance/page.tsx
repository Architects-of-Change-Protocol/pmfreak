import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ApprovalCard } from "@/components/governance/ApprovalCard";
import { DelegationCard } from "@/components/governance/DelegationCard";

function getActorLabel(userId: string | null, agentId: string | null): string {
  if (agentId) return `AI agent`;
  if (userId) return `User ·${userId.slice(0, 6)}`;
  return "System";
}

function getDelegateeLabel(userId: string | null, agentId: string | null): string {
  if (agentId) return `AI agent ·${agentId.slice(0, 6)}`;
  if (userId) return `User ·${userId.slice(0, 6)}`;
  return "Unknown";
}

export default async function GovernancePage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("governance_approval_requests").select("*").order("created_at", { ascending: false }).limit(50);
  const approvalIds = (data ?? []).map((r) => r.id);
  const { data: grants } = approvalIds.length
    ? await supabase.from("governance_execution_grants").select("approval_request_id, status, expires_at").in("approval_request_id", approvalIds)
    : { data: [] as Array<{ approval_request_id: string; status: string; expires_at: string | null }> };
  const { data: delegations } = await supabase.from("governance_delegations").select("*").order("created_at", { ascending: false }).limit(50);
  const grantByApproval = new Map((grants ?? []).map((g) => [g.approval_request_id, g]));

  const allRequests = data ?? [];
  const pending = allRequests.filter((r) => r.status === "pending_approval");
  const resolved = allRequests.filter((r) => r.status !== "pending_approval");
  const pendingCount = pending.length;

  const allDelegations = delegations ?? [];
  const activeDelegations = allDelegations.filter((d) => d.status === "active");
  const inactiveDelegations = allDelegations.filter((d) => d.status !== "active");

  return (
    <section className="space-y-8 rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.95)] backdrop-blur-xl md:p-8">
      <section>
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/90">Governance</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Approval inbox</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">Review high-risk execution requests with clean lineage, clear status, and immediate decision controls.</p>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          {pendingCount > 0 ? (
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-amber-400/40 bg-amber-500/20 px-3 py-1 text-sm font-semibold text-amber-800">
                {pendingCount} pending decision{pendingCount === 1 ? "" : "s"}
              </span>
              <p className="text-xs text-slate-600">High-risk AI actions awaiting your review.</p>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-800">
                All caught up
              </span>
              <p className="text-xs text-slate-600">No pending decisions right now.</p>
            </div>
          )}
        </div>
      </section>

      {allRequests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-cyan-200/20 bg-cyan-500/[0.03] p-8 text-center">
          <p className="text-sm text-slate-700">No approval requests yet.</p>
          <p className="mt-1 text-xs text-slate-600">High-risk AI actions will appear here for review.</p>
        </div>
      ) : (
        <>
          {pendingCount > 0 ? (
            <section>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">Needs your decision</h2>
              <div className="mt-4 space-y-3">
                {pending.map((r) => {
                  const grant = grantByApproval.get(r.id);
                  return (
                    <ApprovalCard
                      key={r.id}
                      id={r.id}
                      action={r.action}
                      riskLevel={r.risk_level}
                      actorLabel={getActorLabel(r.actor_user_id, r.actor_agent_id)}
                      reason={r.reason ?? ""}
                      status={r.status}
                      requestedAt={r.created_at}
                      expiresAt={grant?.expires_at ?? null}
                      grantStatus={grant?.status ?? null}
                    />
                  );
                })}
              </div>
            </section>
          ) : (
            <p className="text-sm text-slate-600">Nothing pending — all requests have been resolved.</p>
          )}

          {resolved.length > 0 ? (
            <details className="group">
              <summary className="cursor-pointer list-none">
                <h2 className="inline text-base font-medium text-slate-600 hover:text-slate-700 transition-colors">
                  Resolved requests ({resolved.length})
                </h2>
              </summary>
              <div className="mt-4 space-y-3">
                {resolved.map((r) => {
                  const grant = grantByApproval.get(r.id);
                  return (
                    <ApprovalCard
                      key={r.id}
                      id={r.id}
                      action={r.action}
                      riskLevel={r.risk_level}
                      actorLabel={getActorLabel(r.actor_user_id, r.actor_agent_id)}
                      reason={r.reason ?? ""}
                      status={r.status}
                      requestedAt={r.created_at}
                      expiresAt={grant?.expires_at ?? null}
                      grantStatus={grant?.status ?? null}
                    />
                  );
                })}
              </div>
            </details>
          ) : null}
        </>
      )}

      <section>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Governance delegations</h2>

        {allDelegations.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
            <p className="text-sm text-slate-600">No active delegations</p>
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            {activeDelegations.length > 0 ? (
              <div className="space-y-3">
                {activeDelegations.map((d) => (
                  <DelegationCard
                    key={d.id}
                    id={d.id}
                    action={d.action}
                    requestedPermission={d.requested_permission}
                    delegateeLabel={getDelegateeLabel(d.delegatee_user_id, d.delegatee_agent_id)}
                    workspaceId={d.workspace_id}
                    projectId={d.project_id}
                    usesCount={d.uses_count ?? 0}
                    maxUses={d.max_uses ?? null}
                    expiresAt={d.expires_at}
                    status={d.status}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">No active delegations</p>
            )}

            {inactiveDelegations.length > 0 ? (
              <details>
                <summary className="cursor-pointer list-none">
                  <span className="text-base font-medium text-slate-600 hover:text-slate-700 transition-colors">
                    Inactive delegations ({inactiveDelegations.length})
                  </span>
                </summary>
                <div className="mt-4 space-y-3">
                  {inactiveDelegations.map((d) => (
                    <DelegationCard
                      key={d.id}
                      id={d.id}
                      action={d.action}
                      requestedPermission={d.requested_permission}
                      delegateeLabel={getDelegateeLabel(d.delegatee_user_id, d.delegatee_agent_id)}
                      workspaceId={d.workspace_id}
                      projectId={d.project_id}
                      usesCount={d.uses_count ?? 0}
                      maxUses={d.max_uses ?? null}
                      expiresAt={d.expires_at}
                      status={d.status}
                    />
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        )}
      </section>
    </section>
  );
}
