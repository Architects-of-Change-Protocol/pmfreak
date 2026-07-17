import { requireAuthUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createRequestAction, evaluatePolicyAction, resetSandboxAction, simulateAgentAccessAction, simulateExpirationAction } from "./actions";

export default async function PlaygroundPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const user = await requireAuthUser();
  const supabase = await createSupabaseServerClient();

  const { data: membership } = await supabase.from("workspace_memberships").select("workspace_id,role").eq("user_id", user.id).limit(1).maybeSingle<{ workspace_id: string; role: string }>();
  if (!membership) return <main className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">No workspace membership found for this user.</main>;

  const isAdmin = ["owner", "admin"].includes(membership.role);
  const workspaceId = membership.workspace_id;

  const [projects, policies, audit, agents, scopes] = await Promise.all([
    supabase.from("projects").select("id,name").eq("workspace_id", workspaceId).limit(8),
    supabase.from("capability_policies").select("id,name,effect,priority").eq("workspace_id", workspaceId).eq("enabled", true).order("priority", { ascending: true }).limit(10),
    supabase.from("capability_audit_events").select("id,event_type,created_at,actor_user_id,actor_agent_id,event_detail").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(30),
    supabase.from("ai_agents").select("id,name,status").eq("workspace_id", workspaceId).limit(10),
    supabase.from("ai_agent_scopes").select("id,agent_id,permission,resource_id,status,expires_at").eq("workspace_id", workspaceId).limit(12)
  ]);

  const panel = "rounded-2xl border border-slate-200 bg-[#FCFBF9]/40 p-4 md:p-5";
  const input = "w-full rounded-lg border border-slate-200 bg-[#FCFBF9]/80 px-3 py-2 text-sm text-slate-900";

  return <main className="mx-auto w-full max-w-7xl space-y-4 md:space-y-6">
    <section className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-900/20 to-slate-900 p-5 md:p-6">
      <p className="text-xs uppercase tracking-[0.25em] text-cyan-800">Programmable Trust Infrastructure</p>
      <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Developer Playground</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-700 md:text-base">Live sandbox for consent, scoped authority, policy-evaluated actions, and machine governance flows.</p>
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <form action={createRequestAction} className={`${panel} space-y-3`}>
        <h2 className="text-lg font-semibold">Capability Lifecycle</h2>
        <select name="resourceId" className={input}>{(projects.data ?? []).map((p: { id: string; name: string }) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select name="permission" className={input}><option>read</option><option>write</option><option>approve</option><option>delegate</option></select>
        <input name="justification" placeholder="Why is this authority needed?" className={input} />
        <input type="datetime-local" name="expiresAt" className={input} />
        <button className="rounded-lg bg-cyan-500/20 px-3 py-2 text-sm font-medium transition hover:bg-cyan-500/30">Create capability request</button>
      </form>

      <form action={evaluatePolicyAction} className={`${panel} space-y-3`}>
        <h2 className="text-lg font-semibold">Policy Evaluation Visualizer</h2>
        <select name="resourceId" className={input}>{(projects.data ?? []).map((p: { id: string; name: string }) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select name="permission" className={input}><option>read</option><option>write</option><option>approve</option><option>delegate</option></select>
        <input name="justification" placeholder="Evaluation narrative" className={input} />
        <button className="rounded-lg bg-indigo-500/20 px-3 py-2 text-sm font-medium transition hover:bg-indigo-500/30">Run policy decision</button>
        <pre className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">{String(params.evaluated ?? "No evaluation yet.")}</pre>
      </form>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <article className={panel}>Trust Graph: Actor → Policy → Capability → Decision → Audit</article>
      <article className={panel}>Policies: {(policies.data ?? []).length} active</article>
      <article className={panel}>Agent scopes: {(scopes.data ?? []).length}</article>
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <form action={simulateAgentAccessAction} className={`${panel} space-y-3`}>
        <h2 className="text-lg font-semibold">AI Agent Simulation</h2>
        <select name="agentId" className={input}>{(agents.data ?? []).map((a: { id: string; name: string; status: string }) => <option key={a.id} value={a.id}>{a.name} ({a.status})</option>)}</select>
        <select name="resourceId" className={input}>{(projects.data ?? []).map((p: { id: string; name: string }) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select name="permission" className={input}><option>read</option><option>write</option></select>
        <button className="rounded-lg bg-fuchsia-500/20 px-3 py-2 text-sm font-medium transition hover:bg-fuchsia-500/30">Attempt scoped access</button>
        <pre className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">{String(params.agent ?? "No simulation run yet.")}</pre>
      </form>

      <div className={`${panel} space-y-3`}>
        <h2 className="text-lg font-semibold">Sandbox Controls</h2>
        <form action={simulateExpirationAction}><button className="rounded-lg bg-amber-500/20 px-3 py-2 text-sm font-medium transition hover:bg-amber-500/30">Simulate expiration</button></form>
        {isAdmin ? <form action={resetSandboxAction}><button className="rounded-lg bg-rose-500/20 px-3 py-2 text-sm font-medium transition hover:bg-rose-500/30">Reset sandbox</button></form> : null}
      </div>
    </section>

    <section className={panel}>
      <h2 className="text-lg font-semibold">Live Audit Timeline</h2>
      <ul className="mt-3 space-y-2 text-sm">{(audit.data ?? []).map((e: { id: string; created_at: string; event_type: string; actor_user_id: string | null; actor_agent_id: string | null }) => <li key={e.id} className="rounded-xl border border-slate-200 bg-white p-3"><p className="font-medium">{new Date(e.created_at).toLocaleString()} • {e.event_type}</p><p className="text-xs text-slate-600">{e.actor_user_id ?? e.actor_agent_id ?? "system"}</p></li>)}</ul>
    </section>
  </main>;
}
