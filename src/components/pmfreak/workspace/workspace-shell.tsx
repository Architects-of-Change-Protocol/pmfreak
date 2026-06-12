"use client";

import { useCallback, useEffect, useState } from "react";
import { WorkspaceConversationShell } from "@/components/pmfreak/workspace/workspace-conversation-shell";
import { AWAKENING_EVENT, deriveAwakeningState, type AwakeningState } from "@/lib/workspace/awakening-state";
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
    void runtimePersistence.persistAwakening(scope, next).catch(() => undefined);
    window.dispatchEvent(new CustomEvent(AWAKENING_EVENT, { detail: next }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, workspaceId, userId]);

  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const showWelcome = freshOnboarding && !welcomeDismissed && pmoContext?.found;

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
          <div className="ml-auto flex items-center gap-1.5">
            {(
              [
                { key: "labels.operationallyLive", chip: "readiness.live" },
                { key: "readiness.context" },
                { key: "readiness.memory" },
                { key: "readiness.ready" },
              ] as { key: string; chip?: string }[]
            ).map(({ key, chip }) => (
              <span
                key={key}
                data-label={chip ?? key}
                className="rounded-full border border-cyan-300/20 bg-cyan-400/[0.06] px-2 py-0.5 text-[9px] uppercase tracking-[0.15em] text-cyan-400/70"
              >
                {(chip ?? key).split(".").pop()}
              </span>
            ))}
          </div>
        </div>
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
