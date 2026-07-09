import type { PMFreakAocGovernedActionGateResult } from "./pmfreak-aoc-governed-action-gate-result";
import { createPMFreakAocGateResultUIActionHints } from "./pmfreak-aoc-gate-result-ui-action-hint";
import type { PMFreakAocGateResultUIActionHint } from "./pmfreak-aoc-gate-result-ui-action-hint";
import { createPMFreakAocGateResultUIBadge } from "./pmfreak-aoc-gate-result-ui-badge";
import type { PMFreakAocGateResultUIBadge } from "./pmfreak-aoc-gate-result-ui-badge";
import { assertNoPMFreakAocGateResultUIOverclaim } from "./pmfreak-aoc-gate-result-ui-claim-safety";
import { createPMFreakAocGateResultUIConfig } from "./pmfreak-aoc-gate-result-ui-config";
import type { PMFreakAocGateResultUIConfig } from "./pmfreak-aoc-gate-result-ui-config";
import { createPMFreakAocGateSafetyDisclaimerViewModel } from "./pmfreak-aoc-gate-result-ui-safety-disclaimer";
import type { PMFreakAocGateSafetyDisclaimerViewModel } from "./pmfreak-aoc-gate-result-ui-safety-disclaimer";

export type PMFreakAocGateResultDetailPanelRow = {
  label: string;
  value: string | string[] | boolean;
  emptyLabel?: string;
};

export type PMFreakAocGateResultDetailPanelSection = {
  sectionId: string;
  title: string;
  rows: PMFreakAocGateResultDetailPanelRow[];
};

export type PMFreakAocGateResultDetailPanelViewModel = {
  kind: "gate_result_detail_panel";
  title: string;
  subtitle: string;
  badge: PMFreakAocGateResultUIBadge;
  canProceed: boolean;

  sections: PMFreakAocGateResultDetailPanelSection[];

  safeNextStep: string;
  safetyDisclaimer: PMFreakAocGateSafetyDisclaimerViewModel;
  actionHints: PMFreakAocGateResultUIActionHint[];

  presentationOnly: true;
};

export type PMFreakAocGateResultDetailPanelViewModelInput = {
  result: PMFreakAocGovernedActionGateResult;
  config?: Partial<PMFreakAocGateResultUIConfig>;
};

function listRow(label: string, values: string[], emptyLabel: string): PMFreakAocGateResultDetailPanelRow {
  return { label, value: [...values], emptyLabel };
}

// Pure view-model construction from an already-computed gate result. Every
// row surfaces only the result's own safe fields — no raw secrets, auth
// headers, connection strings, tokens or private metadata are ever
// included, since none of the source fields carry them.
export function createPMFreakAocGateResultDetailPanelViewModel(input: PMFreakAocGateResultDetailPanelViewModelInput): PMFreakAocGateResultDetailPanelViewModel {
  const { result } = input;
  createPMFreakAocGateResultUIConfig(input.config);

  const subtitle = result.actionTitle
    ? `Proposed action: ${result.actionTitle}`
    : `AOC governed action gate result for request ${result.requestId ?? "unspecified"}`;

  const sections: PMFreakAocGateResultDetailPanelSection[] = [
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
      sectionId: "requirements",
      title: "Requirements",
      rows: [
        listRow("Required evidence", result.requiredEvidenceIds, "No evidence required"),
        listRow("Missing evidence", result.missingEvidenceIds, "No missing evidence"),
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
      sectionId: "warnings",
      title: "Warnings",
      rows: [listRow("Warnings", result.warnings, "No warnings")],
    },
    {
      sectionId: "errors",
      title: "Errors",
      rows: [listRow("Errors", result.errors, "No errors")],
    },
    {
      sectionId: "safety",
      title: "Safety",
      rows: [
        listRow("Safe labels", result.safeLabels, "No safe labels"),
        { label: "Presentation only", value: true },
      ],
    },
  ];

  const candidate: PMFreakAocGateResultDetailPanelViewModel = {
    kind: "gate_result_detail_panel",
    title: "AOC Gate Result",
    subtitle,
    badge: createPMFreakAocGateResultUIBadge(result),
    canProceed: result.canProceed,
    sections,
    safeNextStep: result.safeNextStep,
    safetyDisclaimer: createPMFreakAocGateSafetyDisclaimerViewModel(result),
    actionHints: createPMFreakAocGateResultUIActionHints(result),
    presentationOnly: true,
  };

  // The safety disclaimer's `passed` copy legitimately negates several
  // prohibited-overclaim phrases ("does not mean ... legally approved").
  // Checking every other field individually (rather than the whole
  // candidate) mirrors the base gate module, which claim-safety checks
  // only its own newly-constructed summary/next-step text rather than
  // the full result object.
  assertNoPMFreakAocGateResultUIOverclaim({ ...candidate, safetyDisclaimer: undefined });

  return candidate;
}
