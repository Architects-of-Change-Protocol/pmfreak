import type { ConstitutionalDecisionGovernanceExplanation } from "./decision-types";
import { DECISION_ALLOWED_TRANSITIONS, DECISION_TERMINAL_STATES } from "./decision-state-machine";

export function explainConstitutionalDecisionGovernance(): ConstitutionalDecisionGovernanceExplanation {
  return {
    whatIsAConstitutionalDecision:
      "A Constitutional Decision is a formal, auditable decision taken within project governance. " +
      "It records the authority who decided, the problem being resolved, the alternatives evaluated, " +
      "the evidence consulted, and the selected course of action. Every relevant decision is preserved " +
      "as an institutional memory artifact traceable to the Constitution.",

    decisionAuthorities: [
      "sponsor — Executive sponsor with budget and strategic authority.",
      "project_manager — PM responsible for day-to-day delivery governance.",
      "steering_committee — Committee providing strategic oversight and escalation resolution.",
      "governance_board — Formal governance body enforcing constitutional principles.",
      "product_owner — Owner of product scope and backlog prioritisation.",
      "client — External client with contractual authority.",
      "architect — Principal architect responsible for technical and structural decisions.",
      "technical_lead — Technical lead accountable for implementation decisions.",
    ],

    evidenceTypes: [
      "document — Formal document (requirements, specs, plans).",
      "email — Email communication.",
      "meeting — Meeting minutes or recording.",
      "risk — Risk register entry.",
      "issue — Issue or defect record.",
      "change_request — Formal change request.",
      "file — Uploaded file attachment.",
      "link — External URL or reference.",
      "chat — Chat transcript or message.",
      "approval — Formal approval record.",
    ],

    linkTypes: [
      "objective — Links decision to a constitutional objective.",
      "constraint — Links decision to a constitutional constraint.",
      "amendment — Links decision to a resulting amendment.",
      "risk — Links decision to a risk record.",
      "issue — Links decision to an issue or defect.",
      "milestone — Links decision to a project milestone.",
      "deliverable — Links decision to a deliverable.",
      "constitution_version — Links decision to a specific constitution version.",
    ],

    traceability:
      "Every decision maintains a full lineage: Decision → Evidence → Amendment → Constitution Version. " +
      "The traceDecisionLineage() capability reconstructs the complete chain of reasoning that led " +
      "to a constitutional outcome, enabling historical reconstruction of institutional choices.",

    amendmentIntegration:
      "An approved or executed constitutional decision can generate a Constitution Amendment draft " +
      "via generateAmendmentFromDecision(). The amendment carries a bidirectional link back to " +
      "the origin decision, maintaining full traceability from decision rationale to constitutional change.",

    constitutionIntegration:
      "Every constitutional decision is scoped to a specific Constitution version. " +
      "The decision_links table allows explicit association to constitution versions, objectives, " +
      "constraints, and amendments, enabling impact analysis across the constitutional hierarchy.",

    states: [
      {
        status: "draft",
        label: "Draft",
        description: "Decision is being drafted. Only editable in this state.",
        terminal: false,
        allowedTransitions: DECISION_ALLOWED_TRANSITIONS.draft,
      },
      {
        status: "proposed",
        label: "Proposed",
        description: "Decision has been formally proposed for review and approval.",
        terminal: false,
        allowedTransitions: DECISION_ALLOWED_TRANSITIONS.proposed,
      },
      {
        status: "approved",
        label: "Approved",
        description:
          "Decision has been approved by the designated authority. A selected option is required.",
        terminal: false,
        allowedTransitions: DECISION_ALLOWED_TRANSITIONS.approved,
      },
      {
        status: "rejected",
        label: "Rejected",
        description: "Decision was rejected. Terminal state.",
        terminal: true,
        allowedTransitions: DECISION_ALLOWED_TRANSITIONS.rejected,
      },
      {
        status: "executed",
        label: "Executed",
        description: "Decision has been executed and its effects applied. Terminal state.",
        terminal: true,
        allowedTransitions: DECISION_ALLOWED_TRANSITIONS.executed,
      },
      {
        status: "cancelled",
        label: "Cancelled",
        description: "Decision was cancelled before execution. Terminal state.",
        terminal: true,
        allowedTransitions: DECISION_ALLOWED_TRANSITIONS.cancelled,
      },
    ],

    terminalStates: [...DECISION_TERMINAL_STATES],

    auditEvents: [
      "CONSTITUTIONAL_DECISION_CREATED",
      "CONSTITUTIONAL_DECISION_UPDATED",
      "CONSTITUTIONAL_DECISION_PROPOSED",
      "CONSTITUTIONAL_DECISION_APPROVED",
      "CONSTITUTIONAL_DECISION_REJECTED",
      "CONSTITUTIONAL_DECISION_EXECUTED",
      "CONSTITUTIONAL_DECISION_CANCELLED",
      "CONSTITUTIONAL_DECISION_OPTION_ADDED",
      "CONSTITUTIONAL_DECISION_OPTION_SELECTED",
      "CONSTITUTIONAL_DECISION_EVIDENCE_ATTACHED",
      "CONSTITUTIONAL_DECISION_LINK_CREATED",
      "CONSTITUTIONAL_DECISION_AMENDMENT_GENERATED",
    ],

    governanceRules: [
      "Rule 1: Every decision belongs to a Constitution.",
      "Rule 2: Every decision must declare a decision authority.",
      "Rule 3: Every decision must register context.",
      "Rule 4: Every decision must register a problem statement.",
      "Rule 5: Only Draft decisions can be edited.",
      "Rule 6: Only Approved decisions can be executed.",
      "Rule 7: Executed is a terminal state.",
      "Rule 8: Rejected is a terminal state.",
      "Rule 9: Cancelled is a terminal state.",
      "Rule 10: Every state transition emits an audit event.",
      "Rule 11: Workspace isolation is enforced on all operations.",
      "Rule 12: A decision cannot be approved without a selected option.",
      "Rule 13: Amendments can only be generated from Approved or Executed decisions.",
      "Rule 14: Every generated amendment maintains a bidirectional link to the origin decision.",
    ],
  };
}
