import type {
  AmendmentChangeType,
  AmendmentStatus,
  ConstitutionAmendmentChangeRow,
  ConstitutionAmendmentRow,
  ConstitutionSnapshotRow,
} from "@/lib/db/database-contract";
import type { ConstitutionAmendmentEventType } from "@/lib/platform-events/types";

export type { AmendmentStatus, AmendmentChangeType };

export type AmendmentResult<T> =
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

export type AmendmentRecord = ConstitutionAmendmentRow;
export type AmendmentChangeRecord = ConstitutionAmendmentChangeRow;
export type ConstitutionSnapshotRecord = ConstitutionSnapshotRow;

export type AmendmentEventName = ConstitutionAmendmentEventType;

// ─── Input types ──────────────────────────────────────────────────────────────

export type CreateAmendmentInput = {
  workspaceId: string;
  constitutionId: string;
  title: string;
  description?: string | null;
  justification?: string | null;
  createdBy: string;
  changes?: CreateAmendmentChangeInput[];
};

export type CreateAmendmentChangeInput = {
  changeType: AmendmentChangeType;
  fieldName: string;
  oldValue?: string | null;
  newValue?: string | null;
};

export type UpdateAmendmentInput = {
  amendmentId: string;
  workspaceId: string;
  actorId: string;
  title?: string;
  description?: string | null;
  justification?: string | null;
  changes?: CreateAmendmentChangeInput[];
};

export type ProposeAmendmentInput = {
  amendmentId: string;
  workspaceId: string;
  actorId: string;
};

export type ApproveAmendmentInput = {
  amendmentId: string;
  workspaceId: string;
  actorId: string;
};

export type RejectAmendmentInput = {
  amendmentId: string;
  workspaceId: string;
  actorId: string;
  rejectionReason?: string | null;
};

export type WithdrawAmendmentInput = {
  amendmentId: string;
  workspaceId: string;
  actorId: string;
};

export type ApplyAmendmentInput = {
  amendmentId: string;
  workspaceId: string;
  actorId: string;
};

// ─── Diff Engine ──────────────────────────────────────────────────────────────

export type ConstitutionDiffEntry = {
  field: string;
  previousValue: string | null;
  newValue: string | null;
  changeType: AmendmentChangeType;
};

export type ConstitutionDiff = {
  constitutionId: string;
  amendmentId: string;
  changes: ConstitutionDiffEntry[];
};

// ─── Amendment History ────────────────────────────────────────────────────────

export type AmendmentHistoryEntry = {
  amendment: AmendmentRecord;
  changes: AmendmentChangeRecord[];
};

// ─── Explain ──────────────────────────────────────────────────────────────────

export type AmendmentStateDescription = {
  status: AmendmentStatus;
  label: string;
  description: string;
  terminal: boolean;
  allowedTransitions: AmendmentStatus[];
};

export type AmendmentGovernanceExplanation = {
  whatIsAnAmendment: string;
  approvalFlow: string[];
  versioning: string;
  snapshots: string;
  constitutionalIntegrity: string;
  states: AmendmentStateDescription[];
  terminalStates: AmendmentStatus[];
  auditEvents: AmendmentEventName[];
  governanceRules: string[];
};
