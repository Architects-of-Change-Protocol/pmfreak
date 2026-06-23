import type { ProjectionTaskTemplate } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Projection Templates
//
// Each governance action type maps to a canonical set of projected tasks.
// Templates are deterministic — same action type always produces same structure.
// ─────────────────────────────────────────────────────────────────────────────

export type ProjectionTemplate = {
  titleSuffix: string;
  description: string;
  tasks: ProjectionTaskTemplate[];
  baseDependencyTypes: Array<"decision" | "authority" | "ratification" | "amendment" | "resource">;
  baseParticipants: Array<{ participantType: string; responsibility: string }>;
};

const TEMPLATES: Record<string, ProjectionTemplate> = {
  create_delegation: {
    titleSuffix: "Delegation Creation",
    description: "Structured execution plan for creating a governance delegation.",
    tasks: [
      { taskName: "Validate Authority",   taskDescription: "Confirm delegating party holds the required authority.",   estimatedHours: 2, sequenceOrder: 1, ownerType: "sponsor" },
      { taskName: "Prepare Delegation",   taskDescription: "Draft delegation document with scope and conditions.",      estimatedHours: 2, sequenceOrder: 2, ownerType: "project_manager" },
      { taskName: "Review Delegation",    taskDescription: "Governance review of the proposed delegation.",            estimatedHours: 2, sequenceOrder: 3, ownerType: "sponsor" },
      { taskName: "Approve Delegation",   taskDescription: "Formal approval and publication of the delegation.",       estimatedHours: 2, sequenceOrder: 4, ownerType: "sponsor" },
    ],
    baseDependencyTypes: ["authority"],
    baseParticipants: [
      { participantType: "sponsor",         responsibility: "Approves and issues the delegation." },
      { participantType: "project_manager", responsibility: "Prepares delegation documentation." },
    ],
  },

  request_ratification: {
    titleSuffix: "Ratification Request",
    description: "Structured execution plan for requesting formal ratification.",
    tasks: [
      { taskName: "Prepare Ratification Package", taskDescription: "Compile all evidence and documentation for ratification.",  estimatedHours: 3, sequenceOrder: 1, ownerType: "project_manager" },
      { taskName: "Identify Approvers",           taskDescription: "Confirm the ratification authority and quorum.",             estimatedHours: 1, sequenceOrder: 2, ownerType: "sponsor" },
      { taskName: "Execute Review",               taskDescription: "Conduct the formal ratification review session.",            estimatedHours: 3, sequenceOrder: 3, ownerType: "sponsor" },
      { taskName: "Record Ratification",          taskDescription: "Document outcome and publish ratification result.",          estimatedHours: 1, sequenceOrder: 4, ownerType: "project_manager" },
    ],
    baseDependencyTypes: ["ratification", "authority"],
    baseParticipants: [
      { participantType: "sponsor",         responsibility: "Chairs ratification review and signs outcome." },
      { participantType: "project_manager", responsibility: "Prepares package and records result." },
    ],
  },

  initiate_governance_review: {
    titleSuffix: "Governance Review",
    description: "Structured execution plan for initiating a governance review.",
    tasks: [
      { taskName: "Gather Evidence",       taskDescription: "Collect all relevant artifacts, decisions, and context.",   estimatedHours: 3, sequenceOrder: 1, ownerType: "project_manager" },
      { taskName: "Identify Stakeholders", taskDescription: "Map all parties affected by or participating in the review.", estimatedHours: 2, sequenceOrder: 2, ownerType: "sponsor" },
      { taskName: "Conduct Review",        taskDescription: "Execute the governance review session with all stakeholders.", estimatedHours: 4, sequenceOrder: 3, ownerType: "technical_lead" },
      { taskName: "Publish Findings",      taskDescription: "Distribute review findings and record governance decisions.",   estimatedHours: 3, sequenceOrder: 4, ownerType: "project_manager" },
    ],
    baseDependencyTypes: ["decision", "resource"],
    baseParticipants: [
      { participantType: "sponsor",         responsibility: "Authorises the governance review." },
      { participantType: "project_manager", responsibility: "Coordinates review logistics and publishes findings." },
      { participantType: "technical_lead",  responsibility: "Leads technical aspects of the review." },
    ],
  },

  review_amendment: {
    titleSuffix: "Amendment Review",
    description: "Structured execution plan for reviewing a proposed amendment.",
    tasks: [
      { taskName: "Review Amendment",          taskDescription: "Analyse the proposed amendment text and intent.",              estimatedHours: 3, sequenceOrder: 1, ownerType: "technical_lead" },
      { taskName: "Impact Assessment",         taskDescription: "Evaluate governance and operational impact of the amendment.", estimatedHours: 4, sequenceOrder: 2, ownerType: "technical_lead" },
      { taskName: "Governance Validation",     taskDescription: "Validate the amendment against constitutional principles.",     estimatedHours: 3, sequenceOrder: 3, ownerType: "sponsor" },
      { taskName: "Approval Recommendation",  taskDescription: "Prepare and submit the formal approval recommendation.",        estimatedHours: 2, sequenceOrder: 4, ownerType: "project_manager" },
    ],
    baseDependencyTypes: ["amendment", "decision"],
    baseParticipants: [
      { participantType: "sponsor",         responsibility: "Validates constitutional alignment." },
      { participantType: "project_manager", responsibility: "Coordinates review and submits recommendation." },
      { participantType: "technical_lead",  responsibility: "Leads impact assessment and technical review." },
    ],
  },

  review_decision: {
    titleSuffix: "Decision Review",
    description: "Structured execution plan for reviewing a governance decision.",
    tasks: [
      { taskName: "Gather Decision Context", taskDescription: "Collect all evidence related to the decision.",         estimatedHours: 2, sequenceOrder: 1, ownerType: "project_manager" },
      { taskName: "Review Decision",         taskDescription: "Analyse the decision for correctness and compliance.",  estimatedHours: 3, sequenceOrder: 2, ownerType: "technical_lead" },
      { taskName: "Validate Outcome",        taskDescription: "Confirm the decision outcome is governance-compliant.", estimatedHours: 2, sequenceOrder: 3, ownerType: "sponsor" },
      { taskName: "Record Findings",         taskDescription: "Document review findings in the governance record.",    estimatedHours: 1, sequenceOrder: 4, ownerType: "project_manager" },
    ],
    baseDependencyTypes: ["decision"],
    baseParticipants: [
      { participantType: "sponsor",         responsibility: "Final validation authority." },
      { participantType: "project_manager", responsibility: "Coordinates review process." },
      { participantType: "technical_lead",  responsibility: "Reviews decision for technical compliance." },
    ],
  },

  assign_authority: {
    titleSuffix: "Authority Assignment",
    description: "Structured execution plan for assigning governance authority.",
    tasks: [
      { taskName: "Validate Scope",     taskDescription: "Confirm scope and limits of authority to be assigned.",        estimatedHours: 2, sequenceOrder: 1, ownerType: "sponsor" },
      { taskName: "Prepare Assignment", taskDescription: "Document the authority assignment with conditions.",            estimatedHours: 2, sequenceOrder: 2, ownerType: "project_manager" },
      { taskName: "Obtain Approval",    taskDescription: "Secure formal approval for the authority assignment.",          estimatedHours: 2, sequenceOrder: 3, ownerType: "sponsor" },
      { taskName: "Publish Assignment", taskDescription: "Register and publish the authority assignment in the registry.", estimatedHours: 2, sequenceOrder: 4, ownerType: "project_manager" },
    ],
    baseDependencyTypes: ["authority"],
    baseParticipants: [
      { participantType: "sponsor",         responsibility: "Approves and grants authority." },
      { participantType: "project_manager", responsibility: "Documents and registers authority." },
    ],
  },
};

