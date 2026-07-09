import { PMFREAK_AOC_DECISION_DISPLAY_INBOX_ID } from "./pmfreak-aoc-decision-inbox-constants";
import { createPMFreakAocDecisionInboxConfig, type PMFreakAocDecisionInboxConfig } from "./pmfreak-aoc-decision-inbox-config";
import { sortPMFreakAocDecisionInboxItems } from "./pmfreak-aoc-decision-inbox-sorting";
import { summarizePMFreakAocDecisionInboxItems, type PMFreakAocDecisionInboxSummary } from "./pmfreak-aoc-decision-inbox-summary";
import type { PMFreakAocDecisionInboxItem } from "./pmfreak-aoc-decision-inbox-types";

export type PMFreakAocDecisionInbox = {
  inboxId: string;
  featureId: string;
  items: PMFreakAocDecisionInboxItem[];
  summary: PMFreakAocDecisionInboxSummary;
  displayOnly: true;
  actionExecutionCapable: false;
  mutationCapable: false;
  writebackCapable: false;
  enforcementCapable: false;
};

export type PMFreakAocDecisionInboxCollectionInput = {
  inboxId?: string;
  items: PMFreakAocDecisionInboxItem[];
  config?: Partial<PMFreakAocDecisionInboxConfig>;
};

const DEFAULT_INBOX_ID = `${PMFREAK_AOC_DECISION_DISPLAY_INBOX_ID}.default-inbox`;

// Pure, deterministic assembly: sorts and caps the given items per config,
// derives a summary, and forces the display-only capability flags. Never
// mutates `input.items`.
export function createPMFreakAocDecisionInbox(input: PMFreakAocDecisionInboxCollectionInput): PMFreakAocDecisionInbox {
  const config = createPMFreakAocDecisionInboxConfig(input.config);

  const sorted = sortPMFreakAocDecisionInboxItems(input.items, config.defaultSort);
  const limited = sorted.slice(0, config.maxItems);

  return {
    inboxId: input.inboxId ?? DEFAULT_INBOX_ID,
    featureId: config.featureId,
    items: limited,
    summary: summarizePMFreakAocDecisionInboxItems(limited),
    displayOnly: true,
    actionExecutionCapable: false,
    mutationCapable: false,
    writebackCapable: false,
    enforcementCapable: false,
  };
}
