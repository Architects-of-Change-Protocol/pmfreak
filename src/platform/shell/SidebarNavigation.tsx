import Link from "next/link";

/**
 * Sidebar navigation — Command Center / Portfolio / Projects / Decisions /
 * Agents / Governance, per Fase 2's layout. Platform-layer: domain-free
 * navigation shell, no data fetching, no Command dispatch
 * (07-frontend-module-boundaries.md §8).
 */
export function SidebarNavigation({ workspaceId, projectId, activePath }: { workspaceId: string; projectId: string; activePath: string }) {
  const base = `/w/${workspaceId}/p/${projectId}`;
  const items = [
    { label: "Command Center", href: `${base}/command-center` },
    { label: "Health", href: `${base}/health` },
    { label: "Decisions", href: `${base}/decisions` },
    { label: "Recommendations", href: `${base}/recommendations` },
    { label: "Evidence", href: `${base}/evidence` },
    { label: "Agents", href: `${base}/agents` },
  ];

  return (
    <nav aria-label="Primary" className="flex w-56 flex-shrink-0 flex-col gap-1 border-r border-slate-500/20 p-4">
      {items.map((item) => {
        const isActive = activePath.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${
              isActive ? "bg-cyan-300/10 text-cyan-200" : "text-slate-300 hover:bg-slate-500/10 hover:text-slate-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
