import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth";
import { createPolicyAction, togglePolicyAction } from "./actions";

export default async function PoliciesPage() {
  const user = await requireAuthUser();
  const supabase = await createSupabaseServerClient();
  const { data: membership } = await supabase.from("workspace_memberships").select("workspace_id, role").eq("user_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle<{ workspace_id: string; role: string }>();
  if (!membership) return <div>No workspace membership found.</div>;
  const { data: policies } = await supabase.from("capability_policies").select("*").eq("workspace_id", membership.workspace_id).order("priority", { ascending: true });
  const { data: events } = await supabase.from("capability_audit_events").select("id,event_type,event_detail,created_at,actor_user_id").eq("workspace_id", membership.workspace_id).in("event_type", ["policy_evaluated", "policy_allowed", "policy_denied", "policy_required_approval", "policy_expired_grant", "policy_scope_mismatch"]).order("created_at", { ascending: false }).limit(25);

  return <main className="space-y-6">
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h1 className="text-2xl font-semibold">Policy Management v1</h1>
      <p className="text-sm text-slate-700">Owner/admin programmable consent policies with deny-first precedence.</p>
      <form action={createPolicyAction} className="mt-4 grid gap-2 md:grid-cols-2">
        <input type="hidden" name="workspaceId" value={membership.workspace_id} />
        <input name="name" required placeholder="Policy name" className="rounded border bg-slate-50 p-2" />
        <input name="description" placeholder="Description" className="rounded border bg-slate-50 p-2" />
        <select name="resourceType" className="rounded border bg-slate-50 p-2"><option value="project">project</option><option value="workspace">workspace</option><option value="operational_memory">operational_memory</option></select>
        <select name="permission" className="rounded border bg-slate-50 p-2"><option>read</option><option>write</option><option>approve</option><option>manage</option><option>execute</option><option>delegate</option></select>
        <select name="effect" className="rounded border bg-slate-50 p-2"><option value="require_approval">require_approval</option><option value="allow">allow</option><option value="deny">deny</option></select>
        <input name="priority" type="number" defaultValue={100} className="rounded border bg-slate-50 p-2" />
        <input name="allowedRoles" placeholder="allowedRoles comma separated" className="rounded border bg-slate-50 p-2" />
        <label><input type="checkbox" name="justificationRequired" /> justification required</label>
        <label><input type="checkbox" name="businessHoursOnly" /> business hours only (UTC)</label>
        <button className="rounded bg-cyan-400/20 p-2 md:col-span-2">Create policy</button>
      </form>
    </section>
    <section className="rounded-2xl border border-slate-200 p-4"><h2 className="font-semibold">Policies</h2><ul className="space-y-2 mt-3">{(policies ?? []).map((p) => <li key={p.id} className="rounded border border-slate-200 p-3 text-sm"><p>{p.name} [{p.effect}] prio:{p.priority} {p.enabled ? "enabled" : "disabled"}</p><p>{p.resource_type}/{p.permission}</p><p>{JSON.stringify(p.conditions)}</p><form action={togglePolicyAction}><input type="hidden" name="policyId" value={p.id} /><input type="hidden" name="workspaceId" value={membership.workspace_id} /><input type="hidden" name="enabled" value={String(p.enabled)} /><button className="rounded bg-slate-50 px-2 py-1 mt-1">{p.enabled ? "Disable" : "Enable"}</button></form></li>)}</ul></section>
    <section className="rounded-2xl border border-slate-200 p-4"><h2 className="font-semibold">Recent Policy Evaluations</h2><ul className="space-y-2 mt-3 text-sm">{(events ?? []).map((e) => <li key={e.id} className="rounded border border-slate-200 p-3"><p>{new Date(e.created_at).toLocaleString()} {e.event_type}</p><p>actor:{e.actor_user_id ?? "system"}</p></li>)}</ul></section>
  </main>;
}
