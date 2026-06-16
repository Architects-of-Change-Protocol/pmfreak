"use client";

import { useCallback, useEffect, useState } from "react";
import { WorkspaceConversationShell } from "@/components/pmfreak/workspace/workspace-conversation-shell";
import { AWAKENING_EVENT, deriveAwakeningState, persistAwakeningState, type AwakeningState } from "@/lib/workspace/awakening-state";
import { WORKSPACE_DISPLAY } from "@/lib/workspace/display-semantics";
import { CONFIDENCE_CHIP_LABELS, computeImprintConfidence } from "@/lib/workspace/imprint-confidence";
import { emptyImprintState } from "@/lib/workspace/operational-imprint-profile";
import { bootstrapRuntimeState } from "@/lib/workspace/runtime-bootstrap";
import { runtimePersistence, type RuntimePersistenceScope } from "@/lib/workspace/runtime-persistence";

type PmoContext = {
  found: boolean;
  pmoName?: string;
  organizationName?: string;
  pmoType?: string;
  methodology?: string;
};

type WorkspaceShellProps = {
  companyId: string;
  workspaceId: string;
  userId: string;
  freshOnboarding?: boolean;
  invitedCount?: number;
};

export function WorkspaceShell({ companyId, workspaceId, userId, freshOnboarding = false, invitedCount = 0 }: WorkspaceShellProps) {
  const scope: RuntimePersistenceScope = { companyId, workspaceId, userId };

  const [awakening, setAwakening] = useState<AwakeningState>(() => deriveAwakeningState(0));
  const [pmoContext, setPmoContext] = useState<PmoContext | null>(null);

  useEffect(() => {
    void bootstrapRuntimeState(scope).then((boot) => {
      setAwakening(boot.awakening);
    }).catch(() => undefined);

    void fetch("/api/pmo/context")
      .then((r) => r.json() as Promise<PmoContext>)
      .then((ctx) => setPmoContext(ctx))
      .catch(() => undefined);
    // scope values come from server props and are stable for the lifetime of this mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAwakeningAdvance = useCallback((next: AwakeningState) => {
    setAwakening(next);
    persistAwakeningState(companyId, workspaceId, next);
    void runtimePersistence.persistAwakening(scope, next).catch(() => undefined);
    window.dispatchEvent(new CustomEvent(AWAKENING_EVENT, { detail: next }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, workspaceId, userId]);

  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const showWelcome = freshOnboarding && !welcomeDismissed && pmoContext?.found;
  const isDormant = awakening.stage === "dormant";
  const imprintConfidence = computeImprintConfidence(emptyImprintState().profile);
  const showImprintChip = imprintConfidence !== "forming";

  return (
    <section className="mx-auto min-h-[calc(100vh-10rem)] w-full max-w-[1220px]">
      {showWelcome && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-cyan-950/40 via-indigo-950/30 to-black/60 shadow-[0_0_40px_rgba(34,211,238,0.07)]">
          <div className="flex items-start justify-between gap-4 px-6 py-5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="inline-flex h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
                <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-400/70">
                  PMFreak Brain Activated
                </p>
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-white mb-1">
                {pmoContext.pmoName} is online.
              </h2>
              {pmoContext.organizationName && (
                <p className="text-sm text-zinc-500 mb-3">{pmoContext.organizationName}</p>
              )}
              <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                {pmoContext.methodology && (
                  <span className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-indigo-400/60" />
                    {pmoContext.methodology} methodology
                  </span>
                )}
                {invitedCount > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-cyan-400/60" />
                    {invitedCount} team member{invitedCount > 1 ? "s" : ""} invited
                  </span>
                )}
              </div>
              <p className="mt-4 text-sm text-zinc-400">
                Start your first operational conversation below.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setWelcomeDismissed(true)}
              aria-label="Dismiss welcome"
              className="mt-0.5 shrink-0 rounded-lg p-1.5 text-zinc-700 transition hover:text-zinc-400"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {!showWelcome && pmoContext?.found && pmoContext.pmoName && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.04] px-4 py-3">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
          <span className="text-sm text-slate-300">
            <span className="font-semibold text-white">{pmoContext.pmoName}</span>
            {pmoContext.organizationName ? (
              <span className="text-zinc-500"> · {pmoContext.organizationName}</span>
            ) : null}
            {pmoContext.methodology ? (
              <span className="ml-3 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                {pmoContext.methodology}
              </span>
            ) : null}
          </span>
        </div>
      )}
      {isDormant && (
        <p className="mb-2 text-xs text-slate-500">{WORKSPACE_DISPLAY.labels.standbySubtitle}</p>
      )}
      {/* Readiness chips — compressed display */}
      <div className="mb-3 flex flex-wrap gap-1.5 text-[10px]">
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-zinc-500">{WORKSPACE_DISPLAY.labels.operationallyLive}</span>
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-zinc-500">{WORKSPACE_DISPLAY.readiness.live}</span>
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-zinc-500">{WORKSPACE_DISPLAY.readiness.context}</span>
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-zinc-500">{WORKSPACE_DISPLAY.readiness.memory}</span>
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-zinc-500">{WORKSPACE_DISPLAY.readiness.ready}</span>
      </div>
      {showImprintChip && (
        <span className="mb-2 inline-block rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] text-zinc-400">{CONFIDENCE_CHIP_LABELS[imprintConfidence]}</span>
      )}
      <main>
        <WorkspaceConversationShell
          scope={scope}
          awakening={awakening}
          onAwakeningAdvance={handleAwakeningAdvance}
        />
      </main>
    </section>
  );
}
