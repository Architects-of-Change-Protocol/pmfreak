import { PMFREAK_AOC_GATE_RESULT_UI_ID } from "./pmfreak-aoc-gate-result-ui-constants";

export type PMFreakAocGateResultUIDisplayMode = "compact" | "banner" | "card" | "detail_panel" | "blocker_panel" | "dashboard";

export type PMFreakAocGateResultUIRedactionMode = "none" | "safe_demo" | "strict";

export type PMFreakAocGateResultUIConfig = {
  featureId: string;
  displayMode: PMFreakAocGateResultUIDisplayMode;

  showTrace: boolean;
  showRequirements: boolean;
  showReasonCodes: boolean;
  showSafeLabels: boolean;
  showWarnings: boolean;
  showErrors: boolean;
  showSafetyDisclaimer: boolean;

  allowActionExecution: false;
  allowProductionMutations: false;
  allowDecisionWriteback: false;
  allowInvoiceCreation: false;
  allowCommunications: false;
  allowLegalCertification: false;
  allowComplianceCertification: false;

  showExecutionButtons: false;
  showMutationButtons: false;
  showInvoiceButtons: false;
  showCommunicationButtons: false;

  redactionMode: PMFreakAocGateResultUIRedactionMode;

  notes: string[];
  warnings: string[];
};

// Forcing production-unsafe overrides back to `false` relies on bypassing
// the (already `false`-typed) input field at the call site — the same
// pattern used by pmfreak-aoc-governed-action-gate-config.ts and
// pmfreak-aoc-decision-inbox-config.ts — so runtime callers cannot enable
// execution/mutation/writeback/invoicing/comms/certification or render
// enabled execution/mutation/invoice/communication buttons even if they try.
export function createPMFreakAocGateResultUIConfig(input?: Partial<PMFreakAocGateResultUIConfig>): PMFreakAocGateResultUIConfig {
  const notes = [...(input?.notes ?? [])];
  const warnings = [...(input?.warnings ?? [])];

  const rawInput = (input ?? {}) as Record<string, unknown>;

  const unsafeOverrideFlags: Array<{ key: string; label: string }> = [
    { key: "allowActionExecution", label: "action execution" },
    { key: "allowProductionMutations", label: "production mutations" },
    { key: "allowDecisionWriteback", label: "decision writeback" },
    { key: "allowInvoiceCreation", label: "invoice creation" },
    { key: "allowCommunications", label: "communications" },
    { key: "allowLegalCertification", label: "legal certification" },
    { key: "allowComplianceCertification", label: "compliance certification" },
    { key: "showExecutionButtons", label: "rendering enabled execution buttons" },
    { key: "showMutationButtons", label: "rendering enabled mutation buttons" },
    { key: "showInvoiceButtons", label: "rendering enabled invoice buttons" },
    { key: "showCommunicationButtons", label: "rendering enabled communication buttons" },
  ];

  for (const { key, label } of unsafeOverrideFlags) {
    if (rawInput[key] === true) {
      warnings.push(`${key} was requested as true but is forced to false: PMFreak AOC Gate Result UI v1 does not support ${label}.`);
    }
  }

  return {
    featureId: input?.featureId ?? PMFREAK_AOC_GATE_RESULT_UI_ID,
    displayMode: input?.displayMode ?? "card",

    showTrace: input?.showTrace ?? true,
    showRequirements: input?.showRequirements ?? true,
    showReasonCodes: input?.showReasonCodes ?? true,
    showSafeLabels: input?.showSafeLabels ?? true,
    showWarnings: input?.showWarnings ?? true,
    showErrors: input?.showErrors ?? true,
    showSafetyDisclaimer: input?.showSafetyDisclaimer ?? true,

    allowActionExecution: false,
    allowProductionMutations: false,
    allowDecisionWriteback: false,
    allowInvoiceCreation: false,
    allowCommunications: false,
    allowLegalCertification: false,
    allowComplianceCertification: false,

    showExecutionButtons: false,
    showMutationButtons: false,
    showInvoiceButtons: false,
    showCommunicationButtons: false,

    redactionMode: input?.redactionMode ?? "safe_demo",

    notes,
    warnings,
  };
}
