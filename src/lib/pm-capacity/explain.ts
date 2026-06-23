import {
  PM_CAPACITY_STATUS_THRESHOLDS,
  PM_BURN_RISK_THRESHOLDS,
} from "./types";

// ─── Explain Type ─────────────────────────────────────────────────────────────

export type PMCapacityEngineExplanation = {
  concept: string;
  principles: Array<{ number: number; statement: string }>;
  capacityModel: {
    description: string;
    basedOn: string[];
    roleMultipliers: Record<string, number>;
    experienceMultipliers: Record<string, number>;
  };
  loadModel: {
    description: string;
    domains: Record<string, { description: string; weight: string }>;
  };
  utilizationModel: {
    formula: string;
    description: string;
  };
  burnRiskModel: {
    description: string;
    levels: Array<{ level: string; threshold: string; meaning: string }>;
  };
  overloadDetection: {
    description: string;
    thresholds: Array<{ range: string; status: string }>;
  };
  recommendationModel: {
    description: string;
    actions: Array<{ action: string; trigger: string }>;
  };
  capacityProfile: string;
  lineage: string;
  sustainabilityDesign: string;
  auditEvents: string[];
  businessRules: Array<{ number: number; statement: string }>;
  useCases: string[];
};

// ─── explainPMCapacityEngine ──────────────────────────────────────────────────

