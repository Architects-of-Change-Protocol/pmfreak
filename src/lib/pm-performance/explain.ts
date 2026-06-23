import { PM_PERFORMANCE_WEIGHTS, PM_PERFORMANCE_STATUS_THRESHOLDS } from "./types";

// ─── Explain Type ─────────────────────────────────────────────────────────────

export type PMPerformanceEngineExplanation = {
  concept: string;
  principles: Array<{ number: number; statement: string }>;
  performanceDomains: Record<string, { description: string; weight: number; basedOn: string[] }>;
  scoreModel: {
    range: string;
    defaultWhenNoData: number;
    clampedTo: string;
  };
  weightingModel: Record<string, number>;
  statusClassification: Array<{ range: string; status: string }>;
  evidenceModel: {
    sources: string[];
    nonPunitivePrinciple: string;
  };
  scorecard: string;
  lineage: string;
  auditEvents: string[];
  businessRules: Array<{ number: number; statement: string }>;
  useCases: string[];
};

// ─── explainPMPerformanceEngine ───────────────────────────────────────────────

export function explainPMPerformanceEngine(): PMPerformanceEngineExplanation {
  return {
    concept:
      "The PM Performance Engine transforms PM assignments into measurable, evidence-based " +
      "performance intelligence. It aggregates data from Project OS Snapshots, Execution Realities, " +
      "and Decision Outcomes to produce governance, execution, prediction, decision, and portfolio " +
      "scores, combined into an overall scorecard. The engine does not punish PMs — it provides " +
      "early detection and support signals.",

    principles: [
      { number: 1, statement: "PM performance must be based on evidence, not opinion." },
      { number: 2, statement: "No subjective evaluation is permitted." },
      { number: 3, statement: "Every metric must be explainable." },
      { number: 4, statement: "Every metric must be traceable to assigned projects." },
      { number: 5, statement: "Scores are not punitive by design." },
      { number: 6, statement: "The goal is early detection and support, not ranking." },
      { number: 7, statement: "Workspace isolation is mandatory." },
    ],

    performanceDomains: {
      governance: {
        description:
          "Measures how well the PM maintains project governance. Derived from " +
          "governance_health_score in Project OS Snapshots, with penalties for open " +
          "governance violations and pending authority escalations.",
        weight: PM_PERFORMANCE_WEIGHTS.governance,
        basedOn: ["project_os_snapshots.governance_health_score", "governance_violations", "authority_escalations"],
      },
      execution: {
        description:
          "Measures how well the PM drives execution. Derived from execution_health_score " +
          "in Project OS Snapshots, task completion rate, and overdue task count.",
        weight: PM_PERFORMANCE_WEIGHTS.execution,
        basedOn: ["project_os_snapshots.execution_health_score", "execution_tasks"],
      },
      prediction: {
        description:
          "Measures the accuracy of the PM's execution projections. Derived from " +
          "confidence_score in Execution Realities.",
        weight: PM_PERFORMANCE_WEIGHTS.prediction,
        basedOn: ["execution_realities.confidence_score"],
      },
      decision: {
        description:
          "Measures the effectiveness of decisions in PM's assigned projects. Derived from " +
          "effectiveness_score and outcome_status in Operational Decision Outcomes.",
        weight: PM_PERFORMANCE_WEIGHTS.decision,
        basedOn: ["operational_decision_outcomes.effectiveness_score", "operational_decision_outcomes.outcome_status"],
      },
      portfolio: {
        description:
          "Measures the aggregate health of the PM's assigned project portfolio. Derived from " +
          "operating_health_score in Project OS Snapshots, with additional penalties for " +
          "critical projects (score < 45).",
        weight: PM_PERFORMANCE_WEIGHTS.portfolio,
        basedOn: ["project_os_snapshots.operating_health_score"],
      },
    },

    scoreModel: {
      range:             "0–100",
      defaultWhenNoData: 75,
      clampedTo:         "All scores are clamped to [0, 100] and rounded to the nearest integer.",
    },

    weightingModel: {
      governance: PM_PERFORMANCE_WEIGHTS.governance,
      execution:  PM_PERFORMANCE_WEIGHTS.execution,
      prediction: PM_PERFORMANCE_WEIGHTS.prediction,
      decision:   PM_PERFORMANCE_WEIGHTS.decision,
      portfolio:  PM_PERFORMANCE_WEIGHTS.portfolio,
    },

    statusClassification: [
      { range: `${PM_PERFORMANCE_STATUS_THRESHOLDS.excellent}–100`, status: "excellent" },
      { range: `${PM_PERFORMANCE_STATUS_THRESHOLDS.strong}–${PM_PERFORMANCE_STATUS_THRESHOLDS.excellent - 1}`, status: "strong" },
      { range: `${PM_PERFORMANCE_STATUS_THRESHOLDS.stable}–${PM_PERFORMANCE_STATUS_THRESHOLDS.strong - 1}`, status: "stable" },
      { range: `${PM_PERFORMANCE_STATUS_THRESHOLDS.warning}–${PM_PERFORMANCE_STATUS_THRESHOLDS.stable - 1}`, status: "warning" },
      { range: `0–${PM_PERFORMANCE_STATUS_THRESHOLDS.warning - 1}`, status: "critical" },
    ],

    evidenceModel: {
      sources: [
        "project_os_snapshots — governance, execution, portfolio health",
        "execution_realities — prediction accuracy",
        "operational_decision_outcomes — decision effectiveness",
        "governance_violations — governance penalty",
        "execution_tasks — execution completion and overdue",
      ],
      nonPunitivePrinciple:
        "The engine measures to support, not to punish. Scores below threshold trigger " +
        "support recommendations, not automatic consequences. No PM score modifies " +
        "projects, assignments, or activates automatic actions.",
    },

    scorecard:
      "The PM Scorecard is a structured summary produced by generatePMScorecard(). " +
      "It includes all 5 domain scores, the overall score, performance status, evidence " +
      "counts, and a human-readable explanation with strengths and attention areas.",

    lineage:
      "getPMPerformanceLineage() reconstructs the full traceability chain from PM → " +
      "Assignments → Projects → Project OS Snapshots → Execution Realities → " +
      "Decision Outcomes → Performance Snapshot.",

    auditEvents: [
      "PM_PERFORMANCE_SNAPSHOT_GENERATED",
      "PM_SCORECARD_GENERATED",
      "PM_GOVERNANCE_SCORE_CALCULATED",
      "PM_EXECUTION_SCORE_CALCULATED",
      "PM_PREDICTION_ACCURACY_CALCULATED",
      "PM_DECISION_EFFECTIVENESS_CALCULATED",
      "PM_PORTFOLIO_HEALTH_CALCULATED",
      "PM_OVERALL_PERFORMANCE_CALCULATED",
      "PM_PERFORMANCE_COMPARED",
      "PM_PERFORMANCE_LINEAGE_GENERATED",
    ],

    businessRules: [
      { number: 1, statement: "Every performance snapshot must originate from a registered PM." },
      { number: 2, statement: "Every score must be calculable from evidence." },
      { number: 3, statement: "Every score must be between 0 and 100." },
      { number: 4, statement: "Every score must have a status classification." },
      { number: 5, statement: "Every snapshot is historical and immutable after generation." },
      { number: 6, statement: "Workspace isolation is mandatory — no cross-workspace access." },
      { number: 7, statement: "PMs without active assignments cannot be evaluated." },
      { number: 8, statement: "Performance scores do not modify projects or assignments." },
      { number: 9, statement: "Performance scores do not activate automatic actions." },
      { number: 10, statement: "Every evaluation is explainable and traceable to assigned projects." },
    ],

    useCases: [
      "Generate a PM performance snapshot on demand.",
      "View a PM scorecard with domain scores and explanations.",
      "List historical performance snapshots for a PM.",
      "Compare two PMs by overall score.",
      "Trace the full evidence chain behind a PM's score.",
      "Identify PMs whose portfolio health is declining.",
      "Detect PMs who need support before projects become critical.",
    ],
  };
}
