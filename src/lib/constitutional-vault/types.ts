// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Vault — Type Definitions
// EPIC 2 Sprint 1: Sovereign Project Vault
// ─────────────────────────────────────────────────────────────────────────────

// ─── Enumerations ────────────────────────────────────────────────────────────

export type ArtifactType =
  | "document"
  | "email"
  | "meeting"
  | "transcript"
  | "spreadsheet"
  | "image"
  | "video"
  | "link"
  | "chat"
  | "other";

export type StorageProvider =
  | "local"
  | "supabase"
  | "s3"
  | "azure_blob"
  | "google_drive"
  | "sharepoint"
  | "dropbox"
  | "custom";

export type MemoryType =
  | "decision"
  | "objective"
  | "constraint"
  | "risk"
  | "issue"
  | "amendment"
  | "ratification"
  | "authority"
  | "evidence"
  | "other";

export type MemoryLinkEntityType =
  | "constitution"
  | "decision"
  | "amendment"
  | "ratification"
  | "authority"
  | "violation"
  | "escalation";

// ─── Result ──────────────────────────────────────────────────────────────────

export type VaultResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      failureClass:
        | "validation_failed"
        | "not_found"
        | "persistence_failed"
        | "event_emission_failed"
        | "governance_violation";
    };

// ─── Row types ────────────────────────────────────────────────────────────────

export type ConstitutionalArtifactRow = {
  id: string;
  workspace_id: string;
  artifact_type: ArtifactType;
  title: string;
  description: string | null;
  storage_provider: StorageProvider;
  storage_reference: string;
  storage_path: string | null;
  checksum: string;
  uploaded_by: string;
  created_at: string;
  deleted_at: string | null;
};

export type ConstitutionalMemoryRecordRow = {
  id: string;
  workspace_id: string;
  artifact_id: string;
  memory_type: MemoryType;
  title: string;
  canonical_text: string;
  summary: string | null;
  created_at: string;
  created_by: string;
};

export type ConstitutionalMemoryLinkRow = {
  id: string;
  workspace_id: string;
  memory_record_id: string;
  entity_type: MemoryLinkEntityType;
  entity_id: string;
  created_at: string;
};

// ─── Input types ──────────────────────────────────────────────────────────────

export type RegisterArtifactInput = {
  workspaceId: string;
  artifactType: ArtifactType;
  title: string;
  description?: string | null;
  storageProvider: StorageProvider;
  storageReference: string;
  storagePath?: string | null;
  checksum: string;
  uploadedBy: string;
};

export type UpdateArtifactInput = {
  artifactId: string;
  workspaceId: string;
  actorId: string;
  title?: string;
  description?: string | null;
  storageReference?: string;
  storagePath?: string | null;
  checksum?: string;
};

export type ArchiveArtifactInput = {
  artifactId: string;
  workspaceId: string;
  actorId: string;
};

export type CreateMemoryRecordInput = {
  workspaceId: string;
  artifactId: string;
  memoryType: MemoryType;
  title: string;
  canonicalText: string;
  summary?: string | null;
  createdBy: string;
};

export type UpdateMemoryRecordInput = {
  memoryRecordId: string;
  workspaceId: string;
  actorId: string;
  title?: string;
  canonicalText?: string;
  summary?: string | null;
};

export type LinkMemoryToEntityInput = {
  workspaceId: string;
  memoryRecordId: string;
  entityType: MemoryLinkEntityType;
  entityId: string;
  actorId: string;
};

// ─── Lineage types ────────────────────────────────────────────────────────────

export type MemoryLineage = {
  artifact: ConstitutionalArtifactRow;
  memoryRecord: ConstitutionalMemoryRecordRow;
  links: ConstitutionalMemoryLinkRow[];
};

// ─── Canonical representation ─────────────────────────────────────────────────

export type CanonicalRepresentation = {
  artifactId: string;
  artifactType: ArtifactType;
  title: string;
  summary: string;
  decisions: string[];
  risks: string[];
  objectives: string[];
  constraints: string[];
  generatedAt: string;
  metadata: {
    storageProvider: StorageProvider;
    storageReference: string;
    checksum: string;
  };
};

// ─── Audit event types ────────────────────────────────────────────────────────

export type ConstitutionalVaultEventType =
  | "CONSTITUTIONAL_ARTIFACT_REGISTERED"
  | "CONSTITUTIONAL_ARTIFACT_UPDATED"
  | "CONSTITUTIONAL_ARTIFACT_ARCHIVED"
  | "CONSTITUTIONAL_MEMORY_CREATED"
  | "CONSTITUTIONAL_MEMORY_UPDATED"
  | "CONSTITUTIONAL_MEMORY_LINKED"
  | "CONSTITUTIONAL_LINEAGE_GENERATED";
