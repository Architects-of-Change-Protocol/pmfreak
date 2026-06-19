// ─────────────────────────────────────────────────────────────────────────────
// Project Constitution — unified types
// Foundation (Sprint 1) + Lifecycle Governance (Sprint 2)
// ─────────────────────────────────────────────────────────────────────────────

import type { ConstitutionLifecycleEventType } from "@/lib/platform-events/types";

// ─── Result ───────────────────────────────────────────────────────────────────

export type ConstitutionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: "validation_failed" | "not_found" | "persistence_failed" | "event_emission_failed" | "governance_violation" };

// Alias kept for backward compat with Sprint 1 imports (service.ts used Result<T>)
export type Result<T> = ConstitutionResult<T>;

// ─── Status types ─────────────────────────────────────────────────────────────

// Sprint 2 lifecycle status (7-state machine). This is the authoritative status
// stored in current_status and governed by the state machine.
export type ConstitutionStatus =
  | "draft"
  | "proposed"
  | "approved"
  | "active"
  | "suspended"
  | "closed"
  | "archived";

// Sprint 1 legacy status values (stored in the `status` column, now read-only).
// New code should use ConstitutionStatus / current_status.
export type ProjectConstitutionLegacyStatus = "draft" | "active" | "on_hold" | "completed" | "cancelled";

// ─── Records ─────────────────────────────────────────────────────────────────

// Unified constitution record — all columns from both Sprint 1 and Sprint 2.
export type ProjectConstitutionRecord = {
  // Identity
  id: string;
  workspace_id: string;
  project_id: string | null;          // Sprint 2 addition; nullable for Sprint 1 rows

  // Foundation fields (Sprint 1)
  name: string;
  description: string | null;
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
  deleted_at: string | null;          // Sprint 1 soft delete
  metadata: Record<string, unknown>;

  // Lifecycle governance fields (Sprint 2)
  current_status: ConstitutionStatus;
  status_changed_at: string;
  status_changed_by: string | null;
  lifecycle_version: number;

  // Legacy Sprint 1 status column (read-only after reconciliation)
  status: ProjectConstitutionLegacyStatus;
};

export type ProjectConstitutionSummary = Pick<
  ProjectConstitutionRecord,
  | "id"
  | "workspace_id"
  | "project_id"
  | "name"
  | "current_status"
  | "sponsor"
  | "client"
  | "pm_responsible_id"
  | "start_date"
  | "target_end_date"
  | "lifecycle_version"
  | "created_at"
  | "updated_at"
>;

// ─── Lifecycle history ────────────────────────────────────────────────────────

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

// ─── Lifecycle state machine types ────────────────────────────────────────────

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

// ─── Service input types (Sprint 1 API, kept for compat) ──────────────────────

export type CreateProjectConstitutionInput = {
  workspaceId: string;
  projectId?: string | null;
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

export type SoftDeleteProjectConstitutionInput = {
  constitutionId: string;
  workspaceId: string;
  deletedBy: string;
  correlationId?: string | null;
  causationId?: string | null;
};

// ─── List / filter types ──────────────────────────────────────────────────────

export type ConstitutionListFilters = {
  workspaceId: string;
  projectId?: string;
  status?: ConstitutionStatus;
  excludeArchived?: boolean;
};

// ─── Export type ──────────────────────────────────────────────────────────────

export type ConstitutionExport = {
  constitution: ProjectConstitutionRecord;
  lifecycleHistory: ConstitutionLifecycleHistoryEntry[];
  exportedAt: string;
};
