import { amendmentAllowedTransitions, AMENDMENT_TERMINAL_STATES } from "./amendment-state-machine";
import type { AmendmentGovernanceExplanation, AmendmentStatus } from "./amendment-types";

export function explainConstitutionAmendmentGovernance(): AmendmentGovernanceExplanation {
  const stateMeta: Record<AmendmentStatus, { label: string; description: string }> = {
    draft:     { label: "Draft",     description: "Created. Editable. Not submitted for review." },
    proposed:  { label: "Proposed",  description: "Submitted for approval. Frozen — no edits allowed." },
    approved:  { label: "Approved",  description: "Approved by a reviewer. Ready to be applied." },
    rejected:  { label: "Rejected",  description: "Rejected. Terminal state. No further transitions." },
    withdrawn: { label: "Withdrawn", description: "Withdrawn. Terminal state. No further transitions." },
    applied:   { label: "Applied",   description: "Applied to the Constitution. Terminal state. Version incremented. Snapshots created." },
  };

  const states = (Object.keys(amendmentAllowedTransitions) as AmendmentStatus[]).map((status) => ({
    status,
    label: stateMeta[status].label,
    description: stateMeta[status].description,
    terminal: AMENDMENT_TERMINAL_STATES.has(status),
    allowedTransitions: [...amendmentAllowedTransitions[status]],
  }));

  return {
    whatIsAnAmendment:
      "A Constitutional Amendment is a formal proposal to modify a Project Constitution. It follows a governed lifecycle — Draft → Proposed → Approved → Applied — ensuring every change is traceable, auditable, and reversible.",
    approvalFlow: [
      "1. Author creates a Draft Amendment with title, description, justification, and field-level changes.",
      "2. Author proposes the Amendment (draft → proposed), freezing it for review.",
      "3. Reviewer approves (proposed → approved) or rejects (proposed → rejected) the Amendment.",
      "4. If approved, the Amendment is applied (approved → applied), modifying the Constitution and incrementing its version.",
      "5. At any point before applied, the Amendment can be withdrawn (draft/proposed → withdrawn).",
    ],
    versioning:
      "Each applied Amendment increments the constitution_version counter by 1. This counter tracks governance changes independently of the lifecycle_version, which tracks status transitions.",
    snapshots:
      "Two snapshots are created for each applied Amendment: one BEFORE (capturing the prior constitution state) and one AFTER (capturing the post-amendment state). Snapshots are immutable and keyed by constitution_version.",
    constitutionalIntegrity:
      "Active constitutions are protected from direct modification. All changes must flow through the Amendment process. Only Draft amendments are editable. Only Approved amendments can be applied. Rejected, Withdrawn, and Applied states are terminal.",
    states,
    terminalStates: [...AMENDMENT_TERMINAL_STATES],
    auditEvents: [
      "CONSTITUTION_AMENDMENT_CREATED",
      "CONSTITUTION_AMENDMENT_UPDATED",
      "CONSTITUTION_AMENDMENT_PROPOSED",
      "CONSTITUTION_AMENDMENT_APPROVED",
      "CONSTITUTION_AMENDMENT_REJECTED",
      "CONSTITUTION_AMENDMENT_WITHDRAWN",
      "CONSTITUTION_AMENDMENT_APPLIED",
      "CONSTITUTION_SNAPSHOT_CREATED",
      "CONSTITUTION_VERSION_INCREMENTED",
    ],
    governanceRules: [
      "Rule 1: An Active Constitution cannot be modified directly.",
      "Rule 2: Every modification requires a Constitutional Amendment.",
      "Rule 3: Only Draft amendments can be edited.",
      "Rule 4: Only Approved amendments can be applied.",
      "Rule 5: Rejected is a terminal state.",
      "Rule 6: Withdrawn is a terminal state.",
      "Rule 7: Applied is a terminal state.",
      "Rule 8: Every amendment application generates two snapshots (before and after).",
      "Rule 9: Every amendment application increments the constitution_version by 1.",
      "Rule 10: Every action emits an audit event via the platform_events system.",
      "Rule 11: Workspace isolation is enforced on all amendment operations.",
      "Rule 12: An amendment cannot be applied twice.",
    ],
  };
}
