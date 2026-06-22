"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import type { ProgramRow } from "@/lib/program-builder-client";
import { ProgramStatusBadge } from "./ProgramStatusBadge";
import { ProgramTypeBadge } from "./ProgramTypeBadge";

const TABS = [
  { label: "Overview",         href: "" },
  { label: "Builder",          href: "/builder" },
  { label: "Board",            href: "/board" },
  { label: "Sources",          href: "/sources" },
  { label: "Parse Results",    href: "/parse-results" },
  { label: "Materializations", href: "/materializations" },
] as const;

type Props = {
  program: ProgramRow;
  children: ReactNode;
};

export function ProgramShell({ program, children }: Props) {
  const pathname = usePathname();
  const base = `/programs/${program.id}`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-black/30 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/programs" className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-300 transition">
              ← Programs
            </Link>
            <h1 className="mt-1.5 text-xl font-semibold text-slate-100 md:text-2xl">{program.name}</h1>
            {program.description && (
              <p className="mt-1 max-w-2xl text-sm text-zinc-400">{program.description}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ProgramStatusBadge status={program.status} />
              <ProgramTypeBadge type={program.type} />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-5 flex flex-wrap gap-1 border-t border-white/[0.06] pt-4">
          {TABS.map(({ label, href }) => {
            const fullHref = `${base}${href}`;
            const isActive = href === ""
              ? pathname === base || pathname === `${base}/`
              : pathname.startsWith(fullHref);
            return (
              <Link
                key={href}
                href={fullHref}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "border-indigo-300/50 bg-indigo-400/15 text-indigo-100"
                    : "border-white/[0.06] bg-white/[0.01] text-zinc-400 hover:border-white/15 hover:text-zinc-200"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>

      {children}
    </div>
  );
}
