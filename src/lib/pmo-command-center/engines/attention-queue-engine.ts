import type { AttentionItem, PMOAttentionPriority, PMSummary, ProjectSummary } from "../types";

// ─── Priority ordering ────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<PMOAttentionPriority, number> = {
  critical: 0,
  high:     1,
  medium:   2,
  low:      3,
};

// ─── generateAttentionQueue ───────────────────────────────────────────────────

export function generateAttentionQueue(params: {
  pms: PMSummary[];
  projects: ProjectSummary[];
  riskScore: number;
  governanceScore: number;
}): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const pm of params.pms) {
    if (pm.utilizationPercentage >= 130) {
      items.push({
        priority: "critical",
        entityType: "pm",
        entityId: pm.id,
        title: `${pm.name} — critical overload`,
        description: `PM is at ${Math.round(pm.utilizationPercentage)}% utilization — well above safe threshold.`,
        recommendedAction: "Immediately redistribute projects or defer non-critical work.",
      });
    } else if (pm.utilizationPercentage >= 110) {
      items.push({
        priority: "high",
        entityType: "pm",
        entityId: pm.id,
        title: `${pm.name} — overloaded`,
        description: `PM is at ${Math.round(pm.utilizationPercentage)}% utilization.`,
        recommendedAction: "Review project assignments and consider load redistribution.",
      });
    } else if (pm.utilizationPercentage >= 90) {
      items.push({
        priority: "medium",
        entityType: "pm",
        entityId: pm.id,
        title: `${pm.name} — approaching capacity`,
        description: `PM is at ${Math.round(pm.utilizationPercentage)}% utilization — nearing overload.`,
        recommendedAction: "Monitor closely and avoid assigning new projects.",
      });
    }

    if (pm.complianceScore < 60) {
      items.push({
        priority: "high",
        entityType: "pm",
        entityId: pm.id,
        title: `${pm.name} — critical governance debt`,
        description: `Compliance score is ${Math.round(pm.complianceScore)} — below critical threshold.`,
        recommendedAction: "Conduct governance review and accelerate ratifications.",
      });
    } else if (pm.complianceScore < 80) {
      items.push({
        priority: "medium",
        entityType: "pm",
        entityId: pm.id,
        title: `${pm.name} — governance warning`,
        description: `Compliance score is ${Math.round(pm.complianceScore)} — below compliant threshold.`,
        recommendedAction: "Address open governance gaps in next sprint.",
      });
    }

    if (pm.performanceScore < 60) {
      items.push({
        priority: "high",
        entityType: "pm",
        entityId: pm.id,
        title: `${pm.name} — low performance`,
        description: `Performance score is ${Math.round(pm.performanceScore)}.`,
        recommendedAction: "Investigate root causes and provide targeted support.",
      });
    }
  }

  for (const project of params.projects) {
    if (project.healthScore < 50) {
      items.push({
        priority: "critical",
        entityType: "project",
        entityId: project.id,
        title: `${project.name} — critical health`,
        description: `Project health score is ${Math.round(project.healthScore)}.`,
        recommendedAction: "Escalate to PMO and initiate recovery plan.",
      });
    } else if (project.healthScore < 70) {
      items.push({
        priority: "high",
        entityType: "project",
        entityId: project.id,
        title: `${project.name} — warning health`,
        description: `Project health score is ${Math.round(project.healthScore)}.`,
        recommendedAction: "Schedule executive review and define corrective actions.",
      });
    }
  }

  if (params.governanceScore < 60) {
    items.push({
      priority: "critical",
      entityType: "governance",
      entityId: "pmo",
      title: "PMO governance maturity — critical",
      description: `Governance maturity score is ${Math.round(params.governanceScore)} — organization-wide gaps detected.`,
      recommendedAction: "Launch governance remediation program across all PMs.",
    });
  }

  if (params.riskScore > 70) {
    items.push({
      priority: "critical",
      entityType: "governance",
      entityId: "pmo",
      title: "PMO risk index — elevated",
      description: `Risk index is ${Math.round(params.riskScore)} — multiple risk factors active.`,
      recommendedAction: "Convene PMO risk review and prioritize mitigation actions.",
    });
  }

  items.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  return items;
}
