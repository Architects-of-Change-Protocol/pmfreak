export type VaultDocumentSourceType =
  | "meeting_notes"
  | "transcript"
  | "email"
  | "project_update"
  | "risk_log"
  | "issue_log"
  | "action_log"
  | "decision_log"
  | "generic_note";

export type VaultDocumentClassification =
  | "operational"
  | "governance"
  | "commercial"
  | "technical"
  | "stakeholder"
  | "mixed";

export type VaultDocumentIngestionStatus =
  | "received"
  | "document_persisted"
  | "completed"
  | "extraction_failed"
  | "signals_persistence_failed"
  | "raid_persistence_failed"
  | "executive_synthesis_failed"
  | "document_persistence_failed";

export type VaultOperationalSignalType = "risk" | "issue" | "dependency" | "action" | "decision";

export type VaultDocument = {
  id: string;
  workspaceId: string;
  projectId: string | null;
  title: string;
  sourceType: VaultDocumentSourceType;
  rawContent: string;
  normalizedContent: string;
  createdAt: string;
  createdBy: string | null;
  ingestionStatus: VaultDocumentIngestionStatus;
  classification: VaultDocumentClassification;
};

export type VaultOperationalSignal = {
  id: string;
  documentId: string;
  workspaceId: string;
  projectId: string | null;
  signalType: VaultOperationalSignalType;
  signalText: string;
  confidenceScore: number;
  createdAt: string;
};

export type VaultIngestionResult = {
  documentId: string;
  risksDetected: number;
  issuesDetected: number;
  dependenciesDetected: number;
  actionsDetected: number;
  decisionsDetected: number;
  raidItemsCreated: number;
  raidItemsUpdated: number;
  raidSnapshot: { risks: number; issues: number; dependencies: number; assumptions: number };
  confidenceScore: number;
  ingestionSummary: string;
  ingestionStatus: VaultDocumentIngestionStatus;
  classification: VaultDocumentClassification;
  executiveSynthesisUpdated: boolean;
  errors: string[];
};

export type VaultDocumentInput = {
  workspaceId: string;
  companyId?: string | null;
  projectId?: string | null;
  title?: string;
  sourceType?: VaultDocumentSourceType;
  rawContent: string;
  createdBy?: string | null;
  now?: string;
};
