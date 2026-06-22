// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Learning — Learning Registry
// Core lifecycle: createLearningPattern, aggregateDigests, discoverLearningPatterns,
// calculatePatternConfidence, generateRecommendation, getLearningLineage.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CONSTITUTIONAL_LEARNING_EVIDENCE_SELECTABLE_COLUMNS,
  CONSTITUTIONAL_LEARNING_PATTERN_SELECTABLE_COLUMNS,
  CONSTITUTIONAL_LEARNING_RECOMMENDATION_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import { aggregateDigests, buildPatternDescription } from "./aggregation-engine";
import { calculateLearningConfidence } from "./confidence-engine";
import { discoverCorrelations } from "./correlation-engine";
import { generateRecommendation } from "./recommendation-engine";
import type {
  AggregateDigestsInput,
  ConstitutionalLearningEventType,
  ConstitutionalLearningPatternRow,
  ConstitutionalLearningRecommendationRow,
  CreateLearningPatternInput,
  DiscoveryResult,
  GenerateRecommendationsInput,
  GetLearningLineageInput,
  GetLearningPatternInput,
  LearningConfidenceBreakdown,
  LearningLineage,
  LearningResult,
  ListLearningPatternsInput,
  PatternCorrelation,
} from "./types";

const patternColumns = CONSTITUTIONAL_LEARNING_PATTERN_SELECTABLE_COLUMNS.join(",");
const evidenceColumns = CONSTITUTIONAL_LEARNING_EVIDENCE_SELECTABLE_COLUMNS.join(",");
const recommendationColumns = CONSTITUTIONAL_LEARNING_RECOMMENDATION_SELECTABLE_COLUMNS.join(",");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}

function validation<T>(error: string): LearningResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

function failed<T>(
  error: string,
  failureClass: Extract<LearningResult<never>, { ok: false }>["failureClass"] = "persistence_failed",
): LearningResult<T> {
  return { ok: false, error, failureClass };
}

async function emitLearningEvent(
  workspaceId: string,
  actorId: string,
  patternId: string,
  eventType: ConstitutionalLearningEventType,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  return createPlatformEvent({
    workspaceId,
    actorId,
    actorType: "user",
    eventType,
    eventCategory: "governance",
    source: "user_action",
    correlationId: patternId,
    causationId: null,
    rawReferenceTable: "constitutional_learning_patterns",
    rawReferenceId: patternId,
    learningEligible: true,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: payload,
  });
}

// ─── createLearningPattern ────────────────────────────────────────────────────

export async function createLearningPattern(
  input: CreateLearningPatternInput,
): Promise<LearningResult<ConstitutionalLearningPatternRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");
  if (!input.patternType) return validation("patternType is required.");
  if (!input.patternKey?.trim()) return validation("patternKey is required.");
  if (!input.description?.trim()) return validation("description is required.");

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("constitutional_learning_patterns")
    .insert({
      workspace_id: input.workspaceId,
      pattern_type: input.patternType,
      pattern_key: input.patternKey.trim(),
      description: input.description.trim(),
      confidence_score: input.initialConfidence ?? 0.0,
      occurrence_count: 1,
    })
    .select(patternColumns)
    .single<ConstitutionalLearningPatternRow>();

  if (error || !data) {
    if (error?.code === "23505") {
      return failed("A learning pattern with this type and key already exists.", "governance_violation");
    }
    return failed("Unable to create learning pattern.");
  }

  const emitted = await emitLearningEvent(
    input.workspaceId,
    input.actorId,
    data.id,
    "CONSTITUTIONAL_LEARNING_PATTERN_CREATED",
    { patternId: data.id, patternType: data.pattern_type, patternKey: data.pattern_key },
  );
  if (!emitted.ok) return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };

  return { ok: true, data };
}

// ─── getLearningPattern ───────────────────────────────────────────────────────

