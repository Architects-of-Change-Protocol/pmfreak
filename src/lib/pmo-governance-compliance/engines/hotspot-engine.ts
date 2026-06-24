import type { GovernanceHotspot, GovernanceGap, GovernanceComplianceDomain, GovernanceGapSeverity } from "../types";

const SEVERITY_ORDER: GovernanceGapSeverity[] = ["critical", "high", "medium", "low"];

export function identifyGovernanceHotspots(gaps: GovernanceGap[]): GovernanceHotspot[] {
  const byDomain = new Map<GovernanceComplianceDomain, GovernanceGap[]>();

  for (const gap of gaps) {
    const existing = byDomain.get(gap.domain) ?? [];
    existing.push(gap);
    byDomain.set(gap.domain, existing);
  }

  const hotspots: GovernanceHotspot[] = [];

  for (const [domain, domainGaps] of byDomain) {
    const dominantSeverity = SEVERITY_ORDER.find(
      (s) => domainGaps.some((g) => g.severity === s)
    ) ?? "low";

    hotspots.push({
      domain,
      gapCount:        domainGaps.length,
      dominantSeverity,
    });
  }

  return hotspots.sort((a, b) => {
    const aSev = SEVERITY_ORDER.indexOf(a.dominantSeverity);
    const bSev = SEVERITY_ORDER.indexOf(b.dominantSeverity);
    if (aSev !== bSev) return aSev - bSev;
    return b.gapCount - a.gapCount;
  });
}
