import type { PlaybookEvidenceUsed, PlaybookFactKey, PlaybookRuleSeverity } from "./types";
import type { OperationalDraftType } from "./operational-intelligence-types";
import type { CommunicationTemplateId } from "./communication-types";

/** Whether the project is confidently ready, confidently not ready, or there isn't enough
 * evidence either way — mirrors `PlaybookRuleEvaluationStatus`'s "never invent" principle:
 * absence of blockers is only "ready" when the underlying evidence is actually known. */
export type ClosureReadinessStatus = "ready" | "not_ready" | "indeterminate";
export type BillingReadinessStatus = "ready" | "not_ready" | "indeterminate";

export type ClosureChecklistItemCategory =
  | "technical"
  | "client_acceptance"
  | "commercial"
  | "administrative"
  | "financial"
  | "governance"
  | "evidence";

export type ClosureChecklistItemStatus = "complete" | "missing" | "not_applicable" | "requires_validation";

/** Where a checklist item's evidence comes from. `constitution` = a Project Constitution
 * draft field (Sprint 2); `project_context` = a direct `ProjectContextFacts` fact;
 * `playbook` = a playbook-defined phase gate; `inferred_rule` = derived by comparing a
 * count fact against a threshold rather than reading a single flag. */
export type ClosureChecklistItemSource = "playbook" | "constitution" | "project_context" | "inferred_rule";

export type ClosureChecklistItem = {
  id: string;
  label: string;
  category: ClosureChecklistItemCategory;
  status: ClosureChecklistItemStatus;
  evidenceKey: PlaybookFactKey | null;
  blockingClosure: boolean;
  blockingBilling: boolean;
  source: ClosureChecklistItemSource;
  notes: string | null;
};

export type ClosureChecklistStatus = "complete" | "incomplete" | "indeterminate";

export type ClosureChecklist = {
  projectId: string;
  items: ClosureChecklistItem[];
  completedCount: number;
  totalCount: number;
  missingCount: number;
  status: ClosureChecklistStatus;
};

export type ClosureBlockerType =
  | "missing_deliverable"
  | "missing_acceptance"
  | "missing_evidence"
  | "unresolved_risk"
  | "unresolved_issue"
  | "unresolved_dependency"
  | "missing_decision"
  | "unknown_closure_rule"
  | "other";

export type BillingBlockerType =
  | "missing_reception"
  | "missing_signoff"
  | "missing_acceptance_criteria"
  | "missing_evidence"
  | "missing_report"
  | "missing_po"
  | "missing_validation"
  | "missing_internal_approval"
  | "missing_liquidation"
  | "unresolved_issue"
  | "unresolved_dependency"
  | "unknown_billing_rule"
  | "other";

export type ClosureBillingBlockerStatus = "open" | "reviewed";

/**
 * Whether a blocker's underlying checklist item is a *confirmed* gap or merely *unknown*
 * evidence — reuses `ClosureChecklistItemStatus`'s own two non-terminal values instead of
 * inventing a parallel confidence vocabulary. A blocker only ever exists for a checklist item
 * whose status is `"missing"` (a fact is explicitly known to be `false`/absent — e.g.
 * `hasClientSignoff: false`) or `"requires_validation"` (the fact is `null`/unrecorded, or the
 * Project Constitution reports the artifact exists elsewhere and needs importing). Both produce a
 * blocker (closure/billing can't proceed either way), but only `"missing"` means the engine has
 * confirmed evidence of absence — `"requires_validation"` means it genuinely doesn't know and
 * must never be read as if it had confirmed anything (the "no inventar datos" principle applied
 * at the blocker level, not just at the assessment's `closureStatus`/`billingStatus`).
 */
export type ClosureBillingBlockerEvidenceStatus = Extract<ClosureChecklistItemStatus, "missing" | "requires_validation">;

/** Fields shared by `ClosureBlocker`/`BillingBlocker`. Never carries invented owner/dueDate —
 * both stay `null` unless the caller's `ClosureBillingProjectContext` supplied them. */
