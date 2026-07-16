import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ContextScope } from "@/lib/context/context-scope";
import { contextIdFor } from "@/lib/context/context-scope";

/**
 * Deterministic, data-grounded responder for the three context chats.
 *
 * Consistent with the existing Command Center gateway, this performs no LLM
 * calls: every answer is assembled from real rows that belong strictly to
 * the requesting scope.
 *
 * Isolation guarantee: all queries filter by the scope's own keys —
 *   workspace chat → every PMO/project in the workspace
 *   pmo chat       → only projects with pmo_id = scope.pmoId
 *   project chat   → only rows with project_id = scope.projectId
 * Nothing outside the scope is ever read.
 */

type ProjectSlice = { id: string; name: string; status: string; pmo_id: string | null };
type RaidSlice = { project_id: string; category: string; status: string; due_date: string | null; owner: string | null; title: string };
type TaskSlice = { project_id: string; status: string; due_date: string | null; title: string };

async function loadScopeData(scope: ContextScope) {
  const supabase = await createSupabaseServerClient();

  let projectsQuery = supabase
    .from("projects")
    .select("id, name, status, pmo_id")
    .eq("workspace_id", scope.workspaceId)
    .order("created_at", { ascending: true });
  if (scope.type === "pmo") projectsQuery = projectsQuery.eq("pmo_id", scope.pmoId);
  if (scope.type === "project") projectsQuery = projectsQuery.eq("id", scope.projectId);

  const { data: projectRows } = await projectsQuery;
  const projects = (projectRows ?? []) as ProjectSlice[];
  const projectIds = projects.map((p) => p.id);

  let raid: RaidSlice[] = [];
  let tasks: TaskSlice[] = [];
  if (projectIds.length > 0) {
    const [{ data: raidRows }, { data: taskRows }] = await Promise.all([
      supabase
        .from("raid_items")
        .select("project_id, category, status, due_date, owner, title")
        .eq("workspace_id", scope.workspaceId)
        .in("project_id", projectIds)
        .limit(500),
      supabase
        .from("execution_tasks")
        .select("project_id, status, due_date, title")
        .eq("workspace_id", scope.workspaceId)
        .in("project_id", projectIds)
        .limit(500),
    ]);
    raid = (raidRows ?? []) as RaidSlice[];
    tasks = (taskRows ?? []) as TaskSlice[];
  }

  let pmoCount = 0;
  if (scope.type === "workspace") {
    const { count } = await supabase
      .from("pmos")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", scope.workspaceId)
      .eq("status", "active");
    pmoCount = count ?? 0;
  }

  return { projects, raid, tasks, pmoCount };
}

function summarizeProjects(projects: ProjectSlice[]): string {
  const active = projects.filter((p) => p.status === "active").length;
  const archived = projects.filter((p) => p.status === "archived").length;
  const completed = projects.filter((p) => p.status === "completed").length;
  return `${projects.length} project${projects.length === 1 ? "" : "s"} (${active} active, ${completed} completed, ${archived} archived)`;
}

function overdue(items: { due_date: string | null; status: string }[], now: Date): number {
  return items.filter((i) => i.due_date && new Date(i.due_date) < now && i.status !== "completed" && i.status !== "closed" && i.status !== "resolved").length;
}

export async function buildContextReply(scope: ContextScope, question: string): Promise<{ content: string; metadata: Record<string, unknown> }> {
  const { projects, raid, tasks, pmoCount } = await loadScopeData(scope);
  const now = new Date();
  const q = question.toLowerCase();

  const openRisks = raid.filter((r) => r.category === "risk" && r.status !== "closed" && r.status !== "resolved");
  const openIssues = raid.filter((r) => r.category === "issue" && r.status !== "closed" && r.status !== "resolved");
  const overdueTasks = overdue(tasks, now);
  const overdueRaid = overdue(raid, now);

  const scopeLabel =
    scope.type === "workspace" ? "workspace" : scope.type === "pmo" ? "PMO" : "project";

  const lines: string[] = [];

  const wantsRisks = /risk|riesgo/.test(q);
  const wantsCommitments = /commit|compromiso|due|venc|overdue|atras/.test(q);
  const wantsAttention = /attention|atenci|today|hoy|atend|worse|empeor|focus/.test(q);
  const wantsReport = /report|reporte|executive|ejecutivo|summary|resumen/.test(q);
  const wantsCounts = /how many|cuant|count|status|estado/.test(q);
  const specific = wantsRisks || wantsCommitments || wantsAttention || wantsReport || wantsCounts;

  if (wantsRisks || wantsReport || !specific) {
    lines.push(`Open risks in this ${scopeLabel}: ${openRisks.length}. Open issues: ${openIssues.length}.`);
    const named = openRisks.slice(0, 5).map((r) => {
      const project = projects.find((p) => p.id === r.project_id);
      return `• ${r.title}${project && scope.type !== "project" ? ` (${project.name})` : ""}`;
    });
    if (named.length > 0 && wantsRisks) lines.push(...named);
  }

  if (wantsCommitments || wantsAttention || wantsReport) {
    lines.push(`Overdue execution tasks: ${overdueTasks}. Overdue RAID items: ${overdueRaid}.`);
  }

  if (wantsCounts || wantsReport || !specific) {
    if (scope.type === "workspace") {
      lines.unshift(`This workspace has ${pmoCount} active PMO${pmoCount === 1 ? "" : "s"} and ${summarizeProjects(projects)}.`);
    } else if (scope.type === "pmo") {
      lines.unshift(`This PMO manages ${summarizeProjects(projects)}.`);
    } else {
      const project = projects[0];
      lines.unshift(project ? `Project "${project.name}" is ${project.status}.` : "Project not found in this context.");
    }
  }

  if (wantsAttention) {
    const attention = projects
      .map((p) => {
        const projectRisks = openRisks.filter((r) => r.project_id === p.id).length;
        const projectOverdue = overdue(tasks.filter((t) => t.project_id === p.id), now);
        return { p, score: projectRisks + projectOverdue };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    if (attention.length > 0) {
      lines.push("Needs attention first:");
      lines.push(...attention.map((x) => `• ${x.p.name} — ${x.score} open signal${x.score === 1 ? "" : "s"}`));
    } else {
      lines.push("No projects currently carry overdue work or open risks.");
    }
  }

  if (lines.length === 0) {
    lines.push(
      scope.type === "workspace"
        ? `This workspace has ${pmoCount} active PMOs and ${summarizeProjects(projects)}. Ask about risks, overdue commitments, or what needs attention today.`
        : `This ${scopeLabel} covers ${summarizeProjects(projects)}. Ask about risks, overdue commitments, or what needs attention today.`
    );
  }

  return {
    content: lines.join("\n"),
    metadata: {
      contextId: contextIdFor(scope),
      grounded: {
        projects: projects.length,
        openRisks: openRisks.length,
        openIssues: openIssues.length,
        overdueTasks,
      },
    },
  };
}
