import Link from "next/link";

/**
 * Project section navigation. The project opens on Overview; the chat is one
 * view among many (never the landing view). Sections that already exist as
 * workspace surfaces are reused via ?projectId= links rather than rebuilt.
 *
 * Meetings and Risks & Issues intentionally omit ?projectId= and are labeled
 * "(preview)": their destination pages (/meetings, /change-detection) are
 * generic workspace-wide modules that do not read a projectId param at all —
 * passing one would falsely imply per-project scoping that doesn't exist yet.
 */
export function ProjectTabNav({ projectId, active }: { projectId: string; active: "overview" | "chat" | "settings" }) {
  const tabs: { label: string; href: string; key?: string }[] = [
    { label: "Overview", href: `/projects/${projectId}`, key: "overview" },
    { label: "Chat", href: `/projects/${projectId}/chat`, key: "chat" },
    { label: "Execution", href: `/command-center?projectId=${projectId}` },
    { label: "Timeline", href: `/dashboard?projectId=${projectId}` },
    { label: "Tasks", href: `/follow-up-dashboard?projectId=${projectId}` },
    { label: "Documents", href: `/upload?projectId=${projectId}` },
    { label: "Meetings (preview)", href: `/meetings` },
    { label: "Evidence", href: `/evidence?projectId=${projectId}` },
    { label: "Risks & Issues (preview)", href: `/change-detection` },
    { label: "Reports", href: `/executive?projectId=${projectId}` },
    { label: "Settings", href: `/projects/${projectId}/settings`, key: "settings" },
  ];

  return (
    <nav aria-label="Project sections" className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.label}
            href={tab.href}
            className={`rounded-xl border px-3.5 py-2 text-sm transition ${
              isActive
                ? "border-cyan-300/50 bg-cyan-400/10 text-cyan-100"
                : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/25"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
