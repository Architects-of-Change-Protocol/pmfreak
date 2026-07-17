import { requireAuthUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendInviteAction } from "./actions";

export default async function TeamPage() {
  const user = await requireAuthUser();
  const supabase = await createSupabaseServerClient();

  const { data: memberships } = await supabase
    .from("workspace_memberships")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle<{ workspace_id: string; role: string }>();

  if (!memberships?.workspace_id) return <div className="rounded-3xl border border-slate-200 bg-white p-6">No workspace found.</div>;

  const workspaceId = memberships.workspace_id;
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("workspace_memberships").select("user_id, role, created_at").eq("workspace_id", workspaceId),
    supabase.from("workspace_invitations").select("email, role, expires_at, status").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
  ]);

  return <div className="space-y-6"><section className="rounded-3xl border border-cyan-300/30 bg-gradient-to-br from-slate-900 via-slate-950 to-black p-6"><p className="text-xs uppercase tracking-[0.28em] text-cyan-700">PMO Team Command</p><h1 className="mt-2 text-2xl font-semibold">Keep execution pressure high, chaos low.</h1><p className="mt-2 text-sm text-slate-700">Seats include active members plus pending invites. Invite intentionally.</p></section><section className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold">Invite teammate</h2><form action={sendInviteAction} className="mt-4 space-y-3"><input type="hidden" name="workspaceId" value={workspaceId} /><input name="email" type="email" required placeholder="teammate@company.com" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"/><select name="role" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"><option value="admin">Admin</option><option value="pm">PM</option><option value="viewer">Viewer</option></select><button className="rounded-full bg-cyan-300 px-5 py-2 text-sm font-semibold text-slate-50">Send invite</button></form></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold">Members</h2><ul className="mt-3 space-y-2 text-sm">{(members ?? []).map((m) => <li key={m.user_id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"><span>{m.user_id.slice(0, 8)}…</span><span className="uppercase text-cyan-800">{m.role}</span></li>)}</ul></div></section><section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold">Pending invites</h2><ul className="mt-3 space-y-2 text-sm">{(invites ?? []).map((inv) => <li key={`${inv.email}-${inv.expires_at}`} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"><span>{inv.email}</span><span>{inv.role} • {inv.status} • expires {new Date(inv.expires_at).toLocaleDateString()}</span></li>)}</ul></section></div>;
}
