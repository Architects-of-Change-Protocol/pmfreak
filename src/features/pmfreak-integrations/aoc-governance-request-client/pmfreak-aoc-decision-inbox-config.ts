import { PMFREAK_AOC_DECISION_DISPLAY_INBOX_ID, PMFREAK_AOC_DECISION_INBOX_DEFAULT_MAX_ITEMS } from "./pmfreak-aoc-decision-inbox-constants";
import type { PMFreakAocDecisionInboxSort } from "./pmfreak-aoc-decision-inbox-sorting";

export type PMFreakAocDecisionInboxDisplayMode = "demo" | "project" | "workspace" | "agent" | "portfolio";

export type PMFreakAocDecisionInboxRedactionMode = "none" | "safe_demo" | "strict";

export type PMFreakAocDecisionInboxConfig = {
  featureId: string;
  displayMode: PMFreakAocDecisionInboxDisplayMode;

  allowActionExecution: false;
  allowProductionMutations: false;
  allowDecisionWriteback: false;
  allowInvoiceCreation: false;
  allowCommunications: false;
  allowEnforcement: false;

  maxItems: number;

  defaultSort: PMFreakAocDecisionInboxSort;

  redactionMode: PMFreakAocDecisionInboxRedactionMode;

  notes: string[];
  warnings: string[];
};

// Forcing production-unsafe overrides back to `false` relies on bypassing
// the (already `false`-typed) input field at the call site — the same
// pattern used by pmfreak-aoc-governance-client-config.ts — so runtime
// callers cannot enable execution/mutation/writeback/invoicing/comms/
// enforcement even if they try.
export function createPMFreakAocDecisionInboxConfig(input?: Partial<PMFreakAocDecisionInboxConfig>): PMFreakAocDecisionInboxConfig {
  const notes = [...(input?.notes ?? [])];
  const warnings = [...(input?.warnings ?? [])];

  const rawInput = (input ?? {}) as Record<string, unknown>;

  const unsafeOverrideFlags: Array<{ key: string; label: string }> = [
    { key: "allowActionExecution", label: "action execution" },
    { key: "allowProductionMutations", label: "production mutations" },
    { key: "allowDecisionWriteback", label: "decision writeback" },
    { key: "allowInvoiceCreation", label: "invoice creation" },
    { key: "allowCommunications", label: "communications" },
    { key: "allowEnforcement", label: "enforcement" },
  ];

  for (const { key, label } of unsafeOverrideFlags) {
    if (rawInput[key] === true) {
      warnings.push(`${key} was requested as true but is forced to false: PMFreak AOC Decision Display / Inbox v1 does not support ${label}.`);
    }
  }

  return {
    featureId: input?.featureId ?? PMFREAK_AOC_DECISION_DISPLAY_INBOX_ID,
    displayMode: input?.displayMode ?? "demo",
    allowActionExecution: false,
    allowProductionMutations: false,
    allowDecisionWriteback: false,
    allowInvoiceCreation: false,
    allowCommunications: false,
    allowEnforcement: false,
    maxItems: input?.maxItems ?? PMFREAK_AOC_DECISION_INBOX_DEFAULT_MAX_ITEMS,
    defaultSort: input?.defaultSort ?? "newest_first",
    redactionMode: input?.redactionMode ?? "safe_demo",
    notes,
    warnings,
  };
}
