// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Learning — Aggregation Engine
// Reads multiple published Digests, detects recurrence, and groups patterns.
// Sovereignty Rule 2: All learning originates from Digests only.
// Sovereignty Rule 3: No direct learning from Memory Records.
// ─────────────────────────────────────────────────────────────────────────────

import type { DigestPayload } from "@/lib/db/database-contract";
import type { LearningPatternType } from "./types";

export type AggregatedPattern = {
  patternType: LearningPatternType;
  patternKey: string;
  occurrences: number;
  digestIds: string[];
  contributionWeights: number[];
};

type DigestSummary = {
  id: string;
  payload: DigestPayload;
  confidence_score: number | null;
};

const PATTERN_TYPE_MAP: Array<{
  payloadKey: keyof DigestPayload;
  patternType: LearningPatternType;
}> = [
  { payloadKey: "decision_patterns", patternType: "decision_pattern" },
  { payloadKey: "risk_patterns",     patternType: "risk_pattern" },
  { payloadKey: "governance_patterns", patternType: "governance_pattern" },
  { payloadKey: "outcome_patterns",  patternType: "outcome_pattern" },
];

export function aggregateDigests(digests: DigestSummary[]): AggregatedPattern[] {
  const map = new Map<string, AggregatedPattern>();

  for (const digest of digests) {
    const baseWeight = digest.confidence_score ?? 0.5;

    for (const { payloadKey, patternType } of PATTERN_TYPE_MAP) {
      const keys = (digest.payload[payloadKey] as string[] | undefined) ?? [];
      for (const key of keys) {
        const mapKey = `${patternType}::${key}`;
        const existing = map.get(mapKey);
        if (existing) {
          existing.occurrences++;
          existing.digestIds.push(digest.id);
          existing.contributionWeights.push(baseWeight);
        } else {
          map.set(mapKey, {
            patternType,
            patternKey: key,
            occurrences: 1,
            digestIds: [digest.id],
            contributionWeights: [baseWeight],
          });
        }
      }
    }
  }

  return Array.from(map.values());
}

export function buildPatternDescription(
  patternType: LearningPatternType,
  patternKey: string,
  occurrences: number,
): string {
  return `Recurring ${patternType.replace("_pattern", "")} pattern '${patternKey}' observed ${occurrences} time${occurrences !== 1 ? "s" : ""} across published digests.`;
}
