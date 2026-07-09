// PMFreak AOC Read-Only Integration Surface v1 — deterministic demo fixtures
//
// Fixture data for tests and demo/dev mode. Every ID is a fake,
// demo-scoped identifier (`*.demo.*`). None of this is real Datasys or
// customer data — do not add real project codes, customer names, emails,
// contract numbers, or invoice numbers here.

import type {
  PMFreakActionProposalReadModel,
  PMFreakAgentReadModel,
  PMFreakApprovalReferenceReadModel,
  PMFreakEvidenceReferenceReadModel,
  PMFreakMilestoneReadModel,
  PMFreakProjectReadModel,
  PMFreakRiskReadModel,
  PMFreakTaskReadModel,
} from "./pmfreak-read-models";

export const PMFREAK_DEMO_WORKSPACE_ID = "workspace.demo.pmfreak" as const;
export const PMFREAK_DEMO_TENANT_ID = "tenant.demo.pmfreak" as const;
export const PMFREAK_DEMO_PROJECT_ID = "project.demo.network-refresh" as const;
export const PMFREAK_DEMO_CUSTOMER_ID = "customer.demo.acme" as const;
export const PMFREAK_DEMO_AGENT_ID = "pmfreak.agent.billing_readiness" as const;
export const PMFREAK_DEMO_MILESTONE_ID = "milestone.demo.network-refresh.phase-1-delivery" as const;
export const PMFREAK_DEMO_TASK_ID = "task.demo.network-refresh.collect-acceptance" as const;
export const PMFREAK_DEMO_RISK_ID = "risk.demo.unconfirmed-customer-acceptance" as const;
export const PMFREAK_DEMO_EVIDENCE_REFERENCE_ID = "evidence.demo.customer-acceptance.missing" as const;
export const PMFREAK_DEMO_APPROVAL_REFERENCE_ID = "approval.demo.billing-review.missing" as const;
export const PMFREAK_DEMO_ACTION_PROPOSAL_ID = "proposal.demo.billing-readiness.mark-ready" as const;

export const PMFREAK_DEMO_PROJECTS: PMFreakProjectReadModel[] = [
  {
    projectId: PMFREAK_DEMO_PROJECT_ID,
    workspaceId: PMFREAK_DEMO_WORKSPACE_ID,
    tenantId: PMFREAK_DEMO_TENANT_ID,
    customerId: PMFREAK_DEMO_CUSTOMER_ID,
    projectName: "Network Refresh (Demo)",
    projectStatus: "ready_for_billing_review",
    phase: "closure",
    milestoneIds: [PMFREAK_DEMO_MILESTONE_ID],
    taskIds: [PMFREAK_DEMO_TASK_ID],
    riskIds: [PMFREAK_DEMO_RISK_ID],
    evidenceReferenceIds: [PMFREAK_DEMO_EVIDENCE_REFERENCE_ID],
    approvalReferenceIds: [PMFREAK_DEMO_APPROVAL_REFERENCE_ID],
    actionProposalIds: [PMFREAK_DEMO_ACTION_PROPOSAL_ID],
    sourceUpdatedAt: "2026-01-05T00:00:00.000Z",
    sourceUrl: "https://pmfreak.demo.local/projects/network-refresh",
    metadata: { demo: true },
  },
];

export const PMFREAK_DEMO_AGENTS: PMFreakAgentReadModel[] = [
  {
    agentId: PMFREAK_DEMO_AGENT_ID,
    agentDisplayName: "Billing Readiness Agent (Demo)",
    role: "billing_readiness_agent",
    status: "active",
    workspaceIds: [PMFREAK_DEMO_WORKSPACE_ID],
    projectIds: [PMFREAK_DEMO_PROJECT_ID],
    sourceUpdatedAt: "2026-01-05T00:00:00.000Z",
    metadata: { demo: true },
  },
];

