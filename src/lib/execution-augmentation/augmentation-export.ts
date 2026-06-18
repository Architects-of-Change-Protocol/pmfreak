// ─────────────────────────────────────────────────────────────────────────────
// Execution Augmentation — Export and Explanation
//
// Exports and explains ExecutionAugmentation objects.
// No AI. No ML. No embeddings. No scoring. No ranking. No prediction.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import type {
  ExecutionAugmentation,
  ExecutionAugmentationExport,
  ExecutionAugmentationExplanation,
  AugmentationArtifact,
  AugmentationArtifactReason,
  AugmentationResult,
} from "./types";

// ─── Audit event helper ───────────────────────────────────────────────────────

async function emitExportEvent(
  workspaceId: string,
  actorId: string | null,
  eventType: string,
  augmentation: ExecutionAugmentation,
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
    correlationId: correlationId ?? augmentation.id,
    causationId,
    rawReferenceTable: "execution_augmentation",
    rawReferenceId: augmentation.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: payload,
  });
}

// ─── flatArtifacts ────────────────────────────────────────────────────────────

function flatArtifacts(aug: ExecutionAugmentation): AugmentationArtifact[] {
  return [
    ...aug.contextArtifacts,
    ...aug.evidenceArtifacts,
    ...aug.memoryArtifacts,
    ...aug.patternArtifacts,
    ...aug.effectivenessArtifacts,
    ...aug.briefArtifacts,
    ...aug.dashboardArtifacts,
  ];
}

// ─── exportExecutionAugmentation ──────────────────────────────────────────────

export async function exportExecutionAugmentation(
  augmentation: ExecutionAugmentation,
  actorId: string | null = null,
  correlationId: string | null = null,
  causationId: string | null = null
): Promise<AugmentationResult<ExecutionAugmentationExport>> {
  const exportedAt = new Date().toISOString();
  const artifacts = flatArtifacts(augmentation);

  const result: ExecutionAugmentationExport = {
    augmentation,
    artifacts,
    contradictions: augmentation.contradictions,
    unknowns: augmentation.unknowns,
    lineage: augmentation.lineage,
    exportedAt,
    format: "json",
  };

  await emitExportEvent(
    augmentation.workspaceId,
    actorId,
    "EXECUTION_AUGMENTATION_EXPORTED",
    augmentation,
    correlationId,
    causationId,
    {
      artifactType: augmentation.artifactType,
      artifactId: augmentation.artifactId,
      artifactCount: artifacts.length,
      contradictionCount: augmentation.contradictions.length,
      unknownCount: augmentation.unknowns.length,
      exportedAt,
    }
  );

  return { ok: true, data: result };
}

// ─── explainExecutionAugmentation ─────────────────────────────────────────────
// Answers: Why is each artifact present?

export async function explainExecutionAugmentation(
  augmentation: ExecutionAugmentation,
  actorId: string | null = null,
  correlationId: string | null = null,
  causationId: string | null = null
): Promise<AugmentationResult<ExecutionAugmentationExplanation>> {
  const artifacts = flatArtifacts(augmentation);

  const artifactReasons: AugmentationArtifactReason[] = artifacts.map((a) => ({
    artifactType: a.artifactType,
    artifactId: a.artifactId,
    reasonIncluded: a.reasonIncluded,
  }));

  await emitExportEvent(
    augmentation.workspaceId,
    actorId,
    "EXECUTION_AUGMENTATION_EXPLAINED",
    augmentation,
    correlationId ?? augmentation.id,
    causationId,
    {
      artifactType: augmentation.artifactType,
      artifactId: augmentation.artifactId,
      artifactCount: artifacts.length,
    }
  );

  return {
    ok: true,
    data: {
      augmentation,
      artifactReasons,
      lineage: augmentation.lineage,
      contradictions: augmentation.contradictions,
      unknowns: augmentation.unknowns,
    },
  };
}
