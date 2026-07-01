"use client";

import { useMemo } from "react";
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
    healthy: badges.length === 0,
  };
}

export function CommandCenterClient({
  projectId,
  projectName,
  projects,
  companyName,
  initialBrief,
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
  const projectListItems = useMemo(() => {
    const source = projects.length > 0 ? projects : [{ id: projectId, name: projectName }];
    return source.map((project) => buildProjectListItem(project, project.id === projectId ? initialBrief ?? null : null));
  }, [projects, projectId, projectName, initialBrief]);

  return (
    <CommandCenterLayout workspaceName={companyName ?? "Demo PMO"} projects={projectListItems} activeProjectId={projectId} />
  );
}
