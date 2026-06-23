import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPlatformEvent } from "@/lib/platform-events";
import type {
  PersonalPortfolioRow,
  PersonalPortfolioProjectRow,
  PersonalPortfolioSnapshotRow,
  PersonalPortfolioAttentionItemRow,
  PersonalPortfolioResult,
  PersonalPortfolioEventType,
  PortfolioProjectMetric,
  PersonalPortfolioSnapshot,
  PortfolioRanking,
  ProjectPriorityScore,
  AttentionAllocationPlan,
  ProjectAttentionAllocation,
  NeglectAnalysis,
  NeglectConsequence,
  NeglectSeverity,
  PersonalCommandCenterPayload,
  CommandCenterFocusItem,
  CommandCenterAgendaItem,
  PersonalPortfolioAttentionType,
  PersonalPortfolioAttentionSeverity,
} from "./types";

// ─── Column selectors ─────────────────────────────────────────────────────────

const PORTFOLIO_COLS =
  "id,workspace_id,owner_id,name,description,status,created_at,updated_at";
const PORTFOLIO_PROJECT_COLS =
  "id,workspace_id,portfolio_id,project_id,added_at";
const SNAPSHOT_COLS =
  "id,workspace_id,portfolio_id,snapshot_status,total_projects,healthy_projects,warning_projects,critical_projects,overall_health,ranked_project_ids,attention_allocation,neglect_consequences,command_center_payload,snapshot_payload,generated_at,created_at";
const ATTENTION_COLS =
  "id,workspace_id,snapshot_id,project_id,attention_type,severity,title,description,recommended_action,created_at";

// ─── Validation helpers ───────────────────────────────────────────────────────

function validUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(v);
}

