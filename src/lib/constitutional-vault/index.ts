// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Vault — Public API
// EPIC 2 Sprint 1: Sovereign Project Vault
// ─────────────────────────────────────────────────────────────────────────────

// Artifact Registry
export {
  archiveArtifact,
  getArtifact,
  listArtifacts,
  registerArtifact,
  updateArtifact,
} from "./artifact-registry";

// Memory Registry
export {
  createMemoryRecord,
  getMemoryRecord,
  linkMemoryToEntity,
  listLinksForMemoryRecord,
  listMemoryRecordsByArtifact,
  updateMemoryRecord,
} from "./memory-registry";

// Lineage Engine
export { getArtifactLineage, getMemoryLineage } from "./lineage-engine";
export type { ArtifactLineage } from "./lineage-engine";

// Canonical Representation
export { generateCanonicalRepresentation } from "./canonical-representation";

// Explain Capability
export { explainConstitutionalMemory } from "./explain-capability";
export type { ConstitutionalMemoryExplanation } from "./explain-capability";

// Types
export type {
  ArtifactType,
  ArchiveArtifactInput,
  CanonicalRepresentation,
  ConstitutionalArtifactRow,
  ConstitutionalMemoryLinkRow,
  ConstitutionalMemoryRecordRow,
  ConstitutionalVaultEventType,
  CreateMemoryRecordInput,
  LinkMemoryToEntityInput,
  MemoryLinkEntityType,
  MemoryLineage,
  MemoryType,
  RegisterArtifactInput,
  StorageProvider,
  UpdateArtifactInput,
  UpdateMemoryRecordInput,
  VaultResult,
} from "./types";
