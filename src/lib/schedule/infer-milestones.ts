import type { ProjectMilestoneType } from "@/lib/db/database-contract";

type DiscoveredMilestone = {
  title?: string;
  name?: string;
  description?: string;
  date?: string;
  confidence_score?: number;
  [key: string]: unknown;
};

export type ProposedMilestone = {
  title: string;
  description?: string;
  milestoneType: ProjectMilestoneType;
  targetDate?: string;
  confidenceScore?: number;
  sourceType: "discovery";
  sourcePayload: Record<string, unknown>;
};

const TYPE_RULES: Array<{ keywords: RegExp; type: ProjectMilestoneType }> = [
  { keywords: /go.?live|golive/i, type: "go_live" },
  { keywords: /training/i, type: "training" },
  { keywords: /acceptance|uat|user acceptance/i, type: "acceptance" },
  { keywords: /deploy(ment)?/i, type: "deployment" },
  { keywords: /handover|hand.?off/i, type: "handover" },
  { keywords: /kickoff|kick.?off/i, type: "kickoff" },
  { keywords: /discovery/i, type: "discovery" },
  { keywords: /design/i, type: "design" },
  { keywords: /approv(al|e)/i, type: "approval" },
  { keywords: /deliver(y|able)/i, type: "delivery" },
];

function inferType(title: string): ProjectMilestoneType {
  for (const rule of TYPE_RULES) {
    if (rule.keywords.test(title)) return rule.type;
  }
  return "other";
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

export function inferMilestonesFromDiscovery(input: {
  discoveryMilestones: DiscoveredMilestone[];
  existingTitles?: string[];
}): ProposedMilestone[] {
  const existingNormalized = new Set(
    (input.existingTitles ?? []).map(normalizeTitle)
  );
  const seen = new Set<string>();
  const proposed: ProposedMilestone[] = [];

  for (const dm of input.discoveryMilestones) {
    const rawTitle = (dm.title ?? dm.name ?? "").trim();
    if (!rawTitle) continue;

    const normalized = normalizeTitle(rawTitle);
    if (seen.has(normalized) || existingNormalized.has(normalized)) continue;
    seen.add(normalized);

    proposed.push({
      title: rawTitle,
      description: dm.description,
      milestoneType: inferType(rawTitle),
      targetDate: dm.date ?? undefined,
      confidenceScore: typeof dm.confidence_score === "number" ? dm.confidence_score : undefined,
      sourceType: "discovery",
      sourcePayload: dm as Record<string, unknown>,
    });
  }

  return proposed;
}
