import type { PMFreakAocGovernedActionGateResult } from "./pmfreak-aoc-governed-action-gate-result";
import type { PMFreakAocGovernedActionGateSeverity, PMFreakAocGovernedActionGateVerdict } from "./pmfreak-aoc-governed-action-gate-types";

export type PMFreakAocGovernedActionGateDetailViewModelRow = {
  label: string;
  value: string | string[] | boolean;
  emptyLabel?: string;
};

export type PMFreakAocGovernedActionGateDetailViewModelSection = {
  sectionId: string;
  title: string;
  rows: PMFreakAocGovernedActionGateDetailViewModelRow[];
};

export type PMFreakAocGovernedActionGateDetailViewModel = {
  title: string;
  subtitle: string;

  gateBadge: {
    label: string;
    verdict: PMFreakAocGovernedActionGateVerdict;
    severity: PMFreakAocGovernedActionGateSeverity;
  };

  canProceed: boolean;

  sections: PMFreakAocGovernedActionGateDetailViewModelSection[];

  safeNextStep: string;
  warnings: string[];
  errors: string[];
  safeLabels: string[];

  gateOnly: true;
};

function listRow(label: string, values: string[], emptyLabel: string): PMFreakAocGovernedActionGateDetailViewModelRow {
  return { label, value: [...values], emptyLabel };
}

// Pure view-model construction from an already-computed gate result. Only
// surfaces the result's own safe fields — no raw metadata or secrets, and
// no execution/mutation/writeback claims.
export function createPMFreakAocGovernedActionGateDetailViewModel(
  result: PMFreakAocGovernedActionGateResult,
): PMFreakAocGovernedActionGateDetailViewModel {
  return {
    title: result.actionTitle ?? `Gate result ${result.gateResultId}`,
    subtitle: `AOC governed action gate result for request ${result.requestId ?? "unspecified"}`,
    gateBadge: {
      label: result.verdict,
      verdict: result.verdict,
      severity: result.severity,
    },
    canProceed: result.canProceed,
    sections: [
      {
        sectionId: "gate-result",
        title: "Gate Result",
        rows: [
          { label: "Verdict", value: result.verdict },
          { label: "Severity", value: result.severity },
          { label: "Can proceed", value: result.canProceed },
          { label: "Blocked", value: result.blocked },
        ],
      },
      {
        sectionId: "aoc-decision",
        title: "AOC Decision",
        rows: [
          { label: "Decision", value: result.aocDecision ?? "", emptyLabel: "Not specified" },
          { label: "Summary", value: result.safeSummary },
        ],
      },
      {
        sectionId: "action-context",
        title: "Action Context",
        rows: [
          { label: "Project", value: result.projectId ?? "", emptyLabel: "Not specified" },
          { label: "Agent", value: result.agentId ?? "", emptyLabel: "Not specified" },
          { label: "Agent role", value: result.agentRole ?? "", emptyLabel: "Not specified" },
          { label: "Action", value: result.actionTitle ?? "", emptyLabel: "Not specified" },
        ],
      },
      {
        sectionId: "evidence",
        title: "Evidence",
        rows: [
          listRow("Required evidence", result.requiredEvidenceIds, "No evidence required"),
          listRow("Missing evidence", result.missingEvidenceIds, "No missing evidence"),
        ],
      },
      {
        sectionId: "approvals",
        title: "Approvals",
        rows: [
          listRow("Required approvals", result.requiredApprovalIds, "No approvals required"),
          listRow("Missing approvals", result.missingApprovalIds, "No missing approvals"),
        ],
      },
      {
        sectionId: "reasons",
        title: "Reasons",
        rows: [
          listRow("Reason codes", result.reasonCodes, "No reason codes"),
          listRow("Decision reason codes", result.decisionReasonCodes, "No decision reason codes"),
        ],
      },
      {
        sectionId: "trace",
        title: "Trace",
        rows: result.trace.map((step) => ({ label: step.label, value: step.summary })),
      },
      {
        sectionId: "safety",
        title: "Safety",
        rows: [
          listRow("Safe labels", result.safeLabels, "No safe labels"),
          listRow("Warnings", result.warnings, "No warnings"),
          listRow("Errors", result.errors, "No errors"),
          { label: "Gate only", value: true },
        ],
      },
    ],
    safeNextStep: result.safeNextStep,
    warnings: [...result.warnings],
    errors: [...result.errors],
    safeLabels: [...result.safeLabels],
    gateOnly: true,
  };
}
