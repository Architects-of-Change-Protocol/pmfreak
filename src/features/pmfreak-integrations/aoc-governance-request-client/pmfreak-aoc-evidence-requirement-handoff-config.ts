import { PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_ID } from "./pmfreak-aoc-evidence-requirement-handoff-constants";

export type PMFreakAocEvidenceRequirementHandoffMode = "demo" | "dry_run" | "review_packet" | "checklist_only" | "handoff_only";

export type PMFreakAocEvidenceRequirementHandoffDefaultSource =
  | "governance_response"
  | "decision_inbox_item"
  | "gate_result"
  | "gate_result_ui_display_model";

export type PMFreakAocEvidenceRequirementHandoffRedactionMode = "none" | "safe_demo" | "strict";

export type PMFreakAocEvidenceRequirementHandoffConfig = {
  featureId: string;
  mode: PMFreakAocEvidenceRequirementHandoffMode;
  defaultSource: PMFreakAocEvidenceRequirementHandoffDefaultSource;

  includeApprovalReferences: boolean;
  includeGateTrace: boolean;
  includeSafetyDisclaimers: boolean;
  includeChecklist: boolean;
  includeReviewPacket: boolean;

  allowEvidenceAttachment: false;
  allowFileUpload: false;
  allowTaskCreation: false;
  allowActionExecution: false;
  allowProductionMutations: false;
  allowDecisionWriteback: false;
  allowInvoiceCreation: false;
  allowCommunications: false;
  allowLegalCertification: false;
  allowComplianceCertification: false;
  allowCustomerAcceptanceCertification: false;

  redactionMode: PMFreakAocEvidenceRequirementHandoffRedactionMode;

  notes: string[];
  warnings: string[];
};

// Forcing production-unsafe overrides back to `false` relies on bypassing
// the (already `false`-typed) input field at the call site — the same
// pattern used by pmfreak-aoc-governed-action-gate-config.ts — so runtime
// callers cannot enable evidence attachment/file upload/task creation/
// action execution/mutation/writeback/invoicing/comms/certification even
// if they try.
export function createPMFreakAocEvidenceRequirementHandoffConfig(
  input?: Partial<PMFreakAocEvidenceRequirementHandoffConfig>,
): PMFreakAocEvidenceRequirementHandoffConfig {
  const notes = [...(input?.notes ?? [])];
  const warnings = [...(input?.warnings ?? [])];

  const rawInput = (input ?? {}) as Record<string, unknown>;

  const unsafeOverrideFlags: Array<{ key: string; label: string }> = [
    { key: "allowEvidenceAttachment", label: "evidence attachment" },
    { key: "allowFileUpload", label: "file upload" },
    { key: "allowTaskCreation", label: "task creation" },
    { key: "allowActionExecution", label: "action execution" },
    { key: "allowProductionMutations", label: "production mutations" },
    { key: "allowDecisionWriteback", label: "decision writeback" },
    { key: "allowInvoiceCreation", label: "invoice creation" },
    { key: "allowCommunications", label: "communications" },
    { key: "allowLegalCertification", label: "legal certification" },
    { key: "allowComplianceCertification", label: "compliance certification" },
    { key: "allowCustomerAcceptanceCertification", label: "customer acceptance certification" },
  ];

  for (const { key, label } of unsafeOverrideFlags) {
    if (rawInput[key] === true) {
      warnings.push(`${key} was requested as true but is forced to false: PMFreak Evidence Requirement Handoff v1 does not support ${label}.`);
    }
  }

  return {
    featureId: input?.featureId ?? PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_ID,
    mode: input?.mode ?? "dry_run",
    defaultSource: input?.defaultSource ?? "gate_result",

    includeApprovalReferences: input?.includeApprovalReferences ?? true,
    includeGateTrace: input?.includeGateTrace ?? true,
    includeSafetyDisclaimers: input?.includeSafetyDisclaimers ?? true,
    includeChecklist: input?.includeChecklist ?? true,
    includeReviewPacket: input?.includeReviewPacket ?? true,

    allowEvidenceAttachment: false,
    allowFileUpload: false,
    allowTaskCreation: false,
    allowActionExecution: false,
    allowProductionMutations: false,
    allowDecisionWriteback: false,
    allowInvoiceCreation: false,
    allowCommunications: false,
    allowLegalCertification: false,
    allowComplianceCertification: false,
    allowCustomerAcceptanceCertification: false,

    redactionMode: input?.redactionMode ?? "safe_demo",

    notes,
    warnings,
  };
}
