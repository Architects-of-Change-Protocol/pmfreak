// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Intelligence Service
//
// Explains what the system knows using only evidence-backed records.
// No AI. No ML. No embeddings. No scoring. No ranking. No prediction.
// Every conclusion is traceable to explicit records.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assembleConstitutionalKnowledge } from "./knowledge-assembler";
import { resolveByExplicitIds } from "./source-resolver";
import type {
  ConstitutionalCoverageMetrics,
  ConstitutionalContradiction,
  ConstitutionalIntelligenceResult,
  ConstitutionalIntelligenceSnapshot,
  ConstitutionalKnowledgeExplanation,
  ConstitutionalKnowledgeExport,
  ConstitutionalKnowledgeHealth,
  ContradictionSourceType,
  DomainKnowledgeEntry,
  KnowledgeDomain,
} from "./types";
import { ALL_KNOWLEDGE_DOMAINS } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function failed<T>(error: string, failureClass = "query_failed"): ConstitutionalIntelligenceResult<T> {
  return { ok: false, error, failureClass };
}

async function emitIntelligenceEvent(
  workspaceId: string,
  actorId: string | null,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  await createPlatformEvent({
    workspaceId,
    actorId,
    actorType: actorId ? "user" : "system",
    eventType,
    eventCategory: "governance",
    source: actorId ? "user_action" : "system",
    correlationId: null,
    causationId: null,
    rawReferenceTable: null,
    rawReferenceId: null,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: payload,
  });
}

// ─── getConstitutionalIntelligence ────────────────────────────────────────────

export async function getConstitutionalIntelligence(
  workspaceId: string,
  pmUserId: string,
  actorId: string | null = null
): Promise<ConstitutionalIntelligenceResult<ConstitutionalIntelligenceSnapshot>> {
  if (!validUuid(workspaceId)) return failed("workspaceId must be a UUID.", "validation_failed");
  if (!validUuid(pmUserId))    return failed("pmUserId must be a UUID.", "validation_failed");

  const snapshot = await assembleConstitutionalKnowledge(workspaceId, pmUserId);

  await emitIntelligenceEvent(workspaceId, actorId, "CONSTITUTIONAL_INTELLIGENCE_ACCESSED", {
    pmUserId,
    evidenceCount: snapshot.evidenceCount,
    contradictionCount: snapshot.contradictions.length,
  });

  return { ok: true, data: snapshot };
}

// ─── getKnowledgeDomain ───────────────────────────────────────────────────────

export async function getKnowledgeDomain(
  workspaceId: string,
  pmUserId: string,
  domain: KnowledgeDomain
): Promise<ConstitutionalIntelligenceResult<DomainKnowledgeEntry>> {
  if (!validUuid(workspaceId)) return failed("workspaceId must be a UUID.", "validation_failed");
  if (!validUuid(pmUserId))    return failed("pmUserId must be a UUID.", "validation_failed");
  if (!ALL_KNOWLEDGE_DOMAINS.includes(domain)) return failed(`Unknown domain: ${domain}`, "validation_failed");

  const snapshot = await assembleConstitutionalKnowledge(workspaceId, pmUserId);
  const entry = snapshot.knowledgeDomains.find((d) => d.domain === domain);
  if (!entry) return failed(`Domain ${domain} not found in snapshot.`, "not_found");

  return { ok: true, data: entry };
}

// ─── getRelevantMemories ──────────────────────────────────────────────────────

