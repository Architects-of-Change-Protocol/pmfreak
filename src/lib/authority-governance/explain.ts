import type { AuthorityGovernanceExplanation } from "./types";

export function explainAuthorityGovernance(): AuthorityGovernanceExplanation {
  return {
    overview:
      "The Authority Governance system enforces constitutional accountability by maintaining a registry of authority holders, tracking hierarchical delegation chains, detecting governance violations, and routing escalations when no actor holds sufficient authority.",

    authorityTypes: [
      "sponsor",
      "project_manager",
      "technical_lead",
      "steering_committee",
      "governance_board",
      "product_owner",
      "architect",
      "client",
      "external_approver",
    ],

    authorityScopes: ["workspace", "project"],

    delegationChain: [
      "Sponsor (rank 8) → Project Manager (rank 6)",
      "Project Manager (rank 6) → Technical Lead (rank 3)",
      "Maximum delegation depth: 3 hops",
      "Delegates cannot exceed delegator authority rank",
      "Delegator must hold the authority being delegated",
    ],

    violationTypes: [
      "unauthorized_approval",
      "unauthorized_amendment",
      "unauthorized_ratification",
      "expired_authority",
      "revoked_authority",
      "missing_authority_registration",
      "delegation_depth_exceeded",
    ],

    escalationTargets: [
      "governance_board",
      "steering_committee",
      "sponsor",
      "external_approver",
    ],

    governanceRules: [
      "Rule 1: Actors must hold an active authority registration to perform governance actions.",
      "Rule 2: Authority obtained via delegation must trace to a root registration without gaps.",
      "Rule 3: Delegation cannot broaden authority — delegate rank must be <= delegator rank.",
      "Rule 4: Delegation depth is capped at 3 hops.",
      "Rule 5: Revoked or expired authority registrations render downstream delegations invalid.",
      "Rule 6: Every detected violation is persisted and emits a platform event.",
      "Rule 7: Violations with no authority holder trigger automatic escalation routing.",
      "Rule 8: Accountability chains are reconstructed on-demand for any decision.",
    ],

    auditEvents: [
      "AUTHORITY_REGISTERED",
      "AUTHORITY_REVOKED",
      "AUTHORITY_EXPIRED",
      "AUTHORITY_DELEGATED",
      "DELEGATION_REVOKED",
      "DELEGATION_EXPIRED",
      "GOVERNANCE_VIOLATION_DETECTED",
      "GOVERNANCE_VIOLATION_RESOLVED",
      "AUTHORITY_ESCALATION_CREATED",
      "AUTHORITY_ESCALATION_RESOLVED",
      "ACCOUNTABILITY_CHAIN_BUILT",
    ],
  };
}
