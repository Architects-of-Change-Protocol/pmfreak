import type { PMFreakAocDecisionInboxItem } from "./pmfreak-aoc-decision-inbox-types";

export type PMFreakAocDecisionInboxGroupBy = "decision" | "status" | "severity" | "category" | "project" | "agent" | "source";

export type PMFreakAocDecisionInboxGroup = {
  groupKey: string;
  groupLabel: string;
  count: number;
  items: PMFreakAocDecisionInboxItem[];
};

const UNASSIGNED_GROUP_KEY = "unassigned";
const UNASSIGNED_GROUP_LABEL = "Unassigned";

const SEVERITY_GROUP_ORDER = ["danger", "warning", "info", "success"];

const GROUP_LABELS: Record<string, string> = {
  allow: "Allow",
  deny: "Deny",
  hold: "Hold",
  require_evidence: "Evidence required",
  require_pm_approval: "PM approval required",
  require_customer_validation: "Customer validation required",
  require_billing_review: "Billing review required",
  require_contract_review: "Contract review required",
  require_security_review: "Security review required",
  require_executive_approval: "Executive approval required",
  allowed: "Allowed",
  blocked: "Blocked",
  held: "Held",
  needs_evidence: "Needs evidence",
  needs_pm_approval: "Needs PM approval",
  needs_customer_validation: "Needs customer validation",
  needs_billing_review: "Needs billing review",
  needs_contract_review: "Needs contract review",
  needs_security_review: "Needs security review",
  needs_executive_approval: "Needs executive approval",
  unknown: "Unknown",
  danger: "Danger",
  warning: "Warning",
  info: "Info",
  success: "Success",
  billing: "Billing",
  evidence: "Evidence",
  approval: "Approval",
  contract: "Contract",
  security: "Security",
  customer_validation: "Customer validation",
  project_governance: "Project governance",
  risk: "Risk",
  communication: "Communication",
  local_mock: "Local mock",
  remote_http: "Remote HTTP",
  unsupported_remote: "Unsupported remote",
};

function labelForKey(key: string): string {
  return GROUP_LABELS[key] ?? key;
}

function extractGroupKey(item: PMFreakAocDecisionInboxItem, groupBy: PMFreakAocDecisionInboxGroupBy): string {
  switch (groupBy) {
    case "decision":
      return item.decision;
    case "status":
      return item.decisionStatus;
    case "severity":
      return item.decisionSeverity;
    case "category":
      return item.category;
    case "project":
      return item.projectId ?? UNASSIGNED_GROUP_KEY;
    case "agent":
      return item.agentId ?? UNASSIGNED_GROUP_KEY;
    case "source":
      return item.source;
    default:
      return UNASSIGNED_GROUP_KEY;
  }
}

function compareGroupKeys(a: string, b: string, groupBy: PMFreakAocDecisionInboxGroupBy): number {
  if (groupBy === "severity") {
    return SEVERITY_GROUP_ORDER.indexOf(a) - SEVERITY_GROUP_ORDER.indexOf(b);
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

// Pure, deterministic grouping. Never mutates `items`. Groups are ordered
// by group key (severity uses the fixed danger/warning/info/success order;
// every other groupBy sorts alphabetically), and items within each group
// preserve their relative input order.
export function groupPMFreakAocDecisionInboxItems(items: PMFreakAocDecisionInboxItem[], groupBy: PMFreakAocDecisionInboxGroupBy): PMFreakAocDecisionInboxGroup[] {
  const groups = new Map<string, PMFreakAocDecisionInboxItem[]>();

  for (const item of items) {
    const key = extractGroupKey(item, groupBy);
    const existing = groups.get(key);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  const groupKeys = [...groups.keys()].sort((a, b) => compareGroupKeys(a, b, groupBy));

  return groupKeys.map((groupKey) => {
    const groupItems = groups.get(groupKey) ?? [];
    return {
      groupKey,
      groupLabel: groupKey === UNASSIGNED_GROUP_KEY ? UNASSIGNED_GROUP_LABEL : labelForKey(groupKey),
      count: groupItems.length,
      items: [...groupItems],
    };
  });
}