type ClosureBillingBlockerCommon = {
  id: string;
  severity: PlaybookRuleSeverity;
  description: string;
  owner: string | null;
  dueDate: string | null;
  evidenceUsed: PlaybookEvidenceUsed[];
  missingEvidence: PlaybookFactKey[];
  approvalRequired: boolean;
  suggestedAction: string;
  status: ClosureBillingBlockerStatus;
  /** See `ClosureBillingBlockerEvidenceStatus`. Lets a UI/comms consumer distinguish "confirmed
   * absent" from "simply unknown" without re-deriving it from the checklist. */
  evidenceStatus: ClosureBillingBlockerEvidenceStatus;
  /** The `ClosureChecklistItem.id` this blocker was derived from. */
  relatedChecklistItemId: string;
  /** Populated only when a matching `PlaybookRecommendation` was passed into
   * `evaluateClosureAndBilling` (e.g. `pb-close-signoff-missing`) — never fabricated. */
  relatedRecommendationId: string | null;
};

export type ClosureBlocker = ClosureBillingBlockerCommon & { type: ClosureBlockerType };
export type BillingBlocker = ClosureBillingBlockerCommon & { type: BillingBlockerType };

export type ClosureBillingNextActionType =
  | "request_formal_reception"
  | "billing_enablement_follow_up"
  | "request_missing_evidence"
  | "request_client_validation"
  | "prepare_final_report"
  | "request_po_validation"
  | "convert_to_operational_issue"
  | "convert_to_operational_dependency"
  | "start_internal_billing_process"
  | "start_administrative_closure"
  | "review_project_constitution_rules";

export type ClosureBillingNextAction = {
  id: string;
  type: ClosureBillingNextActionType;
  description: string;
  relatedBlockerId: string | null;
  recommendedCommunicationTemplateId: CommunicationTemplateId | null;
  recommendedOperationalDraftType: OperationalDraftType | null;
  approvalRequired: boolean;
};

export type ClosureBillingExplanation = {
  closureReadinessExplanation: string;
  billingReadinessExplanation: string;
  evidenceUsed: string[];
  missingEvidence: string[];
  closureBlockersSummary: string[];
  billingBlockersSummary: string[];
  nextBestAction: string | null;
  requiresHumanReview: boolean;
  /** The governed sentence confirming nothing was closed/invoiced automatically. */
  narrative: string;
};

export type ClosureBillingAssessmentReviewStatus = "draft" | "reviewed" | "discarded";

/** Free-text/ownership content `ProjectContextFacts` never carries — mirrors the role
 * `OperationalIntelligenceProjectContext` plays for operational drafts. Applied uniformly to
 * every blocker generated by this assessment; never invented if absent. */
export type ClosureBillingProjectContext = {
  owner?: string | null;
  dueDate?: string | null;
};

export type ClosureBillingAssessment = {
  id: string;
  /** Deterministic sha256 of (workspaceId, projectId, playbookId, playbookVersion, checklist
   * item statuses, blocker types) — re-evaluating identical input always yields the same
   * fingerprint/id, the sole idempotency mechanism since there is no persistence layer yet. */
  fingerprint: string;
  workspaceId: string;
  projectId: string;
  playbookId: string;
  playbookVersion: number;
  reviewStatus: ClosureBillingAssessmentReviewStatus;
  closureStatus: ClosureReadinessStatus;
  billingStatus: BillingReadinessStatus;
  readyForClosure: boolean;
  readyForBilling: boolean;
  /** Share of "technical" category checklist items marked complete, 0-100. `null` when there
   * are no applicable technical items to derive a ratio from — never guessed. */
  technicalCompletionRatio: number | null;
  checklist: ClosureChecklist;
  closureBlockers: ClosureBlocker[];
  billingBlockers: BillingBlocker[];
  evidenceUsed: PlaybookEvidenceUsed[];
  missingEvidence: PlaybookFactKey[];
  nextBestActions: ClosureBillingNextAction[];
  recommendedCommunicationTemplateId: CommunicationTemplateId | null;
  recommendedOperationalDraftTypes: OperationalDraftType[];
  approvalRequired: boolean;
  explanation: ClosureBillingExplanation;
  createdAt: string;
  updatedAt: string;
};
