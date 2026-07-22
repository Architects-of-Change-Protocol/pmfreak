"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ActivationState } from "./types";
import { StatusTimeline } from "./StatusTimeline";
import { ActivationFailureState } from "./ActivationFailureState";
import { TransitionOverlay } from "./TransitionOverlay";

/**
 * Full-screen overlay for the real activation lifecycle:
 *
 *   submitting -> success (brief confirmation, then the caller navigates)
 *   submitting -> failure (recoverable, Retry starts a new attempt)
 *
 * There is no simulated provisioning, agent activation, or memory preparation:
 * savePmoTenant does all of its work in one synchronous call, so "submitting"
 * is the only truthful in-progress state this can show.
 */
export function CommandCenterActivationSequence({
  state,
  enabledAgentIds,
  pmoName,
  deliveryChallengeCount,
  hasContextSeed,
  onRetry,
}: {
  state: ActivationState;
  enabledAgentIds: string[];
  pmoName: string;
  deliveryChallengeCount: number;
  hasContextSeed: boolean;
  onRetry: () => void;
}) {
  if (state.status === "idle") return null;

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

        <div className="relative w-full max-w-lg px-6">
          {state.status === "success" ? (
            <TransitionOverlay
              pmoName={pmoName}
              enabledAgentCount={enabledAgentIds.length}
              deliveryChallengeCount={deliveryChallengeCount}
              hasContextSeed={hasContextSeed}
            />
          ) : state.status === "failure" ? (
            <div className="space-y-7">
              <div className="space-y-4 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-600">
                  PMFreak Activation
                </p>
                <h2 className="text-2xl font-semibold text-slate-900">Activation didn&apos;t complete</h2>
              </div>
              <ActivationFailureState
                message={state.error ?? "Something went wrong while creating your Command Center."}
                onRetry={onRetry}
                retrying={false}
              />
            </div>
          ) : (
            <div className="space-y-7">
              <div className="space-y-4 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-600">
                  PMFreak Activation
                </p>
                <h2 className="text-2xl font-semibold text-slate-900">Creating Command Center…</h2>
                <StatusTimeline status={state.status} />
                {/* Truthful: one request is in flight. No background work is implied. */}
                <p className="text-sm text-zinc-500">Saving your Command Center configuration.</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
