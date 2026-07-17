import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth";
import { createCapabilityRequestAction, decideCapabilityRequestAction, revokeCapabilityGrantAction } from "./actions";

export default async function CapabilitiesPage() {
  const user = await requireAuthUser();
  const supabase = await createSupabaseServerClient();
  const { data: membership } = await supabase.from("workspace_memberships").select("workspace_id, role").eq("user_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle<{ workspace_id: string; role: string }>();
  if (!membership) return <div className="rounded-2xl border border-slate-200 bg-white p-6">No workspace membership found.</div>;

  const workspaceId = membership.workspace_id;
  const [outgoing, incoming, grants, events, projects] = await Promise.all([
    supabase.from("capability_requests").select("*").eq("requester_user_id", user.id).eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(25),
    supabase.from("capability_requests").select("*").eq("workspace_id", workspaceId).eq("status", "pending").order("created_at", { ascending: false }).limit(25),
    supabase.from("capability_grants").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(25),
    supabase.from("capability_audit_events").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(50),
    supabase.from("projects").select("id, name").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(50),
  ]);

  return <main className="space-y-6">
    <section className="rounded-2xl border border-cyan-300/30 bg-slate-50 p-5">
      <h1 className="text-2xl font-semibold">Capability Access Requests</h1>
      <p className="text-sm text-slate-700">Programmable consent: request scoped permission, approve/deny, enforce, and audit.</p>
      <form action={createCapabilityRequestAction} className="mt-4 grid gap-2 md:grid-cols-2">
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <select name="targetResourceType" className="rounded border bg-slate-50 p-2"><option value="project">Project</option><option value="workspace">Workspace</option><option value="operational_memory">Operational Memory</option><option value="governance_object">Governance Object</option><option value="ai_coprocess">AI/Coprocess</option></select>
        <select name="targetResourceId" className="rounded border bg-slate-50 p-2">{(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select name="requestedPermission" className="rounded border bg-slate-50 p-2"><option>read</option><option>write</option><option>approve</option><option>manage</option><option>execute</option><option>delegate</option></select>
        <input name="expiresAt" type="datetime-local" className="rounded border bg-slate-50 p-2" />
        <textarea name="justification" required placeholder="Why do you need this access?" className="rounded border bg-slate-50 p-2 md:col-span-2" />
        <button className="rounded bg-cyan-400/20 p-2 md:col-span-2">Request access</button>
      </form>
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 p-4"><h2 className="font-semibold">Incoming Pending</h2><ul className="mt-3 space-y-2">{(incoming.data ?? []).map((r) => <li key={r.id} className="rounded border border-slate-200 p-3 text-sm"><p>WHO: {r.requester_user_id}</p><p>WHAT: {r.target_resource_type} / {r.target_resource_id}</p><p>WHICH: {r.requested_permission}</p><p>WHY: {r.justification ?? "n/a"}</p><p>STATUS: {r.status}</p><form action={decideCapabilityRequestAction} className="mt-2 flex gap-2"><input type="hidden" name="requestId" value={r.id} /><button name="decision" value="approve" className="rounded bg-emerald-500/20 px-2 py-1">Approve</button><button name="decision" value="deny" className="rounded bg-rose-500/20 px-2 py-1">Deny</button></form></li>)}</ul></div>
      <div className="rounded-2xl border border-slate-200 p-4"><h2 className="font-semibold">Outgoing Requests</h2><ul className="mt-3 space-y-2">{(outgoing.data ?? []).map((r) => <li key={r.id} className="rounded border border-slate-200 p-3 text-sm"><p>{r.target_resource_type} / {r.target_resource_id}</p><p>{r.requested_permission} • {r.status}</p><p>Approved by: {r.evaluator_user_id ?? "pending"}</p><p>Expires: {r.grant_expires_at ? new Date(r.grant_expires_at).toLocaleString() : "none"}</p></li>)}</ul></div>
    </section>

    <section className="rounded-2xl border border-slate-200 p-4"><h2 className="font-semibold">Grants</h2><ul className="mt-3 space-y-2">{(grants.data ?? []).map((g) => <li key={g.id} className="rounded border border-slate-200 p-3 text-sm"><p>{g.permission} on {g.target_resource_type} {g.target_resource_id}</p><p>WHO approved: {g.granted_by_user_id}</p><p>HOW LONG: {g.expires_at ? new Date(g.expires_at).toLocaleString() : "until revoked"}</p><p>CURRENT STATUS: {g.status}</p>{g.status === "active" ? <form action={revokeCapabilityGrantAction}><input type="hidden" name="grantId" value={g.id} /><button className="mt-2 rounded bg-rose-500/20 px-2 py-1">Revoke</button></form> : null}</li>)}</ul></section>

    <section className="rounded-2xl border border-slate-200 p-4"><h2 className="font-semibold">Audit Timeline</h2><ul className="mt-3 space-y-2 text-sm">{(events.data ?? []).map((e) => <li key={e.id} className="rounded border border-slate-200 p-3"><p>{new Date(e.created_at).toLocaleString()} • {e.event_type}</p><p>Actor: {e.actor_user_id ?? "system"}</p><p>Request: {e.request_id ?? "n/a"} Grant: {e.grant_id ?? "n/a"}</p></li>)}</ul></section>
  </main>;
}
