import type {
  GovernanceComplianceSnapshotRow,
  GovernanceComplianceGapRow,
  GovernanceComplianceEvidenceRow,
  GovernanceComplianceStatus,
  GovernanceComplianceDomain,
  GovernanceGapSeverity,
} from "@/lib/db/database-contract";

export type {
  GovernanceComplianceSnapshotRow,
  GovernanceComplianceGapRow,
  GovernanceComplianceEvidenceRow,
  GovernanceComplianceStatus,
  GovernanceComplianceDomain,
  GovernanceGapSeverity,
};

// ─── Result Type ──────────────────────────────────────────────────────────────

export type GovernanceComplianceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Event Types ──────────────────────────────────────────────────────────────

export type GovernanceComplianceEventType =
  | "GOVERNANCE_COMPLIANCE_SNAPSHOT_GENERATED"
  | "GOVERNANCE_CONSTITUTION_SCORE_CALCULATED"
  | "GOVERNANCE_AUTHORITY_SCORE_CALCULATED"
  | "GOVERNANCE_RATIFICATION_SCORE_CALCULATED"
  | "GOVERNANCE_DECISION_SCORE_CALCULATED"
  | "GOVERNANCE_EXECUTION_SCORE_CALCULATED"
  | "GOVERNANCE_LEARNING_SCORE_CALCULATED"
  | "GOVERNANCE_GAP_DETECTED"
  | "GOVERNANCE_DEBT_CALCULATED"
  | "GOVERNANCE_HOTSPOT_IDENTIFIED"
  | "GOVERNANCE_COMPLIANCE_COMPARED"
  | "GOVERNANCE_LINEAGE_GENERATED";

// ─── Constants ────────────────────────────────────────────────────────────────

export const GOVERNANCE_COMPLIANCE_WEIGHTS = {
  constitution:  0.15,
  authority:     0.20,
  ratification:  0.15,
  decision:      0.20,
  execution:     0.20,
  learning:      0.10,
} as const;

export const GOVERNANCE_COMPLIANCE_STATUS_THRESHOLDS = {
  compliant: 80,
  warning:   60,
} as const;

export const GOVERNANCE_COMPLIANCE_STATUSES: GovernanceComplianceStatus[] = [
  "compliant",
  "warning",
  "critical",
];

export const GOVERNANCE_COMPLIANCE_DOMAINS: GovernanceComplianceDomain[] = [
  "constitution",
  "authority",
  "ratification",
  "decision",
  "execution",
  "learning",
];

export const GOVERNANCE_GAP_SEVERITIES: GovernanceGapSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
];

// ─── Engine Input Types ───────────────────────────────────────────────────────

export type ConstitutionComplianceInput = {
  constitutionCount: number;
  constitutionsWithValidLifecycle: number;
  constitutionsWithAmendments: number;
  completeConstitutionCount: number;
};

export type AuthorityComplianceInput = {
  totalAuthorities: number;
  expiredAuthorities: number;
  revokedAuthorities: number;
  invalidDelegations: number;
  unauthorizedActionCount: number;
};

export type RatificationComplianceInput = {
  totalRatifications: number;
  pendingRatifications: number;
  expiredRatifications: number;
  missingRatificationCount: number;
};

export type DecisionComplianceInput = {
  totalDecisions: number;
  decisionsWithLineage: number;
  decisionsWithAuthority: number;
  decisionsWithOutcome: number;
  decisionsWithAccountability: number;
};

export type ExecutionComplianceInput = {
  totalCommitments: number;
  completedCommitments: number;
  driftCount: number;
  validatedRealities: number;
  totalRealities: number;
  integrityViolations: number;
};

export type LearningComplianceInput = {
  totalMemories: number;
  digestCount: number;
  learningCount: number;
  recommendationsWithTrace: number;
  totalRecommendations: number;
};

export type OverallComplianceInput = {
  constitution: number;
  authority: number;
  ratification: number;
  decision: number;
  execution: number;
  learning: number;
};

// ─── Gap Types ────────────────────────────────────────────────────────────────

export type GovernanceGap = {
  domain: GovernanceComplianceDomain;
  gapType: string;
  severity: GovernanceGapSeverity;
  description: string;
  evidenceCount: number;
};

export type GovernanceDebt = {
  low: number;
  medium: number;
  high: number;
  critical: number;
  total: number;
};

export type GovernanceHotspot = {
  domain: GovernanceComplianceDomain;
  gapCount: number;
  dominantSeverity: GovernanceGapSeverity;
};

// ─── Service Input Types ──────────────────────────────────────────────────────

export type GenerateGovernanceComplianceSnapshotInput = {
  workspaceId: string;
  pmId: string;
  actorId?: string;
};

export type GetGovernanceComplianceSnapshotInput = {
  workspaceId: string;
  snapshotId: string;
};

export type ListGovernanceComplianceSnapshotsInput = {
  workspaceId: string;
  pmId?: string;
  status?: GovernanceComplianceStatus;
  minScore?: number;
  maxScore?: number;
  from?: string;
  to?: string;
  limit?: number;
};

export type GenerateGovernanceScorecardInput = {
  workspaceId: string;
  pmId: string;
};

export type CompareGovernanceComplianceInput = {
  workspaceId: string;
  pmAId: string;
  pmBId: string;
};

export type GeneratePMOComplianceSummaryInput = {
  workspaceId: string;
};

export type GetGovernanceComplianceLineageInput = {
  workspaceId: string;
  pmId: string;
};

// ─── Composite Output Types ───────────────────────────────────────────────────

export type GovernanceScorecard = {
  pm: {
    id: string;
    name: string;
    email: string;
  };
  scores: {
    constitution: number;
    authority: number;
    ratification: number;
    decision: number;
    execution: number;
    learning: number;
    overall: number;
  };
  status: GovernanceComplianceStatus;
  gaps: GovernanceGap[];
  debt: GovernanceDebt;
  hotspots: GovernanceHotspot[];
  explanation: {
    summary: string;
    compliantDomains: string[];
    warningDomains: string[];
    criticalDomains: string[];
  };
  generatedAt: string;
};

export type GovernanceComplianceComparison = {
  pmA: {
    id: string;
    name: string;
    overallScore: number;
    status: GovernanceComplianceStatus;
  };
  pmB: {
    id: string;
    name: string;
    overallScore: number;
    status: GovernanceComplianceStatus;
  };
  difference: number;
  stronger: "a" | "b" | "equal";
  domainComparison: Record<GovernanceComplianceDomain, { pmA: number; pmB: number; winner: "a" | "b" | "equal" }>;
};

export type PMOComplianceSummary = {
  pmo: {
    pms: number;
    compliant: number;
    warning: number;
    critical: number;
  };
  overall: number;
  hotspots: GovernanceHotspot[];
  totalDebt: GovernanceDebt;
};

export type GovernanceComplianceLineage = {
  pm: { id: string; name: string; email: string };
  constitutions: Array<{ id: string; projectId: string; lifecycleStatus: string }>;
  authorities: Array<{ id: string; status: string; expiresAt: string | null }>;
  decisions: Array<{ id: string; status: string; hasOutcome: boolean }>;
  ratifications: Array<{ id: string; status: string }>;
  commitments: Array<{ id: string; status: string }>;
  memories: Array<{ id: string }>;
  complianceSnapshot: {
    id: string;
    overallScore: number;
    status: GovernanceComplianceStatus;
    generatedAt: string;
  } | null;
};
