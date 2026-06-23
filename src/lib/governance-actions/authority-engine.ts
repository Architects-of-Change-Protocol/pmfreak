// ─────────────────────────────────────────────────────────────────────────────
// Governance Action Engine — Authority Validation Engine
//
// Validates that each action type maps to a known authority role.
// Determines whether a recommended actor holds the required authority.
// Actions are suggested — not executed — so this is advisory validation.
// ─────────────────────────────────────────────────────────────────────────────

import type { GovernanceActionType, AuthorityValidationResult } from "./types";

// Authority required per action type
const ACTION_AUTHORITY_MAP: Record<GovernanceActionType, string> = {
  create_escalation:        "project_manager",
  request_ratification:     "sponsor",
  request_approval:         "decision_authority",
  create_delegation:        "sponsor",
  assign_authority:         "sponsor",
  review_amendment:         "project_manager",
  review_decision:          "decision_authority",
  review_risk:              "risk_owner",
  initiate_governance_review: "sponsor",
  close_signal:             "project_manager",
  reassess_recommendation:  "project_manager",
  other:                    "project_manager",
};

export type AuthorityValidationInput = {
  actionType: GovernanceActionType;
  recommendedActor: string | null;
  actorRoles: string[];
};

export function validateActionAuthority(
  input: AuthorityValidationInput
): AuthorityValidationResult {
  const requiredAuthorityType = ACTION_AUTHORITY_MAP[input.actionType];

  const authorized =
    input.recommendedActor !== null &&
    (input.actorRoles.includes(requiredAuthorityType) ||
      input.actorRoles.includes("owner") ||
      input.actorRoles.includes("admin") ||
      input.actorRoles.includes("sponsor"));

  const reason = authorized
    ? `Actor holds '${requiredAuthorityType}' authority required for '${input.actionType}'`
    : input.recommendedActor === null
    ? `No recommended actor specified for '${input.actionType}'; requires '${requiredAuthorityType}'`
    : `Actor does not hold '${requiredAuthorityType}' authority required for '${input.actionType}'`;

  return {
    actionType:            input.actionType,
    requiredAuthorityType,
    recommendedActor:      input.recommendedActor,
    authorized,
    reason,
  };
}

export function getRequiredAuthorityForAction(
  actionType: GovernanceActionType
): string {
  return ACTION_AUTHORITY_MAP[actionType];
}

export function getRecommendedOwnerTypeForAction(
  actionType: GovernanceActionType
): string {
  return ACTION_AUTHORITY_MAP[actionType];
}
