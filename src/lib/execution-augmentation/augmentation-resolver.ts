// ─────────────────────────────────────────────────────────────────────────────
// Execution Augmentation — Resolver
//
// Resolves raw constitutional records into typed AugmentationArtifacts.
// No AI. No ML. No embeddings. No scoring. No ranking. No prediction.
// Every artifact is sourced from explicitly passed records only.
// ─────────────────────────────────────────────────────────────────────────────

import type { AugmentationArtifact, AugmentationLineageEntry } from "./types";

// ─── resolveArtifacts ─────────────────────────────────────────────────────────
// Converts raw records into AugmentationArtifacts using explicit reasonIncluded.

export function resolveArtifacts(
  records: Record<string, unknown>[],
  artifactType: string,
  reasonIncluded: string
): AugmentationArtifact[] {
  const resolved: AugmentationArtifact[] = [];

  for (const record of records) {
    const id = record["id"] as string | undefined;
    if (!id) continue;

    const title =
      (record["title"] as string | undefined) ??
      (record["name"] as string | undefined) ??
      (record["summary"] as string | undefined) ??
      `${artifactType}:${id}`;

    const summary =
      (record["summary"] as string | undefined) ??
      (record["description"] as string | undefined) ??
      (record["observation_summary"] as string | undefined) ??
      "";

    const evidenceCount =
      (record["evidence_count"] as number | undefined) ?? 0;

    const lineage: AugmentationLineageEntry[] = [];
    const workspaceId = record["workspace_id"] as string | undefined;
    if (workspaceId) {
      lineage.push({
        recordType: artifactType,
        recordId: id,
        relationship: "workspace_member",
        resolvedAt: new Date().toISOString(),
      });
    }

    resolved.push({
      artifactType,
      artifactId: id,
      title,
      summary,
      reasonIncluded,
      evidenceCount,
      lineage,
    });
  }

  return resolved;
}

// ─── resolveLineage ───────────────────────────────────────────────────────────
// Builds lineage entries from a set of augmentation artifacts.

export function resolveLineage(
  artifacts: AugmentationArtifact[]
): AugmentationLineageEntry[] {
  const entries: AugmentationLineageEntry[] = [];
  const now = new Date().toISOString();

  for (const artifact of artifacts) {
    entries.push({
      recordType: artifact.artifactType,
      recordId: artifact.artifactId,
      relationship: "augmentation_member",
      resolvedAt: now,
    });
    for (const l of artifact.lineage) {
      entries.push({
        ...l,
        resolvedAt: l.resolvedAt ?? new Date().toISOString(),
      });
    }
  }

  return entries;
}