export async function getRelevantMemories(
  workspaceId: string,
  pmUserId: string,
  options?: { domain?: KnowledgeDomain }
): Promise<ConstitutionalIntelligenceResult<{
  organizationalMemory: Record<string, unknown>[];
  personalMemory: Record<string, unknown>[];
}>> {
  if (!validUuid(workspaceId)) return failed("workspaceId must be a UUID.", "validation_failed");
  if (!validUuid(pmUserId))    return failed("pmUserId must be a UUID.", "validation_failed");

  const snapshot = await assembleConstitutionalKnowledge(workspaceId, pmUserId);

  if (!options?.domain) {
    return { ok: true, data: {
      organizationalMemory: snapshot.organizationalMemory,
      personalMemory:       snapshot.personalMemory,
    }};
  }

  const entry = snapshot.knowledgeDomains.find((d) => d.domain === options.domain);
  if (!entry) return { ok: true, data: { organizationalMemory: [], personalMemory: [] } };

  const orgIds = new Set(entry.organizationalMemoryIds);
  const perIds = new Set(entry.personalMemoryIds);

  return { ok: true, data: {
    organizationalMemory: snapshot.organizationalMemory.filter((r) => orgIds.has(r["id"] as string)),
    personalMemory:       snapshot.personalMemory.filter((r) => perIds.has(r["id"] as string)),
  }};
}

// ─── getRelevantPatterns ──────────────────────────────────────────────────────

export async function getRelevantPatterns(
  workspaceId: string,
  pmUserId: string,
  options?: { domain?: KnowledgeDomain }
): Promise<ConstitutionalIntelligenceResult<{
  organizationalPatterns: Record<string, unknown>[];
  patternCandidates: Record<string, unknown>[];
  personalPatterns: Record<string, unknown>[];
  personalPatternCandidates: Record<string, unknown>[];
}>> {
  if (!validUuid(workspaceId)) return failed("workspaceId must be a UUID.", "validation_failed");
  if (!validUuid(pmUserId))    return failed("pmUserId must be a UUID.", "validation_failed");

  const snapshot = await assembleConstitutionalKnowledge(workspaceId, pmUserId);

  if (!options?.domain) {
    return { ok: true, data: {
      organizationalPatterns:    snapshot.organizationalPatterns,
      patternCandidates:         snapshot.patternCandidates,
      personalPatterns:          snapshot.personalPatterns,
      personalPatternCandidates: snapshot.personalPatternCandidates,
    }};
  }

  const entry = snapshot.knowledgeDomains.find((d) => d.domain === options.domain);
  if (!entry) return { ok: true, data: {
    organizationalPatterns: [], patternCandidates: [], personalPatterns: [], personalPatternCandidates: [],
  }};

  const orgIds  = new Set(entry.organizationalPatternIds);
  const candIds = new Set(entry.patternCandidateIds);
  const perIds  = new Set(entry.personalPatternIds);
  const perCandIds = new Set(entry.personalPatternCandidateIds);

  return { ok: true, data: {
    organizationalPatterns:    snapshot.organizationalPatterns.filter((r) => orgIds.has(r["id"] as string)),
    patternCandidates:         snapshot.patternCandidates.filter((r) => candIds.has(r["id"] as string)),
    personalPatterns:          snapshot.personalPatterns.filter((r) => perIds.has(r["id"] as string)),
    personalPatternCandidates: snapshot.personalPatternCandidates.filter((r) => perCandIds.has(r["id"] as string)),
  }};
}

// ─── getRelevantEffectivenessRecords ─────────────────────────────────────────

export async function getRelevantEffectivenessRecords(
  workspaceId: string,
  pmUserId: string,
  options?: { domain?: KnowledgeDomain }
): Promise<ConstitutionalIntelligenceResult<{
  decisionEffectiveness: Record<string, unknown>[];
  personalEffectiveness: Record<string, unknown>[];
}>> {
  if (!validUuid(workspaceId)) return failed("workspaceId must be a UUID.", "validation_failed");
  if (!validUuid(pmUserId))    return failed("pmUserId must be a UUID.", "validation_failed");

  const snapshot = await assembleConstitutionalKnowledge(workspaceId, pmUserId);

  if (!options?.domain) {
    return { ok: true, data: {
      decisionEffectiveness: snapshot.decisionEffectiveness,
      personalEffectiveness: snapshot.personalEffectiveness,
    }};
  }

  const entry = snapshot.knowledgeDomains.find((d) => d.domain === options.domain);
  if (!entry) return { ok: true, data: { decisionEffectiveness: [], personalEffectiveness: [] } };

  const decIds = new Set(entry.decisionEffectivenessIds);
  const perIds = new Set(entry.personalEffectivenessIds);

  return { ok: true, data: {
    decisionEffectiveness: snapshot.decisionEffectiveness.filter((r) => decIds.has(r["id"] as string)),
    personalEffectiveness: snapshot.personalEffectiveness.filter((r) => perIds.has(r["id"] as string)),
  }};
}

