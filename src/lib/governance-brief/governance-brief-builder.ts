// ─────────────────────────────────────────────────────────────────────────────
// Governance Brief — Builder
//
// Transforms a ConstitutionalBrief into a GovernanceBrief.
// No AI. No ML. No embeddings. No scoring. No ranking. No prediction.
// All content is sourced exclusively from the ConstitutionalBrief.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import type { ConstitutionalBrief } from "@/lib/constitutional-brief";
import {
  buildGovernanceSummary,
  buildAuthorityOverview,
  buildDelegationOverview,
  buildCapabilityOverview,
  buildTrustOverview,
  buildPolicyOverview,
  buildGovernanceTimelineHighlights,
  buildGovernanceEvidenceSummary,
  buildGovernanceSections,
} from "./governance-brief-sections";
import type {
  GovernanceBrief,
  GovernanceBriefHealth,
  GovernanceBriefCoverageMetrics,
  GovernanceBriefExplanation,
  GovernanceBriefSectionReason,
  GovernanceBriefResult,
  GovernanceBriefSectionType,
} from "./types";

// ─── ID generator ─────────────────────────────────────────────────────────────

function governanceBriefId(
  workspaceId: string,
  pmUserId: string,
  contextType: string,
  contextId: string,
  generatedAt: string
): string {
  return `gov-brief:${workspaceId}:${pmUserId}:${contextType}:${contextId}:${generatedAt}`;
}

// ─── Audit event helper ───────────────────────────────────────────────────────

async function emitGovernanceBriefEvent(
  workspaceId: string,
  actorId: string | null,
  eventType: string,
  briefId: string,
  correlationId: string | null,
  causationId: string | null,
  payload: Record<string, unknown>
): Promise<void> {
  await createPlatformEvent({
    workspaceId,
    actorId,
    actorType: actorId ? "user" : "system",
    eventType,
    eventCategory: "governance",
    source: actorId ? "user_action" : "system",
    correlationId: correlationId ?? briefId,
    causationId,
    rawReferenceTable: "governance_brief",
    rawReferenceId: briefId,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: payload,
  });
}

// ─── buildGovernanceBrief ─────────────────────────────────────────────────────

export async function buildGovernanceBrief(
  constitutionalBrief: ConstitutionalBrief,
  actorId: string | null = null,
  correlationId: string | null = null,
  causationId: string | null = null
): Promise<GovernanceBriefResult<GovernanceBrief>> {
  const { workspaceId, pmUserId, contextType, contextId } = constitutionalBrief;

  const generatedAt = new Date().toISOString();
  const id = governanceBriefId(
    workspaceId,
    pmUserId,
    contextType,
    contextId,
    generatedAt
  );

  const governanceSummary = buildGovernanceSummary(constitutionalBrief);
  const authorityFacts = buildAuthorityOverview(constitutionalBrief);
  const delegationFacts = buildDelegationOverview(constitutionalBrief);
  const capabilityFacts = buildCapabilityOverview(constitutionalBrief);
  const trustFacts = buildTrustOverview(constitutionalBrief);
  const policyFacts = buildPolicyOverview(constitutionalBrief);
  const timelineHighlights = buildGovernanceTimelineHighlights(constitutionalBrief);
  const evidenceSummary = buildGovernanceEvidenceSummary(constitutionalBrief);
  const sections = buildGovernanceSections(
    constitutionalBrief,
    authorityFacts,
    capabilityFacts,
    delegationFacts,
    trustFacts,
    policyFacts,
    timelineHighlights,
    evidenceSummary
  );

  const brief: GovernanceBrief = {
    id,
    workspaceId,
    pmUserId,
    contextType,
    contextId,
    generatedAt,
    sourceConstitutionalBrief: constitutionalBrief,
    governanceSummary,
    sections,
    authorityFacts,
    capabilityFacts,
    delegationFacts,
    trustFacts,
    contradictions: constitutionalBrief.contradictions,
    unknowns: constitutionalBrief.unknowns,
    timelineHighlights,
    evidenceSummary,
    metadata: {},
  };

  await emitGovernanceBriefEvent(
    workspaceId,
    actorId,
    "GOVERNANCE_BRIEF_GENERATED",
    id,
    correlationId,
    causationId,
    {
      pmUserId,
      contextType,
      contextId,
      sectionCount: sections.length,
      authorityFactCount: authorityFacts.length,
      capabilityFactCount: capabilityFacts.length,
      delegationFactCount: delegationFacts.length,
      trustFactCount: trustFacts.length,
      timelineCount: timelineHighlights.length,
      contradictionCount: constitutionalBrief.contradictions.length,
      unknownCount: constitutionalBrief.unknowns.length,
      sourceConstitutionalBriefId: constitutionalBrief.id,
    }
  );

  return { ok: true, data: brief };
}

