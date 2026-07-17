import { notFound } from "next/navigation";
import { isFounderOrInternalUser, requireAuthUser } from "@/lib/auth";
import { loadFounderProgramConfig, resolveFounderProgramFlags } from "@/lib/founder-program/config";
import { FounderProgramOperatorConsole } from "./operator-console";

// Founder Program operator console. Triple-gated before any render:
// authenticated → founder/internal (server-resolved, Perilla 5) → operator
// UI flag. Non-founders get notFound(), never partial data (the underlying
// APIs re-check authorization on every call regardless of this page).
export default async function FounderProgramOperatorPage() {
  const user = await requireAuthUser();
  if (!isFounderOrInternalUser(user)) notFound();

  const flags = resolveFounderProgramFlags();
  if (!flags.operatorUiEnabled) notFound();

  const config = await loadFounderProgramConfig();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-widest text-cyan-700">Internal · Founder Program operations</p>
        <h1 className="text-2xl font-semibold text-slate-900">
          {config.enabled ? config.settings.displayName : "Founder Program"}
        </h1>
        {!config.enabled ? (
          <div className="mt-2 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-900">
            The program is currently <strong>disabled</strong> (reason: {config.disabledReason}). Participant surfaces and
            APIs answer with controlled not-found responses. See docs/founder-program/14-launch-checklist.md for the
            enablement procedure.
          </div>
        ) : null}
      </header>
      {config.enabled ? <FounderProgramOperatorConsole /> : null}
    </div>
  );
}