export async function getLearningPattern(
  input: GetLearningPatternInput,
): Promise<LearningResult<ConstitutionalLearningPatternRow>> {
  if (!validUuid(input.patternId)) return validation("patternId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_learning_patterns")
    .select(patternColumns)
    .eq("id", input.patternId)
    .eq("workspace_id", input.workspaceId)
    .single<ConstitutionalLearningPatternRow>();

  if (error || !data) return failed("Learning pattern not found.", "not_found");
  return { ok: true, data };
}

// ─── listLearningPatterns ─────────────────────────────────────────────────────

export async function listLearningPatterns(
  input: ListLearningPatternsInput,
): Promise<LearningResult<ConstitutionalLearningPatternRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("constitutional_learning_patterns")
    .select(patternColumns)
    .eq("workspace_id", input.workspaceId)
    .order("occurrence_count", { ascending: false });

  if (input.patternType) query = query.eq("pattern_type", input.patternType);
  if (input.minConfidence !== undefined) query = query.gte("confidence_score", input.minConfidence);
  if (input.minOccurrences !== undefined) query = query.gte("occurrence_count", input.minOccurrences);

  const { data, error } = await query;
  if (error) return failed("Unable to list learning patterns.");
  return { ok: true, data: (data ?? []) as unknown as ConstitutionalLearningPatternRow[] };
}

// ─── aggregateDigests ─────────────────────────────────────────────────────────
// Reads published digests, detects recurrence, groups patterns.
// Sovereignty Rule 2: All learning originates from Digests.
// Sovereignty Rule 3: No direct learning from Memory.

