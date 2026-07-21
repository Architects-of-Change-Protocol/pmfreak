"use client";

import { useState } from "react";
import { CreateProjectModal } from "@/components/pmfreak/projects/create-project-modal";

const DEFAULT_CLASS =
  "inline-flex rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_-12px_rgba(15,23,42,0.6)] transition hover:bg-slate-800";

/** Opens the canonical CreateProjectModal — the CTA slot used by every
 *  server-rendered empty state that offers "create your first project". */
export function CreateProjectCta({ label, className = DEFAULT_CLASS }: { label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      {open && <CreateProjectModal onClose={() => setOpen(false)} />}
    </>
  );
}
