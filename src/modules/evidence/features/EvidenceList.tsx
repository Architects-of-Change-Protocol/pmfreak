"use client";

import { ZoneFrame } from "@/platform/components";
import { useProjectEvidence } from "../contracts/evidence.contract";

const formatUploadDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));

/** Documents screen (03-screen-catalog.md §9) — List view over real project_evidence records. */
export function EvidenceList({ projectId }: { projectId: string }) {
  const { evidence, error, isLoading } = useProjectEvidence(projectId);

  return (
    <ZoneFrame title="Source Documents" isLoading={isLoading} error={error} isEmpty={evidence.length === 0} emptyMessage="No evidence uploaded yet for this project.">
      <ul className="flex flex-col gap-2">
        {evidence.map((item) => (
          <li key={item.id} className="flex items-center justify-between rounded-md border border-slate-500/25 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-slate-100">{item.file_name}</p>
              <p className="text-xs text-slate-400">
                {item.file_type} · Uploaded {formatUploadDate(item.uploaded_at)}
                {item.extraction ? ` · ${item.extraction.word_count.toLocaleString()} words extracted` : " · Awaiting extraction"}
              </p>
            </div>
            <span className="rounded-full border border-slate-400/30 px-2 py-0.5 text-xs capitalize text-slate-300">{item.status}</span>
          </li>
        ))}
      </ul>
    </ZoneFrame>
  );
}
