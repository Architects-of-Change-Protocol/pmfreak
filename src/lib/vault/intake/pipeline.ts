import crypto from "node:crypto";
import { calculateVaultConfidenceScore, classifyVaultDocument, extractVaultOperationalSignals, normalizeVaultContent } from "./signal-extraction";
import type { VaultDocument, VaultDocumentInput, VaultIngestionResult, VaultOperationalSignalType } from "./types";
import type { VaultIntakeStore } from "./storage";

const titleFromContent = (content: string) => content.split(/\n|\.|!|\?/)[0]?.trim().slice(0, 80) || "Vault document";
const countType = (signals: Array<{ signalType: VaultOperationalSignalType }>, type: VaultOperationalSignalType) => signals.filter((signal) => signal.signalType === type).length;

export async function ingestVaultDocument(input: VaultDocumentInput & { store: VaultIntakeStore; idFactory?: () => string }): Promise<VaultIngestionResult> {
  const idFactory = input.idFactory ?? (() => crypto.randomUUID());
  const documentId = idFactory();
  const createdAt = input.now ?? new Date().toISOString();
  const rawContent = input.rawContent ?? "";
  const normalizedContent = normalizeVaultContent(rawContent);
  const classification = classifyVaultDocument(normalizedContent);
  const document: VaultDocument = {
    id: documentId,
    workspaceId: input.workspaceId,
    projectId: input.projectId ?? null,
    title: input.title?.trim() || titleFromContent(normalizedContent),
    sourceType: input.sourceType ?? "meeting_notes",
    rawContent,
    normalizedContent,
    createdAt,
    createdBy: input.createdBy ?? null,
    ingestionStatus: "document_persisted",
    classification,
  };

  const persisted = await input.store.persistDocument(document);
  if (!persisted.ok) {
    return {
      documentId,
      risksDetected: 0,
      issuesDetected: 0,
      dependenciesDetected: 0,
      actionsDetected: 0,
      decisionsDetected: 0,
      confidenceScore: 0,
      ingestionSummary: "Document persistence failed. Evidence was not stored.",
      ingestionStatus: "document_persistence_failed",
      classification,
      executiveSynthesisUpdated: false,
      errors: [persisted.error],
    };
  }

  const errors: string[] = [];
  let signals: ReturnType<typeof extractVaultOperationalSignals> = [];
  let extractionFailed = false;
  try {
    signals = extractVaultOperationalSignals({ documentId, workspaceId: input.workspaceId, projectId: input.projectId ?? null, normalizedContent, createdAt, idFactory });
  } catch (error) {
    extractionFailed = true;
    errors.push(error instanceof Error ? error.message : "signal_extraction_failed");
    await input.store.updateDocumentStatus(documentId, "extraction_failed");
  }

  if (!extractionFailed) {
    const signalPersistence = await input.store.persistSignals(signals);
    if (!signalPersistence.ok) {
      errors.push(signalPersistence.error);
      await input.store.updateDocumentStatus(documentId, "signals_persistence_failed");
    }
  }

  let executiveSynthesisUpdated = false;
  if (!extractionFailed) {
    const synthesis = await input.store.triggerExecutiveSynthesisUpdate({ workspaceId: input.workspaceId, companyId: input.companyId ?? null, projectId: input.projectId ?? null, documentId, signals });
    executiveSynthesisUpdated = synthesis.ok;
    if (!synthesis.ok) {
      errors.push(synthesis.error);
      await input.store.updateDocumentStatus(documentId, "executive_synthesis_failed");
    }
  }

  const risksDetected = countType(signals, "risk");
  const issuesDetected = countType(signals, "issue");
  const dependenciesDetected = countType(signals, "dependency");
  const actionsDetected = countType(signals, "action");
  const decisionsDetected = countType(signals, "decision");
  const confidenceScore = calculateVaultConfidenceScore(signals.length, classification, extractionFailed);
  const status = extractionFailed
    ? "extraction_failed"
    : errors.some((error) => error.includes("signal") || error.includes("persist"))
      ? "signals_persistence_failed"
      : executiveSynthesisUpdated
        ? "completed"
        : "executive_synthesis_failed";

  return {
    documentId,
    risksDetected,
    issuesDetected,
    dependenciesDetected,
    actionsDetected,
    decisionsDetected,
    confidenceScore,
    ingestionSummary: `Meeting captured. ${risksDetected} Risks detected. ${dependenciesDetected} Dependency detected. ${actionsDetected} Action Items detected. Executive synthesis ${executiveSynthesisUpdated ? "updated" : "not updated"}.`,
    ingestionStatus: status,
    classification,
    executiveSynthesisUpdated,
    errors,
  };
}
