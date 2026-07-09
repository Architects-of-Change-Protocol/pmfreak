import type { PMFreakAocGovernanceDecision } from "./pmfreak-aoc-governance-response";
import type {
  PMFreakAocDecisionInboxCategory,
  PMFreakAocDecisionInboxDecisionStatus,
  PMFreakAocDecisionInboxItem,
  PMFreakAocDecisionInboxItemSource,
  PMFreakAocDecisionInboxItemStatus,
  PMFreakAocDecisionInboxSeverity,
} from "./pmfreak-aoc-decision-inbox-types";

export type PMFreakAocDecisionInboxFilter = {
  decisions?: PMFreakAocGovernanceDecision[];
  statuses?: PMFreakAocDecisionInboxDecisionStatus[];
  severities?: PMFreakAocDecisionInboxSeverity[];
  categories?: PMFreakAocDecisionInboxCategory[];
  inboxStatuses?: PMFreakAocDecisionInboxItemStatus[];
  projectId?: string;
  agentId?: string;
  actionCategory?: string;
  source?: PMFreakAocDecisionInboxItemSource;
  hasMissingEvidence?: boolean;
  hasMissingApprovals?: boolean;
  hasErrors?: boolean;
  searchText?: string;
};

function matchesSearchText(item: PMFreakAocDecisionInboxItem, searchText: string): boolean {
  const needle = searchText.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  const haystack = [item.decisionLabel, item.safeSummary, item.safeNextStep, ...item.reasonCodes, item.actionTitle ?? "", item.projectId ?? "", item.agentId ?? ""]
    .join(" ")
    .toLowerCase();

  return haystack.includes(needle);
}

// Pure predicate filter over an inbox item array. Never mutates `items`.
export function filterPMFreakAocDecisionInboxItems(items: PMFreakAocDecisionInboxItem[], filter: PMFreakAocDecisionInboxFilter): PMFreakAocDecisionInboxItem[] {
  return items.filter((item) => {
    if (filter.decisions && !filter.decisions.includes(item.decision)) return false;
    if (filter.statuses && !filter.statuses.includes(item.decisionStatus)) return false;
    if (filter.severities && !filter.severities.includes(item.decisionSeverity)) return false;
    if (filter.categories && !filter.categories.includes(item.category)) return false;
    if (filter.inboxStatuses && !filter.inboxStatuses.includes(item.inboxStatus)) return false;
    if (filter.projectId !== undefined && item.projectId !== filter.projectId) return false;
    if (filter.agentId !== undefined && item.agentId !== filter.agentId) return false;
    if (filter.actionCategory !== undefined && item.actionCategory !== filter.actionCategory) return false;
    if (filter.source !== undefined && item.source !== filter.source) return false;
    if (filter.hasMissingEvidence !== undefined && item.missingEvidenceIds.length > 0 !== filter.hasMissingEvidence) return false;
    if (filter.hasMissingApprovals !== undefined && item.missingApprovalIds.length > 0 !== filter.hasMissingApprovals) return false;
    if (filter.hasErrors !== undefined && item.errors.length > 0 !== filter.hasErrors) return false;
    if (filter.searchText !== undefined && !matchesSearchText(item, filter.searchText)) return false;
    return true;
  });
}