export async function aggregateDigestsForLearning(
  input: AggregateDigestsInput,
): Promise<LearningResult<DiscoveryResult>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("constitutional_digests")
    .select("id,workspace_id,digest_payload,confidence_score,digest_status")
    .eq("workspace_id", input.workspaceId)
    .eq("digest_status", "published")
    .is("deleted_at", null);

  if (input.digestIds?.length) {
    query = query.in("id", input.digestIds);
  }

  const { data: digests, error: digestError } = await query;
  if (digestError) return failed("Unable to fetch published digests.");

  const publishedDigests = (digests ?? []) as Array<{
    id: string;
    workspace_id: string;
    digest_payload: Record<string, unknown>;
    confidence_score: number | null;
    digest_status: string;
  }>;

  if (publishedDigests.length === 0) {
    return { ok: true, data: { patternsCreated: 0, patternsUpdated: 0, evidenceRecorded: 0, patterns: [] } };
  }

  const aggregated = aggregateDigests(publishedDigests.map((d) => ({
    id: d.id,
    payload: d.digest_payload as Record<string, unknown>,
    confidence_score: d.confidence_score,
  })));

  let patternsCreated = 0;
  let patternsUpdated = 0;
  let evidenceRecorded = 0;
  const resultPatterns: ConstitutionalLearningPatternRow[] = [];

  for (const agg of aggregated) {
    const description = buildPatternDescription(agg.patternType, agg.patternKey, agg.occurrences);

    // Upsert the pattern
    const { data: existing } = await supabase
      .from("constitutional_learning_patterns")
      .select(patternColumns)
      .eq("workspace_id", input.workspaceId)
      .eq("pattern_type", agg.patternType)
      .eq("pattern_key", agg.patternKey)
      .single<ConstitutionalLearningPatternRow>();

    let pattern: ConstitutionalLearningPatternRow;

    if (existing) {
      const newCount = existing.occurrence_count + agg.occurrences;
      const avgWeight = agg.contributionWeights.reduce((s, w) => s + w, 0) / agg.contributionWeights.length;

      const confidence = calculateLearningConfidence({
        occurrenceCount: newCount,
        totalDigests: publishedDigests.length,
        avgContributionWeight: avgWeight,
        patternTypeCount: 1,
      });

      const { data: updated, error: updateError } = await supabase
        .from("constitutional_learning_patterns")
        .update({
          occurrence_count: newCount,
          confidence_score: confidence.overall,
          last_seen_at: new Date().toISOString(),
          description,
        })
        .eq("id", existing.id)
        .eq("workspace_id", input.workspaceId)
        .select(patternColumns)
        .single<ConstitutionalLearningPatternRow>();

      if (updateError || !updated) return failed("Unable to update learning pattern.");
      pattern = updated;
      patternsUpdated++;

      const emitted = await emitLearningEvent(
        input.workspaceId, input.actorId, pattern.id,
        "CONSTITUTIONAL_LEARNING_PATTERN_UPDATED",
        { patternId: pattern.id, patternKey: pattern.pattern_key, newOccurrenceCount: newCount },
      );
      if (!emitted.ok) return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };
    } else {
      const avgWeight = agg.contributionWeights.reduce((s, w) => s + w, 0) / agg.contributionWeights.length;
      const confidence = calculateLearningConfidence({
        occurrenceCount: agg.occurrences,
        totalDigests: publishedDigests.length,
        avgContributionWeight: avgWeight,
        patternTypeCount: 1,
      });

      const { data: created, error: createError } = await supabase
        .from("constitutional_learning_patterns")
        .insert({
          workspace_id: input.workspaceId,
          pattern_type: agg.patternType,
          pattern_key: agg.patternKey,
          description,
          confidence_score: confidence.overall,
          occurrence_count: agg.occurrences,
        })
        .select(patternColumns)
        .single<ConstitutionalLearningPatternRow>();

      if (createError || !created) return failed("Unable to persist learning pattern.");
      pattern = created;
      patternsCreated++;

      const emitted = await emitLearningEvent(
        input.workspaceId, input.actorId, pattern.id,
        "CONSTITUTIONAL_LEARNING_PATTERN_DISCOVERED",
        { patternId: pattern.id, patternType: pattern.pattern_type, patternKey: pattern.pattern_key, occurrenceCount: agg.occurrences },
      );
      if (!emitted.ok) return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };
    }

    resultPatterns.push(pattern);

    // Record evidence links
    for (let i = 0; i < agg.digestIds.length; i++) {
      const digestId = agg.digestIds[i];
      const weight = agg.contributionWeights[i] ?? 0.5;

      const { error: evidenceError } = await supabase
        .from("constitutional_learning_evidence")
        .upsert(
          {
            workspace_id: input.workspaceId,
            learning_pattern_id: pattern.id,
            digest_id: digestId,
            contribution_weight: weight,
          },
          { onConflict: "learning_pattern_id,digest_id" },
        );

      if (!evidenceError) evidenceRecorded++;
    }
  }

  return {
    ok: true,
    data: {
      patternsCreated,
      patternsUpdated,
      evidenceRecorded,
      patterns: resultPatterns,
    },
  };
}

// ─── discoverLearningPatterns ─────────────────────────────────────────────────

export async function discoverLearningPatterns(
  workspaceId: string,
  actorId: string,
): Promise<LearningResult<DiscoveryResult>> {
  return aggregateDigestsForLearning({ workspaceId, actorId });
}

// ─── calculatePatternConfidence ───────────────────────────────────────────────