// ─── explainGovernanceBrief ───────────────────────────────────────────────────

export async function explainGovernanceBrief(
  brief: GovernanceBrief,
  actorId: string | null = null,
  correlationId: string | null = null,
  causationId: string | null = null
): Promise<GovernanceBriefResult<GovernanceBriefExplanation>> {
  const sectionReasons: GovernanceBriefSectionReason[] = brief.sections.map(
    (s) => ({
      sectionType: s.sectionType,
      reason: governanceSectionExplanation(s.sectionType, s.records.length),
      recordCount: s.records.length,
    })
  );

  const lineage =
    brief.sourceConstitutionalBrief.sourceContextPackage.bridgeRelationships.map(
      (b) => ({
        recordType: "bridge_relationship",
        recordId: (b["id"] as string) ?? "",
        relationship: (b["relationship_type"] as string) ?? "related_to",
      })
    );

  await emitGovernanceBriefEvent(
    brief.workspaceId,
    actorId,
    "GOVERNANCE_BRIEF_EXPLAINED",
    brief.id,
    correlationId ?? brief.id,
    causationId,
    {
      pmUserId: brief.pmUserId,
      contextType: brief.contextType,
      contextId: brief.contextId,
      sectionCount: brief.sections.length,
      sourceConstitutionalBriefId: brief.sourceConstitutionalBrief.id,
    }
  );

  return {
    ok: true,
    data: {
      governanceBrief: brief,
      sectionReasons,
      sourceBrief: brief.sourceConstitutionalBrief,
      evidenceTrace: brief.sourceConstitutionalBrief.evidenceTrace,
      lineage,
      unknowns: brief.unknowns,
    },
  };
}

function governanceSectionExplanation(
  sectionType: GovernanceBriefSectionType,
  recordCount: number
): string {
  switch (sectionType) {
    case "governance_summary":
      return "Always included. Provides count-based summary of governance-relevant constitutional brief content.";
    case "authority_overview":
      return `Included because ${recordCount} authority-related ${recordCount === 1 ? "record was" : "records were"} found in the source brief.`;
    case "approval_overview":
      return `Included because ${recordCount} approval ${recordCount === 1 ? "record was" : "records were"} found in the source brief.`;
    case "delegation_overview":
      return `Included because ${recordCount} delegation ${recordCount === 1 ? "record was" : "records were"} found in the source brief.`;
    case "capability_overview":
      return `Included because ${recordCount} capability ${recordCount === 1 ? "record was" : "records were"} found in the source brief.`;
    case "trust_overview":
      return `Included because ${recordCount} trust ${recordCount === 1 ? "record was" : "records were"} found in the source brief. No trust scores. No trust ratings.`;
    case "policy_overview":
      return `Included because ${recordCount} policy ${recordCount === 1 ? "record was" : "records were"} found in the source brief.`;
    case "contradictions":
      return `Included because ${recordCount} ${recordCount === 1 ? "contradiction was" : "contradictions were"} found in the constitutional brief. Not resolved.`;
    case "timeline_highlights":
      return `Included because ${recordCount} timeline ${recordCount === 1 ? "entry was" : "entries were"} found in the constitutional brief.`;
    case "evidence_summary":
      return "Always included. Summarizes governance evidence counts from the constitutional brief.";
    case "unknowns":
      return `Included because ${recordCount} unknown ${recordCount === 1 ? "area was" : "areas were"} documented in the constitutional brief.`;
    default:
      return "Included from constitutional brief data.";
  }
}

// ─── getGovernanceBriefHealth ─────────────────────────────────────────────────

export function getGovernanceBriefHealth(
  brief: GovernanceBrief
): GovernanceBriefHealth {
  const coverageMetrics: GovernanceBriefCoverageMetrics = {
    hasAuthorityFacts: brief.authorityFacts.length > 0,
    hasCapabilityFacts: brief.capabilityFacts.length > 0,
    hasDelegationFacts: brief.delegationFacts.length > 0,
    hasTrustFacts: brief.trustFacts.length > 0,
    hasContradictions: brief.contradictions.length > 0,
    hasTimelineHighlights: brief.timelineHighlights.length > 0,
    hasEvidenceSummary: brief.evidenceSummary.evidenceCount > 0,
    hasUnknowns: brief.unknowns.length > 0,
  };

  return {
    sectionCount: brief.sections.length,
    authorityFactCount: brief.authorityFacts.length,
    capabilityFactCount: brief.capabilityFacts.length,
    delegationFactCount: brief.delegationFacts.length,
    trustFactCount: brief.trustFacts.length,
    timelineCount: brief.timelineHighlights.length,
    contradictionCount: brief.contradictions.length,
    unknownCount: brief.unknowns.length,
    coverageMetrics,
  };
}