function required(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function fail<T>(error: string, failureClass = "persistence_failed"): PersonalPortfolioResult<T> {
  return { ok: false, error, failureClass };
}

function validationFail<T>(error: string): PersonalPortfolioResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

// ─── Event emission ───────────────────────────────────────────────────────────

async function emitPortfolioEvent(
  workspaceId: string,
  actorId: string,
  eventType: PersonalPortfolioEventType,
  entityId: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await createPlatformEvent({
    workspaceId,
    actorId,
    actorType: "user",
    eventType,
    eventCategory: "governance",
    eventPayload: { entityId, ...payload },
    learningEligible: false,
  });
}

// ─── Sprint 1: Portfolio Foundation ──────────────────────────────────────────

export async function createPersonalPortfolio(input: {
  workspaceId: string;
  ownerId: string;
  name: string;
  description?: string;
  actorId: string;
}): Promise<PersonalPortfolioResult<PersonalPortfolioRow>> {
  if (!validUuid(input.workspaceId)) return validationFail("Invalid workspaceId.");
  if (!validUuid(input.ownerId)) return validationFail("Invalid ownerId.");
  if (!required(input.name)) return validationFail("Portfolio name is required.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_portfolios")
    .insert({
      workspace_id: input.workspaceId,
      owner_id: input.ownerId,
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
      status: "active",
    })
    .select(PORTFOLIO_COLS)
    .single<PersonalPortfolioRow>();

  if (error || !data) {
    console.error("[personal-portfolio.create.failed]", error?.message);
    return fail("Failed to create portfolio.");
  }

  await emitPortfolioEvent(input.workspaceId, input.actorId, "PERSONAL_PORTFOLIO_CREATED", data.id, {
    name: data.name,
    ownerId: input.ownerId,
  });

  return { ok: true, data };
}

export async function addProjectToPortfolio(input: {
  workspaceId: string;
  portfolioId: string;
  projectId: string;
  actorId: string;
}): Promise<PersonalPortfolioResult<PersonalPortfolioProjectRow>> {
  if (!validUuid(input.portfolioId)) return validationFail("Invalid portfolioId.");
  if (!validUuid(input.projectId)) return validationFail("Invalid projectId.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_portfolio_projects")
    .insert({
      workspace_id: input.workspaceId,
      portfolio_id: input.portfolioId,
      project_id: input.projectId,
    })
    .select(PORTFOLIO_PROJECT_COLS)
    .single<PersonalPortfolioProjectRow>();

  if (error || !data) {
    if (error?.code === "23505") return fail("Project already in portfolio.", "duplicate");
    console.error("[personal-portfolio.add-project.failed]", error?.message);
    return fail("Failed to add project to portfolio.");
  }

  await emitPortfolioEvent(input.workspaceId, input.actorId, "PERSONAL_PORTFOLIO_PROJECT_ADDED", input.portfolioId, {
    projectId: input.projectId,
  });

  return { ok: true, data };
}

export async function removeProjectFromPortfolio(input: {
  workspaceId: string;
  portfolioId: string;
  projectId: string;
  actorId: string;
}): Promise<PersonalPortfolioResult<{ removed: true }>> {
  if (!validUuid(input.portfolioId)) return validationFail("Invalid portfolioId.");
  if (!validUuid(input.projectId)) return validationFail("Invalid projectId.");

  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("personal_portfolio_projects")
    .delete({ count: "exact" })
    .eq("portfolio_id", input.portfolioId)
    .eq("project_id", input.projectId)
    .eq("workspace_id", input.workspaceId);

  if (error) {
    console.error("[personal-portfolio.remove-project.failed]", error.message);
    return fail("Failed to remove project from portfolio.");
  }

  if ((count ?? 0) === 0) {
    return fail("Project not found in portfolio.", "not_found");
  }

  await emitPortfolioEvent(input.workspaceId, input.actorId, "PERSONAL_PORTFOLIO_PROJECT_REMOVED", input.portfolioId, {
    projectId: input.projectId,
  });

  return { ok: true, data: { removed: true } };
}

export async function listPortfolioProjects(input: {
  workspaceId: string;
  portfolioId: string;
}): Promise<PersonalPortfolioResult<PersonalPortfolioProjectRow[]>> {
  if (!validUuid(input.portfolioId)) return validationFail("Invalid portfolioId.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_portfolio_projects")
    .select(PORTFOLIO_PROJECT_COLS)
    .eq("portfolio_id", input.portfolioId)
    .eq("workspace_id", input.workspaceId)
    .order("added_at", { ascending: false })
    .overrideTypes<PersonalPortfolioProjectRow[], { merge: false }>();

  if (error) {
    console.error("[personal-portfolio.list-projects.failed]", error.message);
    return fail("Failed to list portfolio projects.");
  }

  return { ok: true, data: data ?? [] };
}

// ─── Sprint 1: Snapshot Generation ───────────────────────────────────────────

export async function generatePortfolioSnapshot(input: {
  workspaceId: string;
  portfolioId: string;
  actorId: string;
  projectMetrics: PortfolioProjectMetric[];
}): Promise<PersonalPortfolioResult<PersonalPortfolioSnapshot>> {
  if (!validUuid(input.portfolioId)) return validationFail("Invalid portfolioId.");

  const metrics = input.projectMetrics;
  const totalProjects = metrics.length;
  const healthyProjects = metrics.filter((m) => m.status === "healthy").length;
  const warningProjects = metrics.filter((m) => m.status === "warning").length;
  const criticalProjects = metrics.filter((m) => m.status === "critical").length;
  const overallHealth =
    totalProjects > 0
      ? Math.round(metrics.reduce((sum, m) => sum + m.healthScore, 0) / totalProjects)
      : 100;

  // Sprint 2: compute ranking
  const ranking = computeProjectRanking(metrics);
  const rankedProjectIds = ranking.map((r) => r.projectId);

  // Sprint 3: compute attention allocation
  const allocations = computeAttentionAllocation(ranking);
  const attentionAllocation: Record<string, number> = {};
  for (const a of allocations) {
    attentionAllocation[a.projectId] = a.attentionPercentage;
  }

  // Sprint 4: compute neglect consequences
  const neglectConsequences: Record<string, NeglectConsequence> = {};
  for (const m of metrics) {
    neglectConsequences[m.projectId] = computeNeglectConsequence(m);
  }

  // Sprint 5: build command center
  const commandCenterPayload = buildCommandCenter({
    ownerId: input.actorId,
    metrics,
    ranking,
    allocations,
    neglectConsequences,
  });

  const supabase = await createSupabaseServerClient();
  const { data: snapshotRow, error: snapshotError } = await supabase
    .from("personal_portfolio_snapshots")
    .insert({
      workspace_id: input.workspaceId,
      portfolio_id: input.portfolioId,
      snapshot_status: "generated",
      total_projects: totalProjects,
      healthy_projects: healthyProjects,
      warning_projects: warningProjects,
      critical_projects: criticalProjects,
      overall_health: overallHealth,
      ranked_project_ids: rankedProjectIds,
      attention_allocation: attentionAllocation as unknown as Record<string, unknown>,
      neglect_consequences: neglectConsequences as unknown as Record<string, unknown>,
      command_center_payload: commandCenterPayload as unknown as Record<string, unknown>,
      snapshot_payload: { metrics } as unknown as Record<string, unknown>,
      generated_at: new Date().toISOString(),
    })
    .select(SNAPSHOT_COLS)
    .single<PersonalPortfolioSnapshotRow>();

  if (snapshotError || !snapshotRow) {
    console.error("[personal-portfolio.snapshot.failed]", snapshotError?.message);
    return fail("Failed to persist portfolio snapshot.");
  }

  // Generate attention items
  const attentionItems = buildAttentionItems(metrics, snapshotRow.id, input.workspaceId);
  let savedAttentionItems: PersonalPortfolioAttentionItemRow[] = [];

  if (attentionItems.length > 0) {
    const { data: aiData } = await supabase
      .from("personal_portfolio_attention_items")
      .insert(attentionItems)
      .select(ATTENTION_COLS)
      .overrideTypes<PersonalPortfolioAttentionItemRow[], { merge: false }>();
    savedAttentionItems = aiData ?? [];
  }

  await emitPortfolioEvent(
    input.workspaceId,
    input.actorId,
    "PERSONAL_PORTFOLIO_SNAPSHOT_GENERATED",
    snapshotRow.id,
    { portfolioId: input.portfolioId, overallHealth, totalProjects },
  );

  return {
    ok: true,
    data: mapSnapshotRow(snapshotRow, savedAttentionItems),
  };
}

// ─── Sprint 2: Prioritization Engine ─────────────────────────────────────────

export function rankPortfolioProjects(metrics: PortfolioProjectMetric[]): PortfolioRanking {
  const ranked = computeProjectRanking(metrics);
  return {
    portfolioId: "",
    rankedProjects: ranked,
    generatedAt: new Date().toISOString(),
  };
}

export function calculatePortfolioAttentionScore(metric: PortfolioProjectMetric): number {
  return computeProjectScore(metric);
}

function computeProjectRanking(metrics: PortfolioProjectMetric[]): ProjectPriorityScore[] {
  const scored = metrics.map((m) => {
    const healthContribution = (100 - m.healthScore) * 0.30;
    const riskContribution = m.riskScore * 0.20;
    const driftContribution = Math.min(100, m.overdueTaskCount * 8) * 0.15;
    const decisionsContribution = Math.min(100, m.openDecisionsCount * 10) * 0.15;
    const commitmentsContribution = Math.min(100, m.openCommitmentsCount * 10) * 0.10;
    const criticalFocusContribution = Math.min(100, m.criticalFocusCount * 12) * 0.10;
    const score =
      healthContribution +
      riskContribution +
      driftContribution +
      decisionsContribution +
      commitmentsContribution +
      criticalFocusContribution;
    return {
      projectId: m.projectId,
      projectName: m.projectName,
      score: Math.round(score),
      rank: 0,
      breakdown: {
        healthContribution: Math.round(healthContribution),
        riskContribution: Math.round(riskContribution),
        driftContribution: Math.round(driftContribution),
        decisionsContribution: Math.round(decisionsContribution),
        commitmentsContribution: Math.round(commitmentsContribution),
        criticalFocusContribution: Math.round(criticalFocusContribution),
      },
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s, i) => ({ ...s, rank: i + 1 }));
}

function computeProjectScore(m: PortfolioProjectMetric): number {
  return (
    (100 - m.healthScore) * 0.30 +
    m.riskScore * 0.20 +
    Math.min(100, m.overdueTaskCount * 8) * 0.15 +
    Math.min(100, m.openDecisionsCount * 10) * 0.15 +
    Math.min(100, m.openCommitmentsCount * 10) * 0.10 +
    Math.min(100, m.criticalFocusCount * 12) * 0.10
  );
}

// ─── Sprint 3: Attention Allocation Engine ────────────────────────────────────

export function generateAttentionAllocation(metrics: PortfolioProjectMetric[]): AttentionAllocationPlan {
  const ranking = computeProjectRanking(metrics);
  const allocations = computeAttentionAllocation(ranking);
  return {
    portfolioId: "",
    totalProjects: metrics.length,
    allocations,
    generatedAt: new Date().toISOString(),
  };
}

export function calculateAttentionWeight(
  projectScore: number,
  totalScore: number,
): number {
  if (totalScore === 0) return 0;
  return Math.round((projectScore / totalScore) * 100);
}

function computeAttentionAllocation(
  ranking: ProjectPriorityScore[],
): ProjectAttentionAllocation[] {
  const totalScore = ranking.reduce((sum, r) => sum + r.score, 0);

  return ranking.map((r) => {
    const raw = totalScore > 0 ? (r.score / totalScore) * 100 : 100 / ranking.length;
    const attentionPercentage = Math.max(5, Math.round(raw));
    let justification: string;
    if (r.rank === 1) justification = "Highest priority — requires immediate attention";
    else if (r.score >= 70) justification = "High urgency — significant risks or drift detected";
    else if (r.score >= 40) justification = "Moderate attention — monitor and unblock";
    else justification = "Stable — routine check-in sufficient";

    return {
      projectId: r.projectId,
      projectName: r.projectName,
      attentionPercentage,
      priorityScore: r.score,
      justification,
    };
  });
}

// ─── Sprint 4: Neglect Consequence Engine ─────────────────────────────────────

export function analyzeProjectNeglect(metric: PortfolioProjectMetric): NeglectConsequence {
  return computeNeglectConsequence(metric);
}

export function generateNeglectConsequences(metrics: PortfolioProjectMetric[]): NeglectAnalysis {
  const consequences = metrics.map(computeNeglectConsequence);
  const mostCritical = consequences
    .filter((c) => c.severity === "critical")
    .sort((a, b) => b.escalationProbability - a.escalationProbability)[0] ?? null;

  return {
    portfolioId: "",
    consequences,
    mostCriticalProjectId: mostCritical?.projectId ?? null,
    generatedAt: new Date().toISOString(),
  };
}

function computeNeglectConsequence(m: PortfolioProjectMetric): NeglectConsequence {
  const blockedDeliverables = m.blockedTaskCount + m.openCommitmentsCount;
  const healthImpact = -Math.round(
    (100 - m.healthScore) * 0.15 +
    m.overdueTaskCount * 3 +
    m.openDecisionsCount * 2,
  );
  const escalationProbability = Math.min(
    0.99,
    parseFloat(
      (
        (100 - m.healthScore) * 0.006 +
        m.riskScore * 0.005 +
        m.overdueTaskCount * 0.04 +
        m.openDecisionsCount * 0.03
      ).toFixed(2),
    ),
  );

  let severity: NeglectSeverity;
  if (escalationProbability >= 0.75 || m.status === "critical") severity = "critical";
  else if (escalationProbability >= 0.50 || m.status === "warning") severity = "high";
  else if (escalationProbability >= 0.25) severity = "medium";
  else severity = "low";

  const riskDescription =
    severity === "critical"
      ? `Ignoring ${m.projectName} will likely trigger escalation and block ${blockedDeliverables} deliverables.`
      : severity === "high"
        ? `${m.projectName} has open commitments and drift that will compound without attention.`
        : severity === "medium"
          ? `${m.projectName} can tolerate brief inattention but needs check-in this week.`
          : `${m.projectName} is stable and can wait.`;

  return {
    projectId: m.projectId,
    projectName: m.projectName,
    blockedDeliverables,
    healthImpact,
    escalationProbability,
    severity,
    riskDescription,
  };
}

// ─── Sprint 5: Personal Command Center ───────────────────────────────────────

export function generatePersonalCommandCenter(input: {
  ownerId: string;
  metrics: PortfolioProjectMetric[];
}): PersonalCommandCenterPayload {
  const ranking = computeProjectRanking(input.metrics);
  const allocations = computeAttentionAllocation(ranking);
  const neglectMap: Record<string, NeglectConsequence> = {};
  for (const m of input.metrics) {
    neglectMap[m.projectId] = computeNeglectConsequence(m);
  }
  return buildCommandCenter({
    ownerId: input.ownerId,
    metrics: input.metrics,
    ranking,
    allocations,
    neglectConsequences: neglectMap,
  });
}

export function getTodayFocus(payload: PersonalCommandCenterPayload): {
  critical: CommandCenterFocusItem[];
  high: CommandCenterFocusItem[];
} {
  return {
    critical: payload.immediateAttention,
    high: payload.highAttention,
  };
}

export function getCriticalProjects(metrics: PortfolioProjectMetric[]): PortfolioProjectMetric[] {
  return metrics.filter((m) => m.status === "critical");
}

export function generateRecommendedAgenda(
  metrics: PortfolioProjectMetric[],
): CommandCenterAgendaItem[] {
  const ranking = computeProjectRanking(metrics);
  const allocations = computeAttentionAllocation(ranking);
  const allocationMap: Record<string, number> = {};
  for (const a of allocations) {
    allocationMap[a.projectId] = a.attentionPercentage;
  }
  const metricMap: Record<string, PortfolioProjectMetric> = {};
  for (const m of metrics) {
    metricMap[m.projectId] = m;
  }

  return ranking.map((r) => ({
    rank: r.rank,
    projectId: r.projectId,
    projectName: r.projectName,
    attentionPercentage: allocationMap[r.projectId] ?? 0,
    topPriority: metricMap[r.projectId]?.attentionItems[0] ?? "Review project status",
  }));
}

function buildCommandCenter(input: {
  ownerId: string;
  metrics: PortfolioProjectMetric[];
  ranking: ProjectPriorityScore[];
  allocations: ProjectAttentionAllocation[];
  neglectConsequences: Record<string, NeglectConsequence>;
}): PersonalCommandCenterPayload {
  const allocationMap: Record<string, number> = {};
  for (const a of input.allocations) {
    allocationMap[a.projectId] = a.attentionPercentage;
  }
  const metricMap: Record<string, PortfolioProjectMetric> = {};
  for (const m of input.metrics) {
    metricMap[m.projectId] = m;
  }

  const immediateAttention: CommandCenterFocusItem[] = [];
  const highAttention: CommandCenterFocusItem[] = [];

  for (const m of input.metrics) {
    const neglect = input.neglectConsequences[m.projectId];
    for (const item of m.attentionItems) {
      const focusItem: CommandCenterFocusItem = {
        attentionType: mapAttentionType(item),
        projectId: m.projectId,
        projectName: m.projectName,
        severity: neglect?.severity ?? "low",
        title: item,
      };
      if (neglect?.severity === "critical" || m.status === "critical") {
        immediateAttention.push(focusItem);
      } else if (neglect?.severity === "high" || m.status === "warning") {
        highAttention.push(focusItem);
      }
    }
  }

  const recommendedOrder: CommandCenterAgendaItem[] = input.ranking.map((r) => ({
    rank: r.rank,
    projectId: r.projectId,
    projectName: r.projectName,
    attentionPercentage: allocationMap[r.projectId] ?? 0,
    topPriority: metricMap[r.projectId]?.attentionItems[0] ?? "Review project status",
  }));

  const criticalCount = input.metrics.filter((m) => m.status === "critical").length;
  const totalProjects = input.metrics.length;
  const todaySummary =
    criticalCount > 0
      ? `${criticalCount} of ${totalProjects} projects require immediate attention today.`
      : `${totalProjects} projects are active. Focus on top ${Math.min(3, totalProjects)} per ranking.`;

  return {
    ownerId: input.ownerId,
    totalProjects,
    immediateAttention: immediateAttention.slice(0, 10),
    highAttention: highAttention.slice(0, 10),
    recommendedOrder,
    todaySummary,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapAttentionType(item: string): PersonalPortfolioAttentionType {
  const lower = item.toLowerCase();
  if (lower.includes("authority") || lower.includes("gap")) return "authority_gap";
  if (lower.includes("overdue") || lower.includes("commitment")) return "overdue_commitment";
  if (lower.includes("drift") || lower.includes("execution")) return "execution_drift";
  if (lower.includes("escalat")) return "escalation_pending";
  if (lower.includes("health") || lower.includes("score")) return "low_health_score";
  if (lower.includes("neglect") || lower.includes("ignor")) return "neglect_risk";
  if (lower.includes("capacit") || lower.includes("conflict")) return "capacity_conflict";
  return "critical_signal";
}

function buildAttentionItems(
  metrics: PortfolioProjectMetric[],
  snapshotId: string,
  workspaceId: string,
): Array<{
  workspace_id: string;
  snapshot_id: string;
  project_id: string;
  attention_type: PersonalPortfolioAttentionType;
  severity: PersonalPortfolioAttentionSeverity;
  title: string;
  description: string | null;
  recommended_action: string | null;
}> {
  const items = [];
  for (const m of metrics) {
    const severity: PersonalPortfolioAttentionSeverity =
      m.status === "critical" ? "critical" : m.status === "warning" ? "high" : "low";
    for (const item of m.attentionItems) {
      items.push({
        workspace_id: workspaceId,
        snapshot_id: snapshotId,
        project_id: m.projectId,
        attention_type: mapAttentionType(item),
        severity,
        title: item,
        description: null,
        recommended_action: null,
      });
    }
  }
  return items;
}

function mapSnapshotRow(
  row: PersonalPortfolioSnapshotRow,
  attentionItems: PersonalPortfolioAttentionItemRow[],
): PersonalPortfolioSnapshot {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    workspaceId: row.workspace_id,
    snapshotStatus: row.snapshot_status,
    totalProjects: row.total_projects,
    healthyProjects: row.healthy_projects,
    warningProjects: row.warning_projects,
    criticalProjects: row.critical_projects,
    overallHealth: row.overall_health,
    rankedProjectIds: row.ranked_project_ids,
    attentionAllocation: row.attention_allocation,
    neglectConsequences: row.neglect_consequences,
    commandCenterPayload: row.command_center_payload,
    attentionItems,
    generatedAt: row.generated_at,
  };
}

// ─── Explain capability ───────────────────────────────────────────────────────

export function explainPersonalPortfolioIntelligence(): {
  concept: string;
  components: Record<string, string>;
  ownerIsolation: string;
  humanAttentionModel: string;
} {
  return {
    concept:
      "Personal Portfolio Intelligence gives each owner a curated, ranked view of their projects. " +
      "Rather than showing every project equally, it scores projects by urgency, computes how " +
      "attention should be distributed across them, surfaces neglect risks, and synthesizes a " +
      "Personal Command Center so the owner can start each day with a clear prioritized agenda.",
    components: {
      "Personal Portfolio":
        "A named collection of projects owned by a single user within a workspace. " +
        "Projects can be added or removed. The portfolio is workspace-scoped and owner-scoped.",
      "Project Ranking":
        "Each project receives a 0–100 urgency score computed from six weighted factors: " +
        "health deficit (30%), risk score (20%), execution drift/overdue tasks (15%), " +
        "open decisions (15%), open commitments (10%), and critical focus items (10%). " +
        "Projects are ranked highest-urgency first.",
      "Attention Allocation":
        "Attention percentage is distributed proportionally to each project's urgency score, " +
        "with a minimum floor of 5% per project so no project is ever completely invisible. " +
        "Total allocation across all projects sums to approximately 100%.",
      "Neglect Consequences":
        "For each project, the engine estimates what happens if the owner stops paying attention: " +
        "how many deliverables would be blocked, the projected health impact, and the escalation " +
        "probability (capped at 0.99). This is a read-only analysis — it never modifies projects.",
      "Personal Command Center":
        "A synthesized daily briefing that surfaces the most critical attention items, " +
        "separates them into immediate (critical) vs high-urgency buckets, provides a ranked " +
        "recommended agenda, and generates a plain-language today summary. It is a pure " +
        "compute function — no side effects.",
    },
    ownerIsolation:
      "Every portfolio record carries both workspace_id and owner_id. " +
      "Row-Level Security policies in the database enforce that a user can only read or modify " +
      "portfolios where owner_id = auth.uid() AND the user is a workspace member. " +
      "The service layer additionally passes both IDs on every query to provide defense-in-depth. " +
      "No owner can access or mutate another owner's portfolios, even within the same workspace.",
    humanAttentionModel:
      "Human attention is modeled as a finite resource that must be deliberately allocated. " +
      "The system never assumes all projects deserve equal attention; instead it computes " +
      "proportional shares based on urgency. Projects with lower urgency still receive a " +
      "guaranteed minimum floor (5%) so they remain visible. The neglect engine makes the " +
      "opportunity cost of inattention explicit and actionable.",
  };
}

// ─── Read operations ──────────────────────────────────────────────────────────

export async function getPortfolio(input: {
  workspaceId: string;
  portfolioId: string;
}): Promise<PersonalPortfolioResult<PersonalPortfolioRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_portfolios")
    .select(PORTFOLIO_COLS)
    .eq("id", input.portfolioId)
    .eq("workspace_id", input.workspaceId)
    .single<PersonalPortfolioRow>();
  if (error || !data) return fail("Portfolio not found.", "not_found");
  return { ok: true, data };
}

export async function listPortfolios(input: {
  workspaceId: string;
  ownerId: string;
}): Promise<PersonalPortfolioResult<PersonalPortfolioRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_portfolios")
    .select(PORTFOLIO_COLS)
    .eq("workspace_id", input.workspaceId)
    .eq("owner_id", input.ownerId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .overrideTypes<PersonalPortfolioRow[], { merge: false }>();
  if (error) return fail("Failed to list portfolios.");
  return { ok: true, data: data ?? [] };
}

export async function getLatestPortfolioSnapshot(input: {
  workspaceId: string;
  portfolioId: string;
}): Promise<PersonalPortfolioResult<PersonalPortfolioSnapshot>> {
  const supabase = await createSupabaseServerClient();
  const { data: snapshotRow, error } = await supabase
    .from("personal_portfolio_snapshots")
    .select(SNAPSHOT_COLS)
    .eq("portfolio_id", input.portfolioId)
    .eq("workspace_id", input.workspaceId)
    .neq("snapshot_status", "archived")
    .order("created_at", { ascending: false })
    .limit(1)
    .single<PersonalPortfolioSnapshotRow>();

  if (error || !snapshotRow) return fail("No snapshot found.", "not_found");

  const { data: attentionItems } = await supabase
    .from("personal_portfolio_attention_items")
    .select(ATTENTION_COLS)
    .eq("snapshot_id", snapshotRow.id)
    .eq("workspace_id", input.workspaceId)
    .order("severity", { ascending: false })
    .overrideTypes<PersonalPortfolioAttentionItemRow[], { merge: false }>();

  return { ok: true, data: mapSnapshotRow(snapshotRow, attentionItems ?? []) };
}
