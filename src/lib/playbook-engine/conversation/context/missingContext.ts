import type { ConversationIntent, ConversationMetadata, MissingContextItem, ResolvedProjectContext } from "../types";

/**
 * Per-intent "what would make this a great answer" checklist. Never a hard requirement to
 * produce a response — handlers must always give useful guidance even when everything here is
 * missing — but it drives what the composer surfaces as "here's what I'd need to be precise."
 * `general_pm_advice` deliberately has no entry: open-ended PM advice never requires project
 * context by design.
 */
const INTENT_CONTEXT_NEEDS: Partial<Record<ConversationIntent, MissingContextItem[]>> = {
  project_status_question: ["project", "blocked_milestone"],
  recommendation_request: ["project"],
  risk_analysis: ["project", "risk_evidence"],
  communication_draft: ["project", "stakeholder", "requested_output"],
  closure_question: ["project", "acceptance_status", "risk_evidence"],
  billing_question: ["project", "billing_status", "acceptance_status"],
  governance_question: ["risk_evidence"],
  audit_question: ["project", "requested_output"],
  task_or_action_request: ["project", "due_date", "decision_owner"],
};

function hasStakeholder(metadata: ConversationMetadata | undefined): boolean {
  return Boolean(metadata?.stakeholderName && metadata.stakeholderName.trim().length > 0);
}

function hasRequestedOutput(metadata: ConversationMetadata | undefined, messageMatchedSpecificOutput: boolean): boolean {
  if (metadata?.requestedOutput && metadata.requestedOutput.trim().length > 0) return true;
  return messageMatchedSpecificOutput;
}

function hasDueDate(metadata: ConversationMetadata | undefined): boolean {
  return Boolean(metadata?.dueDate && metadata.dueDate.trim().length > 0);
}

function hasDecisionOwner(metadata: ConversationMetadata | undefined): boolean {
  return Boolean(metadata?.decisionOwner && metadata.decisionOwner.trim().length > 0);
}

export type MissingContextParams = {
  intent: ConversationIntent;
  project: ResolvedProjectContext;
  metadata?: ConversationMetadata;
  /** Whether the raw message already named a specific deliverable (e.g. "correo de
   * seguimiento" names its own output) — when true, `requested_output` is never reported
   * missing even without explicit metadata. */
  messageMatchedSpecificOutput?: boolean;
};

/**
 * Computes which `MissingContextItem`s remain unresolved for a given intent. Pure function —
 * never fabricates evidence, only reports what genuinely isn't known yet.
 */
export function computeMissingContext(params: MissingContextParams): MissingContextItem[] {
  const needs = INTENT_CONTEXT_NEEDS[params.intent];
  if (!needs || needs.length === 0) return [];

  const missing: MissingContextItem[] = [];
  const facts = params.project.facts;

  for (const item of needs) {
    switch (item) {
      case "project":
        if (!params.project.available) missing.push("project");
        break;
      case "stakeholder":
        if (!hasStakeholder(params.metadata)) missing.push("stakeholder");
        break;
      case "requested_output":
        if (!hasRequestedOutput(params.metadata, Boolean(params.messageMatchedSpecificOutput))) missing.push("requested_output");
        break;
      case "due_date":
        if (!hasDueDate(params.metadata)) missing.push("due_date");
        break;
      case "decision_owner":
        if (!hasDecisionOwner(params.metadata)) missing.push("decision_owner");
        break;
      case "acceptance_status":
        if (!facts || facts.hasClientValidation === null || facts.hasClientSignoff === null) missing.push("acceptance_status");
        break;
      case "billing_status":
        if (!facts || facts.hasFinalInvoiceIssued === null || facts.hasInternalApprovalForBilling === null) missing.push("billing_status");
        break;
      case "risk_evidence":
        if (!facts || (facts.hasTechnicalEvidence === null && facts.openCriticalRisks === null && facts.openHighRisks === null)) {
          missing.push("risk_evidence");
        }
        break;
      case "blocked_milestone":
        if (!facts || (facts.overdueTasks === null && facts.openBlockingIssues === null)) missing.push("blocked_milestone");
        break;
      case "last_communication":
        if (!facts || facts.daysSinceLastStatusUpdate === null) missing.push("last_communication");
        break;
      default:
        break;
    }
  }

  return missing;
}
