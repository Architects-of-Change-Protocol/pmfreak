import type { ConstitutionStatus } from "@/lib/db/database-contract";
import type { ConstitutionLifecycleEventType } from "@/lib/platform-events/types";

export type { ConstitutionStatus };

export type ConstitutionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: "validation_failed" | "not_found" | "persistence_failed" | "event_emission_failed" | "governance_violation" };

export type ConstitutionRecord = {
  id: string;
  workspace_id: string;
  project_id: string;
  title: string;
  description: string | null;
  current_status: ConstitutionStatus;
  status_changed_at: string;
  status_changed_by: string;
  lifecycle_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

export type ConstitutionLifecycleHistoryEntry = {
  id: string;
  workspace_id: string;
  constitution_id: string;
  from_status: ConstitutionStatus;
  to_status: ConstitutionStatus;
  changed_by: string;
  changed_at: string;
  reason: string | null;
  lifecycle_version_after: number;
  metadata: Record<string, unknown>;
};

export type ConstitutionLifecycleEventName = ConstitutionLifecycleEventType;

export type ConstitutionStateDescription = {
  status: ConstitutionStatus;
  label: string;
  description: string;
  terminal: boolean;
  allowedTransitions: ConstitutionStatus[];
};

export type ConstitutionLifecycleExplanation = {
  states: ConstitutionStateDescription[];
  terminalStates: ConstitutionStatus[];
  auditEvents: ConstitutionLifecycleEventName[];
  rules: string[];
};

export type ConstitutionListFilters = {
  workspaceId: string;
  projectId?: string;
  status?: ConstitutionStatus;
  excludeArchived?: boolean;
};

export type ConstitutionExport = {
  constitution: ConstitutionRecord;
  lifecycleHistory: ConstitutionLifecycleHistoryEntry[];
  exportedAt: string;
};