export async function calculatePatternConfidence(
  patternId: string,
  workspaceId: string,
  actorId: string,
): Promise<LearningResult<LearningConfidenceBreakdown>> {
  if (!validUuid(patternId)) return validation("patternId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");

  const patternResult = await getLearningPattern({ patternId, workspaceId });
  if (!patternResult.ok) return patternResult as LearningResult<LearningConfidenceBreakdown>;
  const pattern = patternResult.data;

  const supabase = await createSupabaseServerClient();

  const { data: evidenceRows } = await supabase
    .from("constitutional_learning_evidence")
    .select(evidenceColumns)
    .eq("learning_pattern_id", patternId)
    .eq("workspace_id", workspaceId);

  type EvidenceRow = { contribution_weight: number; digest_id: string; learning_pattern_id: string };
  const evidence = (evidenceRows ?? []) as unknown as EvidenceRow[];
  const avgWeight = evidence.length > 0
    ? evidence.reduce((s, e) => s + e.contribution_weight, 0) / evidence.length
    : 0.5;

  const { count: totalDigests } = await supabase
    .from("constitutional_digests")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("digest_status", "published")
    .is("deleted_at", null);

  const { data: coPatterns } = await supabase
    .from("constitutional_learning_evidence")
    .select("learning_pattern_id")
    .in("digest_id", evidence.map((e) => e.digest_id))
    .eq("workspace_id", workspaceId)
    .neq("learning_pattern_id", patternId);

  const distinctCoPatterns = new Set(
    ((coPatterns ?? []) as unknown as Array<{ learning_pattern_id: string }>)
      .map((r) => r.learning_pattern_id),
  ).size;

  const breakdown = calculateLearningConfidence({
    occurrenceCount: pattern.occurrence_count,
    totalDigests: totalDigests ?? 1,
    avgContributionWeight: avgWeight,
    patternTypeCount: distinctCoPatterns + 1,
  });

  const { error: updateError } = await supabase
    .from("constitutional_learning_patterns")
    .update({ confidence_score: breakdown.overall })
    .eq("id", patternId)
    .eq("workspace_id", workspaceId);

  if (updateError) return failed("Unable to persist updated confidence score.");

  const emitted = await emitLearningEvent(
    workspaceId, actorId, patternId,
    "CONSTITUTIONAL_LEARNING_CONFIDENCE_CALCULATED",
    { patternId, ...breakdown },
  );
  if (!emitted.ok) return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };

  return { ok: true, data: breakdown };
}

// ─── generateRecommendations ──────────────────────────────────────────────────

export async function generateRecommendations(
  input: GenerateRecommendationsInput,
): Promise<LearningResult<ConstitutionalLearningRecommendationRow[]>> {
  if (!validUuid(input.patternId)) return validation("patternId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const patternResult = await getLearningPattern({ patternId: input.patternId, workspaceId: input.workspaceId });
  if (!patternResult.ok) return patternResult as LearningResult<ConstitutionalLearningRecommendationRow[]>;
  const pattern = patternResult.data;

  const generated = generateRecommendation(
    pattern.pattern_type,
    pattern.pattern_key,
    pattern.confidence_score,
  );

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_learning_recommendations")
    .insert({
      workspace_id: input.workspaceId,
      learning_pattern_id: input.patternId,
      recommendation: generated.recommendation,
      confidence_score: generated.confidence,
    })
    .select(recommendationColumns)
    .single<ConstitutionalLearningRecommendationRow>();

  if (error || !data) return failed("Unable to persist recommendation.");

  const emitted = await emitLearningEvent(
    input.workspaceId, input.actorId, input.patternId,
    "CONSTITUTIONAL_LEARNING_RECOMMENDATION_GENERATED",
    {
      patternId: input.patternId,
      patternKey: pattern.pattern_key,
      confidenceScore: generated.confidence,
    },
  );
  if (!emitted.ok) return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };

  return { ok: true, data: [data] };
}

// ─── discoverCorrelationsForWorkspace ─────────────────────────────────────────

export async function discoverCorrelationsForWorkspace(
  workspaceId: string,
  minFrequency = 0.1,
): Promise<LearningResult<PatternCorrelation[]>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  const { data: digests, error } = await supabase
    .from("constitutional_digests")
    .select("id,digest_payload")
    .eq("workspace_id", workspaceId)
    .eq("digest_status", "published")
    .is("deleted_at", null);

  if (error) return failed("Unable to fetch digests for correlation discovery.");

  const correlations = discoverCorrelations(
    (digests ?? []).map((d: { id: string; digest_payload: Record<string, unknown> }) => ({
      id: d.id,
      payload: d.digest_payload,
    })),
    minFrequency,
  );

  return { ok: true, data: correlations };
}

// ─── getLearningLineage ───────────────────────────────────────────────────────
// Reconstructs: Artifact → Memory → Digest → Learning Pattern
// Sovereignty Rule 4: Every pattern must be traceable.

