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

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: "validation_failed" | "not_found" | "persistence_failed" | "event_emission_failed" | "governance_violation" };

export type ProjectConstitutionStatus = "draft" | "active" | "on_hold" | "completed" | "cancelled";

export type ProjectConstitutionLifecycleEvent =
  | "PROJECT_CREATED"
  | "PROJECT_UPDATED"
  | "PROJECT_STATUS_CHANGED"
  | "PROJECT_ARCHIVED";

export type ProjectConstitutionRecord = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  status: ProjectConstitutionStatus;
  sponsor: string | null;
  client: string | null;
  pm_responsible_id: string | null;
  objectives: string[];
  constraints: string[];
  start_date: string | null;
  target_end_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  metadata: Record<string, unknown>;
};

export type ProjectConstitutionSummary = Pick<
  ProjectConstitutionRecord,
  "id" | "workspace_id" | "name" | "status" | "sponsor" | "client" | "pm_responsible_id" | "start_date" | "target_end_date" | "created_at" | "updated_at"
>;

export type CreateProjectConstitutionInput = {
  workspaceId: string;
  name: string;
  description?: string | null;
  sponsor?: string | null;
  client?: string | null;
  pmResponsibleId?: string | null;
  objectives?: string[];
  constraints?: string[];
  startDate?: string | null;
  targetEndDate?: string | null;
  createdBy: string;
  metadata?: Record<string, unknown>;
  correlationId?: string | null;
  causationId?: string | null;
};

export type UpdateProjectConstitutionInput = {
  constitutionId: string;
  workspaceId: string;
  updatedBy: string;
  name?: string;
  description?: string | null;
  sponsor?: string | null;
  client?: string | null;
  pmResponsibleId?: string | null;
  objectives?: string[];
  constraints?: string[];
  startDate?: string | null;
  targetEndDate?: string | null;
  metadata?: Record<string, unknown>;
  correlationId?: string | null;
  causationId?: string | null;
};

export type ChangeProjectConstitutionStatusInput = {
  constitutionId: string;
  workspaceId: string;
  status: ProjectConstitutionStatus;
  changedBy: string;
  correlationId?: string | null;
  causationId?: string | null;
};

export type SoftDeleteProjectConstitutionInput = {
  constitutionId: string;
  workspaceId: string;
  deletedBy: string;
  correlationId?: string | null;
  causationId?: string | null;
};
