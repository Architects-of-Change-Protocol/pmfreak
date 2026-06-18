// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Intelligence — Knowledge Assembler
//
// Assembles a ConstitutionalIntelligenceSnapshot from existing records.
// No AI. No ML. No scoring. No ranking. No prediction.
// ─────────────────────────────────────────────────────────────────────────────

import { resolveByWorkspace } from "./source-resolver";
import type {
  ConstitutionalContradiction,
  ConstitutionalIntelligenceSnapshot,
  ContradictionSourceType,
  DomainKnowledgeEntry,
  KnowledgeDomain,
} from "./types";
import { ALL_KNOWLEDGE_DOMAINS } from "./types";

// ─── Domain classification ────────────────────────────────────────────────────
// Maps known category/type strings from existing records to knowledge domains.
// Deterministic — string matching only.

const CATEGORY_DOMAIN_MAP: Record<string, KnowledgeDomain> = {
  // Memory categories
  risk_pattern:              "risk",
  decision_pattern:          "decision-making",
  stakeholder_pattern:       "stakeholders",
  schedule_pattern:          "planning",
  delivery_pattern:          "delivery",
  dependency_pattern:        "coordination",
  resource_pattern:          "operational",
  governance_pattern:        "governance",
  execution_pattern:         "execution",
  // Personal pattern categories
  risk_response_pattern:     "risk",
  stakeholder_management_pattern: "stakeholders",
  communication_pattern:     "communication",
  planning_pattern:          "planning",
  escalation_pattern:        "escalation",
  approval_pattern:          "governance",
  follow_up_pattern:         "communication",
  dependency_resolution_pattern: "coordination",
  // Effectiveness / decision types
  risk_reduction:            "risk",
  schedule_improvement:      "planning",
  cost_avoidance:            "operational",
  stakeholder_alignment:     "stakeholders",
  resource_optimization:     "operational",
  governance_compliance:     "governance",
  quality:                   "quality",
};

function classifyToDomain(record: Record<string, unknown>): KnowledgeDomain | null {
  const category =
    (record["memory_category"] as string | undefined) ??
    (record["pattern_category"] as string | undefined) ??
    (record["outcome_type"] as string | undefined) ??
    (record["effectiveness_category"] as string | undefined) ??
    (record["relationship_type"] as string | undefined);
  if (!category) return null;
  return CATEGORY_DOMAIN_MAP[category] ?? null;
}

// ─── Contradiction detection ──────────────────────────────────────────────────
// Only detects explicit contradictions via bridge relationship_type strings.
// No inference. No AI.

type BridgeRecord = Record<string, unknown>;

function detectContradictions(
  bridges: BridgeRecord[]
): ConstitutionalContradiction[] {
  const contradictions: ConstitutionalContradiction[] = [];

  for (const bridge of bridges) {
    const relType = bridge["relationship_type"] as string | undefined;
    if (!relType?.includes("contradicts")) continue;

    const id = `contradiction-${bridge["id"] as string}`;
    const detectedAt = (bridge["updated_at"] ?? bridge["created_at"] ?? new Date().toISOString()) as string;

    // Derive source types from the bridge record fields
    const personalSourceType = (bridge["personal_source_type"] as ContradictionSourceType | undefined) ?? "personal_memory";
    const orgSourceType = (bridge["organizational_source_type"] as ContradictionSourceType | undefined) ?? "organizational_memory";

    contradictions.push({
      id,
      sourceAType: personalSourceType,
      sourceAId:   bridge["personal_source_id"] as string,
      sourceAStatement: `${relType} (personal)`,
      sourceBType: orgSourceType,
      sourceBId:   bridge["organizational_source_id"] as string,
      sourceBStatement: `${relType} (organizational)`,
      detectedAt,
      relationshipType: "contradicts",
      bridgeId: bridge["id"] as string,
    });
  }

  return contradictions;
}

// ─── Domain assembly ──────────────────────────────────────────────────────────