export async function getLearningLineage(
  input: GetLearningLineageInput,
): Promise<LearningResult<LearningLineage[]>> {
  if (!validUuid(input.patternId)) return validation("patternId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");

  const patternResult = await getLearningPattern({ patternId: input.patternId, workspaceId: input.workspaceId });
  if (!patternResult.ok) return patternResult as LearningResult<LearningLineage[]>;
  const pattern = patternResult.data;

  const supabase = await createSupabaseServerClient();

  type LineageEvidenceRow = { digest_id: string };
  type LineageDigestRow = { id: string; workspace_id: string; memory_record_id: string; digest_status: string; digest_payload: Record<string, unknown>; confidence_score: number | null; created_at: string };
  type LineageMemoryRow = { id: string; workspace_id: string; artifact_id: string; memory_type: string; title: string; canonical_text: string; summary: string | null; created_at: string; created_by: string };
  type LineageArtifactRow = { id: string; workspace_id: string; artifact_type: string; title: string; storage_provider: string; storage_reference: string; checksum: string; created_at: string };

  // Get evidence: which digests contributed to this pattern
  const { data: evidenceRows } = await supabase
    .from("constitutional_learning_evidence")
    .select(evidenceColumns)
    .eq("learning_pattern_id", input.patternId)
    .eq("workspace_id", input.workspaceId);

  if (!evidenceRows || evidenceRows.length === 0) {
    return { ok: true, data: [] };
  }

  const typedEvidence = evidenceRows as unknown as LineageEvidenceRow[];
  const digestIds = typedEvidence.map((e) => e.digest_id);

  // Fetch digests
  const { data: digests } = await supabase
    .from("constitutional_digests")
    .select("id,workspace_id,memory_record_id,digest_status,digest_payload,confidence_score,created_at")
    .in("id", digestIds)
    .eq("workspace_id", input.workspaceId);

  if (!digests || digests.length === 0) {
    return failed("Digest records for lineage not found.", "not_found");
  }

  const typedDigests = digests as unknown as LineageDigestRow[];
  const memoryIds = [...new Set(typedDigests.map((d) => d.memory_record_id))];

  // Fetch memory records
  const { data: memories } = await supabase
    .from("constitutional_memory_records")
    .select("id,workspace_id,artifact_id,memory_type,title,canonical_text,summary,created_at,created_by")
    .in("id", memoryIds)
    .eq("workspace_id", input.workspaceId);

  if (!memories || memories.length === 0) {
    return failed("Memory records for lineage not found.", "not_found");
  }

  const typedMemories = memories as unknown as LineageMemoryRow[];
  const artifactIds = [...new Set(typedMemories.map((m) => m.artifact_id))];

  // Fetch artifacts
  const { data: artifacts } = await supabase
    .from("constitutional_artifacts")
    .select("id,workspace_id,artifact_type,title,storage_provider,storage_reference,checksum,created_at")
    .in("id", artifactIds)
    .eq("workspace_id", input.workspaceId);

  if (!artifacts || artifacts.length === 0) {
    return failed("Artifact records for lineage not found.", "not_found");
  }

  const typedArtifacts = artifacts as unknown as LineageArtifactRow[];

  // Build memory lookup
  const memoryById = new Map(typedMemories.map((m) => [m.id, m]));
  const artifactById = new Map(typedArtifacts.map((a) => [a.id, a]));

  const lineages: LearningLineage[] = [];

  for (const digest of typedDigests) {
    const memory = memoryById.get(digest.memory_record_id);
    if (!memory) continue;
    const artifact = artifactById.get(memory.artifact_id);
    if (!artifact) continue;

    lineages.push({
      artifact,
      memoryRecord: memory,
      digest,
      learningPattern: pattern,
    });
  }

  const emitted = await emitLearningEvent(
    input.workspaceId,
    pattern.workspace_id,
    input.patternId,
    "CONSTITUTIONAL_LEARNING_LINEAGE_GENERATED",
    { patternId: input.patternId, lineageCount: lineages.length },
  );
  if (!emitted.ok) return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };

  return { ok: true, data: lineages };
}
