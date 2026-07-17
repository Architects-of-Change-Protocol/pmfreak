import { requireAuthUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAgentAction, grantAgentScopeAction, setAgentStatusAction } from "./actions";

export default async function AgentsPage() {
  const user = await requireAuthUser();
  const supabase = await createSupabaseServerClient();
  const { data: membership } = await supabase.from("workspace_memberships").select("workspace_id, role").eq("user_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle<{ workspace_id: string; role: string }>();
  if (!membership) return <div>No workspace.</div>;
  const workspaceId = membership.workspace_id;
  const isAdmin = membership.role === "owner" || membership.role === "admin";
  const [agents, scopes, projects] = await Promise.all([
    supabase.from("ai_agents").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("ai_agent_scopes").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("projects").select("id,name").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(100),
  ]);

  return <main className="space-y-4">
    <h1 className="text-2xl font-semibold">AI Agents</h1>
    {isAdmin ? <form action={createAgentAction} className="grid gap-2 rounded border p-3 md:grid-cols-2">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input name="name" required placeholder="Agent name" className="rounded border bg-slate-50 p-2" /><input name="description" placeholder="Description" className="rounded border bg-slate-50 p-2" />
      <select name="agentType" className="rounded border bg-slate-50 p-2"><option>copilot</option><option>analyzer</option><option>workflow_runner</option><option>governance_assistant</option><option>external_agent</option></select>
      <select name="riskLevel" className="rounded border bg-slate-50 p-2"><option>low</option><option>medium</option><option>high</option></select>
      <input name="purpose" required placeholder="Purpose" className="rounded border bg-slate-50 p-2 md:col-span-2" />
      <input name="provider" placeholder="Provider" className="rounded border bg-slate-50 p-2" /><input name="model" placeholder="Model" className="rounded border bg-slate-50 p-2" />
      <input name="runtime" placeholder="Runtime" className="rounded border bg-slate-50 p-2" /><input name="toolAccess" placeholder="Tool access csv" className="rounded border bg-slate-50 p-2" />
      <input name="allowedDomains" placeholder="Allowed domains csv" className="rounded border bg-slate-50 p-2" /><input name="dataSensitivityLevel" placeholder="Data sensitivity" className="rounded border bg-slate-50 p-2" />
      <input name="contactOwner" placeholder="Contact owner" className="rounded border bg-slate-50 p-2" /><input name="externalIntegrationId" placeholder="External integration id" className="rounded border bg-slate-50 p-2" />
      <button className="rounded bg-cyan-400/20 p-2 md:col-span-2">Register agent</button>
    </form> : null}

    <section className="rounded border p-3"><h2 className="font-semibold">Registered agents</h2><ul className="space-y-2 mt-2">{(agents.data ?? []).map((a: { id: string; name: string; agent_type: string; status: string; risk_level: string; purpose: string }) => <li key={a.id} className="rounded border p-2 text-sm"><p>AI Agent {a.name} • {a.agent_type} • {a.status} • risk {a.risk_level}</p><p>Purpose: {a.purpose}</p>{isAdmin ? <form action={setAgentStatusAction} className="mt-2 flex gap-2"><input type="hidden" name="workspaceId" value={workspaceId} /><input type="hidden" name="agentId" value={a.id} /><button name="status" value="disabled" className="rounded bg-amber-500/20 px-2 py-1">Disable</button><button name="status" value="revoked" className="rounded bg-rose-500/20 px-2 py-1">Revoke</button></form> : null}</li>)}</ul></section>

    {isAdmin ? <section className="rounded border p-3"><h2 className="font-semibold">Grant scope</h2><form action={grantAgentScopeAction} className="mt-2 grid gap-2 md:grid-cols-2"><input type="hidden" name="workspaceId" value={workspaceId} /><select name="agentId" className="rounded border bg-slate-50 p-2">{(agents.data ?? []).map((a: { id: string; name: string; agent_type: string; status: string; risk_level: string; purpose: string }) => <option key={a.id} value={a.id}>{a.name}</option>)}</select><select name="resourceType" className="rounded border bg-slate-50 p-2"><option value="project">project</option><option value="workspace">workspace</option><option value="copilot">copilot</option><option value="operational_memory">operational_memory</option></select><select name="resourceId" className="rounded border bg-slate-50 p-2">{(projects.data ?? []).map((p: { id: string; name: string }) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><select name="permission" className="rounded border bg-slate-50 p-2"><option>read</option><option>write</option><option>execute_ai_action</option><option>manage_ai</option><option>manage_workspace</option><option>upload_documents</option></select><input name="expiresAt" type="datetime-local" className="rounded border bg-slate-50 p-2" /><button className="rounded bg-emerald-500/20 p-2 md:col-span-2">Grant scope</button></form></section> : null}

    <section className="rounded border p-3"><h2 className="font-semibold">Scopes</h2><ul className="mt-2 space-y-2 text-sm">{(scopes.data ?? []).map((s: { id: string; permission: string; resource_type: string; resource_id: string; status: string; expires_at: string | null }) => <li key={s.id} className="rounded border p-2">{s.permission} on {s.resource_type}/{s.resource_id} • {s.status} • expires {s.expires_at ? new Date(s.expires_at).toLocaleString() : "never"}</li>)}</ul></section>
  </main>;
}