export const PMFREAK_DEMO_MILESTONES: PMFreakMilestoneReadModel[] = [
  {
    milestoneId: PMFREAK_DEMO_MILESTONE_ID,
    projectId: PMFREAK_DEMO_PROJECT_ID,
    title: "Phase 1 Delivery (Demo)",
    status: "billing_review",
    evidenceReferenceIds: [PMFREAK_DEMO_EVIDENCE_REFERENCE_ID],
    approvalReferenceIds: [PMFREAK_DEMO_APPROVAL_REFERENCE_ID],
    sourceUpdatedAt: "2026-01-05T00:00:00.000Z",
    metadata: { demo: true },
  },
];

export const PMFREAK_DEMO_TASKS: PMFreakTaskReadModel[] = [
  {
    taskId: PMFREAK_DEMO_TASK_ID,
    projectId: PMFREAK_DEMO_PROJECT_ID,
    milestoneId: PMFREAK_DEMO_MILESTONE_ID,
    title: "Collect customer acceptance (Demo)",
    status: "in_progress",
    assigneeAgentId: PMFREAK_DEMO_AGENT_ID,
    sourceUpdatedAt: "2026-01-05T00:00:00.000Z",
    metadata: { demo: true },
  },
];

export const PMFREAK_DEMO_RISKS: PMFreakRiskReadModel[] = [
  {
    riskId: PMFREAK_DEMO_RISK_ID,
    projectId: PMFREAK_DEMO_PROJECT_ID,
    title: "Customer acceptance not yet confirmed (Demo)",
    severity: "medium",
    status: "open",
    evidenceReferenceIds: [PMFREAK_DEMO_EVIDENCE_REFERENCE_ID],
    approvalReferenceIds: [PMFREAK_DEMO_APPROVAL_REFERENCE_ID],
    sourceUpdatedAt: "2026-01-05T00:00:00.000Z",
    metadata: { demo: true },
  },
];

export const PMFREAK_DEMO_EVIDENCE_REFERENCES: PMFreakEvidenceReferenceReadModel[] = [
  {
    evidenceReferenceId: PMFREAK_DEMO_EVIDENCE_REFERENCE_ID,
    projectId: PMFREAK_DEMO_PROJECT_ID,
    milestoneId: PMFREAK_DEMO_MILESTONE_ID,
    riskId: PMFREAK_DEMO_RISK_ID,
    actionProposalId: PMFREAK_DEMO_ACTION_PROPOSAL_ID,
    evidenceKind: "customer_acceptance_record",
    present: false,
    sourceUpdatedAt: "2026-01-05T00:00:00.000Z",
    redacted: false,
    metadata: { demo: true },
  },
];

export const PMFREAK_DEMO_APPROVAL_REFERENCES: PMFreakApprovalReferenceReadModel[] = [
  {
    approvalReferenceId: PMFREAK_DEMO_APPROVAL_REFERENCE_ID,
    projectId: PMFREAK_DEMO_PROJECT_ID,
    milestoneId: PMFREAK_DEMO_MILESTONE_ID,
    riskId: PMFREAK_DEMO_RISK_ID,
    actionProposalId: PMFREAK_DEMO_ACTION_PROPOSAL_ID,
    approvalKind: "billing_review",
    present: false,
    sourceUpdatedAt: "2026-01-05T00:00:00.000Z",
    redacted: false,
    metadata: { demo: true },
  },
];

export const PMFREAK_DEMO_ACTION_PROPOSALS: PMFreakActionProposalReadModel[] = [
  {
    actionProposalId: PMFREAK_DEMO_ACTION_PROPOSAL_ID,
    projectId: PMFREAK_DEMO_PROJECT_ID,
    agentId: PMFREAK_DEMO_AGENT_ID,
    passportId: "passport.demo.pmfreak.billing_readiness",
    proposedActionId: "action.demo.mark-milestone-billing-ready",
    category: "billing",
    status: "pending_aoc_review",
    contextFlags: ["billing_sensitive", "project_closure_sensitive"],
    evidenceReferenceIds: [PMFREAK_DEMO_EVIDENCE_REFERENCE_ID],
    approvalReferenceIds: [PMFREAK_DEMO_APPROVAL_REFERENCE_ID],
    sourceUpdatedAt: "2026-01-05T00:00:00.000Z",
    metadata: { demo: true },
  },
];
