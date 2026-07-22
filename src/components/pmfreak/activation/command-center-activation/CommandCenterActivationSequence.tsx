"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { AgentId } from "@/lib/pmo/pmo-tenant-types";
import type { ActivationState, InitializationStageId } from "./types";
import { activeInitializationStages } from "./activation-sequence-config";
import { StatusTimeline } from "./StatusTimeline";
import { InitializationStage } from "./InitializationStage";
import { AgentActivationList } from "./AgentActivationList";
import { ActivationTimeoutState } from "./ActivationTimeoutState";
import { TransitionOverlay } from "./TransitionOverlay";

const HEADLINE_BY_STATUS: Partial<Record<ActivationState["status"], string>> = {
  activation_started: "Activation Started",
  request_sent: "Creating Command Center…",
  created: "Command Center Created",
  initializing: "Setting up your Command Center",
};

function stagePhase(
  stageId: InitializationStageId,
  state: ActivationState
): "pending" | "active" | "complete" {
  if (state.completedStageIds.includes(stageId)) return "complete";
  if (state.currentStageId === stageId) return "active";
  return "pending";
}

/**
 * Full-screen overlay orchestrating the whole "things are going well" journey:
 * click received -> request sent -> created -> initializing (per-stage, with
 * agents connecting individually) -> ready. Error states are NOT rendered
 * here — create-pmo-wizard.tsx's existing inline error UI takes over once the
 * caller calls activation.reset().
 */
export function CommandCenterActivationSequence({
  state,
  enabledAgentIds,
  pmoName,
  deliveryChallengeCount,
  hasContextSeed,
  onKeepWaiting,
  onRetryTimeout,
  onContinue,
}: {
  state: ActivationState;
  enabledAgentIds: AgentId[];
  pmoName: string;
  deliveryChallengeCount: number;
  hasContextSeed: boolean;
  onKeepWaiting: () => void;
  onRetryTimeout: () => void;
  onContinue: () => void;
}) {
  if (state.status === "idle") return null;

  const showTimeout = state.status === "request_sent" && state.timedOut;

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
          {state.status === "ready" ? (
            <TransitionOverlay
              pmoName={pmoName}
              enabledAgentCount={enabledAgentIds.length}
              deliveryChallengeCount={deliveryChallengeCount}
              hasContextSeed={hasContextSeed}
              onContinue={onContinue}
            />
          ) : (
            <div className="space-y-7">
              <div className="space-y-4 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-600">
                  PMFreak Activation
                </p>
                <h2 className="text-2xl font-semibold text-slate-900">{HEADLINE_BY_STATUS[state.status]}</h2>
                <StatusTimeline status={state.status} />
              </div>

              {showTimeout && (
                <ActivationTimeoutState onKeepWaiting={onKeepWaiting} onRetry={onRetryTimeout} />
              )}

              {state.status === "initializing" && (
                <div className="space-y-2">
                  {activeInitializationStages().map((stage) => {
                    const phase = stagePhase(stage.id, state);
                    if (stage.id === "agents" && phase !== "pending") {
                      return (
                        <div key={stage.id} className="space-y-2">
                          <p
                            className={`px-1 text-sm font-medium ${
                              phase === "active" ? "text-slate-900" : "text-slate-500"
                            }`}
                          >
                            {phase === "complete" ? stage.completeLabel : stage.label}
                          </p>
                          <AgentActivationList
                            enabledAgentIds={enabledAgentIds}
                            agentStatuses={state.agentStatuses}
                          />
                        </div>
                      );
                    }
                    return <InitializationStage key={stage.id} stage={stage} phase={phase} />;
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
