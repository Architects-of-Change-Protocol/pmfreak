"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { WorkspaceConversationShell } from "@/components/pmfreak/workspace/workspace-conversation-shell";
import { AWAKENING_EVENT, deriveAwakeningState, type AwakeningState } from "@/lib/workspace/awakening-state";
import { bootstrapRuntimeState } from "@/lib/workspace/runtime-bootstrap";
import { runtimePersistence, type RuntimePersistenceScope } from "@/lib/workspace/runtime-persistence";
import { getNavigationByTier } from "@/lib/workspace/navigation-hierarchy";

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

// Visible navigation, built once from the hierarchy.
const PRIMARY_NODES = getNavigationByTier("primary").filter((node) => node.visibleByDefault);
const LENS_NODES = getNavigationByTier("lens").filter((node) => node.visibleByDefault);
const UTILITY_NODES = getNavigationByTier("utility").filter((node) => node.visibleByDefault);

const SECONDARY_SECTIONS = [
  { heading: "Lenses", nodes: LENS_NODES },
  { heading: "Utilities", nodes: UTILITY_NODES },
].filter((section) => section.nodes.length > 0);

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
    <div className="flex w-full flex-col md:flex-row">
      <nav aria-label="Workspace navigation" className="flex gap-2 overflow-x-auto px-4 py-3 md:hidden">
        {PRIMARY_NODES.map((node) => (
          <Link key={`${node.label}-${node.href}`} href={node.href} className="flex shrink-0 items-center rounded-lg border border-cyan-300/30 bg-cyan-400/[0.06] px-3 py-1.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/[0.12]">
            {node.label}
          </Link>
        ))}
      </nav>

      <nav aria-label="Workspace navigation" className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:gap-6 md:border-r md:border-cyan-300/10 md:px-4 md:py-6">
        {PRIMARY_NODES.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="px-2 text-[10px] uppercase tracking-[0.3em] text-cyan-400/70">Actions</p>
            {PRIMARY_NODES.map((node) => (
              <Link key={`${node.label}-${node.href}`} href={node.href} className="flex items-center justify-between rounded-xl border border-cyan-300/25 bg-cyan-400/[0.06] px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-400/[0.12]">
                <span className="truncate">{node.label}</span>
                <span aria-hidden className="text-cyan-400/80">+</span>
              </Link>
            ))}
          </div>
        )}

        {SECONDARY_SECTIONS.map((section) => (
          <div key={section.heading} className="flex flex-col gap-1">
            <p className="px-2 text-[10px] uppercase tracking-[0.3em] text-zinc-600">{section.heading}</p>
            {section.nodes.map((node) => (
              <Link key={`${node.label}-${node.href}`} href={node.href} className="group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-cyan-400/[0.06] hover:text-cyan-100">
                <span className="h-1 w-1 rounded-full bg-zinc-700 transition group-hover:bg-cyan-400/70" />
                <span className="truncate">{node.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="min-w-0 flex-1">
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
      <main>
        <WorkspaceConversationShell
          scope={scope}
          awakening={awakening}
          onAwakeningAdvance={handleAwakeningAdvance}
        />
      </main>
        </section>
      </div>
    </div>
  );
}