const DEFAULT_TEMPLATE: ProjectionTemplate = {
  titleSuffix: "Governance Action",
  description: "Structured execution plan for a governance action.",
  tasks: [
    { taskName: "Analyse Context",    taskDescription: "Understand the governance context and requirements.",      estimatedHours: 2, sequenceOrder: 1, ownerType: "project_manager" },
    { taskName: "Prepare Response",   taskDescription: "Prepare the required governance response or artefact.",    estimatedHours: 3, sequenceOrder: 2, ownerType: "project_manager" },
    { taskName: "Review and Approve", taskDescription: "Conduct governance review and obtain formal approval.",    estimatedHours: 2, sequenceOrder: 3, ownerType: "sponsor" },
    { taskName: "Record Outcome",     taskDescription: "Document and publish the governance outcome.",             estimatedHours: 1, sequenceOrder: 4, ownerType: "project_manager" },
  ],
  baseDependencyTypes: ["resource"],
  baseParticipants: [
    { participantType: "sponsor",         responsibility: "Approves governance outcome." },
    { participantType: "project_manager", responsibility: "Coordinates execution." },
  ],
};

export function getProjectionTemplate(actionType: string): ProjectionTemplate {
  return TEMPLATES[actionType] ?? DEFAULT_TEMPLATE;
}
