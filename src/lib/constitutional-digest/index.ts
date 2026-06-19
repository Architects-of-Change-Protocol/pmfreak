// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Digest Engine — Public API
// EPIC 2 Sprint 2: Sovereign Project Vault
// ─────────────────────────────────────────────────────────────────────────────

export {
  createDigest,
  generateDigest,
  validateDigest,
  publishDigest,
  archiveDigest,
  getDigest,
  listDigests,
  listClassificationsForDigest,
} from "./digest-registry";

export { getDigestLineage } from "./digest-lineage";
export { anonymizeText, containsPii } from "./anonymization-engine";
export { extractPatterns } from "./pattern-extraction-engine";
export { calculateDigestConfidence } from "./confidence-engine";
export { explainConstitutionalDigest } from "./explain-capability";

export type {
  DigestResult,
  DigestStatus,
  DigestPayload,
  DigestCategory,
  DigestClassificationType,
  DecisionPattern,
  RiskPattern,
  GovernancePattern,
  OutcomePattern,
  ConstitutionalDigestRow,
  ConstitutionalDigestClassificationRow,
  ConstitutionalDigestEventType,
  CreateDigestInput,
  GenerateDigestInput,
  ValidateDigestInput,
  PublishDigestInput,
  ArchiveDigestInput,
  ListDigestsInput,
  DigestLineage,
  AnonymizationResult,
  PatternExtractionResult,
  ConfidenceBreakdown,
} from "./types";
