"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type TreeProject = { id: string; name: string; status: string };
type TreePmo = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  status: string;
  projects: TreeProject[];
};

/**
 * Workspace → PMO → Project navigation tree (sidebar).
 * PMOs are never mixed with projects: each PMO is a group with its own
 * nested project list. Scales to many PMOs via per-group collapse.
 */
export function SidebarPmoTree({
  activeProjectId,
  onSelectProject,
}: {
  activeProjectId?: string;
  onSelectProject?: (projectId: string) => void;
}) {
  const pathname = usePathname();
  const [pmos, setPmos] = useState<TreePmo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/pmos", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { pmos?: TreePmo[] };
        if (active) setPmos(data.pmos ?? []);
      } catch {
        if (active) setPmos([]);
      } finally {
        if (active) setLoaded(true);
      }
    }
    void load();
    return () => { active = false; };
  }, [pathname]);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between px-1">
        <p className="text-[9px] uppercase tracking-[0.28em] text-zinc-600">PMOs</p>
        <Link href="/pmos" className="text-[10px] font-semibold text-cyan-300/80 hover:text-cyan-200" title="Create or manage PMOs">
          + New PMO
        </Link>
      </div>

      {!loaded ? (
        <p className="px-1 text-[11px] text-zinc-600">Loading…</p>
      ) : pmos.length === 0 ? (
        <Link href="/pmos" className="block rounded-lg border border-dashed border-white/[0.12] px-2.5 py-2 text-[11px] text-slate-400 hover:border-cyan-300/40 hover:text-cyan-200">
          Create your first PMO
        </Link>
      ) : (
        <div className="space-y-1.5">
          {pmos.map((pmo) => {
            const isCollapsed = collapsed[pmo.id] ?? false;
            const pmoActive = pathname.startsWith(`/pmos/${pmo.id}`);
            return (
              <div key={pmo.id} className="rounded-lg border border-white/[0.05] bg-white/[0.01]">
                <div className="flex items-center gap-1 px-1.5 py-1">
                  <button
                    type="button"
                    aria-label={isCollapsed ? `Expand ${pmo.name}` : `Collapse ${pmo.name}`}
                    onClick={() => setCollapsed((s) => ({ ...s, [pmo.id]: !isCollapsed }))}
                    className="shrink-0 rounded px-1 text-[10px] text-zinc-500 hover:text-zinc-300"
                  >
                    {isCollapsed ? "▸" : "▾"}
                  </button>
                  <Link
                    href={`/pmos/${pmo.id}`}
                    className={`min-w-0 flex-1 truncate rounded px-1 py-0.5 text-xs ${pmoActive ? "text-cyan-100" : "text-slate-300 hover:text-slate-100"}`}
                    style={pmo.color ? { textShadow: `0 0 14px ${pmo.color}55` } : undefined}
                  >
                    <span className="mr-1">{pmo.icon ?? "🏛️"}</span>
                    {pmo.name}
                  </Link>
                  <Link
                    href={`/projects/new?pmoId=${pmo.id}`}
                    aria-label={`New project in ${pmo.name}`}
                    title={`New project in ${pmo.name}`}
                    className="shrink-0 rounded px-1 text-[11px] text-zinc-500 hover:text-cyan-200"
                  >
                    +
                  </Link>
                </div>
                {!isCollapsed ? (
                  <div className="space-y-0.5 pb-1.5 pl-6 pr-2">
                    {pmo.projects.length === 0 ? (
                      <p className="px-1 text-[10px] text-zinc-600">No projects</p>
                    ) : (
                      pmo.projects.map((project) => {
                        const isActive = project.id === activeProjectId || pathname.startsWith(`/projects/${project.id}`);
                        return (
                          <Link
                            key={project.id}
                            href={`/projects/${project.id}`}
                            onClick={() => onSelectProject?.(project.id)}
                            className={`block truncate rounded px-1.5 py-1 text-[11px] transition-colors ${
                              isActive ? "bg-cyan-300/[0.08] text-cyan-100" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                            }`}
                          >
                            {project.name}
                          </Link>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
