import type { PMFreakAocDecisionInboxDecisionStatus, PMFreakAocDecisionInboxItem, PMFreakAocDecisionInboxSeverity } from "./pmfreak-aoc-decision-inbox-types";

export type PMFreakAocDecisionInboxDetailViewModelRow = {
  label: string;
  value: string | string[];
  emptyLabel?: string;
};

export type PMFreakAocDecisionInboxDetailViewModelSection = {
  sectionId: string;
  title: string;
  rows: PMFreakAocDecisionInboxDetailViewModelRow[];
};

export type PMFreakAocDecisionInboxDetailViewModel = {
  title: string;
  subtitle: string;
  decisionBadge: {
    label: string;
    severity: PMFreakAocDecisionInboxSeverity;
    status: PMFreakAocDecisionInboxDecisionStatus;
  };
  sections: PMFreakAocDecisionInboxDetailViewModelSection[];
  safeNextStep: string;
  warnings: string[];
  errors: string[];
  safeLabels: string[];
  displayOnly: true;
};

function listRow(label: string, values: string[], emptyLabel: string): PMFreakAocDecisionInboxDetailViewModelRow {
  return { label, value: [...values], emptyLabel };
}

// Pure view-model construction from an already-normalized inbox item. Only
// surfaces the item's own safe fields — no raw metadata or secrets, and no
// enforcement/execution claims.
export function createPMFreakAocDecisionInboxDetailViewModel(item: PMFreakAocDecisionInboxItem): PMFreakAocDecisionInboxDetailViewModel {
  return {
    title: item.actionTitle ?? item.decisionLabel,
    subtitle: `AOC governance decision for request ${item.requestId}`,
    decisionBadge: {
      label: item.decisionLabel,
      severity: item.decisionSeverity,
      status: item.decisionStatus,
    },
    sections: [
      {
        sectionId: "decision",
        title: "Decision",
        rows: [
          { label: "Decision", value: item.decisionLabel },
          { label: "Status", value: item.decisionStatus },
          { label: "Category", value: item.category },
          { label: "Summary", value: item.safeSummary },
        ],
      },
      {
        sectionId: "context",
        title: "Context",
        rows: [
          { label: "Project", value: item.projectId ?? "", emptyLabel: "Not specified" },
          { label: "Agent", value: item.agentId ?? "", emptyLabel: "Not specified" },
          { label: "Agent role", value: item.agentRole ?? "", emptyLabel: "Not specified" },
          { label: "Action", value: item.actionTitle ?? "", emptyLabel: "Not specified" },
          { label: "Source", value: item.source },
        ],
      },
      {
        sectionId: "evidence",
        title: "Evidence",
        rows: [
          listRow("Required evidence", item.requiredEvidenceIds, "No evidence required"),
          listRow("Missing evidence", item.missingEvidenceIds, "No missing evidence"),
        ],
      },
      {
        sectionId: "approvals",
        title: "Approvals",
        rows: [
          listRow("Required approvals", item.requiredApprovalIds, "No approvals required"),
          listRow("Missing approvals", item.missingApprovalIds, "No missing approvals"),
        ],
      },
      {
        sectionId: "reasons",
        title: "Reasons",
        rows: [listRow("Reason codes", item.reasonCodes, "No reason codes")],
      },
      {
        sectionId: "warnings",
        title: "Warnings",
        rows: [listRow("Warnings", item.warnings, "No warnings")],
      },
      {
        sectionId: "errors",
        title: "Errors",
        rows: [listRow("Errors", item.errors, "No errors")],
      },
      {
        sectionId: "safety",
        title: "Safety",
        rows: [
          listRow("Safe labels", item.safeLabels, "No safe labels"),
          { label: "Display only", value: "true" },
        ],
      },
    ],
    safeNextStep: item.safeNextStep,
    warnings: [...item.warnings],
    errors: [...item.errors],
    safeLabels: [...item.safeLabels],
    displayOnly: true,
  };
}
