"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type BootStageConfig = { id: string; label: string; completeLabel: string; durationMs: number };

// Mirrors the honesty convention in activation-sequence-config.ts: every label
// names a real setup step already performed by saveProjectOnboarding, not
// live inference that isn't actually happening in these seconds.
const BOOT_STAGES: BootStageConfig[] = [
  { id: "intelligence", label: "Running intelligence initialization…", completeLabel: "Intelligence initialized", durationMs: 650 },
  { id: "memory", label: "Allocating operational memory…", completeLabel: "Memory allocated", durationMs: 650 },
  { id: "governance", label: "Bringing governance online…", completeLabel: "Governance online", durationMs: 650 },
  { id: "graph", label: "Initializing operational graph…", completeLabel: "Operational graph initialized", durationMs: 650 },
  { id: "context", label: "Synchronizing context engine…", completeLabel: "Context engine synchronized", durationMs: 600 },
];

/**
 * Full-screen overlay shown between "Activate Project Brain" and landing in
 * the Project Intelligence Inbox. A staged reveal only — the project is
 * already saved by the time this renders.
 */
export function BrainBootSequence({ projectName, onComplete }: { projectName: string; onComplete: () => void }) {
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const allDone = currentIndex >= BOOT_STAGES.length;

  useEffect(() => {
    if (allDone) {
      const finalTimer = setTimeout(onComplete, 750);
      return () => clearTimeout(finalTimer);
    }
    const stage = BOOT_STAGES[currentIndex];
    const timer = setTimeout(() => {
      setCompletedIds((prev) => [...prev, stage.id]);
      setCurrentIndex((i) => i + 1);
    }, stage.durationMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, allDone]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#FCFBF9]/95 backdrop-blur-sm"
      >
        <div className="pointer-events-none absolute -inset-32 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.10),transparent_65%)]" />

        <div className="relative w-full max-w-md px-6">
          <div className="space-y-7 text-center">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-600">
                {allDone ? "Project Brain Online" : "Activating Project Brain"}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                {allDone ? `${projectName || "Your project"} is live` : "Bringing your project intelligence online…"}
              </h2>
            </div>

            <div className="space-y-2">
              {BOOT_STAGES.map((stage, index) => {
                const phase = completedIds.includes(stage.id) ? "complete" : index === currentIndex && !allDone ? "active" : "pending";
                return (
                  <div
                    key={stage.id}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-500 ${
                      phase === "active"
                        ? "border border-cyan-200/60 bg-cyan-400/[0.06]"
                        : phase === "complete"
                          ? "opacity-60"
                          : "opacity-30"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] transition-colors duration-500 ${
                        phase === "complete"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-600"
                          : phase === "active"
                            ? "border-cyan-300 bg-cyan-100 text-cyan-700"
                            : "border-slate-300 text-slate-400"
                      }`}
                    >
                      {phase === "complete" ? "✓" : phase === "active" ? "●" : "○"}
                    </span>
                    <p
                      className={`text-sm font-medium transition-colors duration-300 ${
                        phase === "active" ? "text-slate-900" : phase === "complete" ? "text-slate-600" : "text-slate-400"
                      }`}
                    >
                      {phase === "complete" ? stage.completeLabel : stage.label}
                      {phase === "active" && <span className="ml-1 animate-pulse">…</span>}
                    </p>
                  </div>
                );
              })}
            </div>

            {allDone && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-zinc-500">
                Entering the operational workspace…
              </motion.p>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
