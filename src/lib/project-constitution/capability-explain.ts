export type ProjectConstitutionCapabilityExplain = {
  capability: string;
  purpose: string;
  scope: string;
  limits: string[];
  auditEvents: string[];
  workspaceIsolation: string;
};

export function explainProjectConstitutionCapability(): ProjectConstitutionCapabilityExplain {
  return {
    capability: "project-constitution",
    purpose:
      "Establishes and maintains the constitutional record of a project: its identity, stakeholder roles (sponsor, client, PM), objectives, constraints, and timeline boundaries. " +
      "Acts as the foundational governance artifact from which project-level decisions, risks, and scope changes derive their context.",
    scope:
      "Covers the full lifecycle of a project constitutional record within a workspace — creation, editing, status transitions, and soft deletion. " +
      "Does not manage task execution, resource scheduling, financials, or operational delivery.",
    limits: [
      "Records are always scoped to a single workspace and cannot be transferred across workspaces.",
      "Soft delete is used exclusively; no physical deletion is performed.",
      "Status transitions are not machine-enforced as a state machine — any valid status can be set by an authorized actor.",
      "Does not expose or manage project budgets, timelines below the date level, or team assignments beyond the PM responsible.",
      "Does not replace task management, risk registers, or delivery tracking.",
    ],
    auditEvents: [
      "PROJECT_CREATED — emitted when a constitution record is first persisted.",
      "PROJECT_UPDATED — emitted on any field edit including stakeholder fields, objectives, or constraints.",
      "PROJECT_STATUS_CHANGED — emitted when status transitions (draft → active → on_hold → completed / cancelled).",
      "PROJECT_ARCHIVED — emitted on soft delete; the record remains queryable via raw DB access for compliance.",
    ],
    workspaceIsolation:
      "All records carry a workspace_id and are protected by Supabase Row-Level Security via the is_workspace_member() function. " +
      "Cross-workspace queries are structurally prevented at the database layer.",
  };
}
