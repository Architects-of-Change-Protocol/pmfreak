"use client";

import { DecisionList } from "@/modules/decisions";

/** Pending Decisions zone (08-command-center-experience.md §1) — a count/list, never merged with Recommendations. */
export function DecisionPanel({ projectId }: { projectId: string }) {
  return <DecisionList projectId={projectId} statusFilter={["pending_review"]} title="Pending Decisions" emptyMessage="No decisions awaiting approval." />;
}
