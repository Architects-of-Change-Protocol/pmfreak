import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PROJECT_SELECTABLE_COLUMNS,
  EXECUTION_TASK_SELECTABLE_COLUMNS,
  PROJECT_MILESTONE_SELECTABLE_COLUMNS,
  RAID_ITEM_SELECTABLE_COLUMNS,
  EXECUTION_TASK_DEPENDENCY_SELECTABLE_COLUMNS,
  type ProjectRow,
  type ExecutionTaskRow,
  type ProjectMilestoneRow,
  type RaidItemRow,
  type ExecutionTaskDependencyRow,
} from "@/lib/db/database-contract";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/lib/security/access-guards";
import { computePortfolioIntelligence, type ProjectDataBundle } from "./portfolio-summary";
import type { PortfolioIntelligence } from "./types";

const PROJECT_SELECT = PROJECT_SELECTABLE_COLUMNS.join(",");
const TASK_SELECT = EXECUTION_TASK_SELECTABLE_COLUMNS.join(",");
const MILESTONE_SELECT = PROJECT_MILESTONE_SELECTABLE_COLUMNS.join(",");
const RAID_SELECT = RAID_ITEM_SELECTABLE_COLUMNS.join(",");
const DEP_SELECT = EXECUTION_TASK_DEPENDENCY_SELECTABLE_COLUMNS.join(",");

export async function getPortfolioIntelligence(
  workspaceId: string,
): Promise<
  { ok: true; data: PortfolioIntelligence } | { ok: false; error: string; failureClass: string }
> {
  const startMs = Date.now();

  try {
    await requireAuthenticatedUser();
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return { ok: false, error: "Unauthenticated.", failureClass: "unauthenticated" };
    }
    return { ok: false, error: "Authorization failed.", failureClass: "unauthenticated" };
  }

  const supabase = await createSupabaseServerClient();

  console.log(`[portfolio.started] workspaceId=${workspaceId}`);

  const projectsResult = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .overrideTypes<ProjectRow[], { merge: false }>();

  if (projectsResult.error) {
    console.error(`[portfolio.failed] workspaceId=${workspaceId} error=${projectsResult.error.message}`);
    return { ok: false, error: "Failed to load projects.", failureClass: "persistence_failed" };
  }

  const projects = projectsResult.data ?? [];

  if (projects.length === 0) {
    const empty = computePortfolioIntelligence([]);
    console.log(`[portfolio.completed] workspaceId=${workspaceId} projectCount=0 durationMs=${Date.now() - startMs}`);
    return { ok: true, data: empty };
  }

  const projectIds = projects.map((p) => p.id);

  const [tasksResult, milestonesResult, raidResult, depsResult] = await Promise.all([
    supabase.from("execution_tasks").select(TASK_SELECT).in("project_id", projectIds).overrideTypes<ExecutionTaskRow[], { merge: false }>(),
    supabase.from("project_milestones").select(MILESTONE_SELECT).in("project_id", projectIds).overrideTypes<ProjectMilestoneRow[], { merge: false }>(),
    supabase.from("raid_items").select(RAID_SELECT).in("project_id", projectIds).overrideTypes<RaidItemRow[], { merge: false }>(),
    supabase
      .from("execution_task_dependencies")
      .select(DEP_SELECT)
      .in("project_id", projectIds)
      .in("status", ["active", "proposed"])
      .overrideTypes<ExecutionTaskDependencyRow[], { merge: false }>(),
  ]);

  if (tasksResult.error || milestonesResult.error || raidResult.error || depsResult.error) {
    const msg =
      tasksResult.error?.message ??
      milestonesResult.error?.message ??
      raidResult.error?.message ??
      depsResult.error?.message ??
      "Unknown error";
    console.error(`[portfolio.failed] workspaceId=${workspaceId} error=${msg}`);
    return { ok: false, error: "Failed to load portfolio data.", failureClass: "persistence_failed" };
  }

  const allTasks = tasksResult.data ?? [];
  const allMilestones = milestonesResult.data ?? [];
  const allRaid = raidResult.data ?? [];
  const allDeps = depsResult.data ?? [];

  const bundles: ProjectDataBundle[] = projects.map((project) => ({
    project,
    tasks: allTasks.filter((t) => t.project_id === project.id),
    milestones: allMilestones.filter((m) => m.project_id === project.id),
    raidItems: allRaid.filter((r) => r.project_id === project.id),
    dependencies: allDeps.filter((d) => d.project_id === project.id),
  }));

  const data = computePortfolioIntelligence(bundles);

  console.log(
    `[portfolio.completed] workspaceId=${workspaceId} projectCount=${projects.length} durationMs=${Date.now() - startMs}`,
  );

  return { ok: true, data };
}
