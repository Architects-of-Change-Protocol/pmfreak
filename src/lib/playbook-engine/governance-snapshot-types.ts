import type { PlaybookRuleEvaluation } from "./types";
import type { ProjectConstitutionDraft } from "./constitution-generator";
import type { PlaybookRecommendation } from "./recommendation-engine";
import type { CommunicationDraft } from "./communication-types";
import type { OperationalDraft } from "./operational-intelligence-types";
import type { ClosureBillingAssessment, ClosureBillingNextAction } from "./closure-billing-types";
import type { PlaybookAuditEvent, PlaybookAuditRelatedEntityType } from "./playbook-audit-types";

export type PlaybookRulesEvaluationSummary = {
  totalRules: number;
  firedCount: number;
  notFiredCount: number;
  indeterminateCount: number;
  evaluations: PlaybookRuleEvaluation[];
};

/** One entry per governed artifact (recommendation/draft/blocker/action) whose suggested actions
 * include at least one requiring human approval — surfaced so a demo/UI can list "what needs a
 * human" without walking every sub-collection of the snapshot itself. */
export type PlaybookGovernanceApprovalItem = {
  relatedEntityType: PlaybookAuditRelatedEntityType;
  relatedEntityId: string;
  title: string;
  reason: string;
};

export type PlaybookGovernanceSnapshot = {
  /** Deterministic sha256 derived from every governed artifact's own fingerprint — re-running
   * `generatePlaybookGovernanceSnapshot` on identical input always yields the same id. */
  id: string;
  fingerprint: string;
  projectId: string;
  workspaceId: string;
  playbookId: string;
  playbookVersion: number;
  rulesEvaluationSummary: PlaybookRulesEvaluationSummary;
  /** `null` when `options.generateConstitutionDraft` was explicitly set to `false`. */
  constitutionDraft: ProjectConstitutionDraft | null;
  recommendations: PlaybookRecommendation[];
  communicationDrafts: CommunicationDraft[];
  operationalDrafts: OperationalDraft[];
  closureBillingAssessment: ClosureBillingAssessment;
  /** Deduplicated by fingerprint — see `dedupePlaybookAuditEvents`. */
  auditEvents: PlaybookAuditEvent[];
  /** Reuses `ClosureBillingAssessment.nextBestActions` (Sprint 6) directly rather than inventing
   * a parallel next-actions model at the snapshot level. */
  nextBestActions: ClosureBillingNextAction[];
  approvalRequiredSummary: PlaybookGovernanceApprovalItem[];
  /** Deduplicated `PlaybookFactKey`/field names missing across rules evaluation, recommendations,
   * and the closure/billing assessment. */
  missingEvidenceSummary: string[];
  /** A short, human-readable narrative summarizing the whole chain for demo purposes. */
  demoSummary: string;
  createdAt: string;
};

export type PlaybookGovernanceSnapshotExplanation = {
  whatWasEvaluated: string;
  rulesActivated: string[];
  recommendationsGenerated: string[];
  draftsGenerated: string[];
  blockersDetected: string[];
  evidenceUsed: string[];
  missingEvidence: string[];
  actionsRequiringApproval: string[];
  /** The governed sentence confirming nothing was executed and the snapshot is read-only/demo
   * unless a future sprint adds a materialization step. */
  narrative: string;
};
