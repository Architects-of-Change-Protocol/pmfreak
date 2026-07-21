import { motion } from "framer-motion";

/**
 * The terminal "Ready" reveal. Every figure shown here comes from what the
 * user actually configured in the wizard — never a fabricated risk/signal/
 * initiative count for a Command Center that has no operational history yet.
 */
export function TransitionOverlay({
  pmoName,
  enabledAgentCount,
  deliveryChallengeCount,
  hasContextSeed,
  onContinue,
}: {
  pmoName: string;
  enabledAgentCount: number;
  deliveryChallengeCount: number;
  hasContextSeed: boolean;
  onContinue: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(12px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="space-y-6 text-center"
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-600">Command Center Online</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          {pmoName ? `${pmoName} is live` : "Your Command Center is live"}
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          0 initiatives yet — this is where they&apos;ll appear as your team starts delivering.
        </p>
      </div>

      <div className="mx-auto grid max-w-md gap-2.5 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-lg font-semibold text-slate-900">{enabledAgentCount}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-zinc-400">Agents Online</p>
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

      <button
        type="button"
        onClick={onContinue}
        className="rounded-xl border border-cyan-200/30 bg-cyan-400/[0.1] px-6 py-2.5 text-sm font-semibold text-cyan-900 transition hover:bg-cyan-400/[0.18]"
      >
        Continue →
      </button>
    </motion.div>
  );
}
