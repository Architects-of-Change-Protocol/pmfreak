import { getArtifact } from "./artifact-registry";
import { listMemoryRecordsByArtifact } from "./memory-registry";
import type { CanonicalRepresentation, MemoryType, VaultResult } from "./types";

function validUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}
function validation<T>(error: string): VaultResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

// Memory types map to canonical representation buckets
const BUCKET_MAP: Record<MemoryType, keyof Pick<CanonicalRepresentation, "decisions" | "risks" | "objectives" | "constraints"> | null> = {
  decision: "decisions",
  risk: "risks",
  issue: "risks",
  objective: "objectives",
  constraint: "constraints",
  amendment: "decisions",
  ratification: "decisions",
  authority: null,
  evidence: null,
  other: null,
};

// ─── Generate Canonical Representation ───────────────────────────────────────
// Transforms an artifact and its associated memory records into a structured
// canonical YAML-like representation suitable for anonimization (Digest).

export async function generateCanonicalRepresentation(input: {
  artifactId: string;
  workspaceId: string;
}): Promise<VaultResult<CanonicalRepresentation>> {
  if (!validUuid(input.artifactId)) return validation("artifactId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");

  const artifactResult = await getArtifact(input.artifactId, input.workspaceId);
  if (!artifactResult.ok) return artifactResult;

  const recordsResult = await listMemoryRecordsByArtifact(input.artifactId, input.workspaceId);
  if (!recordsResult.ok) return recordsResult;

  const artifact = artifactResult.data;
  const records = recordsResult.data;

  const decisions: string[] = [];
  const risks: string[] = [];
  const objectives: string[] = [];
  const constraints: string[] = [];

  // Derive summary from records or fall back to artifact description
  const summaryRecord = records.find((r) => r.summary);
  const summary =
    summaryRecord?.summary ??
    artifact.description ??
    `${artifact.artifact_type} artifact: ${artifact.title}`;

  for (const record of records) {
    const bucket = BUCKET_MAP[record.memory_type];
    const text = record.canonical_text;

    if (bucket === "decisions") decisions.push(text);
    else if (bucket === "risks") risks.push(text);
    else if (bucket === "objectives") objectives.push(text);
    else if (bucket === "constraints") constraints.push(text);
    // authority, evidence, other: included only in summary, not in typed buckets
  }

  const representation: CanonicalRepresentation = {
    artifactId: artifact.id,
    artifactType: artifact.artifact_type,
    title: artifact.title,
    summary,
    decisions,
    risks,
    objectives,
    constraints,
    generatedAt: new Date().toISOString(),
    metadata: {
      storageProvider: artifact.storage_provider,
      storageReference: artifact.storage_reference,
      checksum: artifact.checksum,
    },
  };

  return { ok: true, data: representation };
}