export function explainPMCapacityEngine(): PMCapacityEngineExplanation {
  return {
    concept:
      "The PM Capacity & Load Intelligence Engine transforms PM assignments into operational " +
      "sustainability intelligence. It calculates the PM's available capacity based on role and " +
      "experience, measures the actual load from projects and open work items, derives utilization " +
      "percentage, detects overload conditions, assesses burn risk, and generates actionable " +
      "recommendations — all without modifying assignments or triggering automatic actions.",

    principles: [
      { number: 1, statement: "Capacity is finite — every PM has a measurable sustainability limit." },
      { number: 2, statement: "Load is dynamic — it changes as projects and open items evolve." },
      { number: 3, statement: "Utilization must be measurable — derived as load / capacity * 100." },
      { number: 4, statement: "Overload must be detected early — before systemic degradation occurs." },
      { number: 5, statement: "The objective is to prevent systemic failures, not to punish PMs." },
      { number: 6, statement: "Capacity must never be inferred by opinion — only from evidence." },
      { number: 7, statement: "Workspace isolation is mandatory — no cross-workspace data access." },
    ],

    capacityModel: {
      description:
        "Capacity is the maximum sustainable operational load for a PM. It is derived from " +
        "the PM Profile's capacity_limit and active_projects_limit, adjusted by role and " +
        "experience level multipliers.",
      basedOn: [
        "pm_profiles.capacity_limit",
        "pm_profiles.active_projects_limit",
        "pm_profiles.role",
        "pm_profiles.experience_level",
      ],
      roleMultipliers: {
        project_manager:   1.00,
        senior_pm:         1.15,
        program_manager:   1.25,
        portfolio_manager: 1.40,
      },
      experienceMultipliers: {
        junior:    0.80,
        mid:       1.00,
        senior:    1.20,
        principal: 1.35,
      },
    },

    loadModel: {
      description:
        "Load is the observed operational pressure on a PM. It aggregates weighted contributions " +
        "from all active work items: projects, critical projects, open decisions, open commitments, " +
        "execution drift (overdue tasks), escalations, and attention allocation (inverse portfolio health).",
      domains: {
        project_count: {
          description: "Number of active assigned projects. Each adds 12 load units.",
          weight:      "12 per project",
        },
        critical_projects: {
          description: "Projects with operating_health_score < 45. Each adds 8 additional load units.",
          weight:      "8 per critical project",
        },
        open_decisions: {
          description: "Open or pending operational decisions in assigned projects. Each adds 4 load units.",
          weight:      "4 per decision",
        },
        open_commitments: {
          description: "Open or pending governance commitments. Each adds 3 load units.",
          weight:      "3 per commitment",
        },
        execution_drift: {
          description: "Overdue non-completed execution tasks in assigned projects. Each adds 5 load units.",
          weight:      "5 per overdue task",
        },
        escalations: {
          description: "Open governance violations in assigned projects. Each adds 8 load units.",
          weight:      "8 per escalation",
        },
        attention_allocation: {
          description: "Inverse of portfolio health score (100 - portfolio_health). Scales at 0.30.",
          weight:      "0.30 * (100 - portfolio_health_score)",
        },
      },
    },

    utilizationModel: {
      formula:     "(load / capacity) * 100",
      description: "Utilization percentage expresses how much of the PM's sustainable capacity is consumed. " +
                   "Values above 100% indicate the PM is carrying more load than their capacity allows.",
    },

    burnRiskModel: {
      description:
        "Burn risk is the probability of operational degradation. It compounds utilization with " +
        "critical project count, escalations, execution drift, and open decision volume.",
      levels: [
        { level: "none",     threshold: `< ${PM_BURN_RISK_THRESHOLDS.none}`,   meaning: "Sustainable load, no risk signals." },
        { level: "low",      threshold: `${PM_BURN_RISK_THRESHOLDS.none}–${PM_BURN_RISK_THRESHOLDS.low - 1}`,   meaning: "Approaching capacity — monitor." },
        { level: "medium",   threshold: `${PM_BURN_RISK_THRESHOLDS.low}–${PM_BURN_RISK_THRESHOLDS.medium - 1}`,  meaning: "Multiple risk signals active — intervene soon." },
        { level: "high",     threshold: `${PM_BURN_RISK_THRESHOLDS.medium}–${PM_BURN_RISK_THRESHOLDS.high - 1}`, meaning: "High compounded risk — immediate attention required." },
        { level: "critical", threshold: `>= ${PM_BURN_RISK_THRESHOLDS.high}`,  meaning: "Systemic failure risk — redistribute or escalate immediately." },
      ],
    },

    overloadDetection: {
      description:
        "Capacity status classifies the PM's operational sustainability into five states " +
        "based on utilization percentage.",
      thresholds: [
        { range: `< ${PM_CAPACITY_STATUS_THRESHOLDS.underutilized}%`,                                                      status: "underutilized" },
        { range: `${PM_CAPACITY_STATUS_THRESHOLDS.underutilized}–${PM_CAPACITY_STATUS_THRESHOLDS.healthy - 1}%`,            status: "healthy" },
        { range: `${PM_CAPACITY_STATUS_THRESHOLDS.healthy}–${PM_CAPACITY_STATUS_THRESHOLDS.busy - 1}%`,                    status: "busy" },
        { range: `${PM_CAPACITY_STATUS_THRESHOLDS.busy}–${PM_CAPACITY_STATUS_THRESHOLDS.overloaded - 1}%`,                 status: "overloaded" },
        { range: `>= ${PM_CAPACITY_STATUS_THRESHOLDS.overloaded}%`,                                                        status: "critical" },
      ],
    },

    recommendationModel: {
      description:
        "Recommendations are generated from capacity status and burn risk. They are advisory only — " +
        "the system never executes redistributions or modifies assignments automatically.",
      actions: [
        { action: "redistribute_projects", trigger: "utilization >= 130% (critical status)" },
        { action: "reduce_load",           trigger: "overloaded status or high/critical burn risk" },
        { action: "maintain_load",         trigger: "busy or healthy status" },
        { action: "assign_new_project",    trigger: "underutilized status (utilization < 60%)" },
      ],
    },

    capacityProfile:
      "generatePMCapacityProfile() produces a complete real-time view of a PM's operational " +
      "sustainability: capacity, load, utilization, burn risk, overload flag, recommended action, " +
      "and evidence counts. It is computed on demand from live data.",

    lineage:
      "getPMCapacityLineage() reconstructs the full traceability chain: PM → Assignments → " +
      "Projects → Portfolio (PM Profile) → Performance Snapshot → Capacity Snapshot. " +
      "This provides a complete audit trail from registry through sustainability assessment.",

    sustainabilityDesign:
      "The system is designed to prevent systemic failures, not to evaluate PM quality. " +
      "Capacity calculations are evidence-based and reproducible. No capacity snapshot " +
      "modifies projects, assignments, or activates automatic redistribution. " +
      "Every recommendation is explainable and traceable to measurable evidence.",

    auditEvents: [
      "PM_CAPACITY_SNAPSHOT_GENERATED",
      "PM_CAPACITY_CALCULATED",
      "PM_LOAD_CALCULATED",
      "PM_UTILIZATION_CALCULATED",
      "PM_BURN_RISK_CALCULATED",
      "PM_OVERLOAD_DETECTED",
      "PM_CAPACITY_RECOMMENDATION_GENERATED",
      "PM_CAPACITY_COMPARED",
      "PM_CAPACITY_LINEAGE_GENERATED",
    ],

    businessRules: [
      { number: 1,  statement: "Every snapshot must originate from a registered PM." },
      { number: 2,  statement: "Every capacity value must be calculable from PM profile data." },
      { number: 3,  statement: "Every load must originate from measurable evidence." },
      { number: 4,  statement: "Every utilization must be reproducible via load / capacity * 100." },
      { number: 5,  statement: "Workspace isolation is mandatory." },
      { number: 6,  statement: "Capacity cannot be calculated for inactive PMs." },
      { number: 7,  statement: "Projects must not be modified by this engine." },
      { number: 8,  statement: "Assignments must not be modified by this engine." },
      { number: 9,  statement: "Redistributions must not be executed automatically." },
      { number: 10, statement: "Every recommendation must be explainable from evidence." },
    ],

    useCases: [
      "Generate a PM capacity snapshot to assess current operational sustainability.",
      "Generate a PM capacity profile for a real-time view without persisting.",
      "List historical capacity snapshots for a PM filtered by status or burn risk.",
      "Compare two PMs by utilization percentage to identify redistribution candidates.",
      "Detect PMs at critical overload before projects are impacted.",
      "Identify underutilized PMs eligible to receive new project assignments.",
      "Trace the full evidence chain behind a PM's capacity assessment.",
      "Explain the capacity engine to PMO stakeholders.",
    ],
  };
}
