"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { NavigationRailItem } from "@/features/runtime/capability-reveal/capability-reveal-types";

type AdvancedDrawerProps = {
  items: NavigationRailItem[];
  pathname: string;
  navHref: (href: string) => string;
};

export function AdvancedDrawer({ items, pathname, navHref }: AdvancedDrawerProps) {
  const [open, setOpen] = useState(false);
  const hasActiveItem = useMemo(() => items.some((item) => pathname.startsWith(item.href)), [items, pathname]);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Advanced Runtime</span>
        <span className="text-xs text-zinc-500">{open || hasActiveItem ? "▾" : "▸"}</span>
      </button>

      {(open || hasActiveItem) && (
        <div className="space-y-1 px-2 pb-2">
          {items.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={navHref(item.href)}
                className={`block rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                  isActive
                    ? `${item.active} border-opacity-100`
                    : `border-white/[0.05] bg-white/[0.01] ${item.idle} hover:border-white/[0.12]`
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
