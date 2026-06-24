// ─── explainPMOCommandCenter ──────────────────────────────────────────────────

export type PMOCommandCenterExplanation = {
  title: string;
  purpose: string;
  components: Array<{
    name: string;
    description: string;
    inputs: string[];
    output: string;
  }>;
  governanceByException: {
    description: string;
    principles: string[];
  };
  useCases: string[];
};

export function explainPMOCommandCenter(): PMOCommandCenterExplanation {
  return {
    title: "PMO Command Center",
    purpose:
      "Provides a single consolidated organizational view for PMO governance. " +
      "Aggregates Performance, Capacity, and Compliance intelligence into PMO-level health metrics, " +
      "attention queues, hotspots, trends, and executive recommendations.",
    components: [
      {
        name: "PMO Health Engine",
        description: "Calculates overall PMO health as a weighted composite of Performance, Capacity, Compliance, and Project Health.",
        inputs: ["avgPerformanceScore", "avgCapacityScore", "avgComplianceScore", "projectHealthScore"],
        output: "overall_health_score (0-100)",
      },
      {
        name: "Organizational Capacity Engine",
        description: "Measures available organizational capacity by inverting utilization and applying overload/healthy PM ratios.",
        inputs: ["pmCount", "overloadedPMCount", "healthyPMCount", "avgUtilizationPercentage", "totalCapacity", "totalLoad"],
        output: "capacity_score (0-100)",
      },
      {
        name: "Governance Maturity Engine",
        description: "Measures governance maturity from compliance scores, total governance debt, and identified hotspots.",
        inputs: ["avgComplianceScore", "totalGovernanceDebt", "hotspotCount", "criticalGapCount"],
        output: "governance_score (0-100)",
      },
      {
        name: "PMO Risk Engine",
        description: "Calculates the PMO risk index from critical project ratio, execution drift, governance gaps, overloaded PMs, and escalations.",
        inputs: ["criticalProjectCount", "executionDriftCount", "governanceGapCount", "overloadedPMCount", "escalationCount"],
        output: "risk_score (0-100)",
      },
      {
        name: "Attention Queue Engine",
        description: "Generates a prioritized list of attention items requiring PMO intervention, ordered by severity.",
        inputs: ["PM summaries (utilization, compliance, performance)", "Project summaries (health)", "riskScore", "governanceScore"],
        output: "Ordered list of AttentionItem (critical → high → medium → low)",
      },
      {
        name: "Executive Recommendation Engine",
        description: "Generates actionable recommendations for the PMO with confidence and impact scores, traceable to evidence.",
        inputs: ["capacityScore", "governanceScore", "riskScore", "overloadedPMCount", "criticalProjectCount", "unassignedProjects"],
        output: "List of ExecutiveRecommendation with type, confidence (0-1), and impact (low/medium/high/critical)",
      },
      {
        name: "PMO Hotspot Engine",
        description: "Identifies zones of anomalous behavior across capacity, governance, execution, and portfolio dimensions.",
        inputs: ["PM utilization", "PM compliance scores", "Project health scores", "riskScore"],
        output: "List of PMOHotspot with type, severity, and metric value",
      },
      {
        name: "PMO Trend Engine",
        description: "Compares historical snapshots to detect improving, stable, or deteriorating trends across health dimensions.",
        inputs: ["Historical PMO snapshots (newest-first)"],
        output: "PMOTrend with delta and direction per dimension",
      },
      {
        name: "PMO Lineage Engine",
        description: "Reconstructs the complete evidence chain from Projects → Portfolios → PMs → Performance → Capacity → Compliance → PMO Snapshot.",
        inputs: ["snapshotId", "workspaceId"],
        output: "PMOLineage with full PM, project, and snapshot references",
      },
    ],
    governanceByException: {
      description:
        "The PMO Command Center implements governance-by-exception: the PMO only receives information " +
        "about elements that require attention. Healthy elements are summarized; anomalies are surfaced. " +
        "No automatic redistributions or remediations are executed.",
      principles: [
        "PMO observes — it does not execute.",
        "Every metric is traceable to real evidence.",
        "Every recommendation has a confidence and impact score.",
        "Every attention item has a priority and recommended action.",
        "No project, PM, or portfolio is modified by the system.",
        "Workspace isolation is enforced at all layers.",
      ],
    },
    useCases: [
      "Weekly PMO health review: generate snapshot, view dashboard model.",
      "Identify overloaded PMs before next sprint planning.",
      "Monitor governance maturity trend across quarters.",
      "Surface critical projects requiring executive escalation.",
      "Allocate PMO attention by exception — only act on flagged items.",
      "Trace any PMO metric back to its PM, project, or evidence source via lineage.",
      "Generate executive briefs using dashboard model output.",
    ],
  };
}
