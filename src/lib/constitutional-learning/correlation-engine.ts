// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Learning — Correlation Engine
// Discovers correlations between patterns that co-occur in the same digest.
// ─────────────────────────────────────────────────────────────────────────────

import type { DigestPayload } from "@/lib/db/database-contract";
import type { LearningPatternType, PatternCorrelation } from "./types";

type PatternRef = { patternType: LearningPatternType; patternKey: string };

type DigestSummary = {
  id: string;
  payload: DigestPayload;
};

const PAYLOAD_KEYS: Array<{ key: keyof DigestPayload; type: LearningPatternType }> = [
  { key: "decision_patterns", type: "decision_pattern" },
  { key: "risk_patterns",     type: "risk_pattern" },
  { key: "governance_patterns", type: "governance_pattern" },
  { key: "outcome_patterns",  type: "outcome_pattern" },
];

function extractRefs(payload: DigestPayload): PatternRef[] {
  const refs: PatternRef[] = [];
  for (const { key, type } of PAYLOAD_KEYS) {
    for (const k of (payload[key] as string[] | undefined) ?? []) {
      refs.push({ patternType: type, patternKey: k });
    }
  }
  return refs;
}

function pairKey(a: PatternRef, b: PatternRef): string {
  const ka = `${a.patternType}::${a.patternKey}`;
  const kb = `${b.patternType}::${b.patternKey}`;
  return ka < kb ? `${ka}|||${kb}` : `${kb}|||${ka}`;
}

export function discoverCorrelations(
  digests: DigestSummary[],
  minFrequency = 0.1,
): PatternCorrelation[] {
  const pairCounts = new Map<string, number>();
  const patternCounts = new Map<string, number>();
  const pairMeta = new Map<string, { a: PatternRef; b: PatternRef }>();

  for (const digest of digests) {
    const refs = extractRefs(digest.payload);
    const seen = new Set<string>();

    for (const ref of refs) {
      const rk = `${ref.patternType}::${ref.patternKey}`;
      if (!seen.has(rk)) {
        seen.add(rk);
        patternCounts.set(rk, (patternCounts.get(rk) ?? 0) + 1);
      }
    }

    // Count co-occurrences of pairs within this digest
    const deduped = Array.from(new Map(refs.map((r) => [`${r.patternType}::${r.patternKey}`, r])).values());
    for (let i = 0; i < deduped.length; i++) {
      for (let j = i + 1; j < deduped.length; j++) {
        const pk = pairKey(deduped[i], deduped[j]);
        pairCounts.set(pk, (pairCounts.get(pk) ?? 0) + 1);
        if (!pairMeta.has(pk)) pairMeta.set(pk, { a: deduped[i], b: deduped[j] });
      }
    }
  }

  const total = digests.length;
  if (total === 0) return [];

  const results: PatternCorrelation[] = [];

  for (const [pk, count] of pairCounts) {
    const frequency = count / total;
    if (frequency < minFrequency) continue;

    const meta = pairMeta.get(pk)!;
    const aKey = `${meta.a.patternType}::${meta.a.patternKey}`;
    const bKey = `${meta.b.patternType}::${meta.b.patternKey}`;
    const aCount = patternCounts.get(aKey) ?? 1;
    const bCount = patternCounts.get(bKey) ?? 1;

    // Confidence: how often B appears when A appears (Jaccard-inspired)
    const union = aCount + bCount - count;
    const confidence = union > 0 ? Math.round((count / union) * 1000) / 1000 : 0;

    results.push({
      patternKey: meta.a.patternKey,
      patternType: meta.a.patternType,
      correlatedWith: meta.b.patternKey,
      correlatedType: meta.b.patternType,
      frequency: Math.round(frequency * 1000) / 1000,
      confidence,
    });
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}
