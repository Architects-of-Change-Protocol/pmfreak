// AOC Recognition Runtime — Policy domain types
//
// Evidence and approval requirements are attached to an action+resourceScope
// pattern via a RecognitionRequirementRule. Evaluation itself lives in
// policies/*.ts; these are the shared data shapes the policies consume and
// produce.

export type EvidenceArtifactType =
  | "draft_action"
  | "project_context"
  | "source_document"
  | "system_log"
  | "external_reference";

export type ApprovalEvidenceArtifact = {
  id: string;
  type: EvidenceArtifactType;
  providedByActorId: string;
  uri?: string;
  hash?: string;
  description?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type RecognitionRiskLevel = "low" | "medium" | "high" | "critical";

// Matches an ActionRequest by action + resourceScope pattern. Patterns are
// exact strings or end with "*" for a prefix match (e.g. "project:*").
export type RecognitionRequirementRule = {
  id: string;
  trustDomainId: string;

  actionPattern: string;
  resourceScopePattern?: string;

  riskLevel: RecognitionRiskLevel;

  requiredEvidenceTypes: EvidenceArtifactType[];
  requiresHumanApproval: boolean;

  metadata?: Record<string, unknown>;
};

export type PolicyEvaluationResult = {
  policyName: string;
  passed: boolean;
  reasonCode: string;
  reason: string;
};
