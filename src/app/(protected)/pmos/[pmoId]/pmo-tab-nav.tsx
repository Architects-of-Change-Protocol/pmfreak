import Link from "next/link";

const TABS = [
  { label: "Overview", segment: "" },
  { label: "Chat", segment: "chat" },
  { label: "Reports", segment: "reports" },
  { label: "Settings", segment: "settings" },
] as const;

export function PmoTabNav({ pmoId, active }: { pmoId: string; active: "" | "chat" | "reports" | "settings" }) {
  return (
    <nav aria-label="PMO sections" className="flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const href = tab.segment ? `/pmos/${pmoId}/${tab.segment}` : `/pmos/${pmoId}`;
        const isActive = active === tab.segment;
        return (
          <Link
            key={tab.label}
            href={href}
            className={`rounded-xl border px-3.5 py-2 text-sm transition ${
              isActive
                ? "border-cyan-300/50 bg-cyan-400/10 text-cyan-900"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-200"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
