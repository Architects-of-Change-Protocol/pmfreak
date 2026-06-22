// ─────────────────────────────────────────────────────────────────────────────
// Signal Lineage
//
// Reconstructs the full institutional lineage chain for a governance signal:
//
//   Artifact → Memory → Digest → Learning Pattern → Recommendation → Signal
//
// Each layer is traced from the signal's linked recommendations back through
// the constitutional learning substrate.
// ─────────────────────────────────────────────────────────────────────────────

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GovernanceSignalResult, SignalLineage, GovernanceSignalType } from "./types";
import { dbFindGovernanceSignalById, dbListSignalRecommendations } from "./governance-signal-repository";

function validUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function getSignalLineage(
  signalId: string,
  workspaceId: string
): Promise<GovernanceSignalResult<SignalLineage>> {
  if (!validUuid(signalId)) {
    return { ok: false, error: "signalId must be a UUID.", failureClass: "validation_failed" };
  }
  if (!validUuid(workspaceId)) {
    return { ok: false, error: "workspaceId must be a UUID.", failureClass: "validation_failed" };
  }

  const signalResult = await dbFindGovernanceSignalById(signalId, workspaceId);
  if (!signalResult.ok) return signalResult;
  const signal = signalResult.data;

  const chain: SignalLineage["chain"] = [];

  // ─── Layer 6: Signal ──────────────────────────────────────────────────────

  chain.push({
    layer: "signal",
    entityType: "governance_signals",
    entityId: signal.id,
    label: signal.title,
  });

  // ─── Layer 5: Recommendation ──────────────────────────────────────────────

  const recResult = await dbListSignalRecommendations(signalId, workspaceId);
  const topRecommendationId = recResult.ok && recResult.data.length > 0
    ? recResult.data[0].recommendation_id
    : null;

  chain.push({
    layer: "recommendation",
    entityType: "constitutional_recommendations",
    entityId: topRecommendationId,
    label: topRecommendationId
      ? "Constitutional Recommendation"
      : "No recommendation linked",
  });

  // ─── Layer 4: Learning Pattern ────────────────────────────────────────────

  let learnedPatternId: string | null = null;

  if (topRecommendationId) {
    const supabase = await createSupabaseServerClient();
    const { data: rec } = await supabase
      .from("constitutional_recommendations")
      .select("id,workspace_id,recommendation_key,learning_pattern_id")
      .eq("id", topRecommendationId)
      .eq("workspace_id", workspaceId)
      .single();

    learnedPatternId = (rec as { learning_pattern_id?: string } | null)?.learning_pattern_id ?? null;

    chain.push({
      layer: "learning_pattern",
      entityType: "vault_learned_patterns",
      entityId: learnedPatternId,
      label: learnedPatternId ? "Vault Learned Pattern" : "No learning pattern linked",
    });
  } else {
    chain.push({
      layer: "learning_pattern",
      entityType: "vault_learned_patterns",
      entityId: null,
      label: "No learning pattern available",
    });
  }

  // ─── Layer 3: Digest ──────────────────────────────────────────────────────

  let digestId: string | null = null;

  if (learnedPatternId) {
    const supabase = await createSupabaseServerClient();
    const { data: pattern } = await supabase
      .from("vault_learned_patterns")
      .select("id,workspace_id,digest_id")
      .eq("id", learnedPatternId)
      .eq("workspace_id", workspaceId)
      .single();

    digestId = (pattern as { digest_id?: string } | null)?.digest_id ?? null;
  }

  chain.push({
    layer: "digest",
    entityType: "constitutional_digests",
    entityId: digestId,
    label: digestId ? "Constitutional Digest" : "No digest available",
  });

  // ─── Layer 2: Memory ──────────────────────────────────────────────────────

  let memoryId: string | null = null;

  if (digestId) {
    const supabase = await createSupabaseServerClient();
    const { data: digest } = await supabase
      .from("constitutional_digests")
      .select("id,workspace_id,memory_record_id")
      .eq("id", digestId)
      .eq("workspace_id", workspaceId)
      .single();

    memoryId = (digest as { memory_record_id?: string } | null)?.memory_record_id ?? null;
  }

  chain.push({
    layer: "memory",
    entityType: "constitutional_memory_records",
    entityId: memoryId,
    label: memoryId ? "Constitutional Memory Record" : "No memory record available",
  });

  // ─── Layer 1: Artifact ────────────────────────────────────────────────────

  let artifactId: string | null = null;

  if (memoryId) {
    const supabase = await createSupabaseServerClient();
    const { data: memory } = await supabase
      .from("constitutional_memory_records")
      .select("id,workspace_id,artifact_id")
      .eq("id", memoryId)
      .eq("workspace_id", workspaceId)
      .single();

    artifactId = (memory as { artifact_id?: string } | null)?.artifact_id ?? null;
  }

  chain.push({
    layer: "artifact",
    entityType: "constitutional_artifacts",
    entityId: artifactId,
    label: artifactId ? "Constitutional Artifact" : "No artifact available",
  });

  // Return in lineage order: artifact → signal (reverse the chain)
  chain.reverse();

  return {
    ok: true,
    data: {
      signalId: signal.id,
      signalType: signal.signal_type as GovernanceSignalType,
      chain,
    },
  };
}
