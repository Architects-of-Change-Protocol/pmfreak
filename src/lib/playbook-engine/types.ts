export type PlaybookEngineFailureClass =
  | "validation_failed"
  | "not_found"
  | "insufficient_evidence"
  | "persistence_failed"
  | "event_emission_failed"
  | "governance_violation";

export type PlaybookEngineResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: PlaybookEngineFailureClass };

export type PlaybookPhaseKey =
  | "iniciacion"
  | "planificacion"
  | "ejecucion"
  | "monitoreo_control"
  | "cierre";

export type PlaybookRuleSeverity = "low" | "medium" | "high" | "critical";

export type PlaybookRuleScope = PlaybookPhaseKey | "any";

/**
 * Every known fact the Rules Engine can reason about. All fields are nullable —
 * `null`/`undefined` means "unknown", never "false". Rules must never treat
 * missing evidence as a negative signal (see design rule: no inventar datos).
 */
export type ProjectContextFacts = {
  projectId: string;
  workspaceId: string;
  phase: PlaybookPhaseKey | null;
  hasApprovedCharter: boolean | null;
  hasApprovedConstitution: boolean | null;
  hasScopeBaseline: boolean | null;
  hasWbs: boolean | null;
  hasScheduleBaseline: boolean | null;
  hasBudgetBaseline: boolean | null;
  hasRiskRegister: boolean | null;
  hasStakeholderMap: boolean | null;
  hasCommunicationsPlan: boolean | null;
  hasClosureChecklistStarted: boolean | null;
  hasFinalInvoiceIssued: boolean | null;
  hasClientSignoff: boolean | null;
  openCriticalRisks: number | null;
  openHighRisks: number | null;
  openIssues: number | null;
  overdueTasks: number | null;
  daysSinceLastStatusUpdate: number | null;
  scheduleVarianceDays: number | null;
  budgetVariancePercent: number | null;
  /** Closure & Billing Intelligence (Sprint 6) facts below. Same "unknown, never false" rule
   * applies: absence of evidence must never be read as "not done". */
  hasDeliverablesCompleted: boolean | null;
  hasTechnicalEvidence: boolean | null;
  /** Client validated/accepted the work — distinct from `hasClientSignoff` (the formal
   * reception/sign-off document), since a client can validate informally before signing off. */
  hasClientValidation: boolean | null;
  hasClosureDecisionsMade: boolean | null;
  hasFinalReportDelivered: boolean | null;
  /** Whether a final report is required for this project at all; `null` means unknown. */
  requiresFinalReport: boolean | null;
  hasPurchaseOrder: boolean | null;
  requiresPurchaseOrder: boolean | null;
  hasAdministrativeDocumentationComplete: boolean | null;
  requiresAdministrativeDocumentation: boolean | null;
  hasInternalApprovalForBilling: boolean | null;
  openCriticalDependencies: number | null;
  openBlockingIssues: number | null;
  metadata: Record<string, unknown>;
};

export type PlaybookFactKey = keyof Omit<ProjectContextFacts, "projectId" | "workspaceId" | "metadata" | "phase">;

export type PlaybookRuleOperator =
  | "equals"
  | "not_equals"
  | "is_true"
  | "is_false"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than";

export type PlaybookFactCheck = {
  fact: PlaybookFactKey;
  operator: PlaybookRuleOperator;
  value?: boolean | number;
};

/**
 * A concrete, governed action a rule may propose once fired. `action` is a stable
 * machine-readable identifier (e.g. "generate_project_constitution_draft") consumed by
 * downstream sprints (Recommendation Engine, Communications Playbook, etc.). Suggesting
 * an action never executes it — execution and approval remain outside the Rules Engine.
 */
export type PlaybookSuggestedAction = {
  action: string;
  description: string;
  /** Whether a human must approve before this action's effects take hold. */
  approvalRequired: boolean;
};

export type PlaybookRule = {
  id: string;
  scope: PlaybookRuleScope;
  title: string;
  description: string;
  severity: PlaybookRuleSeverity;
  /** All conditions are AND-combined. A rule with no evaluable evidence never fires. */
  conditions: PlaybookFactCheck[];
  /** Facts referenced for evidence reporting, superset of conditions' facts. */
  evidenceFacts: PlaybookFactKey[];
  /** Spanish-language template consumed by the Recommendation Engine (Sprint 3). */
  recommendationTemplate: string;
  /** Optional structured actions the rule proposes once fired. Never invented for other statuses. */
  suggestedActions?: PlaybookSuggestedAction[];
};

export type PlaybookPhase = {
  key: PlaybookPhaseKey;
  name: string;
  description: string;
  entryEvidence: PlaybookFactKey[];
  exitEvidence: PlaybookFactKey[];
};

export type DeliveryPlaybook = {
  id: string;
  name: string;
  version: number;
  description: string;
  phases: PlaybookPhase[];
  rules: PlaybookRule[];
};

export type PlaybookRuleEvaluationStatus = "fired" | "not_fired" | "indeterminate";

export type PlaybookEvidenceUsed = {
  fact: PlaybookFactKey;
  value: boolean | number;
};

export type PlaybookRuleEvaluation = {
  ruleId: string;
  scope: PlaybookRuleScope;
  title: string;
  description: string;
  severity: PlaybookRuleSeverity;
  status: PlaybookRuleEvaluationStatus;
  evidenceUsed: PlaybookEvidenceUsed[];
  evidenceMissing: PlaybookFactKey[];
  /** Populated only when status === "fired"; never invented for other statuses. */
  recommendationTemplate: string | null;
  /** Populated only when status === "fired"; never invented for other statuses. */
  suggestedActions: PlaybookSuggestedAction[] | null;
};
