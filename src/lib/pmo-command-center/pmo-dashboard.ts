import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PMO_COMMAND_CENTER_SNAPSHOT_SELECTABLE_COLUMNS,
  PMO_ATTENTION_ITEM_SELECTABLE_COLUMNS,
  PMO_RECOMMENDATION_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import type {
  PMOCommandCenterSnapshotRow,
  PMOAttentionItemRow,
  PMORecommendationRow,
} from "@/lib/db/database-contract";

import { classifyPMOStatus } from "./engines/pmo-health-engine";
import { calculatePMOTrends } from "./engines/trend-engine";

import type {
  PMOCommandCenterResult,
  PMODashboardModel,
  PMOTrend,
} from "./types";

// ─── Column selectors ─────────────────────────────────────────────────────────

const SNAPSHOT_COLS  = PMO_COMMAND_CENTER_SNAPSHOT_SELECTABLE_COLUMNS.join(",");
const ATTENTION_COLS = PMO_ATTENTION_ITEM_SELECTABLE_COLUMNS.join(",");
const RECOMMEND_COLS = PMO_RECOMMENDATION_SELECTABLE_COLUMNS.join(",");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(v: string | null | undefined): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function validation<T>(msg: string): PMOCommandCenterResult<T> {
  return { ok: false, error: msg, failureClass: "validation" };
}
function notFound<T>(resource = "Resource"): PMOCommandCenterResult<T> {
  return { ok: false, error: `${resource} not found.`, failureClass: "not_found" };
}
function persistFailed<T>(action: string): PMOCommandCenterResult<T> {
  return { ok: false, error: `Unable to ${action}.`, failureClass: "persistence_failed" };
}

// ─── generatePMODashboardModel ────────────────────────────────────────────────

export async function generatePMODashboardModel(workspaceId: string): Promise<PMOCommandCenterResult<PMODashboardModel>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();

  // Fetch latest snapshot
  const { data: snapshot, error } = await supabase
    .from("pmo_command_center_snapshots")
    .select(SNAPSHOT_COLS)
    .eq("workspace_id", workspaceId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .single<PMOCommandCenterSnapshotRow>();

  if (error || !snapshot) return notFound("PMO snapshot — generate one first using generatePMOSnapshot");

  // Fetch attention items for this snapshot
  const { data: attentionItems, error: attError } = await supabase
    .from("pmo_attention_items")
    .select(ATTENTION_COLS)
    .eq("snapshot_id", snapshot.id)
    .eq("workspace_id", workspaceId)
    .order("priority", { ascending: true })
    .returns<PMOAttentionItemRow[]>();

  if (attError) return persistFailed("fetch attention items");

  // Fetch recommendations for this snapshot
  const { data: recommendations, error: recError } = await supabase
    .from("pmo_recommendations")
    .select(RECOMMEND_COLS)
    .eq("snapshot_id", snapshot.id)
    .eq("workspace_id", workspaceId)
    .order("confidence_score", { ascending: false })
    .returns<PMORecommendationRow[]>();

  if (recError) return persistFailed("fetch recommendations");

  // Extract PM statuses from snapshot payload
  const payload = snapshot.snapshot_payload as Record<string, unknown>;
  const pmSummaries = (payload.pm_summaries as Array<{ status: string }> | undefined) ?? [];
  const overloadedPMs = pmSummaries.filter((p) => p.status === "overloaded").length;
  const warningPMs    = pmSummaries.filter((p) => p.status === "warning").length;
  const healthyPMs    = pmSummaries.filter((p) => p.status === "healthy").length;

  const attItems = attentionItems ?? [];
  const recs     = recommendations ?? [];

  const dashboard: PMODashboardModel = {
    pmo: {
      health:     snapshot.overall_health_score,
      governance: snapshot.governance_score,
      capacity:   snapshot.capacity_score,
      execution:  snapshot.execution_score,
      risk:       snapshot.risk_score,
      status:     classifyPMOStatus(snapshot.overall_health_score),
    },
    projects: {
      total:    snapshot.project_count,
      critical: snapshot.critical_projects,
      warning:  snapshot.warning_projects,
      healthy:  snapshot.healthy_projects,
    },
    pms: {
      total:     snapshot.pm_count,
      overloaded: overloadedPMs,
      warning:   warningPMs,
      healthy:   healthyPMs,
    },
    portfolios: {
      total: snapshot.portfolio_count,
    },
    attention: attItems.map((a) => ({
      priority:           a.priority,
      entityType:         a.entity_type,
      entityId:           a.entity_id,
      title:              a.title,
      description:        a.description,
      recommendedAction:  a.recommended_action,
    })),
    recommendations: recs.map((r) => ({
      type:           r.recommendation_type,
      recommendation: r.recommendation,
      confidence:     r.confidence_score,
      impact:         r.impact_score,
    })),
    hotspots: [], // Populated from snapshot payload if stored
    generatedAt: snapshot.generated_at,
  };

  return { ok: true, data: dashboard };
}

// ─── calculatePMOTrendsFromWorkspace ─────────────────────────────────────────

export async function calculatePMOTrendsFromWorkspace(
  workspaceId: string,
  limit = 10
): Promise<PMOCommandCenterResult<PMOTrend | null>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();
  const { data: snapshots, error } = await supabase
    .from("pmo_command_center_snapshots")
    .select(SNAPSHOT_COLS)
    .eq("workspace_id", workspaceId)
    .order("generated_at", { ascending: false })
    .limit(limit)
    .returns<PMOCommandCenterSnapshotRow[]>();

  if (error) return persistFailed("fetch PMO snapshots for trend calculation");

  const trend = calculatePMOTrends(snapshots ?? []);
  return { ok: true, data: trend };
}
