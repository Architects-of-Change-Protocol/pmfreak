export type OperationalWorkspaceRole = "owner" | "admin" | "pm" | "viewer" | string;
export type OperationalDecisionStatus = "accepted" | "rejected" | "modified" | "escalated" | "needs_more_evidence";

export type OperationalAuthorityEvaluation = {
  allowed: boolean;
  actorRole: OperationalWorkspaceRole | null;
  authorityRequired: string;
  authorityBasis: string | null;
  reason: string;
  mapping: "pmfreak_role_mapping_v1";
};

export function evaluateOperationalDecisionAuthority(input: {
  actorRole: OperationalWorkspaceRole | null;
  authorityRequired: string | null;
  decisionStatus: OperationalDecisionStatus;
}): OperationalAuthorityEvaluation {
  const authorityRequired = input.authorityRequired || "baseline review";
  const base = { actorRole: input.actorRole, authorityRequired, mapping: "pmfreak_role_mapping_v1" as const };
  if (!input.actorRole || input.actorRole === "viewer" || input.actorRole === "external_stakeholder" || input.actorRole === "executive_viewer" || input.actorRole === "ai_agent") {
    return { ...base, allowed: false, authorityBasis: null, reason: "read_only_or_non_human_role" };
  }
  if (input.actorRole === "owner" || input.actorRole === "admin") {
    return { ...base, allowed: true, authorityBasis: `${input.actorRole} workspace authority (PMFreak role mapping v1)`, reason: "workspace_authority" };
  }
  if ((input.actorRole === "pm" || input.actorRole === "PM") && ["escalated", "needs_more_evidence"].includes(input.decisionStatus)) {
    return { ...base, allowed: true, authorityBasis: "pm escalation/review authority (PMFreak role mapping v1)", reason: "non_terminal_escalation_authority" };
  }
  if ((input.actorRole === "pm" || input.actorRole === "PM") && ["PM or sponsor", "accountable owner", "project manager operating authority", "baseline review"].includes(authorityRequired)) {
    return { ...base, allowed: true, authorityBasis: "pm project authority (PMFreak role mapping v1)", reason: "project_manager_authority" };
  }
  return { ...base, allowed: false, authorityBasis: null, reason: "authority_requirement_not_satisfied" };
}

export const canCreateOperationalEvidence = (role: OperationalWorkspaceRole | null) => role === "owner" || role === "admin" || role === "pm" || role === "PM";
