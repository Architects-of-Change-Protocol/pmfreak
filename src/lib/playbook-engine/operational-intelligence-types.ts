import type { PlaybookEvidenceUsed, PlaybookFactKey, PlaybookRuleSeverity } from "./types";

export type OperationalDraftType = "risk" | "issue" | "dependency" | "decision";

export type OperationalDraftStatus = "draft" | "reviewed" | "approved" | "converted" | "discarded";

/** Reuses the Rules Engine's severity scale (Sprint 1) instead of inventing a parallel one. */
export type OperationalDraftSeverity = PlaybookRuleSeverity;

export type RiskDraftCategory =
  | "technical"
  | "client"
  | "provider"
  | "contractual"
  | "financial"
  | "reputational"
  | "internal"
  | "logistics"
  | "commercial";

export type DependencyDraftType = "client" | "provider" | "internal" | "technical" | "contractual" | "commercial";

export type DependencyEscalationLevel = "none" | "soft" | "formal" | "critical";

/**
 * Free-text/known-fact content a `PlaybookRecommendation` never carries — mirrors the role
 * `CommunicationProjectContext` (Sprint 4) plays for communication drafts. Every field is
 * optional and, when absent, the corresponding entry surfaces in `missingInputs` instead of
 * being guessed. Nothing here is ever invented by the engine.
 */
export type OperationalIntelligenceProjectContext = {
  owner?: string | null;
  dueDate?: string | null;
  decisionOwner?: string | null;
  decisionDeadline?: string | null;
  externalParty?: string | null;
  linkedMilestoneId?: string | null;
  mitigation?: string | null;
  options?: string[] | null;
  recommendedOption?: string | null;
  consequenceIfNotDecided?: string | null;
};

export type OperationalDraftExplanation = {
  originRecommendation: string;
  supportingRule: string;
  /** Why this recommendation was classified as risk/issue/dependency/decision (and any subtype). */
  classifiedAsBecause: string;
  evidenceUsed: string[];
  missingEvidence: string[];
  missingInputs: string[];
  requiresHumanReview: boolean;
  /** The single governed sentence confirming this draft was never converted automatically. */
  narrative: string;
};

/** Fields shared by every operational draft, regardless of type. */
type OperationalDraftCommon = {
  id: string;
  /** Deterministic sha256 of (workspaceId, projectId, recommendation.fingerprint, playbookRuleId,
   * type, subtype). Re-generating from the same recommendation always yields the same
   * fingerprint/id — the sole idempotency mechanism, since there is no persistence layer yet. */
  fingerprint: string;
  workspaceId: string;
  projectId: string;
  linkedRecommendationId: string;
  playbookRuleId: string;
  status: OperationalDraftStatus;
  title: string;
  description: string;
  severity: OperationalDraftSeverity;
  /** Never invented — only ever populated from `OperationalIntelligenceProjectContext.owner`.
   * Distinct from `DecisionDraft.decisionOwner`: this is "who is coordinating/tracking this
   * draft," which for a decision draft is a different (and usually unset) question from "who
   * must make the decision." The two are never auto-synced — see `buildDraft` in
   * `operational-intelligence-engine.ts`. */
  owner: string | null;
  /** Never invented — only ever populated from `OperationalIntelligenceProjectContext.dueDate`. */
  dueDate: string | null;
  evidenceUsed: PlaybookEvidenceUsed[];
  missingEvidence: PlaybookFactKey[];
  /** Named inputs this draft still needs before it could become a real object (owner, dueDate,
   * decisionOwner, mitigation, etc.) — never guessed, always surfaced here instead. */
  missingInputs: string[];
  approvalRequired: boolean;
  explanation: OperationalDraftExplanation;
  createdAt: string;
  updatedAt: string;
};

export type RiskDraft = OperationalDraftCommon & {
  type: "risk";
  category: RiskDraftCategory;
  /** Never invented — there is no evidence source for probability in `ProjectContextFacts` yet. */
  probability: "low" | "medium" | "high" | null;
  /** Derived from the firing rule's severity (real evidence), never guessed independently. */
  impact: "low" | "medium" | "high" | null;
  /** Never invented — only populated from `OperationalIntelligenceProjectContext.mitigation`. */
  mitigation: string | null;
  escalationRecommended: boolean;
};

export type IssueDraft = OperationalDraftCommon & {
  type: "issue";
  blocking: boolean;
  linkedMilestoneId: string | null;
  impactDescription: string;
  resolutionSuggestion: string | null;
};

export type DependencyDraft = OperationalDraftCommon & {
  type: "dependency";
  dependencyType: DependencyDraftType;
  /** Never invented — only ever populated from `OperationalIntelligenceProjectContext.externalParty`. */
  externalParty: string | null;
  blockingStatus: boolean;
  linkedMilestoneId: string | null;
  escalationLevel: DependencyEscalationLevel;
};

export type DecisionDraft = OperationalDraftCommon & {
  type: "decision";
  /** Who must make the decision. Never invented — only ever populated from
   * `OperationalIntelligenceProjectContext.decisionOwner`, and never backfilled from/synced with
   * the common `owner` field above (they answer different questions and may legitimately differ
   * or both be `null`). Mappers into `decision-governance` (see
   * `operational-intelligence-mappers.ts`) must read `decisionOwner`, never `owner`, when they
   * need "who decides." */
  decisionOwner: string | null;
  /** Never invented — only ever populated from `OperationalIntelligenceProjectContext.options`. */
  options: string[];
  recommendedOption: string | null;
  deadline: string | null;
  consequenceIfNotDecided: string | null;
};

export type OperationalDraft = RiskDraft | IssueDraft | DependencyDraft | DecisionDraft;
