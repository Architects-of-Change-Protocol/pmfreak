import { PMFREAK_AOC_GOVERNED_ACTION_GATE_ID } from "./pmfreak-aoc-governed-action-gate-constants";
import type { PMFreakAocGovernedActionGateSource } from "./pmfreak-aoc-governed-action-gate-types";

export type PMFreakAocGovernedActionGateMode = "demo" | "dry_run" | "evaluate_only" | "pre_execution_check";

export type PMFreakAocGovernedActionGateDefaultSource = PMFreakAocGovernedActionGateSource;

export type PMFreakAocGovernedActionGateRedactionMode = "none" | "safe_demo" | "strict";

export type PMFreakAocGovernedActionGateConfig = {
  featureId: string;
  mode: PMFreakAocGovernedActionGateMode;
  defaultSource: PMFreakAocGovernedActionGateDefaultSource;

  allowActionExecution: false;
  allowProductionMutations: false;
  allowDecisionWriteback: false;
  allowInvoiceCreation: false;
  allowCommunications: false;
  allowLegalCertification: false;
  allowComplianceCertification: false;

  treatAllowAsExecutable: false;
  requireFreshGovernanceResponse: boolean;
  requireMatchingRequestId: boolean;
  requireMatchingClientId: boolean;

  redactionMode: PMFreakAocGovernedActionGateRedactionMode;

  notes: string[];
  warnings: string[];
};

// Forcing production-unsafe overrides back to `false` relies on bypassing
// the (already `false`-typed) input field at the call site — the same
// pattern used by pmfreak-aoc-governance-client-config.ts and
// pmfreak-aoc-decision-inbox-config.ts — so runtime callers cannot enable
// execution/mutation/writeback/invoicing/comms/certification/treat-allow-
// as-executable even if they try.
export function createPMFreakAocGovernedActionGateConfig(
  input?: Partial<PMFreakAocGovernedActionGateConfig>,
): PMFreakAocGovernedActionGateConfig {
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
    { key: "treatAllowAsExecutable", label: "treating an allow verdict as action execution" },
  ];

  for (const { key, label } of unsafeOverrideFlags) {
    if (rawInput[key] === true) {
      warnings.push(`${key} was requested as true but is forced to false: PMFreak AOC Governed Action Gate v1 does not support ${label}.`);
    }
  }

  return {
    featureId: input?.featureId ?? PMFREAK_AOC_GOVERNED_ACTION_GATE_ID,
    mode: input?.mode ?? "dry_run",
    defaultSource: input?.defaultSource ?? "governance_response",

    allowActionExecution: false,
    allowProductionMutations: false,
    allowDecisionWriteback: false,
    allowInvoiceCreation: false,
    allowCommunications: false,
    allowLegalCertification: false,
    allowComplianceCertification: false,

    treatAllowAsExecutable: false,
    requireFreshGovernanceResponse: input?.requireFreshGovernanceResponse ?? false,
    requireMatchingRequestId: input?.requireMatchingRequestId ?? true,
    requireMatchingClientId: input?.requireMatchingClientId ?? true,

    redactionMode: input?.redactionMode ?? "safe_demo",

    notes,
    warnings,
  };
}
