import type { AgentId } from "@/lib/pmo/pmo-tenant-types";
import type { ActivationProgressListener, ProgressSource } from "./types";
import {
  AGENT_CONNECT_DURATION_MS,
  activeInitializationStages,
} from "./activation-sequence-config";

/** Minimum time the "agents" stage occupies even with zero enabled agents, so it never flashes instantly. */
const MIN_AGENT_STAGE_DURATION_MS = 500;

/**
 * Default ProgressSource: walks the configured stages (and, within the
 * "agents" stage, the enabled agents) purely on timers, in the exact order
 * they're declared in activation-sequence-config.ts.
 *
 * This is the extension point for real backend-driven progress: a future
 * `createSseProgressSource(correlationId)` would open an EventSource/WebSocket
 * keyed by the activation's correlationId and emit this same event shape as
 * the server actually completes each phase, instead of scheduling timers.
 * Nothing in the hook or the rendered components would need to change.
 */
export function createTimerProgressSource(): ProgressSource {
  let timers: ReturnType<typeof setTimeout>[] = [];
  let listeners: ActivationProgressListener[] = [];
  let stopped = false;

  function emit(event: Parameters<ActivationProgressListener>[0]) {
    if (stopped) return;
    listeners.forEach((listener) => listener(event));
  }

  function schedule(delayMs: number, fn: () => void) {
    timers.push(setTimeout(fn, delayMs));
  }

  return {
    start({ enabledAgentIds }: { enabledAgentIds: AgentId[] }) {
      stopped = false;
      let elapsed = 0;

      for (const stage of activeInitializationStages()) {
        const stageStartAt = elapsed;
        schedule(stageStartAt, () => emit({ type: "stage-start", stageId: stage.id }));

        if (stage.id === "agents") {
          const agentStageDuration = Math.max(
            enabledAgentIds.length * AGENT_CONNECT_DURATION_MS,
            MIN_AGENT_STAGE_DURATION_MS
          );

          enabledAgentIds.forEach((agentId, index) => {
            const connectAt = stageStartAt + index * AGENT_CONNECT_DURATION_MS;
            const onlineAt = connectAt + AGENT_CONNECT_DURATION_MS * 0.7;
            schedule(connectAt, () => emit({ type: "agent-connecting", agentId }));
            schedule(onlineAt, () => emit({ type: "agent-online", agentId }));
          });

          elapsed = stageStartAt + agentStageDuration;
        } else {
          elapsed = stageStartAt + stage.durationMs;
        }

        const stageId = stage.id;
        const stageCompleteAt = elapsed;
        schedule(stageCompleteAt, () => emit({ type: "stage-complete", stageId }));
      }

      schedule(elapsed, () => emit({ type: "sequence-complete" }));
    },

    subscribe(listener: ActivationProgressListener) {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter((l) => l !== listener);
      };
    },

    stop() {
      stopped = true;
      timers.forEach(clearTimeout);
      timers = [];
    },
  };
}
