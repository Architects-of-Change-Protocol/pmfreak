import { allowedTransitions, TERMINAL_STATES } from "./state-machine";
import type { ConstitutionLifecycleExplanation, ConstitutionStatus } from "./types";

export function explainConstitutionLifecycle(): ConstitutionLifecycleExplanation {
  const stateMeta: Record<ConstitutionStatus, { label: string; description: string }> = {
    draft:     { label: "Draft",     description: "Constitution created. Editable. Not approved. Not executable." },
    proposed:  { label: "Proposed",  description: "Constitution submitted for review. Partially frozen. Pending approval." },
    approved:  { label: "Approved",  description: "Constitution approved and ready for activation. May receive observations." },
    active:    { label: "Active",    description: "Constitution is in force. Governs the project. Official source of truth." },
    suspended: { label: "Suspended", description: "Constitution temporarily suspended. Project paused. History preserved." },
    closed:    { label: "Closed",    description: "Project finalised. No ordinary changes admitted." },
    archived:  { label: "Archived",  description: "Constitution archived. Read-only. Historical preservation only." },
  };

  const states = (Object.keys(allowedTransitions) as ConstitutionStatus[]).map((status) => ({
    status,
    label: stateMeta[status].label,
    description: stateMeta[status].description,
    terminal: TERMINAL_STATES.has(status),
    allowedTransitions: [...allowedTransitions[status]],
  }));

  return {
    states,
    terminalStates: [...TERMINAL_STATES],
    auditEvents: [
      "CONSTITUTION_PROPOSED",
      "CONSTITUTION_APPROVED",
      "CONSTITUTION_ACTIVATED",
      "CONSTITUTION_SUSPENDED",
      "CONSTITUTION_CLOSED",
      "CONSTITUTION_ARCHIVED",
      "CONSTITUTION_STATUS_CHANGED",
    ],
    rules: [
      "No transitions outside the defined state machine are permitted.",
      "Transition to the same status is not allowed.",
      "Archived is a terminal state — no further transitions.",
      "Closed can only transition to Archived.",
      "Every transition requires an authenticated actor (actorId must be a valid UUID).",
      "Every transition emits a specific audit event and the generic CONSTITUTION_STATUS_CHANGED event.",
      "Every transition increments lifecycle_version by 1.",
      "All queries and mutations are scoped to the workspace (workspace isolation enforced).",
    ],
  };
}
