import type { ExecutiveRecommendation, PMSummary, ProjectSummary } from "../types";

// ─── generateExecutiveRecommendations ────────────────────────────────────────

export function generateExecutiveRecommendations(params: {
  pms: PMSummary[];
  projects: ProjectSummary[];
  healthScore: number;
  capacityScore: number;
  governanceScore: number;
  riskScore: number;
  overloadedPMCount: number;
  criticalProjectCount: number;
}): ExecutiveRecommendation[] {
  const recs: ExecutiveRecommendation[] = [];

  // Capacity recommendations
  if (params.overloadedPMCount >= 2) {
    recs.push({
      type: "capacity",
      recommendation: "Redistribute project load across underutilized PMs to reduce burn risk.",
      confidence: Math.min(0.99, 0.70 + params.overloadedPMCount * 0.05),
      impact: params.overloadedPMCount >= 4 ? "critical" : "high",
    });
  }

  if (params.capacityScore < 50) {
    recs.push({
      type: "staffing",
      recommendation: "Organizational capacity is critically low. Evaluate PM headcount expansion or project deferral.",
      confidence: 0.85,
      impact: "critical",
    });
  } else if (params.capacityScore < 70) {
    recs.push({
      type: "staffing",
      recommendation: "Consider onboarding additional PM capacity before next portfolio cycle.",
      confidence: 0.72,
      impact: "high",
    });
  }

  // Governance recommendations
  if (params.governanceScore < 65) {
    recs.push({
      type: "governance",
      recommendation: "Accelerate ratifications and close authority gaps across PMs with critical compliance scores.",
      confidence: 0.81,
      impact: "high",
    });
  }

  if (params.governanceScore < 50) {
    recs.push({
      type: "governance",
      recommendation: "Launch governance maturity program — organization-wide compliance is below minimum viable threshold.",
      confidence: 0.90,
      impact: "critical",
    });
  }

  // Execution recommendations
  const criticalRatio = params.projects.length > 0
    ? params.criticalProjectCount / params.projects.length
    : 0;

  if (criticalRatio > 0.15) {
    recs.push({
      type: "execution",
      recommendation: "High proportion of critical projects detected. Prioritize triage and assign senior PMs.",
      confidence: 0.78,
      impact: "high",
    });
  }

  if (params.riskScore > 60) {
    recs.push({
      type: "risk",
      recommendation: "PMO risk index exceeds threshold. Convene risk steering committee and activate mitigation protocols.",
      confidence: 0.83,
      impact: params.riskScore > 80 ? "critical" : "high",
    });
  }

  // Portfolio recommendations
  const unassignedProjects = params.projects.filter((p) => p.pmId === null);
  if (unassignedProjects.length > 0) {
    recs.push({
      type: "portfolio",
      recommendation: `${unassignedProjects.length} project(s) lack PM assignment. Assign responsible PMs to restore governance accountability.`,
      confidence: 0.95,
      impact: unassignedProjects.length >= 3 ? "high" : "medium",
    });
  }

  // Sort by confidence descending
  recs.sort((a, b) => b.confidence - a.confidence);
  return recs;
}
