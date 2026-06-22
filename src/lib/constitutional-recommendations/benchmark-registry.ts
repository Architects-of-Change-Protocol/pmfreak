// ─────────────────────────────────────────────────────────────────────────────
// Recommendation Benchmark & Ranking Registry — Sprint 5
// Workspace-level aggregation for comparative analysis.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CONSTITUTIONAL_RECOMMENDATION_SELECTABLE_COLUMNS,
  CONSTITUTIONAL_RECOMMENDATION_EFFECTIVENESS_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import { benchmarkRecommendations } from "./benchmark-engine";
import { rankRecommendations } from "./ranking-engine";
import type {
  ConstitutionalRecommendationRow,
  ConstitutionalRecommendationEffectivenessRow,
  ConstitutionalRecommendationEventType,
  RecommendationResult,
  RecommendationBenchmark,
  RecommendationRankEntry,
} from "./types";

const recColumns = CONSTITUTIONAL_RECOMMENDATION_SELECTABLE_COLUMNS.join(",");
const effectivenessColumns = CONSTITUTIONAL_RECOMMENDATION_EFFECTIVENESS_SELECTABLE_COLUMNS.join(",");

function validUuid(value: string | null | undefined): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value)
  );
}

function validation<T>(error: string): RecommendationResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

function failed<T>(
  error: string,
  failureClass: Extract<RecommendationResult<never>, { ok: false }>["failureClass"] = "persistence_failed",
): RecommendationResult<T> {
  return { ok: false, error, failureClass };
}

async function emitEvent(
  workspaceId: string,
  actorId: string,
  eventType: ConstitutionalRecommendationEventType,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  return createPlatformEvent({
    workspaceId,
    actorId,
    actorType: "user",
    eventType,
    eventCategory: "governance",
    source: "user_action",
    correlationId: workspaceId,
    causationId: null,
    learningEligible: true,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: payload,
  });
}

// ─── benchmarkRecommendationsForWorkspace ─────────────────────────────────────

export async function benchmarkRecommendationsForWorkspace(
  workspaceId: string,
  actorId: string,
): Promise<RecommendationResult<RecommendationBenchmark[]>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(actorId))     return validation("actorId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  const { data: recs, error: recsError } = await supabase
    .from("constitutional_recommendations")
    .select(recColumns)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);

  if (recsError) return failed("Unable to fetch recommendations.");

  const typedRecs = (recs ?? []) as unknown as ConstitutionalRecommendationRow[];

  const { data: effectivenessRows } = await supabase
    .from("constitutional_recommendation_effectiveness")
    .select(effectivenessColumns)
    .eq("workspace_id", workspaceId);

  const typedEffectiveness = (effectivenessRows ?? []) as unknown as ConstitutionalRecommendationEffectivenessRow[];
  const effectivenessById = new Map(typedEffectiveness.map((e) => [e.recommendation_id, e]));

  const entries = typedRecs.map((r) => {
    const e = effectivenessById.get(r.id);
    return {
      recommendationId: r.id,
      recommendationKey: r.recommendation_key,
      title: r.title,
      averageEffectiveness: e?.average_effectiveness ?? 0,
      applicationsCount: e?.applications_count ?? 0,
      confidenceScore: r.confidence_score,
    };
  });

  const benchmark = benchmarkRecommendations(entries);

  const emitted = await emitEvent(
    workspaceId,
    actorId,
    "CONSTITUTIONAL_RECOMMENDATION_BENCHMARK_GENERATED",
    { workspaceId, count: benchmark.length },
  );
  if (!emitted.ok) {
    return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };
  }

  return { ok: true, data: benchmark };
}

// ─── rankRecommendationsForWorkspace ─────────────────────────────────────────

export async function rankRecommendationsForWorkspace(
  workspaceId: string,
  actorId: string,
): Promise<RecommendationResult<RecommendationRankEntry[]>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(actorId))     return validation("actorId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  const { data: recs, error: recsError } = await supabase
    .from("constitutional_recommendations")
    .select(recColumns)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);

  if (recsError) return failed("Unable to fetch recommendations.");

  const typedRecs = (recs ?? []) as unknown as ConstitutionalRecommendationRow[];

  const { data: effectivenessRows } = await supabase
    .from("constitutional_recommendation_effectiveness")
    .select(effectivenessColumns)
    .eq("workspace_id", workspaceId);

  const typedEffectiveness = (effectivenessRows ?? []) as unknown as ConstitutionalRecommendationEffectivenessRow[];
  const effectivenessById = new Map(typedEffectiveness.map((e) => [e.recommendation_id, e]));

  const entries = typedRecs.map((r) => {
    const e = effectivenessById.get(r.id);
    const total = (e?.successful_count ?? 0) + (e?.failed_count ?? 0) + (e?.neutral_count ?? 0);
    const successRate = total > 0 ? (e?.successful_count ?? 0) / total : 0;
    return {
      recommendationId: r.id,
      recommendationKey: r.recommendation_key,
      title: r.title,
      averageEffectiveness: e?.average_effectiveness ?? 0,
      confidenceScore: r.confidence_score,
      applicationsCount: e?.applications_count ?? 0,
      successRate,
    };
  });

  const ranking = rankRecommendations(entries);

  const emitted = await emitEvent(
    workspaceId,
    actorId,
    "CONSTITUTIONAL_RECOMMENDATION_RANKING_GENERATED",
    { workspaceId, count: ranking.length },
  );
  if (!emitted.ok) {
    return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };
  }

  return { ok: true, data: ranking };
}
