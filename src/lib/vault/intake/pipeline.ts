import crypto from "node:crypto";
import { buildRaidSnapshot, extractRaidItems } from "@/lib/raid";
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
      raidItemsCreated: 0,
      raidItemsUpdated: 0,
      raidSnapshot: { risks: 0, issues: 0, dependencies: 0, assumptions: 0 },
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

  let raidCandidates: ReturnType<typeof extractRaidItems> = [];
  let raidPersistenceFailed = false;
  if (!extractionFailed) {
    try {
      raidCandidates = extractRaidItems({ document, signals, idFactory });
    } catch (error) {
      raidPersistenceFailed = true;
      errors.push(error instanceof Error ? `raid_extraction_failed: ${error.message}` : "raid_extraction_failed");
      await input.store.updateDocumentStatus(documentId, "raid_persistence_failed");
    }
  }

  let persistedRaidItems = raidCandidates;
  let raidItemsCreated = input.store.persistRaidItems ? 0 : raidCandidates.length;
  let raidItemsUpdated = 0;
  if (!extractionFailed && !raidPersistenceFailed && input.store.persistRaidItems) {
    const raidPersistence = await input.store.persistRaidItems(raidCandidates);
    if (!raidPersistence.ok) {
      raidPersistenceFailed = true;
      persistedRaidItems = [];
      raidItemsCreated = 0;
      errors.push(`raid_persistence_failed: ${raidPersistence.error}`);
      await input.store.updateDocumentStatus(documentId, "raid_persistence_failed");
    } else {
      persistedRaidItems = [...raidPersistence.created, ...raidPersistence.updated];
      raidItemsCreated = raidPersistence.created.length;
      raidItemsUpdated = raidPersistence.updated.length;
    }
  }

  let executiveSynthesisUpdated = false;
  if (!extractionFailed) {
    const synthesis = await input.store.triggerExecutiveSynthesisUpdate({ workspaceId: input.workspaceId, companyId: input.companyId ?? null, projectId: input.projectId ?? null, documentId, signals, raidItems: persistedRaidItems });
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
  const raidSnapshot = buildRaidSnapshot(persistedRaidItems);
  const confidenceScore = calculateVaultConfidenceScore(signals.length + persistedRaidItems.length, classification, extractionFailed);
  const status = extractionFailed
    ? "extraction_failed"
    : errors.some((error) => error.includes("signal"))
      ? "signals_persistence_failed"
      : raidPersistenceFailed
        ? "raid_persistence_failed"
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
    raidItemsCreated,
    raidItemsUpdated,
    raidSnapshot,
    confidenceScore,
    ingestionSummary: `Meeting captured. ${risksDetected} Risks detected. ${dependenciesDetected} Dependency detected. ${actionsDetected} Action Items detected. Risk created: ${raidSnapshot.risks}. Issue created: ${raidSnapshot.issues}. Dependency created: ${raidSnapshot.dependencies}. RAID Snapshot updated. Project Health recalculated. Executive synthesis ${executiveSynthesisUpdated ? "updated" : "not updated"}.`,
    ingestionStatus: status,
    classification,
    executiveSynthesisUpdated,
    errors,
  };
}
