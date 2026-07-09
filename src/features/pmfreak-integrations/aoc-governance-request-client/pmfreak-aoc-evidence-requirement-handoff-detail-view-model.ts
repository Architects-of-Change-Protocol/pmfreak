import type { PMFreakAocEvidenceRequirementChecklistViewModel } from "./pmfreak-aoc-evidence-requirement-handoff-checklist-view-model";
import type { PMFreakAocEvidenceRequirementHandoffPackage } from "./pmfreak-aoc-evidence-requirement-handoff-package";
import type { PMFreakAocEvidenceRequirementReviewPacket } from "./pmfreak-aoc-evidence-requirement-handoff-review-packet";

export type PMFreakAocEvidenceRequirementHandoffDetailViewModelRow = {
  label: string;
  value: string | string[] | boolean;
  emptyLabel?: string;
};

export type PMFreakAocEvidenceRequirementHandoffDetailViewModelSection = {
  sectionId: string;
  title: string;
  rows: PMFreakAocEvidenceRequirementHandoffDetailViewModelRow[];
};

export type PMFreakAocEvidenceRequirementHandoffDetailViewModel = {
  kind: "evidence_requirement_handoff_detail";
  title: string;
  subtitle: string;

  sections: PMFreakAocEvidenceRequirementHandoffDetailViewModelSection[];

  checklist: PMFreakAocEvidenceRequirementChecklistViewModel;
  reviewPacket: PMFreakAocEvidenceRequirementReviewPacket;

  safeNextStep: string;
  warnings: string[];
  errors: string[];
  safeLabels: string[];
  disclaimers: string[];
  handoffOnly: true;
};

function listRow(label: string, values: string[], emptyLabel: string): PMFreakAocEvidenceRequirementHandoffDetailViewModelRow {
  return { label, value: [...values], emptyLabel };
}

function scalarRow(label: string, value: string | undefined, emptyLabel = "Not specified"): PMFreakAocEvidenceRequirementHandoffDetailViewModelRow {
  return { label, value: value ?? "", emptyLabel };
}

// Pure view-model construction from an already-computed handoff package.
// Only surfaces the package's own already-safe fields — never raw
// metadata, secrets, auth headers, tokens, connection strings, or
// private payloads.
export function createPMFreakAocEvidenceRequirementHandoffDetailViewModel(
  handoff: PMFreakAocEvidenceRequirementHandoffPackage,
): PMFreakAocEvidenceRequirementHandoffDetailViewModel {
  return {
    kind: "evidence_requirement_handoff_detail",
    title: handoff.title,
    subtitle: `Evidence requirement handoff ${handoff.handoffId}`,

    sections: [
      {
        sectionId: "handoff-summary",
        title: "Handoff Summary",
        rows: [
          scalarRow("Title", handoff.title),
          { label: "Summary", value: handoff.safeSummary },
          scalarRow("Verdict", handoff.verdict),
          scalarRow("Decision", handoff.decision),
        ],
      },
      {
        sectionId: "source-context",
        title: "Source Context",
        rows: [
          scalarRow("Source", handoff.source),
          scalarRow("Request", handoff.requestId),
          scalarRow("Response", handoff.responseId),
          scalarRow("Gate result", handoff.gateResultId),
          scalarRow("Inbox item", handoff.inboxItemId),
          scalarRow("Display model", handoff.displayModelId),
          scalarRow("Client", handoff.clientId),
        ],
      },
      {
        sectionId: "action-context",
        title: "Action Context",
        rows: [
          scalarRow("Project", handoff.projectId),
          scalarRow("Action", handoff.actionId),
          scalarRow("Action title", handoff.actionTitle),
          scalarRow("Action category", handoff.actionCategory),
          scalarRow("Agent", handoff.agentId),
          scalarRow("Agent role", handoff.agentRole),
        ],
      },
      {
        sectionId: "required-evidence",
        title: "Required Evidence",
        rows: [listRow("Required evidence", handoff.requiredEvidenceIds, "No evidence required")],
      },
      {
        sectionId: "missing-evidence",
        title: "Missing Evidence",
        rows: [listRow("Missing evidence", handoff.missingEvidenceIds, "No missing evidence")],
      },
      {
        sectionId: "approval-references",
        title: "Approval References",
        rows: [
          listRow("Required approvals", handoff.requiredApprovalIds, "No approvals required"),
          listRow("Missing approvals", handoff.missingApprovalIds, "No missing approvals"),
        ],
      },
      {
        sectionId: "review-packet",
        title: "Review Packet",
        rows: [
          scalarRow("Packet", handoff.reviewPacket.packetId),
          { label: "Packet summary", value: handoff.reviewPacket.summary },
          listRow("Review questions", handoff.reviewPacket.reviewQuestions, "No review questions"),
        ],
      },
      {
        sectionId: "safety",
        title: "Safety",
        rows: [
          listRow("Safe labels", handoff.safeLabels, "No safe labels"),
          listRow("Disclaimers", handoff.disclaimers, "No disclaimers"),
          listRow("Warnings", handoff.warnings, "No warnings"),
          listRow("Errors", handoff.errors, "No errors"),
          { label: "Handoff only", value: true },
        ],
      },
    ],

    checklist: handoff.checklist,
    reviewPacket: handoff.reviewPacket,

    safeNextStep: handoff.safeNextStep,
    warnings: [...handoff.warnings],
    errors: [...handoff.errors],
    safeLabels: [...handoff.safeLabels],
    disclaimers: [...handoff.disclaimers],
    handoffOnly: true,
  };
}
