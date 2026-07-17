import { commandCenterTypeLabel, isCompanyOwnedContext } from "@/lib/command-center/command-center-types";
import type { CommandCenterType, OwnerType } from "@/lib/command-center/command-center-types";

/**
 * Always-visible "which Command Center am I in" indicator. Shown once a
 * Command Center exists so the user never loses track of the active
 * governance context — see docs/architecture/command-center-foundation.md.
 */
export function CommandCenterContextBanner({
  name,
  commandCenterType,
  ownerType,
}: {
  name: string;
  commandCenterType: CommandCenterType | null;
  ownerType: OwnerType | null;
}) {
  const typeLabel = commandCenterTypeLabel(commandCenterType);
  const notice = isCompanyOwnedContext(ownerType)
    ? "Company intelligence active. Projects should be work-related."
    : "Independent intelligence active. Projects may be professional, client-related, personal, or initiative-based.";

  return (
    <section className="rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.06] px-4 py-3">
      <p className="text-sm text-slate-800">
        You are working inside: <span className="font-semibold text-cyan-800">{name}</span>
      </p>
      <p className="mt-1 text-xs text-cyan-700">{typeLabel}</p>
      <p className="mt-1 text-xs text-slate-600">{notice}</p>
    </section>
  );
}