// ─── getRelevantBridgeRelationships ──────────────────────────────────────────

export async function getRelevantBridgeRelationships(
  workspaceId: string,
  pmUserId: string,
  options?: { domain?: KnowledgeDomain }
): Promise<ConstitutionalIntelligenceResult<Record<string, unknown>[]>> {
  if (!validUuid(workspaceId)) return failed("workspaceId must be a UUID.", "validation_failed");
  if (!validUuid(pmUserId))    return failed("pmUserId must be a UUID.", "validation_failed");

  const snapshot = await assembleConstitutionalKnowledge(workspaceId, pmUserId);

  if (!options?.domain) return { ok: true, data: snapshot.bridgeRelationships };

  const entry = snapshot.knowledgeDomains.find((d) => d.domain === options.domain);
  if (!entry) return { ok: true, data: [] };

  const ids = new Set(entry.bridgeRelationshipIds);
  return { ok: true, data: snapshot.bridgeRelationships.filter((r) => ids.has(r["id"] as string)) };
}

// ─── explainKnowledge ────────────────────────────────────────────────────────

export async function explainKnowledge(
  workspaceId: string,
  pmUserId: string,
  sourceType: ContradictionSourceType,
  sourceId: string,
  actorId: string | null = null
): Promise<ConstitutionalIntelligenceResult<ConstitutionalKnowledgeExplanation>> {
  if (!validUuid(workspaceId)) return failed("workspaceId must be a UUID.", "validation_failed");
  if (!validUuid(pmUserId))    return failed("pmUserId must be a UUID.", "validation_failed");
  if (!validUuid(sourceId))    return failed("sourceId must be a UUID.", "validation_failed");

  const snapshot = await assembleConstitutionalKnowledge(workspaceId, pmUserId);

  // Find the target record from the snapshot
  const allRecords: Record<string, unknown>[] = [
    ...snapshot.organizationalMemory,
    ...snapshot.organizationalPatterns,
    ...snapshot.decisionEffectiveness,
    ...snapshot.patternCandidates,
    ...snapshot.personalMemory,
    ...snapshot.personalPatterns,
    ...snapshot.personalEffectiveness,
    ...snapshot.personalPatternCandidates,
    ...snapshot.bridgeRelationships,
  ];

  const knowledge = allRecords.find((r) => r["id"] === sourceId);
  if (!knowledge) return failed("Record not found.", "not_found");

  // Find contradictions involving this record
  const contradictions = snapshot.contradictions.filter(
    (c) => c.sourceAId === sourceId || c.sourceBId === sourceId
  );

  // Find bridge relationships involving this record
  const relatedBridges = snapshot.bridgeRelationships.filter(
    (b) => b["personal_source_id"] === sourceId || b["organizational_source_id"] === sourceId
  );

  // Resolve lineage: gather the other side of each bridge
  const bridgeSources = relatedBridges.flatMap((b) => [
    { sourceType: b["personal_source_type"] as string,       sourceId: b["personal_source_id"] as string },
    { sourceType: b["organizational_source_type"] as string, sourceId: b["organizational_source_id"] as string },
  ]).filter((s) => s.sourceId !== sourceId);

  const supportingEvidence = await resolveByExplicitIds(bridgeSources);

  const lineage = relatedBridges.map((b) => ({
    recordType: "bridge_relationship",
    recordId:   b["id"] as string,
    relationship: b["relationship_type"] as string,
    resolvedAt: b["updated_at"] as string ?? b["created_at"] as string,
  }));

  const sources = relatedBridges.map((b) => ({
    sourceType: b["personal_source_type"] as string,
    sourceId:   b["personal_source_id"] as string,
    relationshipType: b["relationship_type"] as string,
  }));

  await emitIntelligenceEvent(workspaceId, actorId, "CONSTITUTIONAL_KNOWLEDGE_EXPLAINED", {
    pmUserId,
    sourceType,
    sourceId,
    contradictionCount: contradictions.length,
    supportingEvidenceCount: supportingEvidence.length,
  });

  return { ok: true, data: {
    knowledge,
    sourceType,
    sourceId,
    sources,
    lineage,
    supportingEvidence,
    contradictions,
  }};
}

