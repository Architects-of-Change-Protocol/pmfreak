import type { PMOHotspot, PMSummary, ProjectSummary, PMOAttentionPriority } from "../types";

// ─── identifyPMOHotspots ──────────────────────────────────────────────────────

export function identifyPMOHotspots(params: {
  pms: PMSummary[];
  projects: ProjectSummary[];
  governanceScore: number;
  riskScore: number;
}): PMOHotspot[] {
  const hotspots: PMOHotspot[] = [];

  // ── Capacity hotspots ────────────────────────────────────────────────────
  for (const pm of params.pms) {
    if (pm.utilizationPercentage >= 110) {
      const severity: PMOAttentionPriority =
        pm.utilizationPercentage >= 130 ? "critical" : "high";
      hotspots.push({
        type: "capacity",
        entityId: pm.id,
        entityName: pm.name,
        severity,
        description: `PM utilization at ${Math.round(pm.utilizationPercentage)}% — capacity hotspot.`,
        metric: "utilization_percentage",
        value: pm.utilizationPercentage,
      });
    }
  }

  // ── Governance hotspots ───────────────────────────────────────────────────
  for (const pm of params.pms) {
    if (pm.complianceScore < 60) {
      hotspots.push({
        type: "governance",
        entityId: pm.id,
        entityName: pm.name,
        severity: "critical",
        description: `Compliance score ${Math.round(pm.complianceScore)} — governance hotspot.`,
        metric: "compliance_score",
        value: pm.complianceScore,
      });
    } else if (pm.complianceScore < 75) {
      hotspots.push({
        type: "governance",
        entityId: pm.id,
        entityName: pm.name,
        severity: "high",
        description: `Compliance score ${Math.round(pm.complianceScore)} — governance warning.`,
        metric: "compliance_score",
        value: pm.complianceScore,
      });
    }
  }

  // ── Execution hotspots ────────────────────────────────────────────────────
  for (const project of params.projects) {
    if (project.healthScore < 50) {
      hotspots.push({
        type: "execution",
        entityId: project.id,
        entityName: project.name,
        severity: "critical",
        description: `Project health at ${Math.round(project.healthScore)} — execution hotspot.`,
        metric: "health_score",
        value: project.healthScore,
      });
    } else if (project.healthScore < 65) {
      hotspots.push({
        type: "execution",
        entityId: project.id,
        entityName: project.name,
        severity: "high",
        description: `Project health at ${Math.round(project.healthScore)} — execution warning.`,
        metric: "health_score",
        value: project.healthScore,
      });
    }
  }

  // ── Portfolio hotspot (aggregated PMO-level) ──────────────────────────────
  if (params.riskScore > 70) {
    hotspots.push({
      type: "portfolio",
      entityId: "pmo",
      entityName: "PMO",
      severity: params.riskScore > 85 ? "critical" : "high",
      description: `PMO risk index at ${Math.round(params.riskScore)} — portfolio-level risk hotspot.`,
      metric: "risk_score",
      value: params.riskScore,
    });
  }

  return hotspots;
}
