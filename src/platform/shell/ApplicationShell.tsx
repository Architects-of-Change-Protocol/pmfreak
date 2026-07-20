import type { ReactNode } from "react";
import { EnterpriseSwitcher } from "./EnterpriseSwitcher";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { SidebarNavigation } from "./SidebarNavigation";
import { UserMenu } from "./UserMenu";
import { NotificationCenter } from "./NotificationCenter";

/**
 * Application Shell (Fase 2) — the new canonical layout for
 * FEATURE_COMMAND_CENTER routes. Additive: does not replace the existing
 * OperationalShell used by every other (protected) route
 * (src/components/pmfreak/operational-shell.tsx), so no PR1–PR8 surface is
 * touched by this PR (Fase "no rompe PR1–PR8").
 */
export function ApplicationShell({
  companyName,
  workspaceName,
  userFullName,
  userRole,
  workspaceId,
  projectId,
  activePath,
  children,
}: {
  companyName: string;
  workspaceName: string;
  userFullName: string;
  userRole: string;
  workspaceId: string;
  projectId: string;
  activePath: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-500/20 px-6 py-3">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold tracking-wide text-cyan-300">PMFreak</span>
          <EnterpriseSwitcher companyName={companyName} />
          <WorkspaceSwitcher workspaceName={workspaceName} />
        </div>
        <div className="flex items-center gap-3">
          <NotificationCenter />
          <UserMenu fullName={userFullName} role={userRole} />
        </div>
      </header>
      <div className="flex flex-1">
        <SidebarNavigation workspaceId={workspaceId} projectId={projectId} activePath={activePath} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