function assembleDomains(
  sources: ReturnType<typeof resolveByWorkspace> extends Promise<infer T> ? T : never
): DomainKnowledgeEntry[] {
  const domainMap = new Map<KnowledgeDomain, DomainKnowledgeEntry>();

  for (const domain of ALL_KNOWLEDGE_DOMAINS) {
    domainMap.set(domain, {
      domain,
      organizationalMemoryIds: [],
      organizationalPatternIds: [],
      decisionEffectivenessIds: [],
      patternCandidateIds: [],
      personalMemoryIds: [],
      personalPatternIds: [],
      personalEffectivenessIds: [],
      personalPatternCandidateIds: [],
      bridgeRelationshipIds: [],
      evidenceCount: 0,
    });
  }

  function classify(record: Record<string, unknown>, domain: KnowledgeDomain | null, id: string, bucket: keyof Omit<DomainKnowledgeEntry, "domain" | "evidenceCount">) {
    const target = domain ?? "operational";
    const entry = domainMap.get(target)!;
    (entry[bucket] as string[]).push(id);
    entry.evidenceCount++;
  }

  for (const r of sources.organizationalMemory) {
    classify(r, classifyToDomain(r), r["id"] as string, "organizationalMemoryIds");
  }
  for (const r of sources.organizationalPatterns) {
    classify(r, classifyToDomain(r), r["id"] as string, "organizationalPatternIds");
  }
  for (const r of sources.decisionEffectiveness) {
    classify(r, classifyToDomain(r), r["id"] as string, "decisionEffectivenessIds");
  }
  for (const r of sources.patternCandidates) {
    classify(r, classifyToDomain(r), r["id"] as string, "patternCandidateIds");
  }
  for (const r of sources.personalMemory) {
    classify(r, classifyToDomain(r), r["id"] as string, "personalMemoryIds");
  }
  for (const r of sources.personalPatterns) {
    classify(r, classifyToDomain(r), r["id"] as string, "personalPatternIds");
  }
  for (const r of sources.personalEffectiveness) {
    classify(r, classifyToDomain(r), r["id"] as string, "personalEffectivenessIds");
  }
  for (const r of sources.personalPatternCandidates) {
    classify(r, classifyToDomain(r), r["id"] as string, "personalPatternCandidateIds");
  }
  for (const r of sources.bridgeRelationships) {
    classify(r, null, r["id"] as string, "bridgeRelationshipIds");
  }

  return Array.from(domainMap.values());
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function assembleConstitutionalKnowledge(
  workspaceId: string,
  pmUserId: string
): Promise<ConstitutionalIntelligenceSnapshot> {
  const sources = await resolveByWorkspace(workspaceId, pmUserId);

  const contradictions = detectContradictions(sources.bridgeRelationships);
  const knowledgeDomains = assembleDomains(sources);

  const evidenceCount =
    sources.organizationalMemory.length +
    sources.organizationalPatterns.length +
    sources.decisionEffectiveness.length +
    sources.patternCandidates.length +
    sources.personalMemory.length +
    sources.personalPatterns.length +
    sources.personalEffectiveness.length +
    sources.personalPatternCandidates.length +
    sources.bridgeRelationships.length;

  return {
    workspaceId,
    pmUserId,
    generatedAt: new Date().toISOString(),
    organizationalMemory:      sources.organizationalMemory,
    organizationalPatterns:    sources.organizationalPatterns,
    decisionEffectiveness:     sources.decisionEffectiveness,
    patternCandidates:         sources.patternCandidates,
    personalMemory:            sources.personalMemory,
    personalPatterns:          sources.personalPatterns,
    personalEffectiveness:     sources.personalEffectiveness,
    personalPatternCandidates: sources.personalPatternCandidates,
    bridgeRelationships:       sources.bridgeRelationships,
    contradictions,
    knowledgeDomains,
    evidenceCount,
  };
}
