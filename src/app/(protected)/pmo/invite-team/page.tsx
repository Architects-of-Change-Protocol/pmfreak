import { requireAuthUser } from "@/lib/auth";
import { InviteTeamClient } from "./invite-team-client";
import { loadPmoTenant } from "@/lib/pmo/load-pmo-tenant";
import { resolveCanonicalWorkspace } from "@/lib/workspaces/canonical-workspace-resolver";

export default async function InviteTeamPage() {
  const user = await requireAuthUser();
  const resolution = await resolveCanonicalWorkspace(user.id);

  let pmoName = "Your PMO";
  if (resolution.workspaceId) {
    const pmoResult = await loadPmoTenant(resolution.workspaceId);
    if (pmoResult.found) {
      pmoName = pmoResult.tenant.identity.pmoName || pmoName;
    }
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#050507] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.55)] md:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-cyan-500/10 blur-[160px]" />
      <div className="pointer-events-none absolute right-[-8%] top-20 h-[28rem] w-[28rem] rounded-full bg-indigo-500/10 blur-[180px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-64 w-[60%] -translate-x-1/2 rounded-full bg-pink-500/[0.06] blur-[120px]" />

      <div className="relative">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="inline-flex h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            <p className="text-[10px] uppercase tracking-[0.35em] text-cyan-400/60">
              PMFreak · AOC Protocol
            </p>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Introduce the humans
          </h1>
          <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-zinc-500">
            Your PMO Brain is active. Now introduce the people who shape delivery reality.
          </p>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-zinc-600">
            Inviting your PMO team helps PMFreak understand governance ownership, reporting structure, and operational accountability. Each person&apos;s role and domain focus becomes a signal routing layer for future intelligence.
          </p>
        </header>

        <InviteTeamClient pmoName={pmoName} />
      </div>
    </section>
  );
}
