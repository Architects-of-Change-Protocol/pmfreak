import { motion } from "framer-motion";

/**
 * Brief success confirmation, shown for SUCCESS_CONFIRMATION_DURATION_MS after
 * savePmoTenant confirms persistence, immediately before automatic navigation.
 *
 * Every figure here reflects what the user actually configured in the wizard —
 * never a fabricated risk/signal/initiative count for a Command Center with no
 * operational history. The copy deliberately states that navigation is next and
 * makes no claim that setup is still running: by the time this renders, all
 * server-side work is already complete.
 */
export function TransitionOverlay({
  pmoName,
  enabledAgentCount,
  deliveryChallengeCount,
  hasContextSeed,
}: {
  pmoName: string;
  enabledAgentCount: number;
  deliveryChallengeCount: number;
  hasContextSeed: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(12px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="space-y-6 text-center"
      role="status"
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-600">Command Center Created</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          {pmoName ? `${pmoName} is ready` : "Your Command Center is ready"}
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          0 initiatives yet — this is where they&apos;ll appear as your team starts delivering.
        </p>
      </div>

      <div className="mx-auto grid max-w-md gap-2.5 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-lg font-semibold text-slate-900">{enabledAgentCount}</p>
          {/* "Enabled", not "Online": these were selected in the wizard and saved. Nothing was connected or started. */}
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-zinc-400">Agents Enabled</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-lg font-semibold text-slate-900">{deliveryChallengeCount}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-zinc-400">Challenges Registered</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-lg font-semibold text-slate-900">{hasContextSeed ? "Yes" : "Not yet"}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-zinc-400">Context Seeded</p>
        </div>
      </div>

      <p className="text-sm text-zinc-500">Taking you to your Command Center…</p>
    </motion.div>
  );
}
