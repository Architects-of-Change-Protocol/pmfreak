import Link from "next/link";
import { getWorkspaceAuditTimeline } from "@/lib/audit-trail";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth";

export default async function AuditPage() {
  const user = await requireAuthUser();
  const supabase = await createSupabaseServerClient();
  const { data: membership } = await supabase.from("workspace_memberships").select("workspace_id, role").eq("user_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle<{ workspace_id: string; role: string }>();
  if (!membership) return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">No workspace membership found.</div>;

  const timeline = await getWorkspaceAuditTimeline(membership.workspace_id);

  return <main className="mx-auto w-full max-w-6xl space-y-4 md:space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-[#FCFBF9]/40 p-5">
      <h1 className="text-2xl font-semibold">Trust Audit Timeline</h1>
      <p className="mt-1 text-sm text-slate-700">Human-readable timeline of capability, policy, approval, and security decisions.</p>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-[#FCFBF9]/30 p-4 md:p-5">
      {timeline.length === 0 ? <div className="rounded-xl border border-dashed border-cyan-200/20 bg-cyan-500/[0.03] p-6 text-sm text-slate-700">No audit events yet. Trigger actions in Playground or Policies to generate traceable authority events.</div> : null}
      <ul className="space-y-3">
        {timeline.map((item) => <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm md:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-slate-900">{item.action_label}</strong>
            <span className={`rounded-full px-2 py-0.5 text-xs ${item.severity === "high" ? "bg-rose-500/20 text-rose-800" : item.severity === "medium" ? "bg-amber-500/20 text-amber-900" : "bg-emerald-500/20 text-emerald-900"}`}>{item.severity}</span>
            <span className="text-xs text-slate-600">{new Date(item.timestamp).toLocaleString()}</span>
          </div>
          <p className="mt-1 text-slate-800">{item.actor_display} {item.decision ? `${item.decision_label.toLowerCase()}ed` : "recorded"} {item.resource_label}.</p>
          {item.reason ? <p className="mt-1 text-xs text-slate-700">Reason: {item.reason.replaceAll("_", " ")}.</p> : null}
          {item.policy_trace.length ? <ul className="mt-2 ml-4 list-disc text-xs text-slate-700">{item.policy_trace.map((trace) => <li key={trace}>{trace}</li>)}</ul> : null}
          {item.capability_request_id ? <p className="mt-2 text-xs"><Link className="text-cyan-800 underline-offset-2 hover:underline" href="/capabilities">Request {item.capability_request_id.slice(0, 8)}…</Link></p> : null}
          {membership.role === "owner" || membership.role === "admin" ? <details className="mt-2 text-xs"><summary className="cursor-pointer text-slate-700">Technical details</summary><pre className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-2">{JSON.stringify(item.technical_details ?? item.metadata_summary, null, 2)}</pre></details> : null}
        </li>)}
      </ul>
    </section>
  </main>;
}
