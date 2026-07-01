"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { OperationalGovernanceBrief } from "@/lib/projects/first-insight";
import { CommandCenterLayout } from "./command-center-layout";
import type { ProjectListItem, ToneBadge } from "./types";

type UserProject = { id: string; name: string };

function deriveProjectCode(name: string, id: string): string {
  const initials = name
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
  const suffix = id.replace(/-/g, "").slice(0, 5).toUpperCase();
  return `${initials || "PRJ"}-${suffix}`;
}

function buildProjectListItem(project: UserProject, brief: OperationalGovernanceBrief | null): ProjectListItem {
  const badges: ToneBadge[] = [];
  if (brief) {
    const dangerCount = brief.topExecutionRisks.filter((r) => r.severity === "high" || r.severity === "critical").length;
    if (dangerCount > 0) badges.push({ tone: "danger", label: String(dangerCount) });

    const taskCount = brief.detectedRaidOverview.snapshot.issues;
    if (taskCount > 0) badges.push({ tone: "task", label: String(taskCount) });

    const approvalCount = Math.min(brief.governanceGaps.length, 9);
    if (approvalCount > 0) badges.push({ tone: "approval", label: String(approvalCount) });
  }

  return {
    id: project.id,
    code: deriveProjectCode(project.name, project.id),
    name: project.name,
    fullName: project.name,
    badges,
    hasIntelligence: brief !== null,
    healthy: brief !== null && badges.length === 0,
  };
}

export function CommandCenterClient({
  projectId,
  projectName,
  workspaceId,
  projects,
  companyName,
  initialBrief,
  briefGenerationFailed = false,
}: {
  firstRun?: boolean;
  projectId: string;
  projectName: string;
  workspaceId: string;
  projects: UserProject[];
  companyName?: string;
  role: string;
  onboardingCompleted: boolean;
  planTier: "free" | "pro" | "pmo";
  canUseAdvancedAi: boolean;
  canUsePortfolioMemory: boolean;
  canUseGovernanceDirectives: boolean;
  initialBrief?: OperationalGovernanceBrief | null;
  briefGenerationFailed?: boolean;
}) {
  const router = useRouter();
  const [brief, setBrief] = useState(initialBrief ?? null);
  const [briefFailed, setBriefFailed] = useState(briefGenerationFailed && !initialBrief);
  const [retryingBrief, setRetryingBrief] = useState(false);

  const projectListItems = useMemo(() => {
    const source = projects.length > 0 ? projects : [{ id: projectId, name: projectName }];
    return source.map((project) => buildProjectListItem(project, project.id === projectId ? brief : null));
  }, [projects, projectId, projectName, brief]);

  const retryBrief = async () => {
    setRetryingBrief(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/operational-governance-brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (!response.ok) throw new Error("retry_failed");
      const payload = await response.json();
      setBrief(payload.brief ?? null);
      setBriefFailed(!payload.brief);
    } catch {
      setBriefFailed(true);
    } finally {
      setRetryingBrief(false);
    }
  };

  return (
    <div>
      {briefFailed && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3">
          <p className="text-sm text-amber-900">Project created. We couldn&apos;t generate the first governance brief yet.</p>
          <button
            type="button"
            onClick={retryBrief}
            disabled={retryingBrief}
            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-50 disabled:opacity-50"
          >
            {retryingBrief ? "Retrying..." : "Retry brief generation"}
          </button>
        </div>
      )}
      <CommandCenterLayout
        workspaceName={companyName ?? "Demo PMO"}
        workspaceId={workspaceId}
        projects={projectListItems}
        activeProjectId={projectId}
        hasBrief={brief !== null}
        onSelectProject={(id) => router.push(`/command-center?projectId=${encodeURIComponent(id)}`)}
        onEvidenceAdded={() => { void retryBrief(); }}
      />
    </div>
  );
}
