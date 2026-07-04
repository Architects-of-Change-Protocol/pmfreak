import type { PlaybookEvidenceUsed, PlaybookFactKey } from "./types";

export type CommunicationTemplateId =
  | "soft_follow_up"
  | "formal_follow_up"
  | "reception_request"
  | "billing_enablement_follow_up"
  | "soft_escalation"
  | "formal_escalation"
  | "meeting_minutes"
  | "decision_request"
  | "information_request"
  | "closure_confirmation"
  | "scope_change_notice";

export type CommunicationPurpose =
  | "follow_up"
  | "reception_request"
  | "billing_enablement"
  | "escalation"
  | "meeting_minutes"
  | "decision_request"
  | "information_request"
  | "closure_confirmation"
  | "scope_change_notice";

export type CommunicationTone = "soft" | "formal" | "neutral";

/** Mirrors `CommunicationDraft.channel` — the medium a draft is written for, never actually
 * dispatched through by this sprint (see `externalSendRequiresApproval`/no-send guarantees). */
export type CommunicationChannel = "email" | "meeting_minutes" | "internal_note";

export type CommunicationDraftStatus = "draft" | "reviewed" | "approved" | "copied" | "sent_manually" | "discarded";

export type CommunicationDraftRecipientRole = "client" | "sponsor" | "internal" | "other";

/** A recipient the caller already knows about. Never fabricated by the engine — if the caller
 * supplies none, the draft's `recipients` stay empty and `missingInputs` records it. */
export type CommunicationDraftRecipient = {
  name: string | null;
  email: string | null;
  role: CommunicationDraftRecipientRole;
};

/**
 * Free-text/contact content the `PlaybookRecommendation`/`ProjectContextFacts` (Sprint 1/3)
 * never carry — mirrors the role `ProjectConstitutionSourceFacts` (Sprint 2) plays for the
 * Constitution Generator. Every field is optional and, when absent, the corresponding
 * `requiredInputs` entry surfaces in `missingInputs` instead of being guessed.
 */
export type CommunicationAdditionalInputs = {
  meetingDate?: string | null;
  attendees?: string[] | null;
  decisionsMade?: string[] | null;
  decisionNeeded?: string | null;
  decisionOwner?: string | null;
  decisionDeadline?: string | null;
  billingContactName?: string | null;
  scopeChangeSummary?: string | null;
  closureSummary?: string | null;
  requestedInformation?: string[] | null;
};

export type CommunicationProjectContext = {
  projectName?: string | null;
  recipients?: CommunicationDraftRecipient[] | null;
  cc?: CommunicationDraftRecipient[] | null;
  additionalInputs?: CommunicationAdditionalInputs | null;
};

export type CommunicationTemplateInputContext = {
  recommendation: import("./recommendation-engine").PlaybookRecommendation;
  projectContext: CommunicationProjectContext;
  recipients: CommunicationDraftRecipient[];
  missingInputs: string[];
};

export type CommunicationTemplate = {
  id: CommunicationTemplateId;
  name: string;
  purpose: CommunicationPurpose;
  tone: CommunicationTone;
  channel: CommunicationChannel;
  /** Free-form matching tags this template is known to apply to. Informational only — actual
   * selection logic lives in `selectCommunicationTemplateForRecommendation`. */
  applicableRecommendationTypes: string[];
  /** Named inputs this template needs beyond the recommendation itself. Checked against
   * `CommunicationProjectContext` to compute `missingInputs`. */
  requiredInputs: string[];
  approvalRequired: boolean;
  externalSendRequiresApproval: true;
  subjectGenerator?: (ctx: CommunicationTemplateInputContext) => string;
  bodyGenerator: (ctx: CommunicationTemplateInputContext) => string;
};

export type CommunicationDraftExplanation = {
  templateChosenBecause: string;
  originRecommendation: string;
  supportingRule: string;
  evidenceUsed: string[];
  missingEvidence: string[];
  missingInputs: string[];
  requiresHumanReview: boolean;
  /** The single governed sentence confirming this draft was never sent automatically. */
  narrative: string;
};

export type CommunicationDraft = {
  id: string;
  /** Deterministic sha256 of (recommendation.fingerprint, templateId) — the sole idempotency
   * mechanism, mirroring `PlaybookRecommendation.fingerprint` from Sprint 3. */
  fingerprint: string;
  projectId: string;
  workspaceId: string;
  linkedRecommendationId: string;
  playbookRuleId: string;
  templateId: CommunicationTemplateId;
  channel: CommunicationChannel;
  status: CommunicationDraftStatus;
  subject: string | null;
  body: string;
  recipients: CommunicationDraftRecipient[];
  cc: CommunicationDraftRecipient[];
  missingInputs: string[];
  evidenceUsed: PlaybookEvidenceUsed[];
  missingEvidence: PlaybookFactKey[];
  approvalRequired: boolean;
  externalSendRequiresApproval: boolean;
  explanation: CommunicationDraftExplanation;
  createdAt: string;
  updatedAt: string;
};
