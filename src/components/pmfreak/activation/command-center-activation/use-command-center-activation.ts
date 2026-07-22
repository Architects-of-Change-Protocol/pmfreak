"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActivationState } from "./types";
import { INITIAL_ACTIVATION_STATE } from "./types";
import { SUBMIT_TIMEOUT_MS } from "./activation-sequence-config";

export const ACTIVATION_TIMEOUT_MESSAGE =
  "We didn't get a response while creating your Command Center. Nothing was partially created — you can try again.";

/**
 * Drives the real request lifecycle around savePmoTenant:
 *
 *   idle -> submitting -> success | failure
 *                            ^         |
 *                            +-- retry +
 *
 * The timeout exists ONLY as protection against a promise that never settles.
 * It is a single setTimeout (never a repeating interval), it resolves to a
 * terminal `failure` the user can act on, it is cancelled on success, failure,
 * retry, reset and unmount, and it never claims that work continues in the
 * background — because none does.
 */
export function useCommandCenterActivation(options?: { timeoutMs?: number }) {
  const timeoutMs = options?.timeoutMs ?? SUBMIT_TIMEOUT_MS;

  const [state, setState] = useState<ActivationState>(INITIAL_ACTIVATION_STATE);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // A timer must never outlive the component that armed it.
  useEffect(() => clearPendingTimeout, [clearPendingTimeout]);

  /**
   * Enters `submitting` and arms the single unresolved-promise guard. Called
   * synchronously on click so the UI reflects the request immediately.
   */
  const markSubmitting = useCallback(() => {
    clearPendingTimeout();
    setState((s) => ({ status: "submitting", error: null, attempt: s.attempt + 1 }));
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      // Only a still-submitting attempt can time out; a settled one is terminal.
      setState((s) =>
        s.status === "submitting" ? { ...s, status: "failure", error: ACTIVATION_TIMEOUT_MESSAGE } : s,
      );
    }, timeoutMs);
  }, [timeoutMs, clearPendingTimeout]);

  /** The server action confirmed persistence. */
  const markSuccess = useCallback(() => {
    clearPendingTimeout();
    setState((s) => ({ ...s, status: "success", error: null }));
  }, [clearPendingTimeout]);

  /** The attempt failed. Terminal but recoverable — Retry calls markSubmitting again. */
  const markFailure = useCallback(
    (error: string) => {
      clearPendingTimeout();
      setState((s) => ({ ...s, status: "failure", error }));
    },
    [clearPendingTimeout],
  );

  /** Full teardown back to idle (e.g. the overlay is dismissed entirely). */
  const reset = useCallback(() => {
    clearPendingTimeout();
    setState(INITIAL_ACTIVATION_STATE);
  }, [clearPendingTimeout]);

  return useMemo(
    () => ({ state, markSubmitting, markSuccess, markFailure, reset }),
    [state, markSubmitting, markSuccess, markFailure, reset],
  );
}