// ─── exportConstitutionalKnowledge ───────────────────────────────────────────

export async function exportConstitutionalKnowledge(
  workspaceId: string,
  pmUserId: string,
  actorId: string | null = null
): Promise<ConstitutionalIntelligenceResult<ConstitutionalKnowledgeExport>> {
  if (!validUuid(workspaceId)) return failed("workspaceId must be a UUID.", "validation_failed");
  if (!validUuid(pmUserId))    return failed("pmUserId must be a UUID.", "validation_failed");

  const snapshot = await assembleConstitutionalKnowledge(workspaceId, pmUserId);

  await emitIntelligenceEvent(workspaceId, actorId, "CONSTITUTIONAL_KNOWLEDGE_EXPORTED", {
    pmUserId,
    evidenceCount: snapshot.evidenceCount,
    contradictionCount: snapshot.contradictions.length,
  });

  return { ok: true, data: {
    snapshot,
    exportedAt: new Date().toISOString(),
    format: "json",
  }};
}

// ─── getConstitutionalKnowledgeHealth ────────────────────────────────────────

export async function getConstitutionalKnowledgeHealth(
  workspaceId: string,
  pmUserId: string
): Promise<ConstitutionalIntelligenceResult<ConstitutionalKnowledgeHealth>> {
  if (!validUuid(workspaceId)) return failed("workspaceId must be a UUID.", "validation_failed");
  if (!validUuid(pmUserId))    return failed("pmUserId must be a UUID.", "validation_failed");

  const snapshot = await assembleConstitutionalKnowledge(workspaceId, pmUserId);

  const memoryCount       = snapshot.organizationalMemory.length + snapshot.personalMemory.length;
  const patternCount      = snapshot.organizationalPatterns.length + snapshot.personalPatterns.length;
  const effectivenessCount = snapshot.decisionEffectiveness.length + snapshot.personalEffectiveness.length;
  const bridgeCount       = snapshot.bridgeRelationships.length;
  const candidateCount    = snapshot.patternCandidates.length + snapshot.personalPatternCandidates.length;
  const contradictionCount = snapshot.contradictions.length;
  const evidenceCount     = snapshot.evidenceCount;

  const totalRecordsPerDomain = snapshot.knowledgeDomains.reduce(
    (acc, d) => acc + d.evidenceCount, 0
  );

  const domainCoverage = Object.fromEntries(
    snapshot.knowledgeDomains.map((d) => [d.domain, d.evidenceCount])
  ) as Record<KnowledgeDomain, number>;

  const divisor = Math.max(1, evidenceCount);

  const coverageMetrics: ConstitutionalCoverageMetrics = {
    domainCoverage,
    organizationalMemoryCoverage:    snapshot.organizationalMemory.length / divisor,
    organizationalPatternCoverage:   snapshot.organizationalPatterns.length / divisor,
    decisionEffectivenessCoverage:   snapshot.decisionEffectiveness.length / divisor,
    patternCandidateCoverage:        snapshot.patternCandidates.length / divisor,
    personalMemoryCoverage:          snapshot.personalMemory.length / divisor,
    personalPatternCoverage:         snapshot.personalPatterns.length / divisor,
    personalEffectivenessCoverage:   snapshot.personalEffectiveness.length / divisor,
    personalPatternCandidateCoverage: snapshot.personalPatternCandidates.length / divisor,
    bridgeRelationshipCoverage:      bridgeCount / divisor,
  };

  return { ok: true, data: {
    memoryCount,
    patternCount,
    effectivenessCount,
    bridgeCount,
    candidateCount,
    contradictionCount,
    evidenceCount,
    coverageMetrics,
  }};
}
