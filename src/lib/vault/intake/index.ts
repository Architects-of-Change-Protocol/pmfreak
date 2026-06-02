export type {
  VaultDocument,
  VaultDocumentClassification,
  VaultDocumentIngestionStatus,
  VaultDocumentInput,
  VaultDocumentSourceType,
  VaultIngestionResult,
  VaultOperationalSignal,
  VaultOperationalSignalType,
} from "./types";
export { normalizeVaultContent, splitOperationalSentences, classifyVaultDocument, extractVaultOperationalSignals, calculateVaultConfidenceScore } from "./signal-extraction";
export { createSupabaseVaultIntakeStore, type VaultIntakeStore } from "./storage";
export { ingestVaultDocument } from "./pipeline";
