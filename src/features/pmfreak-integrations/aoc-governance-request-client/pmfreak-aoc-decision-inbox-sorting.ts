import type { PMFreakAocDecisionInboxItem, PMFreakAocDecisionInboxSeverity } from "./pmfreak-aoc-decision-inbox-types";

export type PMFreakAocDecisionInboxSort = "newest_first" | "oldest_first" | "severity_desc" | "decision_type" | "project" | "agent" | "source";

const SEVERITY_RANK: Record<PMFreakAocDecisionInboxSeverity, number> = {
  danger: 0,
  warning: 1,
  info: 2,
  success: 3,
};

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Every comparator ends with an inboxItemId tie-break so the resulting
// order is fully deterministic regardless of input ordering.
function compareByCreatedAtLabel(a: PMFreakAocDecisionInboxItem, b: PMFreakAocDecisionInboxItem): number {
  return compareStrings(a.createdAtLabel, b.createdAtLabel) || compareStrings(a.inboxItemId, b.inboxItemId);
}

const COMPARATORS: Record<PMFreakAocDecisionInboxSort, (a: PMFreakAocDecisionInboxItem, b: PMFreakAocDecisionInboxItem) => number> = {
  newest_first: (a, b) => -compareByCreatedAtLabel(a, b),
  oldest_first: (a, b) => compareByCreatedAtLabel(a, b),
  severity_desc: (a, b) => SEVERITY_RANK[a.decisionSeverity] - SEVERITY_RANK[b.decisionSeverity] || -compareByCreatedAtLabel(a, b),
  decision_type: (a, b) => compareStrings(a.decision, b.decision) || compareStrings(a.inboxItemId, b.inboxItemId),
  project: (a, b) => compareStrings(a.projectId ?? "", b.projectId ?? "") || compareStrings(a.inboxItemId, b.inboxItemId),
  agent: (a, b) => compareStrings(a.agentId ?? "", b.agentId ?? "") || compareStrings(a.inboxItemId, b.inboxItemId),
  source: (a, b) => compareStrings(a.source, b.source) || compareStrings(a.inboxItemId, b.inboxItemId),
};

// Pure, deterministic sort. Never mutates `items`.
export function sortPMFreakAocDecisionInboxItems(items: PMFreakAocDecisionInboxItem[], sort: PMFreakAocDecisionInboxSort): PMFreakAocDecisionInboxItem[] {
  return [...items].sort(COMPARATORS[sort]);
}
