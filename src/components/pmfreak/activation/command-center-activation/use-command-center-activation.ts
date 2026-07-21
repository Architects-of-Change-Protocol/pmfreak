"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { AgentId } from "@/lib/pmo/pmo-tenant-types";
import type { ActivationState, ProgressSource } from "./types";
import { INITIAL_ACTIVATION_STATE } from "./types";
import { CREATED_CONFIRMATION_DURATION_MS, DEFAULT_TIMEOUT_MS } from "./activation-sequence-config";
import { createTimerProgressSource } from "./timer-progress-source";

/**
 * Drives the "things are going well" activation state machine:
 * idle -> activation_started -> request_sent -> created -> initializing -> ready.
 *
 * Deliberately does not own error handling — the caller (create-pmo-wizard.tsx)
 * keeps its own tested createError/createErrorClass contract and calls reset()
 * on failure so this overlay steps aside.
 */
export function useCommandCenterActivation(options?: {
  timeoutMs?: number;
  createProgressSource?: () => ProgressSource;
}) {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const createProgressSource = options?.createProgressSource ?? createTimerProgressSource;

  const [state, setState] = useState<ActivationState>(INITIAL_ACTIVATION_STATE);
  const timeoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sourceRef = useRef<ProgressSource | null>(null);
  const pendingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimeoutTimer = useCallback(() => {
    if (timeoutTimerRef.current) {
      clearInterval(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  }, []);

  const clearPendingTimers = useCallback(() => {
    pendingTimersRef.current.forEach(clearTimeout);
    pendingTimersRef.current = [];
  }, []);

  /** Estado 1 — click received. Synchronous, renders before any network call starts. */
  const markStarted = useCallback(() => {
    setState({ ...INITIAL_ACTIVATION_STATE, status: "activation_started" });
  }, []);

  /** Estado 2 — request sent, waiting on the real server action. Arms the timeout overlay. */
  const markRequestSent = useCallback(() => {
    setState((s) => ({ ...s, status: "request_sent", timedOut: false }));
    clearTimeoutTimer();
    timeoutTimerRef.current = setInterval(() => {
      setState((s) => (s.status === "request_sent" ? { ...s, timedOut: true } : s));
    }, timeoutMs);
  }, [timeoutMs, clearTimeoutTimer]);

  /** "Keep Waiting" from the timeout overlay — dismiss it, keep awaiting the same in-flight request. */
  const keepWaiting = useCallback(() => {
    setState((s) => ({ ...s, timedOut: false }));
  }, []);

  /** Hands control back to the caller's own error UI, or aborts a run in progress. */
  const reset = useCallback(() => {
    clearTimeoutTimer();
    clearPendingTimers();
    sourceRef.current?.stop();
    sourceRef.current = null;
    setState(INITIAL_ACTIVATION_STATE);
  }, [clearTimeoutTimer, clearPendingTimers]);

  /**
   * Estado 3 onward — call only after the backend has confirmed creation.
   * Resolves once status reaches "ready". enabledAgentIds must be the real,
   * user-selected agent list (never a hardcoded roster).
   */
  const runInitializationSequence = useCallback(
    (enabledAgentIds: AgentId[]) => {
      clearTimeoutTimer();
      return new Promise<void>((resolve) => {
        setState((s) => ({
          ...s,
          status: "created",
          currentStageId: null,
          completedStageIds: [],
          agentStatuses: {},
          timedOut: false,
        }));

        const startTimer = setTimeout(() => {
          const source = createProgressSource();
          sourceRef.current = source;

          const unsubscribe = source.subscribe((event) => {
            switch (event.type) {
              case "stage-start":
                setState((s) => ({ ...s, status: "initializing", currentStageId: event.stageId }));
                break;
              case "stage-complete":
                setState((s) => ({
                  ...s,
                  completedStageIds: s.completedStageIds.includes(event.stageId)
                    ? s.completedStageIds
                    : [...s.completedStageIds, event.stageId],
                }));
                break;
              case "agent-connecting":
                setState((s) => ({
                  ...s,
                  agentStatuses: { ...s.agentStatuses, [event.agentId]: "connecting" },
                }));
                break;
              case "agent-online":
                setState((s) => ({
                  ...s,
                  agentStatuses: { ...s.agentStatuses, [event.agentId]: "online" },
                }));
                break;
              case "sequence-complete":
                setState((s) => ({ ...s, status: "ready", currentStageId: null }));
                unsubscribe();
                sourceRef.current = null;
                resolve();
                break;
            }
          });

          source.start({ enabledAgentIds });
        }, CREATED_CONFIRMATION_DURATION_MS);

        pendingTimersRef.current.push(startTimer);
      });
    },
    [clearTimeoutTimer, createProgressSource]
  );

  return useMemo(
    () => ({ state, markStarted, markRequestSent, keepWaiting, reset, runInitializationSequence }),
    [state, markStarted, markRequestSent, keepWaiting, reset, runInitializationSequence]
  );
}
